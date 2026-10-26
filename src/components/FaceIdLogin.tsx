import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import axios from 'axios';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  ScanFace,
  UserPlus,
  KeyRound,
  Loader2,
  Sparkles,
  Lightbulb,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { appConfig as config } from '../config/runtime-config';
/* -------------------------------------------------------------------------- */
/*  Types & config                                                            */
/* -------------------------------------------------------------------------- */

interface FaceIdLoginProps {
  onSuccess: () => void;
  onBack: () => void;
  username: string;
  /**
   * Returns a short-lived (<= 5 min) enrollment grant minted by your trusted
   * identity/onboarding BACKEND for exactly this user (sub === username,
   * scope "face-enrollment"). The browser never mints, derives or stores it.
   * It is requested on every enrollment attempt and kept only in a local
   * variable. If omitted, the component calls ENROLLMENT_TOKEN_URL (below).
   */
  getEnrollmentToken?: (userId: string) => Promise<string | EnrollmentGrant>;
  /** Start in enrollment mode (e.g. when rendered inside the onboarding flow). */
  initialMode?: 'verify' | 'enroll';
}

interface ChallengeData {
  challenge: string; // "BLINK" | "TURN_LEFT" | "TURN_RIGHT"
  challenge_id: string;
  expires_in?: number;
  // capture settings returned by GET /auth/challenge (field names are read
  // defensively in parseCaptureSettings - adjust there if yours differ)
  [key: string]: unknown;
}

interface ApiResponse {
  success: boolean;
  authenticated?: boolean;
  similarity?: number;
  reason?: string;
  retry_hint?: string;
  hint?: string;
  // structured result (enroll success and all errors)
  code?: string;
  message?: string;
  action?: string;
  retryable?: boolean;
  enrolled?: boolean;
}

interface Failure {
  message: string;
  action?: string;
  code?: string;
  retryable: boolean;
  hintSource: string;
}

interface CaptureSettings {
  frames: number; // how many ordered frames to send
  fps: number; // capture rate
  minFrames: number;
  maxFrames: number;
}

type RetryHintKey = 'single-face' | 'perform-action' | 'steady';

interface EnrollmentGrant {
  token: string; // the issuer's `access_token`
  expiresIn?: number; // seconds, from the issuer's `expires_in`
}

type Mode = 'verify' | 'enroll';

type Phase =
  | 'camera-init'
  | 'camera-error'
  | 'idle'
  | 'preparing' // fetching challenge
  | 'get-ready' // 3-2-1 with animated guide
  | 'capturing'
  | 'processing'
  | 'success'
  | 'error';

const API_BASE = config.api.EfrvBaseUrl; // Update to your FastAPI backend
// /auth/challenge sends min/max frames and a recommended fps (5), but no
// duration. /auth/verify now validates the action INSIDE the frames, so the
// window must be long enough to contain: look straight -> do the action ->
// settle. 4s @ 5fps = 20 frames (inside the API's 8-30 range). Tune if needed.
const DEFAULT_FPS = 5;
const DEFAULT_DURATION_S = 4;

// Set to true if the backend's TURN_LEFT / TURN_RIGHT refers to the direction
// as seen in the camera image rather than the user's own left/right. Only the
// on-screen instruction and animation are swapped; the API payload is unchanged.
const FLIP_TURN_DIRECTION = false;
const displayChallenge = (c: string): string => {
  if (!FLIP_TURN_DIRECTION) return c;
  if (c === 'TURN_LEFT') return 'TURN_RIGHT';
  if (c === 'TURN_RIGHT') return 'TURN_LEFT';
  return c;
};
const DEFAULT_MIN_FRAMES = 8;
const DEFAULT_MAX_FRAMES = 30;
const ISSUER_KEY =
  'bHI_xYyuhl9xt8m3VVYYPUixEptz2fjijSu4g5Y0_v8yppK5EZ6-IMtcUobRl3UO'; // must match
// Default token provider. Point this at YOUR backend's session-authenticated
// endpoint (see enrollment_token_proxy.py), NOT directly at the issuer.
// The issuer requires the secret `x-onboarding-issuer-key` header; that key
// must live only on the server, so the browser never sends or contains it.
// Expected response: { success, access_token, expires_in, token_type: "Bearer" }
const ENROLLMENT_TOKEN_URL = `${API_BASE}/onboarding/enrollment-token`;
// false = same CORS behavior as your other API calls (no cookies sent).
// Set true ONLY if the token endpoint authenticates via a session cookie; the
// server must then allow your exact origin + Access-Control-Allow-Credentials: true.
const ENROLLMENT_TOKEN_WITH_CREDENTIALS = false;
const defaultEnrollmentTokenProvider = async (
  userId: string
): Promise<EnrollmentGrant> => {
  const { data } = await axios.post(
    ENROLLMENT_TOKEN_URL,
    { user_id: userId },
    {
      timeout: 10000,
      withCredentials: ENROLLMENT_TOKEN_WITH_CREDENTIALS,
      headers: {
        'x-onboarding-issuer-key': ISSUER_KEY,
      },
    }
  );
  const token = data?.access_token ?? data?.token;
  if (data?.success === false || typeof token !== 'string' || !token) {
    throw new Error('Enrollment token was not issued');
  }
  return { token, expiresIn: Number(data?.expires_in) || undefined };
};
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP = 800; // ms per countdown number
const MAX_ATTEMPTS_BEFORE_HINT = 3;

const CHALLENGES: Record<string, { title: string; hint: string }> = {
  BLINK: { title: 'Blink your eyes', hint: 'Blink naturally, twice' },
  TURN_LEFT: {
    title: 'Turn your head left',
    hint: 'Slowly, then back to center',
  },
  TURN_RIGHT: {
    title: 'Turn your head right',
    hint: 'Slowly, then back to center',
  },
};

const getChallengeMeta = (c?: string | null) =>
  (c && CHALLENGES[c]) || {
    title: 'Follow the instruction',
    hint: c ?? 'Look at the camera',
  };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Reads capture settings from the challenge response (flat or nested). */
const parseCaptureSettings = (ch: ChallengeData): CaptureSettings => {
  const nested = (ch.capture ?? ch.capture_settings ?? ch.capture_config) as
    | Record<string, unknown>
    | undefined;
  const pick = (...keys: string[]): number | undefined => {
    for (const k of keys) {
      const v = Number(nested?.[k] ?? ch[k]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return undefined;
  };

  const minFrames = pick('min_frames') ?? DEFAULT_MIN_FRAMES;
  const maxFrames = Math.max(
    minFrames,
    pick('max_frames') ?? DEFAULT_MAX_FRAMES
  );
  const fps = pick('recommended_fps', 'fps', 'capture_fps') ?? DEFAULT_FPS;
  const durationS =
    pick(
      'recommended_duration_seconds',
      'duration_seconds',
      'duration_s',
      'duration'
    ) ?? DEFAULT_DURATION_S;
  const wanted =
    pick('recommended_frames', 'num_frames', 'frame_count', 'frames') ??
    Math.round(fps * durationS);

  return {
    frames: Math.min(maxFrames, Math.max(minFrames, Math.round(wanted))),
    fps,
    minFrames,
    maxFrames,
  };
};

const RETRY_HINTS: Record<RetryHintKey, { title: string; text: string }> = {
  'single-face': {
    title: 'Keep one face in view',
    text: 'Make sure only you are visible and your face stays inside the circle the whole time.',
  },
  'perform-action': {
    title: 'Do the action while scanning',
    text: 'Look straight at the camera first, then perform the action as soon as the cue appears while the ring is filling.',
  },
  steady: {
    title: 'Hold the camera steady',
    text: 'Rest your device on a surface or keep it still, with good lighting, during the scan.',
  },
};

/** Maps the API's retry hint / reason text to one of our three guided hints. */
const matchRetryHint = (text?: string): RetryHintKey | null => {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/steady|shak|blur|stable|motion|still/.test(t)) return 'steady';
  if (/action|challenge|blink|turn|perform|movement/.test(t))
    return 'perform-action';
  if (/face|person|people|visible/.test(t)) return 'single-face';
  return null;
};

/** Normalizes an API error body: { code, message, action, retryable } (+ legacy reason/detail). */
const toFailure = (raw: unknown, fallback: string): Failure => {
  let body = (raw ?? {}) as Record<string, unknown>;
  if (body.detail && typeof body.detail === 'object') {
    body = body.detail as Record<string, unknown>; // FastAPI HTTPException wrapper
  }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const message =
    str(body.message) ?? str(body.reason) ?? str(body.detail) ?? fallback;
  const action = str(body.action);
  const code = str(body.code);
  const hint = str(body.retry_hint) ?? str(body.hint);
  return {
    message,
    action,
    code,
    // only an explicit `retryable: false` blocks the retry button
    retryable: typeof body.retryable === 'boolean' ? body.retryable : true,
    hintSource: [hint, message, action].filter(Boolean).join(' '),
  };
};

const extractError = (e: unknown): Failure => {
  if (axios.isAxiosError(e)) {
    if (e.response)
      return toFailure(
        e.response.data,
        'Something went wrong. Please try again.'
      );
    if (e.code === 'ECONNABORTED') {
      return {
        message: 'The server took too long to respond.',
        retryable: true,
        hintSource: '',
      };
    }
    return {
      message: 'Cannot reach the server. Check your connection.',
      retryable: true,
      hintSource: '',
    };
  }
  return {
    message: 'Something went wrong. Please try again.',
    retryable: true,
    hintSource: '',
  };
};

/* -------------------------------------------------------------------------- */
/*  Animated challenge guide                                                  */
/*  Drawn from the USER's point of view, matching the mirrored camera preview */
/* -------------------------------------------------------------------------- */

const FaceGuide: React.FC<{ type: string }> = ({ type }) => {
  const reduce = useReducedMotion();
  const turn = type === 'TURN_LEFT' ? -1 : type === 'TURN_RIGHT' ? 1 : 0;
  const loop = { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const };
  const fillBox = {
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
  };

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {/* head outline (moves a little) */}
      <motion.ellipse
        cx={50}
        cy={50}
        rx={25}
        ry={33}
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth={2}
        animate={
          turn && !reduce ? { x: [0, turn * 4, turn * 4, 0] } : undefined
        }
        transition={{ ...loop, times: [0, 0.35, 0.7, 1] }}
      />

      {/* facial features (move more -> parallax = head turn illusion) */}
      <motion.g
        style={fillBox}
        animate={
          turn && !reduce
            ? { x: [0, turn * 11, turn * 11, 0], scaleX: [1, 0.88, 0.88, 1] }
            : undefined
        }
        transition={{ ...loop, times: [0, 0.35, 0.7, 1] }}
      >
        {[40, 60].map((cx) => (
          <motion.ellipse
            key={cx}
            cx={cx}
            cy={44}
            rx={3.6}
            ry={4.6}
            fill="#fff"
            style={fillBox}
            animate={
              type === 'BLINK' && !reduce
                ? { scaleY: [1, 0.1, 1, 1, 0.1, 1, 1] }
                : undefined
            }
            transition={{
              duration: 2.4,
              repeat: Infinity,
              times: [0, 0.1, 0.2, 0.5, 0.6, 0.7, 1],
            }}
          />
        ))}
        <path
          d="M50 48 L47 58 L52 58"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M42 69 Q50 74 58 69"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </motion.g>

      {/* direction chevrons */}
      {turn !== 0 && (
        <motion.g
          animate={
            reduce
              ? { opacity: 1 }
              : { opacity: [0, 1, 0], x: [0, turn * 5, turn * 9] }
          }
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        >
          <polyline
            points={turn < 0 ? '17,40 8,50 17,60' : '83,40 92,50 83,60'}
            fill="none"
            stroke="#fb923c"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>
      )}

      {/* blink sparkle */}
      {type === 'BLINK' && !reduce && (
        <motion.g
          animate={{ opacity: [0, 1, 0, 0, 1, 0, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            times: [0, 0.1, 0.2, 0.5, 0.6, 0.7, 1],
          }}
        >
          <circle cx={26} cy={30} r={2} fill="#fb923c" />
          <circle cx={74} cy={30} r={2} fill="#fb923c" />
        </motion.g>
      )}
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/*  Progress ring                                                             */
/* -------------------------------------------------------------------------- */

const RING_SIZE = 288;
const RING_R = 136;
const RING_C = 2 * Math.PI * RING_R;

const ringColor: Record<Phase, string> = {
  'camera-init': '#60a5fa',
  'camera-error': '#f87171',
  idle: '#60a5fa',
  preparing: '#a78bfa',
  'get-ready': '#fb923c',
  capturing: '#fb923c',
  processing: '#a78bfa',
  success: '#4ade80',
  error: '#f87171',
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

const FaceIdLogin: React.FC<FaceIdLoginProps> = ({
  onSuccess,
  onBack,
  username,
  getEnrollmentToken,
  initialMode = 'verify',
}) => {
  const reduce = useReducedMotion();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // login is the default; enrollment only when a trusted token provider exists
  const [mode, setMode] = useState<Mode>(
    initialMode === 'enroll' ? 'enroll' : 'verify'
  );
  // user id always comes from the username field of the login form
  const userId = (username ?? '').trim();
  const [phase, setPhase] = useState<Phase>('camera-init');
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [progress, setProgress] = useState(0); // 0-100 capture progress
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [captureTotal, setCaptureTotal] = useState(0);
  const [retryHint, setRetryHint] = useState<RetryHintKey | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  /* ------------------------------- camera -------------------------------- */

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setPhase('camera-init');
    setMessage('');
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
      }
      const video = videoRef.current;
      if (video) {
        video.srcObject = streamRef.current;
        await video.play().catch(() => undefined);
      }
      if (mounted.current) setPhase('idle');
    } catch (err) {
      const denied =
        err instanceof DOMException && err.name === 'NotAllowedError';
      setMessage(
        denied
          ? 'Camera access was blocked. Allow it in your browser settings, then try again.'
          : 'We could not open your camera. Make sure no other app is using it.'
      );
      if (mounted.current) setPhase('camera-error');
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    startCamera();
    return () => {
      mounted.current = false;
      if (successTimer.current) clearTimeout(successTimer.current);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  /* ------------------------------ capture -------------------------------- */

  // Captures `settings.frames` ordered frames at `settings.fps`.
  // Frames are scheduled against a fixed clock (not "sleep after encode"), so
  // JPEG encoding never stretches the capture window or drifts the frame rate.
  const captureFrames = async (settings: CaptureSettings): Promise<File[]> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!video || !canvas || !ctx) return [];

    canvas.width = 640;
    canvas.height = 480;

    const interval = 1000 / settings.fps;
    const encoded: Promise<File | null>[] = [];
    const t0 = performance.now();

    setFrameCount(0);
    for (let i = 0; i < settings.frames; i++) {
      const wait = t0 + i * interval - performance.now();
      if (wait > 0) await sleep(wait);

      // draw the RAW (un-mirrored) frame; the mirror is only a CSS preview effect
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // toBlob snapshots the canvas at call time, so we don't await it here
      const index = i;
      encoded.push(
        new Promise<File | null>((resolve) =>
          canvas.toBlob(
            (blob) =>
              resolve(
                blob
                  ? new File(
                      [blob],
                      `frame_${String(index).padStart(3, '0')}.jpg`,
                      {
                        type: 'image/jpeg',
                      }
                    )
                  : null
              ),
            'image/jpeg',
            0.8
          )
        )
      );

      setFrameCount(i + 1);
      setProgress(((i + 1) / settings.frames) * 100);
    }

    // Promise.all keeps the original capture order
    return (await Promise.all(encoded)).filter((f): f is File => f !== null);
  };

  const fail = (msg: string, hintSource?: string, info?: Partial<Failure>) => {
    const retryable = info?.retryable ?? true;
    setFailure({
      message: msg,
      action: info?.action,
      code: info?.code,
      retryable,
      hintSource: hintSource ?? msg,
    });
    // capture-tip cards only make sense for retryable capture failures
    setRetryHint(retryable ? matchRetryHint(hintSource ?? msg) : null);
    setMessage(msg);
    setAttempts((a) => a + 1);
    setPhase('error');
  };

  /* ------------------------------ main flow ------------------------------ */

  const runScan = async () => {
    if (busy.current) return;
    busy.current = true;
    setResult(null);
    setMessage('');
    setProgress(0);
    setFrameCount(0);
    setRetryHint(null);
    setFailure(null);
    setChallenge(null);

    try {
      // guard: nothing can start without a username from the login form
      if (!userId) {
        fail('Enter your username first.', undefined, {
          action: 'Go back, type your username, then open Face ID again.',
          retryable: false,
        });
        return;
      }

      // 0. enrollment only: get a fresh grant from the trusted onboarding backend.
      //    Requested per attempt (grants live <= 5 min), held in a local variable
      //    only - never in state, storage, logs or the URL.
      let enrollHeaders: Record<string, string> | undefined;
      let enrollExpiresAt = 0;

      // Fetches a grant and records when it expires (issuer `expires_in`, 300s).
      // Returns false (after showing the error) if no token could be obtained.
      const loadToken = async (): Promise<boolean> => {
        let grant: EnrollmentGrant | undefined;
        try {
          const g = await (
            getEnrollmentToken ?? defaultEnrollmentTokenProvider
          )(userId);
          grant = typeof g === 'string' ? { token: g } : g;
        } catch {
          grant = undefined;
        }
        if (!grant?.token) {
          fail('You are not authorized to enroll this account.', undefined, {
            code: 'ENROLLMENT_AUTH_REQUIRED',
            action: 'Sign in through the trusted onboarding flow and retry.',
            retryable: false,
          });
          return false;
        }
        enrollHeaders = { Authorization: `Bearer ${grant.token}` };
        enrollExpiresAt = Date.now() + (grant.expiresIn ?? 300) * 1000;
        return true;
      };

      if (mode === 'enroll' && !(await loadToken())) return;

      // 1. challenge (always a fresh one per attempt)
      setPhase('preparing');
      const { data: ch } = await axios.get<ChallengeData>(
        `${API_BASE}/auth/challenge`,
        {
          timeout: 20000,
        }
      );
      if (!mounted.current) return;
      setChallenge(ch);
      const settings = parseCaptureSettings(ch);
      setCaptureTotal(settings.frames);
      const expiresAt = Date.now() + (ch.expires_in ?? 60) * 1000;

      // 2. get ready (guide animation plays during countdown)
      setPhase('get-ready');
      for (let n = COUNTDOWN_FROM; n > 0; n--) {
        setCountdown(n);
        await sleep(COUNTDOWN_STEP);
      }
      if (!mounted.current) return;
      if (Date.now() > expiresAt) {
        fail('The challenge expired. Please try again.');
        return;
      }

      // 3. capture
      setPhase('capturing');
      const frames = await captureFrames(settings);
      if (frames.length < settings.minFrames) {
        fail(
          'We could not capture enough frames. Keep the camera steady and try again.',
          'steady'
        );
        return;
      }

      // 4. submit
      setPhase('processing');
      const form = new FormData();
      form.append('user_id', userId);
      form.append('challenge_id', ch.challenge_id);
      frames.forEach((f) => form.append('files', f));

      // the grant must be used within `expires_in`; refresh if it is about to lapse
      if (
        mode === 'enroll' &&
        Date.now() > enrollExpiresAt - 5000 &&
        !(await loadToken())
      ) {
        return;
      }

      const { data } = await axios.post<ApiResponse>(
        `${API_BASE}/auth/${mode === 'enroll' ? 'enroll' : 'verify'}`,
        form,
        { timeout: 60000, headers: enrollHeaders }
      );
      if (!mounted.current) return;
      setResult(data);

      const ok =
        data.success &&
        (mode === 'enroll' ? data.enrolled !== false : !!data.authenticated);
      if (ok) {
        setPhase('success');
        setAttempts(0);
        if (mode === 'verify') {
          successTimer.current = setTimeout(onSuccess, 1400);
        }
      } else {
        const f = toFailure(
          data,
          mode === 'enroll' ? 'Enrollment failed' : 'Face not recognized'
        );
        fail(f.message, f.hintSource, f);
      }
    } catch (e) {
      if (mounted.current) {
        const f = extractError(e);
        fail(f.message, f.hintSource, f);
      }
    } finally {
      busy.current = false;
      setChallenge((c) => (mounted.current ? c : null));
    }
  };

  const switchMode = (m: Mode) => {
    if (busy.current) return;
    setMode(m);
    setResult(null);
    setMessage('');
    setChallenge(null);
    setAttempts(0);
    setProgress(0);
    setRetryHint(null);
    setFailure(null);
    if (phase !== 'camera-error') setPhase('idle');
  };

  /* ------------------------------ derived UI ----------------------------- */

  const shownType = challenge
    ? displayChallenge(challenge.challenge)
    : undefined;
  const meta = getChallengeMeta(shownType);

  // Capture timeline (by frame progress): face the camera -> act on cue -> settle.
  // Frames are recorded continuously through all three stages, so the action
  // is always inside the frames that /auth/verify validates.
  const stage: 'straight' | 'action' | 'settle' =
    progress < 20 ? 'straight' : progress < 88 ? 'action' : 'settle';
  const showGuide = !!challenge && ['get-ready', 'capturing'].includes(phase);
  const canSwitch =
    phase === 'idle' || phase === 'error' || phase === 'camera-error';

  const copy: Record<Phase, { title: string; subtitle: string }> = {
    'camera-init': {
      title: 'Starting camera',
      subtitle: 'Please allow camera access',
    },
    'camera-error': { title: 'Camera unavailable', subtitle: message },
    idle:
      mode === 'verify'
        ? {
            title: 'Sign in with Face ID',
            subtitle: userId
              ? `Welcome back, ${userId}`
              : 'Enter your username to continue',
          }
        : {
            title: 'Set up Face ID',
            subtitle: 'A quick one-time scan to register your face',
          },
    preparing: {
      title: 'Preparing secure check',
      subtitle: 'Requesting a one-time challenge',
    },
    'get-ready': {
      title: meta.title,
      subtitle: 'Face the camera. Do this when the scan starts',
    },
    capturing:
      stage === 'straight'
        ? {
            title: 'Look straight ahead',
            subtitle: 'Face the camera, your cue is coming',
          }
        : stage === 'action'
          ? { title: `${meta.title} now`, subtitle: meta.hint }
          : { title: 'Hold still', subtitle: 'Almost done…' },
    processing:
      mode === 'verify'
        ? {
            title: 'Verifying identity',
            subtitle: 'Matching your face securely',
          }
        : {
            title: 'Saving your Face ID',
            subtitle: 'Creating your face profile',
          },
    success:
      mode === 'verify'
        ? { title: 'Welcome back!', subtitle: 'Signing you in…' }
        : {
            title: 'Face ID is ready',
            subtitle: result?.message ?? 'You can now sign in with your face',
          },
    error: {
      title: mode === 'verify' ? "We couldn't verify you" : 'Enrollment failed',
      subtitle: message || 'Please try again',
    },
  };

  const ringProgress =
    phase === 'success' || phase === 'error' || phase === 'camera-error'
      ? 1
      : phase === 'capturing'
        ? progress / 100
        : phase === 'get-ready'
          ? (COUNTDOWN_FROM - countdown + 1) / COUNTDOWN_FROM
          : 0;

  const similarity =
    phase === 'success' && mode === 'verify' && result?.similarity != null
      ? Math.round(result.similarity * 100)
      : null;

  /* -------------------------------- render ------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative w-full max-w-lg mx-auto z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <motion.button
              onClick={onBack}
              aria-label="Go back"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 bg-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>

            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
              <span className="text-white font-semibold">Face ID</span>
            </div>

            {/* mode chip (spacer-sized) */}
            <div className="w-9 h-9 flex items-center justify-center">
              {mode === 'enroll' && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-green-300 bg-green-500/20 border border-green-400/30 rounded-full px-2 py-1">
                  Setup
                </span>
              )}
            </div>
          </div>

          {/* Camera ring */}
          <div className="flex justify-center mb-6">
            <div className="relative w-[min(24rem,82vw)] aspect-square">
              {/* ring */}
              <svg
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                className="absolute inset-0 w-full h-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={6}
                />
                {phase === 'processing' ? (
                  <motion.circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_R}
                    fill="none"
                    stroke={ringColor.processing}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={`${RING_C * 0.28} ${RING_C}`}
                    style={{
                      transformBox: 'fill-box',
                      transformOrigin: 'center',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.1,
                      ease: 'linear',
                    }}
                  />
                ) : (
                  <motion.circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_R}
                    fill="none"
                    stroke={ringColor[phase]}
                    strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    initial={false}
                    animate={{ strokeDashoffset: RING_C * (1 - ringProgress) }}
                    transition={{ duration: phase === 'capturing' ? 0.2 : 0.5 }}
                  />
                )}
              </svg>

              {/* video (always mounted so the stream survives every state) */}
              <div className="absolute inset-[14px] rounded-full overflow-hidden bg-black/30 border border-white/20">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover transition-all duration-500 ${
                    phase === 'camera-init' || phase === 'camera-error'
                      ? 'opacity-0'
                      : phase === 'processing' ||
                          phase === 'success' ||
                          phase === 'error'
                        ? 'opacity-50 blur-[2px]'
                        : 'opacity-100'
                  }`}
                  style={{ transform: 'scaleX(-1)' }}
                />

                {/* overlays */}
                <AnimatePresence mode="wait">
                  {phase === 'camera-init' && (
                    <motion.div
                      key="init"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70"
                    >
                      <Camera className="w-10 h-10" />
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </motion.div>
                  )}

                  {phase === 'camera-error' && (
                    <motion.div
                      key="cam-err"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center text-red-300"
                    >
                      <CameraOff className="w-12 h-12" />
                    </motion.div>
                  )}

                  {phase === 'idle' && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="w-[58%] h-[74%] rounded-[50%] border-2 border-dashed border-white/50" />
                    </motion.div>
                  )}

                  {phase === 'preparing' && (
                    <motion.div
                      key="prep"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30"
                    >
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    </motion.div>
                  )}

                  {phase === 'get-ready' && (
                    <motion.div
                      key={`count-${countdown}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.4 }}
                      transition={{ duration: 0.35 }}
                      className="absolute inset-0 flex items-center justify-center bg-black/25"
                    >
                      <span className="text-7xl font-bold text-white drop-shadow-lg">
                        {countdown}
                      </span>
                    </motion.div>
                  )}

                  {phase === 'capturing' && (
                    <motion.div
                      key="cap"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <motion.div
                        animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className={`relative w-[62%] h-[78%] rounded-[50%] border-4 transition-colors duration-300 ${
                          stage === 'straight'
                            ? 'border-white/80'
                            : stage === 'action'
                              ? 'border-orange-400'
                              : 'border-green-400'
                        }`}
                      />
                      <span className="absolute top-8 left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-widest text-white bg-orange-500/90 px-2 py-0.5 rounded-full">
                        REC {frameCount}/{captureTotal}
                      </span>

                      {/* direction cue during the action stage */}
                      {stage === 'action' &&
                        (shownType === 'TURN_LEFT' ||
                          shownType === 'TURN_RIGHT') && (
                          <motion.div
                            className={`absolute top-1/2 -translate-y-1/2 text-orange-300 ${
                              shownType === 'TURN_LEFT' ? 'left-3' : 'right-3'
                            }`}
                            animate={
                              reduce
                                ? undefined
                                : {
                                    x: [
                                      0,
                                      shownType === 'TURN_LEFT' ? -8 : 8,
                                      0,
                                    ],
                                    opacity: [0.6, 1, 0.6],
                                  }
                            }
                            transition={{ duration: 0.8, repeat: Infinity }}
                          >
                            {shownType === 'TURN_LEFT' ? (
                              <ChevronsLeft className="w-10 h-10" />
                            ) : (
                              <ChevronsRight className="w-10 h-10" />
                            )}
                          </motion.div>
                        )}

                      {/* stage cue pill */}
                      <span
                        className={`absolute bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-bold tracking-wide text-white px-4 py-1.5 rounded-full shadow-lg ${
                          stage === 'action'
                            ? 'bg-orange-500'
                            : stage === 'settle'
                              ? 'bg-green-600'
                              : 'bg-white/25'
                        }`}
                      >
                        {stage === 'straight'
                          ? 'LOOK STRAIGHT'
                          : stage === 'action'
                            ? shownType === 'BLINK'
                              ? 'BLINK NOW'
                              : shownType === 'TURN_LEFT'
                                ? 'TURN LEFT NOW'
                                : shownType === 'TURN_RIGHT'
                                  ? 'TURN RIGHT NOW'
                                  : 'DO IT NOW'
                            : 'HOLD STILL'}
                      </span>
                    </motion.div>
                  )}

                  {phase === 'processing' && (
                    <motion.div
                      key="proc"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 overflow-hidden"
                    >
                      {!reduce && (
                        <motion.div
                          className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-purple-400/40 to-transparent"
                          initial={{ top: '-20%' }}
                          animate={{ top: '100%' }}
                          transition={{
                            duration: 1.4,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ScanFace className="w-14 h-14 text-white/90" />
                      </div>
                    </motion.div>
                  )}

                  {phase === 'success' && (
                    <motion.div
                      key="ok"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 220 }}
                      className="absolute inset-0 flex items-center justify-center bg-green-500/20"
                    >
                      <CheckCircle2 className="w-20 h-20 text-green-300" />
                    </motion.div>
                  )}

                  {phase === 'error' && (
                    <motion.div
                      key="err"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 220 }}
                      className="absolute inset-0 flex items-center justify-center bg-red-500/20"
                    >
                      <XCircle className="w-20 h-20 text-red-300" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* LIVE badge */}
              {['idle', 'get-ready', 'capturing'].includes(phase) && (
                <div className="absolute top-3 right-6 flex items-center gap-1 bg-black/40 backdrop-blur px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-white">
                    LIVE
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Title & subtitle */}
          <div className="text-center mb-5 min-h-[4.25rem]" aria-live="polite">
            <motion.h2
              key={copy[phase].title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-bold text-white mb-1"
            >
              {copy[phase].title}
            </motion.h2>
            <motion.p
              key={copy[phase].subtitle}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={`text-sm ${
                phase === 'error' || phase === 'camera-error'
                  ? 'text-red-200'
                  : 'text-white/70'
              }`}
            >
              {copy[phase].subtitle}
            </motion.p>
            {/* server-suggested next step (error `action`, or enroll-success `action`) */}
            {(phase === 'error'
              ? failure?.action
              : phase === 'success' && mode === 'enroll'
                ? result?.action
                : undefined) && (
              <p className="text-xs text-white/60 mt-2">
                {phase === 'error' ? failure?.action : result?.action}
              </p>
            )}
            {similarity !== null && (
              <p className="text-xs text-green-300 mt-1">
                Match confidence {similarity}%
              </p>
            )}
          </div>

          {/* Challenge instruction card with animated guide */}
          <AnimatePresence>
            {showGuide && challenge && (
              <motion.div
                key="guide"
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mb-5 flex items-center gap-4 p-3 rounded-2xl bg-gradient-to-r from-orange-600/20 to-amber-600/10 border border-orange-400/30">
                  <div className="w-20 h-20 shrink-0 rounded-xl bg-white/5 border border-white/10">
                    <FaceGuide type={displayChallenge(challenge.challenge)} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5 text-orange-300 text-[11px] font-semibold uppercase tracking-wide mb-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Liveness check
                    </div>
                    <div className="text-white font-semibold">{meta.title}</div>
                    <div className="text-white/60 text-xs">{meta.hint}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Idle tip */}
          {phase === 'idle' && (
            <div className="flex flex-wrap justify-center gap-2 mb-5">
              {[
                'Only your face in view',
                'Look straight first',
                'Act when the cue appears',
              ].map((t) => (
                <span
                  key={t}
                  className="text-[11px] text-white/70 bg-white/5 border border-white/10 rounded-full px-3 py-1"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Retry hint from the API (what to fix on the next attempt) */}
          <AnimatePresence>
            {phase === 'error' && retryHint && (
              <motion.div
                key={retryHint}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10"
              >
                {retryHint === 'perform-action' && challenge ? (
                  <div className="w-16 h-16 shrink-0 rounded-xl bg-white/5 border border-white/10">
                    <FaceGuide type={displayChallenge(challenge.challenge)} />
                  </div>
                ) : (
                  <Lightbulb className="w-5 h-5 mt-0.5 text-amber-300 shrink-0" />
                )}
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">
                    {RETRY_HINTS[retryHint].title}
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">
                    {RETRY_HINTS[retryHint].text}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Primary action */}
          <div className="space-y-3">
            {phase === 'idle' && !userId && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-400/30">
                  <Lightbulb className="w-5 h-5 mt-0.5 text-amber-300 shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-semibold text-white">
                      Enter your username first
                    </div>
                    <div className="text-xs text-white/60 mt-0.5">
                      Face ID needs to know who is signing in. Go back, type
                      your username, then open Face ID again.
                    </div>
                  </div>
                </div>
                <motion.button
                  onClick={onBack}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back to enter username
                </motion.button>
              </div>
            )}

            {phase === 'idle' && !!userId && (
              <motion.button
                onClick={runScan}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl ${
                  mode === 'verify'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                }`}
              >
                {mode === 'verify' ? (
                  <ScanFace className="w-5 h-5" />
                ) : (
                  <UserPlus className="w-5 h-5" />
                )}
                {mode === 'verify' ? 'Scan to sign in' : 'Start enrollment'}
              </motion.button>
            )}

            {phase === 'camera-error' && (
              <motion.button
                onClick={startCamera}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg"
              >
                <Camera className="w-5 h-5" />
                Allow camera &amp; retry
              </motion.button>
            )}

            {phase === 'error' && failure?.retryable === false && (
              <motion.button
                onClick={onBack}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to sign in
              </motion.button>
            )}

            {phase === 'error' && failure?.retryable !== false && (
              <motion.button
                onClick={runScan}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <RefreshCw className="w-5 h-5" />
                Try again{attempts > 1 ? ` (${attempts})` : ''}
              </motion.button>
            )}

            {phase === 'success' && mode === 'enroll' && (
              <motion.button
                onClick={() => switchMode('verify')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg"
              >
                <ScanFace className="w-5 h-5" />
                Continue to Face ID login
              </motion.button>
            )}

            {/* Secondary actions */}
            {canSwitch && !!userId && (
              <div className="flex flex-col items-center gap-2 pt-1">
                {attempts >= MAX_ATTEMPTS_BEFORE_HINT && (
                  <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm text-orange-300 hover:text-orange-200 transition-colors"
                  >
                    <KeyRound className="w-4 h-4" />
                    Having trouble? Use your password
                  </button>
                )}

                {mode === 'verify' ? (
                  <button
                    onClick={() => switchMode('enroll')}
                    className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    First time? Set up Face ID
                  </button>
                ) : (
                  <button
                    onClick={() => switchMode('verify')}
                    className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    <ScanFace className="w-4 h-4" />
                    Already set up? Sign in with Face ID
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default FaceIdLogin;
