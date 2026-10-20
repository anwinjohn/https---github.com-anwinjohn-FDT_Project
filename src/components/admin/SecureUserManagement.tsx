import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserOnboardingData,
  UserOnboardingFilters,
  UserOnboardingPagination,
} from '../../types/userOnboarding';
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileSpreadsheet,
  Pencil,
  Eye,
  MoreVertical,
  Copy,
  Loader2,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import * as XLSX from 'xlsx';
import { useNotifications } from '../notifications';
import apiClient from '../../utils/apiClient';
import { appConfig as config } from '../../config/runtime-config';
import {
  setUserStatus,
  lockUser,
  unlockUser,
  resetUserPassword,
  deleteUser,
  updateUser,
  setSensitiveDataAccess,
} from '../../services/userManagementService';
import {
  UserDetailsDrawer,
  EditUserModal,
  ConfirmUserActionModal,
  ResetPasswordSentModal,
  Avatar,
  Pill,
  ACTION_META,
  getStatus,
  btnCls,
  cx,
  ui,
  useDark,
  type UserActionKind,
  type EventLogLoader,
  type RoleOption,
  type RolesStatus,
  type UserEditPatch,
} from './UserManagementDialogs';
import { useAuth } from '../../context/AuthContext';
import { useLocalMachine } from '../../context/DeviceInfoContext';

interface UserOnboardingProps {
  apiEndpoint?: string;
  fullWidth?: boolean;
}

const apiBaseUrl = config.api.baseUrl;

/* --------------------------------------------------------------- */
/* Helpers                                                          */
/* --------------------------------------------------------------- */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatDate = (dateString: string | null) => {
  if (!dateString) return { date: 'Never', time: '' };
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return {
    date: `${day}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`,
    time: `${hours}:${minutes}`,
  };
};

const stamp = (value: string | null | undefined, fallback: string) => {
  if (!value) return fallback;
  const f = formatDate(value);
  return `${f.date} ${f.time}`;
};

const writeUsersWorkbook = (
  list: UserOnboardingData[],
  sheetName: string,
  filePrefix: string
) => {
  const rows = list.map((user) => ({
    'Full Name': user.full_name,
    Username: user.username,
    Email: user.email_id,
    'Email Verified': user.email_verified ? 'Yes' : 'No',
    Role: user.user_roles,
    'Account Status': user.account_status,
    'Active Status': user.active_flag ? 'Active' : 'Inactive',
    'Account Locked': user.account_locked ? 'Yes' : 'No',
    'MFA Enabled': user.mfa_enabled ? 'Yes' : 'No',
    'Last Login': stamp(user.last_login, 'Never'),
    'Created At': stamp(user.created_at, 'N/A'),
    'Updated At': stamp(user.updated_at, 'N/A'),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [20, 15, 25, 12, 15, 15, 12, 12, 12, 20, 20, 20].map((wch) => ({
    wch,
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(
    wb,
    `${filePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`
  );
};

/**
 * Event logs for one user. Called ONLY when the "Event logs" tab is opened in
 * the drawer (never on row click / drawer open) and paged to keep payloads small.
 *
 * ASSUMPTION – confirm against your backend:
 *   GET /admin/users/{id}/event-logs?page=1&page_size=15
 *   -> { data: [{ id, event_type, description, status, ip_address, created_at }],
 *        has_next? , total_pages? }
 * Field aliases below tolerate common naming variations. If you prefer, move
 * this into services/userManagementService.ts next to the other user calls.
 */
const fetchUserEventLogs: EventLogLoader = async (userId, page, pageSize) => {
  const res = await apiClient.get(
    `/admin/users/${encodeURIComponent(userId)}/event-logs`,
    { params: { page, page_size: pageSize } }
  );
  const body = res.data ?? {};
  const rows: any[] = Array.isArray(body)
    ? body
    : (body.data ?? body.items ?? body.results ?? []);

  const items = rows.map((r, i) => ({
    id: String(r.id ?? r.event_id ?? `${page}-${i}`),
    event_type: String(r.event_type ?? r.action ?? r.event ?? 'event'),
    description: r.description ?? r.message ?? null,
    status: r.status ?? r.result ?? null,
    ip_address: r.ip_address ?? r.ip ?? null,
    created_at: r.created_at ?? r.timestamp ?? r.event_time,
    host_name: r.host_name ?? r.hostname ?? null,
  }));

  const hasMore =
    typeof body.has_next === 'boolean'
      ? body.has_next
      : body.total_pages
        ? page < body.total_pages
        : rows.length === pageSize;

  return { items, hasMore };
};

const ROLES_ENDPOINT = '/api/admin/roles';

const fetchRoles = async (): Promise<RoleOption[]> => {
  const res = await apiClient.get(ROLES_ENDPOINT);
  const body = res.data ?? {};
  const rows: any[] = Array.isArray(body)
    ? body
    : (body.data ?? body.roles ?? body.items ?? body.results ?? []);

  const seen = new Set<string>();
  const out: RoleOption[] = [];
  rows.forEach((r) => {
    const value =
      typeof r === 'string'
        ? r
        : String(r.role_name ?? r.name ?? r.role ?? r.user_roles ?? r.id ?? '');
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({
      value,
      label:
        typeof r === 'string'
          ? r
          : String(r.display_name ?? r.role_name ?? r.name ?? r.role ?? value),
      description:
        typeof r === 'string' ? undefined : (r.description ?? undefined),
    });
  });
  return out;
};

const pageWindow = (page: number, total: number) => {
  const count = Math.min(5, total);
  const pages = Array.from({ length: count }, (_, i) => {
    if (total <= 5 || page <= 3) return i + 1;
    if (page >= total - 2) return total - 4 + i;
    return page - 2 + i;
  });
  return { pages, showLast: total > 5 && page < total - 2 };
};

/* --------------------------------------------------------------- */
/* Popover menu (portal, auto-flips, keyboard friendly)             */
/* --------------------------------------------------------------- */
const MenuPopover: React.FC<{
  label: string;
  width?: number;
  triggerClassName: string;
  triggerContent: React.ReactNode;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}> = ({
  label,
  width = 248,
  triggerClassName,
  triggerContent,
  disabled,
  children,
}) => {
  const dark = useDark();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const h = menuRef.current.offsetHeight;
    const gap = 6;
    const fitsBelow = r.bottom + gap + h <= window.innerHeight - 8;
    setPos({
      top: fitsBelow ? r.bottom + gap : Math.max(8, r.top - gap - h),
      left: Math.min(
        Math.max(8, r.right - width),
        window.innerWidth - width - 8
      ),
    });
  }, [open, width]);

  useEffect(() => {
    if (pos) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
    // focus only when the menu first becomes positioned
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos === null]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (menuRef.current?.contains(n) || btnRef.current?.contains(n)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
            []
        );
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next =
          e.key === 'ArrowDown'
            ? (i + 1) % items.length
            : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    const onScrollOrResize = () => close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      {open &&
        createPortal(
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            // portal events still bubble through React; keep rows from reacting
            onClick={(e) => e.stopPropagation()}
            style={{
              width,
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={cx(
              'fixed z-[70] rounded-xl p-1.5 shadow-xl ring-1',
              dark ? 'bg-slate-900 ring-white/10' : 'bg-white ring-slate-900/10'
            )}
          >
            {children(close)}
          </motion.div>,
          document.body
        )}
    </>
  );
};

const MenuItem: React.FC<{
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, danger, onClick }) => {
  const dark = useDark();
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors',
        danger
          ? dark
            ? 'text-rose-300 hover:bg-rose-500/10 focus:bg-rose-500/10'
            : 'text-rose-600 hover:bg-rose-50 focus:bg-rose-50'
          : dark
            ? 'text-slate-200 hover:bg-white/10 focus:bg-white/10'
            : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      {label}
    </button>
  );
};

const MenuDivider: React.FC = () => {
  const dark = useDark();
  return (
    <div
      role="separator"
      className={cx('my-1 h-px', dark ? 'bg-white/10' : 'bg-slate-100')}
    />
  );
};

/* --------------------------------------------------------------- */
/* Main screen                                                      */
/* --------------------------------------------------------------- */
const UserManagement: React.FC<UserOnboardingProps> = ({
  apiEndpoint = `${apiBaseUrl}/admin/users`,
  fullWidth = false,
}) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const t = ui(dark);
  const { addNotification } = useNotifications();

  const [users, setUsers] = useState<UserOnboardingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'username' | 'email_id' | 'last_login'>(
    'last_login'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [exportLoading, setExportLoading] = useState(false);
  const { user } = useAuth();
  const { machineInfo } = useLocalMachine();

  const [filters, setFilters] = useState<UserOnboardingFilters>({
    search: '',
    account_status: '',
    user_status: '',
    user_roles: '',
  });

  const [pagination, setPagination] = useState<UserOnboardingPagination>({
    page: 1,
    page_size: fullWidth ? 20 : 10,
    total: 0,
    total_pages: 0,
  });

  const [editingUser, setEditingUser] = useState<UserOnboardingData | null>(
    null
  );
  const [detailsUser, setDetailsUser] = useState<UserOnboardingData | null>(
    null
  );
  const [confirmAction, setConfirmAction] = useState<UserActionKind | null>(
    null
  );
  const [confirmUser, setConfirmUser] = useState<UserOnboardingData | null>(
    null
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesStatus, setRolesStatus] = useState<RolesStatus>('idle');
  const rolesLoaded = useRef(false);
  const rolesInFlight = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const ensureRoles = useCallback(async (force = false) => {
    if (rolesInFlight.current || (rolesLoaded.current && !force)) return;
    rolesInFlight.current = true;
    setRolesStatus('loading');
    try {
      setRoles(await fetchRoles());
      rolesLoaded.current = true;
      setRolesStatus('ready');
    } catch (error) {
      console.error('Error loading roles:', error);
      setRolesStatus('error');
    } finally {
      rolesInFlight.current = false;
    }
  }, []);

  // "/" jumps to search (unless the user is typing or a dialog is open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
          el.isContentEditable)
      )
        return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [resetSentUser, setResetSentUser] = useState<UserOnboardingData | null>(
    null
  );

  /* ---------------------------- data ---------------------------- */
  const processedData = useMemo(() => {
    return [...users]
      .filter((user) => {
        const q = searchTerm.toLowerCase();
        return (
          user.username.toLowerCase().includes(q) ||
          user.email_id.toLowerCase().includes(q) ||
          user.full_name.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'username') {
          return sortOrder === 'desc'
            ? b.username.localeCompare(a.username)
            : a.username.localeCompare(b.username);
        } else if (sortBy === 'email_id') {
          return sortOrder === 'desc'
            ? b.email_id.localeCompare(a.email_id)
            : a.email_id.localeCompare(b.email_id);
        }
        const dateA = a.last_login ? new Date(a.last_login).getTime() : 0;
        const dateB = b.last_login ? new Date(b.last_login).getTime() : 0;
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [users, searchTerm, sortBy, sortOrder]);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.page_size.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.account_status && {
          account_status: filters.account_status,
        }),
        ...(filters.user_status && { user_status: filters.user_status }),
        ...(filters.user_roles && { user_roles: filters.user_roles }),
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      const response = await fetch(`${apiEndpoint}?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user onboarding data');
      }
      const data = await response.json();

      setUsers(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        total_pages: data.total_pages,
        has_next: data.has_next,
        has_prev: data.has_prev,
        current_page: data.current_page,
      }));
    } catch (error) {
      console.error('Error loading users:', error);
      setLoadError('We couldn’t load users. Check your connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, [
    apiEndpoint,
    filters,
    pagination.page,
    pagination.page_size,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const delay = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: filters.search.trim() }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(delay);
  }, [filters.search]);

  /* --------------------------- exports -------------------------- */
  const exportToExcel = useCallback(async () => {
    try {
      addNotification('Exporting users to Excel...', 'info');
      setExportLoading(true);
      writeUsersWorkbook(processedData, 'User Report', 'User_Report');
      addNotification('User export to Excel completed.', 'success');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      addNotification('Failed to export users to Excel.', 'error');
    } finally {
      setExportLoading(false);
    }
  }, [processedData, addNotification]);

  const exportAllUsersToExcel = useCallback(async () => {
    try {
      addNotification('Exporting all users to Excel...', 'info');
      setExportLoading(true);

      const params = new URLSearchParams({
        page: '1',
        page_size: pagination.total.toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.account_status && {
          account_status: filters.account_status,
        }),
        ...(filters.user_status && { user_status: filters.user_status }),
        ...(filters.user_roles && { user_roles: filters.user_roles }),
      });

      const response = await fetch(`${apiBaseUrl}/admin/users?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users for export');
      }
      const data = await response.json();
      const allUsers: UserOnboardingData[] = data.data || [];

      writeUsersWorkbook(allUsers, 'All Users Report', 'All_Users_Report');
      addNotification('Full user export completed.', 'success');
    } catch (error) {
      console.error('Error exporting all users to Excel:', error);
      addNotification(
        'Failed to export the complete user report. Please try again.',
        'error'
      );
    } finally {
      setExportLoading(false);
    }
  }, [filters, pagination.total, addNotification]);

  /* ---------------------------- actions ------------------------- */
  const patchUserInList = (
    userId: string,
    patch: Partial<UserOnboardingData>
  ) =>
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...patch } : u))
    );

  const handleEditUser = (user: UserOnboardingData) => {
    setSaveError(null);
    setEditingUser({ ...user });
    ensureRoles(); // no-op once the role list has been loaded
  };

  const requestAction = (kind: UserActionKind, user: UserOnboardingData) => {
    setActionError(null);
    setConfirmAction(kind);
    setConfirmUser(user);
  };

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      addNotification('Email copied to clipboard.', 'success');
    } catch {
      addNotification('Couldn’t copy the email address.', 'error');
    }
  };

  const performAction = async () => {
    if (!confirmAction || !confirmUser) return;
    const { id, full_name, email_id } = confirmUser;
    setActionBusy(true);
    setActionError(null);
    try {
      switch (confirmAction) {
        case 'activate':
          await setUserStatus(id, 'Active', user?.username || '', machineInfo ?? undefined);
          patchUserInList(id, { active_flag: true, user_status: 'Active' });
          addNotification(`${full_name} activated.`, 'success');
          break;
        case 'deactivate':
          await setUserStatus(id, 'Inactive', user?.username || '', machineInfo ?? undefined);
          patchUserInList(id, { active_flag: false, user_status: 'Inactive' });
          addNotification(`${full_name} deactivated.`, 'success');
          break;
        case 'lock':
          await lockUser(id);
          patchUserInList(id, {
            account_locked: true,
            account_status: 'Locked',
          });
          addNotification(`Account locked for ${full_name}.`, 'success');
          break;
        case 'unlock':
          await unlockUser(id);
          patchUserInList(id, {
            account_locked: false,
            account_status: 'Unlocked',
            login_attempts: 0,
          });
          addNotification(`Account unlocked for ${full_name}.`, 'success');
          break;
        case 'reset_password':
          await resetUserPassword(id);
          setConfirmAction(null);
          setConfirmUser(null);
          setResetSentUser(confirmUser);
          addNotification(
            `Password reset email sent to ${email_id}.`,
            'success'
          );
          break;
        case 'delete':
          await deleteUser(id);
          setUsers((prev) => prev.filter((u) => u.id !== id));
          setPagination((prev) => ({
            ...prev,
            total: Math.max(0, prev.total - 1),
          }));
          // the drawer would otherwise keep showing a deleted account
          setDetailsUser((cur) => (cur?.id === id ? null : cur));
          addNotification(`${full_name} deleted.`, 'success');
          break;
        case 'sensitive_enable':
        case 'sensitive_disable': {
          const next = confirmAction === 'sensitive_enable';
          await setSensitiveDataAccess(id, next);
          patchUserInList(id, { can_view_sensitive: next });
          addNotification(
            `Sensitive data access ${next ? 'enabled' : 'disabled'} for ${full_name}.`,
            'success'
          );
          break;
        }
      }
      setConfirmAction(null);
      setConfirmUser(null);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'The action failed. Please try again.'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const handleEditSave = async (
    user: UserOnboardingData,
    patch: UserEditPatch
  ) => {
    setActionBusy(true);
    setSaveError(null);
    try {
      await updateUser(user.id, patch);
      patchUserInList(user.id, patch);
      setEditingUser(null);
      addNotification(
        patch.user_roles
          ? `User details updated. Role changed to ${patch.user_roles}.`
          : 'User details updated.',
        'success'
      );
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'Could not save changes. Please try again.'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const detailsUserLive = detailsUser
    ? (users.find((u) => u.id === detailsUser.id) ?? detailsUser)
    : null;

  /* ------------------------- filter helpers --------------------- */
  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      search: '',
      account_status: '',
      user_status: '',
      user_roles: '',
    });
    setSortBy('last_login');
    setSortOrder('desc');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleRefresh = () => {
    clearFilters();
    loadUsers();
  };

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'last_login' ? 'desc' : 'asc');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const setFilter = (
    key: 'account_status' | 'user_status' | 'user_roles',
    value: string
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const activeFilterCount =
    (filters.account_status ? 1 : 0) +
    (filters.user_status ? 1 : 0) +
    (filters.user_roles ? 1 : 0);
  const hasFilters = !!(
    searchTerm ||
    filters.search ||
    filters.account_status ||
    filters.user_status ||
    filters.user_roles
  );

  const stats = useMemo(() => {
    const shown = users.length;
    const activeUsers = users.filter((u) => u.active_flag).length;
    const lockedUsers = users.filter((u) => u.account_locked).length;
    const mfaEnabled = users.filter((u) => u.mfa_enabled).length;
    return {
      shown,
      activeUsers,
      lockedUsers,
      mfaEnabled,
      mfaPct: shown ? Math.round((mfaEnabled / shown) * 100) : 0,
    };
  }, [users]);

  /* --------------------------- styling -------------------------- */
  const selectCls = cx(
    'h-10 w-full appearance-none rounded-lg border pl-3 pr-9 text-sm outline-none focus:ring-2',
    dark
      ? 'border-white/15 bg-white/5 text-white focus:border-teal-400 focus:ring-teal-400/30'
      : 'border-slate-300 bg-white text-slate-900 focus:border-teal-500 focus:ring-teal-500/30'
  );
  const iconBtn = cx(
    'grid h-8 w-8 place-items-center rounded-lg transition-colors',
    t.muted,
    dark
      ? 'hover:bg-white/10 hover:text-white'
      : 'hover:bg-slate-100 hover:text-slate-900',
    t.focus
  );
  const thBase = cx(
    'whitespace-nowrap px-4 py-3 text-left text-xs font-medium',
    t.muted
  );

  const sortableTh = (label: string, field: typeof sortBy, first = false) => {
    const active = sortBy === field;
    return (
      <th
        scope="col"
        aria-sort={
          active ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
        }
        className={cx(thBase, first && 'pl-6')}
      >
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={cx(
            'inline-flex items-center gap-1 rounded-md transition-colors',
            active ? t.strong : '',
            t.focus
          )}
        >
          {label}
          <ChevronDown
            aria-hidden
            className={cx(
              'h-3.5 w-3.5 transition-transform',
              active ? 'opacity-100' : 'opacity-30',
              active && sortOrder === 'asc' && 'rotate-180'
            )}
          />
        </button>
      </th>
    );
  };

  const statCell = (
    label: string,
    value: string | number,
    hint: string,
    opts?: { onClick?: () => void; active?: boolean }
  ) => {
    const inner = (
      <>
        <div className={cx('text-xs', t.muted)}>{label}</div>
        <div
          className={cx(
            'mt-1 text-2xl font-semibold tabular-nums tracking-tight',
            t.strong
          )}
        >
          {value}
        </div>
        <div className={cx('mt-0.5 text-xs', t.muted)}>{hint}</div>
      </>
    );
    const base = cx('block border-b border-r px-6 py-4 text-left', t.hairline);
    return opts?.onClick ? (
      <button
        type="button"
        onClick={opts.onClick}
        aria-pressed={!!opts.active}
        className={cx(
          base,
          'transition-colors',
          t.hover,
          t.focus,
          opts.active && (dark ? 'bg-teal-400/10' : 'bg-teal-50')
        )}
      >
        {inner}
      </button>
    ) : (
      <div className={base}>{inner}</div>
    );
  };

  const { pages, showLast } = pageWindow(
    pagination.page,
    pagination.total_pages
  );
  const rangeStart = (pagination.page - 1) * pagination.page_size + 1;
  const rangeEnd = Math.min(
    pagination.page * pagination.page_size,
    pagination.total
  );
  const pageBtn = (active: boolean) =>
    cx(
      'grid h-8 min-w-[2rem] place-items-center rounded-lg px-2 text-sm tabular-nums transition-colors',
      t.focus,
      active
        ? dark
          ? 'bg-white text-slate-900'
          : 'bg-slate-900 text-white'
        : cx(t.body, t.hover)
    );

  const showSkeleton = isLoading && users.length === 0;
  const showEmpty = !isLoading && !loadError && processedData.length === 0;

  /* ----------------------------- UI ----------------------------- */
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      aria-labelledby="um-title"
      className={cx(
        'overflow-hidden rounded-2xl ring-1 backdrop-blur-xl',
        dark
          ? 'bg-slate-900/60 ring-white/10'
          : 'bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_-16px_rgba(15,23,42,0.16)] ring-slate-900/5',
        fullWidth && 'col-span-full'
      )}
    >
      {/* Header */}
      <header
        className={cx(
          'flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5',
          t.hairline
        )}
      >
        <div className="min-w-0">
          <h2
            id="um-title"
            className={cx('text-xl font-semibold tracking-tight', t.strong)}
          >
            User management
          </h2>
          <p className={cx('mt-1 text-sm', t.muted)}>
            Review accounts, manage access and keep sign-ins secure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Reset filters and refresh"
            title="Reset filters and refresh"
            className={cx(btnCls(dark, 'secondary'), '!w-10 !px-0')}
          >
            <RefreshCw
              className={cx('h-4 w-4', isLoading && 'animate-spin')}
              aria-hidden
            />
          </button>

          <MenuPopover
            label="Export users"
            width={260}
            disabled={exportLoading || processedData.length === 0}
            triggerClassName={btnCls(dark, 'primary')}
            triggerContent={
              <>
                {exportLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                )}
                {exportLoading ? 'Exporting…' : 'Export'}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  icon={FileSpreadsheet}
                  label="Export current view"
                  onClick={() => {
                    close();
                    exportToExcel();
                  }}
                />
                <MenuItem
                  icon={FileSpreadsheet}
                  label="Export all matching users"
                  onClick={() => {
                    close();
                    exportAllUsersToExcel();
                  }}
                />
              </>
            )}
          </MenuPopover>
        </div>
      </header>

      {/* At-a-glance strip (Active / Locked double as quick filters) */}
      {/* <div className={cx('overflow-hidden border-b', t.hairline)}>
        <div className="-mb-px -mr-px grid grid-cols-2 lg:grid-cols-4">
          {statCell(
            'Total users',
            pagination.total.toLocaleString(),
            hasFilters ? 'matching filters' : 'all accounts'
          )}
          {statCell(
            'Active',
            stats.activeUsers,
            `of ${stats.shown} on this page`,
            {
              onClick: () =>
                setFilter(
                  'user_status',
                  filters.user_status === 'Active' ? '' : 'Active'
                ),
              active: filters.user_status === 'Active',
            }
          )}
          {statCell(
            'Locked',
            stats.lockedUsers,
            `of ${stats.shown} on this page`,
            {
              onClick: () =>
                setFilter(
                  'account_status',
                  filters.account_status === 'Locked' ? '' : 'Locked'
                ),
              active: filters.account_status === 'Locked',
            }
          )}
          {statCell(
            'MFA coverage',
            `${stats.mfaPct}%`,
            `${stats.mfaEnabled} of ${stats.shown} on this page`
          )}
        </div>
      </div> */}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search
            aria-hidden
            className={cx(
              'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
              t.muted
            )}
          />
          <input
            ref={searchRef}
            type="text"
            aria-label="Search users"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            placeholder="Search users"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filters.search) {
                setFilters((prev) => ({ ...prev, search: '' }));
              }
            }}
            className={cx(
              'h-10 w-full rounded-lg border pl-9 pr-9 text-sm outline-none focus:ring-2',
              dark
                ? 'border-white/15 bg-white/5 text-white placeholder-slate-500 focus:border-teal-400 focus:ring-teal-400/30'
                : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-teal-500/30'
            )}
          />
          {!filters.search && (
            <kbd
              aria-hidden
              className={cx(
                'pointer-events-none absolute right-2.5 top-1/2 hidden h-5 min-w-[1.25rem] -translate-y-1/2 place-items-center rounded border px-1 font-sans text-xs sm:grid',
                t.hairline,
                t.muted
              )}
            >
              /
            </kbd>
          )}
          {filters.search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setFilters((prev) => ({ ...prev, search: '' }))}
              className={cx(
                'absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md',
                t.muted,
                t.hover,
                t.focus
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!showFilters) ensureRoles();
            setShowFilters((s) => !s);
          }}
          aria-expanded={showFilters}
          aria-controls="um-filters"
          className={btnCls(dark, showFilters ? 'primary' : 'secondary')}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters
          {activeFilterCount > 0 && (
            <span
              className={cx(
                'grid h-5 min-w-[1.25rem] place-items-center rounded-full px-1 text-xs font-semibold tabular-nums',
                showFilters
                  ? dark
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-900'
                  : dark
                    ? 'bg-white text-slate-900'
                    : 'bg-slate-900 text-white'
              )}
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        <div
          className={cx('ml-auto text-sm tabular-nums', t.muted)}
          aria-live="polite"
        >
          {processedData.length > 0 &&
            `${processedData.length} of ${pagination.total.toLocaleString()} users`}
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            id="um-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={cx(
                'mx-6 mb-4 rounded-xl border p-4',
                t.hairline,
                t.subtle
              )}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    id: 'um-f-account',
                    label: 'Account',
                    value: filters.account_status,
                    onChange: (v: string) => setFilter('account_status', v),
                    options: [
                      ['', 'All accounts'],
                      ['Locked', 'Locked'],
                      ['Unlocked', 'Unlocked'],
                    ],
                  },
                  {
                    id: 'um-f-status',
                    label: 'User status',
                    value: filters.user_status,
                    onChange: (v: string) => setFilter('user_status', v),
                    options: [
                      ['', 'All users'],
                      ['Active', 'Active'],
                      ['Inactive', 'Inactive'],
                    ],
                  },
                  {
                    id: 'um-f-role',
                    label: 'Role',
                    value: filters.user_roles,
                    onChange: (v: string) => setFilter('user_roles', v),
                    options: [
                      [
                        '',
                        rolesStatus === 'loading'
                          ? 'Loading roles…'
                          : 'All roles',
                      ],
                      ...(filters.user_roles &&
                      !roles.some((r) => r.value === filters.user_roles)
                        ? [[filters.user_roles, filters.user_roles]]
                        : []),
                      ...roles.map((r) => [r.value, r.label]),
                    ],
                  },
                ].map((f) => (
                  <div key={f.id}>
                    <label
                      htmlFor={f.id}
                      className={cx(
                        'mb-1.5 block text-sm font-medium',
                        t.strong
                      )}
                    >
                      {f.label}
                    </label>
                    <div className="relative">
                      <select
                        id={f.id}
                        value={f.value}
                        onChange={(e) => f.onChange(e.target.value)}
                        className={selectCls}
                      >
                        {f.options.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden
                        className={cx(
                          'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2',
                          t.muted
                        )}
                      />
                    </div>
                  </div>
                ))}

                <div>
                  <label
                    htmlFor="um-f-sort"
                    className={cx('mb-1.5 block text-sm font-medium', t.strong)}
                  >
                    Sort by
                  </label>
                  <div className="relative">
                    <select
                      id="um-f-sort"
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [newSortBy, newSortOrder] = e.target.value.split(
                          '-'
                        ) as [typeof sortBy, 'asc' | 'desc'];
                        setSortBy(newSortBy);
                        setSortOrder(newSortOrder);
                      }}
                      className={selectCls}
                    >
                      <option value="last_login-desc">
                        Last login: recent first
                      </option>
                      <option value="last_login-asc">
                        Last login: oldest first
                      </option>
                      <option value="username-asc">Username: A to Z</option>
                      <option value="username-desc">Username: Z to A</option>
                      <option value="email_id-asc">Email: A to Z</option>
                      <option value="email_id-desc">Email: Z to A</option>
                    </select>
                    <ChevronDown
                      aria-hidden
                      className={cx(
                        'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2',
                        t.muted
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={btnCls(dark, 'ghost', 'sm')}
                >
                  Reset filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Applied filters */}
      {(filters.account_status ||
        filters.user_status ||
        filters.user_roles) && (
        <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
          <span className={cx('text-xs', t.muted)}>Filtered by</span>
          {filters.user_status && (
            <button
              type="button"
              onClick={() => setFilter('user_status', '')}
              className={cx(btnCls(dark, 'secondary', 'sm'), '!h-7 gap-1.5')}
            >
              {filters.user_status}
              <X className="h-3 w-3" aria-label="Remove user status filter" />
            </button>
          )}
          {filters.user_roles && (
            <button
              type="button"
              onClick={() => setFilter('user_roles', '')}
              className={cx(btnCls(dark, 'secondary', 'sm'), '!h-7 gap-1.5')}
            >
              Role:{' '}
              {roles.find((r) => r.value === filters.user_roles)?.label ??
                filters.user_roles}
              <X className="h-3 w-3" aria-label="Remove role filter" />
            </button>
          )}
          {filters.account_status && (
            <button
              type="button"
              onClick={() => setFilter('account_status', '')}
              className={cx(btnCls(dark, 'secondary', 'sm'), '!h-7 gap-1.5')}
            >
              {filters.account_status}
              <X className="h-3 w-3" aria-label="Remove account filter" />
            </button>
          )}
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div
          role="alert"
          className={cx(
            'mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset',
            dark
              ? 'bg-rose-400/10 text-rose-200 ring-rose-400/25'
              : 'bg-rose-50 text-rose-800 ring-rose-200'
          )}
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {loadError}
          </span>
          <button
            type="button"
            onClick={loadUsers}
            className={btnCls(dark, 'secondary', 'sm')}
          >
            Retry
          </button>
        </div>
      )}

      {/* Table / empty state */}
      {showEmpty ? (
        <div className={cx('border-t px-6 py-16 text-center', t.hairline)}>
          <span
            className={cx(
              'mx-auto grid h-12 w-12 place-items-center rounded-full',
              dark ? 'bg-white/5' : 'bg-slate-100'
            )}
          >
            <Search className={cx('h-5 w-5', t.muted)} aria-hidden />
          </span>
          <h3 className={cx('mt-4 text-base font-semibold', t.strong)}>
            {hasFilters ? 'No users match these filters' : 'No users found'}
          </h3>
          <p className={cx('mx-auto mt-1 max-w-sm text-sm', t.muted)}>
            {hasFilters
              ? 'Try a different search term or clear the filters to see everyone.'
              : 'Users will appear here once they have been onboarded.'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className={cx(btnCls(dark, 'secondary'), 'mt-5')}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className={cx('relative border-t', t.hairline)}
          aria-busy={isLoading}
        >
          {isLoading && !showSkeleton && (
            <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
              <motion.div
                className="h-full w-1/3 bg-teal-500"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
              />
            </div>
          )}

          <div className="overflow-x-auto">
            <table
              className={cx(
                'w-full min-w-[1080px] text-sm transition-opacity',
                isLoading && !showSkeleton && 'opacity-60'
              )}
            >
              <caption className="sr-only">
                Users and their account status
              </caption>
              <thead className={t.subtle}>
                <tr className={cx('border-b', t.hairline)}>
                  {sortableTh('User', 'username', true)}
                  {sortableTh('Email', 'email_id')}
                  <th scope="col" className={thBase}>
                    Role
                  </th>
                  <th scope="col" className={thBase}>
                    Status
                  </th>
                  <th scope="col" className={thBase}>
                    Failed logins
                  </th>
                  <th scope="col" className={thBase}>
                    Account
                  </th>
                  {sortableTh('Last login', 'last_login')}
                  <th scope="col" className={thBase}>
                    Sensitive data
                  </th>
                  <th scope="col" className={cx(thBase, 'pr-6 text-right')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className={cx('divide-y', t.divide)}>
                {showSkeleton
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} aria-hidden>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <td
                            key={j}
                            className={cx('px-4 py-4', j === 0 && 'pl-6')}
                          >
                            <div
                              className={cx(
                                'h-4 animate-pulse rounded motion-reduce:animate-none',
                                dark ? 'bg-white/10' : 'bg-slate-100',
                                j === 0 ? 'w-40' : j === 1 ? 'w-44' : 'w-16'
                              )}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  : processedData.map((user) => {
                      const status = getStatus(user);
                      const locked =
                        user.account_status.toLowerCase() === 'locked';
                      const last = formatDate(user.last_login);
                      const attempts = user.login_attempts ?? 0;

                      return (
                        <tr
                          key={user.id}
                          tabIndex={0}
                          onClick={() => setDetailsUser({ ...user })}
                          onKeyDown={(e) => {
                            if (
                              e.target === e.currentTarget &&
                              e.key === 'Enter'
                            )
                              setDetailsUser({ ...user });
                          }}
                          className={cx(
                            'cursor-pointer transition-colors',
                            t.hover,
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500/70'
                          )}
                        >
                          <td className="py-3 pl-6 pr-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={user.full_name} />
                              <div className="min-w-0">
                                <div
                                  className={cx(
                                    'truncate font-medium',
                                    t.strong
                                  )}
                                >
                                  {user.full_name}
                                </div>
                                <div
                                  className={cx('truncate text-xs', t.muted)}
                                >
                                  {user.username}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={t.body}>{user.email_id}</span>
                              {user.email_verified ? (
                                <CheckCircle2
                                  className="h-4 w-4 shrink-0 text-emerald-500"
                                  aria-label="Email verified"
                                />
                              ) : (
                                <AlertTriangle
                                  className="h-4 w-4 shrink-0 text-amber-500"
                                  aria-label="Email not verified"
                                />
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <Pill>{user.user_roles}</Pill>
                          </td>

                          <td className="px-4 py-3">
                            <Pill tone={status.tone} dot>
                              {status.label}
                            </Pill>
                          </td>

                          <td className="px-4 py-3">
                            {attempts > 0 ? (
                              <Pill tone="warning">{attempts}</Pill>
                            ) : (
                              <span className={cx('tabular-nums', t.muted)}>
                                0
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <Pill
                              tone={locked ? 'danger' : 'neutral'}
                              icon={locked ? Lock : Unlock}
                            >
                              {user.account_status}
                            </Pill>
                            {locked && user.account_locked_until && (
                              <div
                                className={cx(
                                  'mt-1 text-xs tabular-nums',
                                  t.muted
                                )}
                              >
                                Until {stamp(user.account_locked_until, '')}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div
                              className={cx('font-medium tabular-nums', t.body)}
                            >
                              {last.date}
                            </div>
                            {last.time && (
                              <div
                                className={cx('text-xs tabular-nums', t.muted)}
                              >
                                {last.time}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={cx(
                                'inline-flex items-center gap-1.5 text-xs font-medium',
                                user.can_view_sensitive
                                  ? dark
                                    ? 'text-emerald-300'
                                    : 'text-emerald-700'
                                  : dark
                                    ? 'text-amber-300'
                                    : 'text-amber-700'
                              )}
                            >
                              {user.can_view_sensitive ? (
                                <ShieldCheck className="h-4 w-4" aria-hidden />
                              ) : (
                                <ShieldAlert className="h-4 w-4" aria-hidden />
                              )}
                              {user.can_view_sensitive ? 'Allowed' : 'Blocked'}
                            </span>
                          </td>

                          <td className="py-3 pl-4 pr-6">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailsUser({ ...user });
                                }}
                                className={iconBtn}
                                aria-label={`View details for ${user.full_name}`}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditUser(user);
                                }}
                                className={iconBtn}
                                aria-label={`Edit ${user.full_name}`}
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <MenuPopover
                                label={`More actions for ${user.full_name}`}
                                triggerClassName={iconBtn}
                                triggerContent={
                                  <MoreVertical className="h-4 w-4" />
                                }
                              >
                                {(close) => {
                                  const run = (fn: () => void) => () => {
                                    close();
                                    fn();
                                  };
                                  const act = (kind: UserActionKind) => (
                                    <MenuItem
                                      icon={ACTION_META[kind].icon}
                                      label={ACTION_META[kind].label}
                                      danger={kind === 'delete'}
                                      onClick={run(() =>
                                        requestAction(kind, user)
                                      )}
                                    />
                                  );
                                  return (
                                    <>
                                      {act(
                                        user.active_flag
                                          ? 'deactivate'
                                          : 'activate'
                                      )}
                                      {act(
                                        user.account_locked ? 'unlock' : 'lock'
                                      )}
                                      <MenuDivider />
                                      {act('reset_password')}
                                      {act(
                                        user.can_view_sensitive
                                          ? 'sensitive_disable'
                                          : 'sensitive_enable'
                                      )}
                                      <MenuDivider />
                                      <MenuItem
                                        icon={Copy}
                                        label="Copy email"
                                        onClick={run(() =>
                                          copyEmail(user.email_id)
                                        )}
                                      />
                                      <MenuDivider />
                                      {act('delete')}
                                    </>
                                  );
                                }}
                              </MenuPopover>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer / pagination */}
      {pagination.total > 0 && !showEmpty && (
        <footer
          className={cx(
            'flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3',
            t.hairline
          )}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className={cx('text-sm tabular-nums', t.muted)}>
              Showing {rangeStart}–{rangeEnd} of{' '}
              {pagination.total.toLocaleString()} users
            </div>
            <label className={cx('flex items-center gap-2 text-sm', t.muted)}>
              Rows
              <span className="relative">
                <select
                  value={pagination.page_size}
                  onChange={(e) =>
                    setPagination((prev) => ({
                      ...prev,
                      page_size: Number(e.target.value),
                      page: 1,
                    }))
                  }
                  className={cx(
                    selectCls,
                    '!h-8 !w-auto !pl-2.5 !pr-8 text-xs tabular-nums'
                  )}
                >
                  {Array.from(new Set([10, 20, 50, pagination.page_size]))
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                />
              </span>
            </label>
          </div>

          {pagination.total_pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.max(1, prev.page - 1),
                  }))
                }
                disabled={pagination.page === 1}
                className={cx(pageBtn(false), 'disabled:opacity-40')}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {pages.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={`Page ${p}`}
                  aria-current={pagination.page === p ? 'page' : undefined}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: p }))
                  }
                  className={pageBtn(pagination.page === p)}
                >
                  {p}
                </button>
              ))}

              {showLast && (
                <>
                  <span className={cx('px-1', t.muted)} aria-hidden>
                    …
                  </span>
                  <button
                    type="button"
                    aria-label={`Page ${pagination.total_pages}`}
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: pagination.total_pages,
                      }))
                    }
                    className={pageBtn(false)}
                  >
                    {pagination.total_pages}
                  </button>
                </>
              )}

              <button
                type="button"
                aria-label="Next page"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(pagination.total_pages, prev.page + 1),
                  }))
                }
                disabled={pagination.page === pagination.total_pages}
                className={cx(pageBtn(false), 'disabled:opacity-40')}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </footer>
      )}

      {/* Layered flows: drawer → confirm sits above it, edit replaces it */}
      <UserDetailsDrawer
        user={detailsUserLive}
        canViewSensitive={detailsUserLive?.can_view_sensitive ?? false}
        onClose={() => setDetailsUser(null)}
        onEdit={(u) => {
          setDetailsUser(null);
          handleEditUser(u);
        }}
        onAction={(kind, u) => requestAction(kind, u)}
        loadEventLogs={fetchUserEventLogs}
      />

      <EditUserModal
        user={editingUser}
        saving={actionBusy}
        error={saveError}
        roles={roles}
        rolesStatus={rolesStatus}
        onRetryRoles={() => ensureRoles(true)}
        onClose={() => setEditingUser(null)}
        onSave={handleEditSave}
      />

      <ConfirmUserActionModal
        action={confirmAction}
        user={confirmUser}
        busy={actionBusy}
        error={actionError}
        onClose={() => {
          setConfirmAction(null);
          setConfirmUser(null);
        }}
        onConfirm={performAction}
      />

      <ResetPasswordSentModal
        user={resetSentUser}
        onClose={() => setResetSentUser(null)}
      />
    </motion.section>
  );
};

export default UserManagement;
