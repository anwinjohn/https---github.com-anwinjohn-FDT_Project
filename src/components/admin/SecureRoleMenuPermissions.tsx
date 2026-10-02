import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  Plus,
  Download,
  Upload,
  Save,
  RotateCcw,
  AlertTriangle,
  Search,
  Loader2,
  X,
  Folder,
  FileText,
  MoreHorizontal,
  MoreVertical,
  Users,
  Info,
  Check,
} from 'lucide-react';
import { Role } from '../../types/admin';
import { useNotifications } from '../notifications';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { useAuth } from '../../context/AuthContext';
import { invalidatePermissions } from '../../hooks/usePermissions';

// ---------------------------------------------------------------------------
// Types (unchanged API contract)
// ---------------------------------------------------------------------------
interface MenuPermissionFlags {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_export: boolean;
  can_import: boolean;
}

interface MenuPermissionNode {
  menu_id: number;
  parent_id: number | null;
  is_parent: boolean;
  menu_name: string;
  menu_key: string;
  menu_url: string;
  menu_icon: string;
  permissions: MenuPermissionFlags;
  children?: MenuPermissionNode[];
}

type PermissionKey = keyof MenuPermissionFlags;

/** Optional fields the redesigned header can show when the API provides them. */
type RoleDetails = Role & {
  user_count?: number;
  updated_at?: string;
  updated_by?: string;
};

interface SecureRoleMenuPermissionsProps {
  /** Shows the "Manage Role Groups" button when provided. */
  onManageRoles?: () => void;
  /** Shows the "Create Menu" button when provided. */
  onCreateMenu?: () => void;
  /** Shows the "Upload Menu" button when provided. */
  onUploadMenu?: () => void;
}

const PERMISSION_KEYS: PermissionKey[] = [
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
  'can_export',
  'can_import',
];

// Row-major order for the 2-column toggle grid:
// View | Delete / Create | Export / Edit | Import
const TOGGLE_GRID_ORDER: PermissionKey[] = [
  'can_view',
  'can_delete',
  'can_create',
  'can_export',
  'can_edit',
  'can_import',
];

const PERMISSION_META: Record<
  PermissionKey,
  {
    label: string;
    short: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  can_view: { label: 'View / Read', short: 'View', icon: Eye },
  can_create: { label: 'Create', short: 'Create', icon: Plus },
  can_edit: { label: 'Edit', short: 'Edit', icon: Pencil },
  can_delete: { label: 'Delete', short: 'Delete', icon: Trash2 },
  can_export: { label: 'Export', short: 'Export', icon: Download },
  can_import: { label: 'Import / Upload', short: 'Import', icon: Upload },
};

const NO_PERMISSIONS: MenuPermissionFlags = {
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
  can_export: false,
  can_import: false,
};

const ALL_PERMISSIONS: MenuPermissionFlags = {
  can_view: true,
  can_create: true,
  can_edit: true,
  can_delete: true,
  can_export: true,
  can_import: true,
};

// ---------------------------------------------------------------------------
// Pure tree helpers
// ---------------------------------------------------------------------------
function flattenTree(nodes: MenuPermissionNode[]): MenuPermissionNode[] {
  const result: MenuPermissionNode[] = [];
  const walk = (list: MenuPermissionNode[]) => {
    list.forEach((node) => {
      result.push(node);
      if (node.children && node.children.length > 0) walk(node.children);
    });
  };
  walk(nodes);
  return result;
}

function mapTree(
  nodes: MenuPermissionNode[],
  fn: (node: MenuPermissionNode) => MenuPermissionNode
): MenuPermissionNode[] {
  return nodes.map((node) => {
    const updated = fn(node);
    if (updated.children && updated.children.length > 0) {
      return { ...updated, children: mapTree(updated.children, fn) };
    }
    return updated;
  });
}

function updateSinglePermission(
  nodes: MenuPermissionNode[],
  menuId: number,
  key: PermissionKey,
  value: boolean
): MenuPermissionNode[] {
  return mapTree(nodes, (node) =>
    node.menu_id === menuId
      ? { ...node, permissions: { ...node.permissions, [key]: value } }
      : node
  );
}

function updateBulkPermission(
  nodes: MenuPermissionNode[],
  menuIds: Set<number>,
  key: PermissionKey,
  value: boolean
): MenuPermissionNode[] {
  return mapTree(nodes, (node) =>
    menuIds.has(node.menu_id)
      ? { ...node, permissions: { ...node.permissions, [key]: value } }
      : node
  );
}

function filterTree(
  nodes: MenuPermissionNode[],
  predicate: (node: MenuPermissionNode) => boolean
): MenuPermissionNode[] {
  return nodes.reduce<MenuPermissionNode[]>((acc, node) => {
    const filteredChildren = node.children
      ? filterTree(node.children, predicate)
      : undefined;
    const selfMatches = predicate(node);
    const hasMatchingChildren =
      !!filteredChildren && filteredChildren.length > 0;
    if (selfMatches || hasMatchingChildren) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

const permsEqual = (a: MenuPermissionFlags, b: MenuPermissionFlags) =>
  PERMISSION_KEYS.every((k) => a[k] === b[k]);

const grantedLabels = (p: MenuPermissionFlags) =>
  PERMISSION_KEYS.filter((k) => p[k]).map((k) => PERMISSION_META[k].short);

type AccessState = 'all' | 'some' | 'none';
const accessStateOf = (node: MenuPermissionNode): AccessState => {
  const flat = flattenTree([node]);
  const allowed = flat.filter((n) => n.permissions.can_view).length;
  if (allowed === 0) return 'none';
  return allowed === flat.length ? 'all' : 'some';
};

// ---------------------------------------------------------------------------
// Design tokens (light + dark share the same structure)
// ---------------------------------------------------------------------------
interface Tokens {
  card: string;
  inset: string;
  line: string;
  lineStrong: string;
  text: string;
  body: string;
  muted: string;
  hover: string;
  selected: string;
  input: string;
  btn: string;
  chipIcon: string;
  allowed: string;
  denied: string;
  summaryChip: string;
  toggleOff: string;
  menu: string;
  skeleton: string;
}

const LIGHT: Tokens = {
  card: 'bg-white border-slate-200 shadow-sm',
  inset: 'bg-slate-50 border-slate-200',
  line: 'border-slate-100',
  lineStrong: 'border-slate-200',
  text: 'text-slate-900',
  body: 'text-slate-700',
  muted: 'text-slate-500',
  hover: 'hover:bg-slate-50',
  selected: 'bg-blue-50',
  input: 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
  btn: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
  chipIcon: 'bg-blue-50 text-blue-600',
  allowed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  denied: 'bg-slate-100 text-slate-600 ring-slate-200',
  summaryChip: 'bg-blue-50 text-blue-700',
  toggleOff: 'bg-slate-300',
  menu: 'bg-white border-slate-200 text-slate-700 shadow-xl',
  skeleton: 'bg-slate-100',
};

const DARK: Tokens = {
  card: 'bg-white/5 border-white/15 shadow-sm',
  inset: 'bg-white/[0.03] border-white/15',
  line: 'border-white/10',
  lineStrong: 'border-white/15',
  text: 'text-white',
  body: 'text-white/80',
  muted: 'text-white/60',
  hover: 'hover:bg-white/5',
  selected: 'bg-blue-500/15',
  input: 'bg-white/10 border-white/20 text-white placeholder:text-white/50',
  btn: 'bg-white/10 border-white/20 text-white hover:bg-white/20',
  chipIcon: 'bg-blue-500/20 text-blue-300',
  allowed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  denied: 'bg-white/10 text-white/60 ring-white/15',
  summaryChip: 'bg-blue-500/15 text-blue-300',
  toggleOff: 'bg-white/25',
  menu: 'bg-slate-900 border-white/20 text-white/90 shadow-2xl',
  skeleton: 'bg-white/10',
};

function useTokens(): Tokens {
  const { theme } = useTheme();
  return theme === 'dark' ? DARK : LIGHT;
}

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

// ---------------------------------------------------------------------------
// Small presentational building blocks
// ---------------------------------------------------------------------------
const TriCheckbox: React.FC<{
  state: AccessState;
  onChange: (next: boolean) => void;
  label: string;
}> = ({ state, onChange, label }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={state === 'all'}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded accent-blue-600 ${FOCUS}`}
    />
  );
};

const AccessPill: React.FC<{
  allowed: boolean;
  name: string;
  onToggle: () => void;
}> = ({ allowed, name, onToggle }) => {
  const t = useTokens();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={`${name}: ${allowed ? 'allowed' : 'not allowed'}. Click to ${
        allowed ? 'revoke' : 'allow'
      } access`}
      title={allowed ? 'Click to revoke access' : 'Click to allow access'}
      className={`inline-flex min-w-[84px] items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors ${
        allowed ? t.allowed : t.denied
      } ${FOCUS}`}
    >
      {allowed ? 'Allowed' : 'Not allowed'}
    </button>
  );
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => {
  const t = useTokens();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
        checked ? 'bg-blue-600' : t.toggleOff
      } ${FOCUS} focus-visible:ring-offset-1`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

/**
 * Popover menu rendered in a portal so it is never clipped by the
 * scrollable tree/table containers it is opened from.
 */
const MoreMenu: React.FC<{
  label: string;
  trigger: React.ReactNode;
  triggerClassName?: string;
  width?: number;
  children: (close: () => void) => React.ReactNode;
}> = ({ label, trigger, triggerClassName = '', width = 224, children }) => {
  const t = useTokens();
  const [pos, setPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return;
    const inside = (e: Event) => {
      const target = e.target as Node;
      return (
        !!menuRef.current?.contains(target) ||
        !!btnRef.current?.contains(target)
      );
    };
    const onDown = (e: MouseEvent) => {
      if (!inside(e)) close();
    };
    const onScroll = (e: Event) => {
      if (!inside(e)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        btnRef.current?.focus();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [pos, close]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pos) return close();
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(
      8,
      Math.min(rect.right - width, window.innerWidth - width - 8)
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    setPos(
      spaceBelow < 320 && rect.top > spaceBelow
        ? { left, bottom: window.innerHeight - rect.top + 4 }
        : { left, top: rect.bottom + 4 }
    );
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={handleToggle}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width,
              maxHeight: '70vh',
            }}
            className={`z-50 overflow-y-auto rounded-xl border p-1.5 ${t.menu}`}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  );
};

const MenuItem: React.FC<{
  onClick: () => void;
  icon?: React.ReactNode;
  checked?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, icon, checked, danger, children }) => {
  const t = useTokens();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
        t.hover
      } ${danger ? 'text-red-600' : ''} ${FOCUS}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1">{children}</span>
      {checked && <Check className="h-4 w-4 text-blue-600" />}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
type DetailTab = 'permissions' | 'submenus' | 'details';

const SecureRoleMenuPermissions: React.FC<SecureRoleMenuPermissionsProps> = ({
  onManageRoles,
  onCreateMenu,
  onUploadMenu,
}) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [permissionTree, setPermissionTree] = useState<MenuPermissionNode[]>(
    []
  );
  // Last server-confirmed state; used for dirty tracking, per-menu reset and Cancel
  const [originalTree, setOriginalTree] = useState<MenuPermissionNode[]>([]);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('permissions');
  const [searchTerm, setSearchTerm] = useState('');
  const [featureSearch, setFeatureSearch] = useState('');
  const [editingFeatureId, setEditingFeatureId] = useState<number | null>(null);
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addNotification } = useNotifications();
  const t = useTokens();
  const { theme } = useTheme();
  const { getMenuId, loading: menuIdsLoading } = useMenuIds();
  const { user } = useAuth();

  const ROLE_PERMISSIONS_MENU_ID = getMenuId('role_permissions');

  const skipNextRoleEffect = useRef(true);
  const didInitialExpand = useRef(false);

  // Single place that accepts a freshly loaded tree
  const applyTree = useCallback((tree: MenuPermissionNode[]) => {
    setPermissionTree(tree);
    setOriginalTree(tree);
    if (!didInitialExpand.current && tree.length > 0) {
      didInitialExpand.current = true;
      setExpandedMenus(
        new Set(
          flattenTree(tree)
            .filter((n) => n.children && n.children.length > 0)
            .map((n) => n.menu_id)
        )
      );
    }
  }, []);

  const loadPermissions = useCallback(
    async (roleId: number) => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/menu-assignment/${roleId}`);

        if (response.success && response.data) {
          applyTree(response.data);
        } else {
          throw new Error(response.error || 'Failed to load permissions');
        }
      } catch (err) {
        setError('Failed to load permissions');
        console.error('Error loading permissions:', err);
      } finally {
        setLoading(false);
      }
    },
    [applyTree]
  );

  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rolesResponse = await apiClient.get('/api/admin/roles');
      if (!rolesResponse.success || !rolesResponse.data) {
        throw new Error(rolesResponse.error || 'Failed to load roles');
      }

      const loadedRoles: Role[] = rolesResponse.data;
      setRoles(loadedRoles);

      const defaultRole =
        loadedRoles.find((r) => r.is_active) || loadedRoles[0] || null;
      skipNextRoleEffect.current = true;
      setSelectedRole(defaultRole);

      if (defaultRole) {
        const permsResponse = await apiClient.get(
          `/menu-assignment/${defaultRole.id}`
        );
        if (!permsResponse.success || !permsResponse.data) {
          throw new Error(
            permsResponse.error || 'Failed to load menu permissions'
          );
        }
        applyTree(permsResponse.data);
      }
    } catch (err) {
      setError('Failed to load roles or menu permissions');
      console.error('Error initializing role menu permissions:', err);
      skipNextRoleEffect.current = true;
    } finally {
      setLoading(false);
    }
  }, [applyTree]);

  useEffect(() => {
    if (!menuIdsLoading && ROLE_PERMISSIONS_MENU_ID) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuIdsLoading, ROLE_PERMISSIONS_MENU_ID]);

  // Fires only when the user explicitly switches roles after initial load
  useEffect(() => {
    if (skipNextRoleEffect.current) {
      skipNextRoleEffect.current = false;
      return;
    }
    if (selectedRole) {
      loadPermissions(selectedRole.id);
    }
  }, [selectedRole, loadPermissions]);

  // ---------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------
  const nodeById = useMemo(() => {
    const map = new Map<number, MenuPermissionNode>();
    flattenTree(permissionTree).forEach((n) => map.set(n.menu_id, n));
    return map;
  }, [permissionTree]);

  const originalById = useMemo(() => {
    const map = new Map<number, MenuPermissionFlags>();
    flattenTree(originalTree).forEach((n) => map.set(n.menu_id, n.permissions));
    return map;
  }, [originalTree]);

  const modifiedIds = useMemo(() => {
    const set = new Set<number>();
    nodeById.forEach((node, id) => {
      const original = originalById.get(id);
      if (original && !permsEqual(original, node.permissions)) set.add(id);
    });
    return set;
  }, [nodeById, originalById]);

  const hasChanges = modifiedIds.size > 0;

  const selectedNode =
    selectedMenuId != null ? (nodeById.get(selectedMenuId) ?? null) : null;

  // Keep a valid menu selected whenever the tree changes
  useEffect(() => {
    if (permissionTree.length === 0) return;
    if (selectedMenuId == null || !nodeById.has(selectedMenuId)) {
      setSelectedMenuId(permissionTree[0].menu_id);
    }
  }, [permissionTree, nodeById, selectedMenuId]);

  // Reset per-menu UI state when the selection changes
  useEffect(() => {
    setFeatureSearch('');
    setEditingFeatureId(null);
  }, [selectedMenuId]);

  // Warn before leaving the page with unsaved edits
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  const searchedTree = useMemo(() => {
    if (!searchTerm.trim()) return permissionTree;
    const term = searchTerm.toLowerCase();
    return filterTree(
      permissionTree,
      (node) =>
        node.menu_name.toLowerCase().includes(term) ||
        node.menu_url.toLowerCase().includes(term) ||
        node.menu_key.toLowerCase().includes(term)
    );
  }, [permissionTree, searchTerm]);

  const filteredTree = useMemo(() => {
    if (!showOnlyAssigned) return searchedTree;
    return filterTree(searchedTree, (node) =>
      PERMISSION_KEYS.some((key) => node.permissions[key])
    );
  }, [searchedTree, showOnlyAssigned]);

  const filteredFlatList = useMemo(
    () => flattenTree(filteredTree),
    [filteredTree]
  );

  const parentIds = useMemo(
    () =>
      flattenTree(permissionTree)
        .filter((n) => n.children && n.children.length > 0)
        .map((n) => n.menu_id),
    [permissionTree]
  );
  const allExpanded =
    parentIds.length > 0 && parentIds.every((id) => expandedMenus.has(id));

  // Auto-expand parents of matches while searching
  useEffect(() => {
    if (!searchTerm.trim()) return;
    const idsToExpand = flattenTree(searchedTree)
      .filter((n) => n.children && n.children.length > 0)
      .map((n) => n.menu_id);
    if (idsToExpand.length === 0) return;

    setExpandedMenus((prev) => {
      let changed = false;
      const next = new Set(prev);
      idsToExpand.forEach((id) => {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [searchedTree, searchTerm]);

  // ---------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------
  const handlePermissionChange = (
    menuId: number,
    permission: PermissionKey,
    value: boolean
  ) => {
    setPermissionTree((prev) =>
      updateSinglePermission(prev, menuId, permission, value)
    );
    logger.info(
      `Permission changed: ${permission} for menu ${menuId} set to ${value}`,
      undefined,
      { menuId, permission, value, roleId: selectedRole?.id }
    );
  };

  const handleBulkPermissionChange = (
    menuIds: number[],
    permission: PermissionKey,
    value: boolean
  ) => {
    const idSet = new Set(menuIds);
    setPermissionTree((prev) =>
      updateBulkPermission(prev, idSet, permission, value)
    );
    logger.info(
      `Bulk permission changed: ${permission} for ${menuIds.length} menus set to ${value}`,
      undefined,
      { menuIds, permission, value, roleId: selectedRole?.id }
    );
  };

  /** Quick access switch: allowing grants View; revoking clears every action. Cascades to sub menus. */
  const handleAccessChange = (menuId: number, allowed: boolean) => {
    const full = nodeById.get(menuId);
    if (!full) return;
    const ids = new Set(flattenTree([full]).map((n) => n.menu_id));
    setPermissionTree((prev) =>
      mapTree(prev, (n) =>
        ids.has(n.menu_id)
          ? {
              ...n,
              permissions: allowed
                ? { ...n.permissions, can_view: true }
                : { ...NO_PERMISSIONS },
            }
          : n
      )
    );
    logger.info(
      `Access ${allowed ? 'granted' : 'revoked'} for menu ${menuId} (${ids.size} menus)`,
      undefined,
      { menuId, allowed, roleId: selectedRole?.id }
    );
  };

  /** Replace the permission set of a single menu. */
  const setMenuPermissions = (menuId: number, perms: MenuPermissionFlags) => {
    setPermissionTree((prev) =>
      mapTree(prev, (n) =>
        n.menu_id === menuId ? { ...n, permissions: { ...perms } } : n
      )
    );
  };

  /** Copy a group's permission set onto every sub menu beneath it. */
  const applyToSubMenus = (menuId: number) => {
    const full = nodeById.get(menuId);
    if (!full?.children?.length) return;
    const ids = new Set(flattenTree(full.children).map((n) => n.menu_id));
    setPermissionTree((prev) =>
      mapTree(prev, (n) =>
        ids.has(n.menu_id) ? { ...n, permissions: { ...full.permissions } } : n
      )
    );
    addNotification(
      `Applied "${full.menu_name}" permissions to ${ids.size} sub menu${
        ids.size === 1 ? '' : 's'
      }`,
      'success'
    );
  };

  /** Undo edits for a menu and everything beneath it. */
  const resetMenu = (menuId: number) => {
    const full = nodeById.get(menuId);
    if (!full) return;
    const ids = new Set(flattenTree([full]).map((n) => n.menu_id));
    setPermissionTree((prev) =>
      mapTree(prev, (n) => {
        const original = originalById.get(n.menu_id);
        return ids.has(n.menu_id) && original
          ? { ...n, permissions: { ...original } }
          : n;
      })
    );
  };

  const savePermissions = async () => {
    if (!selectedRole) return;

    try {
      setSaving(true);

      const permissionsPayload = flattenTree(permissionTree).map((p) => ({
        menu_id: p.menu_id,
        permissions: { ...p.permissions },
      }));
      const response = await apiClient.post('/admin/modify-menu-assignment', {
        roleId: selectedRole.id,
        roleName: selectedRole.role_name,
        actionedBy: user?.username,
        actionedUserId: user?.id,
        permissions: permissionsPayload,
      });

      if (response.success) {
        addNotification(
          response.data?.message || 'Permissions updated successfully',
          'success'
        );
        setOriginalTree(permissionTree);
        invalidatePermissions(selectedRole.id.toString());

        logger.info(
          `Role permissions saved for ${selectedRole.role_name}`,
          undefined,
          {
            roleId: selectedRole.id,
            permissionsCount: permissionsPayload.length,
          }
        );
      } else {
        throw new Error(response.error || 'Failed to save permissions');
      }
    } catch (err) {
      addNotification('Failed to save permissions', 'error');
      console.error('Error saving permissions:', err);

      logger.error(
        'Failed to save role permissions',
        undefined,
        { roleId: selectedRole.id, error: err },
        new Error('Permission save failed')
      );
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setPermissionTree(originalTree);
    if (selectedRole) {
      logger.info(
        `Role permissions reset for ${selectedRole.role_name}`,
        undefined,
        { roleId: selectedRole.id }
      );
    }
  };

  const handleRoleChange = (roleId: number) => {
    if (
      hasChanges &&
      !window.confirm('You have unsaved changes. Discard them and switch role?')
    ) {
      return;
    }
    setSelectedRole(roles.find((r) => r.id === roleId) || null);
  };

  const retry = () => {
    if (selectedRole) loadPermissions(selectedRole.id);
    else initialize();
  };

  const toggleMenuExpansion = (menuId: number) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  const toggleAllMenus = () => {
    setExpandedMenus(allExpanded ? new Set() : new Set(parentIds));
  };

  const onRowKeyDown = (
    e: React.KeyboardEvent,
    menuId: number,
    hasChildren: boolean,
    isExpanded: boolean
  ) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedMenuId(menuId);
    } else if (e.key === 'ArrowRight' && hasChildren && !isExpanded) {
      toggleMenuExpansion(menuId);
    } else if (e.key === 'ArrowLeft' && hasChildren && isExpanded) {
      toggleMenuExpansion(menuId);
    }
  };

  // ---------------------------------------------------------------------
  // Left panel: tree
  // ---------------------------------------------------------------------
  const ROW_GRID =
    'grid grid-cols-[minmax(0,1fr)_96px_32px] items-center gap-2';

  const renderTreeRow = (node: MenuPermissionNode, level: number) => {
    const full = nodeById.get(node.menu_id) ?? node;
    const hasChildren = !!node.children && node.children.length > 0;
    const isExpanded = expandedMenus.has(node.menu_id);
    const isSelected = selectedMenuId === node.menu_id;
    const allowed = full.permissions.can_view;
    const isModified = modifiedIds.has(node.menu_id);

    return (
      <React.Fragment key={node.menu_id}>
        <div
          role="treeitem"
          aria-level={level + 1}
          aria-selected={isSelected}
          aria-expanded={hasChildren ? isExpanded : undefined}
          tabIndex={0}
          onClick={() => setSelectedMenuId(node.menu_id)}
          onKeyDown={(e) =>
            onRowKeyDown(e, node.menu_id, hasChildren, isExpanded)
          }
          style={{ paddingLeft: 12 + level * 28 }}
          className={`${ROW_GRID} cursor-pointer border-b py-2 pr-3 transition-colors ${
            t.line
          } ${
            isSelected
              ? `${t.selected} shadow-[inset_3px_0_0_0_#2563eb]`
              : t.hover
          } ${FOCUS} focus-visible:ring-inset`}
        >
          <div className="flex min-w-0 items-center gap-2">
            {hasChildren ? (
              <button
                type="button"
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${
                  node.menu_name
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMenuExpansion(node.menu_id);
                }}
                className={`grid h-6 w-6 shrink-0 place-items-center rounded ${t.muted} ${t.hover} ${FOCUS}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="h-6 w-6 shrink-0" />
            )}

            {hasChildren ? (
              <TriCheckbox
                state={accessStateOf(full)}
                label={`Allow access to ${node.menu_name} and its sub menus`}
                onChange={(next) => handleAccessChange(node.menu_id, next)}
              />
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}

            {hasChildren ? (
              <Folder className="h-4 w-4 shrink-0 text-blue-600" />
            ) : (
              <FileText className={`h-4 w-4 shrink-0 ${t.muted}`} />
            )}

            <span
              className={`truncate text-sm ${
                hasChildren ? 'font-semibold' : 'font-medium'
              } ${t.text}`}
              title={node.menu_url || node.menu_name}
            >
              {node.menu_name}
            </span>

            {isModified && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                title="Unsaved changes"
                aria-label="Unsaved changes"
              />
            )}
          </div>

          <div>
            <AccessPill
              allowed={allowed}
              name={node.menu_name}
              onToggle={() => handleAccessChange(node.menu_id, !allowed)}
            />
          </div>

          <MoreMenu
            label={`More actions for ${node.menu_name}`}
            triggerClassName={`grid h-8 w-8 place-items-center rounded-lg ${t.muted} ${t.hover} ${FOCUS}`}
            trigger={<MoreHorizontal className="h-4 w-4" />}
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    setSelectedMenuId(node.menu_id);
                    close();
                  }}
                >
                  Manage permissions
                </MenuItem>
                <PermissionGuard
                  menuId={ROLE_PERMISSIONS_MENU_ID}
                  action="edit"
                >
                  <MenuItem
                    onClick={() => {
                      handleAccessChange(node.menu_id, true);
                      close();
                    }}
                  >
                    Allow{hasChildren ? ' with sub menus' : ''}
                  </MenuItem>
                  <MenuItem
                    danger
                    onClick={() => {
                      handleAccessChange(node.menu_id, false);
                      close();
                    }}
                  >
                    Revoke{hasChildren ? ' with sub menus' : ''}
                  </MenuItem>
                </PermissionGuard>
              </>
            )}
          </MoreMenu>
        </div>

        {hasChildren &&
          isExpanded &&
          node.children!.map((child) => renderTreeRow(child, level + 1))}
      </React.Fragment>
    );
  };

  // ---------------------------------------------------------------------
  // Right panel: tabs
  // ---------------------------------------------------------------------
  const renderPermissionsTab = (node: MenuPermissionNode) => {
    const isGroup = !!node.children && node.children.length > 0;
    const features = (node.children ?? []).filter((c) =>
      featureSearch.trim()
        ? c.menu_name.toLowerCase().includes(featureSearch.toLowerCase())
        : true
    );

    return (
      <div className="space-y-5 p-5">
        {/* Menu access */}
        <section className={`rounded-xl border ${t.lineStrong}`}>
          <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
            <div>
              <h3 className={`text-sm font-semibold ${t.text}`}>Menu access</h3>
              <p className={`mt-0.5 text-xs ${t.muted}`}>
                Control what actions are allowed for this{' '}
                {isGroup ? 'menu group' : 'menu'}.
              </p>
            </div>
            <PermissionGuard menuId={ROLE_PERMISSIONS_MENU_ID} action="edit">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setMenuPermissions(node.menu_id, ALL_PERMISSIONS)
                  }
                  className={`rounded-md px-2 py-1 text-xs font-medium text-blue-600 ${t.hover} ${FOCUS}`}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMenuPermissions(node.menu_id, NO_PERMISSIONS)
                  }
                  className={`rounded-md px-2 py-1 text-xs font-medium ${t.muted} ${t.hover} ${FOCUS}`}
                >
                  Clear
                </button>
              </div>
            </PermissionGuard>
          </div>

          <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
            {TOGGLE_GRID_ORDER.map((key) => {
              const { label, icon: Icon } = PERMISSION_META[key];
              return (
                <div
                  key={key}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${t.lineStrong}`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.chipIcon}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={`truncate text-sm font-medium ${t.text}`}>
                      {label}
                    </span>
                  </span>
                  <Toggle
                    checked={node.permissions[key]}
                    label={`${label} for ${node.menu_name}`}
                    onChange={(v) =>
                      handlePermissionChange(node.menu_id, key, v)
                    }
                  />
                </div>
              );
            })}
          </div>

          {isGroup && (
            <PermissionGuard menuId={ROLE_PERMISSIONS_MENU_ID} action="edit">
              <div
                className={`flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 ${t.line}`}
              >
                <span className={`text-xs ${t.muted}`}>
                  Sub menus keep their own permissions unless you apply these.
                </span>
                <button
                  type="button"
                  onClick={() => applyToSubMenus(node.menu_id)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${t.btn} ${FOCUS}`}
                >
                  Apply to all sub menus
                </button>
              </div>
            </PermissionGuard>
          )}
        </section>

        {/* Page / feature access */}
        {isGroup && (
          <section className={`rounded-xl border ${t.lineStrong}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
              <div>
                <h3 className={`text-sm font-semibold ${t.text}`}>
                  Page / feature access
                </h3>
                <p className={`mt-0.5 text-xs ${t.muted}`}>
                  Grant access to specific features within this menu group.
                </p>
              </div>
              <div className="relative w-full sm:w-52">
                <Search
                  className={`pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`}
                />
                <input
                  type="text"
                  value={featureSearch}
                  onChange={(e) => setFeatureSearch(e.target.value)}
                  placeholder="Search feature..."
                  aria-label="Search features"
                  className={`w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm ${t.input} ${FOCUS}`}
                />
              </div>
            </div>

            <div
              className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_32px] gap-3 border-y px-4 py-2 text-xs font-medium ${t.inset} ${t.muted}`}
            >
              <span>Feature / page</span>
              <span>Permission</span>
              <span />
            </div>

            {features.length === 0 ? (
              <p className={`px-4 py-6 text-center text-sm ${t.muted}`}>
                No features match "{featureSearch}".
              </p>
            ) : (
              features.map((f) => {
                const labels = grantedLabels(f.permissions);
                const isEditing = editingFeatureId === f.menu_id;
                return (
                  <div
                    key={f.menu_id}
                    className={`border-b last:border-b-0 ${t.line}`}
                  >
                    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_32px] items-center gap-3 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.chipIcon}`}
                        >
                          {f.children && f.children.length > 0 ? (
                            <Folder className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div
                            className={`truncate text-sm font-medium ${t.text}`}
                          >
                            {f.menu_name}
                          </div>
                          <div className={`truncate text-xs ${t.muted}`}>
                            {f.menu_url || f.menu_key}
                          </div>
                        </div>
                      </div>

                      <div>
                        {labels.length > 0 ? (
                          <span
                            className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${t.summaryChip}`}
                          >
                            {labels.join(', ')}
                          </span>
                        ) : (
                          <span
                            className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${t.denied}`}
                          >
                            No access
                          </span>
                        )}
                      </div>

                      <MoreMenu
                        label={`Actions for ${f.menu_name}`}
                        triggerClassName={`grid h-8 w-8 place-items-center rounded-lg ${t.muted} ${t.hover} ${FOCUS}`}
                        trigger={<MoreVertical className="h-4 w-4" />}
                      >
                        {(close) => (
                          <>
                            <PermissionGuard
                              menuId={ROLE_PERMISSIONS_MENU_ID}
                              action="edit"
                            >
                              <MenuItem
                                onClick={() => {
                                  setEditingFeatureId(
                                    isEditing ? null : f.menu_id
                                  );
                                  close();
                                }}
                              >
                                {isEditing
                                  ? 'Close editor'
                                  : 'Edit permissions'}
                              </MenuItem>
                              <MenuItem
                                onClick={() => {
                                  setMenuPermissions(
                                    f.menu_id,
                                    ALL_PERMISSIONS
                                  );
                                  close();
                                }}
                              >
                                Allow all actions
                              </MenuItem>
                              <MenuItem
                                danger
                                onClick={() => {
                                  setMenuPermissions(f.menu_id, NO_PERMISSIONS);
                                  close();
                                }}
                              >
                                Revoke all actions
                              </MenuItem>
                            </PermissionGuard>
                            <MenuItem
                              onClick={() => {
                                setSelectedMenuId(f.menu_id);
                                close();
                              }}
                            >
                              Open menu
                            </MenuItem>
                          </>
                        )}
                      </MoreMenu>
                    </div>

                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.12 }}
                        className={`flex flex-wrap gap-2 border-t px-4 py-3 ${t.line} ${t.inset}`}
                      >
                        {PERMISSION_KEYS.map((key) => {
                          const on = f.permissions[key];
                          const Icon = PERMISSION_META[key].icon;
                          return (
                            <button
                              key={key}
                              type="button"
                              aria-pressed={on}
                              onClick={() =>
                                handlePermissionChange(f.menu_id, key, !on)
                              }
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                on
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : `${t.btn}`
                              } ${FOCUS}`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {PERMISSION_META[key].short}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* Additional permissions */}
        <section>
          <h3 className={`mb-2 text-sm font-semibold ${t.text}`}>
            Additional permissions
          </h3>
          <div
            className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs ${t.inset} ${t.muted}`}
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <span>
              Some menus may have additional permissions based on the
              application settings and user group policies.
            </span>
          </div>
        </section>
      </div>
    );
  };

  const renderSubMenusTab = (node: MenuPermissionNode) => (
    <div className="p-5">
      <ul className={`divide-y rounded-xl border ${t.lineStrong} ${t.line}`}>
        {(node.children ?? []).map((child) => {
          const allowed = child.permissions.can_view;
          return (
            <li
              key={child.menu_id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.chipIcon}`}
              >
                {child.children && child.children.length > 0 ? (
                  <Folder className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm font-medium ${t.text}`}>
                  {child.menu_name}
                </div>
                <div className={`truncate text-xs ${t.muted}`}>
                  {grantedLabels(child.permissions).join(', ') || 'No actions'}
                </div>
              </div>
              <AccessPill
                allowed={allowed}
                name={child.menu_name}
                onToggle={() => handleAccessChange(child.menu_id, !allowed)}
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedMenuId(child.menu_id);
                  setActiveTab('permissions');
                }}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${t.btn} ${FOCUS}`}
              >
                Manage
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const renderDetailsTab = (node: MenuPermissionNode) => {
    const rows: [string, string][] = [
      ['Name', node.menu_name],
      ['Key', node.menu_key],
      ['URL', node.menu_url || 'None'],
      ['Icon', node.menu_icon || 'None'],
      ['Menu ID', String(node.menu_id)],
      [
        'Parent',
        node.parent_id != null
          ? (nodeById.get(node.parent_id)?.menu_name ?? `ID ${node.parent_id}`)
          : 'Top level',
      ],
      [
        'Type',
        node.children && node.children.length > 0 ? 'Menu group' : 'Menu',
      ],
    ];
    return (
      <dl className="p-5">
        <div className={`divide-y rounded-xl border ${t.lineStrong} ${t.line}`}>
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-3"
            >
              <dt className={`text-sm ${t.muted}`}>{label}</dt>
              <dd className={`break-all text-sm font-medium ${t.text}`}>
                {value}
              </dd>
            </div>
          ))}
        </div>
      </dl>
    );
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  if (menuIdsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className={`h-8 w-8 animate-spin ${t.muted}`} />
      </div>
    );
  }

  const role = selectedRole as RoleDetails | null;
  const lastUpdated = role?.updated_at
    ? new Date(role.updated_at).toLocaleString()
    : null;

  const subMenuCount = selectedNode?.children?.length ?? 0;
  const isSelectedGroup = subMenuCount > 0;
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'permissions', label: 'Permissions' },
    ...(isSelectedGroup
      ? [{ id: 'submenus' as DetailTab, label: `Sub menus (${subMenuCount})` }]
      : []),
    { id: 'details', label: 'Details' },
  ];
  const currentTab = tabs.some((x) => x.id === activeTab)
    ? activeTab
    : 'permissions';
  const selectedAllowed = !!selectedNode?.permissions.can_view;
  const selectedModified = selectedNode
    ? flattenTree([selectedNode]).some((n) => modifiedIds.has(n.menu_id))
    : false;

  return (
    <PermissionGuard
      menuId={ROLE_PERMISSIONS_MENU_ID}
      action="view"
      fallback={
        <div className={`py-20 text-center ${t.text}`}>
          <Shield className="mx-auto mb-4 h-16 w-16 text-red-400" />
          <h2 className="mb-2 text-2xl font-bold">Access denied</h2>
          <p className="text-gray-500">
            You don't have permission to view role permissions.
          </p>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Page header */}
        <header>
          <h1 className={`text-2xl font-bold tracking-tight ${t.text}`}>
            Role &amp; Menu Management
          </h1>
          <p className={`mt-1 text-sm ${t.muted}`}>
            Manage role groups and configure fine-grained menu permissions for
            each role group.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {error}. Check your connection and try again.
            </span>
            <button
              type="button"
              onClick={retry}
              className={`rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 ${FOCUS}`}
            >
              Retry
            </button>
          </div>
        )}

        {/* Role group selector */}
        <section
          className={`grid items-center gap-4 rounded-2xl border p-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)_auto] ${t.card}`}
        >
          <div>
            <label
              htmlFor="role-group-select"
              className={`mb-1.5 block text-sm font-semibold ${t.text}`}
            >
              Role group
            </label>
            <div className="relative">
              <Users
                className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`}
              />
              <select
                id="role-group-select"
                value={selectedRole?.id ?? ''}
                onChange={(e) => handleRoleChange(parseInt(e.target.value, 10))}
                className={`w-full cursor-pointer appearance-none rounded-lg border py-2.5 pl-9 pr-9 text-sm font-medium ${t.input} ${FOCUS}`}
              >
                {roles.map((r) => (
                  <option
                    key={r.id}
                    value={r.id}
                    className={theme === 'dark' ? 'bg-slate-800' : 'bg-white'}
                  >
                    {r.role_name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`}
              />
            </div>
            {role && (
              <p className={`mt-1.5 text-xs ${t.muted}`}>
                {role.user_count !== undefined && `${role.user_count} users, `}
                {role.is_active ? 'Active' : 'Inactive'}
              </p>
            )}
          </div>

          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${t.inset}`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.chipIcon}`}
            >
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${t.text}`}>
                {role?.role_name ?? 'No role group selected'}
              </div>
              <p className={`mt-0.5 text-sm ${t.muted}`}>
                {role?.description || 'No description provided.'}
              </p>
            </div>
          </div>

          {onManageRoles && (
            <button
              type="button"
              onClick={onManageRoles}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium ${t.btn} ${FOCUS}`}
            >
              <Users className="h-4 w-4" />
              Manage role groups
            </button>
          )}
        </section>

        {/* Master / detail */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* Left: menu tree */}
          <section className={`rounded-2xl border ${t.card}`}>
            <div className="flex flex-wrap items-center gap-2 p-4">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search menu or menu group..."
                  aria-label="Search menus"
                  className={`w-full rounded-lg border py-2.5 pl-9 pr-9 text-sm ${t.input} ${FOCUS}`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    aria-label="Clear search"
                    className={`absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full ${t.muted} ${t.hover} ${FOCUS}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {onCreateMenu && (
                <button
                  type="button"
                  onClick={onCreateMenu}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium text-blue-600 ${t.btn} ${FOCUS}`}
                >
                  <Plus className="h-4 w-4" />
                  Create menu
                </button>
              )}
              {onUploadMenu && (
                <button
                  type="button"
                  onClick={onUploadMenu}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium text-blue-600 ${t.btn} ${FOCUS}`}
                >
                  <Upload className="h-4 w-4" />
                  Upload menu
                </button>
              )}

              <MoreMenu
                label="View options and bulk actions"
                width={288}
                triggerClassName={`grid h-10 w-11 place-items-center rounded-lg border ${t.btn} ${FOCUS}`}
                trigger={<MoreHorizontal className="h-4 w-4" />}
              >
                {(close) => (
                  <>
                    <MenuItem
                      onClick={() => {
                        toggleAllMenus();
                        close();
                      }}
                    >
                      {allExpanded
                        ? 'Collapse all groups'
                        : 'Expand all groups'}
                    </MenuItem>
                    <MenuItem
                      checked={showOnlyAssigned}
                      onClick={() => setShowOnlyAssigned((v) => !v)}
                    >
                      Show only assigned permissions
                    </MenuItem>

                    <PermissionGuard
                      menuId={ROLE_PERMISSIONS_MENU_ID}
                      action="edit"
                    >
                      <div
                        className={`mt-1.5 border-t px-2.5 pb-1 pt-2.5 ${t.line}`}
                      >
                        <div className="text-xs font-semibold">
                          Bulk actions
                        </div>
                        <div className={`text-xs ${t.muted}`}>
                          Applies to {filteredFlatList.length} visible menu
                          {filteredFlatList.length === 1 ? '' : 's'}
                        </div>
                      </div>
                      {PERMISSION_KEYS.map((key) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5"
                        >
                          <span className="text-sm">
                            {PERMISSION_META[key].short}
                          </span>
                          <span className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleBulkPermissionChange(
                                  filteredFlatList.map((p) => p.menu_id),
                                  key,
                                  true
                                )
                              }
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${t.allowed} ${FOCUS}`}
                            >
                              Grant
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleBulkPermissionChange(
                                  filteredFlatList.map((p) => p.menu_id),
                                  key,
                                  false
                                )
                              }
                              className={`rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200 ${FOCUS}`}
                            >
                              Revoke
                            </button>
                          </span>
                        </div>
                      ))}
                    </PermissionGuard>
                  </>
                )}
              </MoreMenu>
            </div>

            <div
              className={`${ROW_GRID} border-y py-2 pl-3 pr-3 text-xs font-medium ${t.inset} ${t.muted}`}
            >
              <span>Menu / menu group</span>
              <span>Access</span>
              <span />
            </div>

            <div
              role="tree"
              aria-label="Menus"
              aria-busy={loading}
              className="max-h-[calc(100vh-22rem)] min-h-[320px] overflow-y-auto"
            >
              {loading && permissionTree.length === 0 ? (
                <div className="space-y-2 p-4" aria-hidden="true">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-9 animate-pulse rounded-lg ${t.skeleton}`}
                      style={{ marginLeft: i % 3 === 0 ? 0 : 28 }}
                    />
                  ))}
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                  <Shield className={`h-10 w-10 ${t.muted}`} />
                  <p className={`text-sm ${t.muted}`}>
                    {searchTerm
                      ? `No menus match "${searchTerm}".`
                      : showOnlyAssigned
                        ? 'No menus have permissions assigned yet.'
                        : 'No menus found for this role group.'}
                  </p>
                  {(searchTerm || showOnlyAssigned) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setShowOnlyAssigned(false);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${t.btn} ${FOCUS}`}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                filteredTree.map((node) => renderTreeRow(node, 0))
              )}
            </div>
          </section>

          {/* Right: selected menu detail */}
          <section
            className={`rounded-2xl border lg:sticky lg:top-4 ${t.card}`}
            aria-label="Selected menu permissions"
          >
            {!selectedNode ? (
              <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                <Folder className={`h-10 w-10 ${t.muted}`} />
                <p className={`text-sm ${t.muted}`}>
                  Select a menu to manage its permissions.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 p-5">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.chipIcon}`}
                  >
                    {isSelectedGroup ? (
                      <Folder className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2
                      className={`truncate text-base font-semibold ${t.text}`}
                    >
                      {selectedNode.menu_name}
                    </h2>
                    <p className={`text-xs ${t.muted}`}>
                      {isSelectedGroup ? 'Menu group' : 'Menu'}
                      {isSelectedGroup &&
                        `, ${subMenuCount} sub menu${
                          subMenuCount === 1 ? '' : 's'
                        }`}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                      selectedAllowed ? t.allowed : t.denied
                    }`}
                  >
                    {selectedAllowed ? 'Allowed' : 'Not allowed'}
                  </span>
                  <button
                    type="button"
                    onClick={() => resetMenu(selectedNode.menu_id)}
                    disabled={!selectedModified}
                    title="Undo unsaved changes for this menu"
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${t.btn} ${FOCUS}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                </div>

                <div
                  role="tablist"
                  aria-label="Menu settings"
                  className={`flex gap-6 border-b px-5 ${t.lineStrong}`}
                >
                  {tabs.map((tab) => {
                    const active = currentTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        id={`tab-${tab.id}`}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        aria-controls={`panel-${tab.id}`}
                        onClick={() => setActiveTab(tab.id)}
                        className={`-mb-px border-b-2 py-3 text-sm font-medium transition-colors ${
                          active
                            ? 'border-blue-600 text-blue-600'
                            : `border-transparent ${t.muted} hover:text-blue-600`
                        } ${FOCUS}`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <motion.div
                  key={`${selectedNode.menu_id}-${currentTab}`}
                  id={`panel-${currentTab}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${currentTab}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12 }}
                  className="max-h-[calc(100vh-20rem)] overflow-y-auto"
                >
                  {currentTab === 'permissions' &&
                    renderPermissionsTab(selectedNode)}
                  {currentTab === 'submenus' && renderSubMenusTab(selectedNode)}
                  {currentTab === 'details' && renderDetailsTab(selectedNode)}
                </motion.div>
              </>
            )}
          </section>
        </div>

        {/* Sticky action bar */}
        <div
          className={`sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3 backdrop-blur ${t.card}`}
        >
          <div className={`text-xs ${t.muted}`} aria-live="polite">
            {hasChanges ? (
              <span className="inline-flex items-center gap-2 font-medium text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {modifiedIds.size} menu{modifiedIds.size === 1 ? '' : 's'} with
                unsaved changes
              </span>
            ) : lastUpdated ? (
              <>
                Last updated: {lastUpdated}
                {role?.updated_by && ` by ${role.updated_by}`}
              </>
            ) : (
              'All changes saved'
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={discardChanges}
              disabled={!hasChanges || saving}
              className={`rounded-lg border px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${t.btn} ${FOCUS}`}
            >
              Cancel
            </button>
            <PermissionGuard menuId={ROLE_PERMISSIONS_MENU_ID} action="edit">
              <button
                type="button"
                onClick={savePermissions}
                disabled={!hasChanges || saving}
                className={`inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS} focus-visible:ring-offset-2`}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save changes
              </button>
            </PermissionGuard>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default SecureRoleMenuPermissions;
