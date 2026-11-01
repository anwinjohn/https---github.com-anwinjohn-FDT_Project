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
  ChevronsUp,
  ChevronsDown,
  Lock,
  Eye,
  EyeOff,
  Timer,
} from 'lucide-react';
import { appConfig as config } from '../config/runtime-config';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';

/* -------------------------------------------------------------------------- */
/*  Types & config                                                            */
/* -------------------------------------------------------------------------- */

interface FaceIdLoginProps {
  onSuccess: () => void;
  onBack: () => void;
  username: string;
  /**
   * Returns a short-lived (<= 5 min) enrollment grant. Requested only AFTER the
   * user's password has been verified, used immediately, and never stored.
   * If omitted, the component calls ENROLLMENT_TOKEN_URL (below).
   */
  getEnrollmentToken?: (userId: string) => Promise<string | EnrollmentGrant>;
  /**
   * Verifies the account password before a face is enrolled. Return a boolean
   * or { verified, message?, action?, retryable? }. If omitted, the component
   * calls PASSWORD_VERIFY_URL (below).
   */
  verifyPassword?: (
    userId: string,
    password: string
  ) => Promise<boolean | PasswordCheck>;
  /** Start in enrollment mode (e.g. when rendered inside the onboarding flow). */
  initialMode?: 'verify' | 'enroll';
}

interface ChallengeData {
  challenge: string; // e.g. "BLINK" | "TURN_LEFT" | "TURN_RIGHT" | "SMILE" ...
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
  token?: string;
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

interface EnrollmentGrant {
  token: string; // the issuer's `access_token`
  expiresIn?: number; // seconds, from the issuer's `expires_in`
}

interface PasswordCheck {
  verified: boolean;
  message?: string;
  action?: string;
  retryable?: boolean;
}

interface PendingEnrollment {
  frames: File[];
  challengeId: string;
  expiresAt: number; // when the one-time challenge lapses
}

type RetryHintKey = 'single-face' | 'perform-action' | 'steady';
type Mode = 'verify' | 'enroll';

type Phase =
  | 'camera-init'
  | 'camera-error'
  | 'idle'
  | 'preparing' // fetching challenge
  | 'get-ready' // 3-2-1 with animated guide
  | 'capturing'
  | 'password' // enrollment only: confirm identity before enrolling
  | 'processing'
  | 'success'
  | 'error';

const API_BASE = config.api.EfrvBaseUrl; // Update to your FastAPI backend

// /auth/challenge sends min/max frames and a recommended fps (5), but no
// duration. /auth/verify validates the action INSIDE the frames, so the window
// must contain: look straight -> do the action -> settle.
// 4s @ 5fps = 20 frames (inside the API's 8-30 range). Tune if needed.
const DEFAULT_FPS = 5;
const DEFAULT_DURATION_S = 4;
const DEFAULT_MIN_FRAMES = 8;
const DEFAULT_MAX_FRAMES = 30;

// Set to true if the backend's TURN_LEFT / TURN_RIGHT refers to the direction
// as seen in the camera image rather than the user's own left/right. Only the
// on-screen instruction and animation are swapped; the API payload is unchanged.
const FLIP_TURN_DIRECTION = false;

// SECURITY: this key is visible to anyone who opens DevTools. It should live
// only on a server-side proxy that adds the header (see enrollment_token_proxy.py).
const ISSUER_KEY =
  'bHI_xYyuhl9xt8m3VVYYPUixEptz2fjijSu4g5Y0_v8yppK5EZ6-IMtcUobRl3UO'; // must match

// Default token provider. Expected response:
// { success, access_token, expires_in, token_type: "Bearer" }
const ENROLLMENT_TOKEN_URL = `${API_BASE}/onboarding/enrollment-token`;
// false = same CORS behavior as your other API calls (no cookies sent).
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

// Default password verifier.
// ASSUMPTION - confirm with your backend: POST { user_id, password } and a
// response containing a boolean `verified` (also accepts valid / authenticated /
// success). Wrong credentials should come back as HTTP 400/401/403/422 or
// `verified: false`.
// const PASSWORD_VERIFY_URL = `${API_BASE}/user/authenticate`;
// const defaultPasswordVerifier = async (
//   userId: string,
//   password: string
// ): Promise<PasswordCheck> => {
//   const { data } = await axios.post(
//     PASSWORD_VERIFY_URL,
//     { user_id: userId, password },
//     { timeout: 15000 }
//   );
//   return {
//     verified: Boolean(
//       data?.verified ?? data?.valid ?? data?.authenticated ?? data?.success
//     ),
//     message: typeof data?.message === 'string' ? data.message : undefined,
//     action: typeof data?.action === 'string' ? data.action : undefined,
//     retryable:
//       typeof data?.retryable === 'boolean' ? data.retryable : undefined,
//   };
// };

const defaultPasswordVerifier = async (
  userId: string,
  password: string
): Promise<PasswordCheck> => {
  const response = await apiClient.post<{
    status_code: number;
    verified?: boolean;
    valid?: boolean;
    authenticated?: boolean;
    success?: boolean;
    message?: string;
    detail?: string;
    action?: string;
    retryable?: boolean;
  }>('/user/authenticate', {
    user_id: userId,
    password,
  });

  if (response.data?.status_code != 200) {
    return {
      verified: false,
      message: response.data?.detail ?? response.error,
      retryable: response.data?.status_code == 404 ? false : true,
    };
  }
  // if (!response.success) {
  //   return {
  //     verified: false,
  //     message: response.message ?? response.error,
  //     retryable: true,
  //   };
  // }

  const result = response.data;
  return {
    verified: Boolean(
      result?.verified ??
      result?.valid ??
      result?.authenticated ??
      result?.success
    ),
    message: typeof result?.message === 'string' ? result.message : undefined,
    action: typeof result?.action === 'string' ? result.action : undefined,
    retryable:
      typeof result?.retryable === 'boolean' ? result.retryable : undefined,
  };
};

const MAX_PASSWORD_TRIES = 3;
const COUNTDOWN_FROM = 3;
const COUNTDOWN_STEP = 800; // ms per countdown number
const MAX_ATTEMPTS_BEFORE_HINT = 3;

/* ------------------------- challenge catalogue ---------------------------- */

type GuideKind =
  | 'blink'
  | 'turn-left'
  | 'turn-right'
  | 'smile'
  | 'mouth'
  | 'nod-up'
  | 'nod-down'
  | 'nod'
  | 'closer'
  | 'back'
  | 'unknown';

const GUIDES: Record<GuideKind, { title: string; hint: string; cue: string }> =
  {
    blink: {
      title: 'Blink your eyes',
      hint: 'Blink naturally, twice',
      cue: 'BLINK NOW',
    },
    'turn-left': {
      title: 'Turn your head left',
      hint: 'Slowly, then back to center',
      cue: 'TURN LEFT NOW',
    },
    'turn-right': {
      title: 'Turn your head right',
      hint: 'Slowly, then back to center',
      cue: 'TURN RIGHT NOW',
    },
    smile: {
      title: 'Smile and show your teeth',
      hint: 'A big, natural smile, then relax',
      cue: 'SMILE NOW',
    },
    mouth: {
      title: 'Open and close your mouth',
      hint: 'Like a slow yawn, then close',
      cue: 'OPEN & CLOSE',
    },
    'nod-up': {
      title: 'Tilt your head up',
      hint: 'Chin up, then back to center',
      cue: 'NOD UP NOW',
    },
    'nod-down': {
      title: 'Nod your head down',
      hint: 'Chin down, then back to center',
      cue: 'NOD DOWN NOW',
    },
    nod: {
      title: 'Nod your head',
      hint: 'Up, then down, then center',
      cue: 'NOD NOW',
    },
    closer: {
      title: 'Move closer to the camera',
      hint: 'Lean in slowly, then sit back',
      cue: 'MOVE CLOSER',
    },
    back: {
      title: 'Lean back from the camera',
      hint: 'Move back slowly, then return',
      cue: 'LEAN BACK',
    },
    unknown: {
      title: 'Follow the instruction',
      hint: 'Look at the camera',
      cue: 'DO IT NOW',
    },
  };

/** Maps whatever the API sends (BLINK, TURN_LEFT, SMILE, NOD_UP, ...) to a guide. */
const parseGuideKind = (raw?: string | null): GuideKind => {
  const c = (raw ?? '').toUpperCase().replace(/[^A-Z]+/g, '_');
  if (/BLINK/.test(c)) return 'blink';
  if (/SMILE|TEETH/.test(c)) return 'smile';
  if (/MOUTH|YAWN/.test(c)) return 'mouth';
  if (/NOD|LOOK_(UP|DOWN)|HEAD_(UP|DOWN)/.test(c)) {
    if (/UP/.test(c)) return 'nod-up';
    if (/DOWN/.test(c)) return 'nod-down';
    return 'nod';
  }
  if (/CLOSER|FORWARD|LEAN_IN|APPROACH|NEAR/.test(c)) return 'closer';
  if (/BACK|AWAY|FARTHER|FURTHER|LEAN_OUT/.test(c)) return 'back';
  if (/LEFT/.test(c)) return 'turn-left';
  if (/RIGHT/.test(c)) return 'turn-right';
  return 'unknown';
};

const resolveGuideKind = (raw?: string | null): GuideKind => {
  const k = parseGuideKind(raw);
  if (!FLIP_TURN_DIRECTION) return k;
  if (k === 'turn-left') return 'turn-right';
  if (k === 'turn-right') return 'turn-left';
  return k;
};

/* ------------------------------- helpers ---------------------------------- */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported - ignore */
  }
};

const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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

const FaceGuide: React.FC<{ kind: GuideKind }> = ({ kind }) => {
  const reduce = useReducedMotion();
  const move = !reduce;
  const times = [0, 0.35, 0.7, 1];
  const loop = {
    duration: 2.4,
    repeat: Infinity,
    ease: 'easeInOut' as const,
    times,
  };
  const fillBox = {
    transformBox: 'fill-box' as const,
    transformOrigin: 'center',
  };

  const turn = kind === 'turn-left' ? -1 : kind === 'turn-right' ? 1 : 0;
  const nod =
    kind === 'nod-up'
      ? [0, -9, -9, 0]
      : kind === 'nod-down'
        ? [0, 9, 9, 0]
        : kind === 'nod'
          ? [0, -9, 8, 0]
          : null;
  const scale =
    kind === 'closer'
      ? [1, 1.3, 1.3, 1]
      : kind === 'back'
        ? [1, 0.72, 0.72, 1]
        : null;

  const SMILE_CLOSED = 'M42 69 Q50 72 58 69 Z';
  const SMILE_OPEN = 'M36 65 Q50 84 64 65 Z';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      {/* target frame for "move closer" / "lean back" */}
      {(kind === 'closer' || kind === 'back') && (
        <ellipse
          cx={50}
          cy={50}
          rx={kind === 'closer' ? 36 : 19}
          ry={kind === 'closer' ? 45 : 25}
          fill="none"
          stroke="#fb923c"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
      )}

      <motion.g
        style={fillBox}
        animate={move && scale ? { scale } : undefined}
        transition={loop}
      >
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
            move
              ? turn
                ? { x: [0, turn * 4, turn * 4, 0] }
                : nod
                  ? { y: nod.map((v) => v * 0.4) }
                  : undefined
              : undefined
          }
          transition={loop}
        />

        {/* facial features (move more -> parallax = head turn / nod illusion) */}
        <motion.g
          style={fillBox}
          animate={
            move
              ? turn
                ? {
                    x: [0, turn * 11, turn * 11, 0],
                    scaleX: [1, 0.88, 0.88, 1],
                  }
                : nod
                  ? { y: nod }
                  : undefined
              : undefined
          }
          transition={loop}
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
                kind === 'blink' && move
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

          {/* mouth */}
          {kind === 'smile' ? (
            <motion.path
              d={move ? SMILE_CLOSED : SMILE_OPEN}
              fill="#fff"
              fillOpacity={move ? 0 : 1}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={1.8}
              strokeLinejoin="round"
              animate={
                move
                  ? {
                      d: [SMILE_CLOSED, SMILE_OPEN, SMILE_OPEN, SMILE_CLOSED],
                      fillOpacity: [0, 1, 1, 0],
                    }
                  : undefined
              }
              transition={loop}
            />
          ) : kind === 'mouth' ? (
            <motion.ellipse
              cx={50}
              cy={70}
              rx={7}
              ry={8}
              fill="rgba(0,0,0,0.55)"
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={1.8}
              style={fillBox}
              animate={move ? { scaleY: [0.12, 1, 1, 0.12] } : undefined}
              transition={loop}
            />
          ) : (
            <path
              d="M42 69 Q50 74 58 69"
              fill="none"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth={1.8}
              strokeLinecap="round"
            />
          )}
        </motion.g>
      </motion.g>

      {/* horizontal chevrons (turns) */}
      {turn !== 0 && (
        <motion.g
          animate={
            move
              ? { opacity: [0, 1, 0], x: [0, turn * 5, turn * 9] }
              : { opacity: 1 }
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

      {/* vertical chevrons (nods) */}
      {nod && (kind === 'nod-up' || kind === 'nod') && (
        <motion.g
          animate={
            move ? { opacity: [0, 1, 0], y: [0, -4, -8] } : { opacity: 1 }
          }
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        >
          <polyline
            points="41,17 50,8 59,17"
            fill="none"
            stroke="#fb923c"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>
      )}
      {nod && (kind === 'nod-down' || kind === 'nod') && (
        <motion.g
          animate={move ? { opacity: [0, 1, 0], y: [0, 4, 8] } : { opacity: 1 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
        >
          <polyline
            points="41,83 50,92 59,83"
            fill="none"
            stroke="#fb923c"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>
      )}

      {/* blink sparkle */}
      {kind === 'blink' && move && (
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
/*  Enrollment step indicator                                                 */
/* -------------------------------------------------------------------------- */

const EnrollSteps: React.FC<{ active: number }> = ({ active }) => (
  <ol
    className="flex items-center justify-center gap-2 mb-5 text-[11px]"
    aria-label="Enrollment progress"
  >
    {['Scan', 'Confirm', 'Done'].map((label, i) => (
      <React.Fragment key={label}>
        <li className="flex items-center gap-1.5">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center font-semibold ${
              i < active
                ? 'bg-green-500 text-white'
                : i === active
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/50'
            }`}
          >
            {i < active ? '✓' : i + 1}
          </span>
          <span className={i === active ? 'text-white' : 'text-white/50'}>
            {label}
          </span>
        </li>
        {i < 2 && <span className="w-6 h-px bg-white/20" aria-hidden="true" />}
      </React.Fragment>
    ))}
  </ol>
);

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
  password: '#60a5fa',
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
  verifyPassword,
  initialMode = 'verify',
}) => {
  const { loginWithFaceVerification } = useAuth();
  const reduce = useReducedMotion();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // frames + one-time challenge held in memory while the password is entered
  const pending = useRef<PendingEnrollment | null>(null);
  const passwordTries = useRef(0);

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
  const [lighting, setLighting] = useState<'ok' | 'dark' | 'bright'>('ok');

  // password step
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);

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
      pending.current = null;
      if (successTimer.current) clearTimeout(successTimer.current);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Lightweight lighting check while the user is lining up (idle only).
  useEffect(() => {
    if (phase !== 'idle') return;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const id = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, 32, 24);
      const d = ctx.getImageData(0, 0, 32, 24).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      const avg = sum / (d.length / 4);
      setLighting(avg < 50 ? 'dark' : avg > 205 ? 'bright' : 'ok');
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

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
                      { type: 'image/jpeg' }
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
    buzz([60, 40, 60]);
  };

  /* ------------------------- submit to /auth/* --------------------------- */

  const submitToApi = async (
    frames: File[],
    challengeId: string,
    headers?: Record<string, string>
  ) => {
    setPhase('processing');
    const form = new FormData();
    form.append('user_id', userId);
    form.append('challenge_id', challengeId);
    frames.forEach((f) => form.append('files', f));

    const { data } = await axios.post<ApiResponse>(
      `${API_BASE}/auth/${mode === 'enroll' ? 'enroll' : 'verify'}`,
      form,
      { timeout: 60000, headers }
    );
    if (!mounted.current) return;
    setResult(data);

    const ok =
      data.success &&
      (mode === 'enroll' ? data.enrolled !== false : !!data.authenticated);
    if (ok) {
      setAttempts(0);
      buzz(30);
      stopCamera(); // release the camera (and its LED) as soon as we're done
      if (mode === 'verify') {
        const signedIn = await loginWithFaceVerification(userId, data.token ?? '');
        if (!mounted.current) return;
        if (!signedIn) {
          fail('Face verification passed, but sign in could not be completed. Please try again.');
          return;
        }
        setPhase('success');
        successTimer.current = setTimeout(onSuccess, 1400);
      } else {
        setPhase('success');
      }
    } else {
      const f = toFailure(
        data,
        mode === 'enroll' ? 'Enrollment failed' : 'Face not recognized'
      );
      fail(f.message, f.hintSource, f);
    }
  };

  // Fetches a fresh grant from the onboarding backend. Called only after the
  // password is verified, and used immediately (never stored).
  const acquireEnrollHeaders = async (): Promise<Record<
    string,
    string
  > | null> => {
    let grant: EnrollmentGrant | undefined;
    try {
      const g = await (getEnrollmentToken ?? defaultEnrollmentTokenProvider)(
        userId
      );
      grant = typeof g === 'string' ? { token: g } : g;
    } catch {
      grant = undefined;
    }
    if (!grant?.token) {
      fail('You are not authorized to enroll this account.', '', {
        code: 'ENROLLMENT_AUTH_REQUIRED',
        action: 'Sign in through the trusted onboarding flow and retry.',
        retryable: false,
      });
      return null;
    }
    return { Authorization: `Bearer ${grant.token}` };
  };

  /* ------------------------------ main flow ------------------------------ */

  const runScan = async () => {
    if (busy.current) return;
    busy.current = true;
    pending.current = null;
    setResult(null);
    setMessage('');
    setProgress(0);
    setFrameCount(0);
    setRetryHint(null);
    setFailure(null);
    setChallenge(null);
    setPassword('');
    setPasswordError('');
    setShowPassword(false);

    try {
      // guard: nothing can start without a username from the login form
      if (!userId) {
        fail('Enter your username first.', '', {
          action: 'Go back, type your username, then open Face ID again.',
          retryable: false,
        });
        return;
      }
      if (mode === 'enroll' && passwordTries.current >= MAX_PASSWORD_TRIES) {
        fail('Too many incorrect passwords.', '', {
          code: 'PASSWORD_ATTEMPTS_EXCEEDED',
          action: 'For your security, sign in again to set up Face ID.',
          retryable: false,
        });
        return;
      }

      // 1. challenge (always a fresh one per attempt)
      setPhase('preparing');
      const { data: ch } = await axios.get<ChallengeData>(
        `${API_BASE}/auth/challenge`,
        { timeout: 20000 }
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

      // 4a. enrollment: confirm the person's password BEFORE calling /auth/enroll
      if (mode === 'enroll') {
        pending.current = { frames, challengeId: ch.challenge_id, expiresAt };
        const ttl = Math.max(1, Math.round((expiresAt - Date.now()) / 1000));
        setSessionTotal(ttl);
        setSecondsLeft(ttl);
        setPhase('password');
        return;
      }

      // 4b. login: submit straight away
      await submitToApi(frames, ch.challenge_id);
    } catch (e) {
      if (mounted.current) {
        const f = extractError(e);
        fail(f.message, f.hintSource, f);
      }
    } finally {
      busy.current = false;
    }
  };

  /* -------------------- enrollment: password confirmation ---------------- */

  const cancelPassword = () => {
    if (passwordBusy) return;
    pending.current = null;
    setPassword('');
    setPasswordError('');
    setShowPassword(false);
    setChallenge(null);
    setProgress(0);
    setPhase('idle');
  };

  const handlePasswordSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const p = pending.current;
    if (!p || busy.current || passwordBusy || !password) return;

    if (Date.now() > p.expiresAt - 2000) {
      pending.current = null;
      setPassword('');
      fail('Your scan expired before the password was confirmed.', '', {
        action: 'Scan again. Each scan is only valid for a short time.',
      });
      return;
    }

    busy.current = true;
    setPasswordBusy(true);
    setPasswordError('');
    const entered = password;
    setPassword(''); // never keep the password in state longer than needed

    try {
      // 1. verify the password with the backend
      let check: PasswordCheck;
      try {
        const r = await (verifyPassword ?? defaultPasswordVerifier)(
          userId,
          entered
        );
        check = typeof r === 'boolean' ? { verified: r } : r;
      } catch (err) {
        const status = axios.isAxiosError(err)
          ? err.response?.status
          : undefined;
        const f = extractError(err);
        if (status && [400, 401, 403, 422].includes(status)) {
          check = {
            verified: false,
            message: f.message,
            retryable: f.retryable,
          };
        } else {
          // network / server problem: not the user's fault, don't count a try
          setPasswordError(`${f.message} Please try again.`);
          return;
        }
      }
      if (!mounted.current) return;

      if (!check.verified) {
        passwordTries.current += 1;
        const left = MAX_PASSWORD_TRIES - passwordTries.current;
        if (check.retryable === false || left <= 0) {
          pending.current = null;
          fail(
            left <= 0
              ? 'Too many incorrect passwords.'
              : (check.message ?? 'Password verification failed.'),
            '',
            {
              code: 'PASSWORD_ATTEMPTS_EXCEEDED',
              action:
                check.action ??
                'For your security, sign in again to set up Face ID.',
              retryable: false,
            }
          );
          return;
        }
        setPasswordError(
          `${check.message ?? 'Incorrect password.'} ${left} attempt${
            left === 1 ? '' : 's'
          } left.`
        );
        passwordRef.current?.focus();
        buzz([60, 40, 60]);
        return;
      }

      // 2. verified -> get a fresh grant, then call /auth/enroll
      passwordTries.current = 0;
      setShowPassword(false);
      setPhase('processing');
      const headers = await acquireEnrollHeaders();
      if (!headers) return;
      pending.current = null;
      await submitToApi(p.frames, p.challengeId, headers);
    } catch (err) {
      if (mounted.current) {
        const f = extractError(err);
        fail(f.message, f.hintSource, f);
      }
    } finally {
      busy.current = false;
      if (mounted.current) setPasswordBusy(false);
    }
  };

  // Countdown for the one-time challenge while the password prompt is open.
  useEffect(() => {
    if (phase !== 'password') return;
    const tick = () => {
      const p = pending.current;
      if (!p) return;
      const left = Math.max(0, Math.ceil((p.expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !busy.current) {
        pending.current = null;
        setPassword('');
        fail('Time ran out before your password was confirmed.', '', {
          action: 'Scan again. Each scan is only valid for a short time.',
        });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === 'password') passwordRef.current?.focus();
  }, [phase]);

  /* ------------------------------ mode switch ---------------------------- */

  const switchMode = (m: Mode) => {
    if (busy.current) return;
    pending.current = null;
    setMode(m);
    setResult(null);
    setMessage('');
    setChallenge(null);
    setAttempts(0);
    setProgress(0);
    setRetryHint(null);
    setFailure(null);
    setPassword('');
    setPasswordError('');
    if (!streamRef.current) {
      startCamera(); // camera was released after success
    } else if (phase !== 'camera-error') {
      setPhase('idle');
    }
  };

  /* ------------------------------ derived UI ----------------------------- */

  const kind: GuideKind = challenge
    ? resolveGuideKind(challenge.challenge)
    : 'unknown';
  const guide = GUIDES[kind];
  const guideHint =
    kind === 'unknown' && challenge?.challenge
      ? `Instruction: ${challenge.challenge}`
      : guide.hint;

  // Capture timeline (by frame progress): face the camera -> act on cue -> settle.
  const stage: 'straight' | 'action' | 'settle' =
    progress < 20 ? 'straight' : progress < 88 ? 'action' : 'settle';
  const showGuide = !!challenge && ['get-ready', 'capturing'].includes(phase);
  const canSwitch =
    phase === 'idle' || phase === 'error' || phase === 'camera-error';
  const enrollStep =
    phase === 'success'
      ? 3
      : phase === 'processing'
        ? 2
        : phase === 'password'
          ? 1
          : 0;
  const lowTime = phase === 'password' && secondsLeft <= 10;

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
      title: guide.title,
      subtitle: 'Face the camera. Do this when the scan starts',
    },
    capturing:
      stage === 'straight'
        ? {
            title: 'Look straight ahead',
            subtitle: 'Face the camera, your cue is coming',
          }
        : stage === 'action'
          ? { title: `${guide.title} now`, subtitle: guideHint }
          : { title: 'Hold still', subtitle: 'Almost done…' },
    password: {
      title: 'Confirm it’s you',
      subtitle: 'Enter your password to finish setting up Face ID',
    },
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
          : phase === 'password'
            ? sessionTotal
              ? secondsLeft / sessionTotal
              : 1
            : 0;
  const ringStroke = lowTime ? '#fb923c' : ringColor[phase];

  const similarity =
    phase === 'success' && mode === 'verify' && result?.similarity != null
      ? Math.round(result.similarity * 100)
      : null;

  const backDisabled = phase === 'processing' || passwordBusy;

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
              disabled={backDisabled}
              aria-label="Go back"
              whileHover={backDisabled ? undefined : { scale: 1.05 }}
              whileTap={backDisabled ? undefined : { scale: 0.95 }}
              className="p-2 bg-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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

          {mode === 'enroll' &&
            !['camera-init', 'camera-error'].includes(phase) && (
              <EnrollSteps active={enrollStep} />
            )}

          {/* Camera ring */}
          <div className="flex justify-center mb-6">
            <div className="relative w-[min(24rem,82vw)] aspect-square">
              {/* progress ring (static SVG: the only thing that animates is the dash offset) */}
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
                <motion.circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  initial={false}
                  animate={{
                    strokeDashoffset: RING_C * (1 - ringProgress),
                    opacity:
                      phase === 'processing' || ringProgress <= 0 ? 0 : 1,
                  }}
                  transition={{
                    duration:
                      phase === 'capturing'
                        ? 0.2
                        : phase === 'password'
                          ? 0.9
                          : 0.5,
                    ease: phase === 'password' ? 'linear' : 'easeOut',
                  }}
                />
              </svg>

              {/* processing spinner: an HTML wrapper rotates around its own centre,
                  so the arc can never drift off the ring */}
              {phase === 'processing' && (
                <motion.div
                  className="absolute inset-0"
                  style={{ willChange: 'transform' }}
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.1,
                    ease: 'linear',
                  }}
                >
                  <svg
                    viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                    className="w-full h-full"
                    aria-hidden="true"
                  >
                    <circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={RING_R}
                      fill="none"
                      stroke={ringColor.processing}
                      strokeWidth={6}
                      strokeLinecap="round"
                      strokeDasharray={`${RING_C * 0.28} ${RING_C}`}
                    />
                  </svg>
                </motion.div>
              )}

              {/* video (always mounted so the stream survives every state).
                  Inset is a % so it always keeps the same gap to the ring. */}
              <div className="absolute inset-[5.5%] rounded-full overflow-hidden bg-black/30 border border-white/20">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover transition-all duration-500 ${
                    phase === 'camera-init' || phase === 'camera-error'
                      ? 'opacity-0'
                      : phase === 'password'
                        ? 'opacity-40 blur-sm'
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

                      {/* target frame for move closer / lean back */}
                      {stage === 'action' &&
                        (kind === 'closer' || kind === 'back') && (
                          <div
                            className={`absolute rounded-[50%] border-2 border-dashed border-orange-300 ${
                              kind === 'closer'
                                ? 'w-[86%] h-[94%]'
                                : 'w-[40%] h-[52%]'
                            }`}
                          />
                        )}

                      <span className="absolute top-[9%] left-1/2 -translate-x-1/2 text-[10px] font-semibold tracking-widest text-white bg-orange-500/90 px-2 py-0.5 rounded-full">
                        REC {frameCount}/{captureTotal}
                      </span>

                      {/* direction cue during the action stage */}
                      {stage === 'action' &&
                        (kind === 'turn-left' || kind === 'turn-right') && (
                          <motion.div
                            className={`absolute top-1/2 -translate-y-1/2 text-orange-300 ${
                              kind === 'turn-left' ? 'left-3' : 'right-3'
                            }`}
                            animate={
                              reduce
                                ? undefined
                                : {
                                    x: [0, kind === 'turn-left' ? -8 : 8, 0],
                                    opacity: [0.6, 1, 0.6],
                                  }
                            }
                            transition={{ duration: 0.8, repeat: Infinity }}
                          >
                            {kind === 'turn-left' ? (
                              <ChevronsLeft className="w-10 h-10" />
                            ) : (
                              <ChevronsRight className="w-10 h-10" />
                            )}
                          </motion.div>
                        )}
                      {stage === 'action' &&
                        (kind === 'nod-up' || kind === 'nod') && (
                          <motion.div
                            className="absolute top-[17%] left-1/2 -translate-x-1/2 text-orange-300"
                            animate={
                              reduce
                                ? undefined
                                : { y: [0, -8, 0], opacity: [0.6, 1, 0.6] }
                            }
                            transition={{ duration: 0.8, repeat: Infinity }}
                          >
                            <ChevronsUp className="w-10 h-10" />
                          </motion.div>
                        )}
                      {stage === 'action' &&
                        (kind === 'nod-down' || kind === 'nod') && (
                          <motion.div
                            className="absolute bottom-[24%] left-1/2 -translate-x-1/2 text-orange-300"
                            animate={
                              reduce
                                ? undefined
                                : { y: [0, 8, 0], opacity: [0.6, 1, 0.6] }
                            }
                            transition={{ duration: 0.8, repeat: Infinity }}
                          >
                            <ChevronsDown className="w-10 h-10" />
                          </motion.div>
                        )}

                      {/* stage cue pill */}
                      <span
                        className={`absolute bottom-[12%] left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-bold tracking-wide text-white px-4 py-1.5 rounded-full shadow-lg ${
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
                            ? guide.cue
                            : 'HOLD STILL'}
                      </span>
                    </motion.div>
                  )}

                  {phase === 'password' && (
                    <motion.div
                      key="pw"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="w-20 h-20 rounded-full bg-blue-500/30 border border-blue-300/50 flex items-center justify-center">
                        <Lock className="w-9 h-9 text-white" />
                      </div>
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
                <div className="absolute top-[3%] right-[12%] flex items-center gap-1 bg-black/40 backdrop-blur px-2 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-white">
                    LIVE
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Lighting warning (idle only) */}
          <AnimatePresence>
            {phase === 'idle' && lighting !== 'ok' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 flex items-center justify-center gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-full px-3 py-1.5 w-fit mx-auto"
                role="status"
              >
                <Lightbulb className="w-4 h-4" />
                {lighting === 'dark'
                  ? 'Too dark. Move somewhere brighter.'
                  : 'Too bright. Avoid strong light behind you.'}
              </motion.div>
            )}
          </AnimatePresence>

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
                    <FaceGuide kind={kind} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5 text-orange-300 text-[11px] font-semibold uppercase tracking-wide mb-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Liveness check
                    </div>
                    <div className="text-white font-semibold">
                      {guide.title}
                    </div>
                    <div className="text-white/60 text-xs">{guideHint}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Idle: how it works */}
          {phase === 'idle' && !!userId && (
            <div className="mb-5">
              <ol className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['1', 'Look straight'],
                  ['2', 'Act on the cue'],
                  ['3', 'Hold still'],
                ].map(([n, t]) => (
                  <li
                    key={n}
                    className="flex flex-col items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 py-2.5 px-1"
                  >
                    <span className="w-5 h-5 rounded-full bg-blue-500/30 text-blue-200 text-[11px] font-semibold flex items-center justify-center">
                      {n}
                    </span>
                    <span className="text-[11px] text-white/70 leading-tight">
                      {t}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-center text-[11px] text-white/45 mt-2.5">
                Only your face in view · You may be asked to blink, turn, smile,
                nod, open your mouth, or move closer or back
              </p>
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
                    <FaceGuide kind={kind} />
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

          {/* Password confirmation (enrollment only) */}
          {phase === 'password' && (
            <motion.form
              onSubmit={handlePasswordSubmit}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 mb-1"
              noValidate
            >
              {/* lets password managers pair the password with the account */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={userId}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
              />
              <label htmlFor="face-enroll-password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
                <input
                  id="face-enroll-password"
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={passwordBusy}
                  aria-invalid={!!passwordError}
                  aria-describedby={
                    passwordError ? 'face-enroll-password-error' : undefined
                  }
                  className="w-full pl-11 pr-12 py-3.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:border-blue-400/50 disabled:opacity-60 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-white/60 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>

              {passwordError && (
                <p
                  id="face-enroll-password-error"
                  role="alert"
                  className="text-xs text-red-300 text-left"
                >
                  {passwordError}
                </p>
              )}

              <div
                className={`flex items-center justify-center gap-1.5 text-xs ${
                  lowTime ? 'text-orange-300' : 'text-white/60'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                Scan valid for {fmtTime(secondsLeft)}
              </div>

              <motion.button
                type="submit"
                disabled={!password || passwordBusy}
                whileHover={
                  !password || passwordBusy ? undefined : { scale: 1.02 }
                }
                whileTap={
                  !password || passwordBusy ? undefined : { scale: 0.98 }
                }
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordBusy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
                {passwordBusy ? 'Checking…' : 'Confirm & save Face ID'}
              </motion.button>

              <button
                type="button"
                onClick={cancelPassword}
                disabled={passwordBusy}
                className="block mx-auto text-sm text-white/60 hover:text-white transition-colors disabled:opacity-40"
              >
                Cancel and start over
              </button>
            </motion.form>
          )}

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
