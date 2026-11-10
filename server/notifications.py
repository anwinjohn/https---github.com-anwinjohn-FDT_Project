"""
Notification endpoints: in-app notification list + Web Push subscriptions.

Drop-in FastAPI router for the fraud-detection backend. Mount it on the main
app (the service that already serves /open-alerts-details, /alert-lock/*,
/alert-notes/*, /alert-attachments/*):

    import asyncio
    from fastapi import FastAPI
    from notifications import router as notifications_router, set_notification_loop

    app = FastAPI()
    app.include_router(notifications_router, prefix="/notifications")

    @app.on_event("startup")
    async def _capture_loop():
        set_notification_loop(asyncio.get_running_loop())

    # If you skip the startup hook it still works: the loop is captured the
    # first time a browser opens the /ws socket.

Contract (matches the frontend notificationService):
    POST /notifications/list            {username, unread_only?, limit?}  -> [Notification]
    POST /notifications/unread-count    {username}                        -> {"count": n}
    POST /notifications/mark-read       {username, notification_ids?}     -> {"success": true}
    POST /notifications/delete          {username, notification_id}       -> {"success": true}
    GET  /notifications/vapid-public-key                                  -> {"public_key": "..."}
    POST /notifications/subscribe       {username, subscription, machine_info?} -> {"success": true}
    POST /notifications/unsubscribe     {username, endpoint}              -> {"success": true}

Live socket (same router):
    WS   /notifications/ws?token=<jwt>                                    -> live pushes

    Server -> client frames:
        {"type": "unread_count", "count": n}     on connect and on "sync"
        {"type": "notification", "notification": {...}}    new notification
        {"type": "pong"}                          reply to client "ping"
    Client -> server frames:
        {"type": "sync"}                          ask for current unread count
        {"type": "ping"}                          keepalive (client heartbeats)

    Every new notification created via create_notification() is pushed to the
    user's open sockets automatically; no polling is needed.

Security notes:
    - Every route requires a valid Bearer token (same JWT as the rest of the
      app). A user may only read/update/delete their OWN notifications - the
      username in the token wins over any username in the request body.
    - storage_path-style secrets are not stored here; push subscriptions hold
      only the endpoint URL and keys the Push API needs.

Push delivery (send when an alert fires, from any backend code):

    from notifications import send_push_to_user
    await send_push_to_user(db, "jdoe", {
        "title": "New high-risk alert",
        "body": "ALR-1234 flagged for customer X",
        "notification_id": "...")
    })

Setup once per environment:
    1. Generate VAPID keys:  python -m py_vapid generate  (or web-push CLI)
    2. Set env vars NOTIFICATIONS_VAPID_PRIVATE_KEY and
       NOTIFICATIONS_VAPID_SUBJECT (mailto:you@example.com). The public key is
       derived and served by /vapid-public-key.
    3. Run notifications.sql once to create the tables.
Requires: pywebpush  (pip install pywebpush)

Public key: BCGG_ahzAFrVqnrZ6NEmkliaXOGxnvdW92-JLOTjXVSs5eAOu5DhpRHfxmJqk0aS7vqmOkYHXccthhnwxSqQgto
Used in the browser when subscribing to push notifications.

Private key: W2lB_JzMQgSzqkDbcpWTLQdFoD-b0b06Rn7_F7wM_MY
Keep secret! Used on your server to sign push notification requests.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    DateTime,
    Index,
    String,
    Text,
    create_engine,
    delete as sa_delete,
    func,
    select,
    update,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost/fdt")
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me")

VAPID_PRIVATE_KEY = os.environ.get("NOTIFICATIONS_VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get(
    "NOTIFICATIONS_VAPID_SUBJECT", "mailto:admin@example.com"
)

MAX_LIST_LIMIT = 200

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()

router = APIRouter()


# ---------------------------------------------------------------------------
# Models (run notifications.sql once, or Base.metadata.create_all(engine))
# ---------------------------------------------------------------------------


class Notification(Base):
    __tablename__ = "app_notifications"

    notification_id = Column(String(36), primary_key=True)
    user_id = Column(String(100), nullable=False, index=True)
    type = Column(
        String(20), nullable=False, default="info"
    )  # alert|system|success|warning|info
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    link = Column(String(512), nullable=True)
    meta_json = Column(Text, nullable=True)  # JSON-encoded metadata


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    # One row per browser endpoint per user.
    id = Column(String(36), primary_key=True)
    user_id = Column(String(100), nullable=False, index=True)
    endpoint = Column(String(1024), nullable=False, unique=True)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    machine_info = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    last_used_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Auth: same pattern as alert_attachments.py
# ---------------------------------------------------------------------------


def _decode_token_username(token: str) -> Optional[str]:
    """Decode a JWT and return the username, or None if invalid/expired."""
    import jwt  # PyJWT - use the same secret/algorithm as the rest of the app

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None
    username = payload.get("username") or payload.get("sub")
    return str(username) if username else None


def get_current_user(request: Request) -> str:
    """Return the username from the Bearer token. Must reject invalid tokens."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    username = _decode_token_username(auth.removeprefix("Bearer ").strip())
    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return username


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Live socket: per-user connection registry + broadcast helpers
# ---------------------------------------------------------------------------


class _SocketManager:
    """Tracks the open notification WebSockets per username."""

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, username: str, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.setdefault(username, set()).add(ws)

    async def disconnect(self, username: str, ws: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(username)
            if conns is not None:
                conns.discard(ws)
                if not conns:
                    self._connections.pop(username, None)

    async def broadcast(self, username: str, message: Dict[str, Any]) -> None:
        async with self._lock:
            conns = list(self._connections.get(username, ()))
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                await self.disconnect(username, ws)


socket_manager = _SocketManager()

_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_notification_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Capture the app's main event loop so sync code can broadcast to it.

    Call from a FastAPI startup hook; also captured automatically the first
    time a browser opens the /ws socket.
    """
    global _main_loop
    _main_loop = loop


def _unread_count_sync(username: str) -> int:
    db = SessionLocal()
    try:
        count = db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == username, Notification.is_read.is_(False))
        )
        return int(count or 0)
    finally:
        db.close()


def _schedule_socket_broadcast(username: str, payload: Dict[str, Any]) -> None:
    """Fire notify_user_socket on the main loop from sync or async context."""
    if _main_loop is None or _main_loop.is_closed():
        return
    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None
    coro = socket_manager.broadcast(
        username,
        {"type": "notification", "notification": payload},
    )
    if running is _main_loop:
        asyncio.ensure_future(coro)
    else:
        asyncio.run_coroutine_threadsafe(coro, _main_loop)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ListBody(BaseModel):
    username: str = ""
    unread_only: bool = False
    limit: int = Field(default=50, ge=1, le=MAX_LIST_LIMIT)


class UserBody(BaseModel):
    username: str = ""


class MarkReadBody(BaseModel):
    username: str = ""
    notification_ids: Optional[List[str]] = None  # None/empty => mark all


class DeleteBody(BaseModel):
    username: str = ""
    notification_id: str


class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscriptionBody(BaseModel):
    username: str = ""
    subscription: Dict[str, Any]
    machine_info: Optional[Dict[str, Any]] = None


class UnsubscribeBody(BaseModel):
    username: str = ""
    endpoint: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ALLOWED_TYPES = {"alert", "system", "success", "warning", "info"}


def _serialize(row: Notification) -> dict:
    meta: Optional[dict] = None
    if row.meta_json:
        try:
            meta = json.loads(row.meta_json)
        except (ValueError, TypeError):
            meta = None
    return {
        "notification_id": row.notification_id,
        "user_id": row.user_id,
        "type": row.type if row.type in _ALLOWED_TYPES else "info",
        "title": row.title,
        "message": row.message,
        "is_read": bool(row.is_read),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "link": row.link,
        "meta": meta,
    }


def _require_own_user(body_username: str, token_user: str) -> str:
    """The token always wins: users can never touch someone else's data."""
    if body_username and body_username.strip().lower() != token_user.strip().lower():
        raise HTTPException(
            status_code=403, detail="Cannot access another user's notifications"
        )
    return token_user


def _vapid_public_key() -> Optional[str]:
    """Derive the public key from the private one (base64url of the EC point)."""
    if not VAPID_PRIVATE_KEY:
        return None
    try:
        from pywebpush import webpush  # noqa: F401  (import check only)

        import base64

        from cryptography.hazmat.primitives.serialization import Encoding
        from py_vapid import Vapid

        vapid = Vapid.from_string(VAPID_PRIVATE_KEY)
        raw = vapid.public_key.public_bytes(Encoding.X962, Format.UncompressedPoint)  # type: ignore[attr-defined]
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")
    except Exception:
        # Fall back to an explicitly-provided public key if derivation fails.
        return os.environ.get("NOTIFICATIONS_VAPID_PUBLIC_KEY")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/list")
def list_notifications(
    body: ListBody,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = _require_own_user(body.username, user)
    stmt = (
        select(Notification)
        .where(Notification.user_id == username)
        .order_by(Notification.created_at.desc())
        .limit(min(body.limit, MAX_LIST_LIMIT))
    )
    if body.unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    rows = db.scalars(stmt).all()
    return [_serialize(r) for r in rows]


@router.post("/unread-count")
def unread_count(
    body: UserBody, user: str = Depends(get_current_user), db: Session = Depends(get_db)
):
    username = _require_own_user(body.username, user)
    return {"count": _unread_count_sync(username)}


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket, token: str = Query(default="")):
    """Live notification socket for one signed-in user.

    Auth is the same JWT as the REST routes, passed as ?token= because the
    browser WebSocket API cannot set headers.
    """
    username = _decode_token_username(token)
    if not username:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    set_notification_loop(asyncio.get_running_loop())
    await socket_manager.connect(username, websocket)

    async def _send_unread() -> None:
        count = await asyncio.to_thread(_unread_count_sync, username)
        await websocket.send_json({"type": "unread_count", "count": count})

    try:
        await _send_unread()
        while True:
            msg = await websocket.receive_json()
            mtype = str(msg.get("type", ""))
            if mtype == "ping":
                await websocket.send_json({"type": "pong"})
            elif mtype == "sync":
                await _send_unread()
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception:
        pass
    finally:
        await socket_manager.disconnect(username, websocket)


@router.post("/mark-read")
def mark_read(
    body: MarkReadBody,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = _require_own_user(body.username, user)
    stmt = (
        update(Notification)
        .where(Notification.user_id == username, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    if body.notification_ids:
        stmt = stmt.where(Notification.notification_id.in_(body.notification_ids))
    db.execute(stmt)
    db.commit()
    return {"success": True}


@router.post("/delete")
def delete_notification(
    body: DeleteBody,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = _require_own_user(body.username, user)
    result = db.execute(
        sa_delete(Notification).where(
            Notification.notification_id == body.notification_id,
            Notification.user_id == username,
        )
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.get("/vapid-public-key")
def vapid_public_key(user: str = Depends(get_current_user)):
    key = _vapid_public_key()
    if not key:
        raise HTTPException(
            status_code=503, detail="Push not configured on this server"
        )
    return {"public_key": key}


@router.post("/subscribe")
def subscribe(
    body: SubscriptionBody,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = _require_own_user(body.username, user)
    endpoint = str(body.subscription.get("endpoint", "")).strip()
    if not endpoint.startswith("https://"):
        raise HTTPException(status_code=400, detail="Invalid subscription endpoint")
    keys = body.subscription.get("keys") or {}
    p256dh, auth = str(keys.get("p256dh", "")), str(keys.get("auth", ""))
    if not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Subscription keys missing")

    existing = db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    if existing:
        existing.user_id = username
        existing.p256dh, existing.auth = p256dh, auth
        existing.last_used_at = datetime.now(timezone.utc)
    else:
        db.add(
            PushSubscription(
                id=str(uuid.uuid4()),
                user_id=username,
                endpoint=endpoint[:1024],
                p256dh=p256dh[:255],
                auth=auth[:255],
                machine_info=(
                    json.dumps(body.machine_info)[:4000] if body.machine_info else None
                ),
                created_at=datetime.now(timezone.utc),
            )
        )
    db.commit()
    return {"success": True}


@router.post("/unsubscribe")
def unsubscribe(
    body: UnsubscribeBody,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = _require_own_user(body.username, user)
    db.execute(
        sa_delete(PushSubscription).where(
            PushSubscription.endpoint == body.endpoint,
            PushSubscription.user_id == username,
        )
    )
    db.commit()
    return {"success": True}


# ---------------------------------------------------------------------------
# Sending (called by backend code that creates alerts)
# ---------------------------------------------------------------------------


async def send_push_to_user(db: Session, username: str, payload: Dict[str, Any]) -> int:
    """
    Send a Web Push message to every device registered for `username`.
    Returns the number of devices the message was dispatched to. Never raises
    for individual-device failures - stale endpoints are removed instead.
    """
    if not VAPID_PRIVATE_KEY:
        return 0

    from pywebpush import WebPushException, webpush

    rows = db.scalars(
        select(PushSubscription).where(PushSubscription.user_id == username)
    ).all()
    sent = 0
    for row in rows:
        try:
            webpush(
                subscription_info={
                    "endpoint": row.endpoint,
                    "keys": {"p256dh": row.p256dh, "auth": row.auth},
                },
                data=json.dumps(payload),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            sent += 1
            row.last_used_at = datetime.now(timezone.utc)
        except WebPushException as exc:
            # 404/410 => the browser no longer knows this subscription; drop it.
            if exc.response and exc.response.status_code in (404, 410):
                db.execute(
                    sa_delete(PushSubscription).where(PushSubscription.id == row.id)
                )
        except Exception:
            continue
    db.commit()
    return sent


def create_notification(
    db: Session,
    username: str,
    title: str,
    message: str,
    notification_type: str = "info",
    link: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    push: bool = True,
) -> Notification:
    """
    Create a persisted notification (and optionally fire a push). Call this
    from alert-generation code, e.g.:

        create_notification(db, "jdoe", "New high-risk alert", "ALR-1234 ...",
                            notification_type="alert", link="alerts/ALR-1234")
    """
    if notification_type not in _ALLOWED_TYPES:
        notification_type = "info"
    row = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=username,
        type=notification_type,
        title=title[:255],
        message=message,
        is_read=False,
        created_at=datetime.now(timezone.utc),
        link=link[:512] if link else None,
        meta_json=json.dumps(meta) if meta else None,
    )
    db.add(row)
    db.commit()

    live_payload = {
        "title": title,
        "body": message,
        "notification_id": row.notification_id,
        "notification_type": notification_type,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "link": link,
        "meta": meta,
    }
    # Push to any open browser sockets (cheap, no HTTP round-trip for clients).
    _schedule_socket_broadcast(username, live_payload)

    if push:
        try:
            asyncio.get_event_loop().run_until_complete(
                send_push_to_user(db, username, live_payload)
            )
        except RuntimeError:
            # Already inside a running loop (e.g. FastAPI async route): use await
            # send_push_to_user(...) directly instead of create_notification.
            pass
    return row
