import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Globe,
  Languages,
  Camera,
  Trash2,
  Upload,
  Save,
  RotateCcw,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Monitor,
  LogOut,
  LogIn,
  Bell,
  Clock,
  CalendarDays,
  BadgeCheck,
  RefreshCw,
  Copy,
  Download,
  KeyRound,
  History,
  Info,
  MapPin,
  Moon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import apiClient from '../utils/apiClient';

/* ================================================================== */
/*  Types — merge these into ../types/types.ts                         */
/* ================================================================== */

export interface UserProfileData {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  role_name: string;
  avatar_url: string | null;
  timezone: string;
  language: string;
  two_factor_enabled: boolean;
  last_login: string | null;
  created_at: string | null;
  password_changed_at?: string | null;
  /** NEW: false while a changed email address is awaiting verification. */
  email_verified?: boolean;
  /** NEW: lifecycle state of the account. */
  status?: 'active' | 'pending' | 'locked' | 'suspended';
  /** NEW: effective permission keys, read-only, for transparency / access reviews. */
  permissions?: string[];
  /** NEW: line manager, read-only. */
  manager_name?: string | null;
}

export interface UserSession {
  session_id: string;
  device: string;
  browser: string;
  ip_address: string;
  location?: string;
  last_active: string;
  is_current: boolean;
  /** NEW: server flags sign-ins from a location/device not seen before. */
  is_new_location?: boolean;
}

export interface UserPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  security_alerts: boolean;
  weekly_digest: boolean;
  /** NEW (all optional → backward compatible with the old 4-key payload) */
  high_risk_alerts?: boolean;
  case_assignments?: boolean;
  sla_breaches?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string; // "HH:mm"
  quiet_hours_end?: string; // "HH:mm"
  time_format?: '12h' | '24h';
}

export type ActivityType =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'two_factor_enabled'
  | 'two_factor_disabled'
  | 'profile_updated'
  | 'avatar_changed'
  | 'session_revoked'
  | 'preferences_updated';

export interface ActivityEvent {
  id: string;
  type: ActivityType | string;
  timestamp: string;
  success: boolean;
  ip_address?: string;
  device?: string;
  location?: string;
  detail?: string;
}

export interface TwoFactorSetup {
  secret: string;
  otpauth_uri?: string;
  /** Server-rendered QR as a data: URL (keeps the secret off third-party QR services). */
  qr_code_data_url?: string;
}

type Prefs = Required<UserPreferences>;
type BoolPrefKey =
  | 'email_notifications'
  | 'push_notifications'
  | 'security_alerts'
  | 'weekly_digest'
  | 'high_risk_alerts'
  | 'case_assignments'
  | 'sla_breaches'
  | 'quiet_hours_enabled';

type EditableField =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'job_title'
  | 'timezone'
  | 'language';

type ProfileForm = Record<EditableField, string>;
type FormErrors = Partial<Record<EditableField, string>>;
type TabId = 'profile' | 'security' | 'sessions' | 'activity' | 'preferences';
type Notify = (msg: string, type?: 'success' | 'error') => void;

interface UserProfilePageProps {
  /** Called after any successful profile/avatar/security change so the app shell can refresh. */
  onProfileUpdated?: (profile: UserProfileData) => void;
}

/* ================================================================== */
/*  Config                                                             */
/* ================================================================== */

/**
 * Sample-data fallback. OFF by default and never active in production builds:
 * set VITE_PROFILE_MOCKS=true in a local .env to develop without a backend.
 * (Swap this accessor for your bundler's env mechanism if you are not on Vite.)
 */
const USE_MOCKS: boolean = (() => {
  try {
    return (import.meta as any).env?.VITE_PROFILE_MOCKS === 'true';
  } catch {
    return false;
  }
})();

/** Keep in sync with the backend policy — the server is the source of truth. */
const PASSWORD_POLICY = { minLength: 12, maxLength: 128, maxAgeDays: 90 };

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // processed output limit
const AVATAR_RAW_MAX_BYTES = 8 * 1024 * 1024; // accepted before client-side resize
const AVATAR_OUTPUT_SIDE = 512;
const AVATAR_MIN_SIDE = 128;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
];
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

/* ================================================================== */
/*  API layer                                                          */
/*  - Errors are THROWN (ApiError) so every catch block actually runs. */
/*  - Mocks are opt-in (dev only) and can never mask a real failure.   */
/*  - The server MUST derive identity from the session token and       */
/*    ignore/validate the user_id sent in request bodies.              */
/* ================================================================== */

export class ApiError extends Error {
  status?: number;
  fieldErrors?: Record<string, string>;
  constructor(
    message: string,
    status?: number,
    fieldErrors?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

const sanitizeFieldErrors = (
  raw: unknown
): Record<string, string> | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
    const msg = Array.isArray(v) ? v[0] : v;
    if (typeof msg === 'string' && msg) out[k] = msg;
  });
  return Object.keys(out).length ? out : undefined;
};

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  429: 'Too many attempts. Please wait a moment and try again.',
};

const toApiError = (err: any, fallback: string): ApiError => {
  if (err instanceof ApiError) return err;
  const status: number | undefined = err?.response?.status ?? err?.status;
  const data = err?.response?.data ?? err?.data;
  const message =
    data?.message ||
    data?.error ||
    (status ? STATUS_MESSAGES[status] : undefined) ||
    err?.message ||
    fallback;
  return new ApiError(
    typeof message === 'string' ? message : fallback,
    status,
    sanitizeFieldErrors(data?.errors)
  );
};

const isNetworkFailure = (x: any) => !x?.response && !x?.status;

const unwrap = <T,>(res: any): T => (res?.data?.data ?? res?.data) as T;

async function request<T>(
  exec: () => Promise<any>,
  fallback: string,
  mock?: () => T
): Promise<T> {
  let res: any;
  try {
    res = await exec();
  } catch (err) {
    if (USE_MOCKS && mock && isNetworkFailure(err)) return mock();
    throw toApiError(err, fallback);
  }
  if (res?.success === false) {
    if (USE_MOCKS && mock && isNetworkFailure(res)) return mock();
    throw toApiError(
      { status: res.status, data: res, message: res.message },
      fallback
    );
  }
  return unwrap<T>(res);
}

/* ---------- Mock data (dev only, shapes match API_DOCUMENTATION.md) ---------- */

const MOCK_PROFILE: UserProfileData = {
  id: 'u-1001',
  username: 'demo.analyst',
  first_name: 'Demo',
  last_name: 'Analyst',
  email: 'demo.analyst@arie.app',
  phone: '+971 50 123 4567',
  job_title: 'Senior Fraud Analyst',
  department: 'Risk & Compliance',
  role_name: 'Analyst',
  avatar_url: null,
  timezone: 'Asia/Dubai',
  language: 'en',
  two_factor_enabled: false,
  last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  created_at: '2024-03-15T09:30:00Z',
  password_changed_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  email_verified: true,
  status: 'active',
  manager_name: 'Layla Haddad',
  permissions: [
    'alerts.view',
    'alerts.triage',
    'cases.create',
    'cases.update',
    'rules.view',
    'reports.view',
    'reports.export',
    'dashboards.view',
  ],
};

const MOCK_SESSIONS: UserSession[] = [
  {
    session_id: 's-current',
    device: 'Chrome on Windows',
    browser: 'Chrome 126',
    ip_address: '10.20.4.87',
    location: 'Dubai, AE',
    last_active: new Date().toISOString(),
    is_current: true,
  },
  {
    session_id: 's-2',
    device: 'Safari on iPhone',
    browser: 'Safari 17',
    ip_address: '92.98.114.12',
    location: 'Abu Dhabi, AE',
    last_active: new Date(Date.now() - 3 * 3600000).toISOString(),
    is_current: false,
  },
  {
    session_id: 's-3',
    device: 'Firefox on Linux',
    browser: 'Firefox 127',
    ip_address: '185.220.101.4',
    location: 'Unknown',
    last_active: new Date(Date.now() - 26 * 3600000).toISOString(),
    is_current: false,
    is_new_location: true,
  },
];

const MOCK_PREFERENCES: Prefs = {
  email_notifications: true,
  push_notifications: true,
  security_alerts: true,
  weekly_digest: false,
  high_risk_alerts: true,
  case_assignments: true,
  sla_breaches: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  time_format: '24h',
};

const MOCK_ACTIVITY: ActivityEvent[] = Array.from({ length: 28 }, (_, i) => {
  const kinds: [ActivityType, boolean][] = [
    ['login', true],
    ['login', true],
    ['profile_updated', true],
    ['login_failed', false],
    ['login', true],
    ['password_changed', true],
    ['session_revoked', true],
    ['two_factor_enabled', true],
    ['avatar_changed', true],
  ];
  const [type, success] = kinds[i % kinds.length];
  const suspicious = type === 'login_failed';
  return {
    id: `a-${i}`,
    type,
    success,
    timestamp: new Date(Date.now() - (i * 7 + 1) * 3600000).toISOString(),
    ip_address: suspicious ? '185.220.101.4' : '10.20.4.87',
    location: suspicious ? 'Unknown' : 'Dubai, AE',
    device: suspicious ? 'Firefox on Linux' : 'Chrome on Windows',
  };
});

const randomCodes = () =>
  Array.from({ length: 10 }, () =>
    Array.from({ length: 2 }, () =>
      Math.random().toString(36).slice(2, 7).toUpperCase()
    ).join('-')
  );

/* ---------- Endpoints ---------- */

const profileApi = {
  /** GET /profile/me */
  getProfile: async (): Promise<UserProfileData> => {
    const data = await request<UserProfileData>(
      () => apiClient.get('/profile/me'),
      'Failed to load your profile',
      () => ({ ...MOCK_PROFILE })
    );
    if (!data || !(data as any).id)
      throw new ApiError('The profile service returned an empty response');
    return data;
  },

  /** PUT /profile/update { user_id, ...changedFields } */
  updateProfile: (userId: string, changes: Partial<ProfileForm>) =>
    request<UserProfileData | undefined>(
      () => apiClient.put('/profile/update', { user_id: userId, ...changes }),
      'Failed to update profile',
      () => {
        Object.assign(MOCK_PROFILE, changes);
        return { ...MOCK_PROFILE };
      }
    ),

  /** POST /profile/avatar (multipart: user_id, avatar) */
  uploadAvatar: (
    userId: string,
    file: File,
    onProgress?: (pct: number) => void
  ) => {
    const form = new FormData();
    form.append('user_id', userId);
    form.append('avatar', file);
    return request<{ avatar_url: string }>(
      () =>
        apiClient.post('/profile/avatar', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e: any) => {
            if (e?.total && onProgress)
              onProgress(Math.round((e.loaded / e.total) * 100));
          },
        }),
      'Failed to upload photo',
      () => {
        const url = URL.createObjectURL(file);
        MOCK_PROFILE.avatar_url = url;
        return { avatar_url: url };
      }
    );
  },

  /** DELETE /profile/avatar { user_id } */
  removeAvatar: (userId: string) =>
    request<unknown>(
      () => apiClient.delete('/profile/avatar', { data: { user_id: userId } }),
      'Failed to remove photo',
      () => {
        MOCK_PROFILE.avatar_url = null;
        return { success: true };
      }
    ),

  /** POST /profile/change-password */
  changePassword: (
    userId: string,
    current_password: string,
    new_password: string,
    confirm_password: string
  ) =>
    request<unknown>(
      () =>
        apiClient.post('/profile/change-password', {
          user_id: userId,
          current_password,
          new_password,
          confirm_password,
        }),
      'Failed to change password',
      () => {
        MOCK_PROFILE.password_changed_at = new Date().toISOString();
        return { success: true };
      }
    ),

  /** POST /profile/two-factor/setup { user_id } → { secret, otpauth_uri?, qr_code_data_url? } */
  twoFactorSetup: (userId: string) =>
    request<TwoFactorSetup>(
      () => apiClient.post('/profile/two-factor/setup', { user_id: userId }),
      'Failed to start two-factor setup',
      () => ({
        secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        otpauth_uri: 'otpauth://totp/ARIE:demo.analyst?secret=JBSWY3DP',
      })
    ),

  /** POST /profile/two-factor/verify { user_id, code } → { recovery_codes } (enables 2FA) */
  twoFactorVerify: (userId: string, code: string) =>
    request<{ recovery_codes: string[] }>(
      () =>
        apiClient.post('/profile/two-factor/verify', {
          user_id: userId,
          code,
        }),
      'Verification failed',
      () => {
        if (!/^\d{6}$/.test(code))
          throw new ApiError('Invalid verification code', 400);
        MOCK_PROFILE.two_factor_enabled = true;
        return { recovery_codes: randomCodes() };
      }
    ),

  /** POST /profile/two-factor/disable { user_id, password } — requires re-authentication */
  twoFactorDisable: (userId: string, password: string) =>
    request<unknown>(
      () =>
        apiClient.post('/profile/two-factor/disable', {
          user_id: userId,
          password,
        }),
      'Failed to disable two-factor authentication',
      () => {
        MOCK_PROFILE.two_factor_enabled = false;
        return { success: true };
      }
    ),

  /** GET /profile/sessions */
  getSessions: async (): Promise<UserSession[]> => {
    const data = await request<UserSession[]>(
      () => apiClient.get('/profile/sessions'),
      'Failed to load sessions',
      () => MOCK_SESSIONS.map((s) => ({ ...s }))
    );
    return Array.isArray(data) ? data : [];
  },

  /** POST /profile/sessions/revoke { user_id, session_id } */
  revokeSession: (userId: string, sessionId: string) =>
    request<unknown>(
      () =>
        apiClient.post('/profile/sessions/revoke', {
          user_id: userId,
          session_id: sessionId,
        }),
      'Failed to sign out session',
      () => {
        const idx = MOCK_SESSIONS.findIndex((s) => s.session_id === sessionId);
        if (idx >= 0) MOCK_SESSIONS.splice(idx, 1);
        return { success: true };
      }
    ),

  /** POST /profile/sessions/revoke-others { user_id } */
  revokeOtherSessions: (userId: string) =>
    request<unknown>(
      () =>
        apiClient.post('/profile/sessions/revoke-others', { user_id: userId }),
      'Failed to sign out other sessions',
      () => {
        for (let i = MOCK_SESSIONS.length - 1; i >= 0; i--)
          if (!MOCK_SESSIONS[i].is_current) MOCK_SESSIONS.splice(i, 1);
        return { success: true };
      }
    ),

  /** GET /profile/preferences */
  getPreferences: async (): Promise<Prefs> => {
    const data = await request<UserPreferences>(
      () => apiClient.get('/profile/preferences'),
      'Failed to load preferences',
      () => ({ ...MOCK_PREFERENCES })
    );
    return withPrefDefaults(data);
  },

  /** PUT /profile/preferences { user_id, ...changedPreferences } */
  updatePreferences: (userId: string, changes: Partial<UserPreferences>) =>
    request<unknown>(
      () =>
        apiClient.put('/profile/preferences', { user_id: userId, ...changes }),
      'Failed to save preference',
      () => {
        Object.assign(MOCK_PREFERENCES, changes);
        return { success: true };
      }
    ),

  /** GET /profile/activity?page&limit → { events, has_more } | ActivityEvent[] */
  getActivity: async (page: number, limit: number) => {
    const data = await request<
      { events: ActivityEvent[]; has_more: boolean } | ActivityEvent[]
    >(
      () => apiClient.get('/profile/activity', { params: { page, limit } }),
      'Failed to load activity',
      () => {
        const start = (page - 1) * limit;
        return {
          events: MOCK_ACTIVITY.slice(start, start + limit),
          has_more: start + limit < MOCK_ACTIVITY.length,
        };
      }
    );
    if (Array.isArray(data))
      return { events: data, has_more: data.length >= limit };
    return {
      events: Array.isArray(data?.events) ? data.events : [],
      has_more: !!data?.has_more,
    };
  },
};

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

const cx = (...a: (string | false | null | undefined)[]) =>
  a.filter(Boolean).join(' ');

const DEFAULT_PREFS: Prefs = {
  email_notifications: true,
  push_notifications: true,
  security_alerts: true,
  weekly_digest: false,
  high_risk_alerts: true,
  case_assignments: true,
  sla_breaches: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  time_format: '24h',
};

function withPrefDefaults(p: Partial<UserPreferences> | undefined): Prefs {
  const out: Prefs = { ...DEFAULT_PREFS };
  if (p && typeof p === 'object') {
    (Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]).forEach((k) => {
      const v = (p as any)[k];
      if (v !== undefined && v !== null) (out as any)[k] = v;
    });
  }
  return out;
}

const getTimezones = (): string[] => {
  try {
    const fn = (Intl as any).supportedValuesOf;
    if (typeof fn === 'function') return fn.call(Intl, 'timeZone');
  } catch {
    /* fall through */
  }
  return [
    'UTC',
    'Asia/Dubai',
    'Europe/London',
    'America/New_York',
    'Asia/Kolkata',
    'Asia/Singapore',
  ];
};

const tzLabel = (tz: string): string => {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    } as Intl.DateTimeFormatOptions).formatToParts(new Date());
    const off = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    return `${tz.replace(/_/g, ' ')} (${off})`;
  } catch {
    return tz;
  }
};

const initialsOf = (
  p: Pick<UserProfileData, 'first_name' | 'last_name' | 'username'>
) =>
  (
    `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}` ||
    p.username?.slice(0, 2) ||
    '?'
  ).toUpperCase();

const toForm = (p: UserProfileData): ProfileForm => ({
  first_name: p.first_name ?? '',
  last_name: p.last_name ?? '',
  email: p.email ?? '',
  phone: p.phone ?? '',
  job_title: p.job_title ?? '',
  timezone: p.timezone ?? 'UTC',
  language: p.language ?? 'en',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeSpaces = (s: string) => s.trim().replace(/\s+/g, ' ');

const validateForm = (f: ProfileForm): FormErrors => {
  const e: FormErrors = {};
  if (!f.first_name.trim()) e.first_name = 'First name is required';
  else if (f.first_name.trim().length > 60) e.first_name = 'Max 60 characters';
  if (!f.last_name.trim()) e.last_name = 'Last name is required';
  else if (f.last_name.trim().length > 60) e.last_name = 'Max 60 characters';
  if (!f.email.trim()) e.email = 'Email is required';
  else if (!EMAIL_RE.test(f.email.trim()) || f.email.length > 254)
    e.email = 'Enter a valid email address';
  const phone = f.phone.trim();
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (
      !/^\+?[0-9\s\-().]+$/.test(phone) ||
      digits.length < 7 ||
      digits.length > 15
    )
      e.phone = 'Enter a valid phone number (7–15 digits)';
  }
  if (f.job_title.length > 100) e.job_title = 'Max 100 characters';
  return e;
};

const COMMON_PASSWORDS = [
  'password',
  'passw0rd',
  'qwerty',
  'letmein',
  'welcome',
  'admin',
  '123456',
  'iloveyou',
  'changeme',
  'abc123',
];

interface PwRule {
  id: string;
  label: string;
  test: (v: string) => boolean;
}

const buildPasswordRules = (
  p: Pick<UserProfileData, 'username' | 'email' | 'first_name' | 'last_name'>
): PwRule[] => {
  const idTokens = [
    p.username,
    p.email?.split('@')[0],
    p.first_name,
    p.last_name,
  ]
    .map((s) => (s ?? '').toLowerCase())
    .filter((s) => s.length >= 3);
  return [
    {
      id: 'len',
      label: `At least ${PASSWORD_POLICY.minLength} characters`,
      test: (v) => v.length >= PASSWORD_POLICY.minLength,
    },
    { id: 'upper', label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
    { id: 'lower', label: 'Lowercase letter', test: (v) => /[a-z]/.test(v) },
    { id: 'num', label: 'Number', test: (v) => /[0-9]/.test(v) },
    {
      id: 'sym',
      label: 'Special character',
      test: (v) => /[^A-Za-z0-9]/.test(v),
    },
    {
      id: 'id',
      label: 'No name, username or email',
      test: (v) => {
        const l = v.toLowerCase();
        return idTokens.every((t) => !l.includes(t));
      },
    },
    {
      id: 'common',
      label: 'Not a common password',
      test: (v) => {
        const l = v.toLowerCase();
        return (
          !COMMON_PASSWORDS.some((c) => l.includes(c)) &&
          !/(.)\1{3,}/.test(v) &&
          v.length <= PASSWORD_POLICY.maxLength
        );
      },
    },
  ];
};

/* ---------- Timezone/locale-aware formatting ---------- */

interface Fmt {
  date: (iso?: string | null) => string;
  dateTime: (iso?: string | null) => string;
  relative: (iso?: string | null) => string;
}

const parseDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const makeFmt = (timeZone: string, locale: string, hour12?: boolean): Fmt => {
  const mk = (opts: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, { ...opts, timeZone });
    } catch {
      return new Intl.DateTimeFormat(undefined, opts);
    }
  };
  const dateFmt = mk({ dateStyle: 'medium' });
  const dtFmt = mk({
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(hour12 !== undefined ? { hour12 } : {}),
  });
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
  return {
    date: (iso) => {
      const d = parseDate(iso);
      return d ? dateFmt.format(d) : '—';
    },
    dateTime: (iso) => {
      const d = parseDate(iso);
      return d ? dtFmt.format(d) : '—';
    },
    relative: (iso) => {
      const d = parseDate(iso);
      if (!d) return '—';
      const sec = Math.round((d.getTime() - Date.now()) / 1000);
      const abs = Math.abs(sec);
      if (abs < 45) return rtf.format(0, 'second');
      if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
      if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), 'day');
      return dateFmt.format(d);
    },
  };
};

const FmtCtx = createContext<Fmt>(makeFmt('UTC', 'en'));
const useFmt = () => useContext(FmtCtx);

/* ---------- Avatar processing: verify real type, square-crop, resize, compress ---------- */

const sniffImageType = async (file: Blob): Promise<string | null> => {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return 'image/png';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return 'image/webp';
  return null;
};

const processAvatar = async (file: File): Promise<File> => {
  if (!AVATAR_TYPES.includes(file.type))
    throw new Error('Please choose a JPG, PNG or WEBP image');
  if (file.size > AVATAR_RAW_MAX_BYTES)
    throw new Error('Image must be 8 MB or smaller');
  // MIME types are client-supplied; check the actual file signature too.
  if (!(await sniffImageType(file)))
    throw new Error('That file is not a valid JPG, PNG or WEBP image');
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('That image could not be read');
  }
  try {
    const side = Math.min(bmp.width, bmp.height);
    if (side < AVATAR_MIN_SIDE)
      throw new Error(
        `Image must be at least ${AVATAR_MIN_SIDE}×${AVATAR_MIN_SIDE} px`
      );
    const out = Math.min(side, AVATAR_OUTPUT_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not supported here');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(
      bmp,
      (bmp.width - side) / 2,
      (bmp.height - side) / 2,
      side,
      side,
      0,
      0,
      out,
      out
    );
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, 'image/jpeg', 0.9)
    );
    if (!blob) throw new Error('Image processing failed');
    if (blob.size > AVATAR_MAX_BYTES)
      throw new Error('Image is still larger than 2 MB after compression');
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  } finally {
    bmp.close();
  }
};

const useMounted = () => {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
};

const errMsg = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

/* ================================================================== */
/*  Theme-aware class helper                                           */
/* ================================================================== */

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';
const PILL: Record<Tone, { dark: string; light: string }> = {
  ok: {
    dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  warn: {
    dark: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    light: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  bad: {
    dark: 'bg-red-500/15 text-red-300 border-red-500/30',
    light: 'bg-red-50 text-red-700 border-red-200',
  },
  info: {
    dark: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    light: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  neutral: {
    dark: 'bg-white/10 text-white/70 border-white/15',
    light: 'bg-gray-100 text-gray-700 border-gray-200',
  },
};

const useUi = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    theme,
    dark,
    card: dark
      ? 'bg-white/10 border-white/20'
      : 'bg-white border-gray-200 shadow-card',
    divider: dark ? 'border-white/15' : 'border-gray-200',
    title: dark ? 'text-white' : 'text-gray-900',
    muted: dark ? 'text-white/60' : 'text-gray-600',
    faint: dark ? 'text-white/40' : 'text-gray-400',
    subtle: dark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200',
    input: dark
      ? 'bg-white/5 border-white/15 text-white placeholder-white/30'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400',
    btnNeutral: dark
      ? 'bg-white/5 border-white/15 text-white hover:bg-white/10'
      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100',
    btnPrimary:
      'border-transparent text-white bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-400 hover:to-cyan-500 shadow-md',
    btnDanger: dark
      ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
      : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
    pill: (t: Tone) =>
      `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
        dark ? PILL[t].dark : PILL[t].light
      }`,
    skeleton: dark ? 'bg-white/5' : 'bg-gray-100',
  };
};

const BTN =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

/* ================================================================== */
/*  Building blocks                                                    */
/* ================================================================== */

const Spinner: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;

const Toast: React.FC<{
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}> = ({ message, type, onClose }) => {
  const ui = useUi();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`fixed bottom-6 end-6 z-[70] flex items-center gap-2 ps-3 pe-2 py-2.5 rounded-xl border shadow-2xl backdrop-blur-xl ${
        ui.dark
          ? 'bg-slate-900/90 border-white/10 text-white'
          : 'bg-white border-gray-200 text-gray-900'
      }`}
    >
      <div
        className={`p-1 rounded-full ${type === 'success' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}
      >
        {type === 'success' ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-400" />
        )}
      </div>
      <span className="text-sm font-medium max-w-xs">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className={`p-1 rounded-md ${ui.faint} hover:opacity-80`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};

const SectionCard: React.FC<{
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, action, children }) => {
  const ui = useUi();
  return (
    <section
      className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${ui.card}`}
    >
      <div
        className={`flex items-center justify-between gap-3 px-5 py-3 border-b ${ui.divider}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div
              className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow text-white shrink-0"
              aria-hidden="true"
            >
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className={`text-base font-bold leading-tight ${ui.title}`}>
              {title}
            </h3>
            {description && (
              <p className={`text-xs mt-0.5 ${ui.muted}`}>{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
};

interface FieldCtl {
  cls: string;
  props: {
    id: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  };
}

const Field: React.FC<{
  label: string;
  icon?: React.ReactNode;
  error?: string;
  readOnly?: boolean;
  required?: boolean;
  hint?: string;
  children: (c: FieldCtl) => React.ReactNode;
}> = ({ label, icon, error, readOnly, required, hint, children }) => {
  const ui = useUi();
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const cls = cx(
    'w-full pe-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2',
    icon ? 'ps-9' : 'ps-3',
    error ? 'border-red-400 focus:ring-red-400' : 'focus:ring-blue-400',
    ui.input,
    readOnly && 'opacity-70 cursor-not-allowed'
  );
  return (
    <div>
      <label
        htmlFor={id}
        className={`block text-[11px] font-semibold uppercase tracking-wide mb-1 ${ui.muted}`}
      >
        {label}
        {required && (
          <span className="text-red-400 ms-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        {icon && (
          <span
            className={`absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none ${ui.faint}`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        {children({
          cls,
          props: {
            id,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': describedBy,
          },
        })}
      </div>
      {error ? (
        <p
          id={`${id}-err`}
          className="mt-1 text-xs font-medium text-red-400 flex items-center gap-1"
        >
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className={`mt-1 text-xs ${ui.faint}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
};

const Switch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}> = ({ checked, onChange, disabled, label }) => {
  const ui = useUi();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cx(
        'relative w-12 h-6 shrink-0 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
        checked
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
          : ui.dark
            ? 'bg-white/15'
            : 'bg-gray-300'
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 start-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200',
          checked ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0'
        )}
      />
    </button>
  );
};

const Avatar: React.FC<{
  profile: Pick<
    UserProfileData,
    'first_name' | 'last_name' | 'username' | 'avatar_url'
  >;
  previewUrl?: string | null;
  size?: number;
}> = ({ profile, previewUrl, size = 72 }) => {
  const src = previewUrl || profile.avatar_url;
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-white/30"
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {src && !broken ? (
        <img
          src={src}
          alt={`${profile.first_name} ${profile.last_name}`}
          className="w-full h-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{initialsOf(profile)}</span>
      )}
    </div>
  );
};

/* ---------- Modal / ConfirmDialog (focus trap, Escape, restore focus) ---------- */

const Modal: React.FC<{
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  dismissible?: boolean;
  wide?: boolean;
  footer?: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  children: React.ReactNode;
}> = ({
  title,
  icon,
  onClose,
  dismissible = true,
  wide,
  footer,
  onSubmit,
  children,
}) => {
  const ui = useUi();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const dismissRef = useRef(dismissible);
  closeRef.current = onClose;
  dismissRef.current = dismissible;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
    if (el && !el.contains(document.activeElement)) el.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissRef.current) {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);

  const content = (
    <>
      <div className="px-5 py-4">{children}</div>
      {footer && (
        <div
          className={`flex items-center justify-end gap-2 px-5 py-3 border-t ${ui.divider}`}
        >
          {footer}
        </div>
      )}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <motion.div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className={cx(
          'w-full rounded-2xl border shadow-2xl focus:outline-none max-h-[90vh] overflow-y-auto',
          wide ? 'max-w-lg' : 'max-w-md',
          ui.dark
            ? 'bg-slate-900 border-white/15 text-white'
            : 'bg-white border-gray-200 text-gray-900'
        )}
      >
        <div
          className={`flex items-center justify-between gap-3 px-5 py-3 border-b ${ui.divider}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <h2 id={titleId} className="text-base font-bold truncate">
              {title}
            </h2>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className={`p-1.5 rounded-lg ${ui.faint} hover:opacity-80`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate>
            {content}
          </form>
        ) : (
          content
        )}
      </motion.div>
    </div>
  );
};

const ConfirmDialog: React.FC<{
  title: string;
  message?: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}> = ({
  title,
  message,
  confirmLabel,
  tone = 'primary',
  busy,
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}) => {
  const ui = useUi();
  return (
    <Modal
      title={title}
      onClose={() => !busy && onCancel()}
      dismissible={!busy}
      icon={
        tone === 'danger' ? (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        ) : (
          <Info className="w-4 h-4 text-blue-400" />
        )
      }
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && !confirmDisabled) onConfirm();
      }}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`${BTN} ${ui.btnNeutral}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || confirmDisabled}
            className={`${BTN} ${tone === 'danger' ? ui.btnDanger : ui.btnPrimary}`}
          >
            {busy && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {message && <p className={`text-sm ${ui.muted}`}>{message}</p>}
      {children && <div className={message ? 'mt-4' : ''}>{children}</div>}
    </Modal>
  );
};

const PasswordInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  disabled?: boolean;
  autoFocus?: boolean;
  hint?: string;
}> = ({
  label,
  value,
  onChange,
  error,
  autoComplete,
  disabled,
  autoFocus,
  hint,
}) => {
  const ui = useUi();
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <Field
      label={label}
      icon={<Lock className="w-4 h-4" />}
      error={error}
      hint={caps ? undefined : hint}
    >
      {(f) => (
        <>
          <input
            {...f.props}
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
            onBlur={() => setCaps(false)}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            disabled={disabled}
            maxLength={PASSWORD_POLICY.maxLength}
            className={`${f.cls} pe-10`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className={`absolute end-3 top-1/2 -translate-y-1/2 ${ui.faint} hover:opacity-80`}
          >
            {show ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          {caps && (
            <p className="absolute -bottom-5 start-0 text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Caps Lock is on
            </p>
          )}
        </>
      )}
    </Field>
  );
};

/* ================================================================== */
/*  Header: compact identity strip + avatar upload / remove            */
/* ================================================================== */

const STATUS_TONE: Record<NonNullable<UserProfileData['status']>, Tone> = {
  active: 'ok',
  pending: 'warn',
  locked: 'bad',
  suspended: 'bad',
};

const ProfileHeader: React.FC<{
  profile: UserProfileData;
  onAvatarChanged: (url: string | null) => void;
  notify: Notify;
}> = ({ profile, onAvatarChanged, notify }) => {
  const ui = useUi();
  const mounted = useMounted();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    setProcessing(true);
    try {
      const processed = await processAvatar(f);
      if (mounted.current) setFile(processed);
    } catch (err) {
      notify(errMsg(err, 'That image could not be used'), 'error');
    } finally {
      if (mounted.current) setProcessing(false);
    }
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await profileApi.uploadAvatar(profile.id, file, setProgress);
      if (!mounted.current) return;
      onAvatarChanged(res?.avatar_url ?? null);
      setFile(null);
      notify('Profile photo updated');
    } catch (err) {
      notify(errMsg(err, 'Failed to upload photo'), 'error');
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await profileApi.removeAvatar(profile.id);
      if (!mounted.current) return;
      onAvatarChanged(null);
      setFile(null);
      setConfirmRemove(false);
      notify('Profile photo removed');
    } catch (err) {
      notify(errMsg(err, 'Failed to remove photo'), 'error');
    } finally {
      if (mounted.current) setRemoving(false);
    }
  };

  const status = profile.status ?? 'active';

  return (
    <div className={`rounded-2xl border backdrop-blur-xl ${ui.card}`}>
      <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar profile={profile} previewUrl={preview} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || removing || processing}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -end-1 p-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg hover:scale-105 transition-transform disabled:opacity-60"
            >
              {processing ? (
                <Spinner className="w-3.5 h-3.5" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_TYPES.join(',')}
              className="hidden"
              onChange={pick}
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>

          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center flex-wrap gap-2">
              <h1 className={`text-xl font-bold truncate ${ui.title}`}>
                {profile.first_name} {profile.last_name}
              </h1>
              <span className={ui.pill('info')}>
                <BadgeCheck className="w-3 h-3" /> {profile.role_name}
              </span>
              <span className={ui.pill(STATUS_TONE[status])}>
                {status[0].toUpperCase() + status.slice(1)}
              </span>
              <span
                className={ui.pill(profile.two_factor_enabled ? 'ok' : 'warn')}
              >
                {profile.two_factor_enabled ? (
                  <ShieldCheck className="w-3 h-3" />
                ) : (
                  <ShieldAlert className="w-3 h-3" />
                )}
                2FA {profile.two_factor_enabled ? 'on' : 'off'}
              </span>
            </div>
            <p className={`text-sm mt-0.5 ${ui.muted}`}>
              @{profile.username} · {profile.email}
              {profile.job_title ? ` · ${profile.job_title}` : ''}
            </p>
          </div>

          {!file && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || removing || processing}
                className={`${BTN} ${ui.btnNeutral}`}
              >
                <Camera className="w-4 h-4" /> Change photo
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  disabled={removing}
                  className={`${BTN} ${ui.btnDanger}`}
                  aria-label="Remove photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {file && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div
                className={`mt-4 p-3 rounded-xl border flex flex-wrap items-center gap-3 ${ui.subtle}`}
              >
                <div className="flex-1 min-w-[200px]">
                  <p className={`text-sm font-semibold ${ui.title}`}>
                    New photo ready
                  </p>
                  <p className={`text-xs ${ui.muted}`}>
                    Cropped to a square · {(file.size / 1024).toFixed(0)} KB ·
                    preview shown above
                  </p>
                  {uploading && (
                    <div
                      className={`mt-2 h-1.5 rounded-full overflow-hidden ${ui.dark ? 'bg-white/10' : 'bg-gray-200'}`}
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  disabled={uploading}
                  className={`${BTN} ${ui.btnNeutral}`}
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={upload}
                  disabled={uploading}
                  className={`${BTN} ${ui.btnPrimary}`}
                >
                  {uploading ? <Spinner /> : <Upload className="w-4 h-4" />}
                  {uploading ? `Uploading ${progress}%` : 'Save photo'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmRemove && (
          <ConfirmDialog
            title="Remove profile photo?"
            message="Your initials will be shown instead. You can upload a new photo at any time."
            confirmLabel="Remove photo"
            tone="danger"
            busy={removing}
            onConfirm={remove}
            onCancel={() => setConfirmRemove(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ================================================================== */
/*  Tab: Profile                                                       */
/* ================================================================== */

const DetailRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => {
  const ui = useUi();
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className={`text-xs ${ui.muted}`}>{label}</dt>
      <dd className={`text-sm font-medium text-end ${ui.title}`}>{children}</dd>
    </div>
  );
};

const ProfileTab: React.FC<{
  profile: UserProfileData;
  onSaved: (p: UserProfileData) => void;
  onDirtyChange: (dirty: boolean) => void;
  notify: Notify;
}> = ({ profile, onSaved, onDirtyChange, notify }) => {
  const ui = useUi();
  const fmt = useFmt();
  const mounted = useMounted();
  const timezones = useMemo(getTimezones, []);
  const tzOptions = useMemo(
    () => timezones.map((tz) => ({ tz, label: tzLabel(tz) })),
    [timezones]
  );
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(toForm(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [showAllPerms, setShowAllPerms] = useState(false);

  useEffect(() => {
    if (!editing) setForm(toForm(profile));
  }, [profile, editing]);

  const original = useMemo(() => toForm(profile), [profile]);
  const changes = useMemo(() => {
    const diff: Partial<ProfileForm> = {};
    (Object.keys(form) as EditableField[]).forEach((k) => {
      const next = normalizeSpaces(form[k]);
      if (next !== original[k]) diff[k] = next;
    });
    return diff;
  }, [form, original]);
  const dirty = Object.keys(changes).length > 0;

  // Report unsaved edits to the page so tab switches / reloads can be guarded.
  useEffect(() => {
    onDirtyChange(editing && dirty);
  }, [editing, dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const set = (k: EditableField) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const cancel = () => {
    setForm(original);
    setErrors({});
    setEditing(false);
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!dirty) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const updated = await profileApi.updateProfile(profile.id, changes);
      if (!mounted.current) return;
      const merged: UserProfileData =
        updated && (updated as UserProfileData).id
          ? updated
          : ({ ...profile, ...changes } as UserProfileData);
      if (changes.email && updated?.email_verified === undefined)
        merged.email_verified = false; // assume re-verification until the server says otherwise
      onSaved(merged);
      setEditing(false);
      notify(
        changes.email
          ? 'Profile updated — check your inbox to verify your new email'
          : 'Profile updated'
      );
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        const fe: FormErrors = {};
        (Object.keys(original) as EditableField[]).forEach((k) => {
          if (err.fieldErrors?.[k]) fe[k] = err.fieldErrors[k];
        });
        setErrors(fe);
      }
      notify(errMsg(err, 'Failed to update profile'), 'error');
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const text = (
    k: EditableField,
    label: string,
    icon: React.ReactNode,
    opts: {
      type?: string;
      autoComplete?: string;
      required?: boolean;
      hint?: string;
    } = {}
  ) => (
    <Field
      label={label}
      icon={icon}
      error={errors[k]}
      required={editing && opts.required}
      hint={editing ? opts.hint : undefined}
    >
      {(f) =>
        editing ? (
          <input
            {...f.props}
            type={opts.type ?? 'text'}
            value={form[k]}
            onChange={(e) => set(k)(e.target.value)}
            disabled={saving}
            autoComplete={opts.autoComplete}
            className={f.cls}
          />
        ) : (
          <div className={`${f.cls} select-text truncate`}>
            {(profile[k as keyof UserProfileData] as string) || '—'}
          </div>
        )
      }
    </Field>
  );

  const perms = profile.permissions ?? [];
  const visiblePerms = showAllPerms ? perms : perms.slice(0, 8);

  const days = profile.password_changed_at
    ? Math.floor(
        (Date.now() - new Date(profile.password_changed_at).getTime()) /
          86400000
      )
    : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
      <div className="xl:col-span-2">
        <SectionCard
          title="Personal information"
          description="Visible to administrators and recorded in audit logs"
          icon={<User className="w-4 h-4" />}
          action={
            !editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={`${BTN} ${ui.btnNeutral}`}
              >
                Edit profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={saving}
                  className={`${BTN} ${ui.btnNeutral}`}
                >
                  <RotateCcw className="w-4 h-4" /> Cancel
                </button>
                <button
                  type="submit"
                  form="profile-form"
                  disabled={saving || !dirty}
                  className={`${BTN} ${ui.btnPrimary}`}
                >
                  {saving ? <Spinner /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )
          }
        >
          <form
            id="profile-form"
            onSubmit={save}
            noValidate
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {text('first_name', 'First name', <User className="w-4 h-4" />, {
              autoComplete: 'given-name',
              required: true,
            })}
            {text('last_name', 'Last name', <User className="w-4 h-4" />, {
              autoComplete: 'family-name',
              required: true,
            })}
            {text('email', 'Email', <Mail className="w-4 h-4" />, {
              type: 'email',
              autoComplete: 'email',
              required: true,
              hint: 'Changing your email requires verification of the new address',
            })}
            {text('phone', 'Phone', <Phone className="w-4 h-4" />, {
              type: 'tel',
              autoComplete: 'tel',
            })}
            {text('job_title', 'Job title', <Briefcase className="w-4 h-4" />, {
              autoComplete: 'organization-title',
            })}

            <Field
              label="Department"
              icon={<Building2 className="w-4 h-4" />}
              readOnly
              hint="Managed by your administrator"
            >
              {(f) => (
                <div className={`${f.cls} truncate`}>
                  {profile.department || '—'}
                </div>
              )}
            </Field>

            <Field
              label="Timezone"
              icon={<Globe className="w-4 h-4" />}
              hint={
                editing
                  ? 'Dates across the platform are shown in this timezone'
                  : undefined
              }
            >
              {(f) =>
                editing ? (
                  <select
                    {...f.props}
                    value={form.timezone}
                    onChange={(e) => set('timezone')(e.target.value)}
                    disabled={saving}
                    className={f.cls}
                  >
                    {!timezones.includes(form.timezone) && (
                      <option value={form.timezone}>{form.timezone}</option>
                    )}
                    {tzOptions.map((o) => (
                      <option key={o.tz} value={o.tz}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={f.cls}>
                    {profile.timezone ? tzLabel(profile.timezone) : '—'}
                  </div>
                )
              }
            </Field>

            <Field label="Language" icon={<Languages className="w-4 h-4" />}>
              {(f) =>
                editing ? (
                  <select
                    {...f.props}
                    value={form.language}
                    onChange={(e) => set('language')(e.target.value)}
                    disabled={saving}
                    className={f.cls}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className={f.cls}>
                    {LANGUAGES.find((l) => l.value === profile.language)
                      ?.label ?? profile.language}
                  </div>
                )
              }
            </Field>
          </form>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard
          title="Access & role"
          description="Assigned by your administrator"
          icon={<BadgeCheck className="w-4 h-4" />}
        >
          <dl className={`divide-y ${ui.divider}`}>
            <DetailRow label="Role">{profile.role_name}</DetailRow>
            <DetailRow label="Department">
              {profile.department || '—'}
            </DetailRow>
            {profile.manager_name !== undefined && (
              <DetailRow label="Manager">
                {profile.manager_name || '—'}
              </DetailRow>
            )}
          </dl>
          {perms.length > 0 && (
            <div className="mt-3">
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${ui.muted}`}
              >
                Permissions ({perms.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visiblePerms.map((p) => (
                  <span key={p} className={`${ui.pill('neutral')} font-mono`}>
                    {p}
                  </span>
                ))}
                {perms.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPerms((s) => !s)}
                    className={`${ui.pill('info')} cursor-pointer`}
                  >
                    {showAllPerms ? 'Show less' : `+${perms.length - 8} more`}
                  </button>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Account"
          icon={<CalendarDays className="w-4 h-4" />}
        >
          <dl className={`divide-y ${ui.divider}`}>
            <DetailRow label="Username">@{profile.username}</DetailRow>
            <DetailRow label="Member since">
              {fmt.date(profile.created_at)}
            </DetailRow>
            <DetailRow label="Last sign-in">
              <span title={fmt.dateTime(profile.last_login)}>
                {fmt.relative(profile.last_login)}
              </span>
            </DetailRow>
            <DetailRow label="Password changed">
              {profile.password_changed_at
                ? `${fmt.date(profile.password_changed_at)}${days !== null ? ` (${days}d ago)` : ''}`
                : '—'}
            </DetailRow>
            <DetailRow label="Email">
              {profile.email_verified === false ? (
                <span className={ui.pill('warn')}>Unverified</span>
              ) : (
                <span className={ui.pill('ok')}>
                  <Check className="w-3 h-3" /> Verified
                </span>
              )}
            </DetailRow>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Tab: Security                                                      */
/* ================================================================== */

const SecurityHealth: React.FC<{ profile: UserProfileData }> = ({
  profile,
}) => {
  const ui = useUi();
  const days = profile.password_changed_at
    ? Math.floor(
        (Date.now() - new Date(profile.password_changed_at).getTime()) /
          86400000
      )
    : null;
  const items = [
    {
      ok: profile.two_factor_enabled,
      label: 'Two-factor authentication',
      detail: profile.two_factor_enabled ? 'Enabled' : 'Not enabled',
    },
    {
      ok: days !== null && days <= PASSWORD_POLICY.maxAgeDays,
      label: 'Password age',
      detail:
        days === null
          ? 'Unknown'
          : `${days} days old · rotate every ${PASSWORD_POLICY.maxAgeDays}`,
    },
    {
      ok: profile.email_verified !== false,
      label: 'Verified email',
      detail:
        profile.email_verified === false ? 'Pending verification' : 'Verified',
    },
  ];
  const score = items.filter((i) => i.ok).length;
  const tone: Tone =
    score === items.length ? 'ok' : score === 0 ? 'bad' : 'warn';
  return (
    <SectionCard
      title="Account security health"
      description={`${score} of ${items.length} checks passed`}
      icon={<ShieldCheck className="w-4 h-4" />}
      action={
        <span className={ui.pill(tone)}>
          {tone === 'ok' ? 'Healthy' : 'Needs attention'}
        </span>
      }
    >
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((i) => (
          <li
            key={i.label}
            className={`flex items-start gap-2.5 p-3 rounded-xl border ${ui.subtle}`}
          >
            <span
              className={`mt-0.5 p-1 rounded-full ${i.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}
            >
              {i.ok ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${ui.title}`}>{i.label}</p>
              <p className={`text-xs ${ui.muted}`}>{i.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
};

const TwoFactorEnrollModal: React.FC<{
  profileId: string;
  onEnabled: () => void;
  onClose: () => void;
}> = ({ profileId, onEnabled, onClose }) => {
  const ui = useUi();
  const mounted = useMounted();
  const [step, setStep] = useState<'loading' | 'scan' | 'codes' | 'error'>(
    'loading'
  );
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const begin = useCallback(async () => {
    setStep('loading');
    setErr(null);
    try {
      const s = await profileApi.twoFactorSetup(profileId);
      if (!mounted.current) return;
      setSetup(s);
      setStep('scan');
    } catch (e) {
      if (!mounted.current) return;
      setErr(errMsg(e, 'Failed to start two-factor setup'));
      setStep('error');
    }
  }, [profileId, mounted]);

  useEffect(() => {
    begin();
  }, [begin]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setErr(null);
    try {
      const res = await profileApi.twoFactorVerify(profileId, code);
      if (!mounted.current) return;
      setCodes(res?.recovery_codes ?? []);
      setStep('codes');
      onEnabled(); // 2FA is now active server-side
    } catch (e2) {
      if (!mounted.current) return;
      setErr(errMsg(e2, 'Verification failed'));
      setCode('');
    } finally {
      if (mounted.current) setVerifying(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard unavailable */
    }
  };

  const download = () => {
    const blob = new Blob(
      [
        `Recovery codes — keep these somewhere safe. Each can be used once.\n\n${codes.join('\n')}\n`,
      ],
      { type: 'text/plain' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const groupedSecret = setup?.secret.replace(/(.{4})/g, '$1 ').trim() ?? '';

  return (
    <Modal
      title="Set up two-factor authentication"
      icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
      wide
      dismissible={step !== 'codes' || saved}
      onClose={onClose}
      onSubmit={step === 'scan' ? verify : undefined}
      footer={
        step === 'scan' ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className={`${BTN} ${ui.btnNeutral}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={code.length !== 6 || verifying}
              className={`${BTN} ${ui.btnPrimary}`}
            >
              {verifying ? <Spinner /> : <Check className="w-4 h-4" />}
              Verify & enable
            </button>
          </>
        ) : step === 'codes' ? (
          <button
            type="button"
            onClick={onClose}
            disabled={!saved}
            className={`${BTN} ${ui.btnPrimary}`}
          >
            Done
          </button>
        ) : step === 'error' ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className={`${BTN} ${ui.btnNeutral}`}
            >
              Close
            </button>
            <button
              type="button"
              onClick={begin}
              className={`${BTN} ${ui.btnPrimary}`}
            >
              <RefreshCw className="w-4 h-4" /> Try again
            </button>
          </>
        ) : undefined
      }
    >
      {step === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-10">
          <Spinner className="w-5 h-5" />
          <span className={`text-sm ${ui.muted}`}>
            Preparing your secure key…
          </span>
        </div>
      )}

      {step === 'error' && (
        <p className="text-sm text-red-400 py-4" role="alert">
          {err}
        </p>
      )}

      {step === 'scan' && setup && (
        <div className="space-y-4">
          <ol className={`text-sm space-y-1 list-decimal ps-5 ${ui.muted}`}>
            <li>
              Open an authenticator app (Microsoft Authenticator, Google
              Authenticator, etc.).
            </li>
            <li>Scan the QR code, or enter the key manually.</li>
            <li>Enter the 6-digit code the app shows to confirm.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            {setup.qr_code_data_url && (
              <img
                src={setup.qr_code_data_url}
                alt="QR code for your authenticator app"
                className="w-36 h-36 rounded-xl bg-white p-2"
              />
            )}
            <div className="flex-1 min-w-[200px]">
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${ui.muted}`}
              >
                Manual entry key
              </p>
              <div
                className={`flex items-center gap-2 p-2.5 rounded-xl border ${ui.subtle}`}
              >
                <code
                  className={`text-sm font-mono tracking-wider break-all flex-1 ${ui.title}`}
                >
                  {groupedSecret}
                </code>
                <button
                  type="button"
                  onClick={() => copy(setup.secret)}
                  aria-label="Copy key"
                  className={`p-1.5 rounded-lg ${ui.faint} hover:opacity-80`}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <Field
            label="Verification code"
            icon={<KeyRound className="w-4 h-4" />}
            error={err ?? undefined}
          >
            {(f) => (
              <input
                {...f.props}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (err) setErr(null);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                autoFocus
                className={`${f.cls} font-mono tracking-[0.4em]`}
              />
            )}
          </Field>
        </div>
      )}

      {step === 'codes' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 text-sm text-emerald-400">
            <Check className="w-4 h-4 mt-0.5" /> Two-factor authentication is
            now enabled.
          </div>
          <div>
            <p className={`text-sm font-semibold ${ui.title}`}>
              Save your recovery codes
            </p>
            <p className={`text-xs ${ui.muted}`}>
              If you lose your device, each code lets you sign in once. They
              will not be shown again.
            </p>
          </div>
          <ul
            className={`grid grid-cols-2 gap-2 p-3 rounded-xl border font-mono text-sm ${ui.subtle} ${ui.title}`}
          >
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => copy(codes.join('\n'))}
              className={`${BTN} ${ui.btnNeutral}`}
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              type="button"
              onClick={download}
              className={`${BTN} ${ui.btnNeutral}`}
            >
              <Download className="w-4 h-4" /> Download
            </button>
          </div>
          <label
            className={`flex items-center gap-2 text-sm cursor-pointer ${ui.title}`}
          >
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            I have saved these recovery codes somewhere safe
          </label>
        </div>
      )}
    </Modal>
  );
};

const SecurityTab: React.FC<{
  profile: UserProfileData;
  onProfileChange: (p: UserProfileData) => void;
  notify: Notify;
}> = ({ profile, onProfileChange, notify }) => {
  const ui = useUi();
  const mounted = useMounted();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const [justChanged, setJustChanged] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disablePw, setDisablePw] = useState('');
  const [disableErr, setDisableErr] = useState<string | undefined>();
  const [disableBusy, setDisableBusy] = useState(false);

  const rules = useMemo(() => buildPasswordRules(profile), [profile]);
  const passed = rules.filter((r) => r.test(next)).length;
  const ratio = passed / rules.length;
  const strength = !next
    ? -1
    : ratio < 0.6
      ? 0
      : ratio < 0.85
        ? 1
        : ratio < 1
          ? 2
          : 3;
  const strengthMeta = [
    { label: 'Weak', bar: 'bg-red-500' },
    { label: 'Fair', bar: 'bg-amber-500' },
    { label: 'Good', bar: 'bg-sky-500' },
    { label: 'Strong', bar: 'bg-emerald-500' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs: typeof errors = {};
    if (!current) errs.current = 'Enter your current password';
    if (passed < rules.length)
      errs.next = 'Password does not meet all requirements';
    else if (next === current)
      errs.next = 'New password must be different from the current one';
    if (confirm !== next) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await profileApi.changePassword(profile.id, current, next, confirm);
      if (!mounted.current) return;
      setCurrent('');
      setNext('');
      setConfirm('');
      setJustChanged(true);
      onProfileChange({
        ...profile,
        password_changed_at: new Date().toISOString(),
      });
      notify('Password changed successfully');
    } catch (err) {
      const msg = errMsg(err, 'Failed to change password');
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        if (
          fe &&
          (fe.current_password || fe.new_password || fe.confirm_password)
        ) {
          setErrors({
            current: fe.current_password,
            next: fe.new_password,
            confirm: fe.confirm_password,
          });
        } else if (err.status === 401 || err.status === 403) {
          setErrors({ current: msg });
        } else if (err.status === 400 || err.status === 422) {
          setErrors({ next: msg });
        }
      }
      notify(msg, 'error');
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const signOutOthers = async () => {
    setSigningOut(true);
    try {
      await profileApi.revokeOtherSessions(profile.id);
      if (!mounted.current) return;
      setJustChanged(false);
      notify('Signed out of all other sessions');
    } catch (err) {
      notify(errMsg(err, 'Failed to sign out other sessions'), 'error');
    } finally {
      if (mounted.current) setSigningOut(false);
    }
  };

  const disable2fa = async () => {
    if (!disablePw) {
      setDisableErr('Enter your password to continue');
      return;
    }
    setDisableBusy(true);
    setDisableErr(undefined);
    try {
      await profileApi.twoFactorDisable(profile.id, disablePw);
      if (!mounted.current) return;
      onProfileChange({ ...profile, two_factor_enabled: false });
      setDisabling(false);
      setDisablePw('');
      notify('Two-factor authentication disabled');
    } catch (err) {
      setDisableErr(errMsg(err, 'Failed to disable two-factor authentication'));
    } finally {
      if (mounted.current) setDisableBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <SecurityHealth profile={profile} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        <div className="xl:col-span-2">
          <SectionCard
            title="Change password"
            description={`Policy: ${PASSWORD_POLICY.minLength}+ characters, rotated every ${PASSWORD_POLICY.maxAgeDays} days`}
            icon={<Lock className="w-4 h-4" />}
          >
            <AnimatePresence initial={false}>
              {justChanged && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className={`mb-4 p-3 rounded-xl border flex flex-wrap items-center gap-3 ${ui.dark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}
                  >
                    <div className="flex-1 min-w-[200px]">
                      <p className={`text-sm font-semibold ${ui.title}`}>
                        Password updated
                      </p>
                      <p className={`text-xs ${ui.muted}`}>
                        Sign out your other devices to make sure only you are
                        signed in.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={signOutOthers}
                      disabled={signingOut}
                      className={`${BTN} ${ui.btnNeutral}`}
                    >
                      {signingOut ? (
                        <Spinner />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      Sign out other devices
                    </button>
                    <button
                      type="button"
                      onClick={() => setJustChanged(false)}
                      aria-label="Dismiss"
                      className={`p-1.5 rounded-lg ${ui.faint}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form
              onSubmit={submit}
              className="grid grid-cols-1 lg:grid-cols-2 gap-5"
              noValidate
            >
              {/* hidden username improves password-manager behaviour */}
              <input
                type="text"
                name="username"
                value={profile.username}
                autoComplete="username"
                readOnly
                hidden
              />
              <div className="space-y-4">
                <PasswordInput
                  label="Current password"
                  value={current}
                  onChange={setCurrent}
                  error={errors.current}
                  autoComplete="current-password"
                  disabled={saving}
                />
                <PasswordInput
                  label="New password"
                  value={next}
                  onChange={setNext}
                  error={errors.next}
                  autoComplete="new-password"
                  disabled={saving}
                />
                <PasswordInput
                  label="Confirm new password"
                  value={confirm}
                  onChange={setConfirm}
                  error={errors.confirm}
                  autoComplete="new-password"
                  disabled={saving}
                />
                <button
                  type="submit"
                  disabled={saving || !current || !next || !confirm}
                  className={`${BTN} ${ui.btnPrimary}`}
                >
                  {saving ? <Spinner /> : <ShieldCheck className="w-4 h-4" />}
                  {saving ? 'Updating…' : 'Update password'}
                </button>
              </div>

              <div
                className={`p-4 rounded-xl border self-start ${ui.subtle}`}
                aria-live="polite"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide ${ui.muted}`}
                  >
                    Strength
                  </span>
                  <span className={`text-xs font-bold ${ui.title}`}>
                    {strength >= 0 ? strengthMeta[strength].label : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {strengthMeta.map((m, i) => (
                    <div
                      key={m.label}
                      className={cx(
                        'h-1.5 rounded-full transition-colors',
                        i <= strength
                          ? m.bar
                          : ui.dark
                            ? 'bg-white/10'
                            : 'bg-gray-200'
                      )}
                    />
                  ))}
                </div>
                <ul className="space-y-1.5">
                  {rules.map((r) => {
                    const ok = r.test(next);
                    return (
                      <li
                        key={r.id}
                        className={`flex items-center gap-2 text-xs ${ok ? 'text-emerald-500' : ui.muted}`}
                      >
                        {ok ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <X className={`w-3.5 h-3.5 ${ui.faint}`} />
                        )}
                        {r.label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </form>
          </SectionCard>
        </div>

        <SectionCard
          title="Two-factor authentication"
          description="Authenticator app (TOTP)"
          icon={<KeyRound className="w-4 h-4" />}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              className={ui.pill(profile.two_factor_enabled ? 'ok' : 'warn')}
            >
              {profile.two_factor_enabled ? 'Enabled' : 'Not enabled'}
            </span>
          </div>
          <p className={`text-sm mb-4 ${ui.muted}`}>
            {profile.two_factor_enabled
              ? 'A verification code from your authenticator app is required at every sign-in.'
              : 'Strongly recommended for accounts that can view or act on financial-crime data.'}
          </p>
          {profile.two_factor_enabled ? (
            <button
              type="button"
              onClick={() => {
                setDisablePw('');
                setDisableErr(undefined);
                setDisabling(true);
              }}
              className={`${BTN} ${ui.btnDanger}`}
            >
              <ShieldAlert className="w-4 h-4" /> Disable 2FA
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEnrolling(true)}
              className={`${BTN} ${ui.btnPrimary}`}
            >
              <ShieldCheck className="w-4 h-4" /> Enable 2FA
            </button>
          )}
        </SectionCard>
      </div>

      <AnimatePresence>
        {enrolling && (
          <TwoFactorEnrollModal
            profileId={profile.id}
            onEnabled={() =>
              onProfileChange({ ...profile, two_factor_enabled: true })
            }
            onClose={() => setEnrolling(false)}
          />
        )}
        {disabling && (
          <ConfirmDialog
            title="Disable two-factor authentication?"
            message="Your account will be protected by your password alone. Confirm your password to continue."
            confirmLabel="Disable 2FA"
            tone="danger"
            busy={disableBusy}
            confirmDisabled={!disablePw}
            onConfirm={disable2fa}
            onCancel={() => setDisabling(false)}
          >
            <PasswordInput
              label="Password"
              value={disablePw}
              onChange={(v) => {
                setDisablePw(v);
                setDisableErr(undefined);
              }}
              error={disableErr}
              autoComplete="current-password"
              disabled={disableBusy}
              autoFocus
            />
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ================================================================== */
/*  Tab: Sessions                                                      */
/* ================================================================== */

const SessionsTab: React.FC<{
  profile: UserProfileData;
  notify: Notify;
}> = ({ profile, notify }) => {
  const ui = useUi();
  const fmt = useFmt();
  const mounted = useMounted();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await profileApi.getSessions();
      if (mounted.current) setSessions(data);
    } catch (err) {
      if (mounted.current) setError(errMsg(err, 'Failed to load sessions'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusyIds((p) => [...p, id]);
    try {
      await profileApi.revokeSession(profile.id, id);
      if (!mounted.current) return;
      setSessions((p) => p.filter((s) => s.session_id !== id));
      notify('Session signed out');
    } catch (err) {
      notify(errMsg(err, 'Failed to sign out session'), 'error');
    } finally {
      if (mounted.current) setBusyIds((p) => p.filter((x) => x !== id));
    }
  };

  const revokeOthers = async () => {
    setRevokingAll(true);
    try {
      await profileApi.revokeOtherSessions(profile.id);
      if (!mounted.current) return;
      setSessions((p) => p.filter((s) => s.is_current));
      setConfirmAll(false);
      notify('Signed out of all other sessions');
    } catch (err) {
      notify(errMsg(err, 'Failed to sign out other sessions'), 'error');
    } finally {
      if (mounted.current) setRevokingAll(false);
    }
  };

  const ordered = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          Number(b.is_current) - Number(a.is_current) ||
          new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
      ),
    [sessions]
  );
  const others = sessions.filter((s) => !s.is_current).length;
  const flagged = sessions.filter(
    (s) => s.is_new_location && !s.is_current
  ).length;

  return (
    <SectionCard
      title="Active sessions"
      description={
        loading
          ? 'Loading…'
          : `${sessions.length} signed-in device${sessions.length === 1 ? '' : 's'}`
      }
      icon={<Monitor className="w-4 h-4" />}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh sessions"
            className={`${BTN} ${ui.btnNeutral} !px-2.5`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {others > 0 && (
            <button
              type="button"
              onClick={() => setConfirmAll(true)}
              disabled={revokingAll}
              className={`${BTN} ${ui.btnDanger}`}
            >
              <LogOut className="w-4 h-4" /> Sign out all others
            </button>
          )}
        </div>
      }
    >
      {flagged > 0 && (
        <div
          className={`mb-4 p-3 rounded-xl border flex items-start gap-2.5 ${ui.dark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}
          role="alert"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
          <p className={`text-sm ${ui.title}`}>
            {flagged} session{flagged === 1 ? ' was' : 's were'} started from a
            new location. If this wasn’t you, sign it out and change your
            password.
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-14 rounded-xl animate-pulse ${ui.skeleton}`}
            />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            type="button"
            onClick={load}
            className={`${BTN} ${ui.btnNeutral}`}
          >
            Try again
          </button>
        </div>
      ) : ordered.length === 0 ? (
        <p className={`text-sm text-center py-8 ${ui.muted}`}>
          No active sessions found.
        </p>
      ) : (
        <ul className="space-y-2">
          {ordered.map((s) => {
            const mobile = /mobile|android|iphone|ipad/i.test(s.device);
            const Icon = mobile ? Smartphone : Monitor;
            return (
              <li
                key={s.session_id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${ui.subtle}`}
              >
                <div
                  className={`p-2 rounded-lg ${ui.dark ? 'bg-white/10' : 'bg-white border border-gray-200'}`}
                >
                  <Icon className={`w-4 h-4 ${ui.muted}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className={`text-sm font-semibold ${ui.title}`}>
                      {s.device} · {s.browser}
                    </span>
                    {s.is_current && (
                      <span className={ui.pill('ok')}>This device</span>
                    )}
                    {s.is_new_location && !s.is_current && (
                      <span className={ui.pill('warn')}>New location</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${ui.muted}`}>
                    <span className="font-mono">{s.ip_address}</span>
                    {s.location ? ` · ${s.location}` : ''} ·{' '}
                    <span title={fmt.dateTime(s.last_active)}>
                      {s.is_current
                        ? 'Active now'
                        : `Active ${fmt.relative(s.last_active)}`}
                    </span>
                  </p>
                </div>
                {!s.is_current && (
                  <button
                    type="button"
                    onClick={() => revoke(s.session_id)}
                    disabled={busyIds.includes(s.session_id)}
                    className={`${BTN} ${ui.btnNeutral} !py-1.5 text-xs`}
                  >
                    {busyIds.includes(s.session_id) ? (
                      <Spinner className="w-3.5 h-3.5" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    Sign out
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {confirmAll && (
          <ConfirmDialog
            title="Sign out all other devices?"
            message={`${others} other session${others === 1 ? '' : 's'} will be ended immediately. This device stays signed in.`}
            confirmLabel="Sign out all"
            tone="danger"
            busy={revokingAll}
            onConfirm={revokeOthers}
            onCancel={() => setConfirmAll(false)}
          />
        )}
      </AnimatePresence>
    </SectionCard>
  );
};

/* ================================================================== */
/*  Tab: Activity (account audit trail)                                */
/* ================================================================== */

const ACTIVITY_META: Record<
  string,
  { label: string; icon: React.ReactNode; security: boolean }
> = {
  login: {
    label: 'Signed in',
    icon: <LogIn className="w-4 h-4" />,
    security: true,
  },
  login_failed: {
    label: 'Failed sign-in attempt',
    icon: <ShieldAlert className="w-4 h-4" />,
    security: true,
  },
  logout: {
    label: 'Signed out',
    icon: <LogOut className="w-4 h-4" />,
    security: true,
  },
  password_changed: {
    label: 'Password changed',
    icon: <Lock className="w-4 h-4" />,
    security: true,
  },
  two_factor_enabled: {
    label: 'Two-factor enabled',
    icon: <ShieldCheck className="w-4 h-4" />,
    security: true,
  },
  two_factor_disabled: {
    label: 'Two-factor disabled',
    icon: <ShieldAlert className="w-4 h-4" />,
    security: true,
  },
  session_revoked: {
    label: 'Session signed out',
    icon: <LogOut className="w-4 h-4" />,
    security: true,
  },
  profile_updated: {
    label: 'Profile updated',
    icon: <User className="w-4 h-4" />,
    security: false,
  },
  avatar_changed: {
    label: 'Profile photo changed',
    icon: <Camera className="w-4 h-4" />,
    security: false,
  },
  preferences_updated: {
    label: 'Preferences updated',
    icon: <Bell className="w-4 h-4" />,
    security: false,
  },
};
const ACTIVITY_PAGE = 10;

const ActivityTab: React.FC<{ goTo: (t: TabId) => void }> = ({ goTo }) => {
  const ui = useUi();
  const fmt = useFmt();
  const mounted = useMounted();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'security' | 'failed'>('all');

  const load = useCallback(
    async (p: number) => {
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await profileApi.getActivity(p, ACTIVITY_PAGE);
        if (!mounted.current) return;
        setEvents((prev) => (p === 1 ? res.events : [...prev, ...res.events]));
        setHasMore(res.has_more);
        setPage(p);
      } catch (err) {
        if (mounted.current) setError(errMsg(err, 'Failed to load activity'));
      } finally {
        if (mounted.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [mounted]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const shown = events.filter((e) => {
    if (filter === 'failed') return !e.success;
    if (filter === 'security') return ACTIVITY_META[e.type]?.security ?? false;
    return true;
  });
  const failed = events.filter((e) => !e.success).length;

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'security', label: 'Security' },
    { id: 'failed', label: `Failed${failed ? ` (${failed})` : ''}` },
  ];

  return (
    <SectionCard
      title="Account activity"
      description="Recent sign-ins and security-relevant changes to your account"
      icon={<History className="w-4 h-4" />}
      action={
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter activity"
            className={`flex p-0.5 rounded-xl border ${ui.subtle}`}
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cx(
                  'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  filter === f.id
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
                    : ui.muted
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(1)}
            disabled={loading}
            aria-label="Refresh activity"
            className={`${BTN} ${ui.btnNeutral} !px-2.5`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      }
    >
      <div
        className={`mb-4 p-3 rounded-xl border flex flex-wrap items-center gap-3 ${ui.subtle}`}
      >
        <Info className={`w-4 h-4 ${ui.muted}`} />
        <p className={`text-sm flex-1 min-w-[220px] ${ui.muted}`}>
          See something you don’t recognise? Change your password and sign out
          other devices.
        </p>
        <button
          type="button"
          onClick={() => goTo('security')}
          className={`${BTN} ${ui.btnNeutral} !py-1.5 text-xs`}
        >
          Security settings
        </button>
        <button
          type="button"
          onClick={() => goTo('sessions')}
          className={`${BTN} ${ui.btnNeutral} !py-1.5 text-xs`}
        >
          Review sessions
        </button>
      </div>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-12 rounded-xl animate-pulse ${ui.skeleton}`}
            />
          ))}
        </div>
      ) : error && events.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-red-400 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => load(1)}
            className={`${BTN} ${ui.btnNeutral}`}
          >
            Try again
          </button>
        </div>
      ) : shown.length === 0 ? (
        <p className={`text-sm text-center py-8 ${ui.muted}`}>
          No matching activity.
        </p>
      ) : (
        <>
          <ul className={`divide-y ${ui.divider}`}>
            {shown.map((e) => {
              const meta = ACTIVITY_META[e.type] ?? {
                label: e.type.replace(/_/g, ' '),
                icon: <Clock className="w-4 h-4" />,
                security: false,
              };
              return (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={cx(
                      'p-2 rounded-lg shrink-0',
                      e.success
                        ? ui.dark
                          ? 'bg-white/10 text-white/70'
                          : 'bg-gray-100 text-gray-600'
                        : 'bg-red-500/15 text-red-400'
                    )}
                  >
                    {meta.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${ui.title}`}>
                      {meta.label}
                      {!e.success && e.type !== 'login_failed' && (
                        <span className={`ms-2 ${ui.pill('bad')}`}>Failed</span>
                      )}
                    </p>
                    <p className={`text-xs truncate ${ui.muted}`}>
                      {[e.detail, e.device, e.ip_address, e.location]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <time
                    dateTime={e.timestamp}
                    title={fmt.dateTime(e.timestamp)}
                    className={`text-xs whitespace-nowrap ${ui.muted}`}
                  >
                    {fmt.relative(e.timestamp)}
                  </time>
                </li>
              );
            })}
          </ul>
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
          {hasMore && (
            <div className="pt-3 text-center">
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={loadingMore}
                className={`${BTN} ${ui.btnNeutral}`}
              >
                {loadingMore && <Spinner />} Load more
              </button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
};

/* ================================================================== */
/*  Tab: Preferences                                                   */
/* ================================================================== */

interface PrefItem {
  key: BoolPrefKey;
  title: string;
  desc: string;
  locked?: boolean;
}

const CHANNEL_ITEMS: PrefItem[] = [
  {
    key: 'email_notifications',
    title: 'Email',
    desc: 'Alert and activity updates by email',
  },
  {
    key: 'push_notifications',
    title: 'In-app',
    desc: 'Notification pop-ups while you use the platform',
  },
];

const EVENT_ITEMS: PrefItem[] = [
  {
    key: 'security_alerts',
    title: 'Security alerts',
    desc: 'New sign-ins, password and 2FA changes',
    locked: true,
  },
  {
    key: 'high_risk_alerts',
    title: 'High-risk fraud alerts',
    desc: 'Alerts scored high or critical that match your queues',
  },
  {
    key: 'case_assignments',
    title: 'Case assignments',
    desc: 'When a case is assigned or reassigned to you',
  },
  {
    key: 'sla_breaches',
    title: 'SLA breach warnings',
    desc: 'Cases or alerts nearing or past their SLA',
  },
  {
    key: 'weekly_digest',
    title: 'Weekly digest',
    desc: 'A weekly summary of rule and alert activity',
  },
];

const PrefRow: React.FC<{
  item: PrefItem;
  checked: boolean;
  busy: boolean;
  onToggle: () => void;
}> = ({ item, checked, busy, onToggle }) => {
  const ui = useUi();
  return (
    <li
      className={`flex items-center justify-between gap-4 p-3 rounded-xl border ${ui.subtle}`}
    >
      <div className="min-w-0">
        <p
          className={`text-sm font-semibold flex items-center gap-2 ${ui.title}`}
        >
          {item.title}
          {item.locked && (
            <span className={ui.pill('neutral')}>
              <Lock className="w-3 h-3" /> Required
            </span>
          )}
        </p>
        <p className={`text-xs ${ui.muted}`}>{item.desc}</p>
      </div>
      <Switch
        checked={item.locked ? true : checked}
        onChange={onToggle}
        disabled={busy || item.locked}
        label={item.title}
      />
    </li>
  );
};

const QuietHours: React.FC<{
  prefs: Prefs;
  busy: boolean;
  onToggle: () => void;
  onCommit: (patch: Partial<UserPreferences>) => void;
}> = ({ prefs, busy, onToggle, onCommit }) => {
  const ui = useUi();
  const [start, setStart] = useState(prefs.quiet_hours_start);
  const [end, setEnd] = useState(prefs.quiet_hours_end);
  useEffect(() => {
    setStart(prefs.quiet_hours_start);
    setEnd(prefs.quiet_hours_end);
  }, [prefs.quiet_hours_start, prefs.quiet_hours_end]);

  const commit = () => {
    const patch: Partial<UserPreferences> = {};
    if (/^\d{2}:\d{2}$/.test(start) && start !== prefs.quiet_hours_start)
      patch.quiet_hours_start = start;
    if (/^\d{2}:\d{2}$/.test(end) && end !== prefs.quiet_hours_end)
      patch.quiet_hours_end = end;
    if (Object.keys(patch).length) onCommit(patch);
  };

  const inputCls = `px-2.5 py-1.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${ui.input}`;
  return (
    <div className={`p-3 rounded-xl border ${ui.subtle}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p
            className={`text-sm font-semibold flex items-center gap-2 ${ui.title}`}
          >
            <Moon className="w-3.5 h-3.5" /> Quiet hours
          </p>
          <p className={`text-xs ${ui.muted}`}>
            Pause non-critical notifications. Security alerts are never
            silenced.
          </p>
        </div>
        <Switch
          checked={prefs.quiet_hours_enabled}
          onChange={onToggle}
          disabled={busy}
          label="Quiet hours"
        />
      </div>
      {prefs.quiet_hours_enabled && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className={`text-xs ${ui.muted}`}>
            From{' '}
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              onBlur={commit}
              className={inputCls}
            />
          </label>
          <label className={`text-xs ${ui.muted}`}>
            To{' '}
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              onBlur={commit}
              className={inputCls}
            />
          </label>
          <span className={`text-xs ${ui.faint}`}>
            in your profile timezone
          </span>
        </div>
      )}
    </div>
  );
};

const PreferencesTab: React.FC<{
  prefs: Prefs | null;
  error: string | null;
  onReload: () => void;
  onUpdate: (patch: Partial<UserPreferences>) => Promise<void>;
  notify: Notify;
}> = ({ prefs, error, onReload, onUpdate, notify }) => {
  const ui = useUi();
  const [busyKeys, setBusyKeys] = useState<string[]>([]);

  const apply = async (patch: Partial<UserPreferences>) => {
    const keys = Object.keys(patch);
    if (keys.some((k) => busyKeys.includes(k))) return;
    setBusyKeys((p) => [...p, ...keys]);
    try {
      await onUpdate(patch);
      notify('Preference saved');
    } catch (err) {
      notify(errMsg(err, 'Failed to save preference'), 'error');
    } finally {
      setBusyKeys((p) => p.filter((k) => !keys.includes(k)));
    }
  };

  const toggle = (key: BoolPrefKey) => {
    if (!prefs) return;
    apply({ [key]: !prefs[key] } as Partial<UserPreferences>);
  };

  if (!prefs && !error) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-28 rounded-2xl animate-pulse ${ui.skeleton}`}
          />
        ))}
      </div>
    );
  }
  if (!prefs) {
    return (
      <div className={`rounded-2xl border p-8 text-center ${ui.card}`}>
        <p className="text-sm text-red-400 mb-3">
          {error ?? 'Unable to load preferences'}
        </p>
        <button
          type="button"
          onClick={onReload}
          className={`${BTN} ${ui.btnNeutral}`}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
        <SectionCard
          title="Delivery channels"
          description="How you receive notifications"
          icon={<Bell className="w-4 h-4" />}
        >
          <ul className="space-y-2">
            {CHANNEL_ITEMS.map((i) => (
              <PrefRow
                key={i.key}
                item={i}
                checked={prefs[i.key]}
                busy={busyKeys.includes(i.key)}
                onToggle={() => toggle(i.key)}
              />
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Display"
          description="How dates and times are shown"
          icon={<Clock className="w-4 h-4" />}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className={`text-sm font-semibold ${ui.title}`}>Time format</p>
              <p className={`text-xs ${ui.muted}`}>
                Applies across the platform
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Time format"
              className={`flex p-0.5 rounded-xl border ${ui.subtle}`}
            >
              {(['12h', '24h'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={prefs.time_format === f}
                  disabled={busyKeys.includes('time_format')}
                  onClick={() =>
                    prefs.time_format !== f && apply({ time_format: f })
                  }
                  className={cx(
                    'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                    prefs.time_format === f
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white'
                      : ui.muted
                  )}
                >
                  {f === '12h' ? '12-hour' : '24-hour'}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="What to notify me about"
        description="Choose the events that reach you"
        icon={<AlertCircle className="w-4 h-4" />}
      >
        <ul className="space-y-2">
          {EVENT_ITEMS.map((i) => (
            <PrefRow
              key={i.key}
              item={i}
              checked={prefs[i.key]}
              busy={busyKeys.includes(i.key)}
              onToggle={() => toggle(i.key)}
            />
          ))}
        </ul>
        <div className="mt-2">
          <QuietHours
            prefs={prefs}
            busy={busyKeys.includes('quiet_hours_enabled')}
            onToggle={() => toggle('quiet_hours_enabled')}
            onCommit={apply}
          />
        </div>
      </SectionCard>
    </div>
  );
};

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
  { id: 'sessions', label: 'Sessions', icon: <Monitor className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <History className="w-4 h-4" /> },
  {
    id: 'preferences',
    label: 'Preferences',
    icon: <Bell className="w-4 h-4" />,
  },
];

const UserProfilePage: React.FC<UserProfilePageProps> = ({
  onProfileUpdated,
}) => {
  const ui = useUi();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('profile');
  const [pendingTab, setPendingTab] = useState<TabId | null>(null);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const dirtyRef = useRef(false);
  const prefsRef = useRef<Prefs | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  prefsRef.current = prefs;

  const notify = useCallback<Notify>((message, type = 'success') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => setToast(null),
      toast.type === 'error' ? 7000 : 3500
    );
    return () => clearTimeout(t);
  }, [toast]);

  const setDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
  }, []);

  // Warn before closing/reloading the tab with unsaved profile edits.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const loadPrefs = useCallback(async () => {
    setPrefsError(null);
    try {
      setPrefs(await profileApi.getPreferences());
    } catch (err) {
      setPrefsError(errMsg(err, 'Failed to load preferences'));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [p, pr] = await Promise.allSettled([
      profileApi.getProfile(),
      profileApi.getPreferences(),
    ]);
    if (p.status === 'fulfilled') setProfile(p.value);
    else setLoadError(errMsg(p.reason, 'Failed to load your profile'));
    if (pr.status === 'fulfilled') {
      setPrefs(pr.value);
      setPrefsError(null);
    } else {
      setPrefsError(errMsg(pr.reason, 'Failed to load preferences'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applyProfile = useCallback(
    (p: UserProfileData) => {
      setProfile(p);
      onProfileUpdated?.(p);
    },
    [onProfileUpdated]
  );

  // Optimistic preference update; rolls back only the keys it changed.
  const updatePrefs = useCallback(
    async (patch: Partial<UserPreferences>) => {
      const before = prefsRef.current;
      if (!profile || !before) return;
      const rollback: Record<string, unknown> = {};
      Object.keys(patch).forEach((k) => {
        rollback[k] = (before as any)[k];
      });
      setPrefs({ ...before, ...patch } as Prefs);
      try {
        await profileApi.updatePreferences(profile.id, patch);
      } catch (err) {
        setPrefs((p) => (p ? ({ ...p, ...rollback } as Prefs) : p));
        throw err;
      }
    },
    [profile]
  );

  const requestTab = useCallback(
    (t: TabId) => {
      if (t === tab) return;
      if (dirtyRef.current) {
        setPendingTab(t);
        return;
      }
      setTab(t);
    },
    [tab]
  );

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = TABS.length - 1;
    else return;
    e.preventDefault();
    requestTab(TABS[n].id);
    tabRefs.current[n]?.focus();
  };

  const fmt = useMemo(
    () =>
      makeFmt(
        profile?.timezone ?? 'UTC',
        profile?.language ?? 'en',
        prefs ? prefs.time_format === '12h' : undefined
      ),
    [profile?.timezone, profile?.language, prefs]
  );

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-[420px] space-y-4"
        role="status"
      >
        <div
          className={`w-10 h-10 rounded-full border-4 border-t-transparent animate-spin ${ui.dark ? 'border-blue-400/60' : 'border-blue-500/60'}`}
        />
        <div className={`font-medium ${ui.title}`}>Loading your profile…</div>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div
        className={`rounded-2xl border p-10 text-center backdrop-blur-xl ${ui.card}`}
        role="alert"
      >
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className={`font-semibold ${ui.title}`}>
          {loadError ?? 'Profile unavailable'}
        </p>
        <p className={`text-sm mt-1 ${ui.muted}`}>
          Your information was not changed. Please try again.
        </p>
        <button
          type="button"
          onClick={load}
          className={`${BTN} ${ui.btnPrimary} mt-4`}
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const rtl = RTL_LANGUAGES.includes(profile.language);

  return (
    <MotionConfig reducedMotion="user">
      <FmtCtx.Provider value={fmt}>
        <motion.div
          dir={rtl ? 'rtl' : 'ltr'}
          lang={profile.language}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {USE_MOCKS && (
            <div
              className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 ${ui.pill('warn')} !rounded-xl w-full`}
              role="note"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Demo mode — sample data is shown when the profile service is
              unreachable.
            </div>
          )}

          <ProfileHeader
            profile={profile}
            notify={notify}
            onAvatarChanged={(url) =>
              applyProfile({ ...profile, avatar_url: url })
            }
          />

          <div
            role="tablist"
            aria-label="Profile sections"
            className={`flex gap-1 p-1 rounded-2xl border backdrop-blur-xl overflow-x-auto ${ui.card}`}
          >
            {TABS.map((t, i) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  id={`tab-${t.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  type="button"
                  onClick={() => requestTab(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={cx(
                    'relative flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                    active
                      ? 'text-white'
                      : `${ui.muted} ${ui.dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="profile-tab-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 shadow-md"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-2">
                    {t.icon}
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {tab === 'profile' && (
                <ProfileTab
                  profile={profile}
                  onSaved={applyProfile}
                  onDirtyChange={setDirty}
                  notify={notify}
                />
              )}
              {tab === 'security' && (
                <SecurityTab
                  profile={profile}
                  onProfileChange={applyProfile}
                  notify={notify}
                />
              )}
              {tab === 'sessions' && (
                <SessionsTab profile={profile} notify={notify} />
              )}
              {tab === 'activity' && <ActivityTab goTo={requestTab} />}
              {tab === 'preferences' && (
                <PreferencesTab
                  prefs={prefs}
                  error={prefsError}
                  onReload={loadPrefs}
                  onUpdate={updatePrefs}
                  notify={notify}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {pendingTab && (
              <ConfirmDialog
                title="Discard unsaved changes?"
                message="You have edits on the Profile tab that haven’t been saved. If you leave now they will be lost."
                confirmLabel="Discard & continue"
                tone="danger"
                onConfirm={() => {
                  dirtyRef.current = false;
                  setTab(pendingTab);
                  setPendingTab(null);
                }}
                onCancel={() => setPendingTab(null)}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {toast && (
              <Toast
                key={toast.id}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(null)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </FmtCtx.Provider>
    </MotionConfig>
  );
};

export default UserProfilePage;
