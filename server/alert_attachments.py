"""
Alert attachment endpoints: upload to local disk, reference in the database.

Drop-in FastAPI router for the fraud-detection backend. Mount it on the main
app (the service that already serves /open-alerts-details, /alert-lock/*,
/alert-notes/*), e.g.:

    from fastapi import FastAPI
    from alert_attachments import router as attachments_router

    app = FastAPI()
    app.include_router(attachments_router, prefix="/alert-attachments")

Contract (matches the frontend alertAttachmentsService):
    POST /alert-attachments/list                {alert_id}                    -> [Attachment] | {attachments: [...]}
    POST /alert-attachments/upload              multipart(alert_id, uploaded_by, description, file)
    GET  /alert-attachments/download/{id}       Bearer token                  -> file stream
    POST /alert-attachments/delete              {attachment_id, alert_id, username}

Rules enforced here (the client also checks them, but the server is the gate):
    max 10 MB per file, allowed extensions whitelist, non-empty files.
Deletes are restricted to the user who uploaded the file.
"""

from __future__ import annotations

import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import (
    Column, DateTime, Integer, String, Text, create_engine, select,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Where uploaded files live on disk. Change per environment; the directory is
# created on first upload. Files are stored under per-alert subfolders.
ATTACHMENT_STORAGE_DIR = Path(
    os.environ.get("ATTACHMENT_STORAGE_DIR", "./data/alert_attachments")
)

MAX_FILE_MB = 10
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
ALLOWED_EXT = {
    "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt",
    "png", "jpg", "jpeg", "msg", "eml", "zip",
}

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost/fdt")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
Base = declarative_base()

router = APIRouter()


# ---------------------------------------------------------------------------
# Model (run alert_attachments.sql once, or Base.metadata.create_all(engine))
# ---------------------------------------------------------------------------

class AlertAttachment(Base):
    __tablename__ = "alert_attachments"

    attachment_id = Column(String(36), primary_key=True)
    alert_id = Column(String(255), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    # On-disk location relative to ATTACHMENT_STORAGE_DIR - never sent to clients.
    storage_path = Column(String(1024), nullable=False)
    uploaded_by = Column(String(100), nullable=False, index=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Auth: reuse the app's JWT verification. Replace the body of get_current_user
# with the same dependency the existing endpoints use if one already exists.
# ---------------------------------------------------------------------------

def get_current_user(request: Request) -> str:
    """Return the username from the Bearer token. Must reject invalid tokens."""
    import jwt  # PyJWT - use the same secret/algorithm as the rest of the app

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.removeprefix("Bearer ").strip()
    secret = os.environ.get("JWT_SECRET", "change-me")
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    username = payload.get("username") or payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token has no user")
    return str(username)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._\- ]+")
EMPTY = object()


def _to_int(value, default=None):
    """Coerce size fields that arrive as str/None/float from various clients."""
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _serialize(row: AlertAttachment) -> dict:
    return {
        "attachment_id": row.attachment_id,
        "alert_id": row.alert_id,
        "file_name": row.file_name,
        "file_size": _to_int(row.file_size, 0),
        "content_type": row.content_type,
        "description": row.description,
        "uploaded_by": row.uploaded_by,
        "uploaded_at": row.uploaded_at.isoformat() if row.uploaded_at else None,
    }


def _safe_filename(name: str) -> str:
    """Strip path separators and control characters; keep the extension."""
    name = os.path.basename(name or "file")
    cleaned = _SAFE_NAME.sub("_", name).strip("._") or "file"
    return cleaned[:200]


def _validate_upload(file_name: str, size: int) -> None:
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if not ext or ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="File type not allowed")
    if size <= 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if size > MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail=f"File over {MAX_FILE_MB} MB")


def _require_attachment(db: Session, attachment_id: str, alert_id: str) -> AlertAttachment:
    row = db.get(AlertAttachment, attachment_id)
    if row is None or (alert_id and row.alert_id != alert_id):
        raise HTTPException(status_code=404, detail="Attachment not found")
    return row


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/list")
def list_attachments(body: dict, db: Session = Depends(get_db)):
    alert_id = (body or {}).get("alert_id")
    if not alert_id:
        raise HTTPException(status_code=400, detail="alert_id is required")
    rows = db.scalars(
        select(AlertAttachment)
        .where(AlertAttachment.alert_id == alert_id)
        .order_by(AlertAttachment.uploaded_at.desc())
    ).all()
    # Client accepts a bare array or {attachments: [...]} - bare array is canonical.
    return [_serialize(r) for r in rows]


@router.post("/upload")
async def upload_attachment(
    alert_id: str = Form(...),
    uploaded_by: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # The uploader in the token wins over the form field so users cannot
    # attribute uploads to someone else.
    uploaded_by = user

    raw = await file.read(MAX_FILE_BYTES + 1)
    size = len(raw)
    safe_name = _safe_filename(file.filename or "file")
    _validate_upload(safe_name, size)

    attachment_id = str(uuid.uuid4())
    alert_dir = ATTACHMENT_STORAGE_DIR / re.sub(r"[^A-Za-z0-9._\-]", "_", str(alert_id))
    alert_dir.mkdir(parents=True, exist_ok=True)
    dest = alert_dir / f"{attachment_id}_{safe_name}"

    try:
        with open(dest, "wb") as out:
            out.write(raw)
        row = AlertAttachment(
            attachment_id=attachment_id,
            alert_id=str(alert_id),
            file_name=safe_name,
            file_size=size,
            content_type=file.content_type,
            description=(description or "").strip() or None,
            storage_path=str(dest.relative_to(ATTACHMENT_STORAGE_DIR)),
            uploaded_by=uploaded_by,
            uploaded_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        dest.unlink(missing_ok=True)  # don't orphan the file if the DB write failed
        raise HTTPException(status_code=500, detail="Could not save attachment")
    except OSError:
        raise HTTPException(status_code=500, detail="Could not store file on disk")

    return _serialize(row)


@router.get("/download/{attachment_id}")
def download_attachment(
    attachment_id: str,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _require_attachment(db, attachment_id, alert_id="")
    path = ATTACHMENT_STORAGE_DIR / row.storage_path
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File missing from storage")
    return FileResponse(
        path,
        media_type=row.content_type or "application/octet-stream",
        filename=row.file_name,
    )


@router.post("/delete")
def delete_attachment(
    body: dict,
    user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attachment_id = (body or {}).get("attachment_id")
    alert_id = (body or {}).get("alert_id")
    if not attachment_id:
        raise HTTPException(status_code=400, detail="attachment_id is required")

    row = _require_attachment(db, attachment_id, alert_id or "")
    # Only the uploader (or an admin role, if you wire one in) may delete.
    if row.uploaded_by.lower() != user.lower():
        raise HTTPException(status_code=403, detail="Only the uploader can delete this file")

    path = ATTACHMENT_STORAGE_DIR / row.storage_path
    try:
        db.delete(row)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Could not delete attachment")
    path.unlink(missing_ok=True)  # best effort after the DB row is gone
    return {"success": True}
