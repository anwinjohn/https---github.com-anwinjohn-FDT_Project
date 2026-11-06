import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Loader2,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Smartphone,
  Monitor,
  LogOut,
  Bell,
  Clock,
  CalendarDays,
  BadgeCheck,
  RefreshCw,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import apiClient from '../utils/apiClient';

/* ------------------------------------------------------------------ */
/*  Types — merge these into ../types/types.ts                         */
/* ------------------------------------------------------------------ */

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
}

export interface UserSession {
  session_id: string;
  device: string;
  browser: string;
  ip_address: string;
  location?: string;
  last_active: string;
  is_current: boolean;
}

export interface UserPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  security_alerts: boolean;
  weekly_digest: boolean;
}

type EditableField =
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'job_title'
  | 'department'
  | 'timezone'
  | 'language';

type ProfileForm = Record<EditableField, string>;
type FormErrors = Partial<Record<EditableField, string>>;
type TabId = 'profile' | 'security' | 'sessions' | 'preferences';

interface UserProfilePageProps {
  /** Optional: called after any successful profile/avatar change so the app shell can refresh. */
  onProfileUpdated?: (profile: UserProfileData) => void;
}

/* ------------------------------------------------------------------ */
/*  API layer                                                          */
/*  Every request carries the user_id + only what needs to change.     */
/* ------------------------------------------------------------------ */

const unwrap = <T,>(res: any): T => (res?.data?.data ?? res?.data) as T;

const profileApi = {
  /** GET /profile/me */
  getProfile: async () =>
    unwrap<UserProfileData>(await apiClient.get('/profile/me')),

  /** PUT /profile/update { user_id, ...changedFields } */
  updateProfile: async (userId: string, changes: Partial<ProfileForm>) =>
    unwrap<UserProfileData | undefined>(
      await apiClient.put('/profile/update', { user_id: userId, ...changes })
    ),

  /** POST /profile/avatar (multipart: user_id, avatar) */
  uploadAvatar: async (
    userId: string,
    file: File,
    onProgress?: (pct: number) => void
  ) => {
    const form = new FormData();
    form.append('user_id', userId);
    form.append('avatar', file);
    const res = await apiClient.post('/profile/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e: any) => {
        if (e.total && onProgress)
          onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return unwrap<{ avatar_url: string }>(res);
  },

  /** DELETE /profile/avatar { user_id } */
  removeAvatar: async (userId: string) =>
    unwrap<any>(
      await apiClient.delete('/profile/avatar', { data: { user_id: userId } })
    ),

  /** POST /profile/change-password { user_id, current_password, new_password, confirm_password } */
  changePassword: async (
    userId: string,
    current_password: string,
    new_password: string,
    confirm_password: string
  ) =>
    unwrap<any>(
      await apiClient.post('/profile/change-password', {
        user_id: userId,
        current_password,
        new_password,
        confirm_password,
      })
    ),

  /** POST /profile/two-factor { user_id, enabled } */
  setTwoFactor: async (userId: string, enabled: boolean) =>
    unwrap<any>(
      await apiClient.post('/profile/two-factor', { user_id: userId, enabled })
    ),

  /** GET /profile/sessions */
  getSessions: async () =>
    unwrap<UserSession[]>(await apiClient.get('/profile/sessions')),

  /** POST /profile/sessions/revoke { user_id, session_id } */
  revokeSession: async (userId: string, sessionId: string) =>
    unwrap<any>(
      await apiClient.post('/profile/sessions/revoke', {
        user_id: userId,
        session_id: sessionId,
      })
    ),

  /** POST /profile/sessions/revoke-others { user_id } */
  revokeOtherSessions: async (userId: string) =>
    unwrap<any>(
      await apiClient.post('/profile/sessions/revoke-others', {
        user_id: userId,
      })
    ),

  /** GET /profile/preferences */
  getPreferences: async () =>
    unwrap<UserPreferences>(await apiClient.get('/profile/preferences')),

  /** PUT /profile/preferences { user_id, ...changedPreferences } */
  updatePreferences: async (
    userId: string,
    changes: Partial<UserPreferences>
  ) =>
    unwrap<any>(
      await apiClient.put('/profile/preferences', {
        user_id: userId,
        ...changes,
      })
    ),
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
];

const getTimezones = (): string[] => {
  try {
    const fn = (Intl as any).supportedValuesOf;
    if (typeof fn === 'function') return fn('timeZone');
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

const getErrorMessage = (err: any, fallback: string) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  fallback;

const formatDate = (iso?: string | null, withTime = false) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return withTime
    ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
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
  department: p.department ?? '',
  timezone: p.timezone ?? 'UTC',
  language: p.language ?? 'en',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

const validateForm = (f: ProfileForm): FormErrors => {
  const e: FormErrors = {};
  if (!f.first_name.trim()) e.first_name = 'First name is required';
  if (!f.last_name.trim()) e.last_name = 'Last name is required';
  if (!f.email.trim()) e.email = 'Email is required';
  else if (!EMAIL_RE.test(f.email.trim()))
    e.email = 'Enter a valid email address';
  if (f.phone.trim() && !PHONE_RE.test(f.phone.trim()))
    e.phone = 'Enter a valid phone number';
  return e;
};

const PASSWORD_RULES = [
  {
    id: 'len',
    label: 'At least 8 characters',
    test: (v: string) => v.length >= 8,
  },
  {
    id: 'upper',
    label: 'One uppercase letter',
    test: (v: string) => /[A-Z]/.test(v),
  },
  {
    id: 'lower',
    label: 'One lowercase letter',
    test: (v: string) => /[a-z]/.test(v),
  },
  { id: 'num', label: 'One number', test: (v: string) => /[0-9]/.test(v) },
  {
    id: 'sym',
    label: 'One special character',
    test: (v: string) => /[^A-Za-z0-9]/.test(v),
  },
];

/* ------------------------------------------------------------------ */
/*  Theme-aware class helper                                           */
/* ------------------------------------------------------------------ */

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
  };
};

const BTN =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400';

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

const Spinner: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => <Loader2 className={`${className} animate-spin`} />;

const Toast: React.FC<{ message: string; type: 'success' | 'error' }> = ({
  message,
  type,
}) => {
  const ui = useUi();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      role="status"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl ${
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
    </motion.div>
  );
};

const SectionCard: React.FC<{
  title: string;
  description?: string;
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
        className={`flex items-center justify-between gap-4 px-6 py-4 border-b ${ui.divider}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg text-white">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h3 className={`text-lg font-bold ${ui.title}`}>{title}</h3>
            {description && (
              <p className={`text-sm ${ui.muted}`}>{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
};

const Field: React.FC<{
  label: string;
  icon?: React.ReactNode;
  error?: string;
  readOnly?: boolean;
  hint?: string;
  children: (cls: string) => React.ReactNode;
}> = ({ label, icon, error, readOnly, hint, children }) => {
  const ui = useUi();
  const cls = `w-full ${icon ? 'pl-10' : 'pl-3.5'} pr-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-400' : 'focus:ring-blue-400'
  } ${ui.input} ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`;
  return (
    <div>
      <label
        className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${ui.muted}`}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${ui.faint}`}
          >
            {icon}
          </span>
        )}
        {children(cls)}
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      ) : hint ? (
        <p className={`mt-1 text-xs ${ui.faint}`}>{hint}</p>
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
      className={`relative w-12 h-6 shrink-0 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
        checked
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
          : ui.dark
            ? 'bg-white/15'
            : 'bg-gray-300'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
        style={{ left: checked ? 'calc(100% - 22px)' : '2px' }}
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
}> = ({ profile, previewUrl, size = 104 }) => {
  const src = previewUrl || profile.avatar_url;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <div
      className="rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold shadow-xl ring-4 ring-white/20"
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
        initialsOf(profile)
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Header: avatar upload / remove                                     */
/* ------------------------------------------------------------------ */

const ProfileHeader: React.FC<{
  profile: UserProfileData;
  onAvatarChanged: (url: string | null) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ profile, onAvatarChanged, notify }) => {
  const ui = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    if (!AVATAR_TYPES.includes(f.type)) {
      notify('Please choose a JPG, PNG or WEBP image', 'error');
      return;
    }
    if (f.size > AVATAR_MAX_BYTES) {
      notify('Image must be 2 MB or smaller', 'error');
      return;
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const res = await profileApi.uploadAvatar(profile.id, file, setProgress);
      onAvatarChanged(res?.avatar_url ?? null);
      setFile(null);
      notify('Profile photo updated');
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to upload photo'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      await profileApi.removeAvatar(profile.id);
      onAvatarChanged(null);
      setFile(null);
      notify('Profile photo removed');
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to remove photo'), 'error');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border backdrop-blur-xl overflow-hidden ${ui.card}`}
    >
      <div className="h-24 bg-gradient-to-r from-blue-500/80 via-cyan-500/70 to-teal-500/70" />
      <div className="px-6 pb-6 -mt-12">
        <div className="flex flex-col sm:flex-row sm:items-end gap-5">
          <div className="relative">
            <Avatar profile={profile} previewUrl={preview} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || removing}
              aria-label="Change profile photo"
              className="absolute bottom-0 right-0 p-2.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 text-white shadow-lg hover:scale-105 transition-transform disabled:opacity-60"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={AVATAR_TYPES.join(',')}
              className="hidden"
              onChange={pick}
            />
          </div>

          <div className="flex-1 min-w-0 sm:pb-1">
            <div className="flex items-center flex-wrap gap-2">
              <h2 className={`text-2xl font-bold truncate ${ui.title}`}>
                {profile.first_name} {profile.last_name}
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${
                  ui.dark
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}
              >
                <BadgeCheck className="w-3.5 h-3.5" />
                {profile.role_name}
              </span>
            </div>
            <p className={`text-sm mt-0.5 ${ui.muted}`}>
              @{profile.username} · {profile.email}
            </p>
            <div
              className={`mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs ${ui.faint}`}
            >
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Last login{' '}
                {formatDate(profile.last_login, true)}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Member since{' '}
                {formatDate(profile.created_at)}
              </span>
            </div>
          </div>

          {profile.avatar_url && !file && (
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              className={`${BTN} ${ui.btnDanger} sm:mb-1`}
            >
              {removing ? <Spinner /> : <Trash2 className="w-4 h-4" />}
              Remove photo
            </button>
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
                className={`mt-5 p-4 rounded-xl border flex flex-wrap items-center gap-3 ${ui.subtle}`}
              >
                <div className="flex-1 min-w-[200px]">
                  <p className={`text-sm font-semibold truncate ${ui.title}`}>
                    {file.name}
                  </p>
                  <p className={`text-xs ${ui.muted}`}>
                    {(file.size / 1024).toFixed(0)} KB · previewing new photo
                  </p>
                  {uploading && (
                    <div
                      className={`mt-2 h-1.5 rounded-full overflow-hidden ${ui.dark ? 'bg-white/10' : 'bg-gray-200'}`}
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
        <p className={`mt-3 text-xs ${ui.faint}`}>
          JPG, PNG or WEBP · max 2 MB
        </p>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Tab: Profile details (view / edit)                                 */
/* ------------------------------------------------------------------ */

const ProfileTab: React.FC<{
  profile: UserProfileData;
  onSaved: (p: UserProfileData) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ profile, onSaved, notify }) => {
  const ui = useUi();
  const timezones = useMemo(getTimezones, []);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(toForm(profile));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setForm(toForm(profile));
  }, [profile, editing]);

  const original = useMemo(() => toForm(profile), [profile]);
  const changes = useMemo(() => {
    const diff: Partial<ProfileForm> = {};
    (Object.keys(form) as EditableField[]).forEach((k) => {
      if (form[k].trim() !== original[k]) diff[k] = form[k].trim();
    });
    return diff;
  }, [form, original]);
  const dirty = Object.keys(changes).length > 0;

  const set = (k: EditableField) => (v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const cancel = () => {
    setForm(original);
    setErrors({});
    setEditing(false);
  };

  const save = async () => {
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
      onSaved(
        updated && (updated as any).id
          ? updated
          : ({ ...profile, ...changes } as UserProfileData)
      );
      setEditing(false);
      notify('Profile updated');
    } catch (err: any) {
      // Surface field-level errors from the server when present: { errors: { email: "..." } }
      const serverErrs = err?.response?.data?.errors;
      if (serverErrs && typeof serverErrs === 'object') setErrors(serverErrs);
      notify(getErrorMessage(err, 'Failed to update profile'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const text = (
    k: EditableField,
    label: string,
    icon: React.ReactNode,
    type = 'text'
  ) => (
    <Field label={label} icon={icon} error={errors[k]}>
      {(cls) =>
        editing ? (
          <input
            type={type}
            value={form[k]}
            onChange={(e) => set(k)(e.target.value)}
            disabled={saving}
            className={cls}
          />
        ) : (
          <div className={`${cls} select-text`}>
            {(profile[k as keyof UserProfileData] as string) || '—'}
          </div>
        )
      }
    </Field>
  );

  return (
    <SectionCard
      title="Personal information"
      description="Your details as seen by administrators and in audit logs"
      icon={<User className="w-5 h-5" />}
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
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className={`${BTN} ${ui.btnPrimary}`}
            >
              {saving ? <Spinner /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {text('first_name', 'First name', <User className="w-4 h-4" />)}
        {text('last_name', 'Last name', <User className="w-4 h-4" />)}
        {text('email', 'Email', <Mail className="w-4 h-4" />, 'email')}
        {text('phone', 'Phone', <Phone className="w-4 h-4" />, 'tel')}
        {text('job_title', 'Job title', <Briefcase className="w-4 h-4" />)}
        {text('department', 'Department', <Building2 className="w-4 h-4" />)}

        <Field label="Timezone" icon={<Globe className="w-4 h-4" />}>
          {(cls) =>
            editing ? (
              <select
                value={form.timezone}
                onChange={(e) => set('timezone')(e.target.value)}
                disabled={saving}
                className={cls}
              >
                {!timezones.includes(form.timezone) && (
                  <option value={form.timezone}>{form.timezone}</option>
                )}
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            ) : (
              <div className={cls}>{profile.timezone || '—'}</div>
            )
          }
        </Field>

        <Field label="Language" icon={<Languages className="w-4 h-4" />}>
          {(cls) =>
            editing ? (
              <select
                value={form.language}
                onChange={(e) => set('language')(e.target.value)}
                disabled={saving}
                className={cls}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className={cls}>
                {LANGUAGES.find((l) => l.value === profile.language)?.label ??
                  profile.language}
              </div>
            )
          }
        </Field>

        <Field
          label="Username"
          readOnly
          hint="Usernames can only be changed by an administrator"
        >
          {(cls) => <div className={cls}>{profile.username}</div>}
        </Field>
        <Field label="Role" readOnly hint="Assigned by an administrator">
          {(cls) => <div className={cls}>{profile.role_name}</div>}
        </Field>
      </div>
    </SectionCard>
  );
};

/* ------------------------------------------------------------------ */
/*  Tab: Security (change password + two-factor)                       */
/* ------------------------------------------------------------------ */

const PasswordInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  disabled?: boolean;
}> = ({ label, value, onChange, error, autoComplete, disabled }) => {
  const ui = useUi();
  const [show, setShow] = useState(false);
  return (
    <Field label={label} icon={<Lock className="w-4 h-4" />} error={error}>
      {(cls) => (
        <>
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            disabled={disabled}
            className={`${cls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${ui.faint} hover:opacity-80`}
          >
            {show ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </>
      )}
    </Field>
  );
};

const SecurityTab: React.FC<{
  profile: UserProfileData;
  onProfileChange: (p: UserProfileData) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ profile, onProfileChange, notify }) => {
  const ui = useUi();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  const passed = PASSWORD_RULES.filter((r) => r.test(next)).length;
  const strength = next
    ? passed <= 2
      ? 0
      : passed === 3
        ? 1
        : passed === 4
          ? 2
          : 3
    : -1;
  const strengthMeta = [
    { label: 'Weak', bar: 'bg-red-500' },
    { label: 'Fair', bar: 'bg-amber-500' },
    { label: 'Good', bar: 'bg-sky-500' },
    { label: 'Strong', bar: 'bg-emerald-500' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!current) errs.current = 'Enter your current password';
    if (passed < PASSWORD_RULES.length)
      errs.next = 'Password does not meet all requirements';
    else if (next === current)
      errs.next = 'New password must be different from the current one';
    if (confirm !== next) errs.confirm = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await profileApi.changePassword(profile.id, current, next, confirm);
      setCurrent('');
      setNext('');
      setConfirm('');
      onProfileChange({
        ...profile,
        password_changed_at: new Date().toISOString(),
      });
      notify('Password changed successfully');
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Failed to change password');
      if (err?.response?.status === 400 || err?.response?.status === 401)
        setErrors((p) => ({ ...p, current: msg }));
      notify(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleTwoFactor = async () => {
    const nextVal = !profile.two_factor_enabled;
    setTwoFaBusy(true);
    try {
      await profileApi.setTwoFactor(profile.id, nextVal);
      onProfileChange({ ...profile, two_factor_enabled: nextVal });
      notify(`Two-factor authentication ${nextVal ? 'enabled' : 'disabled'}`);
    } catch (err) {
      notify(
        getErrorMessage(err, 'Failed to update two-factor authentication'),
        'error'
      );
    } finally {
      setTwoFaBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Change password"
        description={`Last changed ${formatDate(profile.password_changed_at)}`}
        icon={<Lock className="w-5 h-5" />}
      >
        <form
          onSubmit={submit}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          noValidate
        >
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
              disabled={saving}
              className={`${BTN} ${ui.btnPrimary}`}
            >
              {saving ? <Spinner /> : <ShieldCheck className="w-4 h-4" />}
              {saving ? 'Updating...' : 'Update password'}
            </button>
          </div>

          <div className={`p-4 rounded-xl border ${ui.subtle}`}>
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${ui.muted}`}
              >
                Strength
              </span>
              <span className={`text-xs font-bold ${ui.title}`}>
                {strength >= 0 ? strengthMeta[strength].label : '—'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {strengthMeta.map((m, i) => (
                <div
                  key={m.label}
                  className={`h-1.5 rounded-full transition-colors ${
                    i <= strength
                      ? m.bar
                      : ui.dark
                        ? 'bg-white/10'
                        : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <ul className="space-y-2">
              {PASSWORD_RULES.map((r) => {
                const ok = r.test(next);
                return (
                  <li
                    key={r.id}
                    className={`flex items-center gap-2 text-sm ${ok ? 'text-emerald-500' : ui.muted}`}
                  >
                    {ok ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className={`w-4 h-4 ${ui.faint}`} />
                    )}
                    {r.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Two-factor authentication"
        description="Add a second verification step when signing in"
        icon={<ShieldCheck className="w-5 h-5" />}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className={`text-sm font-semibold ${ui.title}`}>
              {profile.two_factor_enabled ? 'Enabled' : 'Disabled'}
            </p>
            <p className={`text-sm ${ui.muted}`}>
              {profile.two_factor_enabled
                ? 'Your account requires a verification code at sign-in.'
                : 'Turn this on to better protect your account.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {twoFaBusy && <Spinner />}
            <Switch
              checked={profile.two_factor_enabled}
              onChange={toggleTwoFactor}
              disabled={twoFaBusy}
              label="Toggle two-factor authentication"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Tab: Active sessions                                               */
/* ------------------------------------------------------------------ */

const SessionsTab: React.FC<{
  profile: UserProfileData;
  notify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ profile, notify }) => {
  const ui = useUi();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await profileApi.getSessions());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load sessions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusyIds((p) => [...p, id]);
    try {
      await profileApi.revokeSession(profile.id, id);
      setSessions((p) => p.filter((s) => s.session_id !== id));
      notify('Session signed out');
    } catch (err) {
      notify(getErrorMessage(err, 'Failed to sign out session'), 'error');
    } finally {
      setBusyIds((p) => p.filter((x) => x !== id));
    }
  };

  const revokeOthers = async () => {
    setRevokingAll(true);
    try {
      await profileApi.revokeOtherSessions(profile.id);
      setSessions((p) => p.filter((s) => s.is_current));
      notify('Signed out of all other sessions');
    } catch (err) {
      notify(
        getErrorMessage(err, 'Failed to sign out other sessions'),
        'error'
      );
    } finally {
      setRevokingAll(false);
    }
  };

  const others = sessions.filter((s) => !s.is_current).length;

  return (
    <SectionCard
      title="Active sessions"
      description="Devices currently signed in to your account"
      icon={<Monitor className="w-5 h-5" />}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh sessions"
            className={`${BTN} ${ui.btnNeutral} !px-3`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {others > 0 && (
            <button
              type="button"
              onClick={revokeOthers}
              disabled={revokingAll}
              className={`${BTN} ${ui.btnDanger}`}
            >
              {revokingAll ? <Spinner /> : <LogOut className="w-4 h-4" />}
              Sign out all others
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-16 rounded-xl animate-pulse ${ui.dark ? 'bg-white/5' : 'bg-gray-100'}`}
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
      ) : sessions.length === 0 ? (
        <p className={`text-sm text-center py-8 ${ui.muted}`}>
          No active sessions found.
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const mobile = /mobile|android|iphone|ipad/i.test(s.device);
            const Icon = mobile ? Smartphone : Monitor;
            return (
              <li
                key={s.session_id}
                className={`flex items-center gap-4 p-4 rounded-xl border ${ui.subtle}`}
              >
                <div
                  className={`p-2.5 rounded-lg ${ui.dark ? 'bg-white/10' : 'bg-white border border-gray-200'}`}
                >
                  <Icon className={`w-5 h-5 ${ui.muted}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className={`text-sm font-semibold ${ui.title}`}>
                      {s.device} · {s.browser}
                    </span>
                    {s.is_current && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        This device
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${ui.muted}`}>
                    {s.ip_address}
                    {s.location ? ` · ${s.location}` : ''} · Active{' '}
                    {formatDate(s.last_active, true)}
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
    </SectionCard>
  );
};

/* ------------------------------------------------------------------ */
/*  Tab: Preferences                                                   */
/* ------------------------------------------------------------------ */

const PREF_ITEMS: {
  key: keyof UserPreferences;
  title: string;
  desc: string;
}[] = [
  {
    key: 'email_notifications',
    title: 'Email notifications',
    desc: 'Receive alert and activity updates by email',
  },
  {
    key: 'push_notifications',
    title: 'In-app notifications',
    desc: 'Show notification pop-ups while you use the app',
  },
  {
    key: 'security_alerts',
    title: 'Security alerts',
    desc: 'Get notified of new sign-ins and password changes',
  },
  {
    key: 'weekly_digest',
    title: 'Weekly digest',
    desc: 'A weekly summary of rules and alert activity',
  },
];

const PreferencesTab: React.FC<{
  profile: UserProfileData;
  notify: (msg: string, type?: 'success' | 'error') => void;
}> = ({ profile, notify }) => {
  const ui = useUi();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPrefs(await profileApi.getPreferences());
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load preferences'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic toggle with rollback; sends only the changed preference.
  const toggle = async (key: keyof UserPreferences) => {
    if (!prefs || busyKeys.includes(key)) return;
    const nextVal = !prefs[key];
    setPrefs({ ...prefs, [key]: nextVal });
    setBusyKeys((p) => [...p, key]);
    try {
      await profileApi.updatePreferences(profile.id, { [key]: nextVal });
      notify('Preference saved');
    } catch (err) {
      setPrefs((p) => (p ? { ...p, [key]: !nextVal } : p));
      notify(getErrorMessage(err, 'Failed to save preference'), 'error');
    } finally {
      setBusyKeys((p) => p.filter((k) => k !== key));
    }
  };

  return (
    <SectionCard
      title="Notification preferences"
      description="Choose what you want to hear about"
      icon={<Bell className="w-5 h-5" />}
    >
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-14 rounded-xl animate-pulse ${ui.dark ? 'bg-white/5' : 'bg-gray-100'}`}
            />
          ))}
        </div>
      ) : error || !prefs ? (
        <div className="text-center py-8">
          <p className="text-sm text-red-400 mb-3">
            {error ?? 'Unable to load preferences'}
          </p>
          <button
            type="button"
            onClick={load}
            className={`${BTN} ${ui.btnNeutral}`}
          >
            Try again
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {PREF_ITEMS.map((item) => (
            <li
              key={item.key}
              className={`flex items-center justify-between gap-4 p-4 rounded-xl border ${ui.subtle}`}
            >
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${ui.title}`}>
                  {item.title}
                </p>
                <p className={`text-sm ${ui.muted}`}>{item.desc}</p>
              </div>
              <Switch
                checked={prefs[item.key]}
                onChange={() => toggle(item.key)}
                disabled={busyKeys.includes(item.key)}
                label={item.title}
              />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
  { id: 'security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
  { id: 'sessions', label: 'Sessions', icon: <Monitor className="w-4 h-4" /> },
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('profile');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const notify = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProfile(await profileApi.getProfile());
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load your profile'));
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] space-y-4">
        <div
          className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${ui.dark ? 'border-blue-400/60' : 'border-blue-500/60'}`}
        />
        <div className={`font-medium ${ui.title}`}>Loading your profile...</div>
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div
        className={`rounded-2xl border p-10 text-center backdrop-blur-xl ${ui.card}`}
      >
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className={`font-semibold ${ui.title}`}>
          {loadError ?? 'Profile unavailable'}
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <ProfileHeader
        profile={profile}
        notify={notify}
        onAvatarChanged={(url) => applyProfile({ ...profile, avatar_url: url })}
      />

      {/* Tabs */}
      <div
        role="tablist"
        className={`flex gap-1 p-1.5 rounded-2xl border backdrop-blur-xl overflow-x-auto ${ui.card}`}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'text-white'
                  : `${ui.muted} ${ui.dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`
              }`}
            >
              {active && (
                <motion.span
                  layoutId="profile-tab-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 shadow-md"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === 'profile' && (
            <ProfileTab
              profile={profile}
              onSaved={applyProfile}
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
          {tab === 'preferences' && (
            <PreferencesTab profile={profile} notify={notify} />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </motion.div>
  );
};

export default UserProfilePage;
