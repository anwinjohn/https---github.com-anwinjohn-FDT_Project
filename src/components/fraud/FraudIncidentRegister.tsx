import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Plus,
  Pencil,
  Eye,
  RefreshCw,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Repeat,
  Lock,
  Clock,
  FileText,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMenuIds } from '../../hooks/useMenuIds';
import { useNotifications } from '../notifications';
import PermissionGuard from '../PermissionGuard';
import apiClient from '../../utils/apiClient';

// ===========================================================================
// 1. Contract with the back-end  (adjust paths here only)
// ===========================================================================

const API = {
  list: '/fraud-incidents', //                 GET  (paged)  | POST (create)
  one: (id: string) => `/fraud-incidents/${encodeURIComponent(id)}`, // PUT (update)
  status: (id: string) => `/fraud-incidents/${encodeURIComponent(id)}/status`, // PATCH
  lookups: '/fraud-incidents/lookups', //      GET  -> { <lookupKey>: Option[] | string[] }
  export: '/fraud-incidents/export', //        GET  -> CSV blob (same filter params as list)
};
const MENU_KEY = 'fraud_incidents';
const CURRENCY = 'AED';

// ===========================================================================
// 2. Types
// ===========================================================================

type LookupKey =
  | 'fraud_category'
  | 'root_cause_identified'
  | 'detection_method'
  | 'recovery_status'
  | 'insured'
  | 'investigation_status'
  | 'bsd_required'
  | 'police_required';

interface Option {
  value: string;
  label: string;
  /** Only meaningful for investigation_status: marks a terminal status. */
  is_closed?: boolean;
  /** investigation_status only: position in the workflow (1 = first). */
  order?: number;
  /** investigation_status only: fields that must be filled once this status (or a later one) is selected. */
  requires?: FieldKey[];
}
type Lookups = Record<LookupKey, Option[]>;

type FieldKey =
  | 'incident_date'
  | 'internal_ref_no'
  | 'fraud_category'
  | 'description'
  | 'root_cause_identified'
  | 'root_cause'
  | 'detection_method'
  | 'parties_involved'
  | 'loss_amount'
  | 'recovered_amount'
  | 'recovery_status'
  | 'insured'
  | 'insurance_claim_ref'
  | 'investigation_status'
  | 'investigation_outcome'
  | 'bsd_required'
  | 'bsd_reported_date'
  | 'police_required'
  | 'police_reported_date'
  | 'goaml_reported_date'
  | 'goaml_ref_no'
  | 'board_notified_date'
  | 'closure_date'
  | 'lessons_learned'
  | 'disciplinary_action'
  | 'corrective_action'
  | 'action_owner'
  | 'target_completion_date';

type FormState = Record<FieldKey, string>;

interface FraudIncident {
  id: string;
  /** Optimistic-concurrency token. Echoed back on update / status change. */
  version?: number | string;
  date_recorded: string; // auto, server-set
  created_by?: string;
  updated_at?: string;
  incident_date: string;
  internal_ref_no: string;
  fraud_category: string;
  description: string;
  root_cause_identified: string;
  root_cause: string | null;
  detection_method: string;
  parties_involved: string;
  loss_amount: number;
  recovered_amount: number;
  recovery_status: string;
  insured: string;
  insurance_claim_ref: string | null;
  investigation_status: string;
  investigation_outcome: string | null;
  bsd_required: string;
  bsd_reported_date: string | null;
  police_required: string;
  police_reported_date: string | null;
  goaml_reported_date: string | null;
  goaml_ref_no: string | null;
  board_notified_date: string | null;
  closure_date: string | null;
  lessons_learned: string | null;
  disciplinary_action: string | null;
  corrective_action: string | null;
  action_owner: string | null;
  target_completion_date: string | null;
}

interface ListResponse {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  data: FraudIncident[];
  summary?: {
    open?: number;
    closed?: number;
    total_loss?: number;
    total_recovered?: number;
  };
}

type SortField =
  | 'date_recorded'
  | 'incident_date'
  | 'loss_amount'
  | 'investigation_status'
  | 'target_completion_date';
type SortOrder = 'ASC' | 'DESC';
type Density = 'comfortable' | 'compact';
type View = 'all' | 'mine';

interface Props {
  /** Signed-in user id (from your auth context). Back-end must still trust the token, not this. */
  currentUserId?: string;
}

// ===========================================================================
// 3. Field definitions — the single source of truth for form, validation,
//    export. Change a label / rule here and everything follows.
//
//    req: 'register' -> the minimum needed to log an incident (stage 1)
//         'close'    -> can be filled in later; required once the status is a closed one
//         'none'     -> optional
//    Intermediate stages are API-driven: an investigation_status option may carry
//    `order` and `requires: FieldKey[]`, enforced when that status (or a later one) is selected.
// ===========================================================================

type Section =
  | 'incident'
  | 'cause'
  | 'financial'
  | 'investigation'
  | 'reporting'
  | 'closure';

interface FieldDef {
  key: FieldKey;
  label: string;
  section: Section;
  type: 'text' | 'textarea' | 'date' | 'number' | 'select';
  lookup?: LookupKey;
  req: 'register' | 'close' | 'none';
  full?: boolean; // spans both columns
  max?: number;
  hint?: string;
}

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'incident', label: 'Incident' },
  { key: 'cause', label: 'Cause & detection' },
  { key: 'financial', label: 'Financial impact' },
  { key: 'investigation', label: 'Investigation' },
  { key: 'reporting', label: 'Regulatory reporting' },
  { key: 'closure', label: 'Closure & remediation' },
];

const FIELDS: FieldDef[] = [
  // Incident
  {
    key: 'incident_date',
    label: 'Date of Fraud Incident',
    section: 'incident',
    type: 'date',
    req: 'register',
  },
  {
    key: 'internal_ref_no',
    label: 'Incident Internal Reference No.',
    section: 'incident',
    type: 'text',
    req: 'register',
    max: 50,
  },
  {
    key: 'fraud_category',
    label: 'Fraud Category / Type',
    section: 'incident',
    type: 'select',
    lookup: 'fraud_category',
    req: 'register',
  },
  {
    key: 'parties_involved',
    label: 'Parties Involved',
    section: 'incident',
    type: 'text',
    req: 'close',
    max: 300,
  },
  {
    key: 'description',
    label: 'Brief Description of the Fraud Incident',
    section: 'incident',
    type: 'textarea',
    req: 'register',
    full: true,
    max: 2000,
  },
  // Cause & detection
  {
    key: 'root_cause_identified',
    label: 'Root Cause Identified',
    section: 'cause',
    type: 'select',
    lookup: 'root_cause_identified',
    req: 'close',
  },
  {
    key: 'detection_method',
    label: 'Detection Method',
    section: 'cause',
    type: 'select',
    lookup: 'detection_method',
    req: 'close',
  },
  {
    key: 'root_cause',
    label: 'Root Cause',
    section: 'cause',
    type: 'textarea',
    req: 'close',
    full: true,
    max: 2000,
  },
  // Financial
  {
    key: 'loss_amount',
    label: `Amount of Loss (${CURRENCY})`,
    section: 'financial',
    type: 'number',
    req: 'close',
  },
  {
    key: 'recovered_amount',
    label: `Amount Recovered (${CURRENCY})`,
    section: 'financial',
    type: 'number',
    req: 'close',
    hint: 'Cannot exceed the amount of loss',
  },
  {
    key: 'recovery_status',
    label: 'Recovery Status',
    section: 'financial',
    type: 'select',
    lookup: 'recovery_status',
    req: 'close',
  },
  {
    key: 'insured',
    label: 'Loss Covered by Insurance',
    section: 'financial',
    type: 'select',
    lookup: 'insured',
    req: 'close',
  },
  {
    key: 'insurance_claim_ref',
    label: 'Insurance Claim Ref. No.',
    section: 'financial',
    type: 'text',
    req: 'close',
    max: 50,
    hint: 'NA when not insured',
  },
  // Investigation
  {
    key: 'investigation_status',
    label: 'Investigation Status',
    section: 'investigation',
    type: 'select',
    lookup: 'investigation_status',
    req: 'none',
    hint: 'Moving to a later status can require more fields',
  },
  {
    key: 'investigation_outcome',
    label: 'Investigation Outcome',
    section: 'investigation',
    type: 'textarea',
    req: 'close',
    full: true,
    max: 2000,
  },
  // Reporting
  {
    key: 'bsd_required',
    label: 'BSD Reporting Required',
    section: 'reporting',
    type: 'select',
    lookup: 'bsd_required',
    req: 'close',
  },
  {
    key: 'bsd_reported_date',
    label: 'Date Reported to BSD',
    section: 'reporting',
    type: 'date',
    req: 'close',
    hint: 'NA when BSD reporting is not required',
  },
  {
    key: 'police_required',
    label: 'Police Authorities Reporting Required',
    section: 'reporting',
    type: 'select',
    lookup: 'police_required',
    req: 'close',
  },
  {
    key: 'police_reported_date',
    label: 'Date Reported to Police Authorities',
    section: 'reporting',
    type: 'date',
    req: 'close',
    hint: 'NA when police reporting is not required',
  },
  {
    key: 'goaml_reported_date',
    label: 'FID (GoAML) Reporting Date',
    section: 'reporting',
    type: 'date',
    req: 'none',
  },
  {
    key: 'goaml_ref_no',
    label: 'FID (GoAML) Reporting Ref. No.',
    section: 'reporting',
    type: 'text',
    req: 'none',
    max: 50,
    hint: 'Required once a GoAML date is entered',
  },
  {
    key: 'board_notified_date',
    label: 'Board of Directors Notification',
    section: 'reporting',
    type: 'date',
    req: 'close',
  },
  // Closure
  {
    key: 'closure_date',
    label: 'Incident Closure Date',
    section: 'closure',
    type: 'date',
    req: 'close',
  },
  {
    key: 'target_completion_date',
    label: 'Target Completion Date',
    section: 'closure',
    type: 'date',
    req: 'close',
  },
  {
    key: 'action_owner',
    label: 'Action Owner',
    section: 'closure',
    type: 'text',
    req: 'close',
    max: 200,
  },
  {
    key: 'lessons_learned',
    label: 'Lessons Learned / Control Improvements Implemented',
    section: 'closure',
    type: 'textarea',
    req: 'close',
    full: true,
    max: 2000,
  },
  {
    key: 'disciplinary_action',
    label: 'Disciplinary Action Taken',
    section: 'closure',
    type: 'textarea',
    req: 'close',
    full: true,
    max: 2000,
  },
  {
    key: 'corrective_action',
    label: 'Corrective Action Required',
    section: 'closure',
    type: 'textarea',
    req: 'close',
    full: true,
    max: 2000,
  },
];

const FIELD_BY_KEY = Object.fromEntries(
  FIELDS.map((f) => [f.key, f])
) as Record<FieldKey, FieldDef>;
const SECTION_OF = (k: FieldKey) => FIELD_BY_KEY[k].section;

// "NA" rules: the field is not applicable (disabled, saved as null) when…
const isNo = (v: string) => /^(n|no|false|0)$/i.test((v || '').trim());
const isYes = (v: string) => /^(y|yes|true|1)$/i.test((v || '').trim());
function isNA(key: FieldKey, f: FormState): boolean {
  switch (key) {
    case 'bsd_reported_date':
      return isNo(f.bsd_required);
    case 'police_reported_date':
      return isNo(f.police_required);
    case 'insurance_claim_ref':
      return isNo(f.insured);
    default:
      return false;
  }
}

// ===========================================================================
// 4. Pure helpers (dates, money, validation, mapping)
// ===========================================================================

const pad2 = (n: number) => String(n).padStart(2, '0');
// Local-time date — toISOString() is UTC and gives "yesterday" early in the day in UTC+ zones.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const validDate = (s?: string | null) =>
  !!s && !Number.isNaN(new Date(s).getTime());
// Date-only strings ("2026-11-14") are parsed as LOCAL dates; `new Date(str)` would read them as UTC
// and show the previous day in time zones behind UTC.
const asLocalDate = (s: string) => {
  const p = parseISO(s);
  return p ? new Date(p.y, p.m, p.d) : new Date(s);
};
const fmtDate = (s?: string | null) =>
  validDate(s)
    ? asLocalDate(s as string).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : '—';
const fmtDateTime = (s?: string | null) =>
  validDate(s) ? new Date(s as string).toLocaleString() : '—';
const moneyFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtMoney = (n?: number | null) =>
  typeof n === 'number' && !Number.isNaN(n) ? moneyFmt.format(n) : '—';

const emptyForm = (): FormState => {
  const f = Object.fromEntries(FIELDS.map((d) => [d.key, ''])) as FormState;
  return f;
};

function formFromIncident(i: FraudIncident): FormState {
  const f = emptyForm();
  FIELDS.forEach((d) => {
    const v = i[d.key as keyof FraudIncident];
    f[d.key] = v === null || v === undefined ? '' : String(v);
  });
  return f;
}

function payloadFromForm(f: FormState): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  FIELDS.forEach((d) => {
    if (isNA(d.key, f)) {
      out[d.key] = null;
      return;
    }
    const raw = (f[d.key] ?? '').trim();
    if (d.type === 'number') out[d.key] = raw === '' ? null : Number(raw);
    else out[d.key] = raw === '' ? null : raw;
  });
  return out;
}

function normalizeOptions(raw: unknown): Option[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o): Option | null => {
      if (typeof o === 'string') return { value: o, label: o };
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        const value = String(r.value ?? r.id ?? r.code ?? '');
        if (!value) return null;
        return {
          value,
          label: String(r.label ?? r.name ?? r.description ?? value),
          is_closed: typeof r.is_closed === 'boolean' ? r.is_closed : undefined,
          order: typeof r.order === 'number' ? r.order : undefined,
          requires: Array.isArray(r.requires)
            ? (r.requires
                .map(String)
                .filter((k: string) => k in FIELD_BY_KEY) as FieldKey[])
            : undefined,
        };
      }
      return null;
    })
    .filter((x): x is Option => x !== null);
}

const YES_NO: Option[] = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];
const EMPTY_LOOKUPS: Lookups = {
  fraud_category: [],
  root_cause_identified: [],
  detection_method: [],
  recovery_status: [],
  insured: YES_NO,
  investigation_status: [],
  bsd_required: YES_NO,
  police_required: YES_NO,
};

const labelOf = (opts: Option[], value?: string | null) =>
  opts.find((o) => o.value === value)?.label ?? (value || '—');

function isClosedStatus(value: string, opts: Option[]): boolean {
  const o = opts.find((x) => x.value === value);
  if (o?.is_closed !== undefined) return o.is_closed;
  return /clos|complete|resolved/i.test(o?.label ?? value ?? '');
}

type Errors = Partial<Record<FieldKey, string>>;

const PAST_ONLY: FieldKey[] = [
  'incident_date',
  'bsd_reported_date',
  'police_reported_date',
  'goaml_reported_date',
  'board_notified_date',
  'closure_date',
];
const AFTER_INCIDENT: FieldKey[] = [
  'bsd_reported_date',
  'police_reported_date',
  'goaml_reported_date',
  'board_notified_date',
  'closure_date',
  'target_completion_date',
];

/**
 * Which fields are mandatory *right now* for this record:
 *  1. the registration minimum (always),
 *  2. whatever the selected status — and any earlier status in the workflow — declares in `requires`,
 *  3. everything marked 'close' once the status is a closed one (or `forceClose`, used to count what is
 *     still outstanding before closure).
 */
function requiredKeys(
  f: FormState,
  lookups: Lookups,
  forceClose = false
): Set<FieldKey> {
  const set = new Set<FieldKey>();
  FIELDS.forEach((d) => {
    if (d.req === 'register') set.add(d.key);
  });
  const opts = lookups.investigation_status;
  const sel = opts.find((o) => o.value === f.investigation_status);
  if (forceClose || isClosedStatus(f.investigation_status, opts)) {
    FIELDS.forEach((d) => {
      if (d.req === 'close') set.add(d.key);
    });
  }
  if (sel) {
    opts.forEach((o) => {
      const applies =
        o === sel ||
        (sel.order !== undefined &&
          o.order !== undefined &&
          o.order <= sel.order);
      if (applies) o.requires?.forEach((k) => set.add(k));
    });
  }
  return set;
}

function validate(
  f: FormState,
  lookups: Lookups,
  opts: { forceClose?: boolean } = {}
): Errors {
  const e: Errors = {};
  const closing = isClosedStatus(
    f.investigation_status,
    lookups.investigation_status
  );
  const required = requiredKeys(f, lookups, opts.forceClose);
  const today = todayISO();

  FIELDS.forEach((d) => {
    if (isNA(d.key, f)) return;
    const v = (f[d.key] ?? '').trim();
    if (required.has(d.key) && v === '') {
      e[d.key] =
        d.req === 'register'
          ? 'Required to register the incident'
          : closing || opts.forceClose
            ? 'Required to close this incident'
            : 'Required for the selected status';
      return;
    }
    if (v === '') return;
    if (d.max && v.length > d.max) e[d.key] = `Max ${d.max} characters`;
    if (d.type === 'date' && !validDate(v)) e[d.key] = 'Invalid date';
  });

  // Amounts (optional until a stage asks for them; checked whenever present)
  const hasLoss = f.loss_amount.trim() !== '';
  const hasRec = f.recovered_amount.trim() !== '';
  const loss = hasLoss ? Number(f.loss_amount) : NaN;
  const rec = hasRec ? Number(f.recovered_amount) : NaN;
  if (!e.loss_amount && hasLoss) {
    if (Number.isNaN(loss)) e.loss_amount = 'Enter a valid number';
    else if (loss < 0) e.loss_amount = 'Cannot be negative';
  }
  if (!e.recovered_amount && hasRec) {
    if (Number.isNaN(rec)) e.recovered_amount = 'Enter a valid number';
    else if (rec < 0) e.recovered_amount = 'Cannot be negative';
    else if (hasLoss && !Number.isNaN(loss) && rec > loss)
      e.recovered_amount = 'Cannot exceed the amount of loss';
  }

  // Dates: not in the future, not before the incident
  PAST_ONLY.forEach((k) => {
    if (!e[k] && f[k] && !isNA(k, f) && f[k] > today)
      e[k] = 'Cannot be in the future';
  });
  if (f.incident_date && validDate(f.incident_date)) {
    AFTER_INCIDENT.forEach((k) => {
      if (!e[k] && f[k] && !isNA(k, f) && f[k] < f.incident_date)
        e[k] = 'Cannot be before the incident date';
    });
  }

  // Conditional: the GoAML reference follows the GoAML date
  if (!e.goaml_ref_no && f.goaml_reported_date && !f.goaml_ref_no.trim())
    e.goaml_ref_no = 'Required when a GoAML date is entered';

  return e;
}

function csvCell(v: unknown) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula-injection guard
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportPageCSV(rows: FraudIncident[], lookups: Lookups) {
  const head = ['Date Recorded', ...FIELDS.map((d) => d.label)];
  const lines = [head.map(csvCell).join(',')];
  rows.forEach((r) => {
    const cells = [
      r.date_recorded,
      ...FIELDS.map((d) => {
        const v = r[d.key as keyof FraudIncident];
        if (d.lookup) return labelOf(lookups[d.lookup], v as string);
        return v ?? '';
      }),
    ];
    lines.push(cells.map(csvCell).join(','));
  });
  downloadBlob(
    `﻿${lines.join('\n')}`,
    `fraud-incidents-${Date.now()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

const isCancel = (err: any) =>
  err?.name === 'CanceledError' ||
  err?.name === 'AbortError' ||
  err?.code === 'ERR_CANCELED';

// ===========================================================================
// 5. UI plumbing (tokens, scroll lock, dialog behaviour, portal)
// ===========================================================================

const tokens = (dark: boolean) => ({
  text: dark ? 'text-white' : 'text-gray-900',
  body: dark ? 'text-white/80' : 'text-gray-700',
  muted: dark ? 'text-white/60' : 'text-gray-600',
  faint: dark ? 'text-white/40' : 'text-gray-400',
  line: dark ? 'border-white/10' : 'border-gray-100',
  panel: dark ? 'bg-white/5 border-white/15' : 'bg-white border-gray-200',
  surface: dark ? 'bg-slate-900 border-white/15' : 'bg-white border-gray-200',
  input: dark
    ? 'bg-white/10 border border-white/20 text-white placeholder-white/40'
    : 'bg-white border border-gray-300 text-gray-900 placeholder-gray-400',
  btn: dark
    ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
});
type Tokens = ReturnType<typeof tokens>;

// z-index ladder: everything floating is portaled to <body>; only one dialog is ever open.
const Z_DIALOG = 'z-[100]';
const DENSITY_KEY = 'fraud.incidents.density';
const PAGE_SIZES = [10, 25, 50, 100];

let lockCount = 0;
let lockPrev = '';
function useBodyScrollLock() {
  useEffect(() => {
    if (lockCount === 0) {
      lockPrev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    lockCount++;
    return () => {
      lockCount--;
      if (lockCount === 0) document.body.style.overflow = lockPrev;
    };
  }, []);
}

function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
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
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      prev?.focus?.();
    };
  }, []);
  return ref;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined'
    ? null
    : createPortal(children, document.body);

// ===========================================================================
// 6. Small presentational pieces
// ===========================================================================

function statusStyle(label: string, closed: boolean, dark: boolean) {
  if (closed)
    return dark
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (/progress|investigat|review|ongoing/i.test(label))
    return dark
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-amber-50 text-amber-700 border-amber-200';
  if (/new|open|pending|reported/i.test(label))
    return dark
      ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
      : 'bg-blue-50 text-blue-700 border-blue-200';
  return dark
    ? 'bg-white/10 text-white/70 border-white/20'
    : 'bg-gray-100 text-gray-700 border-gray-300';
}

const Chip: React.FC<{
  on: boolean;
  label: string;
  dark: boolean;
  title: string;
}> = ({ on, label, dark, title }) => (
  <span
    title={title}
    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
      on
        ? dark
          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : dark
          ? 'bg-white/5 text-white/30 border-white/10'
          : 'bg-gray-50 text-gray-400 border-gray-200'
    }`}
  >
    {label}
  </span>
);

const SortTh: React.FC<{
  field?: SortField;
  label: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  dark: boolean;
  onSort: (f: SortField) => void;
  right?: boolean;
}> = ({ field, label, sortBy, sortOrder, dark, onSort, right }) => {
  const cls = `px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${dark ? 'text-white/70' : 'text-gray-500'}`;
  if (!field) return <th className={cls}>{label}</th>;
  return (
    <th
      className={cls}
      aria-sort={
        sortBy === field
          ? sortOrder === 'ASC'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${dark ? 'hover:text-white' : 'hover:text-gray-900'}`}
      >
        {label}
        {sortBy === field ? (
          sortOrder === 'ASC' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </button>
    </th>
  );
};

// ===========================================================================
// 6b. Date picker — the whole field is the click target (no tiny calendar icon to hit),
//     portaled so it is never clipped by a scrolling dialog, keyboard-navigable.
// ===========================================================================

const Z_POPOVER = 'z-[110]'; // above dialogs (z-100)
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']; // Monday-first
const POP_W = 296;
const POP_H = 352;

const isoOf = (y: number, m: number, d: number) =>
  `${y}-${pad2(m + 1)}-${pad2(d)}`;
function parseISO(
  s?: string | null
): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const x = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return x ? { y: +x[1], m: +x[2] - 1, d: +x[3] } : null;
}
function shiftDays(s: string, n: number) {
  const p = parseISO(s)!;
  const d = new Date(p.y, p.m, p.d + n);
  return isoOf(d.getFullYear(), d.getMonth(), d.getDate());
}
function moveToMonth(s: string, y: number, m: number) {
  const p = parseISO(s)!;
  const norm = new Date(y, m, 1); // normalises month overflow (e.g. month 12 -> Jan next year)
  const last = new Date(norm.getFullYear(), norm.getMonth() + 1, 0).getDate();
  return isoOf(norm.getFullYear(), norm.getMonth(), Math.min(p.d, last));
}

const DatePicker: React.FC<{
  id?: string;
  value: string;
  onChange: (v: string) => void;
  dark: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  compact?: boolean;
  clearable?: boolean;
  ariaLabel?: string;
}> = ({
  id,
  value,
  onChange,
  dark,
  disabled,
  min,
  max,
  placeholder = 'Select date',
  invalid,
  compact,
  clearable,
  ariaLabel,
}) => {
  const t = tokens(dark);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const today = todayISO();

  const clamp = (s: string) =>
    max && s > max ? max : min && s < min ? min : s;
  const startISO = parseISO(value) ? value : clamp(today);
  // focusISO is both the keyboard-focused day and the month on display
  const [focusISO, setFocusISO] = useState(startISO);
  const view = parseISO(focusISO) ?? parseISO(today)!;
  const outOfRange = (s: string) => (!!min && s < min) || (!!max && s > max);

  const openPicker = () => {
    if (disabled) return;
    setFocusISO(startISO);
    setOpen(true);
  };
  const closePicker = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (s: string) => {
    if (outOfRange(s)) return;
    onChange(s);
    closePicker();
  };

  // Position next to the trigger; flip above if there is no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const below = window.innerHeight - r.bottom;
      const top =
        below >= POP_H + 12 ? r.bottom + 6 : Math.max(8, r.top - POP_H - 6);
      const left = Math.min(
        Math.max(8, r.left),
        Math.max(8, window.innerWidth - POP_W - 8)
      );
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Outside click closes; Esc closes only the picker (capture phase, so the parent dialog stays open).
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const n = e.target as Node;
      if (popRef.current?.contains(n) || triggerRef.current?.contains(n))
        return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        closePicker();
      }
    };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep keyboard focus on the active day (but never steal it from the month / year selects).
  useEffect(() => {
    if (!open) return;
    const ae = document.activeElement;
    if (
      popRef.current?.contains(ae) &&
      !(ae as HTMLElement).hasAttribute('data-date')
    )
      return;
    popRef.current
      ?.querySelector<HTMLElement>(`[data-date="${focusISO}"]`)
      ?.focus();
  }, [open, focusISO]);

  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => shiftDays(focusISO, -1),
      ArrowRight: () => shiftDays(focusISO, 1),
      ArrowUp: () => shiftDays(focusISO, -7),
      ArrowDown: () => shiftDays(focusISO, 7),
      PageUp: () => moveToMonth(focusISO, view.y, view.m - 1),
      PageDown: () => moveToMonth(focusISO, view.y, view.m + 1),
    };
    const fn = step[e.key];
    if (!fn) return;
    e.preventDefault();
    const next = fn();
    if (!outOfRange(next)) setFocusISO(next);
  };

  // 6 weeks starting on the Monday on/before the 1st
  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.y, view.m, 1 - offset + i);
    return {
      iso: isoOf(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === view.m,
    };
  });

  const nowY = parseISO(today)!.y;
  const yMin = Math.min(parseISO(min)?.y ?? nowY - 100, view.y);
  const yMax = Math.max(parseISO(max)?.y ?? nowY + 10, view.y);
  const years = Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i);
  const navBtn = `p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-600'}`;
  const selCls = `px-2 py-1 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${t.input}`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? closePicker(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid}
        aria-label={ariaLabel}
        className={`w-full flex items-center gap-2 pl-3 ${clearable && value && !disabled ? 'pr-8' : 'pr-3'} ${compact ? 'py-1.5' : 'py-2'} rounded-lg text-sm text-left focus:outline-none focus:ring-2 ${
          invalid
            ? 'ring-1 ring-red-500 focus:ring-red-500'
            : 'focus:ring-blue-500'
        } disabled:opacity-60 disabled:cursor-not-allowed ${t.input}`}
      >
        <Calendar className="w-4 h-4 shrink-0 text-gray-400" />
        <span className={`flex-1 truncate ${value ? '' : t.faint}`}>
          {value ? fmtDate(value) : placeholder}
        </span>
      </button>
      {clearable && value && !disabled && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={() => onChange('')}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${dark ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <Portal>
          <div
            ref={popRef}
            role="dialog"
            aria-label="Choose date"
            style={{ top: pos.top, left: pos.left, width: POP_W }}
            className={`fixed ${Z_POPOVER} rounded-xl border shadow-2xl p-3 ${t.surface}`}
          >
            <div className="flex items-center gap-1 mb-2">
              <button
                type="button"
                aria-label="Previous month"
                className={navBtn}
                onClick={() =>
                  setFocusISO(moveToMonth(focusISO, view.y, view.m - 1))
                }
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                aria-label="Month"
                value={view.m}
                onChange={(e) =>
                  setFocusISO(
                    moveToMonth(focusISO, view.y, Number(e.target.value))
                  )
                }
                className={`${selCls} flex-1 min-w-0`}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="Year"
                value={view.y}
                onChange={(e) =>
                  setFocusISO(
                    moveToMonth(focusISO, Number(e.target.value), view.m)
                  )
                }
                className={selCls}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Next month"
                className={navBtn}
                onClick={() =>
                  setFocusISO(moveToMonth(focusISO, view.y, view.m + 1))
                }
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div
              role="grid"
              aria-label={`${MONTHS[view.m]} ${view.y}`}
              onKeyDown={onGridKey}
            >
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((w) => (
                  <div
                    key={w}
                    className={`text-center text-[11px] font-semibold py-1 ${t.faint}`}
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((c) => {
                  const selected = c.iso === value;
                  const isToday = c.iso === today;
                  const off = outOfRange(c.iso);
                  return (
                    <button
                      key={c.iso}
                      type="button"
                      data-date={c.iso}
                      tabIndex={c.iso === focusISO ? 0 : -1}
                      disabled={off}
                      aria-label={asLocalDate(c.iso).toLocaleDateString(
                        undefined,
                        {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        }
                      )}
                      aria-selected={selected}
                      onClick={() => pick(c.iso)}
                      className={`h-9 rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-25 disabled:cursor-not-allowed ${
                        selected
                          ? 'bg-blue-600 text-white font-semibold'
                          : isToday
                            ? dark
                              ? 'ring-1 ring-blue-400 text-blue-300'
                              : 'ring-1 ring-blue-500 text-blue-700'
                            : c.inMonth
                              ? dark
                                ? 'text-white hover:bg-white/10'
                                : 'text-gray-800 hover:bg-gray-100'
                              : dark
                                ? 'text-white/30 hover:bg-white/5'
                                : 'text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {c.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className={`flex items-center justify-between mt-2 pt-2 border-t ${t.line}`}
            >
              <button
                type="button"
                disabled={outOfRange(today)}
                onClick={() => pick(today)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 ${dark ? 'text-blue-300 hover:bg-white/10' : 'text-blue-700 hover:bg-blue-50'}`}
              >
                Today
              </button>
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    closePicker();
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${dark ? 'text-white/60 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

// ===========================================================================
// 7. Form control (one component renders every field type)
// ===========================================================================

const Control: React.FC<{
  def: FieldDef;
  value: string;
  error?: string;
  disabled: boolean;
  na: boolean;
  options: Option[];
  optionsLoading: boolean;
  dark: boolean;
  t: Tokens;
  requiredNow: boolean;
  min?: string;
  max?: string;
  onChange: (v: string) => void;
}> = ({
  def,
  value,
  error,
  disabled,
  na,
  options,
  optionsLoading,
  dark,
  t,
  requiredNow,
  min,
  max,
  onChange,
}) => {
  const id = `fld-${def.key}`;
  const base = `w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 ${
    error ? 'ring-1 ring-red-500 focus:ring-red-500' : 'focus:ring-blue-500'
  } disabled:opacity-60 disabled:cursor-not-allowed ${t.input}`;
  const off = disabled || na;

  let control: React.ReactNode;
  if (na) {
    control = (
      <div
        className={`px-3 py-2 rounded-lg text-sm italic border border-dashed ${dark ? 'border-white/20 text-white/40' : 'border-gray-300 text-gray-400'}`}
      >
        NA
      </div>
    );
  } else if (def.type === 'select') {
    control = (
      <select
        id={id}
        value={value}
        disabled={off || optionsLoading}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={base}
      >
        <option value="">{optionsLoading ? 'Loading…' : 'Select…'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {/* keep a stored value visible even if it was retired from the lookup */}
        {value && !options.some((o) => o.value === value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    );
  } else if (def.type === 'textarea') {
    control = (
      <>
        <textarea
          id={id}
          rows={3}
          value={value}
          disabled={off}
          maxLength={def.max}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={`${base} resize-y`}
        />
        {def.max && !off && (
          <div className={`text-right text-[11px] mt-0.5 ${t.faint}`}>
            {value.length}/{def.max}
          </div>
        )}
      </>
    );
  } else if (def.type === 'number') {
    control = (
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={value}
        disabled={off}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`${base} tabular-nums`}
      />
    );
  } else if (def.type === 'date') {
    control = (
      <DatePicker
        id={id}
        value={value}
        onChange={onChange}
        dark={dark}
        disabled={off}
        invalid={!!error}
        min={min}
        max={max}
        clearable
      />
    );
  } else {
    control = (
      <input
        id={id}
        type="text"
        value={value}
        disabled={off}
        maxLength={def.max}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={base}
      />
    );
  }

  return (
    <div className={def.full ? 'sm:col-span-2' : ''}>
      <label
        htmlFor={id}
        className={`flex items-center gap-1 text-xs font-semibold mb-1 ${t.muted}`}
      >
        {def.label}
        {requiredNow && (
          <span className="text-red-500" title="Required now">
            *
          </span>
        )}
        {!requiredNow && def.req === 'close' && (
          <span
            className="text-amber-500"
            title="Required before the incident can be closed"
          >
            †
          </span>
        )}
      </label>
      {control}
      {error ? (
        <div role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </div>
      ) : (
        def.hint &&
        !off && <div className={`mt-1 text-[11px] ${t.faint}`}>{def.hint}</div>
      )}
    </div>
  );
};

// ===========================================================================
// 8. Incident dialog — create / view / edit
// ===========================================================================

type DialogMode = 'create' | 'view' | 'edit';

const IncidentDialog: React.FC<{
  dark: boolean;
  mode: DialogMode;
  incident: FraudIncident | null;
  lookups: Lookups;
  lookupsLoading: boolean;
  onSwitchToEdit: () => void;
  onClose: () => void;
  onSaved: (msg: string) => void;
  menuId: number | string | undefined;
}> = ({
  dark,
  mode,
  incident,
  lookups,
  lookupsLoading,
  onSwitchToEdit,
  onClose,
  onSaved,
  menuId,
}) => {
  const t = tokens(dark);
  useBodyScrollLock();

  const initial = useMemo(() => {
    if (incident) return formFromIncident(incident);
    const f = emptyForm();
    // New incidents start at the first (lowest-order) non-closed status — the analyst doesn't pick one to register.
    const opts = [...lookups.investigation_status].sort(
      (a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)
    );
    f.investigation_status =
      (
        opts.find(
          (o) => !isClosedStatus(o.value, lookups.investigation_status)
        ) ?? opts[0]
      )?.value ?? '';
    return f;
  }, [incident, lookups.investigation_status]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [section, setSection] = useState<Section>('incident');
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Re-seed when switching view -> edit or when the record changes.
  useEffect(() => {
    setForm(initial);
    setErrors({});
    setSubmitted(false);
    setFormError(null);
    setConflict(false);
    setConfirmDiscard(false);
    // Re-seed only when the record / mode changes — not when lookups finish loading mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident, mode]);

  const readOnly = mode === 'view';
  const dirty = useMemo(
    () => FIELDS.some((d) => form[d.key] !== initial[d.key]),
    [form, initial]
  );

  const requestClose = useCallback(() => {
    if (!readOnly && dirty && !saving) setConfirmDiscard(true);
    else onClose();
  }, [readOnly, dirty, saving, onClose]);
  const ref = useDialog(requestClose);

  const closing = isClosedStatus(
    form.investigation_status,
    lookups.investigation_status
  );
  const requiredNow = useMemo(
    () => requiredKeys(form, lookups),
    [form, lookups]
  );
  // How many fields would still block closure (shown so the analyst can see progress at a glance)
  const outstanding = useMemo(
    () =>
      closing
        ? 0
        : Object.keys(validate(form, lookups, { forceClose: true })).length,
    [form, lookups, closing]
  );

  // Lookups can arrive after the dialog opens: apply the default status once they do.
  useEffect(() => {
    if (
      mode === 'create' &&
      !form.investigation_status &&
      initial.investigation_status
    )
      setForm((p) =>
        p.investigation_status
          ? p
          : { ...p, investigation_status: initial.investigation_status }
      );
  }, [mode, form.investigation_status, initial.investigation_status]);

  const setField = (k: FieldKey, v: string) => {
    setForm((prev) => {
      const next = { ...prev, [k]: v };
      // Keep dependent fields coherent: switching to "No" clears the now-NA date / ref.
      if (k === 'bsd_required' && isNo(v)) next.bsd_reported_date = '';
      if (k === 'police_required' && isNo(v)) next.police_reported_date = '';
      if (k === 'insured' && isNo(v)) next.insurance_claim_ref = '';
      if (submitted) setErrors(validate(next, lookups));
      return next;
    });
  };

  const sectionErrorCount = useMemo(() => {
    const c: Record<Section, number> = {
      incident: 0,
      cause: 0,
      financial: 0,
      investigation: 0,
      reporting: 0,
      closure: 0,
    };
    (Object.keys(errors) as FieldKey[]).forEach((k) => {
      if (errors[k]) c[SECTION_OF(k)]++;
    });
    return c;
  }, [errors]);

  const save = async () => {
    setSubmitted(true);
    setFormError(null);
    const errs = validate(form, lookups);
    setErrors(errs);
    const bad = Object.keys(errs) as FieldKey[];
    if (bad.length > 0) {
      const first = SECTIONS.find((s) =>
        bad.some((k) => SECTION_OF(k) === s.key)
      );
      if (first) setSection(first.key);
      setFormError(
        `Please fix ${bad.length} field${bad.length > 1 ? 's' : ''} before saving.`
      );
      return;
    }
    setSaving(true);
    try {
      const payload = payloadFromForm(form);
      if (mode === 'create') {
        await apiClient.post(API.list, payload);
        onSaved('Incident recorded');
      } else if (incident) {
        await apiClient.put(API.one(incident.id), {
          ...payload,
          version: incident.version,
        });
        onSaved('Incident updated');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const serverErrors = err?.response?.data?.errors;
      if (status === 409) {
        setConflict(true);
        setFormError(
          'This incident was changed by someone else since you opened it. Reload it to see the latest version.'
        );
      } else if (serverErrors && typeof serverErrors === 'object') {
        const mapped: Errors = {};
        Object.entries(serverErrors).forEach(([k, v]) => {
          if (k in FIELD_BY_KEY)
            mapped[k as FieldKey] = Array.isArray(v) ? String(v[0]) : String(v);
        });
        setErrors(mapped);
        const first = Object.keys(mapped)[0] as FieldKey | undefined;
        if (first) setSection(SECTION_OF(first));
        setFormError(
          err?.response?.data?.message || 'The server rejected some values.'
        );
      } else {
        console.error('Save failed:', err);
        setFormError(
          err?.response?.data?.message ||
            'Could not save the incident. Please try again.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldsInSection = FIELDS.filter((d) => d.section === section);
  const title =
    mode === 'create'
      ? 'Record fraud incident'
      : incident?.internal_ref_no || 'Fraud incident';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={requestClose}
      className={`fixed inset-0 ${Z_DIALOG} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:w-[860px] max-w-full h-[min(90vh,820px)] rounded-2xl border shadow-2xl flex flex-col overflow-hidden outline-none ${t.surface}`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-start justify-between gap-4 shrink-0 ${t.line}`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl shrink-0 bg-gradient-to-br from-red-500 to-orange-600 shadow-md">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className={`text-base font-bold truncate ${t.text}`}>
                {title}
              </h3>
              <div className={`text-xs mt-0.5 ${t.faint}`}>
                {mode === 'create'
                  ? 'Date recorded is set automatically when you save'
                  : `Recorded ${fmtDateTime(incident?.date_recorded)}${incident?.created_by ? ` by ${incident.created_by}` : ''}`}
                <span className="mx-1.5">·</span>
                <span className="font-medium">
                  {mode === 'view'
                    ? 'Read-only'
                    : mode === 'edit'
                      ? 'Editing'
                      : 'New'}
                </span>
              </div>
              {mode === 'create' ? (
                <div className={`text-xs mt-0.5 ${t.muted}`}>
                  Only fields marked <span className="text-red-500">*</span> are
                  needed now — add the rest as the investigation progresses.
                </div>
              ) : (
                !closing && (
                  <div
                    className={`text-xs mt-0.5 font-medium ${outstanding > 0 ? (dark ? 'text-amber-300' : 'text-amber-700') : dark ? 'text-emerald-300' : 'text-emerald-700'}`}
                  >
                    {outstanding > 0
                      ? `${outstanding} field${outstanding > 1 ? 's' : ''} still needed before this incident can be closed`
                      : 'All closure details are complete'}
                  </div>
                )
              )}
            </div>
          </div>
          <button
            onClick={requestClose}
            aria-label="Close"
            className={`p-1.5 rounded-lg shrink-0 ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section tabs */}
        <div
          role="tablist"
          className={`flex overflow-x-auto px-4 border-b shrink-0 ${t.line}`}
        >
          {SECTIONS.map((s, i) => {
            const active = s.key === section;
            const n = sectionErrorCount[s.key];
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={active}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? dark
                      ? 'border-blue-400 text-white'
                      : 'border-blue-600 text-gray-900'
                    : dark
                      ? 'border-transparent text-white/50 hover:text-white/80'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <span className={`text-[11px] ${t.faint}`}>{i + 1}</span>
                {s.label}
                {n > 0 && (
                  <span className="px-1.5 rounded-full text-[11px] font-semibold bg-red-500 text-white">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Banners */}
        {formError && (
          <div
            role="alert"
            className={`mx-6 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm shrink-0 ${
              dark
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {formError}
          </div>
        )}
        {!readOnly && closing && (
          <div
            className={`mx-6 mt-3 px-3 py-2 rounded-lg border text-xs shrink-0 ${
              dark
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            This status closes the incident, so every field marked * or † must
            now be completed.
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
            {fieldsInSection.map((d) => (
              <Control
                key={d.key}
                def={d}
                value={form[d.key]}
                error={errors[d.key]}
                disabled={readOnly || saving}
                na={isNA(d.key, form)}
                requiredNow={requiredNow.has(d.key)}
                min={
                  AFTER_INCIDENT.includes(d.key) && form.incident_date
                    ? form.incident_date
                    : undefined
                }
                max={PAST_ONLY.includes(d.key) ? todayISO() : undefined}
                options={d.lookup ? lookups[d.lookup] : []}
                optionsLoading={
                  !!d.lookup && lookupsLoading && lookups[d.lookup].length === 0
                }
                dark={dark}
                t={t}
                onChange={(v) => setField(d.key, v)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-3 border-t flex flex-wrap items-center justify-between gap-3 shrink-0 ${t.line}`}
        >
          <span className={`text-[11px] ${t.faint}`}>
            <span className="text-red-500">*</span> required now ·{' '}
            <span className="text-amber-500">†</span> required before closing
          </span>

          {confirmDiscard ? (
            <div className="flex items-center gap-2">
              <span className={`text-sm ${t.body}`}>
                Discard unsaved changes?
              </span>
              <button
                onClick={() => setConfirmDiscard(false)}
                className={`px-3 py-1.5 rounded-lg text-sm ${t.btn}`}
              >
                Keep editing
              </button>
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white"
              >
                Discard
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={requestClose}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium ${t.btn}`}
              >
                {readOnly ? 'Close' : 'Cancel'}
              </button>
              {readOnly && (
                <PermissionGuard menuId={menuId} action="edit" fallback={null}>
                  <button
                    onClick={onSwitchToEdit}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold ${t.primary}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                </PermissionGuard>
              )}
              {!readOnly && conflict && (
                <button
                  onClick={onClose}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${t.btn}`}
                >
                  Close &amp; reload
                </button>
              )}
              {!readOnly && !conflict && (
                <button
                  onClick={save}
                  disabled={saving || (mode === 'edit' && !dirty)}
                  className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${t.primary}`}
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {mode === 'create' ? 'Record incident' : 'Save changes'}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ===========================================================================
// 9. Quick status dialog
// ===========================================================================

const StatusDialog: React.FC<{
  dark: boolean;
  incident: FraudIncident;
  lookups: Lookups;
  onClose: () => void;
  onOpenEdit: () => void;
  onSaved: (msg: string) => void;
}> = ({ dark, incident, lookups, onClose, onOpenEdit, onSaved }) => {
  const t = tokens(dark);
  useBodyScrollLock();
  const ref = useDialog(onClose);
  const [value, setValue] = useState(incident.investigation_status);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A status change from here is only allowed if the record already satisfies what the target status requires
  // (registration minimum, the status's own `requires`, and all closure fields for a closed status).
  const closureGaps = useMemo(() => {
    const f = { ...formFromIncident(incident), investigation_status: value };
    return Object.keys(validate(f, lookups)) as FieldKey[];
  }, [incident, value, lookups]);
  const unchanged = value === incident.investigation_status;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(API.status(incident.id), {
        investigation_status: value,
        remarks: remarks.trim() || null,
        version: incident.version,
      });
      onSaved('Status updated');
    } catch (err: any) {
      setError(
        err?.response?.status === 409
          ? 'This incident was changed by someone else. Close this dialog and reopen it.'
          : err?.response?.data?.message || 'Could not update the status.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className={`fixed inset-0 ${Z_DIALOG} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Update investigation status"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:w-[460px] rounded-2xl border shadow-2xl outline-none ${t.surface}`}
      >
        <div
          className={`px-5 py-4 border-b flex items-center justify-between ${t.line}`}
        >
          <div>
            <h3 className={`text-base font-bold ${t.text}`}>
              Update investigation status
            </h3>
            <div className={`text-xs ${t.faint}`}>
              {incident.internal_ref_no}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-lg ${dark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label
              htmlFor="status-sel"
              className={`block text-xs font-semibold mb-1 ${t.muted}`}
            >
              New status
            </label>
            <select
              id="status-sel"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${t.input}`}
            >
              {lookups.investigation_status.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="status-rem"
              className={`block text-xs font-semibold mb-1 ${t.muted}`}
            >
              Remarks (kept in the audit trail)
            </label>
            <textarea
              id="status-rem"
              rows={3}
              maxLength={500}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${t.input}`}
            />
          </div>
          {closureGaps.length > 0 && (
            <div
              className={`px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}
            >
              This status needs {closureGaps.length} more field
              {closureGaps.length > 1 ? 's' : ''} completed (
              {closureGaps
                .slice(0, 3)
                .map((k) => FIELD_BY_KEY[k].label)
                .join(', ')}
              {closureGaps.length > 3 ? '…' : ''}).{' '}
              <button
                onClick={onOpenEdit}
                className="font-semibold underline underline-offset-2"
              >
                Open full form
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="text-sm text-red-500">
              {error}
            </div>
          )}
        </div>
        <div className={`px-5 py-3 border-t flex justify-end gap-2 ${t.line}`}>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${t.btn}`}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || unchanged || closureGaps.length > 0}
            className={`flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${t.primary}`}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Update status
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ===========================================================================
// 10. Page
// ===========================================================================

const FraudIncidentRegister: React.FC<Props> = ({ currentUserId }) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const t = tokens(dark);
  const { getMenuId } = useMenuIds();
  const { addNotification } = useNotifications();
  const MENU_ID = getMenuId(MENU_KEY);

  // list state
  const [rows, setRows] = useState<FraudIncident[]>([]);
  const [summary, setSummary] = useState<ListResponse['summary']>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('date_recorded');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  // filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [view, setView] = useState<View>('all');
  const [fStatus, setFStatus] = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fFrom, setFFrom] = useState('');
  const [fTo, setFTo] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // lookups
  const [lookups, setLookups] = useState<Lookups>(EMPTY_LOOKUPS);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [lookupsFailed, setLookupsFailed] = useState(false);

  // dialogs (only one at a time)
  const [dialog, setDialog] = useState<
    | { kind: 'form'; mode: DialogMode; incident: FraudIncident | null }
    | { kind: 'status'; incident: FraudIncident }
    | null
  >(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const [density, setDensity] = useState<Density>(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === 'compact'
        ? 'compact'
        : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const compact = density === 'compact';

  const abortRef = useRef<AbortController | null>(null);
  const reqId = useRef(0);
  const canUseMine = !!currentUserId;

  const filterParams = useCallback(() => {
    const p: Record<string, string | number | boolean> = {};
    if (debouncedSearch) p.search = debouncedSearch;
    if (fStatus) p.investigation_status = fStatus;
    if (fCategory) p.fraud_category = fCategory;
    if (fFrom) p.fromDate = fFrom;
    if (fTo) p.toDate = fTo;
    if (view === 'mine') {
      p.mine = true;
      if (currentUserId) p.user_id = currentUserId;
    }
    return p;
  }, [debouncedSearch, fStatus, fCategory, fFrom, fTo, view, currentUserId]);

  const fetchList = useCallback(
    async (silent = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++reqId.current;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<ListResponse>(API.list, {
          params: { page, pageSize, sortBy, sortOrder, ...filterParams() },
          signal: controller.signal,
        });
        if (id !== reqId.current) return;
        setRows(res.data.data);
        setTotalRecords(res.data.totalRecords);
        setTotalPages(res.data.totalPages);
        setSummary(res.data.summary);
        if (res.data.totalPages > 0 && page > res.data.totalPages)
          setPage(res.data.totalPages);
      } catch (err: any) {
        if (isCancel(err) || id !== reqId.current) return;
        console.error('Error loading fraud incidents:', err);
        setError('Could not load fraud incidents.');
        setRows([]);
        setTotalRecords(0);
        setTotalPages(1);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [page, pageSize, sortBy, sortOrder, filterParams]
  );

  useEffect(() => {
    fetchList();
    return () => abortRef.current?.abort();
  }, [fetchList]);

  const loadLookups = useCallback(async () => {
    setLookupsLoading(true);
    setLookupsFailed(false);
    try {
      const res = await apiClient.get<Record<string, unknown>>(API.lookups);
      const d = res.data || {};
      const pick = (k: LookupKey, fallback: Option[]) => {
        const o = normalizeOptions(d[k]);
        return o.length > 0 ? o : fallback;
      };
      setLookups({
        fraud_category: pick('fraud_category', []),
        root_cause_identified: pick('root_cause_identified', []),
        detection_method: pick('detection_method', []),
        recovery_status: pick('recovery_status', []),
        insured: pick('insured', YES_NO),
        investigation_status: pick('investigation_status', []),
        bsd_required: pick('bsd_required', YES_NO),
        police_required: pick('police_required', YES_NO),
      });
    } catch (err) {
      console.error('Error loading lookups:', err);
      setLookupsFailed(true);
    } finally {
      setLookupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  // Any filter change restarts at page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, fStatus, fCategory, fFrom, fTo, view, pageSize]);

  useEffect(() => {
    if (!exportOpen) return;
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node))
        setExportOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [exportOpen]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== '/' || dialog) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [dialog]);

  // ---- actions --------------------------------------------------------------
  const handleSort = (f: SortField) => {
    if (sortBy === f) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    else {
      setSortBy(f);
      setSortOrder('DESC');
    }
    setPage(1);
  };

  const clearAll = () => {
    setSearch('');
    setFStatus('');
    setFCategory('');
    setFFrom('');
    setFTo('');
    setView('all');
  };
  const anyFilter = !!(
    search ||
    fStatus ||
    fCategory ||
    fFrom ||
    fTo ||
    view !== 'all'
  );

  const onSaved = (msg: string) => {
    setDialog(null);
    addNotification(msg, 'success');
    fetchList(true);
  };

  const toggleDensity = (d: Density) => {
    setDensity(d);
    try {
      localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* ignore */
    }
  };

  const exportAll = async () => {
    setExportOpen(false);
    setExporting(true);
    try {
      const res = await apiClient.get(API.export, {
        params: { sortBy, sortOrder, format: 'csv', ...filterParams() },
        responseType: 'blob',
      });
      downloadBlob(
        res.data,
        `fraud-incidents-all-${Date.now()}.csv`,
        'text/csv'
      );
    } catch (err) {
      console.error('Export failed:', err);
      addNotification('Export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const rangeFrom = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
  const rangeTo = Math.min(page * pageSize, totalRecords);
  const pad = compact ? 'py-2' : 'py-3.5';
  const today = todayISO();
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => {
      if (totalPages <= 5 || page <= 3) return i + 1;
      if (page >= totalPages - 2) return totalPages - 4 + i;
      return page - 2 + i;
    }
  );

  const kpis = summary
    ? [
        {
          label: 'Open',
          value: summary.open,
          text: dark ? 'text-amber-300' : 'text-amber-600',
          money: false,
        },
        {
          label: 'Closed',
          value: summary.closed,
          text: dark ? 'text-emerald-300' : 'text-emerald-600',
          money: false,
        },
        {
          label: `Total loss (${CURRENCY})`,
          value: summary.total_loss,
          text: dark ? 'text-red-300' : 'text-red-600',
          money: true,
        },
        {
          label: `Recovered (${CURRENCY})`,
          value: summary.total_recovered,
          text: dark ? 'text-blue-300' : 'text-blue-600',
          money: true,
        },
      ].filter((k) => typeof k.value === 'number')
    : [];

  return (
    <PermissionGuard
      menuId={MENU_ID}
      action="view"
      fallback={
        <div className={`text-center py-20 ${t.text}`}>
          <Lock className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">
            You don't have permission to view the fraud incident register.
          </p>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold leading-tight ${t.text}`}>
                Fraud Incident Register
              </h1>
              <p
                className={`text-xs ${dark ? 'text-red-200/70' : 'text-red-600'}`}
              >
                Manually recorded incidents, investigation and regulatory
                reporting
              </p>
            </div>
            {kpis.length > 0 && (
              <div className="hidden md:flex items-center gap-2 ml-3">
                {kpis.map((k) => (
                  <div
                    key={k.label}
                    className={`px-3 py-1 rounded-lg border text-xs ${t.panel}`}
                  >
                    <span
                      className={`font-bold text-sm tabular-nums ${k.text}`}
                    >
                      {k.money
                        ? fmtMoney(k.value)
                        : (k.value as number).toLocaleString()}
                    </span>{' '}
                    <span className={t.muted}>{k.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchList()}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${t.btn}`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>

            <PermissionGuard
              menuId={MENU_ID}
              action="export"
              fallback={
                <button
                  onClick={() =>
                    addNotification(
                      "You don't have permission to export incidents",
                      'warning'
                    )
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border ${
                    dark
                      ? 'bg-white/5 text-white/40 border-white/10'
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Export
                </button>
              }
            >
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setExportOpen((v) => !v)}
                  disabled={exporting}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${
                    dark
                      ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30'
                      : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-300'
                  }`}
                >
                  {exporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {exportOpen && (
                  <div
                    role="menu"
                    className={`absolute right-0 mt-2 w-60 rounded-xl border shadow-2xl overflow-hidden z-30 ${t.surface}`}
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        exportPageCSV(rows, lookups);
                        setExportOpen(false);
                      }}
                      disabled={rows.length === 0}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40 ${dark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <FileText className="w-4 h-4" /> Current page (CSV)
                    </button>
                    <button
                      role="menuitem"
                      onClick={exportAll}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 border-t ${t.line} ${dark ? 'text-white hover:bg-white/10' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <Download className="w-4 h-4" /> All{' '}
                      {totalRecords.toLocaleString()} matching (CSV)
                    </button>
                  </div>
                )}
              </div>
            </PermissionGuard>

            <PermissionGuard menuId={MENU_ID} action="edit" fallback={null}>
              <button
                onClick={() =>
                  setDialog({ kind: 'form', mode: 'create', incident: null })
                }
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg ${t.primary}`}
              >
                <Plus className="w-4 h-4" />
                Record incident
              </button>
            </PermissionGuard>
          </div>
        </div>

        {lookupsFailed && (
          <div
            role="alert"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm ${dark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800'}`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">
              Dropdown values could not be loaded, so creating and editing is
              unavailable.
            </span>
            <button
              onClick={loadLookups}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Toolbar — inline controls only (no popovers to collide with dialogs) */}
        <div className={`rounded-xl border p-3 ${t.panel}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search incidents"
                placeholder="Search reference, description, parties…   ( / )"
                className={`w-full pl-9 pr-9 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${t.input}`}
              />
              {search !== debouncedSearch && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>

            <div
              role="tablist"
              aria-label="Incident view"
              className={`inline-flex rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
            >
              {(['all', 'mine'] as View[]).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  disabled={v === 'mine' && !canUseMine}
                  onClick={() => setView(v)}
                  title={
                    v === 'mine'
                      ? canUseMine
                        ? 'Incidents you recorded'
                        : 'Your user could not be resolved'
                      : undefined
                  }
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    view === v
                      ? dark
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : dark
                        ? 'text-white/60 hover:text-white'
                        : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {v === 'all' ? 'All incidents' : 'My incidents'}
                </button>
              ))}
            </div>

            <select
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
              aria-label="Filter by investigation status"
              className={`px-3 py-2 rounded-lg text-sm ${t.input}`}
            >
              <option value="">All statuses</option>
              {lookups.investigation_status.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={fCategory}
              onChange={(e) => setFCategory(e.target.value)}
              aria-label="Filter by fraud category"
              className={`px-3 py-2 rounded-lg text-sm max-w-[200px] ${t.input}`}
            >
              <option value="">All categories</option>
              {lookups.fraud_category.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <div className="w-[150px]">
                <DatePicker
                  compact
                  clearable
                  dark={dark}
                  value={fFrom}
                  max={fTo || undefined}
                  onChange={setFFrom}
                  placeholder="Incident from"
                  ariaLabel="Incident date from"
                />
              </div>
              <span className={t.faint}>–</span>
              <div className="w-[150px]">
                <DatePicker
                  compact
                  clearable
                  dark={dark}
                  value={fTo}
                  min={fFrom || undefined}
                  onChange={setFTo}
                  placeholder="Incident to"
                  ariaLabel="Incident date to"
                />
              </div>
            </div>
            {anyFilter && (
              <button
                onClick={clearAll}
                className={`px-2 py-2 text-sm font-medium ${dark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div
          className={`rounded-xl border overflow-hidden shadow-xl ${t.panel}`}
        >
          <div
            className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b ${t.line}`}
          >
            <span className={`text-xs ${t.muted}`}>
              Showing {rangeFrom.toLocaleString()}–{rangeTo.toLocaleString()} of{' '}
              {totalRecords.toLocaleString()}
            </span>
            <div
              role="group"
              aria-label="Row density"
              className={`inline-flex rounded-lg p-0.5 ${dark ? 'bg-white/10' : 'bg-gray-100'}`}
            >
              {(['comfortable', 'compact'] as Density[]).map((d) => (
                <button
                  key={d}
                  aria-pressed={density === d}
                  onClick={() => toggleDensity(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
                    density === d
                      ? dark
                        ? 'bg-white/20 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : dark
                        ? 'text-white/60 hover:text-white'
                        : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: compact ? 10 : 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`${compact ? 'h-10' : 'h-14'} rounded-lg animate-pulse ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-center">
              <div>
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className={`text-lg font-medium ${t.text}`}>{error}</p>
                <button
                  onClick={() => fetchList()}
                  className={`mt-3 px-4 py-1.5 rounded-lg text-sm font-semibold ${t.primary}`}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-center">
              <div>
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className={`text-lg font-medium ${t.text}`}>
                  {anyFilter
                    ? 'No incidents match your filters'
                    : 'No incidents recorded yet'}
                </p>
                <p className={`text-sm ${t.muted}`}>
                  {anyFilter
                    ? 'Try clearing a filter.'
                    : 'Use “Record incident” to add the first one.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-340px)] min-h-[300px]">
              <table className="w-full">
                <thead
                  className={`sticky top-0 z-10 border-b backdrop-blur-sm ${dark ? 'border-white/20 bg-slate-900/95' : 'border-gray-200 bg-gray-50/95'}`}
                >
                  <tr>
                    <SortTh
                      field="incident_date"
                      label="Incident"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Category / description"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="loss_amount"
                      label={`Loss / recovered`}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="investigation_status"
                      label="Status"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Reporting"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      field="target_completion_date"
                      label="Target"
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                    <SortTh
                      label="Actions"
                      right
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      dark={dark}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const closed = isClosedStatus(
                      r.investigation_status,
                      lookups.investigation_status
                    );
                    const statusLabel = labelOf(
                      lookups.investigation_status,
                      r.investigation_status
                    );
                    const overdue =
                      !closed &&
                      !!r.target_completion_date &&
                      r.target_completion_date < today;
                    const open = () =>
                      setDialog({ kind: 'form', mode: 'view', incident: r });
                    const net =
                      (r.loss_amount ?? 0) - (r.recovered_amount ?? 0);
                    return (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            open();
                          }
                        }}
                        aria-label={`Open incident ${r.internal_ref_no}`}
                        className={`border-b cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                          dark
                            ? 'border-white/10 hover:bg-white/5'
                            : 'border-gray-100 hover:bg-gray-50'
                        } ${idx % 2 === 1 ? (dark ? 'bg-white/[0.02]' : 'bg-gray-50/50') : ''}`}
                      >
                        <td className={`px-4 ${pad} whitespace-nowrap`}>
                          <div
                            className={`text-sm font-mono font-semibold ${t.text}`}
                          >
                            {r.internal_ref_no}
                          </div>
                          <div className={`text-xs ${t.faint}`}>
                            {fmtDate(r.incident_date)}
                          </div>
                        </td>
                        <td className={`px-4 ${pad} max-w-[340px]`}>
                          <div
                            className={`text-sm font-medium truncate ${t.body}`}
                          >
                            {labelOf(lookups.fraud_category, r.fraud_category)}
                          </div>
                          {!compact && (
                            <div
                              className={`text-xs truncate ${t.muted}`}
                              title={r.description}
                            >
                              {r.description}
                            </div>
                          )}
                        </td>
                        <td
                          className={`px-4 ${pad} whitespace-nowrap tabular-nums`}
                        >
                          <div className={`text-sm font-semibold ${t.text}`}>
                            {fmtMoney(r.loss_amount)}
                          </div>
                          <div className={`text-xs ${t.faint}`}>
                            rec. {fmtMoney(r.recovered_amount)}
                            {!compact && net > 0 && (
                              <span
                                className={
                                  dark ? 'text-red-300' : 'text-red-600'
                                }
                              >
                                {' '}
                                · net {fmtMoney(net)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 ${pad}`}>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${statusStyle(statusLabel, closed, dark)}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className={`px-4 ${pad}`}>
                          <div className="flex flex-wrap gap-1">
                            <Chip
                              on={
                                isYes(r.bsd_required) && !!r.bsd_reported_date
                              }
                              label="BSD"
                              dark={dark}
                              title={
                                isYes(r.bsd_required)
                                  ? r.bsd_reported_date
                                    ? `Reported ${fmtDate(r.bsd_reported_date)}`
                                    : 'Required — not yet reported'
                                  : 'Not required'
                              }
                            />
                            <Chip
                              on={
                                isYes(r.police_required) &&
                                !!r.police_reported_date
                              }
                              label="POL"
                              dark={dark}
                              title={
                                isYes(r.police_required)
                                  ? r.police_reported_date
                                    ? `Reported ${fmtDate(r.police_reported_date)}`
                                    : 'Required — not yet reported'
                                  : 'Not required'
                              }
                            />
                            <Chip
                              on={!!r.goaml_reported_date}
                              label="GoAML"
                              dark={dark}
                              title={
                                r.goaml_reported_date
                                  ? `Reported ${fmtDate(r.goaml_reported_date)}`
                                  : 'Not reported'
                              }
                            />
                          </div>
                        </td>
                        <td className={`px-4 ${pad} whitespace-nowrap`}>
                          {r.target_completion_date ? (
                            <div
                              className={`text-sm ${overdue ? (dark ? 'text-red-300' : 'text-red-600') : t.body}`}
                            >
                              {fmtDate(r.target_completion_date)}
                              {overdue && (
                                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold">
                                  <Clock className="w-3 h-3" />
                                  Overdue
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={t.faint}>—</span>
                          )}
                        </td>
                        <td
                          className={`px-4 ${pad} text-right`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={open}
                              title="View"
                              aria-label={`View incident ${r.internal_ref_no}`}
                              className={`p-1.5 rounded-lg ${dark ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <PermissionGuard
                              menuId={MENU_ID}
                              action="edit"
                              fallback={null}
                            >
                              <button
                                onClick={() =>
                                  setDialog({
                                    kind: 'form',
                                    mode: 'edit',
                                    incident: r,
                                  })
                                }
                                title="Edit"
                                aria-label={`Edit incident ${r.internal_ref_no}`}
                                className={`p-1.5 rounded-lg ${dark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setDialog({ kind: 'status', incident: r })
                                }
                                disabled={
                                  lookups.investigation_status.length === 0
                                }
                                title="Update status"
                                aria-label={`Update status of ${r.internal_ref_no}`}
                                className={`p-1.5 rounded-lg disabled:opacity-40 ${dark ? 'bg-green-500/20 hover:bg-green-500/30 text-green-300' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}
                              >
                                <Repeat className="w-4 h-4" />
                              </button>
                            </PermissionGuard>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div
              className={`flex flex-col sm:flex-row gap-3 justify-between sm:items-center px-4 py-2.5 border-t ${t.line}`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-sm ${t.muted}`}>
                  Page {page} of {Math.max(totalPages, 1)}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                  className={`px-2 py-1 rounded-lg text-sm ${t.input}`}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} per page
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed ${t.btn}`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <div className="hidden md:flex gap-1">
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      aria-current={page === p ? 'page' : undefined}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${
                        page === p
                          ? dark
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                          : dark
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  {totalPages > 5 && page < totalPages - 2 && (
                    <>
                      <span className={`self-center ${t.faint}`}>...</span>
                      <button
                        onClick={() => setPage(totalPages)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${dark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed ${t.btn}`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs — portaled; a single dialog state means two can never stack. */}
      <Portal>
        <AnimatePresence>
          {dialog?.kind === 'form' && (
            <IncidentDialog
              key={`${dialog.mode}-${dialog.incident?.id ?? 'new'}`}
              dark={dark}
              mode={dialog.mode}
              incident={dialog.incident}
              lookups={lookups}
              lookupsLoading={lookupsLoading}
              menuId={MENU_ID}
              onSwitchToEdit={() =>
                setDialog({
                  kind: 'form',
                  mode: 'edit',
                  incident: dialog.incident,
                })
              }
              onClose={() => setDialog(null)}
              onSaved={onSaved}
            />
          )}
          {dialog?.kind === 'status' && (
            <StatusDialog
              key={`status-${dialog.incident.id}`}
              dark={dark}
              incident={dialog.incident}
              lookups={lookups}
              onClose={() => setDialog(null)}
              onOpenEdit={() =>
                setDialog({
                  kind: 'form',
                  mode: 'edit',
                  incident: dialog.incident,
                })
              }
              onSaved={onSaved}
            />
          )}
        </AnimatePresence>
      </Portal>
    </PermissionGuard>
  );
};

export default FraudIncidentRegister;
