/**
 * Self-service report services: data sources, template storage and file
 * generation. Everything talks to the backend API first and falls back to
 * mock request/response data so the module is fully usable before the real
 * endpoints are wired.
 *
 * Expected API contract (to be implemented server-side):
 *   GET    {baseUrl}/reports/sources                  -> ReportSourceMeta[]
 *   POST   {baseUrl}/reports/data                     -> { rows: Row[] }
 *          body: { source_id, from_date, to_date }
 *   GET    {baseUrl}/reports/templates?owner=...      -> ReportTemplate[]
 *   POST   {baseUrl}/reports/templates                -> ReportTemplate
 *   DELETE {baseUrl}/reports/templates/:id            -> {}
 */
import axios from 'axios';
import * as XLSX from 'xlsx';
import { AlertTriangle, Building, CreditCard, Users } from 'lucide-react';
import type {
  FieldDef,
  GeneratePayload,
  ReportSource,
  ReportTemplate,
  ReportTemplateStore,
  Row,
} from '../components/reports/ReportBuilder';
import { appConfig as config } from '../config/runtime-config';
import { logger } from '../utils/logger';

/* ==========================================================================
 * Mock fallback datasets (replace once the real API responds)
 * ======================================================================== */
type FieldType = FieldDef['type'];

const f = (
  key: string,
  label: string,
  type: FieldType,
  group: string,
  badge?: boolean
): FieldDef => ({
  key,
  label,
  type,
  group,
  badge,
});

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 864e5));

const CHANNELS = ['Online', 'Mobile app', 'POS', 'ATM', 'Branch'];
const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const ANALYSTS = ['A. Hassan', 'M. Rossi', 'J. Okafor', 'L. Chen', 'S. Patel'];

function mockRows(
  seed: number,
  n: number,
  build: (r: () => number, i: number) => Row
): Row[] {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => build(r, i));
}

const ALERT_MOCK = () =>
  mockRows(11, 480, (r, i) => {
    const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
    const w = (pairs: [string, number][]) => {
      let x = r() * pairs.reduce((s, p) => s + p[1], 0);
      for (const [v, wt] of pairs) if ((x -= wt) <= 0) return v;
      return pairs[0][0];
    };
    return {
      alert_id: `AL-${50000 + i}`,
      rule_id: pick(['R-001', 'R-014', 'R-027', 'R-044', 'R-052']),
      scenario: pick([
        'Velocity breach',
        'Impossible travel',
        'New device high value',
        'Dormant account reactivated',
        'Card-not-present spike',
      ]),
      rule_priority: w([
        ['High', 3],
        ['Medium', 4],
        ['Low', 4],
      ]),
      status: w([
        ['New', 2],
        ['In review', 2],
        ['False positive', 5],
        ['Confirmed', 2],
      ]),
      channel: pick(CHANNELS),
      risk_score: Math.round(30 + r() * 70),
      amount: money(20, 25000),
      analyst: pick(ANALYSTS),
      triggered: daysAgo(Math.floor(r() ** 1.25 * 365)),
    };
  });

const USER_MOCK = () =>
  mockRows(23, 140, (r, i) => {
    const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
    const w = (pairs: [string, number][]) => {
      let x = r() * pairs.reduce((s, p) => s + p[1], 0);
      for (const [v, wt] of pairs) if ((x -= wt) <= 0) return v;
      return pairs[0][0];
    };
    return {
      emp_id: `EMP-${1000 + i}`,
      full_name: pick([
        'A. Hassan',
        'M. Rossi',
        'J. Okafor',
        'L. Chen',
        'S. Patel',
        'R. Duarte',
        'K. Novak',
        'T. Weber',
      ]),
      role: pick(['Cashier', 'Teller', 'Supervisor']),
      branch: pick([
        'City Centre',
        'Marina Mall',
        'Airport',
        'Al Ain',
        'Deira',
      ]),
      violations: Math.floor(r() ** 2 * 40),
      risk_level: w([
        ['High', 2],
        ['Medium', 3],
        ['Low', 5],
      ]),
      amount: money(100, 40000),
      last_violation: daysAgo(Math.floor(r() ** 1.5 * 60)),
    };
  });

const BRANCH_MOCK = () =>
  mockRows(37, 90, (r, i) => {
    const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
    const w = (pairs: [string, number][]) => {
      let x = r() * pairs.reduce((s, p) => s + p[1], 0);
      for (const [v, wt] of pairs) if ((x -= wt) <= 0) return v;
      return pairs[0][0];
    };
    return {
      branch_id: `BR-${100 + i}`,
      branch_name: pick([
        'City Centre',
        'Marina Mall',
        'Airport',
        'Al Ain',
        'Deira',
        'Sharjah',
        'Abu Dhabi Mall',
      ]),
      region: pick(REGIONS),
      total_alerts: Math.floor(r() ** 1.5 * 200) + 5,
      high_risk: Math.floor(r() ** 2 * 60),
      risk_level: w([
        ['High', 2],
        ['Medium', 3],
        ['Low', 5],
      ]),
      amount: money(500, 120000),
      report_date: daysAgo(Math.floor(r() ** 1.25 * 365)),
    };
  });

const TXN_MOCK = () =>
  mockRows(53, 620, (r, i) => {
    const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
    const w = (pairs: [string, number][]) => {
      let x = r() * pairs.reduce((s, p) => s + p[1], 0);
      for (const [v, wt] of pairs) if ((x -= wt) <= 0) return v;
      return pairs[0][0];
    };
    return {
      txn_id: `TX-${900000 + i}`,
      merchant: pick([
        'TechMart',
        'AeroTickets',
        'QuickFuel',
        'LuxWatch Co',
        'GameVault',
        'FreshGrocer',
      ]),
      channel: pick(CHANNELS),
      country: pick(['US', 'GB', 'AE', 'SG', 'DE', 'IN']),
      amount: money(5, 12000),
      risk_score: Math.round(r() ** 1.6 * 100),
      decision: w([
        ['Approved', 8],
        ['Manual review', 2],
        ['Declined', 2],
      ]),
      txn_date: daysAgo(Math.floor(r() ** 1.25 * 365)),
    };
  });

/* ==========================================================================
 * Source catalogue: API-first, mock fallback
 * ======================================================================== */
interface ReportSourceMeta {
  id: string;
  name: string;
  description: string;
  recordLabel: string;
  dateField: string;
  fields: FieldDef[];
  defaultFields: string[];
}

const MOCK_SOURCE_CATALOGUE: ReportSourceMeta[] = [
  {
    id: 'alerts',
    name: 'Fraud alerts',
    description: 'Rule and model alerts awaiting or completing analyst review.',
    recordLabel: 'alerts',
    dateField: 'triggered',
    fields: [
      f('alert_id', 'Alert ID', 'text', 'Alert information'),
      f('rule_id', 'Rule ID', 'text', 'Alert information'),
      f('scenario', 'Detection scenario', 'category', 'Alert information'),
      f('rule_priority', 'Priority', 'category', 'Alert information', true),
      f('status', 'Status', 'category', 'Alert information', true),
      f('channel', 'Channel', 'category', 'Alert information'),
      f('risk_score', 'Risk score', 'number', 'Scoring'),
      f('amount', 'Transaction amount', 'currency', 'Financial'),
      f('analyst', 'Analyst', 'category', 'Assignment'),
      f('triggered', 'Triggered date', 'date', 'Dates'),
    ],
    defaultFields: [
      'alert_id',
      'scenario',
      'rule_priority',
      'status',
      'risk_score',
      'amount',
      'analyst',
      'triggered',
    ],
  },
  {
    id: 'users',
    name: 'User activity',
    description: 'Cashier and teller violations, exposure and last activity.',
    recordLabel: 'users',
    dateField: 'last_violation',
    fields: [
      f('emp_id', 'Employee ID', 'text', 'Employee'),
      f('full_name', 'Name', 'text', 'Employee'),
      f('role', 'Role', 'category', 'Employee'),
      f('branch', 'Branch', 'category', 'Assignment'),
      f('risk_level', 'Risk level', 'category', 'Assignment', true),
      f('violations', 'Violations', 'number', 'Activity'),
      f('amount', 'Amount involved', 'currency', 'Financial'),
      f('last_violation', 'Last violation', 'date', 'Activity'),
    ],
    defaultFields: [
      'emp_id',
      'full_name',
      'role',
      'branch',
      'risk_level',
      'violations',
      'amount',
      'last_violation',
    ],
  },
  {
    id: 'branches',
    name: 'Branch risk',
    description: 'Location-level alert volumes, risk ratings and exposure.',
    recordLabel: 'branches',
    dateField: 'report_date',
    fields: [
      f('branch_id', 'Branch ID', 'text', 'Branch'),
      f('branch_name', 'Branch', 'text', 'Branch'),
      f('region', 'Region', 'category', 'Branch'),
      f('risk_level', 'Risk level', 'category', 'Risk'),
      f('total_alerts', 'Total alerts', 'number', 'Risk'),
      f('high_risk', 'High-risk alerts', 'number', 'Risk'),
      f('amount', 'Exposure', 'currency', 'Financial'),
      f('report_date', 'Report date', 'date', 'Dates'),
    ],
    defaultFields: [
      'branch_id',
      'branch_name',
      'region',
      'risk_level',
      'total_alerts',
      'high_risk',
      'amount',
      'report_date',
    ],
  },
  {
    id: 'transactions',
    name: 'Transactions',
    description: 'Scored payment activity with decisions and merchant context.',
    recordLabel: 'transactions',
    dateField: 'txn_date',
    fields: [
      f('txn_id', 'Transaction ID', 'text', 'Transaction'),
      f('merchant', 'Merchant', 'category', 'Transaction'),
      f('channel', 'Channel', 'category', 'Transaction'),
      f('country', 'Country', 'category', 'Transaction'),
      f('amount', 'Amount', 'currency', 'Financial'),
      f('risk_score', 'Risk score', 'number', 'Scoring'),
      f('decision', 'Decision', 'category', 'Scoring', true),
      f('txn_date', 'Transaction date', 'date', 'Dates'),
    ],
    defaultFields: [
      'txn_id',
      'merchant',
      'channel',
      'amount',
      'risk_score',
      'decision',
      'txn_date',
    ],
  },
];

const SOURCE_ICONS: Record<string, ReportSource['icon']> = {
  alerts: AlertTriangle,
  users: Users,
  branches: Building,
  transactions: CreditCard,
};

const MOCK_ROW_FACTORIES: Record<string, () => Row[]> = {
  alerts: ALERT_MOCK,
  users: USER_MOCK,
  branches: BRANCH_MOCK,
  transactions: TXN_MOCK,
};

const rowCache = new Map<string, Row[]>();

async function fetchRows(meta: ReportSourceMeta): Promise<Row[]> {
  const cached = rowCache.get(meta.id);
  if (cached) return cached;
  try {
    const response = await axios.post<{ rows: Row[] }>(
      `${config.api.baseUrl}/reports/data`,
      { source_id: meta.id },
      { timeout: config.api.timeout || 30000 }
    );
    const rows = response.data?.rows;
    if (!Array.isArray(rows)) throw new Error('Unexpected rows payload');
    rowCache.set(meta.id, rows);
    return rows;
  } catch (err) {
    logger.info(
      'reportBuilderService',
      'fetchRows',
      `API unavailable for ${meta.id}, using mock data`
    );
    const rows = (MOCK_ROW_FACTORIES[meta.id] ?? ALERT_MOCK)();
    rowCache.set(meta.id, rows);
    return rows;
  }
}

export async function fetchReportSources(): Promise<ReportSource[]> {
  try {
    const response = await axios.get<ReportSourceMeta[]>(
      `${config.api.baseUrl}/reports/sources`,
      { timeout: config.api.timeout || 30000 }
    );
    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('Empty source catalogue');
    }
    return response.data.map((meta) => ({
      ...meta,
      icon: SOURCE_ICONS[meta.id] ?? CreditCard,
      loadRows: () => fetchRows(meta),
    }));
  } catch (err) {
    logger.info(
      'reportBuilderService',
      'fetchReportSources',
      'API unavailable, using mock source catalogue'
    );
    return MOCK_SOURCE_CATALOGUE.map((meta) => ({
      ...meta,
      icon: SOURCE_ICONS[meta.id] ?? CreditCard,
      loadRows: () => fetchRows(meta),
    }));
  }
}

/* ==========================================================================
 * Template storage: API-first, localStorage fallback
 * ======================================================================== */
const LS_KEY = 'fdt-report-templates:v1';

const readLocalTemplates = (): ReportTemplate[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
};

const writeLocalTemplates = (templates: ReportTemplate[]) =>
  localStorage.setItem(LS_KEY, JSON.stringify(templates));

export const reportTemplateStore: ReportTemplateStore = {
  list: async () => {
    try {
      const response = await axios.get<ReportTemplate[]>(
        `${config.api.baseUrl}/reports/templates`,
        { timeout: config.api.timeout || 30000 }
      );
      if (Array.isArray(response.data)) return response.data;
      throw new Error('Unexpected templates payload');
    } catch {
      return readLocalTemplates();
    }
  },
  save: async (template) => {
    try {
      const response = await axios.post<ReportTemplate>(
        `${config.api.baseUrl}/reports/templates`,
        template,
        { timeout: config.api.timeout || 30000 }
      );
      return response.data ?? template;
    } catch {
      const all = readLocalTemplates();
      const i = all.findIndex((x) => x.id === template.id);
      if (i >= 0) all[i] = template;
      else all.unshift(template);
      writeLocalTemplates(all);
      return template;
    }
  },
  remove: async (id) => {
    try {
      await axios.delete(`${config.api.baseUrl}/reports/templates/${id}`, {
        timeout: config.api.timeout || 30000,
      });
    } catch {
      writeLocalTemplates(readLocalTemplates().filter((x) => x.id !== id));
    }
  },
};

/* ==========================================================================
 * File generation: PDF (print), CSV, Excel
 * ======================================================================== */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'report';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function generateReportFile(
  payload: GeneratePayload
): Promise<void> {
  const { definition, rows, columns, format } = payload;
  const base = `${slug(definition.name)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === 'pdf') {
    await new Promise((r) => setTimeout(r, 150));
    window.print();
    return;
  }

  if (format === 'csv') {
    const esc = (v: string | number | undefined) =>
      `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      columns.map((c) => esc(c.label)).join(','),
      ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(',')),
    ].join('\r\n');
    downloadBlob(
      new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
      `${base}.csv`
    );
    return;
  }

  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) =>
      Object.fromEntries(columns.map((c) => [c.label, r[c.key] ?? '']))
    )
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheet,
    slug(definition.name).slice(0, 30) || 'Report'
  );
  const out = XLSX.write(book, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${base}.xlsx`
  );
}
