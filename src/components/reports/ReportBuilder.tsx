/**
 * Report Builder: Fraud Management  (v2, compact workspace)
 *
 * A self-service report designer for executive and analytical reporting.
 *   1. Data       pick a dataset and the fields the report may use, or start from a template
 *   2. Design     compose KPI cards, charts, insights, tables and commentary; configure each one
 *   3. Generate   review, set run parameters, save as a template, schedule, export
 *
 * Highlights
 *   - One-screen workspace: top bar carries stepper + actions; panels scroll internally
 *   - 9 chart types (doughnut, pie, column, stacked, bar, line, area, scatter, heatmap) with multi-series breakdowns
 *   - KPI cards with sparkline, period-over-period delta and target progress
 *   - Auto-written Key insights, commentary blocks with {{variables}}, annotations on every widget
 *   - Click-to-drill cross-filtering in Preview / Generate, expand any widget with its data table
 *   - Palettes, classification label, print page-breaks, undo/redo, templates (import/export JSON), scheduling
 *
 * Data model (v2.1)
 *   - Field types: text, category, number, decimal, currency, boolean, date, datetime
 *   - boolean: true/false, 1/0, yes/no, Y/N, T/F, on/off are all normalised; Yes-count and Yes-rate measures
 *   - decimal / currency: exact for NUMERIC(18,2) (scaled-integer maths, no float drift), per-field currency (AED)
 *   - ordinal categories: `order` (or inferred for badge fields) gives rank sorting, semantic colours, "at least" filters
 *   - custom fields: value bands, groups, date parts, calculations, rule segments (CASE WHEN / Yes-No flags)
 *   - sensitive fields masked in preview, tables and exports unless `canViewSensitive`
 *   - pivot tables, chart sorting, "Others" roll-up, 100% stacked, target lines, field profiling, autosave
 *
 * Integration points (all optional, sensible defaults included):
 *   - sources        real datasets (field catalogue + loadRows). Defaults to built-in mock fraud data.
 *   - templateStore  persistence for templates/drafts. Defaults to localStorage.
 *   - onGenerate     custom pipeline (e.g. server-side PDF/XLSX/e-mail). Required to enable the Excel format.
 *   - onBack         shows the back arrow in the top bar.
 *   - theme          'light' | 'dark' (wire this to your ThemeContext).
 *   - height         CSS height of the workspace on xl screens (default: calc(100vh - 6rem)).
 *   - currency       fallback ISO currency for currency fields without their own `currency` (default 'AED').
 *   - canViewSensitive  show fields flagged `sensitive` unmasked (default false).
 *
 * Dependencies: react, lucide-react, Tailwind CSS. No chart library: charts are SVG.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  AlertTriangle,
  AreaChart,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  BarChartHorizontal,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  GripVertical,
  Grid3x3,
  Hash,
  Landmark,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Lightbulb,
  LineChart as LineIcon,
  Loader2,
  Lock,
  Maximize2,
  Monitor,
  MousePointerClick,
  Palette as PaletteIcon,
  Pencil,
  PieChart,
  Play,
  Plus,
  Redo2,
  Save,
  ScatterChart,
  Search,
  Settings2,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Table2,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from 'lucide-react';

/* ==========================================================================
 * Types
 * ======================================================================== */
type FieldType =
  | 'text'
  | 'category'
  | 'number'
  | 'decimal'
  | 'currency'
  | 'boolean'
  | 'date'
  | 'datetime';
/** A normalised cell: decimals are canonical strings ("1234.50"), booleans are true/false, missing is null. */
type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

export interface FieldDef {
  key: string;
  label: string;
  /**
   * text | category | number (float/int) | decimal (exact, e.g. NUMERIC(18,2)) | currency (decimal + currency code)
   * | boolean (true/false, 1/0, yes/no, Y/N, T/F all accepted) | date | datetime
   */
  type: FieldType;
  group: string;
  /** Render category values as coloured pills (priority, severity, status...). */
  badge?: boolean;
  /**
   * Ordinal ranking of a category, highest first, e.g. ['Critical','High','Medium','Low'].
   * Ordinal fields sort by rank, keep a stable legend order, use semantic colours and
   * support "at least / at most" filters. Inferred automatically for badge fields that use severity words.
   */
  order?: string[];
  /** Decimal precision (total digits) and scale (digits after the point), e.g. 18 and 2 for NUMERIC(18,2). */
  precision?: number;
  scale?: number;
  /** ISO 4217 code for currency fields (e.g. 'AED'); overrides the page-level default. */
  currency?: string;
  /** Suffix shown after numbers, e.g. '%'. */
  unit?: string;
  /** Masked unless `canViewSensitive` is set (PII such as account numbers, names). */
  sensitive?: boolean;
  /** Sort category values naturally (A→Z, 2024 → 2025) instead of by frequency. */
  naturalSort?: boolean;
  /** Distinct values (filled in automatically). */
  values?: string[];
  /** True for user-defined custom fields. */
  derived?: boolean;
}

export interface RowLoadResult {
  rows: Row[];
  truncated: boolean;
}

export interface ReportSource {
  id: string;
  name: string;
  description: string;
  recordLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Field used for the report date range and date bucketing. */
  dateField: string;
  fields: FieldDef[];
  defaultFields: string[];
  /** Dates must be ISO strings (YYYY-MM-DD). */
  loadRows: () => Promise<RowLoadResult | Row[]> | RowLoadResult | Row[];
}

type Agg =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'distinct'
  | 'yes'
  | 'rate';
type FilterOp =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'after'
  | 'before'
  | 'atleast'
  | 'atmost';
type DateRangeKey = '7d' | '30d' | '90d' | '6m' | '12m' | 'all' | 'custom';
type Tone = 'blue' | 'red' | 'green' | 'violet' | 'amber' | 'slate';
type ChartType =
  | 'doughnut'
  | 'pie'
  | 'bar'
  | 'stacked'
  | 'hbar'
  | 'line'
  | 'area'
  | 'scatter'
  | 'heatmap'
  | 'pivot';
type Bucket = 'day' | 'week' | 'month';
type BucketPref = Bucket | 'auto';
type Span = 3 | 4 | 6 | 8 | 12;
type Height = 'sm' | 'md' | 'lg';
type PaletteKey = 'forest' | 'berry' | 'earth' | 'slate' | 'royal'| 'pastel' | 'citrus' | 'nordic' | 'ember' | 'aurora' | 'desert' | 'teal' | 'plum' | 'arctic' | 'candy' | 'contrast' ;
type Classification = 'none' | 'internal' | 'confidential' | 'restricted';

interface FilterRule {
  id: string;
  field: string;
  op: FilterOp;
  value: string;
}

interface BaseWidget {
  id: string;
  title: string;
  /** Short annotation shown under the title (executive commentary). */
  note?: string;
  span: Span;
  height: Height;
  /** Start this widget on a new page when printing / exporting to PDF. */
  pageBreak?: boolean;
  filters: FilterRule[];
}
interface KpiWidget extends BaseWidget {
  kind: 'kpi';
  agg: Agg;
  field?: string;
  tone: Tone;
  showTrend: boolean;
  showSparkline: boolean;
  lowerIsBetter: boolean;
  target?: number;
  /** compact = AED 1.2M, full = AED 1,234,567.89 (uses the field's scale). */
  format?: 'compact' | 'full';
}
interface ChartWidget extends BaseWidget {
  kind: 'chart';
  chartType: ChartType;
  groupBy: string;
  /** Second dimension: series (column/line/area/stacked) or columns (heatmap) or colour (scatter). */
  breakBy?: string;
  /** Scatter only: X-axis numeric field (Y is `field`). */
  xField?: string;
  bucket: BucketPref;
  agg: Agg;
  field?: string;
  topN: number;
  showLegend: boolean;
  showLabels: boolean;
  showPercentage: boolean;
  /** Category ordering: auto = rank/natural order, else by value or label. */
  sort?: 'auto' | 'valueDesc' | 'valueAsc' | 'label';
  /** Roll groups beyond "top N" into an "Others" bar. */
  others?: boolean;
  /** Stacked: show each bar as 100%. */
  normalize?: boolean;
  /** Dashed reference line (target / SLA) on column, line, area and stacked charts. */
  refLine?: number;
  /** Pivot: show row and column totals. */
  showTotals?: boolean;
}
interface TableWidget extends BaseWidget {
  kind: 'table';
  columns: string[];
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  limit: number;
  showTotals: boolean;
  dataBars: boolean;
}
interface TextWidget extends BaseWidget {
  kind: 'text';
  text: string;
  variant: 'heading' | 'paragraph' | 'callout';
}
interface InsightWidget extends BaseWidget {
  kind: 'insight';
  groupBy: string;
  agg: Agg;
  field?: string;
  bucket: BucketPref;
  /** Noun used in generated sentences, e.g. "cases". */
  subject: string;
}
type Widget =
  | KpiWidget
  | ChartWidget
  | TableWidget
  | TextWidget
  | InsightWidget;

type DerivedBase = { id: string; key: string; label: string };
/** Numeric field → ordered ranges, e.g. < 1,000 | 1,000 – 4,999 | ≥ 5,000. */
type BandsDerived = DerivedBase & {
  kind: 'bands';
  source: string;
  edges: number[];
  labels?: string[];
};
/** Category values → your own groups, e.g. Card fraud + Identity theft → "Customer-facing". */
type GroupsDerived = DerivedBase & {
  kind: 'groups';
  source: string;
  groups: { name: string; values: string[] }[];
  other: string;
};
type DatePart =
  | 'year'
  | 'quarter'
  | 'yearQuarter'
  | 'month'
  | 'weekday'
  | 'hour';
type DatePartDerived = DerivedBase & {
  kind: 'dateparts';
  source: string;
  part: DatePart;
};
type CalcOp = 'add' | 'sub' | 'mul' | 'div' | 'pct';
/** Row-level arithmetic between two numeric fields (Net loss = Amount − Recovered, Recovery % ...). */
type CalcDerived = DerivedBase & {
  kind: 'calc';
  a: string;
  b: string;
  op: CalcOp;
};
/** CASE WHEN segmentation: first matching case wins; optional Yes/No flag output. */
type RulesDerived = DerivedBase & {
  kind: 'rules';
  cases: { id: string; label: string; rules: FilterRule[] }[];
  otherwise: string;
  asBoolean?: boolean;
};
type DerivedField =
  | BandsDerived
  | GroupsDerived
  | DatePartDerived
  | CalcDerived
  | RulesDerived;
type DerivedKind = DerivedField['kind'];

type ScheduleFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
interface Schedule {
  frequency: ScheduleFrequency;
  recipients: string;
}

export interface ReportDefinition {
  name: string;
  description: string;
  sourceId: string;
  fields: string[];
  widgets: Widget[];
  filters: FilterRule[];
  dateRange: DateRangeKey;
  customFrom?: string;
  customTo?: string;
  palette: PaletteKey;
  classification: Classification;
  /** Compare KPI cards with the previous period. */
  compare: boolean;
  schedule: Schedule;
  /** Custom fields (bands, groups, date parts, calculations, rule segments). */
  derived: DerivedField[];
  createdAt: string;
}

export type TemplateVisibility = 'private' | 'team' | 'org';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  definition: ReportDefinition;
  isDraft: boolean;
  visibility: TemplateVisibility;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  builtIn?: boolean;
}

export interface ReportTemplateStore {
  list: () => Promise<ReportTemplate[]>;
  save: (template: ReportTemplate) => Promise<ReportTemplate>;
  remove: (id: string) => Promise<void>;
}

type OutputFormat = 'pdf' | 'csv' | 'xlsx';
interface OutputOptions {
  format: OutputFormat;
  orientation: 'portrait' | 'landscape';
  paper: 'A4' | 'Letter';
}

export interface GeneratePayload {
  definition: ReportDefinition;
  templateId?: string;
  rows: Row[];
  columns: FieldDef[];
  format: OutputFormat;
  options: OutputOptions;
  schedule: Schedule;
}

export interface ReportBuilderProps {
  sources?: ReportSource[];
  templateStore?: ReportTemplateStore;
  onGenerate?: (payload: GeneratePayload) => Promise<void> | void;
  onBack?: () => void;
  currentUser?: string;
  currency?: string;
  theme?: 'light' | 'dark';
  /** CSS height of the workspace on xl screens. */
  height?: string;
  /** Show fields flagged `sensitive` unmasked (preview, tables, exports). Default: masked. */
  canViewSensitive?: boolean;
}

/* ==========================================================================
 * Small utilities
 * ======================================================================== */
const uid = () => Math.random().toString(36).slice(2, 10);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parseIso = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
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

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'report';

const fmtDate = (s: string) =>
  s
    ? parseIso(s.slice(0, 10)).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

const fmtDateTime = (s: string) => {
  if (!s) return '';
  const t = s.length > 10 ? s : `${s}T00:00:00Z`;
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);
  return Number.isNaN(d.getTime())
    ? s
    : `${fmtDate(s)} ${d.toISOString().slice(11, 16)}`;
};

/* ==========================================================================
 * Built-in mock fraud datasets (replace through the `sources` prop)
 *
 * Values arrive "messy" on purpose, the way real drivers return them:
 *   - NUMERIC(18,2) as strings ("1234.50")      → normalised to exact decimals
 *   - booleans as Y/N, 1/0, true/false, yes/no  → normalised to true/false
 *   - timestamps as ISO strings                  → datetime
 * ======================================================================== */
interface Gen {
  r: () => number;
  pick<T>(a: T[]): T;
  uniform<T>(a: T[]): T;
  w<T>(pairs: [T, number][]): T;
  day(max?: number): string;
  stamp(max?: number): string;
  /** NUMERIC(18,2) the way node-postgres returns it: a string with two decimals. */
  dec(min: number, max: number): string;
  /** Boolean in a random real-world encoding. */
  flag(p: number): string | number | boolean;
}

function makeRows(
  seed: number,
  n: number,
  build: (g: Gen, i: number) => Row
): Row[] {
  const r = rng(seed);
  const now = new Date();
  const g: Gen = {
    r,
    pick: (a) => a[Math.floor(r() ** 1.5 * a.length)],
    uniform: (a) => a[Math.floor(r() * a.length)],
    w: (pairs) => {
      let x = r() * pairs.reduce((s, p) => s + p[1], 0);
      for (const [v, wt] of pairs) if ((x -= wt) <= 0) return v;
      return pairs[0][0];
    },
    day: (max = 400) => iso(addDays(now, -Math.floor(r() ** 1.25 * max))),
    stamp: (max = 400) => {
      const hh = String(Math.floor(r() * 24)).padStart(2, '0');
      const mm = String(Math.floor(r() * 60)).padStart(2, '0');
      return `${iso(addDays(now, -Math.floor(r() ** 1.25 * max)))}T${hh}:${mm}:00Z`;
    },
    dec: (min, max) => (min + r() ** 3 * (max - min)).toFixed(2),
    flag: (p) => {
      const v = r() < p;
      const style = Math.floor(r() * 4);
      return [v ? 'Y' : 'N', v ? 1 : 0, v, v ? 'yes' : 'no'][style];
    },
  };
  return Array.from({ length: n }, (_, i) => build(g, i));
}

const f = (
  key: string,
  label: string,
  type: FieldType,
  group: string,
  o: Partial<FieldDef> = {}
): FieldDef => ({
  key,
  label,
  type,
  group,
  ...o,
});
/** NUMERIC(18,2) amount in AED. */
const aed = (key: string, label: string, group = 'Financial'): FieldDef =>
  f(key, label, 'currency', group, {
    precision: 18,
    scale: 2,
    currency: 'AED',
  });

const CHANNELS = [
  'Online',
  'Mobile app',
  'POS',
  'ATM',
  'Branch',
  'Call centre',
];
const REGIONS = ['North America', 'EMEA', 'APAC', 'LATAM', 'Middle East'];
const ANALYSTS = [
  'A. Hassan',
  'M. Rossi',
  'J. Okafor',
  'L. Chen',
  'S. Patel',
  'R. Duarte',
];
const FRAUD_TYPES = [
  'Card fraud',
  'Account takeover',
  'Identity theft',
  'Payment fraud',
  'Application fraud',
  'Insider fraud',
];
const CASE_TITLES: Record<string, string[]> = {
  'Card fraud': ['Cloned card used abroad', 'Card-not-present burst'],
  'Account takeover': ['Credential stuffing login', 'SIM-swap password reset'],
  'Identity theft': ['Synthetic identity onboarding', 'Stolen ID loan request'],
  'Payment fraud': ['Mule account transfers', 'Authorised push payment scam'],
  'Application fraud': [
    'Falsified income documents',
    'Duplicate application ring',
  ],
  'Insider fraud': ['Unusual staff override', 'Dormant account manipulation'],
};
const MERCHANTS = [
  'TechMart',
  'AeroTickets',
  'QuickFuel',
  'LuxWatch Co',
  'GameVault',
  'GiftCardHub',
  'FreshGrocer',
  'CryptoBridge',
  'HomeDepotX',
  'StreamPlus',
];
const PRIORITY = ['Critical', 'High', 'Medium', 'Low'];

const SOURCES: ReportSource[] = [
  {
    id: 'cases',
    name: 'Fraud cases',
    description: 'Investigations with severity, status, exposure and recovery.',
    recordLabel: 'cases',
    icon: ShieldAlert,
    dateField: 'opened',
    fields: [
      f('case_id', 'Case ID', 'text', 'Case information'),
      f('title', 'Case title', 'text', 'Case information'),
      f('fraud_type', 'Fraud type', 'category', 'Case information'),
      f('channel', 'Channel', 'category', 'Case information'),
      f('severity', 'Severity', 'category', 'Case information', {
        badge: true,
      }),
      f('status', 'Status', 'category', 'Case information', { badge: true }),
      f('is_repeat', 'Repeat customer', 'boolean', 'Case information'),
      aed('amt_aed', 'Amount at risk'),
      aed('recovered_aed', 'Recovered amount'),
      f('investigator', 'Investigator', 'category', 'Assignment'),
      f('region', 'Region', 'category', 'Assignment'),
      f('customer_ref', 'Customer reference', 'text', 'Assignment', {
        sensitive: true,
      }),
      f('opened', 'Opened date', 'date', 'Dates'),
      f('days_open', 'Days open', 'number', 'Dates'),
    ],
    defaultFields: [
      'case_id',
      'title',
      'fraud_type',
      'severity',
      'status',
      'amt_aed',
      'investigator',
      'opened',
    ],
    loadRows: () =>
      makeRows(11, 320, (g, i) => {
        const type = g.pick(FRAUD_TYPES);
        const status = g.w([
          ['Open', 3],
          ['Under investigation', 3],
          ['Escalated', 1],
          ['Confirmed fraud', 2],
          ['Closed', 3],
        ]);
        const amount = g.dec(250, 95000);
        const settled = status === 'Closed' || status === 'Confirmed fraud';
        return {
          case_id: `FC-${2000 + i}`,
          title: `${type}: ${g.uniform(CASE_TITLES[type])}`,
          fraud_type: type,
          channel: g.pick(CHANNELS),
          severity: g.w([
            ['Low', 3],
            ['Medium', 4],
            ['High', 3],
            ['Critical', 1],
          ]),
          status,
          is_repeat: g.flag(0.22),
          amt_aed: amount,
          recovered_aed: settled
            ? (Number(amount) * g.r() * 0.7).toFixed(2)
            : '0.00',
          investigator: g.uniform(ANALYSTS),
          region: g.uniform(REGIONS),
          customer_ref: `CUST-${100000 + Math.floor(g.r() * 899999)}`,
          opened: g.day(),
          days_open: Math.max(1, Math.round(g.r() ** 1.5 * 45)),
        };
      }),
  },
  {
    id: 'alerts',
    name: 'Fraud alerts',
    description:
      'Rule and model alerts with priority, escalation and SAR outcomes.',
    recordLabel: 'alerts',
    icon: BellRing,
    dateField: 'triggered',
    fields: [
      f('alert_id', 'Alert ID', 'text', 'Alert information'),
      f('rule', 'Detection rule', 'category', 'Alert information'),
      f('rule_priority', 'Rule priority', 'category', 'Alert information', {
        badge: true,
        order: PRIORITY,
      }),
      f('severity', 'Severity', 'category', 'Alert information', {
        badge: true,
      }),
      f('status', 'Status', 'category', 'Alert information', { badge: true }),
      f('channel', 'Channel', 'category', 'Alert information'),
      f('score', 'Risk score', 'number', 'Scoring'),
      aed('amt_aed', 'Transaction amount'),
      f('is_escalated', 'Escalated', 'boolean', 'Outcome'),
      f('sar_filed', 'SAR filed', 'boolean', 'Outcome'),
      f('analyst', 'Analyst', 'category', 'Assignment'),
      f('customer_ref', 'Customer reference', 'text', 'Assignment', {
        sensitive: true,
      }),
      f('triggered', 'Triggered at', 'datetime', 'Dates'),
    ],
    defaultFields: [
      'alert_id',
      'rule',
      'rule_priority',
      'status',
      'score',
      'amt_aed',
      'is_escalated',
      'analyst',
      'triggered',
    ],
    loadRows: () =>
      makeRows(23, 520, (g, i) => {
        const priority = g.w([
          ['Critical', 1],
          ['High', 2],
          ['Medium', 4],
          ['Low', 4],
        ]);
        const hot = priority === 'Critical' || priority === 'High';
        return {
          alert_id: `AL-${50000 + i}`,
          rule: g.pick([
            'Velocity: 5+ txns in 10 min',
            'Impossible travel',
            'New device, high value',
            'Dormant account reactivated',
            'Beneficiary change then transfer',
            'Card-not-present spike',
          ]),
          rule_priority: priority,
          severity: g.w([
            ['Low', 4],
            ['Medium', 4],
            ['High', 2],
            ['Critical', 1],
          ]),
          status: g.w([
            ['New', 2],
            ['In review', 2],
            ['False positive', 5],
            ['Confirmed', 2],
            ['Escalated', 1],
          ]),
          channel: g.pick(CHANNELS),
          score: Math.round(30 + g.r() * 70),
          amt_aed: g.dec(20, hot ? 60000 : 25000),
          is_escalated: g.flag(hot ? 0.45 : 0.08),
          sar_filed: g.r() < (hot ? 0.3 : 0.04) ? 1 : 0,
          analyst: g.uniform(ANALYSTS),
          customer_ref: `CUST-${100000 + Math.floor(g.r() * 899999)}`,
          triggered: g.stamp(),
        };
      }),
  },
  {
    id: 'transactions',
    name: 'Transactions',
    description: 'Scored payment activity with decisions and merchant context.',
    recordLabel: 'transactions',
    icon: CreditCard,
    dateField: 'txn_date',
    fields: [
      f('txn_id', 'Transaction ID', 'text', 'Transaction'),
      f('merchant', 'Merchant', 'category', 'Transaction'),
      f('channel', 'Channel', 'category', 'Transaction'),
      f('country', 'Country', 'category', 'Transaction'),
      f('is_international', 'International', 'boolean', 'Transaction'),
      aed('amt_aed', 'Amount'),
      f('risk_score', 'Risk score', 'number', 'Scoring'),
      f('decision', 'Decision', 'category', 'Scoring', { badge: true }),
      f('txn_date', 'Transaction date', 'date', 'Dates'),
    ],
    defaultFields: [
      'txn_id',
      'merchant',
      'channel',
      'amt_aed',
      'risk_score',
      'decision',
      'txn_date',
    ],
    loadRows: () =>
      makeRows(37, 640, (g, i) => ({
        txn_id: `TX-${900000 + i}`,
        merchant: g.pick(MERCHANTS),
        channel: g.pick(CHANNELS),
        country: g.pick(['AE', 'GB', 'US', 'SG', 'DE', 'BR', 'NG', 'IN']),
        is_international: g.flag(0.3),
        amt_aed: g.dec(5, 12000),
        risk_score: Math.round(g.r() ** 1.6 * 100),
        decision: g.w([
          ['Approved', 8],
          ['Manual review', 2],
          ['Declined', 2],
        ]),
        txn_date: g.day(),
      })),
  },
  {
    id: 'chargebacks',
    name: 'Chargebacks',
    description: 'Disputed card payments, reasons and representment outcomes.',
    recordLabel: 'chargebacks',
    icon: Landmark,
    dateField: 'filed',
    fields: [
      f('cb_id', 'Chargeback ID', 'text', 'Dispute'),
      f('merchant', 'Merchant', 'category', 'Dispute'),
      f('reason', 'Reason', 'category', 'Dispute'),
      f('network', 'Card network', 'category', 'Dispute'),
      f('status', 'Status', 'category', 'Dispute', { badge: true }),
      f('is_represented', 'Represented', 'boolean', 'Dispute'),
      aed('amt_aed', 'Disputed amount'),
      f('filed', 'Filed date', 'date', 'Dates'),
    ],
    defaultFields: [
      'cb_id',
      'merchant',
      'reason',
      'network',
      'status',
      'amt_aed',
      'filed',
    ],
    loadRows: () =>
      makeRows(53, 260, (g, i) => ({
        cb_id: `CB-${7000 + i}`,
        merchant: g.pick(MERCHANTS),
        reason: g.pick([
          'Fraud: card not present',
          'Fraud: lost or stolen',
          'Transaction not recognised',
          'Duplicate processing',
          'Service not received',
        ]),
        network: g.pick(['Visa', 'Mastercard', 'Amex', 'Discover']),
        status: g.w([
          ['Open', 3],
          ['Pending', 2],
          ['Won', 3],
          ['Lost', 2],
        ]),
        is_represented: g.flag(0.55),
        amt_aed: g.dec(25, 9000),
        filed: g.day(),
      })),
  },
];

/* ==========================================================================
 * Data engine: types, normalisation, filters, grouping, aggregation, formatting
 * ======================================================================== */
const isNumeric = (t: FieldType) =>
  t === 'number' || t === 'decimal' || t === 'currency';
/** Exact-decimal types (NUMERIC / DECIMAL / money). */
const isDecimal = (t: FieldType) => t === 'decimal' || t === 'currency';
const isDateType = (t: FieldType) => t === 'date' || t === 'datetime';
/** Types that behave like categories when grouping. */
const isCat = (t: FieldType) => t === 'category' || t === 'boolean';
/** Types that can be used to group / break down a chart. */
const isDim = (t: FieldType) => isCat(t) || isDateType(t);
const scaleOf = (fd?: FieldDef) =>
  fd ? (fd.scale ?? (isDecimal(fd.type) ? 2 : 0)) : 0;

/* ---- booleans: true/false, 1/0, yes/no, Y/N, T/F, on/off ---- */
const TRUE_SET = new Set(['true', 't', 'yes', 'y', '1', 'on']);
const FALSE_SET = new Set(['false', 'f', 'no', 'n', '0', 'off']);
function toBoolean(v: unknown): boolean | null {
  if (v === true || v === false) return v;
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null;
  const s = String(v).trim().toLowerCase();
  if (TRUE_SET.has(s)) return true;
  if (FALSE_SET.has(s)) return false;
  return null;
}

/* ---- exact decimals: values are handled as scaled integers (cents), never as floats ----
 * 1234.56 → 123456. Sums stay exact while |value| < 2^53 / 10^scale
 * (≈ 90 trillion units at scale 2), far beyond any realistic NUMERIC(18,2) report total.
 */
function toScaled(v: unknown, scale: number): number | null {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean')
    return null;
  let s =
    typeof v === 'number'
      ? Number.isFinite(v)
        ? v.toFixed(scale + 2)
        : ''
      : String(v);
  s = s
    .trim()
    .replace(/[,\s]/g, '')
    .replace(/^\((.*)\)$/, '-$1');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === '' && !m[3])) {
    const n = Number(s);
    return s !== '' && Number.isFinite(n) ? Math.round(n * 10 ** scale) : null;
  }
  const sign = m[1] === '-' ? -1 : 1;
  const frac = m[3] ?? '';
  let n = Number((m[2] || '0') + (frac + '0'.repeat(scale)).slice(0, scale));
  if (frac.length > scale && frac.charAt(scale) >= '5') n += 1; // round half up
  return sign * n;
}
const canonDecimal = (v: unknown, scale: number): string | null => {
  const n = toScaled(v, scale);
  return n === null ? null : (n / 10 ** scale).toFixed(scale);
};

/** Coerce a raw driver row into typed cells (once, on load). */
function normalizeRows(rows: Row[], fields: FieldDef[]): Row[] {
  return rows.map((r) => {
    const out: Row = { ...r };
    for (const fd of fields) {
      const v = r[fd.key];
      if (fd.type === 'boolean') out[fd.key] = toBoolean(v);
      else if (isDecimal(fd.type)) out[fd.key] = canonDecimal(v, scaleOf(fd));
      else if (fd.type === 'number') {
        const n = v === null || v === undefined || v === '' ? NaN : Number(v);
        out[fd.key] = Number.isFinite(n) ? n : null;
      } else if (fd.type === 'date')
        out[fd.key] = v ? String(v).slice(0, 10) : null;
      else if (fd.type === 'datetime') out[fd.key] = v ? String(v) : null;
      else
        out[fd.key] =
          v === null || v === undefined || v === '' ? null : String(v);
    }
    return out;
  });
}

/** The label a cell groups / filters / cross-filters under. */
function cellKey(fd: FieldDef | undefined, r: Row): string {
  const v = fd ? r[fd.key] : undefined;
  if (v === null || v === undefined || v === '') return 'Unknown';
  if (fd?.type === 'boolean')
    return v === true ? 'Yes' : v === false ? 'No' : 'Unknown';
  return String(v);
}

/** Position in the field's ordinal ranking (0 = highest), or -1. */
const rankOf = (fd: FieldDef | undefined, label: string) =>
  fd?.order
    ? fd.order.findIndex((o) => o.toLowerCase() === label.toLowerCase())
    : -1;
const rankOrLast = (fd: FieldDef, label: string) => {
  const i = rankOf(fd, label);
  return i < 0 ? 999 : i;
};

const SEVERITY_VOCAB = [
  'critical',
  'very high',
  'high',
  'medium',
  'moderate',
  'low',
  'very low',
  'informational',
  'info',
];

/** Add distinct values and infer ordinal ranking for severity-style badge fields. */
function enrichFields(fields: FieldDef[], rows: Row[]): FieldDef[] {
  return fields.map((fd) => {
    if (fd.type === 'boolean')
      return { ...fd, order: ['Yes', 'No', 'Unknown'], values: ['Yes', 'No'] };
    if (fd.type !== 'category') return fd;
    const distinct = [...new Set(rows.map((r) => cellKey(fd, r)))].filter(
      (d) => d !== 'Unknown'
    );
    let order = fd.order;
    if (
      !order &&
      fd.badge &&
      distinct.length &&
      distinct.every((d) => SEVERITY_VOCAB.includes(d.toLowerCase()))
    ) {
      order = [...distinct].sort(
        (a, b) =>
          SEVERITY_VOCAB.indexOf(a.toLowerCase()) -
          SEVERITY_VOCAB.indexOf(b.toLowerCase())
      );
    }
    const values = order
      ? [
          ...order.filter((o) => distinct.includes(o)),
          ...distinct.filter((d) => !order!.includes(d)).sort(),
        ]
      : distinct.sort();
    return { ...fd, order, values };
  });
}

/* ---- filters ---- */
const opsFor = (fd: FieldDef): FilterOp[] =>
  fd.type === 'boolean'
    ? ['eq', 'neq']
    : fd.type === 'category'
      ? fd.order
        ? ['eq', 'neq', 'atleast', 'atmost']
        : ['eq', 'neq']
      : fd.type === 'text'
        ? ['contains', 'eq']
        : isNumeric(fd.type)
          ? ['gt', 'lt', 'eq']
          : ['after', 'before'];

const OP_LABEL: Record<FilterOp, string> = {
  eq: 'is',
  neq: 'is not',
  contains: 'contains',
  gt: 'greater than',
  lt: 'less than',
  after: 'after',
  before: 'before',
  atleast: 'is at least',
  atmost: 'is at most',
};

function matches(row: Row, rule: FilterRule, fd?: FieldDef): boolean {
  const raw = row[rule.field];
  const s = fd ? cellKey(fd, row) : String(raw ?? '');
  const want = rule.value;
  const numeric = !!fd && isNumeric(fd.type);
  switch (rule.op) {
    case 'eq':
      return numeric
        ? raw !== null && raw !== '' && Number(raw) === Number(want)
        : s.toLowerCase() === want.toLowerCase();
    case 'neq':
      return numeric
        ? !(raw !== null && raw !== '' && Number(raw) === Number(want))
        : s.toLowerCase() !== want.toLowerCase();
    case 'contains':
      return s.toLowerCase().includes(want.toLowerCase());
    case 'gt':
      return raw !== null && raw !== '' && Number(raw) > Number(want);
    case 'lt':
      return raw !== null && raw !== '' && Number(raw) < Number(want);
    case 'after':
      return s !== 'Unknown' && s.slice(0, 10) > want.slice(0, 10);
    case 'before':
      return s !== 'Unknown' && s.slice(0, 10) < want.slice(0, 10);
    case 'atleast': {
      const a = rankOf(fd, s),
        b = rankOf(fd, want);
      return a >= 0 && b >= 0 && a <= b;
    }
    case 'atmost': {
      const a = rankOf(fd, s),
        b = rankOf(fd, want);
      return a >= 0 && b >= 0 && a >= b;
    }
  }
}

const activeRules = (rules: FilterRule[]) =>
  rules.filter((r) => r.field && r.value !== '');

function applyFilters(
  rows: Row[],
  rules: FilterRule[],
  fm: Map<string, FieldDef>
): Row[] {
  const active = activeRules(rules).filter((r) => fm.has(r.field));
  return active.length
    ? rows.filter((row) =>
        active.every((r) => matches(row, r, fm.get(r.field)))
      )
    : rows;
}

/* ---- date windows ---- */
const RANGE_LABEL: Record<DateRangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  all: 'All time',
  custom: 'Custom range',
};
const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '6m': 182,
  '12m': 365,
};

interface Win {
  from: string;
  to: string;
  days: number;
}
function windowFor(
  range: DateRangeKey,
  from?: string,
  to?: string
): Win | null {
  if (range === 'all') return null;
  if (range === 'custom') {
    if (!from || !to || from > to) return null;
    const days =
      Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 864e5) +
      1;
    return { from, to, days };
  }
  const days = RANGE_DAYS[range];
  const end = new Date();
  return { from: iso(addDays(end, -(days - 1))), to: iso(end), days };
}
function prevWindow(w: Win): Win {
  const end = addDays(parseIso(w.from), -1);
  return { from: iso(addDays(end, -(w.days - 1))), to: iso(end), days: w.days };
}
const inWindow = (row: Row, field: string, w: Win | null) => {
  if (!w) return true;
  const d = String(row[field] ?? '').slice(0, 10);
  return d >= w.from && d <= w.to;
};

/* ---- aggregation (exact for decimal fields) ---- */
function aggregate(
  rows: Row[],
  agg: Agg,
  field: string | undefined,
  fm: Map<string, FieldDef>
): number {
  if (agg === 'count' || !field) return rows.length;
  const fd = fm.get(field);
  const present = (r: Row) =>
    r[field] !== null && r[field] !== undefined && r[field] !== '';
  if (agg === 'distinct')
    return new Set(rows.filter(present).map((r) => cellKey(fd, r))).size;
  if (agg === 'yes' || agg === 'rate') {
    let yes = 0,
      known = 0;
    for (const r of rows) {
      const b = toBoolean(r[field]);
      if (b === null) continue;
      known++;
      if (b) yes++;
    }
    return agg === 'yes' ? yes : known ? (yes / known) * 100 : 0;
  }
  if (fd && isDecimal(fd.type)) {
    const sc = scaleOf(fd);
    let sum = 0,
      n = 0,
      min = Infinity,
      max = -Infinity;
    for (const r of rows) {
      const v = toScaled(r[field], sc);
      if (v === null) continue;
      sum += v;
      n++;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (n === 0) return 0;
    const div = 10 ** sc;
    if (agg === 'sum') return sum / div;
    if (agg === 'avg') return Math.round(sum / n) / div;
    return (agg === 'max' ? max : min) / div;
  }
  const nums = rows
    .filter(present)
    .map((r) => Number(r[field]))
    .filter(Number.isFinite);
  if (nums.length === 0) return 0;
  if (agg === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  return agg === 'max' ? Math.max(...nums) : Math.min(...nums);
}

function bucketKey(s: string, bucket: Bucket): string {
  if (!s) return '';
  if (bucket === 'day') return s;
  if (bucket === 'month') return s.slice(0, 7);
  const d = parseIso(s);
  return iso(addDays(d, -((d.getUTCDay() + 6) % 7)));
}

/** All groups of a field, in natural order: chronological, ordinal rank, natural A→Z, else by frequency. */
function groupRows(rows: Row[], field: FieldDef, bucket: Bucket) {
  const map = new Map<string, Row[]>();
  const date = isDateType(field.type);
  for (const r of rows) {
    const k = date
      ? bucketKey(String(r[field.key] ?? '').slice(0, 10), bucket)
      : cellKey(field, r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  let groups = [...map].map(([key, list]) => ({ key, rows: list }));
  if (date)
    groups = groups
      .filter((g) => g.key)
      .sort((a, b) => a.key.localeCompare(b.key));
  else if (field.order)
    groups.sort((a, b) => rankOrLast(field, a.key) - rankOrLast(field, b.key));
  else if (field.naturalSort)
    groups.sort((a, b) =>
      a.key.localeCompare(b.key, undefined, { numeric: true })
    );
  else groups.sort((a, b) => b.rows.length - a.rows.length);
  const multiYear = new Set(groups.map((g) => g.key.slice(0, 4))).size > 1;
  const label = (key: string) => {
    if (!date) return key;
    const [y, m, d] = key.split('-');
    const mon = MONTHS[Number(m) - 1];
    if (bucket === 'month') return multiYear ? `${mon} ${y.slice(2)}` : mon;
    return `${mon} ${Number(d)}`;
  };
  return groups.map((g) => ({ ...g, label: label(g.key) }));
}

/* ---- formatting ---- */
const compact = (v: number, digits = 1) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: digits,
  }).format(v);

function fmtMeasure(
  v: number,
  agg: Agg,
  fd: FieldDef | undefined,
  currency: string,
  mode: 'compact' | 'full' = 'compact'
): string {
  if (agg === 'rate') return `${v.toFixed(1)}%`;
  const plainCount = agg === 'count' || agg === 'distinct' || agg === 'yes';
  const sc = scaleOf(fd);
  if (!plainCount && fd?.type === 'currency') {
    const cur = fd.currency ?? currency;
    if (mode === 'compact' && Math.abs(v) >= 1000) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: cur,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(v);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: sc,
      maximumFractionDigits: sc,
    }).format(v);
  }
  if (!plainCount && fd && isNumeric(fd.type)) {
    const dp = agg === 'avg' ? Math.max(sc, 1) : sc;
    const s =
      mode === 'compact' && Math.abs(v) >= 100000
        ? compact(v)
        : new Intl.NumberFormat('en-US', {
            minimumFractionDigits: dp,
            maximumFractionDigits: dp,
          }).format(v);
    return fd.unit ? `${s}${fd.unit}` : s;
  }
  return mode === 'compact' && Math.abs(v) >= 100000
    ? compact(v)
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v);
}

function aggLabel(agg: Agg) {
  return {
    count: 'Count',
    sum: 'Sum',
    avg: 'Average',
    min: 'Minimum',
    max: 'Maximum',
    distinct: 'Distinct count',
    yes: 'Count of Yes',
    rate: 'Rate of Yes (%)',
  }[agg];
}

/** Aggregations that add up across groups (shares of total make sense). */
const ADDITIVE: Agg[] = ['count', 'sum', 'yes'];

/* ---- sorting + export helpers ---- */
function compareCells(fd: FieldDef, a: Cell, b: Cell): number {
  const na = a === null || a === undefined || a === '';
  const nb = b === null || b === undefined || b === '';
  if (na || nb) return na === nb ? 0 : na ? -1 : 1;
  if (fd.type === 'boolean') return (a === true ? 1 : 0) - (b === true ? 1 : 0);
  if (fd.order) return rankOrLast(fd, String(b)) - rankOrLast(fd, String(a)); // higher priority = greater
  if (isNumeric(fd.type)) return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

const MASK = '••••••';
function exportCell(
  fd: FieldDef,
  v: Cell | undefined,
  canViewSensitive: boolean
): string | number {
  if (fd.sensitive && !canViewSensitive) return MASK;
  if (v === null || v === undefined) return '';
  if (fd.type === 'boolean')
    return v === true ? 'Yes' : v === false ? 'No' : '';
  return v as string | number;
}

/* ---- field profile (data-quality summary) ---- */
interface FieldProfile {
  total: number;
  nulls: number;
  distinct: number;
  min?: string;
  max?: string;
  avg?: string;
  top: { label: string; n: number }[];
}
function profileField(fd: FieldDef, rows: Row[]): FieldProfile {
  const total = rows.length;
  const present = rows.filter(
    (r) => r[fd.key] !== null && r[fd.key] !== undefined && r[fd.key] !== ''
  );
  const p: FieldProfile = {
    total,
    nulls: total - present.length,
    distinct: new Set(present.map((r) => cellKey(fd, r))).size,
    top: [],
  };
  if (isNumeric(fd.type) && present.length) {
    const sc = scaleOf(fd);
    const nums = present.map((r) => Number(r[fd.key])).filter(Number.isFinite);
    const show = (n: number) =>
      n.toLocaleString('en-US', {
        minimumFractionDigits: sc,
        maximumFractionDigits: sc,
      });
    p.min = show(Math.min(...nums));
    p.max = show(Math.max(...nums));
    p.avg = show(aggregate(rows, 'avg', fd.key, new Map([[fd.key, fd]])));
  } else if (isDateType(fd.type) && present.length) {
    const ds = present.map((r) => String(r[fd.key]).slice(0, 10)).sort();
    p.min = fmtDate(ds[0]);
    p.max = fmtDate(ds[ds.length - 1]);
  } else if (isCat(fd.type)) {
    p.top = groupRows(rows, fd, 'month')
      .slice(0, 5)
      .map((g) => ({ label: g.key, n: g.rows.length }));
    if (fd.order)
      p.top = groupRows(rows, fd, 'month')
        .slice(0, 6)
        .map((g) => ({ label: g.key, n: g.rows.length }));
  }
  return p;
}

/* ==========================================================================
 * Custom fields (categorisation): bands, groups, date parts, calculations, rule segments
 * ======================================================================== */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PART_ORDER: Partial<Record<DatePart, string[]>> = {
  quarter: ['Q1', 'Q2', 'Q3', 'Q4'],
  month: MONTHS,
  weekday: WEEKDAYS,
  hour: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
};
const PART_LABEL: Record<DatePart, string> = {
  year: 'Year (2025)',
  quarter: 'Quarter (Q1-Q4)',
  yearQuarter: 'Year and quarter (2025-Q1)',
  month: 'Month name (Jan-Dec)',
  weekday: 'Day of week (Mon-Sun)',
  hour: 'Hour of day (00-23)',
};
const CALC_LABEL: Record<CalcOp, string> = {
  add: 'A + B',
  sub: 'A − B',
  mul: 'A × B',
  div: 'A ÷ B (ratio)',
  pct: 'A as % of B',
};
const DERIVED_LABEL: Record<DerivedKind, string> = {
  bands: 'Value bands',
  groups: 'Custom groups',
  dateparts: 'Date part',
  calc: 'Calculation',
  rules: 'Rule segments',
};

const fmtEdge = (n: number) =>
  Math.abs(n) >= 10000 ? compact(n, 1) : n.toLocaleString('en-US');
function bandLabelsOf(d: BandsDerived): string[] {
  const e = [...d.edges].sort((a, b) => a - b);
  const auto =
    e.length === 0
      ? ['All']
      : [
          `< ${fmtEdge(e[0])}`,
          ...e.slice(1).map((v, i) => `${fmtEdge(e[i])} – ${fmtEdge(v)}`),
          `≥ ${fmtEdge(e[e.length - 1])}`,
        ];
  return auto.map((l, i) => d.labels?.[i]?.trim() || l);
}

function derivedFieldDef(d: DerivedField, fm: Map<string, FieldDef>): FieldDef {
  const base = {
    key: d.key,
    label: d.label,
    group: 'Custom fields',
    derived: true,
  } as const;
  switch (d.kind) {
    case 'bands': {
      const order = bandLabelsOf(d);
      return { ...base, type: 'category', order, values: order };
    }
    case 'groups': {
      const order = [...d.groups.map((g) => g.name), d.other];
      return { ...base, type: 'category', order, values: order };
    }
    case 'dateparts': {
      const order = PART_ORDER[d.part];
      return {
        ...base,
        type: 'category',
        order,
        values: order,
        naturalSort: !order,
      };
    }
    case 'rules': {
      if (d.asBoolean)
        return {
          ...base,
          type: 'boolean',
          order: ['Yes', 'No', 'Unknown'],
          values: ['Yes', 'No'],
        };
      const order = [...d.cases.map((c) => c.label), d.otherwise];
      return { ...base, type: 'category', order, values: order };
    }
    case 'calc': {
      const a = fm.get(d.a),
        b = fm.get(d.b);
      if (d.op === 'div') return { ...base, type: 'number', scale: 2 };
      if (d.op === 'pct')
        return { ...base, type: 'number', scale: 1, unit: '%' };
      const sc = Math.max(scaleOf(a), scaleOf(b), 2);
      const money = a?.type === 'currency' || b?.type === 'currency';
      return {
        ...base,
        type: money ? 'currency' : 'decimal',
        scale: sc,
        precision: 18,
        currency: a?.currency ?? b?.currency,
      };
    }
  }
}

function derivedValue(
  d: DerivedField,
  r: Row,
  fm: Map<string, FieldDef>
): Cell {
  switch (d.kind) {
    case 'bands': {
      const v = r[d.source];
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      const e = [...d.edges].sort((a, b) => a - b);
      let i = 0;
      while (i < e.length && n >= e[i]) i++;
      return bandLabelsOf(d)[i];
    }
    case 'groups': {
      const k = cellKey(fm.get(d.source), r);
      return d.groups.find((g) => g.values.includes(k))?.name ?? d.other;
    }
    case 'dateparts': {
      const s = String(r[d.source] ?? '');
      if (!s) return null;
      let t = s.length > 10 ? s.replace(' ', 'T') : `${s}T00:00:00Z`;
      if (!/[zZ]|[+-]\d\d:?\d\d$/.test(t)) t += 'Z';
      const dt = new Date(t);
      if (Number.isNaN(dt.getTime())) return null;
      const y = dt.getUTCFullYear(),
        m = dt.getUTCMonth(),
        q = Math.floor(m / 3) + 1;
      switch (d.part) {
        case 'year':
          return String(y);
        case 'quarter':
          return `Q${q}`;
        case 'yearQuarter':
          return `${y}-Q${q}`;
        case 'month':
          return MONTHS[m];
        case 'weekday':
          return WEEKDAYS[(dt.getUTCDay() + 6) % 7];
        case 'hour':
          return String(dt.getUTCHours()).padStart(2, '0');
      }
      return null;
    }
    case 'calc': {
      const a = r[d.a],
        b = r[d.b];
      if (
        a === null ||
        b === null ||
        a === undefined ||
        b === undefined ||
        a === '' ||
        b === ''
      )
        return null;
      const fa = fm.get(d.a),
        fb = fm.get(d.b);
      const sc = Math.max(scaleOf(fa), scaleOf(fb), 2);
      if (d.op === 'add' || d.op === 'sub') {
        const x = toScaled(a, sc),
          y = toScaled(b, sc);
        if (x === null || y === null) return null;
        return ((d.op === 'add' ? x + y : x - y) / 10 ** sc).toFixed(sc);
      }
      const x = Number(a),
        y = Number(b);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (d.op === 'mul') return (x * y).toFixed(sc);
      if (y === 0) return null;
      return Math.round((d.op === 'pct' ? (x / y) * 100 : x / y) * 100) / 100;
    }
    case 'rules': {
      for (const c of d.cases) {
        const active = activeRules(c.rules);
        if (
          active.length &&
          active.every((rule) => matches(r, rule, fm.get(rule.field)))
        )
          return d.asBoolean ? true : c.label;
      }
      return d.asBoolean ? false : d.otherwise;
    }
  }
}

/** Append custom-field columns to the rows and return the full field catalogue. */
function applyDerived(
  rows: Row[],
  derived: DerivedField[],
  base: FieldDef[]
): { rows: Row[]; fields: FieldDef[] } {
  if (derived.length === 0) return { rows, fields: base };
  const fm = new Map(base.map((x) => [x.key, x]));
  const defs: FieldDef[] = [];
  for (const d of derived) {
    const fd = derivedFieldDef(d, fm);
    fm.set(fd.key, fd);
    defs.push(fd);
  }
  const out = rows.map((r) => {
    const n: Row = { ...r };
    for (const d of derived) n[d.key] = derivedValue(d, n, fm);
    return n;
  });
  return { rows: out, fields: [...base, ...defs] };
}

const uniqueKey = (label: string, taken: Set<string>) => {
  const b = `cf_${slug(label).replace(/-/g, '_') || 'field'}`;
  let k = b,
    i = 2;
  while (taken.has(k)) k = `${b}_${i++}`;
  return k;
};

/** Semantic colours for well-known priority / status labels (charts and pills agree). */
const SEMANTIC: Record<string, string> = {
  critical: '#b91c1c',
  high: '#ea580c',
  medium: '#f59e0b',
  low: '#10b981',
  'very high': '#b91c1c',
  moderate: '#f59e0b',
  'very low': '#34d399',
  approved: '#10b981',
  won: '#10b981',
  closed: '#10b981',
  'false positive': '#10b981',
  yes: '#2563eb',
  no: '#94a3b8',
  declined: '#dc2626',
  lost: '#dc2626',
  escalated: '#dc2626',
  'confirmed fraud': '#dc2626',
  confirmed: '#dc2626',
  pending: '#f59e0b',
  'in review': '#f59e0b',
  'under investigation': '#f59e0b',
  'manual review': '#f59e0b',
  open: '#3b82f6',
  new: '#3b82f6',
  unknown: '#cbd5e1',
};
function colorFor(
  fd: FieldDef | undefined,
  label: string,
  idx: number,
  palette: string[]
): string {
  if (fd && (fd.badge || fd.type === 'boolean')) {
    const c = SEMANTIC[label.toLowerCase()];
    if (c) return c;
  }
  return palette[idx % palette.length];
}

/* ==========================================================================
 * Engine additions: series, insights, exports
 * ======================================================================== */
interface DataCtx {
  rows: Row[];
  prevRows: Row[] | null;
  source: ReportSource;
  /** Full catalogue including custom fields. */
  fieldMap: Map<string, FieldDef>;
  /** The report's selected fields (columns of record views and exports). */
  fields: FieldDef[];
  currency: string;
  colors: string[];
  autoBucket: Bucket;
  compare: boolean;
  canViewSensitive: boolean;
  /** Enables click-to-drill (Preview / Generate). */
  onPick?: (field: string, value: string) => void;
  onExpand?: (id: string) => void;
  vars: Record<string, string>;
}

const autoBucketFor = (win: Win | null): Bucket =>
  !win ? 'month' : win.days <= 35 ? 'day' : win.days <= 100 ? 'week' : 'month';

interface SeriesData {
  labels: string[];
  keys: string[];
  names: string[];
  values: number[][];
  /** Aggregates over the whole row / column (correct for averages and distinct counts too). */
  rowTotals: number[];
  colTotals: number[];
  grand: number;
  isDate: boolean;
  groupField: FieldDef;
  breakField?: FieldDef;
}
interface SeriesSpec {
  groupBy: string;
  breakBy?: string;
  bucket: BucketPref;
  topN: number;
  agg: Agg;
  field?: string;
  sort?: ChartWidget['sort'];
  others?: boolean;
}

function buildSeries(
  rows: Row[],
  spec: SeriesSpec,
  fm: Map<string, FieldDef>,
  auto: Bucket
): SeriesData | null {
  const gf = fm.get(spec.groupBy);
  if (!gf) return null;
  const bucket = spec.bucket === 'auto' ? auto : spec.bucket;
  const val = (rs: Row[]) => aggregate(rs, spec.agg, spec.field, fm);
  const natural = groupRows(rows, gf, bucket);
  const isDate = isDateType(gf.type);

  let groups: { key: string; label: string; rows: Row[] }[];
  if (isDate) {
    groups = natural.slice(-24);
  } else {
    const sort = spec.sort ?? 'auto';
    const keepRank = sort === 'auto' && (!!gf.order || !!gf.naturalSort);
    let list = natural;
    if (sort === 'label')
      list = [...natural].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true })
      );
    else if (!keepRank) {
      const dir = sort === 'valueAsc' ? 1 : -1;
      list = natural
        .map((g) => ({ g, v: val(g.rows) }))
        .sort((a, b) => (a.v - b.v) * dir)
        .map((x) => x.g);
    }
    const n = Math.max(1, spec.topN);
    groups = list.slice(0, n);
    const rest = list.slice(n);
    if (spec.others && rest.length)
      groups = [
        ...groups,
        { key: '__others', label: 'Others', rows: rest.flatMap((g) => g.rows) },
      ];
  }

  const base = {
    labels: groups.map((g) => g.label),
    keys: groups.map((g) => g.key),
    isDate,
    groupField: gf,
  };
  const kept = groups.flatMap((g) => g.rows);
  const bf =
    spec.breakBy && spec.breakBy !== gf.key ? fm.get(spec.breakBy) : undefined;

  if (!bf) {
    const mf = spec.field ? fm.get(spec.field) : undefined;
    const name =
      spec.agg === 'count' || !mf
        ? 'Count'
        : `${aggLabel(spec.agg)} of ${mf.label.toLowerCase()}`;
    const values = groups.map((g) => val(g.rows));
    return {
      ...base,
      names: [name],
      values: [values],
      rowTotals: values,
      colTotals: [val(kept)],
      grand: val(kept),
    };
  }
  const cats = groupRows(kept, bf, 'month')
    .slice(0, 6)
    .map((g) => g.key);
  const inCat = (rs: Row[], c: string) =>
    rs.filter((r) => cellKey(bf, r) === c);
  return {
    ...base,
    breakField: bf,
    names: cats,
    values: cats.map((c) => groups.map((g) => val(inCat(g.rows, c)))),
    rowTotals: groups.map((g) => val(g.rows)),
    colTotals: cats.map((c) => val(inCat(kept, c))),
    grand: val(kept),
  };
}

function buildInsights(
  rows: Row[],
  prevRows: Row[] | null,
  w: InsightWidget,
  fm: Map<string, FieldDef>,
  auto: Bucket,
  currency: string
): string[] {
  const gf = fm.get(w.groupBy);
  const mf = w.field ? fm.get(w.field) : undefined;
  const f = (v: number) => fmtMeasure(v, w.agg, mf, currency);
  if (!gf || rows.length === 0) return ['No data for the current filters.'];
  const out: string[] = [];
  const total = aggregate(rows, w.agg, w.field, fm);
  const additive = ADDITIVE.includes(w.agg);
  let line = additive
    ? `Total ${w.subject}: ${f(total)}`
    : `Overall ${aggLabel(w.agg).toLowerCase()}${mf ? ` of ${mf.label.toLowerCase()}` : ''}: ${f(total)}`;
  if (prevRows) {
    const pv = aggregate(prevRows, w.agg, w.field, fm);
    if (pv) {
      if (w.agg === 'rate') {
        const d = total - pv;
        line += `, ${d >= 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(1)} points on the previous period`;
      } else {
        const d = ((total - pv) / Math.abs(pv)) * 100;
        line += `, ${d >= 0 ? 'up' : 'down'} ${Math.abs(d).toFixed(0)}% on the previous period`;
      }
    }
  }
  out.push(`${line}.`);

  const bucket = w.bucket === 'auto' ? auto : w.bucket;
  const isDate = isDateType(gf.type);
  let groups = groupRows(rows, gf, bucket).map((g) => ({
    label: g.label,
    v: aggregate(g.rows, w.agg, w.field, fm),
    n: g.rows.length,
  }));
  if (isDate) groups = groups.slice(-24);
  if (groups.length === 0) return out;
  const sum = groups.reduce((s, g) => s + g.v, 0) || 1;

  if (isDate) {
    const peak = groups.reduce((a, b) => (b.v > a.v ? b : a), groups[0]);
    out.push(`Peak period was ${peak.label} at ${f(peak.v)}.`);
    if (groups.length >= 4) {
      const k = Math.max(1, Math.floor(groups.length / 3));
      const first = groups.slice(0, k).reduce((s, g) => s + g.v, 0) / k;
      const last = groups.slice(-k).reduce((s, g) => s + g.v, 0) / k;
      if (first) {
        const d = ((last - first) / Math.abs(first)) * 100;
        out.push(
          `The latest ${k} periods average ${Math.abs(d).toFixed(0)}% ${d >= 0 ? 'higher' : 'lower'} than the first ${k}.`
        );
      }
    }
    return out;
  }
  const sorted = [...groups].sort((a, b) => b.v - a.v);
  if (additive) {
    out.push(
      `${sorted[0].label} leads with ${Math.round((sorted[0].v / sum) * 100)}% of the total (${f(sorted[0].v)}).`
    );
    if (sorted.length >= 4) {
      const top3 = sorted.slice(0, 3).reduce((s, g) => s + g.v, 0);
      out.push(
        `The top 3 ${gf.label.toLowerCase()} values account for ${Math.round((top3 / sum) * 100)}%.`
      );
    }
    if (gf.order && sorted.length >= 2) {
      const urgent = groups
        .filter((g) => rankOrLast(gf, g.label) <= 1)
        .reduce((s, g) => s + g.v, 0);
      if (urgent > 0 && urgent < sum)
        out.push(
          `The two highest-ranked ${gf.label.toLowerCase()} levels make up ${Math.round((urgent / sum) * 100)}% of the total.`
        );
    } else if (sorted.length >= 2) {
      const l = sorted[sorted.length - 1];
      out.push(
        `${l.label} is the smallest contributor at ${Math.round((l.v / sum) * 100)}%.`
      );
    }
  } else {
    out.push(
      `${sorted[0].label} has the highest ${aggLabel(w.agg).toLowerCase()} (${f(sorted[0].v)}).`
    );
    if (sorted.length >= 2)
      out.push(
        `${sorted[sorted.length - 1].label} has the lowest (${f(sorted[sorted.length - 1].v)}).`
      );
  }
  return out;
}

function downloadCsv(
  name: string,
  headers: string[],
  rows: (string | number | undefined)[][]
) {
  const esc = (v: string | number | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.map(esc).join(','),
    ...rows.map((r) => r.map(esc).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(
    new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** The tabular data behind a widget (used by the expand view and CSV export). */
function widgetTable(
  w: Widget,
  d: DataCtx
): { headers: string[]; rows: (string | number)[][] } {
  const rows = applyFilters(d.rows, w.filters, d.fieldMap);
  if (w.kind === 'chart' && w.chartType !== 'scatter') {
    const sd = buildSeries(
      rows,
      {
        groupBy: w.groupBy,
        breakBy: w.breakBy,
        bucket: w.bucket,
        topN: w.topN,
        agg: w.agg,
        field: w.field,
        sort: w.sort,
        others: w.others,
      },
      d.fieldMap,
      d.autoBucket
    );
    if (!sd) return { headers: [], rows: [] };
    return {
      headers: [sd.groupField.label, ...sd.names],
      rows: sd.labels.map((l, i) => [
        l,
        ...sd.values.map((v) => Math.round(v[i] * 100) / 100),
      ]),
    };
  }
  if (w.kind === 'table') {
    const cols = w.columns
      .map((k) => d.fieldMap.get(k))
      .filter((x): x is FieldDef => !!x);
    return {
      headers: cols.map((c) => c.label),
      rows: rows
        .slice(0, 200)
        .map((r) =>
          cols.map((c) => exportCell(c, r[c.key], d.canViewSensitive))
        ),
    };
  }
  if (w.kind === 'kpi')
    return {
      headers: ['Metric', 'Value'],
      rows: [[w.title, aggregate(rows, w.agg, w.field, d.fieldMap)]],
    };
  if (w.kind === 'insight')
    return {
      headers: ['Insight'],
      rows: buildInsights(
        rows,
        d.prevRows,
        w,
        d.fieldMap,
        d.autoBucket,
        d.currency
      ).map((s) => [s]),
    };
  if (w.kind === 'chart' && w.xField && w.field) {
    const xf = d.fieldMap.get(w.xField),
      yf = d.fieldMap.get(w.field);
    return {
      headers: [xf?.label ?? 'X', yf?.label ?? 'Y'],
      rows: rows
        .slice(0, 200)
        .map((r) => [Number(r[w.xField!]), Number(r[w.field!])]),
    };
  }
  return { headers: [], rows: [] };
}

/* ==========================================================================
 * Widget factories + defaults
 * ======================================================================== */
const baseW = (title: string, span: Span) => ({
  id: uid(),
  title,
  span,
  height: 'md' as Height,
  filters: [] as FilterRule[],
});

const mkKpi = (title: string, o: Partial<KpiWidget> = {}): KpiWidget => ({
  ...baseW(title, 3),
  kind: 'kpi',
  agg: 'count',
  tone: 'blue',
  showTrend: true,
  showSparkline: true,
  lowerIsBetter: false,
  format: 'compact',
  ...o,
});
const mkChart = (
  title: string,
  chartType: ChartType,
  groupBy: string,
  o: Partial<ChartWidget> = {}
): ChartWidget => ({
  ...baseW(title, 6),
  kind: 'chart',
  chartType,
  groupBy,
  bucket: 'auto',
  agg: 'count',
  topN: 6,
  showLegend: true,
  showLabels: true,
  showPercentage: true,
  ...o,
});
const mkTable = (
  title: string,
  columns: string[],
  o: Partial<TableWidget> = {}
): TableWidget => ({
  ...baseW(title, 12),
  kind: 'table',
  columns,
  sortDir: 'desc',
  limit: 5,
  showTotals: false,
  dataBars: false,
  ...o,
});
const mkText = (
  text: string,
  variant: TextWidget['variant'],
  o: Partial<TextWidget> = {}
): TextWidget => ({
  ...baseW('Text', 12),
  kind: 'text',
  text,
  variant,
  ...o,
});
const mkInsight = (
  title: string,
  groupBy: string,
  o: Partial<InsightWidget> = {}
): InsightWidget => ({
  ...baseW(title, 4),
  kind: 'insight',
  groupBy,
  agg: 'count',
  bucket: 'auto',
  subject: 'records',
  ...o,
});

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function autoWidgets(
  src: ReportSource,
  selected: string[],
  fields: FieldDef[] = src.fields
): Widget[] {
  const sel = fields.filter((x) => selected.includes(x.key));
  const money = sel.find((x) => x.type === 'currency');
  const num =
    sel.find((x) => x.type === 'number' || x.type === 'decimal') ?? money;
  // Ordinal / badge categories (priority, severity) make the most useful breakdowns, so list them first.
  const cats = sel
    .filter((x) => x.type === 'category')
    .sort((a, b) => Number(!!b.order) - Number(!!a.order));
  const bool = sel.find((x) => x.type === 'boolean');
  const date = sel.find((x) => isDateType(x.type));
  const out: Widget[] = [
    mkKpi(`Total ${src.recordLabel}`, { lowerIsBetter: true }),
  ];
  if (money)
    out.push(
      mkKpi(money.label, {
        agg: 'sum',
        field: money.key,
        tone: 'red',
        lowerIsBetter: true,
      })
    );
  if (num)
    out.push(
      mkKpi(`Avg ${num.label.toLowerCase()}`, {
        agg: 'avg',
        field: num.key,
        tone: 'green',
      })
    );
  if (bool)
    out.push(
      mkKpi(`${bool.label} rate`, {
        agg: 'rate',
        field: bool.key,
        tone: 'violet',
        lowerIsBetter: true,
      })
    );
  else if (cats[0])
    out.push(
      mkKpi(`Distinct ${cats[0].label.toLowerCase()}`, {
        agg: 'distinct',
        field: cats[0].key,
        tone: 'violet',
        showTrend: false,
        showSparkline: false,
      })
    );
  const insightBy = cats[0] ?? date;
  if (insightBy)
    out.push(
      mkInsight('Key insights', insightBy.key, { subject: src.recordLabel })
    );
  if (date)
    out.push(
      mkChart(`${cap(src.recordLabel)} trend`, 'area', date.key, {
        span: insightBy ? 8 : 12,
      })
    );
  if (cats[0])
    out.push(
      mkChart(
        `${cap(src.recordLabel)} by ${cats[0].label.toLowerCase()}`,
        'doughnut',
        cats[0].key,
        { span: 4 }
      )
    );
  if (cats[1])
    out.push(
      mkChart(`By ${cats[1].label.toLowerCase()}`, 'hbar', cats[1].key, {
        span: 4,
        ...(money ? { agg: 'sum' as Agg, field: money.key } : {}),
      })
    );
  if (cats[0] && cats[1])
    out.push(
      mkChart(
        `${cats[0].label} × ${cats[1].label.toLowerCase()}`,
        'heatmap',
        cats[0].key,
        { span: 4, breakBy: cats[1].key }
      )
    );
  const cols = sel.slice(0, 6).map((x) => x.key);
  if (cols.length)
    out.push(
      mkTable(`Top ${src.recordLabel}`, cols, {
        sortBy: money?.key ?? num?.key,
        dataBars: !!(money ?? num),
      })
    );
  return out;
}

const DEFAULT_SCHEDULE: Schedule = { frequency: 'none', recipients: '' };

function blankDefinition(
  src: ReportSource,
  name = 'Untitled report'
): ReportDefinition {
  return {
    name,
    description: '',
    sourceId: src.id,
    fields: [...src.defaultFields],
    widgets: autoWidgets(src, src.defaultFields, src.fields),
    filters: [],
    dateRange: '6m',
    palette: 'corporate',
    classification: 'internal',
    compare: true,
    schedule: { ...DEFAULT_SCHEDULE },
    derived: [],
    createdAt: new Date().toISOString(),
  };
}

/** Fill any properties missing from older / imported definitions. */
function normalizeDefinition(d: ReportDefinition): ReportDefinition {
  const defaults: Partial<ReportDefinition> = {
    palette: 'corporate',
    classification: 'internal',
    compare: true,
    schedule: { ...DEFAULT_SCHEDULE },
    derived: [],
  };
  const wDefaults = { height: 'md', filters: [] } as Partial<Widget>;
  return {
    ...defaults,
    ...d,
    widgets: (d.widgets ?? []).map((w) => {
      const b = { ...wDefaults, ...w } as Widget;
      if (b.kind === 'kpi')
        return {
          ...({ showSparkline: true, format: 'compact' } as Partial<KpiWidget>),
          ...b,
        } as Widget;
      if (b.kind === 'chart')
        return { ...b, bucket: b.bucket ?? 'auto' } as Widget;
      if (b.kind === 'table')
        return {
          ...({ showTotals: false, dataBars: false } as Partial<TableWidget>),
          ...b,
        } as Widget;
      return b;
    }),
  } as ReportDefinition;
}

function cloneDefinition(d: ReportDefinition): ReportDefinition {
  const c: ReportDefinition = normalizeDefinition(
    JSON.parse(JSON.stringify(d))
  );
  c.widgets = c.widgets.map((w) => ({
    ...w,
    id: uid(),
    filters: w.filters.map((r) => ({ ...r, id: uid() })),
  }));
  c.filters = c.filters.map((r) => ({ ...r, id: uid() }));
  return c;
}

/** Drop references to fields that are no longer in the report's field list. */
function reconcile(
  def: ReportDefinition,
  fields: FieldDef[]
): ReportDefinition {
  const keys = new Set(def.fields);
  const dim = fields.find((x) => keys.has(x.key) && isDim(x.type));
  const widgets = def.widgets.flatMap((w): Widget[] => {
    if (w.kind === 'kpi') {
      const missing = !!w.field && !keys.has(w.field);
      return [
        {
          ...w,
          field: missing ? undefined : w.field,
          agg: missing ? 'count' : w.agg,
        },
      ];
    }
    if (w.kind === 'chart') {
      let c: ChartWidget = w;
      if (c.chartType === 'scatter') {
        if (!c.xField || !c.field || !keys.has(c.xField) || !keys.has(c.field))
          return [];
        return [
          {
            ...c,
            breakBy: c.breakBy && keys.has(c.breakBy) ? c.breakBy : undefined,
          },
        ];
      }
      if (!keys.has(c.groupBy)) {
        if (!dim) return [];
        c = { ...c, groupBy: dim.key };
      }
      if (c.field && !keys.has(c.field))
        c = { ...c, field: undefined, agg: 'count' };
      if (c.breakBy && !keys.has(c.breakBy)) c = { ...c, breakBy: undefined };
      return [c];
    }
    if (w.kind === 'insight') {
      let i: InsightWidget = w;
      if (!keys.has(i.groupBy)) {
        if (!dim) return [];
        i = { ...i, groupBy: dim.key };
      }
      if (i.field && !keys.has(i.field))
        i = { ...i, field: undefined, agg: 'count' };
      return [i];
    }
    if (w.kind === 'table') {
      const columns = w.columns.filter((c) => keys.has(c));
      return columns.length
        ? [
            {
              ...w,
              columns,
              sortBy: w.sortBy && keys.has(w.sortBy) ? w.sortBy : undefined,
            },
          ]
        : [];
    }
    return [w];
  });
  return { ...def, widgets };
}

/* ==========================================================================
 * Template storage (default: localStorage) + built-in templates
 * ======================================================================== */
const LS_KEY = 'fraud-report-builder:templates:v1';
const LS_AUTOSAVE = 'fraud-report-builder:autosave:v1';
const readLocal = (): ReportTemplate[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
};
export const localTemplateStore: ReportTemplateStore = {
  list: async () => readLocal(),
  save: async (t) => {
    const all = readLocal();
    const i = all.findIndex((x) => x.id === t.id);
    if (i >= 0) all[i] = t;
    else all.unshift(t);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    return t;
  },
  remove: async (id) => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify(readLocal().filter((x) => x.id !== id))
    );
  },
};

const builtIn = (
  name: string,
  description: string,
  src: string,
  def: Partial<ReportDefinition> & { widgets: Widget[]; fields: string[] }
): ReportTemplate => {
  const now = new Date().toISOString();
  return {
    id: `builtin-${slug(name)}`,
    name,
    description,
    isDraft: false,
    visibility: 'org',
    createdBy: 'System',
    createdAt: now,
    updatedAt: now,
    builtIn: true,
    definition: normalizeDefinition({
      name,
      description,
      sourceId: src,
      filters: [],
      dateRange: '6m',
      createdAt: now,
      ...def,
    } as ReportDefinition),
  };
};

const BUILTIN_TEMPLATES: ReportTemplate[] = [
  builtIn(
    'Executive fraud summary',
    'Board-ready view of exposure, recovery, severity mix and hotspots.',
    'cases',
    {
      classification: 'confidential',
      fields: [
        'case_id',
        'title',
        'fraud_type',
        'channel',
        'severity',
        'status',
        'is_repeat',
        'amt_aed',
        'recovered_aed',
        'investigator',
        'region',
        'opened',
        'days_open',
      ],
      widgets: [
        mkText(
          'Fraud exposure and case outcomes for {{range}}. {{records}} cases analysed from {{source}}.',
          'callout'
        ),
        mkKpi('Total cases', { lowerIsBetter: true }),
        mkKpi('Amount at risk', {
          agg: 'sum',
          field: 'amt_aed',
          tone: 'red',
          lowerIsBetter: true,
        }),
        mkKpi('Recovered', {
          agg: 'sum',
          field: 'recovered_aed',
          tone: 'green',
        }),
        mkKpi('Repeat customer rate', {
          agg: 'rate',
          field: 'is_repeat',
          tone: 'amber',
          lowerIsBetter: true,
        }),
        mkInsight('Key insights', 'fraud_type', { subject: 'cases' }),
        mkChart('Cases opened by severity', 'stacked', 'opened', {
          span: 8,
          breakBy: 'severity',
        }),
        mkChart('Cases by fraud type', 'doughnut', 'fraud_type', { span: 4 }),
        mkChart('Exposure by channel', 'hbar', 'channel', {
          span: 4,
          agg: 'sum',
          field: 'amt_aed',
        }),
        mkChart('Channel × severity', 'heatmap', 'channel', {
          span: 4,
          breakBy: 'severity',
        }),
        mkTable(
          'Highest exposure cases',
          ['case_id', 'title', 'severity', 'status', 'amt_aed'],
          { sortBy: 'amt_aed', limit: 8, dataBars: true, pageBreak: true }
        ),
      ],
    }
  ),
  builtIn(
    'Alert priority and value-band analysis',
    'Rule priority, escalation and SAR rates, with alerts banded by transaction value.',
    'alerts',
    {
      fields: [
        'alert_id',
        'rule',
        'rule_priority',
        'status',
        'score',
        'amt_aed',
        'is_escalated',
        'sar_filed',
        'analyst',
        'triggered',
        'cf_value_band',
      ],
      derived: [
        {
          id: 'band1',
          key: 'cf_value_band',
          label: 'Value band',
          kind: 'bands',
          source: 'amt_aed',
          edges: [1000, 5000, 20000],
        },
      ],
      widgets: [
        mkKpi('Alerts', { lowerIsBetter: true }),
        mkKpi('Value at stake', {
          agg: 'sum',
          field: 'amt_aed',
          tone: 'red',
          lowerIsBetter: true,
          format: 'full',
        }),
        mkKpi('Escalation rate', {
          agg: 'rate',
          field: 'is_escalated',
          tone: 'amber',
          lowerIsBetter: true,
        }),
        mkKpi('SAR filed', {
          agg: 'yes',
          field: 'sar_filed',
          tone: 'violet',
          showSparkline: true,
        }),
        mkInsight('Key insights', 'rule_priority', { subject: 'alerts' }),
        mkChart('Alerts by priority over time', 'stacked', 'triggered', {
          span: 8,
          breakBy: 'rule_priority',
        }),
        mkChart('Alerts by rule priority', 'doughnut', 'rule_priority', {
          span: 4,
        }),
        mkChart('Value at stake by band', 'bar', 'cf_value_band', {
          span: 4,
          agg: 'sum',
          field: 'amt_aed',
        }),
        mkChart('Escalation rate by priority', 'hbar', 'rule_priority', {
          span: 4,
          agg: 'rate',
          field: 'is_escalated',
        }),
        mkChart('Priority × value band (AED)', 'pivot', 'rule_priority', {
          span: 4,
          breakBy: 'cf_value_band',
          agg: 'sum',
          field: 'amt_aed',
          showTotals: true,
        }),
        mkTable(
          'Highest value alerts',
          [
            'alert_id',
            'rule',
            'rule_priority',
            'status',
            'is_escalated',
            'amt_aed',
          ],
          { sortBy: 'amt_aed', dataBars: true, showTotals: true }
        ),
      ],
    }
  ),
  builtIn(
    'Alert triage performance',
    'Alert volume, false-positive load and rule effectiveness.',
    'alerts',
    {
      fields: [
        'alert_id',
        'rule',
        'rule_priority',
        'severity',
        'status',
        'channel',
        'score',
        'amt_aed',
        'analyst',
        'triggered',
      ],
      widgets: [
        mkKpi('Alerts', { lowerIsBetter: true }),
        mkKpi('Avg risk score', { agg: 'avg', field: 'score', tone: 'amber' }),
        mkKpi('Value at stake', {
          agg: 'sum',
          field: 'amt_aed',
          tone: 'red',
          lowerIsBetter: true,
        }),
        mkKpi('Analysts', {
          agg: 'distinct',
          field: 'analyst',
          tone: 'violet',
          showTrend: false,
          showSparkline: false,
        }),
        mkInsight('Key insights', 'status', { subject: 'alerts' }),
        mkChart('Alert volume by severity', 'stacked', 'triggered', {
          span: 8,
          breakBy: 'severity',
        }),
        mkChart('Alerts by status', 'doughnut', 'status', { span: 4 }),
        mkChart('Alerts by detection rule', 'hbar', 'rule', {
          span: 4,
          others: true,
          topN: 4,
        }),
        mkChart('Risk score vs amount', 'scatter', 'severity', {
          span: 4,
          xField: 'score',
          field: 'amt_aed',
          breakBy: 'rule_priority',
        }),
        mkTable(
          'Highest scoring alerts',
          ['alert_id', 'rule', 'rule_priority', 'status', 'score'],
          { sortBy: 'score', dataBars: true }
        ),
      ],
    }
  ),
  builtIn(
    'Chargeback analysis',
    'Dispute value by reason and network, with outcomes.',
    'chargebacks',
    {
      fields: [
        'cb_id',
        'merchant',
        'reason',
        'network',
        'status',
        'is_represented',
        'amt_aed',
        'filed',
      ],
      widgets: [
        mkKpi('Chargebacks', { lowerIsBetter: true }),
        mkKpi('Disputed value', {
          agg: 'sum',
          field: 'amt_aed',
          tone: 'red',
          lowerIsBetter: true,
        }),
        mkKpi('Avg dispute', { agg: 'avg', field: 'amt_aed', tone: 'amber' }),
        mkKpi('Representment rate', {
          agg: 'rate',
          field: 'is_represented',
          tone: 'violet',
        }),
        mkInsight('Key insights', 'reason', { subject: 'chargebacks' }),
        mkChart('Disputes by status', 'stacked', 'filed', {
          span: 8,
          breakBy: 'status',
        }),
        mkChart('Disputes by reason', 'doughnut', 'reason', { span: 4 }),
        mkChart('Value by network', 'hbar', 'network', {
          span: 4,
          agg: 'sum',
          field: 'amt_aed',
        }),
        mkChart('Reason × outcome', 'heatmap', 'reason', {
          span: 4,
          breakBy: 'status',
        }),
        mkTable(
          'Largest disputes',
          ['cb_id', 'merchant', 'reason', 'status', 'amt_aed'],
          { sortBy: 'amt_aed', dataBars: true }
        ),
      ],
    }
  ),
];

/* ==========================================================================
 * Design tokens (compact system: 32px controls, 13px body)
 * ======================================================================== */
interface Tokens {
  dark: boolean;
  card: string;
  inset: string;
  canvas: string;
  line: string;
  lineStrong: string;
  text: string;
  body: string;
  muted: string;
  hover: string;
  input: string;
  btn: string;
  chipIcon: string;
  selected: string;
  toggleOff: string;
  skeleton: string;
  pop: string;
}
const LIGHT: Tokens = {
  dark: false,
  card: 'bg-white border-slate-200 shadow-sm',
  inset: 'bg-slate-50 border-slate-200',
  canvas: 'bg-slate-100/70',
  line: 'border-slate-100',
  lineStrong: 'border-slate-200',
  text: 'text-slate-900',
  body: 'text-slate-700',
  muted: 'text-slate-500',
  hover: 'hover:bg-slate-50',
  input: 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
  btn: 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
  chipIcon: 'bg-blue-50 text-blue-600',
  selected: 'bg-blue-50 border-blue-500 text-blue-700',
  toggleOff: 'bg-slate-300',
  skeleton: 'bg-slate-100',
  pop: 'bg-white border-slate-200 text-slate-700 shadow-xl',
};
const DARK: Tokens = {
  dark: true,
  card: 'bg-slate-900/60 border-white/15 shadow-sm',
  inset: 'bg-white/[0.04] border-white/15',
  canvas: 'bg-black/20',
  line: 'border-white/10',
  lineStrong: 'border-white/15',
  text: 'text-white',
  body: 'text-white/80',
  muted: 'text-white/60',
  hover: 'hover:bg-white/5',
  input: 'bg-white/10 border-white/20 text-white placeholder:text-white/50',
  btn: 'bg-white/10 border-white/20 text-white hover:bg-white/20',
  chipIcon: 'bg-blue-500/20 text-blue-300',
  selected: 'bg-blue-500/15 border-blue-400 text-blue-200',
  toggleOff: 'bg-white/25',
  skeleton: 'bg-white/10',
  pop: 'bg-slate-900 border-white/20 text-white/90 shadow-2xl',
};
const ThemeCtx = createContext<Tokens>(LIGHT);
const useT = () => useContext(ThemeCtx);

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const PRIMARY_BTN = `inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

const PALETTES: Record<PaletteKey, { label: string; colors: string[] }> = {
  corporate: {
    label: 'Corporate',
    colors: [
      '#2563eb',
      '#0ea5e9',
      '#6366f1',
      '#14b8a6',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#64748b',
    ],
  },
  vivid: {
    label: 'Vivid',
    colors: [
      '#2563eb',
      '#10b981',
      '#f59e0b',
      '#f97316',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#64748b',
    ],
  },
  ocean: {
    label: 'Ocean',
    colors: [
      '#0369a1',
      '#0891b2',
      '#14b8a6',
      '#38bdf8',
      '#6366f1',
      '#22d3ee',
      '#2dd4bf',
      '#94a3b8',
    ],
  },
  sunset: {
    label: 'Sunset',
    colors: [
      '#dc2626',
      '#f97316',
      '#f59e0b',
      '#ec4899',
      '#a855f7',
      '#fb7185',
      '#fbbf24',
      '#78716c',
    ],
  },
  mono: {
    label: 'Mono',
    colors: [
      '#1e3a8a',
      '#2563eb',
      '#60a5fa',
      '#94a3b8',
      '#475569',
      '#93c5fd',
      '#334155',
      '#cbd5e1',
    ],
  },

  // ─── New palettes ───────────────────────────────────────────

  forest: {
    label: 'Forest',
    colors: [
      '#166534',
      '#16a34a',
      '#4ade80',
      '#065f46',
      '#2dd4bf',
      '#84cc16',
      '#a3e635',
      '#78716c',
    ],
  },
  berry: {
    label: 'Berry',
    colors: [
      '#831843',
      '#be185d',
      '#ec4899',
      '#a21caf',
      '#c026d3',
      '#f472b6',
      '#e879f9',
      '#71717a',
    ],
  },
  earth: {
    label: 'Earth',
    colors: [
      '#78350f',
      '#b45309',
      '#d97706',
      '#a16207',
      '#ca8a04',
      '#65a30d',
      '#84cc16',
      '#57534e',
    ],
  },
  slate: {
    label: 'Slate',
    colors: [
      '#0f172a',
      '#1e293b',
      '#334155',
      '#475569',
      '#64748b',
      '#94a3b8',
      '#cbd5e1',
      '#e2e8f0',
    ],
  },
  royal: {
    label: 'Royal',
    colors: [
      '#4c1d95',
      '#6d28d9',
      '#7c3aed',
      '#8b5cf6',
      '#a78bfa',
      '#c4b5fd',
      '#ddd6fe',
      '#64748b',
    ],
  },
  pastel: {
    label: 'Pastel',
    colors: [
      '#93c5fd',
      '#a5b4fc',
      '#c4b5fd',
      '#f0abfc',
      '#f9a8d4',
      '#fda4af',
      '#fcd34d',
      '#a7f3d0',
    ],
  },
  citrus: {
    label: 'Citrus',
    colors: [
      '#ca8a04',
      '#eab308',
      '#facc15',
      '#84cc16',
      '#a3e635',
      '#f97316',
      '#fb923c',
      '#78716c',
    ],
  },
  nordic: {
    label: 'Nordic',
    colors: [
      '#0f766e',
      '#14b8a6',
      '#5eead4',
      '#0e7490',
      '#06b6d4',
      '#67e8f9',
      '#1e40af',
      '#94a3b8',
    ],
  },
  ember: {
    label: 'Ember',
    colors: [
      '#7f1d1d',
      '#b91c1c',
      '#dc2626',
      '#ea580c',
      '#f97316',
      '#fb923c',
      '#facc15',
      '#78716c',
    ],
  },
  aurora: {
    label: 'Aurora',
    colors: [
      '#0d9488',
      '#14b8a6',
      '#06b6d4',
      '#3b82f6',
      '#6366f1',
      '#8b5cf6',
      '#d946ef',
      '#64748b',
    ],
  },
  desert: {
    label: 'Desert',
    colors: [
      '#92400e',
      '#c2410c',
      '#ea580c',
      '#d97706',
      '#f59e0b',
      '#eab308',
      '#fcd34d',
      '#a8a29e',
    ],
  },
  teal: {
    label: 'Teal',
    colors: [
      '#134e4a',
      '#0f766e',
      '#0d9488',
      '#14b8a6',
      '#2dd4bf',
      '#5eead4',
      '#99f6e4',
      '#64748b',
    ],
  },
  plum: {
    label: 'Plum',
    colors: [
      '#581c87',
      '#6b21a8',
      '#7e22ce',
      '#9333ea',
      '#a855f7',
      '#c084fc',
      '#d8b4fe',
      '#71717a',
    ],
  },
  arctic: {
    label: 'Arctic',
    colors: [
      '#1e3a8a',
      '#1d4ed8',
      '#2563eb',
      '#3b82f6',
      '#60a5fa',
      '#93c5fd',
      '#bae6fd',
      '#64748b',
    ],
  },
  candy: {
    label: 'Candy',
    colors: [
      '#db2777',
      '#ec4899',
      '#f472b6',
      '#a855f7',
      '#c084fc',
      '#818cf8',
      '#38bdf8',
      '#fbbf24',
    ],
  },
  contrast: {
    label: 'Contrast',
    colors: [
      '#111827',
      '#dc2626',
      '#2563eb',
      '#16a34a',
      '#f59e0b',
      '#7c3aed',
      '#0891b2',
      '#e5e7eb',
    ],
  },
};
const TONES: Record<
  Tone,
  {
    card: [string, string];
    chip: [string, string];
    icon: React.ComponentType<{ className?: string }>;
    hex: string;
  }
> = {
  blue: {
    card: ['bg-blue-50 border-blue-100', 'bg-blue-500/10 border-blue-500/20'],
    chip: ['bg-white text-blue-600', 'bg-blue-500/20 text-blue-300'],
    icon: ShieldAlert,
    hex: '#2563eb',
  },
  red: {
    card: ['bg-red-50 border-red-100', 'bg-red-500/10 border-red-500/20'],
    chip: ['bg-white text-red-600', 'bg-red-500/20 text-red-300'],
    icon: AlertTriangle,
    hex: '#dc2626',
  },
  green: {
    card: [
      'bg-emerald-50 border-emerald-100',
      'bg-emerald-500/10 border-emerald-500/20',
    ],
    chip: ['bg-white text-emerald-600', 'bg-emerald-500/20 text-emerald-300'],
    icon: CheckCircle2,
    hex: '#059669',
  },
  violet: {
    card: [
      'bg-violet-50 border-violet-100',
      'bg-violet-500/10 border-violet-500/20',
    ],
    chip: ['bg-white text-violet-600', 'bg-violet-500/20 text-violet-300'],
    icon: Activity,
    hex: '#7c3aed',
  },
  amber: {
    card: [
      'bg-amber-50 border-amber-100',
      'bg-amber-500/10 border-amber-500/20',
    ],
    chip: ['bg-white text-amber-600', 'bg-amber-500/20 text-amber-300'],
    icon: Banknote,
    hex: '#d97706',
  },
  slate: {
    card: ['bg-slate-50 border-slate-200', 'bg-white/5 border-white/15'],
    chip: ['bg-white text-slate-600', 'bg-white/10 text-white/70'],
    icon: Hash,
    hex: '#475569',
  },
};

const BADGE: Record<string, [string, string]> = {
  red: [
    'bg-red-50 text-red-700 ring-red-200',
    'bg-red-500/15 text-red-300 ring-red-500/30',
  ],
  amber: [
    'bg-amber-50 text-amber-700 ring-amber-200',
    'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  ],
  green: [
    'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  ],
  blue: [
    'bg-blue-50 text-blue-700 ring-blue-200',
    'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  ],
  orange: [
    'bg-orange-50 text-orange-700 ring-orange-200',
    'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  ],
  slate: [
    'bg-slate-100 text-slate-600 ring-slate-200',
    'bg-white/10 text-white/70 ring-white/15',
  ],
};
const BADGE_TONE: Record<string, string> = {
  critical: 'red',
  'very high': 'red',
  high: 'orange',
  declined: 'red',
  lost: 'red',
  escalated: 'red',
  'confirmed fraud': 'red',
  confirmed: 'red',
  medium: 'amber',
  moderate: 'amber',
  'manual review': 'amber',
  pending: 'amber',
  'under investigation': 'amber',
  'in review': 'amber',
  low: 'green',
  'very low': 'green',
  approved: 'green',
  won: 'green',
  closed: 'green',
  'false positive': 'green',
  open: 'blue',
  new: 'blue',
};

const CLASSIFICATION: Record<Classification, { label: string; tone: string }> =
  {
    none: { label: 'No classification', tone: 'slate' },
    internal: { label: 'Internal use', tone: 'blue' },
    confidential: { label: 'Confidential', tone: 'amber' },
    restricted: { label: 'Restricted', tone: 'red' },
  };

const Badge: React.FC<{ value: string; tone?: string }> = ({ value, tone }) => {
  const t = useT();
  const k = tone ?? BADGE_TONE[value.toLowerCase()] ?? 'slate';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BADGE[k][t.dark ? 1 : 0]}`}
    >
      {value}
    </span>
  );
};

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/* ==========================================================================
 * Atoms
 * ======================================================================== */
const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => {
  const t = useT();
  return (
    <label className="block">
      <span className={`mb-1 block text-[11px] font-semibold ${t.muted}`}>
        {label}
      </span>
      {children}
      {hint && (
        <span className={`mt-1 block text-[11px] ${t.muted}`}>{hint}</span>
      )}
    </label>
  );
};

const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
}> = ({ value, onChange, options, label }) => {
  const t = useT();
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 w-full cursor-pointer appearance-none rounded-lg border pl-2.5 pr-7 text-[13px] ${t.input} ${FOCUS}`}
      >
        {options.map((o) => (
          <option
            key={o.value}
            value={o.value}
            className="bg-white text-slate-900"
          >
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${t.muted}`}
      />
    </div>
  );
};

const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...rest
}) => {
  const t = useT();
  return (
    <input
      {...rest}
      className={`h-8 w-full rounded-lg border px-2.5 text-[13px] ${t.input} ${FOCUS} ${className}`}
    />
  );
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => {
  const t = useT();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? 'bg-blue-600' : t.toggleOff} ${FOCUS}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
      />
    </button>
  );
};

const SwitchRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[13px] ${t.body}`}>{label}</span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
};

const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, active, children }) => {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${active ? t.selected : t.btn} ${FOCUS}`}
    >
      {children}
    </button>
  );
};

const GhostButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  title?: string;
}> = ({ onClick, children, icon, disabled, title }) => {
  const t = useT();
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${t.btn} ${FOCUS}`}
    >
      {icon}
      {children}
    </button>
  );
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex h-8 rounded-lg border p-0.5 ${t.lineStrong} ${t.dark ? 'bg-white/5' : 'bg-slate-50'}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium transition-colors ${value === o.value ? 'bg-blue-600 text-white shadow-sm' : t.muted} ${FOCUS}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Section: React.FC<{
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, badge, defaultOpen = false, children }) => {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border-b last:border-b-0 ${t.line}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold ${t.text} ${t.hover} ${FOCUS}`}
      >
        {title}
        <span className="flex items-center gap-2">
          {badge && (
            <span className={`text-[11px] font-normal ${t.muted}`}>
              {badge}
            </span>
          )}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
      {open && <div className="space-y-3 px-3 pb-3">{children}</div>}
    </div>
  );
};

const Panel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const t = useT();
  return (
    <section
      className={`flex max-h-[80vh] min-h-0 flex-col overflow-hidden rounded-xl border xl:h-full xl:max-h-none ${t.card} ${className}`}
    >
      {children}
    </section>
  );
};

const PanelHead: React.FC<{
  title: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
}> = ({ title, hint, action }) => {
  const t = useT();
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 ${t.lineStrong}`}
    >
      <div className="min-w-0">
        <h2
          className={`flex items-center gap-1.5 truncate text-[13px] font-semibold ${t.text}`}
        >
          {title}
        </h2>
        {hint && <p className={`truncate text-[11px] ${t.muted}`}>{hint}</p>}
      </div>
      {action}
    </div>
  );
};

/** Portal-based popover so it is never clipped by scroll containers. */
const Popover: React.FC<{
  trigger: (p: {
    open: boolean;
    toggle: () => void;
    ref: React.Ref<HTMLButtonElement>;
  }) => React.ReactNode;
  width?: number;
  children: (close: () => void) => React.ReactNode;
}> = ({ trigger, width = 260, children }) => {
  const t = useT();
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
    const inside = (e: Event) =>
      !!menuRef.current?.contains(e.target as Node) ||
      !!btnRef.current?.contains(e.target as Node);
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

  const toggle = () => {
    if (pos) return close();
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8)
    );
    const below = window.innerHeight - rect.bottom;
    setPos(
      below < 340 && rect.top > below
        ? { left, bottom: window.innerHeight - rect.top + 4 }
        : { left, top: rect.bottom + 4 }
    );
  };

  return (
    <>
      {trigger({ open: !!pos, toggle, ref: btnRef })}
      {pos &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: pos.left,
              top: pos.top,
              bottom: pos.bottom,
              width,
              maxHeight: '70vh',
            }}
            className={`z-50 overflow-y-auto rounded-xl border p-2 ${t.pop}`}
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
  hint?: string;
  children: React.ReactNode;
}> = ({ onClick, icon, hint, children }) => {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${t.hover} ${FOCUS}`}
    >
      {icon && (
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${t.chipIcon}`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{children}</span>
        {hint && (
          <span className={`block truncate text-[11px] ${t.muted}`}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );
};

/* ==========================================================================
 * Charts (SVG / HTML, no dependencies)
 * ======================================================================== */
const niceMax = (max: number) => {
  const m = Math.max(max, 1);
  const mag = 10 ** Math.floor(Math.log10(m));
  return [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= m) ?? m;
};
const H_PX: Record<Height, number> = { sm: 160, md: 210, lg: 290 };

const Legend: React.FC<{ names: string[]; colors: string[] }> = ({
  names,
  colors,
}) => {
  const t = useT();
  return (
    <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
      {names.map((n, i) => (
        <li
          key={n}
          className={`flex items-center gap-1.5 text-[11px] ${t.body}`}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: colors[i % colors.length] }}
          />
          {n}
        </li>
      ))}
    </ul>
  );
};

const DonutChart: React.FC<{
  labels: string[];
  values: number[];
  colors: string[];
  pie: boolean;
  showLegend: boolean;
  showLabels: boolean;
  showPercentage: boolean;
  centerText: string;
  fmt: (v: number) => string;
  onPick?: (i: number) => void;
}> = ({
  labels,
  values,
  colors,
  pie,
  showLegend,
  showLabels,
  showPercentage,
  centerText,
  fmt,
  onPick,
}) => {
  const t = useT();
  const total = values.reduce((s, d) => s + d, 0) || 1;
  const r = pie ? 30 : 44;
  const sw = pie ? 60 : 18;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <svg
        viewBox="0 0 120 120"
        className="h-32 w-32 shrink-0"
        role="img"
        aria-label="Distribution chart"
      >
        <g transform="rotate(-90 60 60)">
          {values.map((v, i) => {
            const len = (v / total) * C;
            const el = (
              <circle
                key={labels[i]}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth={sw}
                strokeDasharray={`${Math.max(0, len - (values.length > 1 && !pie ? 1.2 : 0))} ${C}`}
                strokeDashoffset={-acc}
                className={
                  onPick
                    ? 'cursor-pointer transition-opacity hover:opacity-80'
                    : ''
                }
                onClick={onPick ? () => onPick(i) : undefined}
              >
                <title>{`${labels[i]}: ${fmt(v)} (${Math.round((v / total) * 100)}%)`}</title>
              </circle>
            );
            acc += len;
            return el;
          })}
        </g>
        {!pie && (
          <g
            textAnchor="middle"
            className={t.dark ? 'fill-white' : 'fill-slate-900'}
          >
            <text x="60" y="60" fontSize="15" fontWeight="700">
              {centerText}
            </text>
            <text
              x="60"
              y="73"
              fontSize="7"
              className={t.dark ? 'fill-white/60' : 'fill-slate-500'}
            >
              Total
            </text>
          </g>
        )}
      </svg>
      {showLegend && (
        <ul className="min-w-[140px] flex-1 space-y-1">
          {labels.map((l, i) => (
            <li key={l}>
              <button
                type="button"
                disabled={!onPick}
                onClick={() => onPick?.(i)}
                className={`flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-xs ${onPick ? t.hover : 'cursor-default'} ${FOCUS}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: colors[i % colors.length] }}
                />
                <span className={`flex-1 truncate ${t.body}`}>{l}</span>
                {showLabels && (
                  <span className={t.muted}>{fmt(values[i])}</span>
                )}
                {showPercentage && (
                  <span className={`w-9 text-right font-medium ${t.text}`}>
                    {Math.round((values[i] / total) * 100)}%
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PlotChart: React.FC<{
  sd: SeriesData;
  kind: 'bar' | 'stacked' | 'line' | 'area';
  colors: string[];
  showLabels: boolean;
  fmt: (v: number) => string;
  H: number;
  onPick?: (i: number) => void;
  normalize?: boolean;
  refLine?: number;
}> = ({ sd, kind, colors, showLabels, fmt, H, onPick, normalize, refLine }) => {
  const t = useT();
  const W = 480,
    L = 40,
    R = 8,
    T = 12,
    B = 24;
  const pw = W - L - R,
    ph = H - T - B;
  const ns = sd.names.length,
    n = sd.labels.length;
  const totals = sd.labels.map((_, i) =>
    sd.values.reduce((s, v) => s + (v[i] || 0), 0)
  );
  const pct = kind === 'stacked' && !!normalize;
  const dataMax =
    kind === 'stacked'
      ? Math.max(...totals, 0)
      : Math.max(...sd.values.flat(), 0);
  const max = pct ? 100 : niceMax(Math.max(dataMax, refLine ?? 0));
  const y = (v: number) => T + ph - (v / max) * ph;
  const step = pw / Math.max(n, 1);
  const x = (i: number) => L + step * i + step / 2;
  const every = n > 14 ? Math.ceil(n / 10) : 1;
  const axis = t.dark ? 'fill-white/60' : 'fill-slate-500';
  const grid = t.dark ? 'stroke-white/10' : 'stroke-slate-100';
  const lbl = t.dark ? 'fill-white/80' : 'fill-slate-700';
  const cur = onPick ? 'cursor-pointer' : '';
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`${kind} chart`}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((g) => (
        <g key={g}>
          <line
            x1={L}
            x2={W - R}
            y1={y(max * g)}
            y2={y(max * g)}
            className={grid}
          />
          <text
            x={L - 5}
            y={y(max * g) + 3}
            textAnchor="end"
            fontSize="9"
            className={axis}
          >
            {compact(max * g, 1)}
            {pct ? '%' : ''}
          </text>
        </g>
      ))}

      {refLine !== undefined && !pct && refLine <= max && (
        <g>
          <line
            x1={L}
            x2={W - R}
            y1={y(refLine)}
            y2={y(refLine)}
            stroke="#dc2626"
            strokeWidth="1.3"
            strokeDasharray="5 4"
          />
          <text
            x={W - R}
            y={y(refLine) - 3}
            textAnchor="end"
            fontSize="9"
            fill="#dc2626"
          >
            Target {compact(refLine, 1)}
          </text>
        </g>
      )}

      {kind === 'bar' &&
        sd.labels.map((l, i) => {
          const bw = Math.min(30, (step * 0.72) / ns);
          return (
            <g
              key={l}
              onClick={onPick ? () => onPick(i) : undefined}
              className={cur}
            >
              {sd.values.map((v, s) => (
                <rect
                  key={s}
                  x={x(i) - (ns * bw) / 2 + s * bw}
                  y={y(v[i])}
                  width={Math.max(1, bw - 1)}
                  height={Math.max(0, T + ph - y(v[i]))}
                  rx="2.5"
                  fill={colors[s % colors.length]}
                >
                  <title>{`${l}${ns > 1 ? ` · ${sd.names[s]}` : ''}: ${fmt(v[i])}`}</title>
                </rect>
              ))}
              {showLabels && ns === 1 && n <= 12 && (
                <text
                  x={x(i)}
                  y={y(sd.values[0][i]) - 4}
                  textAnchor="middle"
                  fontSize="9"
                  className={lbl}
                >
                  {compact(sd.values[0][i], 1)}
                </text>
              )}
            </g>
          );
        })}

      {kind === 'stacked' &&
        sd.labels.map((l, i) => {
          const bw = Math.min(34, step * 0.7);
          let base = 0;
          return (
            <g
              key={l}
              onClick={onPick ? () => onPick(i) : undefined}
              className={cur}
            >
              {sd.values.map((v, s) => {
                const sv = pct && totals[i] ? (v[i] / totals[i]) * 100 : v[i];
                const top = y(base + sv);
                const h = Math.max(0, y(base) - top);
                base += sv;
                return (
                  <rect
                    key={s}
                    x={x(i) - bw / 2}
                    y={top}
                    width={bw}
                    height={h}
                    fill={colors[s % colors.length]}
                    rx={s === ns - 1 ? 2.5 : 0}
                  >
                    <title>{`${l} · ${sd.names[s]}: ${fmt(v[i])}`}</title>
                  </rect>
                );
              })}
              {showLabels && !pct && n <= 12 && (
                <text
                  x={x(i)}
                  y={y(totals[i]) - 4}
                  textAnchor="middle"
                  fontSize="9"
                  className={lbl}
                >
                  {compact(totals[i], 1)}
                </text>
              )}
            </g>
          );
        })}

      {(kind === 'line' || kind === 'area') &&
        n > 0 &&
        sd.values.map((v, s) => {
          const pts = v.map((val, i) => `${x(i)},${y(val)}`).join(' ');
          const c = colors[s % colors.length];
          return (
            <g key={s}>
              {kind === 'area' && (
                <polygon
                  points={`${x(0)},${T + ph} ${pts} ${x(n - 1)},${T + ph}`}
                  fill={c}
                  opacity={ns > 1 ? 0.14 : 0.18}
                />
              )}
              <polyline
                points={pts}
                fill="none"
                stroke={c}
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {n <= 24 &&
                v.map((val, i) => (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(val)}
                    r="2.8"
                    fill={c}
                    stroke={t.dark ? '#0f172a' : '#fff'}
                    strokeWidth="1.2"
                  >
                    <title>{`${sd.labels[i]}${ns > 1 ? ` · ${sd.names[s]}` : ''}: ${fmt(val)}`}</title>
                  </circle>
                ))}
              {showLabels &&
                ns === 1 &&
                n <= 12 &&
                v.map((val, i) => (
                  <text
                    key={`l${i}`}
                    x={x(i)}
                    y={y(val) - 7}
                    textAnchor="middle"
                    fontSize="9"
                    className={lbl}
                  >
                    {compact(val, 1)}
                  </text>
                ))}
            </g>
          );
        })}

      {sd.labels.map((l, i) =>
        i % every === 0 ? (
          <text
            key={l}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="9"
            className={axis}
          >
            {l.length > 9 ? `${l.slice(0, 8)}…` : l}
          </text>
        ) : null
      )}
    </svg>
  );
};

const HBarChart: React.FC<{
  labels: string[];
  values: number[];
  colors: string[];
  showLabels: boolean;
  fmt: (v: number) => string;
  onPick?: (i: number) => void;
}> = ({ labels, values, colors, showLabels, fmt, onPick }) => {
  const t = useT();
  const max = Math.max(...values, 1);
  return (
    <ul className="space-y-1.5">
      {labels.map((l, i) => (
        <li key={l}>
          <button
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(i)}
            className={`grid w-full grid-cols-[minmax(70px,30%)_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-0.5 text-left text-xs ${onPick ? t.hover : 'cursor-default'} ${FOCUS}`}
          >
            <span className={`truncate ${t.body}`} title={l}>
              {l}
            </span>
            <span
              className={`h-2 overflow-hidden rounded-full ${t.dark ? 'bg-white/10' : 'bg-slate-100'}`}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(values[i] / max) * 100}%`,
                  background: colors[i % colors.length],
                }}
              />
            </span>
            {showLabels ? (
              <span className={`w-14 text-right font-medium ${t.text}`}>
                {fmt(values[i])}
              </span>
            ) : (
              <span />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};

const ScatterPlot: React.FC<{
  pts: { x: number; y: number; c: number }[];
  cats: string[];
  colors: string[];
  xLabel: string;
  yLabel: string;
  H: number;
}> = ({ pts, cats, colors, xLabel, yLabel, H }) => {
  const t = useT();
  const W = 480,
    L = 44,
    R = 10,
    T = 10,
    B = 30;
  const pw = W - L - R,
    ph = H - T - B;
  const mx = niceMax(Math.max(...pts.map((p) => p.x), 0));
  const my = niceMax(Math.max(...pts.map((p) => p.y), 0));
  const axis = t.dark ? 'fill-white/60' : 'fill-slate-500';
  const grid = t.dark ? 'stroke-white/10' : 'stroke-slate-100';
  return (
    <div>
      {cats.length > 1 && <Legend names={cats} colors={colors} />}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Scatter plot"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line
              x1={L}
              x2={W - R}
              y1={T + ph - g * ph}
              y2={T + ph - g * ph}
              className={grid}
            />
            <text
              x={L - 5}
              y={T + ph - g * ph + 3}
              textAnchor="end"
              fontSize="9"
              className={axis}
            >
              {compact(my * g, 1)}
            </text>
            <text
              x={L + g * pw}
              y={H - 16}
              textAnchor="middle"
              fontSize="9"
              className={axis}
            >
              {compact(mx * g, 1)}
            </text>
          </g>
        ))}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={L + (p.x / mx) * pw}
            cy={T + ph - (p.y / my) * ph}
            r="3.2"
            fill={colors[p.c % colors.length]}
            opacity="0.65"
          />
        ))}
        <text
          x={L + pw / 2}
          y={H - 3}
          textAnchor="middle"
          fontSize="9"
          className={axis}
        >
          {xLabel}
        </text>
        <text
          x="8"
          y={T + ph / 2}
          fontSize="9"
          className={axis}
          transform={`rotate(-90 8 ${T + ph / 2})`}
          textAnchor="middle"
        >
          {yLabel}
        </text>
      </svg>
    </div>
  );
};

const Heatmap: React.FC<{
  sd: SeriesData;
  color: string;
  showLabels: boolean;
  fmt: (v: number) => string;
}> = ({ sd, color, showLabels, fmt }) => {
  const t = useT();
  const max = Math.max(...sd.values.flat(), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-[11px]">
        <thead>
          <tr>
            <th />
            {sd.names.map((n) => (
              <th
                key={n}
                className={`px-1 pb-1 text-center font-medium ${t.muted}`}
              >
                {n}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sd.labels.map((l, i) => (
            <tr key={l}>
              <th
                className={`whitespace-nowrap pr-2 text-left font-medium ${t.body}`}
              >
                {l}
              </th>
              {sd.names.map((n, s) => {
                const v = sd.values[s][i];
                const a = v / max;
                return (
                  <td
                    key={n}
                    title={`${l} · ${n}: ${fmt(v)}`}
                    className="rounded-md py-1.5 text-center"
                    style={{
                      background: hexA(color, 0.08 + a * 0.85),
                      color: a > 0.5 ? '#fff' : undefined,
                    }}
                  >
                    {showLabels ? compact(v, 1) : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Sparkline: React.FC<{ values: number[]; color: string }> = ({
  values,
  color,
}) => {
  if (values.length < 2) return null;
  const W = 84,
    H = 28;
  const max = Math.max(...values),
    min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * W},${H - 3 - ((v - min) / span) * (H - 6)}`
    )
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-7 w-[84px] shrink-0"
      aria-hidden="true"
    >
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={color} opacity="0.15" />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

/* ==========================================================================
 * Widget rendering
 * ======================================================================== */
const WidgetCard: React.FC<{
  w: Widget;
  data: DataCtx;
  children: React.ReactNode;
  hideHeader?: boolean;
}> = ({ w, data, children, hideHeader }) => {
  const t = useT();
  return (
    <div className={`rb-avoid h-full rounded-xl border p-3 ${t.card}`}>
      {!hideHeader && (
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`truncate text-[13px] font-semibold ${t.text}`}>
              {w.title}
            </h3>
            {w.note && (
              <p className={`mt-0.5 line-clamp-2 text-[11px] ${t.muted}`}>
                {w.note}
              </p>
            )}
          </div>
          {data.onExpand && (
            <button
              type="button"
              aria-label={`Expand ${w.title}`}
              title="Expand"
              onClick={(e) => {
                e.stopPropagation();
                data.onExpand?.(w.id);
              }}
              className={`rb-noprint -mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${t.muted} ${t.hover} ${FOCUS}`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

const Empty: React.FC<{ text?: string }> = ({
  text = 'No records match the current filters.',
}) => {
  const t = useT();
  return <p className={`py-6 text-center text-xs ${t.muted}`}>{text}</p>;
};

const MaskCtx = createContext(false);

const CellValue: React.FC<{
  field: FieldDef;
  value: Cell | undefined;
  currency: string;
}> = ({ field, value, currency }) => {
  const t = useT();
  const canView = useContext(MaskCtx);
  if (field.sensitive && !canView) {
    return (
      <span
        className={`select-none tracking-widest ${t.muted}`}
        title="Hidden: sensitive field"
      >
        {MASK}
      </span>
    );
  }
  if (value === undefined || value === null || value === '')
    return <span className={t.muted}>—</span>;
  if (field.type === 'boolean')
    return value === true ? (
      <Badge value="Yes" tone="green" />
    ) : value === false ? (
      <Badge value="No" tone="slate" />
    ) : (
      <span className={t.muted}>—</span>
    );
  if (field.badge) return <Badge value={String(value)} />;
  const sc = scaleOf(field);
  if (field.type === 'currency') {
    return (
      <>
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: field.currency ?? currency,
          minimumFractionDigits: sc,
          maximumFractionDigits: sc,
        }).format(Number(value))}
      </>
    );
  }
  if (isNumeric(field.type)) {
    const s = Number(value).toLocaleString('en-US', {
      minimumFractionDigits: sc,
      maximumFractionDigits: sc,
    });
    return <>{field.unit ? `${s}${field.unit}` : s}</>;
  }
  if (field.type === 'date') return <>{fmtDate(String(value))}</>;
  if (field.type === 'datetime') return <>{fmtDateTime(String(value))}</>;
  return <>{String(value)}</>;
};

const PivotTable: React.FC<{
  sd: SeriesData;
  fmt: (v: number) => string;
  color: string;
  totals: boolean;
  onPick?: (i: number) => void;
}> = ({ sd, fmt, color, totals, onPick }) => {
  const t = useT();
  const max = Math.max(...sd.values.flat(), 1);
  const th = `whitespace-nowrap px-2 py-1.5 font-medium ${t.muted}`;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className={t.inset}>
            <th className={`${th} rounded-l-md text-left`}>
              {sd.groupField.label}
            </th>
            {sd.names.map((n) => (
              <th key={n} className={`${th} text-right`}>
                {n}
              </th>
            ))}
            {totals && (
              <th className={`${th} rounded-r-md text-right ${t.text}`}>
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sd.labels.map((l, i) => (
            <tr key={l} className={`border-b ${t.line} ${t.body}`}>
              <th className="px-2 py-1.5 text-left font-medium">
                <button
                  type="button"
                  disabled={!onPick}
                  onClick={() => onPick?.(i)}
                  className={`text-left ${onPick ? 'hover:underline' : 'cursor-default'} ${FOCUS}`}
                >
                  {l}
                </button>
              </th>
              {sd.names.map((n, s) => (
                <td
                  key={n}
                  className="px-2 py-1.5 text-right tabular-nums"
                  style={{
                    background: hexA(color, (sd.values[s][i] / max) * 0.28),
                  }}
                >
                  {fmt(sd.values[s][i])}
                </td>
              ))}
              {totals && (
                <td
                  className={`px-2 py-1.5 text-right font-semibold tabular-nums ${t.text}`}
                >
                  {fmt(sd.rowTotals[i])}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr className={`border-t font-semibold ${t.lineStrong} ${t.text}`}>
              <th className="px-2 py-1.5 text-left">Total</th>
              {sd.colTotals.map((v, s) => (
                <td key={s} className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(v)}
                </td>
              ))}
              {sd.names.length > 1 && (
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {fmt(sd.grand)}
                </td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

const KpiView: React.FC<{ w: KpiWidget; data: DataCtx }> = ({ w, data }) => {
  const t = useT();
  const rows = useMemo(
    () => applyFilters(data.rows, w.filters, data.fieldMap),
    [data.rows, w.filters, data.fieldMap]
  );
  const field = w.field ? data.fieldMap.get(w.field) : undefined;
  const mode = w.format ?? 'compact';
  const value = aggregate(rows, w.agg, w.field, data.fieldMap);
  const spark = useMemo(() => {
    const df = data.fieldMap.get(data.source.dateField);
    if (!w.showSparkline || !df) return [];
    return groupRows(rows, df, data.autoBucket)
      .slice(-24)
      .map((g) => aggregate(g.rows, w.agg, w.field, data.fieldMap));
  }, [
    rows,
    w.showSparkline,
    w.agg,
    w.field,
    data.fieldMap,
    data.source.dateField,
    data.autoBucket,
  ]);

  let delta: number | null = null;
  if (w.showTrend && data.compare && data.prevRows) {
    const pv = aggregate(
      applyFilters(data.prevRows, w.filters, data.fieldMap),
      w.agg,
      w.field,
      data.fieldMap
    );
    delta =
      w.agg === 'rate'
        ? data.prevRows.length
          ? value - pv
          : null
        : pv === 0
          ? null
          : ((value - pv) / Math.abs(pv)) * 100;
  }
  const good =
    delta === null || delta === 0 ? null : delta < 0 === w.lowerIsBetter;
  const tone = TONES[w.tone];
  const Icon = tone.icon;
  const pct = w.target ? Math.min(100, (value / w.target) * 100) : null;
  const onTarget = w.target
    ? w.lowerIsBetter
      ? value <= w.target
      : value >= w.target
    : null;
  return (
    <div
      className={`rb-avoid h-full rounded-xl border p-3 ${tone.card[t.dark ? 1 : 0]}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg shadow-sm ${tone.chip[t.dark ? 1 : 0]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={`min-w-0 flex-1 truncate text-xs font-medium ${t.body}`}
        >
          {w.title}
        </span>
        {data.onExpand && (
          <button
            type="button"
            aria-label={`Expand ${w.title}`}
            onClick={(e) => {
              e.stopPropagation();
              data.onExpand?.(w.id);
            }}
            className={`rb-noprint grid h-6 w-6 place-items-center rounded-md opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${t.muted} ${FOCUS}`}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div
            className={`truncate text-2xl font-bold leading-none tracking-tight tabular-nums ${t.text}`}
            title={fmtMeasure(value, w.agg, field, data.currency, 'full')}
          >
            {fmtMeasure(value, w.agg, field, data.currency, mode)}
          </div>
          {w.showTrend && data.compare && (
            <div className={`mt-1.5 text-[11px] ${t.muted}`}>
              {delta === null ? (
                'No comparison'
              ) : (
                <>
                  <span
                    className={`font-semibold ${good === null ? '' : good ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {delta > 0 ? '▲' : delta < 0 ? '▼' : '→'}{' '}
                    {Math.abs(delta).toFixed(w.agg === 'rate' ? 1 : 0)}
                    {w.agg === 'rate' ? ' pts' : '%'}
                  </span>{' '}
                  vs. prior
                </>
              )}
            </div>
          )}
        </div>
        {spark.length > 1 && <Sparkline values={spark} color={tone.hex} />}
      </div>
      {pct !== null && w.target && (
        <div className="mt-2">
          <div
            className={`h-1.5 overflow-hidden rounded-full ${t.dark ? 'bg-white/10' : 'bg-white'}`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: onTarget ? '#059669' : '#d97706',
              }}
            />
          </div>
          <div className={`mt-1 text-[11px] ${t.muted}`}>
            {onTarget ? 'On target' : 'Off target'}:{' '}
            {fmtMeasure(w.target, w.agg, field, data.currency, mode)}
          </div>
        </div>
      )}
      {w.note && (
        <p className={`mt-1.5 line-clamp-2 text-[11px] ${t.muted}`}>{w.note}</p>
      )}
    </div>
  );
};

const ChartView: React.FC<{ w: ChartWidget; data: DataCtx }> = ({
  w,
  data,
}) => {
  const rows = useMemo(
    () => applyFilters(data.rows, w.filters, data.fieldMap),
    [data.rows, w.filters, data.fieldMap]
  );
  const measure = w.field ? data.fieldMap.get(w.field) : undefined;
  const fmt = (v: number) => fmtMeasure(v, w.agg, measure, data.currency);
  const single =
    w.chartType === 'doughnut' ||
    w.chartType === 'pie' ||
    w.chartType === 'hbar';
  const sd = useMemo(
    () =>
      w.chartType === 'scatter'
        ? null
        : buildSeries(
            rows,
            {
              groupBy: w.groupBy,
              breakBy: single ? undefined : w.breakBy,
              bucket: w.bucket,
              topN: w.topN,
              agg: w.agg,
              field: w.field,
              sort: w.sort,
              others: w.others,
            },
            data.fieldMap,
            data.autoBucket
          ),
    [
      rows,
      w.chartType,
      w.groupBy,
      w.breakBy,
      w.bucket,
      w.topN,
      w.agg,
      w.field,
      w.sort,
      w.others,
      single,
      data.fieldMap,
      data.autoBucket,
    ]
  );
  const scatter = useMemo(() => {
    if (w.chartType !== 'scatter' || !w.xField || !w.field) return null;
    const bf = w.breakBy ? data.fieldMap.get(w.breakBy) : undefined;
    const cats = bf
      ? groupRows(rows, bf, 'month')
          .slice(0, 6)
          .map((g) => g.key)
      : ['All'];
    const pts = rows
      .slice(0, 400)
      .map((r) => ({
        x: Number(r[w.xField!]),
        y: Number(r[w.field!]),
        c: bf ? Math.max(0, cats.indexOf(cellKey(bf, r))) : 0,
      }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    return { pts, cats, bf };
  }, [rows, w.chartType, w.xField, w.field, w.breakBy, data.fieldMap]);

  const H = H_PX[w.height];
  const pick =
    data.onPick && sd && !sd.isDate
      ? (i: number) => {
          const k = sd.keys[i];
          if (k !== '__others') data.onPick!(sd.groupField.key, k);
        }
      : undefined;
  const total = sd?.grand ?? 0;
  const multi = !!sd && sd.names.length > 1;
  // Priority / status labels keep their semantic colours (Critical red … Low green) everywhere.
  const labelColors = sd
    ? sd.labels.map((l, i) => colorFor(sd.groupField, l, i, data.colors))
    : data.colors;
  const nameColors = sd
    ? sd.names.map((n, i) => colorFor(sd.breakField, n, i, data.colors))
    : data.colors;

  let body: React.ReactNode;
  if (w.chartType === 'scatter') {
    body = !scatter ? (
      <Empty text="Choose numeric X and Y fields in the inspector." />
    ) : scatter.pts.length === 0 ? (
      <Empty />
    ) : (
      <ScatterPlot
        pts={scatter.pts}
        cats={scatter.cats}
        colors={scatter.cats.map((c, i) =>
          colorFor(scatter.bf, c, i, data.colors)
        )}
        xLabel={data.fieldMap.get(w.xField!)?.label ?? 'X'}
        yLabel={measure?.label ?? 'Y'}
        H={H}
      />
    );
  } else if (!sd || sd.labels.length === 0 || sd.names.length === 0) {
    body = <Empty />;
  } else if (w.chartType === 'doughnut' || w.chartType === 'pie') {
    body = (
      <DonutChart
        labels={sd.labels}
        values={sd.values[0]}
        colors={labelColors}
        pie={w.chartType === 'pie'}
        showLegend={w.showLegend}
        showLabels={w.showLabels}
        showPercentage={w.showPercentage}
        centerText={fmt(total)}
        fmt={fmt}
        onPick={pick}
      />
    );
  } else if (w.chartType === 'hbar') {
    body = (
      <HBarChart
        labels={sd.labels}
        values={sd.values[0]}
        colors={labelColors}
        showLabels={w.showLabels}
        fmt={fmt}
        onPick={pick}
      />
    );
  } else if (w.chartType === 'heatmap') {
    body = !multi ? (
      <Empty text="Choose a 'Break down by' field to build the heatmap." />
    ) : (
      <Heatmap
        sd={sd}
        color={data.colors[0]}
        showLabels={w.showLabels}
        fmt={fmt}
      />
    );
  } else if (w.chartType === 'pivot') {
    body = (
      <PivotTable
        sd={sd}
        fmt={(v) => fmtMeasure(v, w.agg, measure, data.currency, 'full')}
        color={data.colors[0]}
        totals={!!w.showTotals}
        onPick={pick}
      />
    );
  } else {
    body = (
      <>
        {multi && w.showLegend && (
          <Legend names={sd.names} colors={nameColors} />
        )}
        <PlotChart
          sd={sd}
          kind={w.chartType}
          colors={nameColors}
          showLabels={w.showLabels}
          fmt={fmt}
          H={H}
          onPick={pick}
          normalize={w.normalize}
          refLine={w.refLine}
        />
      </>
    );
  }
  return (
    <WidgetCard w={w} data={data}>
      {body}
    </WidgetCard>
  );
};

const TableView: React.FC<{ w: TableWidget; data: DataCtx }> = ({
  w,
  data,
}) => {
  const t = useT();
  const rows = useMemo(
    () => applyFilters(data.rows, w.filters, data.fieldMap),
    [data.rows, w.filters, data.fieldMap]
  );
  const cols = w.columns
    .map((k) => data.fieldMap.get(k))
    .filter((x): x is FieldDef => !!x);
  const sortField = w.sortBy ? data.fieldMap.get(w.sortBy) : undefined;
  const shown = useMemo(() => {
    let s = rows;
    if (sortField) {
      const dir = w.sortDir === 'asc' ? 1 : -1;
      s = [...rows].sort(
        (a, b) =>
          compareCells(sortField, a[sortField.key], b[sortField.key]) * dir
      );
    }
    return s.slice(0, w.limit);
  }, [rows, sortField, w.sortDir, w.limit]);
  const maxes = useMemo(() => {
    const m: Record<string, number> = {};
    cols.forEach((c) => {
      if (isNumeric(c.type))
        m[c.key] = Math.max(
          ...shown.map((r) => Math.abs(Number(r[c.key])) || 0),
          1
        );
    });
    return m;
  }, [cols, shown]);
  return (
    <WidgetCard w={w} data={data}>
      {shown.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`${t.inset} ${t.muted}`}>
                <th className="rounded-l-md px-2 py-1.5 font-medium">#</th>
                {cols.map((c, i) => (
                  <th
                    key={c.key}
                    className={`whitespace-nowrap px-2 py-1.5 font-medium ${isNumeric(c.type) ? 'text-right' : ''} ${i === cols.length - 1 ? 'rounded-r-md' : ''}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b last:border-b-0 ${t.line} ${t.body}`}
                >
                  <td className={`px-2 py-1.5 ${t.muted}`}>{i + 1}</td>
                  {cols.map((c) => {
                    const pct =
                      w.dataBars && maxes[c.key]
                        ? ((Math.abs(Number(r[c.key])) || 0) / maxes[c.key]) *
                          100
                        : 0;
                    return (
                      <td
                        key={c.key}
                        className={`max-w-[200px] truncate px-2 py-1.5 ${isNumeric(c.type) ? 'text-right tabular-nums' : ''}`}
                        style={
                          pct
                            ? {
                                background: `linear-gradient(90deg, ${hexA(data.colors[0], 0.16)} ${pct}%, transparent ${pct}%)`,
                              }
                            : undefined
                        }
                      >
                        <CellValue
                          field={c}
                          value={r[c.key]}
                          currency={data.currency}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {w.showTotals && (
              <tfoot>
                <tr
                  className={`border-t font-semibold ${t.lineStrong} ${t.text}`}
                >
                  <td className="px-2 py-1.5" />
                  {cols.map((c, i) => (
                    <td
                      key={c.key}
                      className="px-2 py-1.5 text-right tabular-nums"
                    >
                      {i === 0 && !isNumeric(c.type)
                        ? 'Total'
                        : isNumeric(c.type)
                          ? fmtMeasure(
                              aggregate(shown, 'sum', c.key, data.fieldMap),
                              'sum',
                              c,
                              data.currency,
                              'full'
                            )
                          : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </WidgetCard>
  );
};

const fillVars = (text: string, vars: Record<string, string>) =>
  text.replace(/\{\{(\w+)\}\}/g, (m, k) => vars[k] ?? m);

const TextView: React.FC<{ w: TextWidget; data: DataCtx }> = ({ w, data }) => {
  const t = useT();
  const text = fillVars(w.text, data.vars);
  if (w.variant === 'heading')
    return (
      <h2
        className={`rb-avoid px-1 pt-1 text-lg font-bold tracking-tight ${t.text}`}
      >
        {text}
      </h2>
    );
  if (w.variant === 'callout') {
    return (
      <div
        className={`rb-avoid flex gap-2.5 rounded-xl border-l-4 border-blue-500 px-3.5 py-3 text-[13px] leading-relaxed ${t.dark ? 'bg-blue-500/10 text-white/90' : 'bg-blue-50 text-slate-800'}`}
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <p>{text}</p>
      </div>
    );
  }
  return (
    <p className={`rb-avoid px-1 text-[13px] leading-relaxed ${t.body}`}>
      {text}
    </p>
  );
};

const InsightView: React.FC<{ w: InsightWidget; data: DataCtx }> = ({
  w,
  data,
}) => {
  const t = useT();
  const items = useMemo(() => {
    const rows = applyFilters(data.rows, w.filters, data.fieldMap);
    const prev =
      data.compare && data.prevRows
        ? applyFilters(data.prevRows, w.filters, data.fieldMap)
        : null;
    return buildInsights(
      rows,
      prev,
      w,
      data.fieldMap,
      data.autoBucket,
      data.currency
    );
  }, [data, w]);
  return (
    <WidgetCard w={w} data={data}>
      <ul className="space-y-2">
        {items.map((s, i) => (
          <li key={i} className={`flex gap-2 text-xs leading-snug ${t.body}`}>
            <span
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: data.colors[i % data.colors.length] }}
            />
            {s}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
};

const WidgetView: React.FC<{ widget: Widget; data: DataCtx }> = ({
  widget,
  data,
}) => {
  switch (widget.kind) {
    case 'kpi':
      return <KpiView w={widget} data={data} />;
    case 'chart':
      return <ChartView w={widget} data={data} />;
    case 'table':
      return <TableView w={widget} data={data} />;
    case 'text':
      return <TextView w={widget} data={data} />;
    case 'insight':
      return <InsightView w={widget} data={data} />;
  }
};

/* ==========================================================================
 * Widget library
 * ======================================================================== */
const WIDGET_LIBRARY: {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'kpi',
    label: 'KPI card',
    hint: 'Metric with trend and target',
    icon: Hash,
  },
  {
    id: 'insight',
    label: 'Key insights',
    hint: 'Auto-written findings',
    icon: Lightbulb,
  },
  {
    id: 'doughnut',
    label: 'Doughnut',
    hint: 'Share of total',
    icon: CircleDot,
  },
  { id: 'pie', label: 'Pie', hint: 'Share of total', icon: PieChart },
  {
    id: 'bar',
    label: 'Column',
    hint: 'Compare categories or time',
    icon: BarChart3,
  },
  {
    id: 'stacked',
    label: 'Stacked column',
    hint: 'Composition over time',
    icon: Layers,
  },
  {
    id: 'hbar',
    label: 'Bar ranking',
    hint: 'Ranked categories',
    icon: BarChartHorizontal,
  },
  { id: 'line', label: 'Line', hint: 'Trends over time', icon: LineIcon },
  { id: 'area', label: 'Area', hint: 'Volume over time', icon: AreaChart },
  {
    id: 'scatter',
    label: 'Scatter',
    hint: 'Relationship of two measures',
    icon: ScatterChart,
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    hint: 'Category × category matrix',
    icon: Grid3x3,
  },
  {
    id: 'pivot',
    label: 'Pivot table',
    hint: 'Exact figures with totals',
    icon: LayoutGrid,
  },
  { id: 'table', label: 'Table', hint: 'Ranked records', icon: Table2 },
  {
    id: 'text',
    label: 'Commentary',
    hint: 'Heading, text or callout',
    icon: Type,
  },
];

const WidgetMenu: React.FC<{
  onPick: (id: string) => void;
  close: () => void;
}> = ({ onPick, close }) => (
  <div className="grid grid-cols-1 gap-0.5">
    {WIDGET_LIBRARY.map((x) => (
      <MenuItem
        key={x.id}
        icon={<x.icon className="h-4 w-4" />}
        hint={x.hint}
        onClick={() => {
          onPick(x.id);
          close();
        }}
      >
        {x.label}
      </MenuItem>
    ))}
  </div>
);

/* ==========================================================================
 * Canvas
 * ======================================================================== */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(1000);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
const spanFor = (width: number, span: Span) =>
  width < 420 ? 12 : width < 640 ? (span <= 4 ? 6 : 12) : span;

const Canvas: React.FC<{
  widgets: Widget[];
  data: DataCtx;
  selectedId: string | null;
  readOnly: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd?: (typeId: string) => void;
}> = ({
  widgets,
  data,
  selectedId,
  readOnly,
  onSelect,
  onMove,
  onReorder,
  onDuplicate,
  onRemove,
  onAdd,
}) => {
  const t = useT();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const tb = `grid h-6 w-6 place-items-center rounded-md disabled:opacity-30 ${t.hover} ${t.muted} ${FOCUS}`;

  return (
    <div
      ref={ref}
      className="grid grid-cols-12 gap-3"
      onClick={() => !readOnly && onSelect(null)}
    >
      {widgets.length === 0 && (
        <div
          className={`col-span-12 rounded-xl border-2 border-dashed px-6 py-12 text-center ${t.lineStrong}`}
        >
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-blue-500" />
          <p className={`text-[13px] font-medium ${t.text}`}>
            This report is empty
          </p>
          <p className={`mt-0.5 text-xs ${t.muted}`}>
            Add a widget below, or use Auto-build in the toolbar.
          </p>
        </div>
      )}
      {widgets.map((w, idx) => {
        const selected = !readOnly && selectedId === w.id;
        const sp = spanFor(width, w.span);
        return (
          <div
            key={w.id}
            style={{ gridColumn: `span ${sp} / span ${sp}` }}
            className={`group relative rounded-xl transition-shadow ${w.pageBreak ? 'rb-pb' : ''} ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : readOnly ? '' : 'hover:ring-1 hover:ring-blue-300'} ${overId === w.id && dragId !== w.id ? 'ring-2 ring-blue-400' : ''} ${t.dark ? 'ring-offset-slate-900' : ''}`}
            draggable={!readOnly}
            onDragStart={() => setDragId(w.id)}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(e) => {
              if (dragId && dragId !== w.id) {
                e.preventDefault();
                setOverId(w.id);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== w.id) onReorder(dragId, w.id);
              setDragId(null);
              setOverId(null);
            }}
            onClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              onSelect(w.id);
            }}
            onKeyDown={(e) => {
              if (
                !readOnly &&
                (e.key === 'Enter' || e.key === ' ') &&
                e.target === e.currentTarget
              ) {
                e.preventDefault();
                onSelect(w.id);
              }
            }}
            tabIndex={readOnly ? -1 : 0}
            role={readOnly ? undefined : 'button'}
            aria-label={readOnly ? undefined : `Select widget ${w.title}`}
            aria-pressed={readOnly ? undefined : selected}
          >
            <WidgetView widget={w} data={data} />
            {selected && (
              <div
                className={`rb-noprint absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-lg border p-0.5 shadow-md ${t.card}`}
              >
                <span
                  className={`grid h-6 w-6 cursor-grab place-items-center ${t.muted}`}
                  aria-hidden="true"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </span>
                <button
                  type="button"
                  aria-label="Move earlier"
                  title="Move earlier"
                  disabled={idx === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(w.id, -1);
                  }}
                  className={tb}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Move later"
                  title="Move later"
                  disabled={idx === widgets.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(w.id, 1);
                  }}
                  className={tb}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Duplicate widget"
                  title="Duplicate (Ctrl+D)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(w.id);
                  }}
                  className={tb}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove widget"
                  title="Remove (Del)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(w.id);
                  }}
                  className={`${tb} !text-red-600`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
      {!readOnly && onAdd && (
        <div
          className="rb-noprint col-span-12"
          onClick={(e) => e.stopPropagation()}
        >
          <Popover
            width={300}
            trigger={({ toggle, ref: r }) => (
              <button
                ref={r}
                type="button"
                onClick={toggle}
                className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-medium transition-colors ${t.lineStrong} ${t.muted} hover:border-blue-400 hover:text-blue-600 ${FOCUS}`}
              >
                <Plus className="h-4 w-4" /> Add widget
              </button>
            )}
          >
            {(close) => <WidgetMenu onPick={onAdd} close={close} />}
          </Popover>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
 * Report header (paper) + filter chips
 * ======================================================================== */
function describeFilters(
  def: ReportDefinition,
  fieldMap: Map<string, FieldDef>
): string {
  const parts = [
    def.dateRange === 'custom' && def.customFrom && def.customTo
      ? `${fmtDate(def.customFrom)} to ${fmtDate(def.customTo)}`
      : RANGE_LABEL[def.dateRange],
  ];
  def.filters
    .filter((r) => r.field && r.value !== '')
    .forEach((r) =>
      parts.push(
        `${fieldMap.get(r.field)?.label ?? r.field} ${OP_LABEL[r.op]} ${r.value}`
      )
    );
  return parts.join(' · ');
}


  const formatDate = (date: Date): string => {
    // 1. Get the date parts (dd-MMM-yyyy)
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    };
    // Replace spaces with dashes
    const datePart = date.toLocaleDateString('en-GB', dateOptions).replace(/ /g, '-');

    // 2. Get the time parts (HH:mm:ss) in 24-hour format
    const timePart = date.toLocaleTimeString('en-GB', { hour12: false });

    return `${datePart} ${timePart}`;
  };

const ReportPaper: React.FC<{
  def: ReportDefinition;
  source: ReportSource;
  fieldMap: Map<string, FieldDef>;
  recordCount: number;
  user: string;
  children: React.ReactNode;
  id?: string;
}> = ({ def, source, fieldMap, recordCount, user, children, id }) => {
  const t = useT();
  const cls = CLASSIFICATION[def.classification];
  return (
    <div id={id} className={`rounded-xl border p-4 ${t.card}`}>
      <header className={`mb-3 border-b pb-3 ${t.lineStrong}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className={`truncate text-xl font-bold tracking-tight ${t.text}`}
            >
              {def.name || 'Untitled report'}
            </h2>
            {def.description && (
              <p className={`mt-0.5 text-xs ${t.muted}`}>{def.description}</p>
            )}
          </div>
          {def.classification !== 'none' && (
            <span className="flex shrink-0 items-center gap-1">
              <Lock className="h-3 w-3 text-amber-600" />
              <Badge value={cls.label} tone={cls.tone} />
            </span>
          )}
        </div>
        <p className={`mt-1.5 text-[11px] ${t.muted}`}>
          {source.name} · {describeFilters(def, fieldMap)} ·{' '}
          {recordCount.toLocaleString()} records · Prepared by {user} on{' '}
          {formatDate(new Date())}
        </p>
      </header>
      {children}
    </div>
  );
};

/* ==========================================================================
 * Filter editor
 * ======================================================================== */
const BOOL_OPTIONS = ['Yes', 'No', 'Unknown'];

const FilterEditor: React.FC<{
  fields: FieldDef[];
  rules: FilterRule[];
  allRows: Row[];
  onChange: (rules: FilterRule[]) => void;
}> = ({ fields, rules, allRows, onChange }) => {
  const t = useT();
  const optionsFor = useCallback(
    (fd: FieldDef) =>
      fd.type === 'boolean'
        ? BOOL_OPTIONS
        : fd.values?.length
          ? fd.values
          : [...new Set(allRows.map((r) => cellKey(fd, r)))]
              .filter((v) => v !== 'Unknown')
              .sort()
              .slice(0, 80),
    [allRows]
  );
  const patch = (id: string, p: Partial<FilterRule>) =>
    onChange(rules.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const add = () => {
    const first = fields[0];
    if (first)
      onChange([
        ...rules,
        { id: uid(), field: first.key, op: opsFor(first)[0], value: '' },
      ]);
  };
  return (
    <div className="space-y-2">
      {rules.length === 0 && (
        <p className={`text-xs ${t.muted}`}>No filters applied.</p>
      )}
      {rules.map((r) => {
        const fd = fields.find((x) => x.key === r.field) ?? fields[0];
        if (!fd) return null;
        const ranked = (r.op === 'atleast' || r.op === 'atmost') && fd.order;
        return (
          <div
            key={r.id}
            className={`space-y-1.5 rounded-lg border p-2 ${t.inset}`}
          >
            <div className="flex items-center gap-1.5">
              <div className="flex-1">
                <Select
                  label="Filter field"
                  value={r.field}
                  options={fields.map((x) => ({
                    value: x.key,
                    label: x.label,
                  }))}
                  onChange={(v) => {
                    const nf = fields.find((x) => x.key === v)!;
                    patch(r.id, { field: v, op: opsFor(nf)[0], value: '' });
                  }}
                />
              </div>
              <IconButton
                label="Remove filter"
                onClick={() => onChange(rules.filter((x) => x.id !== r.id))}
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
            <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-1.5">
              <Select
                label="Operator"
                value={r.op}
                options={opsFor(fd).map((o) => ({
                  value: o,
                  label: OP_LABEL[o],
                }))}
                onChange={(v) => patch(r.id, { op: v as FilterOp })}
              />
              {fd.type === 'category' || fd.type === 'boolean' ? (
                <Select
                  label="Value"
                  value={r.value}
                  options={[
                    { value: '', label: 'Select…' },
                    ...optionsFor(fd).map((o) => ({ value: o, label: o })),
                  ]}
                  onChange={(v) => patch(r.id, { value: v })}
                />
              ) : (
                <TextInput
                  aria-label="Value"
                  type={
                    isDateType(fd.type)
                      ? 'date'
                      : isNumeric(fd.type)
                        ? 'number'
                        : 'text'
                  }
                  step={
                    isNumeric(fd.type)
                      ? scaleOf(fd) > 0
                        ? String(10 ** -scaleOf(fd))
                        : 'any'
                      : undefined
                  }
                  value={r.value}
                  onChange={(e) => patch(r.id, { value: e.target.value })}
                  placeholder="Value"
                />
              )}
            </div>
            {ranked && (
              <p className={`text-[11px] ${t.muted}`}>
                Ranked: {fd.order!.filter((o) => o !== 'Unknown').join(' › ')}
              </p>
            )}
          </div>
        );
      })}
      <GhostButton onClick={add} icon={<Plus className="h-3.5 w-3.5" />}>
        Add filter
      </GhostButton>
    </div>
  );
};

/* ==========================================================================
 * Fields panel (+ data profile)
 * ======================================================================== */
const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Text',
  category: 'Category',
  number: 'Number',
  decimal: 'Decimal',
  currency: 'Currency',
  boolean: 'Yes/No',
  date: 'Date',
  datetime: 'Date & time',
};

const ProfileCard: React.FC<{ fd: FieldDef; rows: Row[] }> = ({ fd, rows }) => {
  const t = useT();
  const p = useMemo(() => profileField(fd, rows), [fd, rows]);
  const missing = p.total ? (p.nulls / p.total) * 100 : 0;
  const maxTop = Math.max(...p.top.map((x) => x.n), 1);
  return (
    <div className="space-y-2.5 text-xs">
      <div>
        <div className={`text-[13px] font-semibold ${t.text}`}>{fd.label}</div>
        <div className={t.muted}>
          {TYPE_LABEL[fd.type]}
          {isDecimal(fd.type) &&
            ` · NUMERIC(${fd.precision ?? 18},${scaleOf(fd)}) · exact`}
          {fd.currency && ` · ${fd.currency}`}
          {fd.order && ` · ranked`}
          {fd.sensitive && ' · sensitive'}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Records', p.total.toLocaleString()],
          ['Missing', `${missing.toFixed(1)}%`],
          ['Distinct', p.distinct.toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className={`rounded-lg border px-2 py-1.5 ${t.inset}`}>
            <div className={`text-[13px] font-semibold ${t.text}`}>{v}</div>
            <div className={`text-[10px] ${t.muted}`}>{k}</div>
          </div>
        ))}
      </div>
      {(p.min !== undefined || p.max !== undefined) && (
        <dl className="space-y-1">
          {(
            [
              ['Min', p.min],
              ['Max', p.max],
              ['Average', p.avg],
            ] as const
          )
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className={t.muted}>{k}</dt>
                <dd className={`tabular-nums ${t.text}`}>
                  {fd.sensitive ? MASK : v}
                </dd>
              </div>
            ))}
        </dl>
      )}
      {p.top.length > 0 && (
        <ul className="space-y-1">
          {p.top.map((x) => (
            <li
              key={x.label}
              className="grid grid-cols-[minmax(60px,35%)_minmax(0,1fr)_auto] items-center gap-2"
            >
              <span className={`truncate ${t.body}`}>
                {fd.sensitive ? MASK : x.label}
              </span>
              <span
                className={`h-1.5 overflow-hidden rounded-full ${t.dark ? 'bg-white/10' : 'bg-slate-100'}`}
              >
                <span
                  className="block h-full rounded-full bg-blue-500"
                  style={{ width: `${(x.n / maxTop) * 100}%` }}
                />
              </span>
              <span className={`tabular-nums ${t.muted}`}>{x.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const FieldsPanel: React.FC<{
  fields: FieldDef[];
  resetKey: string;
  rows: Row[];
  selected: string[];
  mode: 'select' | 'add';
  onToggle: (key: string) => void;
  onSetAll: (keys: string[]) => void;
  onAdd: (field: FieldDef) => void;
  onCustom: (editKey?: string) => void;
}> = ({
  fields,
  resetKey,
  rows,
  selected,
  mode,
  onToggle,
  onSetAll,
  onAdd,
  onCustom,
}) => {
  const t = useT();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('All');
  const groups = useMemo(
    () => [...new Set(fields.map((x) => x.group))],
    [fields]
  );
  useEffect(() => setTab('All'), [resetKey]);
  const visible = fields.filter(
    (x) =>
      (mode === 'select' || selected.includes(x.key)) &&
      (tab === 'All' || x.group === tab) &&
      x.label.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 p-3 pb-2">
        <div className="relative">
          <Search
            className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${t.muted}`}
          />
          <TextInput
            aria-label="Search fields"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fields…"
            className="pl-8"
          />
        </div>
        <div
          role="tablist"
          aria-label="Field groups"
          className="flex gap-1 overflow-x-auto pb-0.5"
        >
          {['All', ...groups].map((g) => (
            <button
              key={g}
              role="tab"
              type="button"
              aria-selected={tab === g}
              onClick={() => setTab(g)}
              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${tab === g ? 'bg-blue-600 text-white' : `${t.inset} border ${t.muted}`} ${FOCUS}`}
            >
              {g}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onCustom()}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-xs font-medium text-blue-600 hover:border-blue-400 ${t.lineStrong} ${FOCUS}`}
        >
          <Sparkles className="h-3.5 w-3.5" /> New custom field
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {mode === 'select' && (
          <div className="flex items-center justify-between px-1 pb-1">
            <span className={`text-[11px] ${t.muted}`}>
              {selected.length} of {fields.length} selected
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => onSetAll(fields.map((x) => x.key))}
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-600 ${t.hover} ${FOCUS}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onSetAll([])}
                className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${t.muted} ${t.hover} ${FOCUS}`}
              >
                None
              </button>
            </span>
          </div>
        )}
        {visible.length === 0 && (
          <p className={`px-3 py-8 text-center text-xs ${t.muted}`}>
            {mode === 'add'
              ? 'No selected fields match.'
              : 'No fields match your search.'}
          </p>
        )}
        {visible.map((x) => {
          const badges = (
            <>
              {x.derived && (
                <span className="rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">
                  fx
                </span>
              )}
              {x.sensitive && (
                <Lock
                  className="h-3 w-3 text-amber-600"
                  aria-label="Sensitive"
                />
              )}
              <span className={`text-[10px] ${t.muted}`}>
                {TYPE_LABEL[x.type]}
              </span>
            </>
          );
          return mode === 'select' ? (
            <div
              key={x.key}
              className={`flex items-center gap-0.5 rounded-lg pr-1 ${t.hover}`}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-2 py-1.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={selected.includes(x.key)}
                  onChange={() => onToggle(x.key)}
                  className={`h-3.5 w-3.5 rounded accent-blue-600 ${FOCUS}`}
                />
                <span className={`flex-1 truncate ${t.body}`}>{x.label}</span>
                {badges}
              </label>
              {x.derived && (
                <IconButton
                  label={`Edit ${x.label}`}
                  onClick={() => onCustom(x.key)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
              )}
              <Popover
                width={300}
                trigger={({ toggle, ref }) => (
                  <button
                    ref={ref}
                    type="button"
                    aria-label={`Profile of ${x.label}`}
                    title="Field profile"
                    onClick={toggle}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${t.muted} ${t.hover} ${FOCUS}`}
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </button>
                )}
              >
                {() => <ProfileCard fd={x} rows={rows} />}
              </Popover>
            </div>
          ) : (
            <button
              key={x.key}
              type="button"
              onClick={() => onAdd(x)}
              title={`Add a widget based on ${x.label}`}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] ${t.hover} ${FOCUS}`}
            >
              <span className={`flex-1 truncate ${t.body}`}>{x.label}</span>
              {badges}
              <Plus className="h-3.5 w-3.5 text-blue-600" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ==========================================================================
 * Custom fields: categorise and derive your own dimensions and measures
 * ======================================================================== */
const DERIVED_META: Record<
  DerivedKind,
  { icon: React.ComponentType<{ className?: string }>; hint: string }
> = {
  bands: {
    icon: BarChart3,
    hint: 'Split an amount or score into ranges: Low / Medium / High value',
  },
  groups: { icon: Layers, hint: 'Combine categories into your own groups' },
  dateparts: {
    icon: CalendarDays,
    hint: 'Month, quarter, weekday or hour of a date',
  },
  calc: {
    icon: Hash,
    hint: 'Net loss = amount − recovered, recovery %, ratios',
  },
  rules: {
    icon: Filter,
    hint: 'CASE WHEN segments, or a Yes/No flag, from conditions',
  },
};

function newDerived(kind: DerivedKind, fields: FieldDef[]): DerivedField {
  const base = { id: uid(), key: '', label: '' };
  const nums = fields.filter((x) => isNumeric(x.type));
  const cats = fields.filter((x) => x.type === 'category');
  const dates = fields.filter((x) => isDateType(x.type));
  switch (kind) {
    case 'bands':
      return {
        ...base,
        kind,
        label: 'Value band',
        source:
          nums.find((x) => x.type === 'currency')?.key ?? nums[0]?.key ?? '',
        edges: [],
      };
    case 'groups':
      return {
        ...base,
        kind,
        label: 'Custom group',
        source: cats[0]?.key ?? '',
        groups: [{ name: 'Group 1', values: [] }],
        other: 'Other',
      };
    case 'dateparts':
      return {
        ...base,
        kind,
        label: 'Month of year',
        source: dates[0]?.key ?? '',
        part: 'month',
      };
    case 'calc':
      return {
        ...base,
        kind,
        label: 'Net amount',
        a: nums[0]?.key ?? '',
        b: nums[1]?.key ?? nums[0]?.key ?? '',
        op: 'sub',
      };
    case 'rules':
      return {
        ...base,
        kind,
        label: 'Segment',
        cases: [{ id: uid(), label: 'Segment 1', rules: [] }],
        otherwise: 'Other',
      };
  }
}

const isDraftValid = (d: DerivedField) => {
  if (!d.label.trim()) return false;
  switch (d.kind) {
    case 'bands':
      return !!d.source && d.edges.length > 0;
    case 'groups':
      return (
        !!d.source && d.groups.some((g) => g.name.trim() && g.values.length > 0)
      );
    case 'dateparts':
      return !!d.source;
    case 'calc':
      return !!d.a && !!d.b;
    case 'rules':
      return d.cases.some((c) => activeRules(c.rules).length > 0);
  }
};

const CustomFieldsModal: React.FC<{
  open: boolean;
  editKey: string | null;
  fields: FieldDef[];
  derived: DerivedField[];
  rows: Row[];
  onClose: () => void;
  onSave: (d: DerivedField) => void;
  onRemove: (id: string) => void;
}> = ({ open, editKey, fields, derived, rows, onClose, onSave, onRemove }) => {
  const t = useT();
  const [draft, setDraft] = useState<DerivedField | null>(null);
  const [edgesText, setEdgesText] = useState('');

  useEffect(() => {
    if (!open) return;
    const ex = editKey ? derived.find((d) => d.key === editKey) : undefined;
    const d = ex ? (JSON.parse(JSON.stringify(ex)) as DerivedField) : null;
    setDraft(d);
    setEdgesText(d?.kind === 'bands' ? d.edges.join(', ') : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editKey]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  // catalogue the draft may reference: everything except the field being edited
  const refFields = useMemo(
    () => fields.filter((x) => !draft || x.key !== draft.key),
    [fields, draft]
  );
  const refMap = useMemo(
    () => new Map(refFields.map((x) => [x.key, x])),
    [refFields]
  );

  const preview = useMemo(() => {
    if (!draft || !isDraftValid(draft)) return null;
    const sample = rows.slice(0, 3000);
    const key = draft.key || '__preview';
    const d = { ...draft, key } as DerivedField;
    const out = applyDerived(sample, [d], refFields);
    const fd = out.fields.find((x) => x.key === key);
    if (!fd) return null;
    return {
      fd,
      profile: profileField(fd, out.rows),
      groups: isCat(fd.type)
        ? groupRows(out.rows, fd, 'month').slice(0, 8)
        : [],
    };
  }, [draft, rows, refFields]);

  if (!open) return null;
  const nums = refFields.filter((x) => isNumeric(x.type));
  const cats = refFields.filter((x) => x.type === 'category');
  const dates = refFields.filter((x) => isDateType(x.type));
  const set = (p: Record<string, unknown>) =>
    setDraft((d) => (d ? ({ ...d, ...p } as DerivedField) : d));
  const maxG = Math.max(
    ...(preview?.groups.map((g) => g.rows.length) ?? [1]),
    1
  );

  const suggestEdges = () => {
    if (!draft || draft.kind !== 'bands') return;
    const vals = rows
      .map((r) => Number(r[draft.source]))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (vals.length < 4) return;
    const q = (p: number) => vals[Math.floor((vals.length - 1) * p)];
    const nice = (n: number) => {
      const m = 10 ** Math.max(0, Math.floor(Math.log10(Math.abs(n) || 1)) - 1);
      return Math.round(n / m) * m;
    };
    const e = [...new Set([q(0.25), q(0.5), q(0.75)].map(nice))];
    set({ edges: e, labels: undefined });
    setEdgesText(e.join(', '));
  };

  const body = (() => {
    if (!draft) return null;
    switch (draft.kind) {
      case 'bands': {
        const labels = bandLabelsOf({ ...draft, labels: undefined });
        return (
          <>
            <Field label="Numeric field">
              <Select
                value={draft.source}
                options={nums.map((x) => ({ value: x.key, label: x.label }))}
                onChange={(v) => set({ source: v })}
              />
            </Field>
            <Field
              label="Band boundaries (ascending, comma-separated)"
              hint="Values below the first boundary form the first band; each boundary starts the next band."
            >
              <div className="flex gap-2">
                <TextInput
                  value={edgesText}
                  placeholder="e.g. 1000, 5000, 20000"
                  onChange={(e) => {
                    setEdgesText(e.target.value);
                    set({
                      edges: e.target.value
                        .split(',')
                        .map((x) => Number(x.trim()))
                        .filter((n) => x_ok(n)),
                    });
                  }}
                />
                <GhostButton
                  onClick={suggestEdges}
                  icon={<Sparkles className="h-3.5 w-3.5 text-blue-600" />}
                  title="Quartile boundaries from your data"
                >
                  Suggest
                </GhostButton>
              </div>
            </Field>
            {draft.edges.length > 0 && (
              <Field label="Band names (optional)">
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {labels.map((l, i) => (
                    <TextInput
                      key={i}
                      aria-label={`Band ${i + 1} name`}
                      value={draft.labels?.[i] ?? ''}
                      placeholder={l}
                      onChange={(e) => {
                        const next = [...(draft.labels ?? [])];
                        while (next.length < labels.length) next.push('');
                        next[i] = e.target.value;
                        set({ labels: next });
                      }}
                    />
                  ))}
                </div>
              </Field>
            )}
          </>
        );
      }
      case 'groups': {
        const src = refMap.get(draft.source);
        const values = src?.values ?? [];
        return (
          <>
            <Field label="Category field">
              <Select
                value={draft.source}
                options={cats.map((x) => ({ value: x.key, label: x.label }))}
                onChange={(v) =>
                  set({
                    source: v,
                    groups: draft.groups.map((g) => ({ ...g, values: [] })),
                  })
                }
              />
            </Field>
            <div className="space-y-2">
              {draft.groups.map((g, gi) => (
                <div
                  key={gi}
                  className={`space-y-2 rounded-lg border p-2.5 ${t.inset}`}
                >
                  <div className="flex items-center gap-2">
                    <TextInput
                      aria-label="Group name"
                      value={g.name}
                      onChange={(e) =>
                        set({
                          groups: draft.groups.map((x, i) =>
                            i === gi ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                    />
                    <IconButton
                      label="Remove group"
                      onClick={() =>
                        set({ groups: draft.groups.filter((_, i) => i !== gi) })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v) => {
                      const mine = g.values.includes(v);
                      const elsewhere =
                        !mine && draft.groups.some((x) => x.values.includes(v));
                      return (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={mine}
                          onClick={() =>
                            set({
                              groups: draft.groups.map((x, i) => ({
                                ...x,
                                values:
                                  i === gi
                                    ? mine
                                      ? x.values.filter((y) => y !== v)
                                      : [...x.values, v]
                                    : x.values.filter((y) => y !== v),
                              })),
                            })
                          }
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${mine ? 'border-blue-600 bg-blue-600 text-white' : elsewhere ? `${t.btn} opacity-45` : t.btn} ${FOCUS}`}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <GhostButton
                onClick={() =>
                  set({
                    groups: [
                      ...draft.groups,
                      { name: `Group ${draft.groups.length + 1}`, values: [] },
                    ],
                  })
                }
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Add group
              </GhostButton>
            </div>
            <Field label="Everything else is called">
              <TextInput
                value={draft.other}
                onChange={(e) => set({ other: e.target.value })}
              />
            </Field>
          </>
        );
      }
      case 'dateparts':
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date field">
              <Select
                value={draft.source}
                options={dates.map((x) => ({ value: x.key, label: x.label }))}
                onChange={(v) => set({ source: v })}
              />
            </Field>
            <Field label="Part">
              <Select
                value={draft.part}
                options={(Object.keys(PART_LABEL) as DatePart[]).map((k) => ({
                  value: k,
                  label: PART_LABEL[k],
                }))}
                onChange={(v) => set({ part: v })}
              />
            </Field>
          </div>
        );
      case 'calc':
        return (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="A">
                <Select
                  value={draft.a}
                  options={nums.map((x) => ({ value: x.key, label: x.label }))}
                  onChange={(v) => set({ a: v })}
                />
              </Field>
              <Field label="Operation">
                <Select
                  value={draft.op}
                  options={(Object.keys(CALC_LABEL) as CalcOp[]).map((k) => ({
                    value: k,
                    label: CALC_LABEL[k],
                  }))}
                  onChange={(v) => set({ op: v })}
                />
              </Field>
              <Field label="B">
                <Select
                  value={draft.b}
                  options={nums.map((x) => ({ value: x.key, label: x.label }))}
                  onChange={(v) => set({ b: v })}
                />
              </Field>
            </div>
            <p className={`text-[11px] ${t.muted}`}>
              Sums and differences of amounts stay exact to the cent. Division
              by zero gives an empty value.
            </p>
          </>
        );
      case 'rules':
        return (
          <>
            <SwitchRow
              label="Output a Yes/No flag instead of named segments"
              checked={!!draft.asBoolean}
              onChange={(v) =>
                set({
                  asBoolean: v,
                  cases: v ? draft.cases.slice(0, 1) : draft.cases,
                })
              }
            />
            <div className="space-y-2">
              {draft.cases.map((c, ci) => (
                <div
                  key={c.id}
                  className={`space-y-2 rounded-lg border p-2.5 ${t.inset}`}
                >
                  <div className="flex items-center gap-2">
                    {!draft.asBoolean && (
                      <TextInput
                        aria-label="Segment name"
                        value={c.label}
                        onChange={(e) =>
                          set({
                            cases: draft.cases.map((x, i) =>
                              i === ci ? { ...x, label: e.target.value } : x
                            ),
                          })
                        }
                      />
                    )}
                    {draft.asBoolean && (
                      <span
                        className={`flex-1 text-xs font-semibold ${t.text}`}
                      >
                        Yes when all conditions match
                      </span>
                    )}
                    {!draft.asBoolean && (
                      <>
                        <IconButton
                          label="Move up"
                          disabled={ci === 0}
                          onClick={() => {
                            const n = [...draft.cases];
                            [n[ci - 1], n[ci]] = [n[ci], n[ci - 1]];
                            set({ cases: n });
                          }}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label="Move down"
                          disabled={ci === draft.cases.length - 1}
                          onClick={() => {
                            const n = [...draft.cases];
                            [n[ci + 1], n[ci]] = [n[ci], n[ci + 1]];
                            set({ cases: n });
                          }}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </IconButton>
                        <IconButton
                          label="Remove segment"
                          onClick={() =>
                            set({
                              cases: draft.cases.filter((_, i) => i !== ci),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </>
                    )}
                  </div>
                  <FilterEditor
                    fields={refFields}
                    rules={c.rules}
                    allRows={rows}
                    onChange={(rules) =>
                      set({
                        cases: draft.cases.map((x, i) =>
                          i === ci ? { ...x, rules } : x
                        ),
                      })
                    }
                  />
                </div>
              ))}
              {!draft.asBoolean && (
                <GhostButton
                  onClick={() =>
                    set({
                      cases: [
                        ...draft.cases,
                        {
                          id: uid(),
                          label: `Segment ${draft.cases.length + 1}`,
                          rules: [],
                        },
                      ],
                    })
                  }
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add segment
                </GhostButton>
              )}
            </div>
            {!draft.asBoolean && (
              <Field
                label="Anything that matches no segment"
                hint="Segments are checked top to bottom; the first match wins."
              >
                <TextInput
                  value={draft.otherwise}
                  onChange={(e) => set({ otherwise: e.target.value })}
                />
              </Field>
            )}
          </>
        );
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Custom fields"
        onClick={(e) => e.stopPropagation()}
        className={`flex h-[min(780px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border ${t.dark ? 'bg-slate-900' : 'bg-white'} ${t.lineStrong}`}
      >
        <div
          className={`flex items-center justify-between border-b px-4 py-3 ${t.lineStrong}`}
        >
          <div>
            <h2
              className={`flex items-center gap-2 text-sm font-semibold ${t.text}`}
            >
              <Sparkles className="h-4 w-4 text-blue-600" /> Custom fields
            </h2>
            <p className={`text-[11px] ${t.muted}`}>
              Categorise your data: bands, groups, date parts, calculations and
              rule segments. They work like any other field in charts, filters
              and tables.
            </p>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[240px_minmax(0,1fr)]">
          <div
            className={`min-h-0 overflow-y-auto border-b p-3 md:border-b-0 md:border-r ${t.lineStrong}`}
          >
            <div className={`mb-1.5 text-[11px] font-semibold ${t.muted}`}>
              Create new
            </div>
            <div className="space-y-1">
              {(Object.keys(DERIVED_META) as DerivedKind[]).map((k) => {
                const M = DERIVED_META[k];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      const d = newDerived(k, fields);
                      setDraft(d);
                      setEdgesText('');
                    }}
                    className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left ${draft && !draft.key && draft.kind === k ? t.selected : t.btn} ${FOCUS}`}
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${t.chipIcon}`}
                    >
                      <M.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold">
                        {DERIVED_LABEL[k]}
                      </span>
                      <span
                        className={`block text-[11px] leading-snug ${t.muted}`}
                      >
                        {M.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={`mb-1.5 mt-4 text-[11px] font-semibold ${t.muted}`}>
              Your fields ({derived.length})
            </div>
            {derived.length === 0 && (
              <p className={`text-xs ${t.muted}`}>None yet.</p>
            )}
            <ul className="space-y-1">
              {derived.map((d) => (
                <li
                  key={d.id}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 ${draft?.id === d.id ? t.selected : t.lineStrong}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(JSON.parse(JSON.stringify(d)));
                      setEdgesText(
                        d.kind === 'bands' ? d.edges.join(', ') : ''
                      );
                    }}
                    className={`min-w-0 flex-1 text-left ${FOCUS}`}
                  >
                    <span
                      className={`block truncate text-[13px] font-medium ${t.text}`}
                    >
                      {d.label}
                    </span>
                    <span className={`block text-[10px] ${t.muted}`}>
                      {DERIVED_LABEL[d.kind]}
                    </span>
                  </button>
                  <IconButton
                    label={`Delete ${d.label}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete "${d.label}"? Widgets using it will be updated.`
                        )
                      ) {
                        onRemove(d.id);
                        if (draft?.id === d.id) setDraft(null);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-h-0 overflow-y-auto p-4">
            {!draft ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Sparkles className="h-8 w-8 text-blue-500" />
                <p className={`text-[13px] font-medium ${t.text}`}>
                  Pick a type on the left to start
                </p>
                <p className={`max-w-sm text-xs ${t.muted}`}>
                  For example, band the transaction amount into Low / Medium /
                  High value, group fraud types into customer-facing and
                  internal, or flag high-priority alerts that were not
                  escalated.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${t.chipIcon}`}
                  >
                    {DERIVED_LABEL[draft.kind]}
                  </span>
                  <div className="flex-1">
                    <TextInput
                      aria-label="Field name"
                      value={draft.label}
                      onChange={(e) => set({ label: e.target.value })}
                      placeholder="Field name, e.g. Value band"
                    />
                  </div>
                </div>
                {body}
                <div className={`rounded-xl border p-3 ${t.inset}`}>
                  <div className={`mb-2 text-xs font-semibold ${t.text}`}>
                    Live preview{' '}
                    <span className={`font-normal ${t.muted}`}>
                      · first {Math.min(rows.length, 3000).toLocaleString()}{' '}
                      records
                    </span>
                  </div>
                  {!preview ? (
                    <p className={`text-xs ${t.muted}`}>
                      Complete the settings above to see how your data is
                      categorised.
                    </p>
                  ) : preview.groups.length > 0 ? (
                    <ul className="space-y-1.5">
                      {preview.groups.map((g) => (
                        <li
                          key={g.key}
                          className="grid grid-cols-[minmax(80px,30%)_minmax(0,1fr)_auto] items-center gap-2 text-xs"
                        >
                          <span className={`truncate ${t.body}`}>{g.key}</span>
                          <span
                            className={`h-2 overflow-hidden rounded-full ${t.dark ? 'bg-white/10' : 'bg-slate-200'}`}
                          >
                            <span
                              className="block h-full rounded-full bg-blue-500"
                              style={{
                                width: `${(g.rows.length / maxG) * 100}%`,
                              }}
                            />
                          </span>
                          <span className={`tabular-nums ${t.muted}`}>
                            {g.rows.length.toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      {(
                        [
                          ['Min', preview.profile.min],
                          ['Average', preview.profile.avg],
                          ['Max', preview.profile.max],
                        ] as const
                      ).map(([k, v]) => (
                        <div key={k}>
                          <dt className={t.muted}>{k}</dt>
                          <dd
                            className={`text-[13px] font-semibold tabular-nums ${t.text}`}
                          >
                            {v ?? '—'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div
          className={`flex items-center justify-end gap-2 border-t px-4 py-3 ${t.lineStrong}`}
        >
          <GhostButton onClick={onClose}>Close</GhostButton>
          <button
            type="button"
            disabled={!draft || !isDraftValid(draft)}
            onClick={() => draft && onSave(draft)}
            className={PRIMARY_BTN}
          >
            <Check className="h-3.5 w-3.5" />{' '}
            {draft?.key ? 'Update field' : 'Save and use field'}
          </button>
        </div>
      </div>
    </div>
  );
};

const x_ok = (n: number) => Number.isFinite(n);

/* ==========================================================================
 * Data preview
 * ======================================================================== */
const DataPreview: React.FC<{
  rows: Row[];
  fields: FieldDef[];
  currency: string;
  limit?: number;
}> = ({ rows, fields, currency, limit = 12 }) => {
  const t = useT();
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / limit));
  useEffect(() => setPage(0), [rows, fields]);
  const slice = rows.slice(page * limit, page * limit + limit);
  if (fields.length === 0)
    return (
      <p className={`py-10 text-center text-[13px] ${t.muted}`}>
        Select at least one field to preview data.
      </p>
    );
  return (
    <div className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0">
            <tr
              className={`${t.dark ? 'bg-slate-800' : 'bg-slate-50'} ${t.muted}`}
            >
              {fields.map((x) => (
                <th
                  key={x.key}
                  className="whitespace-nowrap px-2.5 py-1.5 font-medium"
                >
                  {x.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr key={i} className={`border-b ${t.line} ${t.body}`}>
                {fields.map((x) => (
                  <td
                    key={x.key}
                    className="max-w-[200px] truncate px-2.5 py-1.5"
                  >
                    <CellValue field={x} value={r[x.key]} currency={currency} />
                  </td>
                ))}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td
                  colSpan={fields.length}
                  className={`py-10 text-center ${t.muted}`}
                >
                  No records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div
        className={`flex shrink-0 items-center justify-between pt-2 text-[11px] ${t.muted}`}
      >
        <span>{rows.length.toLocaleString()} records</span>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className={`rounded-md border px-2 py-0.5 disabled:opacity-40 ${t.btn} ${FOCUS}`}
          >
            Prev
          </button>
          {page + 1} / {pages}
          <button
            type="button"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
            className={`rounded-md border px-2 py-0.5 disabled:opacity-40 ${t.btn} ${FOCUS}`}
          >
            Next
          </button>
        </span>
      </div>
    </div>
  );
};

/* ==========================================================================
 * Inspectors
 * ======================================================================== */
const CHART_TYPES: {
  value: ChartType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'doughnut', label: 'Doughnut', icon: CircleDot },
  { value: 'pie', label: 'Pie', icon: PieChart },
  { value: 'bar', label: 'Column', icon: BarChart3 },
  { value: 'stacked', label: 'Stacked', icon: Layers },
  { value: 'hbar', label: 'Ranking', icon: BarChartHorizontal },
  { value: 'line', label: 'Line', icon: LineIcon },
  { value: 'area', label: 'Area', icon: AreaChart },
  { value: 'scatter', label: 'Scatter', icon: ScatterChart },
  { value: 'heatmap', label: 'Heatmap', icon: Grid3x3 },
  { value: 'pivot', label: 'Pivot', icon: LayoutGrid },
];
const SPAN_OPTIONS: { value: string; label: string }[] = [
  { value: '3', label: '¼' },
  { value: '4', label: '⅓' },
  { value: '6', label: '½' },
  { value: '8', label: '⅔' },
  { value: '12', label: 'Full' },
];

const WidgetInspector: React.FC<{
  widget: Widget;
  fields: FieldDef[];
  allFields: FieldDef[];
  allRows: Row[];
  onPatch: (p: Partial<Widget>, coalesceKey?: string) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}> = ({
  widget,
  fields,
  allFields,
  allRows,
  onPatch,
  onDuplicate,
  onRemove,
}) => {
  const t = useT();
  const patch = (p: Record<string, unknown>, key?: string) =>
    onPatch(p as Partial<Widget>, key);
  const numeric = fields.filter((x) => isNumeric(x.type));
  const dims = fields.filter((x) => isDim(x.type));
  const cats = fields.filter((x) => isCat(x.type));
  const bools = fields.filter((x) => x.type === 'boolean');
  const AGGS: Agg[] = [
    'count',
    'sum',
    'avg',
    'min',
    'max',
    'distinct',
    'yes',
    'rate',
  ];
  const measureOpts = (agg: Agg) =>
    (agg === 'distinct'
      ? fields
      : agg === 'yes' || agg === 'rate'
        ? bools
        : numeric
    ).map((x) => ({ value: x.key, label: x.label }));
  const aggOpts = AGGS.filter(
    (a) => a === 'count' || measureOpts(a).length > 0
  ).map((a) => ({ value: a, label: aggLabel(a) }));

  const measure = (agg: Agg, field?: string) => (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Value">
        <Select
          value={agg}
          options={aggOpts}
          onChange={(v) => {
            const a = v as Agg;
            const o = measureOpts(a);
            patch({
              agg: a,
              field:
                a === 'count'
                  ? undefined
                  : o.some((x) => x.value === field)
                    ? field
                    : o[0]?.value,
            });
          }}
        />
      </Field>
      {agg !== 'count' ? (
        <Field label="Measure">
          <Select
            value={field ?? ''}
            options={measureOpts(agg)}
            onChange={(v) => patch({ field: v })}
          />
        </Field>
      ) : (
        <span />
      )}
    </div>
  );

  const setChartType = (type: ChartType) => {
    if (widget.kind !== 'chart') return;
    const p: Record<string, unknown> = { chartType: type };
    if (type === 'scatter') {
      p.xField = widget.xField ?? numeric[0]?.key;
      p.field = numeric.find((x) => x.key !== p.xField)?.key ?? numeric[0]?.key;
      p.agg = 'avg';
    }
    if (
      (type === 'stacked' || type === 'heatmap' || type === 'pivot') &&
      !widget.breakBy
    )
      p.breakBy = cats.find((x) => x.key !== widget.groupBy)?.key;
    patch(p);
  };

  const noteField = (
    <Field label="Annotation (shown under the title)">
      <TextInput
        value={widget.note ?? ''}
        onChange={(e) => patch({ note: e.target.value }, `note-${widget.id}`)}
        placeholder="e.g. Driven by card-not-present spikes"
      />
    </Field>
  );

  const layout = (
    <Section
      title="Layout"
      badge={`${SPAN_OPTIONS.find((s) => s.value === String(widget.span))?.label ?? ''} width`}
    >
      <Field label="Width">
        <Segmented
          label="Width"
          value={String(widget.span)}
          options={SPAN_OPTIONS}
          onChange={(v) => patch({ span: Number(v) })}
        />
      </Field>
      {widget.kind === 'chart' && (
        <Field label="Height">
          <Segmented
            label="Height"
            value={widget.height}
            options={[
              { value: 'sm', label: 'Short' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Tall' },
            ]}
            onChange={(v) => patch({ height: v })}
          />
        </Field>
      )}
      <SwitchRow
        label="Start on a new page when printing"
        checked={!!widget.pageBreak}
        onChange={(v) => patch({ pageBreak: v })}
      />
    </Section>
  );

  const filters = (
    <Section
      title="Widget filters"
      badge={widget.filters.length ? String(widget.filters.length) : undefined}
    >
      <FilterEditor
        fields={allFields}
        rules={widget.filters}
        allRows={allRows}
        onChange={(f) => patch({ filters: f })}
      />
    </Section>
  );

  const kindLabel = {
    kpi: 'KPI card',
    chart: 'Chart',
    table: 'Table',
    text: 'Commentary',
    insight: 'Key insights',
  }[widget.kind];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`border-b p-3 ${t.line}`}>
          <Field label={`${kindLabel} title`}>
            <TextInput
              value={widget.title}
              onChange={(e) =>
                patch({ title: e.target.value }, `title-${widget.id}`)
              }
            />
          </Field>
        </div>

        {widget.kind === 'chart' && (
          <>
            <Section
              title="Visualisation"
              defaultOpen
              badge={
                CHART_TYPES.find((c) => c.value === widget.chartType)?.label
              }
            >
              <div className="grid grid-cols-5 gap-1.5">
                {CHART_TYPES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    aria-pressed={widget.chartType === c.value}
                    onClick={() => setChartType(c.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px] font-medium ${widget.chartType === c.value ? t.selected : t.btn} ${FOCUS}`}
                  >
                    <c.icon className="h-4 w-4" />
                    {c.label}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Data" defaultOpen>
              {widget.chartType === 'scatter' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="X axis">
                      <Select
                        value={widget.xField ?? ''}
                        options={numeric.map((x) => ({
                          value: x.key,
                          label: x.label,
                        }))}
                        onChange={(v) => patch({ xField: v })}
                      />
                    </Field>
                    <Field label="Y axis">
                      <Select
                        value={widget.field ?? ''}
                        options={numeric.map((x) => ({
                          value: x.key,
                          label: x.label,
                        }))}
                        onChange={(v) => patch({ field: v })}
                      />
                    </Field>
                  </div>
                  <Field label="Colour by">
                    <Select
                      value={widget.breakBy ?? ''}
                      options={[
                        { value: '', label: 'None' },
                        ...cats.map((x) => ({ value: x.key, label: x.label })),
                      ]}
                      onChange={(v) => patch({ breakBy: v || undefined })}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field
                    label={
                      widget.chartType === 'heatmap' ||
                      widget.chartType === 'pivot'
                        ? 'Rows'
                        : 'Group by'
                    }
                  >
                    <Select
                      value={widget.groupBy}
                      options={dims.map((x) => ({
                        value: x.key,
                        label: x.label,
                      }))}
                      onChange={(v) => patch({ groupBy: v })}
                    />
                  </Field>
                  {!['doughnut', 'pie', 'hbar'].includes(widget.chartType) && (
                    <Field
                      label={
                        widget.chartType === 'heatmap' ||
                        widget.chartType === 'pivot'
                          ? 'Columns'
                          : 'Break down by'
                      }
                    >
                      <Select
                        value={widget.breakBy ?? ''}
                        options={[
                          { value: '', label: 'None' },
                          ...cats
                            .filter((x) => x.key !== widget.groupBy)
                            .map((x) => ({ value: x.key, label: x.label })),
                        ]}
                        onChange={(v) => patch({ breakBy: v || undefined })}
                      />
                    </Field>
                  )}
                  {isDateType(
                    allFields.find((x) => x.key === widget.groupBy)?.type ??
                      'text'
                  ) ? (
                    <Field label="Interval">
                      <Segmented
                        label="Interval"
                        value={widget.bucket}
                        options={[
                          { value: 'auto', label: 'Auto' },
                          { value: 'day', label: 'Day' },
                          { value: 'week', label: 'Week' },
                          { value: 'month', label: 'Month' },
                        ]}
                        onChange={(v) => patch({ bucket: v })}
                      />
                    </Field>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Show top">
                          <Select
                            value={String(widget.topN)}
                            options={[3, 4, 5, 6, 8, 10, 15, 20].map((n) => ({
                              value: String(n),
                              label: `${n} groups`,
                            }))}
                            onChange={(v) => patch({ topN: Number(v) })}
                          />
                        </Field>
                        <Field label="Order">
                          <Select
                            value={widget.sort ?? 'auto'}
                            options={[
                              {
                                value: 'auto',
                                label: allFields.find(
                                  (x) => x.key === widget.groupBy
                                )?.order
                                  ? 'Ranked (priority)'
                                  : 'Auto (largest first)',
                              },
                              {
                                value: 'valueDesc',
                                label: 'Value, high → low',
                              },
                              { value: 'valueAsc', label: 'Value, low → high' },
                              { value: 'label', label: 'Name, A → Z' },
                            ]}
                            onChange={(v) => patch({ sort: v })}
                          />
                        </Field>
                      </div>
                      <SwitchRow
                        label="Group the rest as “Others”"
                        checked={!!widget.others}
                        onChange={(v) => patch({ others: v })}
                      />
                    </>
                  )}
                  {measure(widget.agg, widget.field)}
                </>
              )}
            </Section>
            <Section title="Display">
              {widget.chartType !== 'scatter' && (
                <SwitchRow
                  label="Legend"
                  checked={widget.showLegend}
                  onChange={(v) => patch({ showLegend: v })}
                />
              )}
              <SwitchRow
                label="Data labels"
                checked={widget.showLabels}
                onChange={(v) => patch({ showLabels: v })}
              />
              {(widget.chartType === 'doughnut' ||
                widget.chartType === 'pie') && (
                <SwitchRow
                  label="Percentages"
                  checked={widget.showPercentage}
                  onChange={(v) => patch({ showPercentage: v })}
                />
              )}
              {widget.chartType === 'stacked' && (
                <SwitchRow
                  label="100% stacked"
                  checked={!!widget.normalize}
                  onChange={(v) => patch({ normalize: v })}
                />
              )}
              {widget.chartType === 'pivot' && (
                <SwitchRow
                  label="Row and column totals"
                  checked={!!widget.showTotals}
                  onChange={(v) => patch({ showTotals: v })}
                />
              )}
              {['bar', 'line', 'area', 'stacked'].includes(widget.chartType) &&
                !widget.normalize && (
                  <Field label="Target line (optional)">
                    <TextInput
                      type="number"
                      value={widget.refLine ?? ''}
                      onChange={(e) =>
                        patch(
                          {
                            refLine:
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                          },
                          `ref-${widget.id}`
                        )
                      }
                      placeholder="e.g. 50 000"
                    />
                  </Field>
                )}
              {noteField}
            </Section>
          </>
        )}

        {widget.kind === 'kpi' && (
          <>
            <Section title="Data" defaultOpen>
              {measure(widget.agg, widget.field)}
            </Section>
            <Section title="Display" defaultOpen>
              <Field label="Colour">
                <div
                  className="flex gap-2"
                  role="radiogroup"
                  aria-label="Card colour"
                >
                  {(Object.keys(TONES) as Tone[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={widget.tone === k}
                      aria-label={k}
                      onClick={() => patch({ tone: k })}
                      className={`grid h-6 w-6 place-items-center rounded-full ring-offset-2 ${widget.tone === k ? 'ring-2 ring-blue-500' : ''} ${t.dark ? 'ring-offset-slate-900' : ''} ${FOCUS}`}
                      style={{ background: TONES[k].hex }}
                    >
                      {widget.tone === k && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Number format">
                <Segmented
                  label="Number format"
                  value={widget.format ?? 'compact'}
                  options={[
                    { value: 'compact', label: 'Compact (AED 1.2M)' },
                    { value: 'full', label: 'Exact (AED 1,234,567.89)' },
                  ]}
                  onChange={(v) => patch({ format: v })}
                />
              </Field>
              <SwitchRow
                label="Compare with prior period"
                checked={widget.showTrend}
                onChange={(v) => patch({ showTrend: v })}
              />
              <SwitchRow
                label="Sparkline"
                checked={widget.showSparkline}
                onChange={(v) => patch({ showSparkline: v })}
              />
              <SwitchRow
                label="Lower is better"
                checked={widget.lowerIsBetter}
                onChange={(v) => patch({ lowerIsBetter: v })}
              />
              <Field label="Target (optional)">
                <TextInput
                  type="number"
                  value={widget.target ?? ''}
                  onChange={(e) =>
                    patch(
                      {
                        target:
                          e.target.value === ''
                            ? undefined
                            : Number(e.target.value),
                      },
                      `tg-${widget.id}`
                    )
                  }
                  placeholder="e.g. 20"
                />
              </Field>
              {noteField}
            </Section>
          </>
        )}

        {widget.kind === 'table' && (
          <>
            <Section
              title="Columns"
              defaultOpen
              badge={`${widget.columns.length}`}
            >
              <div className="flex flex-wrap gap-1.5">
                {fields.map((x) => {
                  const on = widget.columns.includes(x.key);
                  return (
                    <button
                      key={x.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const columns = on
                          ? widget.columns.filter((c) => c !== x.key)
                          : [...widget.columns, x.key];
                        if (columns.length) patch({ columns });
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${on ? 'border-blue-600 bg-blue-600 text-white' : t.btn} ${FOCUS}`}
                    >
                      {x.label}
                    </button>
                  );
                })}
              </div>
            </Section>
            <Section title="Sorting and rows" defaultOpen>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Sort by">
                  <Select
                    value={widget.sortBy ?? ''}
                    options={[
                      { value: '', label: 'None' },
                      ...fields.map((x) => ({ value: x.key, label: x.label })),
                    ]}
                    onChange={(v) => patch({ sortBy: v || undefined })}
                  />
                </Field>
                <Field label="Order">
                  <Select
                    value={widget.sortDir}
                    options={[
                      { value: 'desc', label: 'High → low' },
                      { value: 'asc', label: 'Low → high' },
                    ]}
                    onChange={(v) => patch({ sortDir: v })}
                  />
                </Field>
              </div>
              <Field label="Rows">
                <Select
                  value={String(widget.limit)}
                  options={[5, 8, 10, 15, 25, 50].map((n) => ({
                    value: String(n),
                    label: `${n} rows`,
                  }))}
                  onChange={(v) => patch({ limit: Number(v) })}
                />
              </Field>
            </Section>
            <Section title="Display">
              <SwitchRow
                label="Data bars on numbers"
                checked={widget.dataBars}
                onChange={(v) => patch({ dataBars: v })}
              />
              <SwitchRow
                label="Totals row"
                checked={widget.showTotals}
                onChange={(v) => patch({ showTotals: v })}
              />
              {noteField}
            </Section>
          </>
        )}

        {widget.kind === 'text' && (
          <Section title="Content" defaultOpen>
            <Segmented
              label="Style"
              value={widget.variant}
              options={[
                { value: 'heading', label: 'Heading' },
                { value: 'paragraph', label: 'Text' },
                { value: 'callout', label: 'Callout' },
              ]}
              onChange={(v) => patch({ variant: v })}
            />
            <Field
              label="Text"
              hint="Variables: {{records}} {{range}} {{source}} {{date}}"
            >
              <textarea
                value={widget.text}
                onChange={(e) =>
                  patch({ text: e.target.value }, `txt-${widget.id}`)
                }
                rows={5}
                className={`w-full resize-none rounded-lg border px-2.5 py-2 text-[13px] ${t.input} ${FOCUS}`}
              />
            </Field>
          </Section>
        )}

        {widget.kind === 'insight' && (
          <Section title="Data" defaultOpen>
            <Field label="Analyse by">
              <Select
                value={widget.groupBy}
                options={dims.map((x) => ({ value: x.key, label: x.label }))}
                onChange={(v) => patch({ groupBy: v })}
              />
            </Field>
            {measure(widget.agg, widget.field)}
            <Field label="Subject noun">
              <TextInput
                value={widget.subject}
                onChange={(e) =>
                  patch({ subject: e.target.value }, `subj-${widget.id}`)
                }
                placeholder="cases"
              />
            </Field>
            {noteField}
          </Section>
        )}

        {layout}
        {widget.kind !== 'text' && filters}
      </div>
      <div className={`flex shrink-0 gap-2 border-t p-2.5 ${t.lineStrong}`}>
        <GhostButton
          onClick={onDuplicate}
          icon={<Copy className="h-3.5 w-3.5" />}
        >
          Duplicate
        </GhostButton>
        <button
          type="button"
          onClick={onRemove}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50 ${FOCUS}`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      </div>
    </div>
  );
};

const ReportInspector: React.FC<{
  def: ReportDefinition;
  allFields: FieldDef[];
  allRows: Row[];
  onChange: (
    fn: (d: ReportDefinition) => ReportDefinition,
    key?: string
  ) => void;
  onAutoBuild: () => void;
}> = ({ def, allFields, allRows, onChange, onAutoBuild }) => {
  const t = useT();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={`border-b p-3 ${t.line}`}>
        <p className={`flex items-start gap-1.5 text-[11px] ${t.muted}`}>
          <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Select a
          widget on the canvas to configure it. These settings apply to the
          whole report.
        </p>
      </div>
      <Section title="Period" defaultOpen badge={RANGE_LABEL[def.dateRange]}>
        <Field label="Date range">
          <Select
            value={def.dateRange}
            options={(Object.keys(RANGE_LABEL) as DateRangeKey[]).map((k) => ({
              value: k,
              label: RANGE_LABEL[k],
            }))}
            onChange={(v) =>
              onChange((d) => ({ ...d, dateRange: v as DateRangeKey }))
            }
          />
        </Field>
        {def.dateRange === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="From">
              <TextInput
                type="date"
                value={def.customFrom ?? ''}
                onChange={(e) =>
                  onChange((d) => ({ ...d, customFrom: e.target.value }))
                }
              />
            </Field>
            <Field label="To">
              <TextInput
                type="date"
                value={def.customTo ?? ''}
                onChange={(e) =>
                  onChange((d) => ({ ...d, customTo: e.target.value }))
                }
              />
            </Field>
          </div>
        )}
        <SwitchRow
          label="Compare with previous period"
          checked={def.compare}
          onChange={(v) => onChange((d) => ({ ...d, compare: v }))}
        />
      </Section>
      <Section
        title="Report filters"
        defaultOpen
        badge={def.filters.length ? String(def.filters.length) : undefined}
      >
        <FilterEditor
          fields={allFields}
          rules={def.filters}
          allRows={allRows}
          onChange={(filters) => onChange((d) => ({ ...d, filters }))}
        />
      </Section>
      <Section
        title="Appearance"
        defaultOpen
        badge={PALETTES[def.palette].label}
      >
        <Field label="Chart palette">
          <div
            className="grid grid-cols-5 gap-1.5"
            role="radiogroup"
            aria-label="Chart palette"
          >
            {(Object.keys(PALETTES) as PaletteKey[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={def.palette === k}
                title={PALETTES[k].label}
                onClick={() => onChange((d) => ({ ...d, palette: k }))}
                className={`flex h-8 overflow-hidden rounded-lg border-2 ${def.palette === k ? 'border-blue-500' : 'border-transparent'} ${FOCUS}`}
              >
                {PALETTES[k].colors.slice(0, 4).map((c) => (
                  <span key={c} className="flex-1" style={{ background: c }} />
                ))}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Classification label">
          <Select
            value={def.classification}
            options={(Object.keys(CLASSIFICATION) as Classification[]).map(
              (k) => ({ value: k, label: CLASSIFICATION[k].label })
            )}
            onChange={(v) =>
              onChange((d) => ({ ...d, classification: v as Classification }))
            }
          />
        </Field>
      </Section>
      <Section title="Layout">
        <p className={`text-[11px] ${t.muted}`}>
          Rebuild the canvas with a recommended executive layout. You can undo
          this.
        </p>
        <GhostButton
          onClick={onAutoBuild}
          icon={<Sparkles className="h-3.5 w-3.5 text-blue-600" />}
        >
          Auto-build layout
        </GhostButton>
      </Section>
    </div>
  );
};

/* ==========================================================================
 * Expand modal, templates drawer
 * ======================================================================== */
const WidgetModal: React.FC<{
  widget: Widget | null;
  data: DataCtx;
  onClose: () => void;
}> = ({ widget, data, onClose }) => {
  const t = useT();
  const [tab, setTab] = useState<'data' | 'records'>('data');
  useEffect(() => {
    setTab('data');
  }, [widget?.id]);
  useEffect(() => {
    if (!widget) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [widget, onClose]);
  const records = useMemo(
    () =>
      widget ? applyFilters(data.rows, widget.filters, data.fieldMap) : [],
    [widget, data.rows, data.fieldMap]
  );
  if (!widget) return null;
  const tbl = widgetTable(widget, data);
  const bigData = { ...data, onExpand: undefined, onPick: undefined };
  const big =
    widget.kind === 'chart'
      ? { ...widget, height: 'lg' as Height, span: 12 as Span }
      : widget;
  const showRecords = widget.kind !== 'text';
  const exportRecords = () =>
    downloadCsv(
      `${slug(widget.title)}-records.csv`,
      data.fields.map((x) => x.label),
      records.map((r) =>
        data.fields.map((x) => exportCell(x, r[x.key], data.canViewSensitive))
      )
    );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={widget.title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border ${t.dark ? 'bg-slate-900' : 'bg-white'} ${t.lineStrong}`}
      >
        <div
          className={`flex items-center justify-between border-b px-4 py-3 ${t.lineStrong}`}
        >
          <h2 className={`truncate text-sm font-semibold ${t.text}`}>
            {widget.title}
          </h2>
          <div className="flex gap-2">
            {tab === 'data' && tbl.headers.length > 0 && (
              <GhostButton
                onClick={() =>
                  downloadCsv(
                    `${slug(widget.title)}.csv`,
                    tbl.headers,
                    tbl.rows
                  )
                }
                icon={<Download className="h-3.5 w-3.5" />}
              >
                Download data
              </GhostButton>
            )}
            {tab === 'records' && (
              <GhostButton
                onClick={exportRecords}
                icon={<Download className="h-3.5 w-3.5" />}
              >
                Download records
              </GhostButton>
            )}
            <IconButton label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <WidgetView widget={big} data={bigData} />
          {showRecords && (
            <div className="w-72">
              <Segmented
                label="Detail view"
                value={tab}
                options={[
                  { value: 'data', label: 'Chart data' },
                  {
                    value: 'records',
                    label: `Records (${records.length.toLocaleString()})`,
                  },
                ]}
                onChange={setTab}
              />
            </div>
          )}
          {tab === 'data' && tbl.headers.length > 0 && (
            <div
              className={`overflow-x-auto rounded-xl border ${t.lineStrong}`}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`${t.inset} ${t.muted}`}>
                    {tbl.headers.map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-3 py-2 font-medium"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tbl.rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className={`border-t ${t.line} ${t.body}`}>
                      {r.map((c, j) => (
                        <td key={j} className="px-3 py-1.5">
                          {typeof c === 'number' ? c.toLocaleString() : c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'records' && showRecords && (
            <div className="h-80 min-h-0">
              <DataPreview
                rows={records}
                fields={data.fields}
                currency={data.currency}
                limit={8}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TemplatesDrawer: React.FC<{
  open: boolean;
  templates: ReportTemplate[];
  sources: ReportSource[];
  onClose: () => void;
  onOpen: (t: ReportTemplate, run: boolean) => void;
  onDuplicate: (t: ReportTemplate) => void;
  onDelete: (t: ReportTemplate) => void;
  onImport: (file: File) => void;
}> = ({
  open,
  templates,
  sources,
  onClose,
  onOpen,
  onDuplicate,
  onDelete,
  onImport,
}) => {
  const t = useT();
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const list = templates.filter((x) =>
    `${x.name} ${x.description}`.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report templates"
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full max-w-md flex-col border-l ${t.dark ? 'bg-slate-900' : 'bg-white'} ${t.lineStrong}`}
      >
        <div
          className={`flex items-center justify-between border-b px-4 py-3 ${t.lineStrong}`}
        >
          <div>
            <h2 className={`text-sm font-semibold ${t.text}`}>
              Templates and drafts
            </h2>
            <p className={`text-[11px] ${t.muted}`}>
              Edit one, or run it straight away.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />
            <GhostButton
              onClick={() => fileRef.current?.click()}
              icon={<Upload className="h-3.5 w-3.5" />}
            >
              Import
            </GhostButton>
            <IconButton label="Close templates" onClick={onClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
        <div className="p-3">
          <div className="relative">
            <Search
              className={`pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${t.muted}`}
            />
            <TextInput
              aria-label="Search templates"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search templates…"
              className="pl-8"
            />
          </div>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {list.length === 0 && (
            <li className={`py-12 text-center text-[13px] ${t.muted}`}>
              No templates match your search.
            </li>
          )}
          {list.map((tp) => {
            const src = sources.find((s) => s.id === tp.definition.sourceId);
            const Icon = src?.icon ?? Database;
            return (
              <li key={tp.id} className={`rounded-xl border p-3 ${t.card}`}>
                <div className="flex items-start gap-2.5">
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.chipIcon}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`truncate text-[13px] font-semibold ${t.text}`}
                      >
                        {tp.name}
                      </span>
                      {tp.builtIn && <Badge value="Built-in" tone="blue" />}
                      {tp.isDraft && <Badge value="Draft" />}
                    </div>
                    <p className={`mt-0.5 line-clamp-2 text-[11px] ${t.muted}`}>
                      {tp.description || 'No description'}
                    </p>
                    <p className={`mt-0.5 text-[10px] ${t.muted}`}>
                      {src?.name ?? 'Unknown source'} ·{' '}
                      {tp.definition.widgets.length} widgets · updated{' '}
                      {new Date(tp.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <GhostButton
                    onClick={() => onOpen(tp, false)}
                    icon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit
                  </GhostButton>
                  <button
                    type="button"
                    onClick={() => onOpen(tp, true)}
                    className={PRIMARY_BTN}
                  >
                    <Play className="h-3.5 w-3.5" /> Run
                  </button>
                  <GhostButton
                    onClick={() => onDuplicate(tp)}
                    icon={<Copy className="h-3.5 w-3.5" />}
                  >
                    Duplicate
                  </GhostButton>
                  <GhostButton
                    onClick={() => downloadJson(`${slug(tp.name)}.json`, tp)}
                    icon={<Download className="h-3.5 w-3.5" />}
                    title="Export as JSON to share"
                  >
                    Export
                  </GhostButton>
                  {!tp.builtIn && (
                    <button
                      type="button"
                      onClick={() => onDelete(tp)}
                      className={`ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-red-600 hover:bg-red-50 ${FOCUS}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/* ==========================================================================
 * Main page
 * ======================================================================== */
interface History {
  past: ReportDefinition[];
  present: ReportDefinition;
  future: ReportDefinition[];
}

const STEPS = [
  { full: 'Data source & fields', short: 'Data' },
  { full: 'Design & configure', short: 'Design' },
  { full: 'Review & generate', short: 'Generate' },
];

const ReportBuilder: React.FC<ReportBuilderProps> = ({
  sources = SOURCES,
  templateStore = localTemplateStore,
  onGenerate,
  onBack,
  currentUser = 'Current user',
  currency = 'AED',
  theme = 'light',
  height = 'calc(100vh - 6rem)',
  canViewSensitive,
}) => {
  const t = theme === 'dark' ? DARK : LIGHT;

  const [hist, setHist] = useState<History>(() => ({
    past: [],
    present: blankDefinition(sources[0]),
    future: [],
  }));
  const def = hist.present;
  const lastEdit = useRef<{ key: string; at: number } | null>(null);

  const [step, setStep] = useState(1);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(true);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [railTab, setRailTab] = useState<'widgets' | 'fields'>('widgets');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'data' | 'summary'>('data');
  const [crossFilter, setCrossFilter] = useState<{
    field: string;
    value: string;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [rowsState, setRowsState] = useState<{ id: string; rows: Row[]; truncated: boolean }>({
    id: '',
    rows: [],
    truncated: false,
  });
  const rawRows = useMemo(
    () =>
      rowsState.id ===
      (sources.find((x) => x.id === def.sourceId) ?? sources[0]).id
        ? rowsState.rows
        : [],
    [rowsState, sources, def.sourceId]
  );
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const rowCache = useRef(new Map<string, { rows: Row[]; truncated: boolean }>());

  const [userTemplates, setUserTemplates] = useState<ReportTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [visibility, setVisibility] = useState<TemplateVisibility>('private');

  const [output, setOutput] = useState<OutputOptions>({
    format: 'pdf',
    orientation: 'landscape',
    paper: 'A4',
  });
  const [generating, setGenerating] = useState(false);
  const [lastRun, setLastRun] = useState<{
    at: Date;
    rows: number;
    format: OutputFormat;
  } | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    tone: 'info' | 'success' | 'error';
  } | null>(null);

  const source = sources.find((s) => s.id === def.sourceId) ?? sources[0];
  const rowsTruncated = rowsState.id === source.id && rowsState.truncated;
  const baseFields = useMemo(
    () => enrichFields(source.fields, rawRows),
    [source, rawRows]
  );
  const derivedOut = useMemo(
    () => applyDerived(rawRows, def.derived ?? [], baseFields),
    [rawRows, def.derived, baseFields]
  );
  const allRows = derivedOut.rows;
  /** Full field catalogue: source fields (enriched) plus the report's custom fields. */
  const catalogue = derivedOut.fields;
  const fieldMap = useMemo(
    () => new Map(catalogue.map((x) => [x.key, x])),
    [catalogue]
  );
  const selectedFields = useMemo(
    () =>
      def.fields.map((k) => fieldMap.get(k)).filter((x): x is FieldDef => !!x),
    [def.fields, fieldMap]
  );
  const selectedWidget =
    def.widgets.find((w) => w.id === selectedWidgetId) ?? null;
  const interactive = step === 3 || (step === 2 && !editMode);

  const notify = useCallback(
    (msg: string, tone: 'info' | 'success' | 'error' = 'info') =>
      setToast({ msg, tone }),
    []
  );
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(id);
  }, [toast]);

  /* ---- definition updates with undo/redo ---- */
  const update = useCallback(
    (fn: (d: ReportDefinition) => ReportDefinition, key?: string) => {
      const now = Date.now();
      const coalesce =
        !!key &&
        lastEdit.current?.key === key &&
        now - lastEdit.current.at < 1000;
      lastEdit.current = key ? { key, at: now } : null;
      setHist((h) => {
        const next = fn(h.present);
        if (next === h.present) return h;
        return coalesce
          ? { ...h, present: next }
          : {
              past: [...h.past.slice(-49), h.present],
              present: next,
              future: [],
            };
      });
    },
    []
  );
  const undo = useCallback(() => {
    lastEdit.current = null;
    setHist((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h
    );
  }, []);
  const redo = useCallback(() => {
    lastEdit.current = null;
    setHist((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h
    );
  }, []);
  const resetHistory = (d: ReportDefinition) => {
    lastEdit.current = null;
    setHist({ past: [], present: d, future: [] });
  };
  const dirty = hist.past.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  /* ---- data loading ---- */
  useEffect(() => {
    let cancelled = false;
    const cached = rowCache.current.get(source.id);
    if (cached) {
      setRowsState({ id: source.id, ...cached });
      setRowsError(null);
      return;
    }
    setRowsLoading(true);
    setRowsError(null);
    Promise.resolve(source.loadRows())
      .then((result) => {
        if (cancelled) return;
        const loaded = Array.isArray(result) ? { rows: result, truncated: false } : result;
        const clean = normalizeRows(loaded.rows, source.fields);
        const cachedRows = { rows: clean, truncated: loaded.truncated };
        rowCache.current.set(source.id, cachedRows);
        setRowsState({ id: source.id, ...cachedRows });
      })
      .catch(
        () =>
          !cancelled && setRowsError(`Could not load data for ${source.name}.`)
      )
      .finally(() => !cancelled && setRowsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    templateStore
      .list()
      .then(setUserTemplates)
      .catch(() => notify('Could not load saved templates.', 'error'));
  }, [templateStore, notify]);

  /* ---- derived data ---- */
  const win = useMemo(
    () => windowFor(def.dateRange, def.customFrom, def.customTo),
    [def.dateRange, def.customFrom, def.customTo]
  );
  const autoBucket = autoBucketFor(win);
  const baseRows = useMemo(
    () => applyFilters(allRows, def.filters, fieldMap),
    [allRows, def.filters, fieldMap]
  );
  const rows = useMemo(
    () => baseRows.filter((r) => inWindow(r, source.dateField, win)),
    [baseRows, source.dateField, win]
  );
  const prevRows = useMemo(
    () =>
      win
        ? baseRows.filter((r) => inWindow(r, source.dateField, prevWindow(win)))
        : null,
    [baseRows, source.dateField, win]
  );

  useEffect(() => {
    if (!interactive) setCrossFilter(null);
  }, [interactive]);
  const xf = interactive ? crossFilter : null;
  const viewRows = useMemo(
    () =>
      xf
        ? rows.filter((r) => cellKey(fieldMap.get(xf.field), r) === xf.value)
        : rows,
    [rows, xf, fieldMap]
  );
  const viewPrev = useMemo(
    () =>
      xf && prevRows
        ? prevRows.filter(
            (r) => cellKey(fieldMap.get(xf.field), r) === xf.value
          )
        : prevRows,
    [prevRows, xf, fieldMap]
  );

  const colors = PALETTES[def.palette].colors;
  const rangeText =
    def.dateRange === 'custom' && def.customFrom && def.customTo
      ? `${fmtDate(def.customFrom)} to ${fmtDate(def.customTo)}`
      : RANGE_LABEL[def.dateRange].toLowerCase();
  const vars = useMemo(
    () => ({
      records: viewRows.length.toLocaleString(),
      range: rangeText,
      source: source.name,
      date: new Date().toLocaleDateString(),
    }),
    [viewRows.length, rangeText, source.name]
  );

  const pickHandler = useCallback((field: string, value: string) => {
    setCrossFilter((cur) =>
      cur && cur.field === field && cur.value === value
        ? null
        : { field, value }
    );
  }, []);

  const dataCtx: DataCtx = useMemo(
    () => ({
      rows: viewRows,
      prevRows: viewPrev,
      source,
      fieldMap,
      fields: selectedFields,
      currency,
      colors,
      autoBucket,
      compare: def.compare,
      canViewSensitive,
      onPick: interactive ? pickHandler : undefined,
      onExpand: setExpandedId,
      vars,
    }),
    [
      viewRows,
      viewPrev,
      source,
      fieldMap,
      selectedFields,
      currency,
      colors,
      autoBucket,
      def.compare,
      canViewSensitive,
      interactive,
      pickHandler,
      vars,
    ]
  );

  /* ---- field actions ---- */
  const setFields = (keys: string[]) =>
    update((d) =>
      reconcile(
        {
          ...d,
          fields: catalogue.map((x) => x.key).filter((k) => keys.includes(k)),
        },
        catalogue
      )
    );
  const toggleField = (key: string) =>
    update((d) =>
      reconcile(
        {
          ...d,
          fields: d.fields.includes(key)
            ? d.fields.filter((k) => k !== key)
            : [...d.fields, key],
        },
        catalogue
      )
    );
  const moveField = (key: string, dir: -1 | 1) =>
    update((d) => {
      const i = d.fields.indexOf(key),
        j = i + dir;
      if (i < 0 || j < 0 || j >= d.fields.length) return d;
      const next = [...d.fields];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, fields: next };
    });

  const changeSource = (id: string) => {
    if (id === def.sourceId) return;
    if (
      dirty &&
      !window.confirm(
        'Changing the data source resets the selected fields, widgets and filters. Continue?'
      )
    )
      return;
    const s = sources.find((x) => x.id === id)!;
    update((d) => ({
      ...d,
      sourceId: id,
      fields: [...s.defaultFields],
      widgets: autoWidgets(s, s.defaultFields, s.fields),
      filters: [],
      derived: [],
    }));
    setSelectedWidgetId(null);
  };

  /* ---- widget actions ---- */
  const patchWidget = (id: string, p: Partial<Widget>, key?: string) =>
    update(
      (d) => ({
        ...d,
        widgets: d.widgets.map((w) =>
          w.id === id ? ({ ...w, ...p } as Widget) : w
        ),
      }),
      key
    );
  const addWidget = (w: Widget) => {
    update((d) => ({ ...d, widgets: [...d.widgets, w] }));
    setSelectedWidgetId(w.id);
  };

  const addOfType = (id: string) => {
    const cats = selectedFields
      .filter((x) => isCat(x.type))
      .sort((a, b) => Number(!!b.order) - Number(!!a.order));
    const dates = selectedFields.filter((x) => isDateType(x.type));
    const bools = selectedFields.filter((x) => x.type === 'boolean');
    const nums = selectedFields.filter((x) => isNumeric(x.type));
    const money = selectedFields.find((x) => x.type === 'currency');
    setEditMode(true);
    if (id === 'kpi') {
      if (money)
        return addWidget(
          mkKpi(money.label, { agg: 'sum', field: money.key, tone: 'amber' })
        );
      if (bools[0])
        return addWidget(
          mkKpi(`${bools[0].label} rate`, {
            agg: 'rate',
            field: bools[0].key,
            tone: 'violet',
          })
        );
      return addWidget(mkKpi(`Total ${source.recordLabel}`));
    }
    if (id === 'text')
      return addWidget(
        mkText(
          'Add your commentary here. Use {{records}} and {{range}} to insert live values.',
          'callout'
        )
      );
    if (id === 'table')
      return addWidget(
        mkTable(
          'New table',
          selectedFields.slice(0, 5).map((x) => x.key),
          { sortBy: money?.key, dataBars: !!money }
        )
      );
    if (id === 'insight') {
      const by = cats[0] ?? dates[0];
      if (!by) return notify('Select a category or date field first.', 'error');
      return addWidget(
        mkInsight('Key insights', by.key, { subject: source.recordLabel })
      );
    }
    if (id === 'scatter') {
      if (nums.length < 2)
        return notify('Scatter plots need two numeric fields.', 'error');
      return addWidget(
        mkChart('Relationship', 'scatter', cats[0]?.key ?? nums[0].key, {
          xField: nums[0].key,
          field: nums[1].key,
          agg: 'avg',
          breakBy: cats[0]?.key,
        })
      );
    }
    const timeBased = ['line', 'area', 'stacked'].includes(id);
    const dim = timeBased ? (dates[0] ?? cats[0]) : (cats[0] ?? dates[0]);
    if (!dim)
      return notify(
        'Select a category or date field first to build a chart.',
        'error'
      );
    const o: Partial<ChartWidget> = {};
    if (id === 'stacked' || id === 'heatmap')
      o.breakBy = cats.find((c) => c.key !== dim.key)?.key;
    addWidget(mkChart('New chart', id as ChartType, dim.key, o));
  };

  const quickAddFromField = (fld: FieldDef) => {
    setEditMode(true);
    if (fld.type === 'boolean')
      return addWidget(
        mkKpi(`${fld.label} rate`, {
          agg: 'rate',
          field: fld.key,
          tone: 'violet',
        })
      );
    if (fld.type === 'category')
      return addWidget(
        mkChart(`By ${fld.label.toLowerCase()}`, 'doughnut', fld.key)
      );
    if (isDateType(fld.type))
      return addWidget(
        mkChart(`${cap(source.recordLabel)} over time`, 'area', fld.key)
      );
    if (isNumeric(fld.type))
      return addWidget(
        mkKpi(fld.label, { agg: 'sum', field: fld.key, tone: 'amber' })
      );
    addWidget(
      mkTable(`${fld.label} list`, [
        fld.key,
        ...selectedFields
          .filter((x) => x.key !== fld.key)
          .slice(0, 4)
          .map((x) => x.key),
      ])
    );
  };

  const removeWidget = (id: string) => {
    update((d) => ({ ...d, widgets: d.widgets.filter((w) => w.id !== id) }));
    setSelectedWidgetId((cur) => (cur === id ? null : cur));
  };
  const duplicateWidget = (id: string) => {
    const w = def.widgets.find((x) => x.id === id);
    if (!w) return;
    const copy = {
      ...JSON.parse(JSON.stringify(w)),
      id: uid(),
      title: `${w.title} (copy)`,
    } as Widget;
    update((d) => {
      const i = d.widgets.findIndex((x) => x.id === id);
      const next = [...d.widgets];
      next.splice(i + 1, 0, copy);
      return { ...d, widgets: next };
    });
    setSelectedWidgetId(copy.id);
  };
  const moveWidget = (id: string, dir: -1 | 1) =>
    update((d) => {
      const i = d.widgets.findIndex((x) => x.id === id),
        j = i + dir;
      if (i < 0 || j < 0 || j >= d.widgets.length) return d;
      const next = [...d.widgets];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, widgets: next };
    });
  const reorderWidget = (fromId: string, toId: string) =>
    update((d) => {
      const from = d.widgets.findIndex((x) => x.id === fromId),
        to = d.widgets.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return d;
      const next = [...d.widgets];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...d, widgets: next };
    });
  const autoBuild = () => {
    update((d) => ({
      ...d,
      widgets: autoWidgets(source, d.fields, catalogue),
    }));
    setSelectedWidgetId(null);
    notify('Layout rebuilt. Press Ctrl+Z to undo.', 'success');
  };

  /* ---- custom fields (categorisation) ---- */
  const [customOpen, setCustomOpen] = useState(false);
  const [customEdit, setCustomEdit] = useState<string | null>(null);
  const openCustom = (key?: string) => {
    setCustomEdit(key ?? null);
    setCustomOpen(true);
  };
  const saveDerived = (d: DerivedField) => {
    let savedKey = d.key;
    update((cur) => {
      const taken = new Set([
        ...source.fields.map((x) => x.key),
        ...(cur.derived ?? []).map((x) => x.key),
      ]);
      const saved = (
        d.key ? d : { ...d, key: uniqueKey(d.label, taken) }
      ) as DerivedField;
      savedKey = saved.key;
      const list = cur.derived ?? [];
      const derived = list.some((x) => x.id === saved.id)
        ? list.map((x) => (x.id === saved.id ? saved : x))
        : [...list, saved];
      return {
        ...cur,
        derived,
        fields: cur.fields.includes(saved.key)
          ? cur.fields
          : [...cur.fields, saved.key],
      };
    });
    setCustomOpen(false);
    notify(
      `Custom field “${d.label}” saved and added to the report.`,
      'success'
    );
    return savedKey;
  };
  const removeDerived = (id: string) =>
    update((cur) => {
      const gone = (cur.derived ?? []).find((x) => x.id === id);
      if (!gone) return cur;
      const derived = (cur.derived ?? []).filter((x) => x.id !== id);
      const catalogueAfter = applyDerived([], derived, baseFields).fields;
      return reconcile(
        {
          ...cur,
          derived,
          fields: cur.fields.filter((k) => k !== gone.key),
          filters: cur.filters.filter((r) => r.field !== gone.key),
        },
        catalogueAfter
      );
    });

  /* ---- autosave + restore of an unsaved session ---- */
  const [restore, setRestore] = useState<{
    def: ReportDefinition;
    at: string;
  } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_AUTOSAVE);
      const p = raw ? JSON.parse(raw) : null;
      if (p?.def?.widgets && sources.some((x) => x.id === p.def.sourceId))
        setRestore(p);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(
          LS_AUTOSAVE,
          JSON.stringify({ def, at: new Date().toISOString() })
        );
      } catch {
        /* quota */
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [def, dirty]);
  const clearAutosave = () => {
    try {
      localStorage.removeItem(LS_AUTOSAVE);
    } catch {
      /* ignore */
    }
    setRestore(null);
  };

  /* ---- keyboard shortcuts ---- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (step === 2 && editMode && selectedWidgetId) {
        if (mod && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          duplicateWidget(selectedWidgetId);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeWidget(selectedWidgetId);
        } else if (e.key === 'Escape') setSelectedWidgetId(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  /* ---- navigation ---- */
  const validate = (target: number): string | null => {
    if (target >= 2) {
      if (!def.name.trim()) return 'Give your report a name before continuing.';
      if (def.fields.length === 0)
        return 'Select at least one field to continue.';
    }
    if (target >= 3 && def.widgets.length === 0)
      return 'Add at least one widget to the report.';
    return null;
  };
  const goStep = (n: number) => {
    if (n > step) {
      const err = validate(n);
      if (err) return notify(err, 'error');
    }
    setStep(n);
    if (n !== 2) setSelectedWidgetId(null);
  };

  /* ---- templates ---- */
  const saveTemplate = async (draft: boolean) => {
    if (!def.name.trim())
      return notify('Give your report a name before saving.', 'error');
    const now = new Date().toISOString();
    const existing = userTemplates.find((x) => x.id === templateId);
    const tpl: ReportTemplate = {
      id: existing?.id ?? uid(),
      name: def.name.trim(),
      description: def.description,
      definition: JSON.parse(JSON.stringify(def)),
      isDraft: draft,
      visibility,
      createdBy: existing?.createdBy ?? currentUser,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await templateStore.save(tpl);
      setUserTemplates((p) => [tpl, ...p.filter((x) => x.id !== tpl.id)]);
      setTemplateId(tpl.id);
      resetHistory(def);
      clearAutosave();
      notify(
        draft ? 'Draft saved.' : 'Template saved. Find it under Templates.',
        'success'
      );
    } catch {
      notify('Could not save. Check your connection and try again.', 'error');
    }
  };
  const openTemplate = (tp: ReportTemplate, run: boolean) => {
    if (
      dirty &&
      !window.confirm(
        'Opening a template replaces your current unsaved report. Continue?'
      )
    )
      return;
    resetHistory(cloneDefinition(tp.definition));
    setTemplateId(tp.builtIn ? null : tp.id);
    setSelectedWidgetId(null);
    setTemplatesOpen(false);
    setLastRun(null);
    setEditMode(true);
    setStep(run ? 3 : 2);
  };
  const duplicateTemplate = async (tp: ReportTemplate) => {
    const now = new Date().toISOString();
    const copy: ReportTemplate = {
      ...tp,
      id: uid(),
      name: `${tp.name} (copy)`,
      builtIn: false,
      isDraft: false,
      createdBy: currentUser,
      createdAt: now,
      updatedAt: now,
      definition: {
        ...cloneDefinition(tp.definition),
        name: `${tp.name} (copy)`,
      },
    };
    try {
      await templateStore.save(copy);
      setUserTemplates((p) => [copy, ...p]);
      notify('Template duplicated.', 'success');
    } catch {
      notify('Could not duplicate the template.', 'error');
    }
  };
  const deleteTemplate = async (tp: ReportTemplate) => {
    if (!window.confirm(`Delete "${tp.name}"? This cannot be undone.`)) return;
    try {
      await templateStore.remove(tp.id);
      setUserTemplates((p) => p.filter((x) => x.id !== tp.id));
      if (templateId === tp.id) setTemplateId(null);
      notify('Template deleted.', 'success');
    } catch {
      notify('Could not delete the template.', 'error');
    }
  };
  const importTemplate = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const defn = raw.definition ?? raw;
      if (
        !defn ||
        !Array.isArray(defn.widgets) ||
        !sources.some((s) => s.id === defn.sourceId)
      )
        throw new Error('invalid');
      const now = new Date().toISOString();
      const d = cloneDefinition(defn as ReportDefinition);
      const tpl: ReportTemplate = {
        id: uid(),
        name: raw.name ?? d.name ?? 'Imported report',
        description: raw.description ?? d.description ?? '',
        definition: d,
        isDraft: false,
        visibility: 'private',
        createdBy: currentUser,
        createdAt: now,
        updatedAt: now,
      };
      await templateStore.save(tpl);
      setUserTemplates((p) => [tpl, ...p]);
      notify('Template imported.', 'success');
    } catch {
      notify(
        'That file is not a valid report template for the available data sources.',
        'error'
      );
    }
  };
  const newReport = () => {
    if (
      dirty &&
      !window.confirm('Start a new report? Unsaved changes will be lost.')
    )
      return;
    resetHistory(blankDefinition(sources[0]));
    clearAutosave();
    setTemplateId(null);
    setSelectedWidgetId(null);
    setLastRun(null);
    setEditMode(true);
    setStep(1);
  };

  /* ---- generation ---- */
  const generate = async () => {
    const err = validate(3);
    if (err) return notify(err, 'error');
    setGenerating(true);
    try {
      if (onGenerate) {
        const hidden = canViewSensitive
          ? []
          : selectedFields.filter((x) => x.sensitive).map((x) => x.key);
        const safeRows = hidden.length
          ? viewRows.map((r) => {
              const c: Row = { ...r };
              hidden.forEach((k) => {
                c[k] = MASK;
              });
              return c;
            })
          : viewRows;
        await onGenerate({
          definition: def,
          templateId: templateId ?? undefined,
          rows: safeRows,
          columns: selectedFields,
          format: output.format,
          options: output,
          schedule: def.schedule,
        });
      } else if (output.format === 'csv') {
        downloadCsv(
          `${slug(def.name)}-${iso(new Date())}.csv`,
          selectedFields.map((x) => x.label),
          viewRows.map((r) =>
            selectedFields.map((x) => exportCell(x, r[x.key], canViewSensitive))
          )
        );
      } else {
        await new Promise((r) => setTimeout(r, 150));
        window.print();
      }
      setLastRun({
        at: new Date(),
        rows: viewRows.length,
        format: output.format,
      });
      notify('Report generated.', 'success');
    } catch {
      notify('Report generation failed. Try again.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  /* ==========================================================================
   * Shared pieces
   * ======================================================================== */
  const crossChip = xf && (
    <button
      type="button"
      onClick={() => setCrossFilter(null)}
      title="Clear drill-down filter"
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 ${FOCUS}`}
    >
      <Filter className="h-3.5 w-3.5" /> {fieldMap.get(xf.field)?.label}:{' '}
      {xf.value} <X className="h-3.5 w-3.5" />
    </button>
  );

  const filtersPopover = (
    <Popover
      width={320}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px] font-medium ${t.btn} ${FOCUS}`}
        >
          <Filter className="h-3.5 w-3.5" /> Filters
          {def.filters.length > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 text-[10px] text-white">
              {def.filters.length}
            </span>
          )}
        </button>
      )}
    >
      {() => (
        <FilterEditor
          fields={catalogue}
          rules={def.filters}
          allRows={allRows}
          onChange={(filters) => update((d) => ({ ...d, filters }))}
        />
      )}
    </Popover>
  );

  const rangeSelect = (
    <div className="w-36">
      <Select
        label="Date range"
        value={def.dateRange}
        options={(Object.keys(RANGE_LABEL) as DateRangeKey[]).map((k) => ({
          value: k,
          label: RANGE_LABEL[k],
        }))}
        onChange={(v) =>
          update((d) => ({ ...d, dateRange: v as DateRangeKey }))
        }
      />
    </div>
  );

  const statusLabel = dirty ? 'Unsaved' : templateId ? 'Saved' : 'New';

  /* ==========================================================================
   * Step 1: data
   * ======================================================================== */
  const SrcIcon = source.icon;
  const quickTemplates = [...BUILTIN_TEMPLATES, ...userTemplates].slice(0, 6);

  const renderStep1 = () => (
    <div className="grid min-h-0 gap-2 xl:h-full xl:grid-cols-[280px_minmax(0,1fr)_300px]">
      <Panel>
        <div className={`shrink-0 border-b p-3 ${t.lineStrong}`}>
          <span className={`mb-1 block text-[11px] font-semibold ${t.muted}`}>
            Data source
          </span>
          <Popover
            width={320}
            trigger={({ toggle, ref }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left ${t.btn} ${FOCUS}`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.chipIcon}`}
                >
                  <SrcIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[13px] font-semibold ${t.text}`}
                  >
                    {source.name}
                  </span>
                  <span className={`block truncate text-[11px] ${t.muted}`}>
                    {rawRows.length.toLocaleString()} records ·{' '}
                    {catalogue.length} fields
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 ${t.muted}`} />
              </button>
            )}
          >
            {(close) => (
              <div
                role="radiogroup"
                aria-label="Data source"
                className="space-y-0.5"
              >
                {sources.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={s.id === def.sourceId}
                    onClick={() => {
                      changeSource(s.id);
                      close();
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-lg p-2 text-left ${s.id === def.sourceId ? t.selected : t.hover} ${FOCUS}`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.chipIcon}`}
                    >
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold">
                        {s.name}
                      </span>
                      <span className={`block text-[11px] ${t.muted}`}>
                        {s.description}
                      </span>
                    </span>
                    {s.id === def.sourceId && (
                      <Check className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </Popover>
        </div>
        <FieldsPanel
          fields={catalogue}
          resetKey={source.id}
          rows={allRows}
          selected={def.fields}
          mode="select"
          onToggle={toggleField}
          onSetAll={setFields}
          onAdd={quickAddFromField}
          onCustom={openCustom}
        />
      </Panel>

      <div className="flex min-h-0 flex-col gap-2">
        <div
          className={`flex shrink-0 items-center gap-2 overflow-x-auto rounded-xl border px-3 py-2 ${t.card}`}
        >
          <span
            className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${t.muted}`}
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Start from
          </span>
          {quickTemplates.map((tp) => {
            const I =
              sources.find((s) => s.id === tp.definition.sourceId)?.icon ??
              Database;
            return (
              <button
                key={tp.id}
                type="button"
                onClick={() => openTemplate(tp, false)}
                title={tp.description}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium ${t.btn} ${FOCUS}`}
              >
                <I className="h-3.5 w-3.5 text-blue-600" />
                {tp.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setTemplatesOpen(true)}
            className={`shrink-0 text-xs font-medium text-blue-600 hover:underline ${FOCUS}`}
          >
            All templates
          </button>
        </div>
        <Panel className="flex-1">
          <PanelHead
            title={
              <>
                <Table2 className="h-4 w-4" /> Data preview
              </>
            }
            hint={`${selectedFields.length} fields · ${rows.length.toLocaleString()} records in period`}
            action={rangeSelect}
          />
          <div className="flex min-h-0 flex-1 flex-col p-3">
            {rowsLoading ? (
              <div className="space-y-2" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-7 animate-pulse rounded-md ${t.skeleton}`}
                  />
                ))}
              </div>
            ) : rowsError ? (
              <p className="py-8 text-center text-[13px] text-red-600">
                {rowsError}
              </p>
            ) : (
              <DataPreview
                rows={rows}
                fields={selectedFields}
                currency={currency}
                limit={14}
              />
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Report details" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={`space-y-3 border-b p-3 ${t.line}`}>
            <Field label="Report name">
              <TextInput
                value={def.name}
                onChange={(e) =>
                  update((d) => ({ ...d, name: e.target.value }), 'name')
                }
                placeholder="e.g. Weekly fraud exposure"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={def.description}
                onChange={(e) =>
                  update((d) => ({ ...d, description: e.target.value }), 'desc')
                }
                rows={2}
                placeholder="What is this report for?"
                className={`w-full resize-none rounded-lg border px-2.5 py-2 text-[13px] ${t.input} ${FOCUS}`}
              />
            </Field>
            <Field label="Classification">
              <Select
                value={def.classification}
                options={(Object.keys(CLASSIFICATION) as Classification[]).map(
                  (k) => ({ value: k, label: CLASSIFICATION[k].label })
                )}
                onChange={(v) =>
                  update((d) => ({ ...d, classification: v as Classification }))
                }
              />
            </Field>
          </div>
          <div className="p-3">
            <div className={`mb-2 text-xs font-semibold ${t.text}`}>
              Selected fields ({selectedFields.length}){' '}
              <span className={`font-normal ${t.muted}`}>· column order</span>
            </div>
            <ul className="space-y-1">
              {selectedFields.length === 0 && (
                <li className={`py-6 text-center text-xs ${t.muted}`}>
                  No fields selected yet.
                </li>
              )}
              {selectedFields.map((x, i) => (
                <li
                  key={x.key}
                  className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[13px] ${t.lineStrong} ${t.body}`}
                >
                  <span className="flex-1 truncate">{x.label}</span>
                  <button
                    type="button"
                    aria-label={`Move ${x.label} up`}
                    disabled={i === 0}
                    onClick={() => moveField(x.key, -1)}
                    className={`rounded p-0.5 disabled:opacity-30 ${t.hover} ${FOCUS}`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${x.label} down`}
                    disabled={i === selectedFields.length - 1}
                    onClick={() => moveField(x.key, 1)}
                    className={`rounded p-0.5 disabled:opacity-30 ${t.hover} ${FOCUS}`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${x.label}`}
                    onClick={() => toggleField(x.key)}
                    className={`rounded p-0.5 text-red-600 ${t.hover} ${FOCUS}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );

  /* ==========================================================================
   * Step 2: design
   * ======================================================================== */
  const renderStep2 = () => (
    <div className="grid min-h-0 gap-2 xl:h-full xl:grid-cols-[250px_minmax(0,1fr)_300px]">
      <Panel>
        <div className={`shrink-0 border-b p-2 ${t.lineStrong}`}>
          <Segmented
            label="Left panel"
            value={railTab}
            options={[
              { value: 'widgets', label: 'Widgets' },
              { value: 'fields', label: 'Fields' },
            ]}
            onChange={setRailTab}
          />
        </div>
        {railTab === 'widgets' ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <p className={`px-1 pb-2 text-[11px] ${t.muted}`}>
              Click to add. Drag widgets on the canvas to reorder.
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {WIDGET_LIBRARY.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => addOfType(w.id)}
                  title={w.hint}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2.5 text-[11px] font-medium transition-colors ${t.btn} ${FOCUS}`}
                >
                  <w.icon className="h-[18px] w-[18px] text-blue-600" />
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <FieldsPanel
            fields={catalogue}
            resetKey={source.id}
            rows={allRows}
            selected={def.fields}
            mode="add"
            onToggle={toggleField}
            onSetAll={setFields}
            onAdd={quickAddFromField}
            onCustom={openCustom}
          />
        )}
      </Panel>

      <Panel>
        <div
          className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 ${t.lineStrong}`}
        >
          <div className="w-40">
            <Segmented
              label="Mode"
              value={editMode ? 'edit' : 'preview'}
              options={[
                {
                  value: 'edit',
                  label: (
                    <>
                      <Pencil className="h-3 w-3" />
                      Edit
                    </>
                  ),
                },
                {
                  value: 'preview',
                  label: (
                    <>
                      <Eye className="h-3 w-3" />
                      Preview
                    </>
                  ),
                },
              ]}
              onChange={(v) => {
                setEditMode(v === 'edit');
                setSelectedWidgetId(null);
              }}
            />
          </div>
          <div className="w-[72px]">
            <Segmented
              label="Device"
              value={device}
              options={[
                {
                  value: 'desktop',
                  label: <Monitor className="h-3.5 w-3.5" />,
                  title: 'Desktop',
                },
                {
                  value: 'mobile',
                  label: <Smartphone className="h-3.5 w-3.5" />,
                  title: 'Mobile',
                },
              ]}
              onChange={setDevice}
            />
          </div>
          {rangeSelect}
          {filtersPopover}
          {crossChip}
          <div className="ml-auto flex items-center gap-2">
            <GhostButton
              onClick={autoBuild}
              icon={<Sparkles className="h-3.5 w-3.5 text-blue-600" />}
              title="Rebuild with a recommended layout"
            >
              Auto-build
            </GhostButton>
            <Popover
              width={300}
              trigger={({ toggle, ref }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={toggle}
                  className={PRIMARY_BTN}
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            >
              {(close) => <WidgetMenu onPick={addOfType} close={close} />}
            </Popover>
          </div>
        </div>

        <div className={`min-h-0 flex-1 overflow-y-auto p-3 ${t.canvas}`}>
          {rowsLoading ? (
            <div className="grid grid-cols-4 gap-3" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-24 animate-pulse rounded-xl ${t.skeleton}`}
                />
              ))}
            </div>
          ) : rowsError ? (
            <p className="py-16 text-center text-[13px] text-red-600">
              {rowsError}
            </p>
          ) : (
            <div
              className="mx-auto transition-[max-width] duration-200"
              style={{ maxWidth: device === 'mobile' ? 390 : '100%' }}
            >
              <ReportPaper
                def={def}
                source={source}
                fieldMap={fieldMap}
                recordCount={viewRows.length}
                user={currentUser}
              >
                <Canvas
                  widgets={def.widgets}
                  data={dataCtx}
                  selectedId={selectedWidgetId}
                  readOnly={!editMode}
                  onSelect={setSelectedWidgetId}
                  onMove={moveWidget}
                  onReorder={reorderWidget}
                  onDuplicate={duplicateWidget}
                  onRemove={removeWidget}
                  onAdd={addOfType}
                />
              </ReportPaper>
            </div>
          )}
        </div>

        <div className={`shrink-0 border-t ${t.lineStrong}`}>
          <button
            type="button"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((o) => !o)}
            className={`flex w-full items-center justify-between px-3 py-2 text-xs font-medium ${t.body} ${t.hover} ${FOCUS}`}
          >
            <span className="flex items-center gap-2">
              <Table2 className="h-3.5 w-3.5" /> Data and summary{' '}
              <span className={t.muted}>
                · {viewRows.length.toLocaleString()} records ·{' '}
                {selectedFields.length} fields · {def.widgets.length} widgets
              </span>
            </span>
            {drawerOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          {drawerOpen && (
            <div className={`flex h-64 flex-col border-t p-3 ${t.line}`}>
              <div className="mb-2 w-56 shrink-0">
                <Segmented
                  label="Drawer tab"
                  value={drawerTab}
                  options={[
                    { value: 'data', label: 'Data preview' },
                    { value: 'summary', label: 'Summary' },
                  ]}
                  onChange={setDrawerTab}
                />
              </div>
              {drawerTab === 'data' ? (
                <DataPreview
                  rows={viewRows}
                  fields={selectedFields}
                  currency={currency}
                  limit={6}
                />
              ) : (
                <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto sm:grid-cols-2">
                  <dl className="space-y-1.5 text-[13px]">
                    {(
                      [
                        ['Source', source.name],
                        ['Period', describeFilters(def, fieldMap)],
                        ['Records', viewRows.length.toLocaleString()],
                        ['Created by', currentUser],
                      ] as const
                    ).map(([k, v]) => (
                      <div
                        key={k}
                        className="grid grid-cols-[80px_minmax(0,1fr)] gap-2"
                      >
                        <dt className={t.muted}>{k}</dt>
                        <dd className={`break-words ${t.text}`}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <ul
                    className={`divide-y rounded-lg border text-xs ${t.lineStrong} ${t.line}`}
                  >
                    {def.widgets.map((w) => (
                      <li
                        key={w.id}
                        className={`flex items-center justify-between gap-2 px-3 py-1.5 ${t.body}`}
                      >
                        <span className="truncate">{w.title}</span>
                        <span className={t.muted}>
                          {w.kind === 'chart'
                            ? CHART_TYPES.find((c) => c.value === w.chartType)
                                ?.label
                            : w.kind}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHead
          title={
            <>
              <Settings2 className="h-4 w-4" />{' '}
              {selectedWidget && editMode
                ? 'Widget settings'
                : 'Report settings'}
            </>
          }
          action={
            selectedWidget && editMode ? (
              <IconButton
                label="Back to report settings"
                onClick={() => setSelectedWidgetId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            ) : undefined
          }
        />
        {selectedWidget && editMode ? (
          <WidgetInspector
            key={selectedWidget.id}
            widget={selectedWidget}
            fields={selectedFields}
            allFields={catalogue}
            allRows={allRows}
            onPatch={(p, key) => patchWidget(selectedWidget.id, p, key)}
            onDuplicate={() => duplicateWidget(selectedWidget.id)}
            onRemove={() => removeWidget(selectedWidget.id)}
          />
        ) : (
          <ReportInspector
            def={def}
            allFields={catalogue}
            allRows={allRows}
            onChange={update}
            onAutoBuild={autoBuild}
          />
        )}
      </Panel>
    </div>
  );

  /* ==========================================================================
   * Step 3: review & generate
   * ======================================================================== */
  const renderStep3 = () => (
    <div className="grid min-h-0 gap-2 xl:h-full xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel>
        <PanelHead
          title={
            <>
              <Eye className="h-4 w-4" /> Report preview
            </>
          }
          hint="Click a chart segment to drill down. Hover a widget to expand it."
          action={<div className="flex items-center gap-2">{crossChip}</div>}
        />
        <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${t.canvas}`}>
          <div className="mx-auto max-w-[1100px]">
            <ReportPaper
              id="rb-print"
              def={def}
              source={source}
              fieldMap={fieldMap}
              recordCount={viewRows.length}
              user={currentUser}
            >
              <Canvas
                widgets={def.widgets}
                data={dataCtx}
                selectedId={null}
                readOnly
                onSelect={() => undefined}
                onMove={moveWidget}
                onReorder={reorderWidget}
                onDuplicate={duplicateWidget}
                onRemove={removeWidget}
              />
            </ReportPaper>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section
            title="Run parameters"
            defaultOpen
            badge={RANGE_LABEL[def.dateRange]}
          >
            <Field label="Date range">
              <Select
                value={def.dateRange}
                options={(Object.keys(RANGE_LABEL) as DateRangeKey[]).map(
                  (k) => ({ value: k, label: RANGE_LABEL[k] })
                )}
                onChange={(v) =>
                  update((d) => ({ ...d, dateRange: v as DateRangeKey }))
                }
              />
            </Field>
            {def.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="From">
                  <TextInput
                    type="date"
                    value={def.customFrom ?? ''}
                    onChange={(e) =>
                      update((d) => ({ ...d, customFrom: e.target.value }))
                    }
                  />
                </Field>
                <Field label="To">
                  <TextInput
                    type="date"
                    value={def.customTo ?? ''}
                    onChange={(e) =>
                      update((d) => ({ ...d, customTo: e.target.value }))
                    }
                  />
                </Field>
              </div>
            )}
            <FilterEditor
              fields={catalogue}
              rules={def.filters}
              allRows={allRows}
              onChange={(filters) => update((d) => ({ ...d, filters }))}
            />
          </Section>

          <Section
            title="Output"
            defaultOpen
            badge={output.format.toUpperCase()}
          >
            <div
              role="radiogroup"
              aria-label="Output format"
              className="grid grid-cols-3 gap-1.5"
            >
              {(
                [
                  ['pdf', 'PDF', FileText],
                  ['csv', 'CSV', Table2],
                  ['xlsx', 'Excel', Table2],
                ] as const
              ).map(([id, label, Icon]) => {
                const disabled = id === 'xlsx' && !onGenerate;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={output.format === id}
                    disabled={disabled}
                    title={
                      disabled
                        ? 'Provide an onGenerate handler to enable Excel export'
                        : undefined
                    }
                    onClick={() => setOutput((o) => ({ ...o, format: id }))}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${output.format === id ? t.selected : t.btn} ${FOCUS}`}
                  >
                    <Icon className="h-4 w-4 text-blue-600" /> {label}
                  </button>
                );
              })}
            </div>
            {output.format === 'pdf' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Orientation">
                  <Select
                    value={output.orientation}
                    options={[
                      { value: 'landscape', label: 'Landscape' },
                      { value: 'portrait', label: 'Portrait' },
                    ]}
                    onChange={(v) =>
                      setOutput((o) => ({
                        ...o,
                        orientation: v as 'portrait' | 'landscape',
                      }))
                    }
                  />
                </Field>
                <Field label="Paper">
                  <Select
                    value={output.paper}
                    options={[
                      { value: 'A4', label: 'A4' },
                      { value: 'Letter', label: 'Letter' },
                    ]}
                    onChange={(v) =>
                      setOutput((o) => ({ ...o, paper: v as 'A4' | 'Letter' }))
                    }
                  />
                </Field>
              </div>
            )}
          </Section>

          <Section
            title="Schedule and distribution"
            badge={
              def.schedule.frequency === 'none'
                ? 'Off'
                : cap(def.schedule.frequency)
            }
          >
            <Field label="Repeat">
              <Select
                value={def.schedule.frequency}
                options={[
                  { value: 'none', label: 'Run on demand only' },
                  { value: 'daily', label: 'Daily' },
                  { value: 'weekly', label: 'Weekly (Mondays)' },
                  { value: 'monthly', label: 'Monthly (1st)' },
                ]}
                onChange={(v) =>
                  update((d) => ({
                    ...d,
                    schedule: {
                      ...d.schedule,
                      frequency: v as ScheduleFrequency,
                    },
                  }))
                }
              />
            </Field>
            {def.schedule.frequency !== 'none' && (
              <Field
                label="Recipients"
                hint="Comma-separated e-mail addresses. Delivery needs your onGenerate / scheduler backend."
              >
                <TextInput
                  value={def.schedule.recipients}
                  onChange={(e) =>
                    update(
                      (d) => ({
                        ...d,
                        schedule: { ...d.schedule, recipients: e.target.value },
                      }),
                      'rcpt'
                    )
                  }
                  placeholder="cfo@bank.com, risk@bank.com"
                />
              </Field>
            )}
          </Section>

          <Section title="Save as template" defaultOpen>
            <Field label="Who can use it">
              <Select
                value={visibility}
                options={[
                  { value: 'private', label: 'Only me' },
                  { value: 'team', label: 'My team' },
                  { value: 'org', label: 'Everyone in the organisation' },
                ]}
                onChange={(v) => setVisibility(v as TemplateVisibility)}
              />
            </Field>
            <GhostButton
              onClick={() => saveTemplate(false)}
              icon={<LayoutTemplate className="h-3.5 w-3.5" />}
            >
              {templateId ? 'Update template' : 'Save template'}
            </GhostButton>
          </Section>
        </div>
        <div className={`shrink-0 space-y-2 border-t p-3 ${t.lineStrong}`}>
          {lastRun && (
            <p
              role="status"
              className="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700"
            >
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />{' '}
              {lastRun.rows.toLocaleString()} records as{' '}
              {lastRun.format.toUpperCase()} at{' '}
              {lastRun.at.toLocaleTimeString()}
            </p>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={generating || rowsLoading}
            className={`${PRIMARY_BTN} !h-9 w-full`}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {generating
              ? 'Generating…'
              : output.format === 'pdf'
                ? 'Generate PDF'
                : 'Generate report'}
          </button>
        </div>
      </Panel>
    </div>
  );

  /* ==========================================================================
   * Render
   * ======================================================================== */
  const printCss = `@media print {
    body * { visibility: hidden !important; }
    #rb-print, #rb-print * { visibility: visible !important; }
    #rb-print { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .rb-noprint { display: none !important; }
    .rb-pb { break-before: page; }
    .rb-avoid { break-inside: avoid; }
    @page { size: ${output.paper} ${output.orientation}; margin: 10mm; }
  }`;

  return (
    <ThemeCtx.Provider value={t}>
      <MaskCtx.Provider value={canViewSensitive}>
        <style>{printCss}</style>
        <div
          className="flex min-h-0 flex-col gap-2 xl:h-[var(--rb-h)] xl:min-h-[620px]"
          style={{ ['--rb-h' as string]: height } as React.CSSProperties}
        >
          {/* Top bar: identity, stepper and actions in one row */}
          <div
            className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2 ${t.card}`}
          >
            <div className="flex min-w-0 flex-1 basis-[280px] items-center gap-2">
              {onBack && (
                <IconButton label="Go back" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </IconButton>
              )}
              <span
                className={`hidden shrink-0 text-xs font-medium md:inline ${t.muted}`}
              >
                Report Builder
              </span>
              <ChevronRight
                className={`hidden h-3.5 w-3.5 shrink-0 md:block ${t.muted}`}
              />
              <input
                aria-label="Report name"
                value={def.name}
                onChange={(e) =>
                  update((d) => ({ ...d, name: e.target.value }), 'name')
                }
                placeholder="Untitled report"
                className={`h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm font-semibold ${t.text} ${FOCUS}`}
              />
              <Badge
                value={statusLabel}
                tone={dirty ? 'amber' : templateId ? 'green' : 'slate'}
              />
            </div>

            <nav aria-label="Report builder steps">
              <ol className="flex items-center gap-1">
                {STEPS.map((s, i) => {
                  const n = i + 1,
                    done = n < step,
                    active = n === step;
                  return (
                    <React.Fragment key={s.full}>
                      <li>
                        <button
                          type="button"
                          onClick={() => goStep(n)}
                          aria-current={active ? 'step' : undefined}
                          title={s.full}
                          className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 ${active ? (t.dark ? 'bg-blue-500/15' : 'bg-blue-50') : ''} ${FOCUS}`}
                        >
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${active ? 'bg-blue-600 text-white' : done ? 'bg-blue-100 text-blue-700' : t.dark ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600'}`}
                          >
                            {done ? <Check className="h-3.5 w-3.5" /> : n}
                          </span>
                          <span
                            className={`text-xs font-medium ${active ? t.text : t.muted}`}
                          >
                            <span className="hidden 2xl:inline">{s.full}</span>
                            <span className="2xl:hidden">{s.short}</span>
                          </span>
                        </button>
                      </li>
                      {n < STEPS.length && (
                        <li
                          aria-hidden="true"
                          className={`h-px w-4 ${done ? 'bg-blue-300' : t.dark ? 'bg-white/15' : 'bg-slate-200'}`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </ol>
            </nav>

            <div className="flex flex-wrap items-center gap-1.5">
              <IconButton
                label="Undo (Ctrl+Z)"
                onClick={undo}
                disabled={hist.past.length === 0}
              >
                <Undo2 className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Redo (Ctrl+Shift+Z)"
                onClick={redo}
                disabled={hist.future.length === 0}
              >
                <Redo2 className="h-4 w-4" />
              </IconButton>
              <GhostButton
                onClick={() => setTemplatesOpen(true)}
                icon={<FolderOpen className="h-3.5 w-3.5" />}
              >
                Templates
              </GhostButton>
              <GhostButton
                onClick={newReport}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                New
              </GhostButton>
              <GhostButton
                onClick={() => saveTemplate(true)}
                icon={<Save className="h-3.5 w-3.5" />}
              >
                Save draft
              </GhostButton>
              {step > 1 && (
                <GhostButton
                  onClick={() => goStep(step - 1)}
                  icon={<ArrowLeft className="h-3.5 w-3.5" />}
                >
                  Back
                </GhostButton>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => goStep(step + 1)}
                  className={PRIMARY_BTN}
                >
                  {step === 1 ? 'Next: Design' : 'Next: Review'}{' '}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating || rowsLoading}
                  className={PRIMARY_BTN}
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}{' '}
                  Generate
                </button>
              )}
            </div>
          </div>

          {restore && !dirty && step === 1 && (
            <div
              role="status"
              className={`flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-amber-300 px-3 py-2 text-xs ${t.dark ? 'bg-amber-500/10 text-amber-200' : 'bg-amber-50 text-amber-800'}`}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span className="flex-1">
                You have an unsaved report “{restore.def.name || 'Untitled'}”
                from {new Date(restore.at).toLocaleString()}.
              </span>
              <button
                type="button"
                onClick={() => {
                  resetHistory(cloneDefinition(restore.def));
                  setTemplateId(null);
                  setRestore(null);
                  setStep(2);
                }}
                className={`rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white ${FOCUS}`}
              >
                Restore
              </button>
              <button
                type="button"
                onClick={clearAutosave}
                className={`rounded-md border border-amber-400 px-2.5 py-1 font-medium ${FOCUS}`}
              >
                Discard
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </div>

          <TemplatesDrawer
            open={templatesOpen}
            templates={[...userTemplates, ...BUILTIN_TEMPLATES]}
            sources={sources}
            onClose={() => setTemplatesOpen(false)}
            onOpen={openTemplate}
            onDuplicate={duplicateTemplate}
            onDelete={deleteTemplate}
            onImport={importTemplate}
          />
          <CustomFieldsModal
            open={customOpen}
            editKey={customEdit}
            fields={catalogue}
            derived={def.derived ?? []}
            rows={allRows}
            onClose={() => setCustomOpen(false)}
            onSave={saveDerived}
            onRemove={removeDerived}
          />
          <WidgetModal
            widget={def.widgets.find((w) => w.id === expandedId) ?? null}
            data={dataCtx}
            onClose={() => setExpandedId(null)}
          />

          {rowsTruncated && (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] font-medium text-amber-950 shadow-lg"
            >
              Only the first 100 rows were loaded for preview. Counts, aggregates, and exports may be incomplete.
            </div>
          )}

          {toast && (
            <div
              role="status"
              aria-live="polite"
              className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-lg ${toast.tone === 'error' ? 'bg-red-600' : toast.tone === 'success' ? 'bg-emerald-600' : 'bg-slate-800'}`}
            >
              {toast.msg}
            </div>
          )}
        </div>
      </MaskCtx.Provider>
    </ThemeCtx.Provider>
  );
};

export default ReportBuilder;
