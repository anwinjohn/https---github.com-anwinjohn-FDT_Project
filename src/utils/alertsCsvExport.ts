import { appConfig as config } from '../config/runtime-config';
import { AlertFilters, AlertSummary } from '../types/alerts';

export type AlertExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

interface AlertsPageResponse {
  data?: AlertSummary[];
  total?: number;
  has_next?: boolean;
}

export interface AlertsExportResult {
  exportedCount: number;
  totalCount: number;
}

export interface AlertsExportProgress {
  /** Percentage from 0 to 100, based on actual fetching/file-generation work. */
  progress: number;
  stage: string;
  exportedCount: number;
  totalCount: number;
}

type ExportRecord = Record<string, string>;

// Keep exports focused on fields that are useful for reviewing and reconciling alerts.
const EXPORT_COLUMNS: Array<{
  heading: string;
  value: (alert: AlertSummary) => unknown;
}> = [
  { heading: 'Alert ID', value: (alert) => alert.alert_id },
  { heading: 'Alert Date', value: (alert) => alert.time_stamp },
  { heading: 'Status', value: (alert) => alert.status },
  { heading: 'Priority', value: (alert) => alert.rule_priority },
  { heading: 'Service Type', value: (alert) => alert.service_type },
  { heading: 'Rule ID', value: (alert) => alert.rule_id },
  { heading: 'Rule Description', value: (alert) => alert.rule_desc },
  { heading: 'Customer Code', value: (alert) => alert.cust_code },
  { heading: 'Customer Name', value: (alert) => alert.cust_name },
  { heading: 'Customer Type', value: (alert) => alert.customer_type },
  { heading: 'Branch', value: (alert) => alert.branch_name },
  { heading: 'Remarks', value: (alert) => alert.remarks },
];

const EXPORT_PAGE_SIZE = 200;
const FILE_MIME_TYPES: Record<AlertExportFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  json: 'application/json;charset=utf-8',
};

const escapeCsvValue = (value: unknown): string => {
  const text = value == null ? '' : String(value);
  // Prefix formula-looking values so spreadsheet applications cannot evaluate data as formulas.
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const toExportRecord = (alert: AlertSummary): ExportRecord =>
  Object.fromEntries(
    EXPORT_COLUMNS.map((column) => [
      column.heading,
      String(column.value(alert) ?? ''),
    ])
  );

const buildExportQuery = (filters: AlertFilters): string => {
  const params = new URLSearchParams({});

  if (filters.search.trim()) params.append('search', filters.search.trim());
  filters.service_type.forEach((value) => params.append('service_type', value));
  filters.rule_id.forEach((value) => params.append('rule_id', value));
  filters.status.forEach((value) => params.append('status', value));
  filters.priority.forEach((value) => params.append('rule_priority', value));
  if (filters.date_range.from.trim())
    params.append('from_date', filters.date_range.from.trim());
  if (filters.date_range.to.trim())
    params.append('to_date', filters.date_range.to.trim());
  filters.assigned_to.forEach((value) => params.append('assigned_to', value));
  filters.branch_name.forEach((value) => params.append('branch_name', value));
  filters.cust_nationality.forEach((value) =>
    params.append('cust_nationality', value)
  );

  return params.toString();
};

const downloadBlob = (parts: BlobPart[], format: AlertExportFormat): void => {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob(parts, { type: FILE_MIME_TYPES[format] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Alert_Report_${date}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const buildPdf = async (records: ExportRecord[]): Promise<BlobPart> => {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headers = [
    'Alert ID',
    'Alert Date',
    'Priority',
    'Customer Name',
    'Rule Description',
    'Branch',
    'Remarks',
  ];
  const widths = [30, 30, 24, 22, 42, 84, 43];
  const margin = 10;
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = 18;

  const addHeader = () => {
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Alerts Report', margin, 10);
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(
      `Generated ${new Date().toLocaleString()} · ${records.length} alerts`,
      margin,
      14
    );
    pdf.setFillColor(32, 110, 82);
    pdf.rect(
      margin,
      18,
      widths.reduce((sum, width) => sum + width, 0),
      6,
      'F'
    );
    pdf.setFontSize(7);
    pdf.setTextColor(255, 255, 255);
    let x = margin + 1;
    headers.forEach((header, index) => {
      pdf.text(header, x, 22);
      x += widths[index];
    });
    y = 28;
  };

  addHeader();
  records.forEach((record) => {
    const cells = headers.map((header, index) =>
      pdf.splitTextToSize(record[header] || '', widths[index] - 2)
    );
    const rowHeight =
      Math.max(5, ...cells.map((lines) => lines.length * 3.2)) + 2;
    if (y + rowHeight > pageHeight - 10) {
      pdf.addPage();
      addHeader();
    }

    let x = margin;
    pdf.setDrawColor(220, 220, 220);
    pdf.setTextColor(40, 40, 40);
    pdf.setFontSize(6.5);
    cells.forEach((lines, index) => {
      pdf.rect(x, y - 4, widths[index], rowHeight);
      pdf.text(lines, x + 1, y);
      x += widths[index];
    });
    y += rowHeight;
  });

  return pdf.output('arraybuffer');
};

const buildFile = async (
  records: ExportRecord[],
  format: AlertExportFormat
): Promise<BlobPart[]> => {
  switch (format) {
    case 'csv':
      return [
        '\uFEFF', // lets Excel correctly detect UTF-8 names and descriptions
        `${EXPORT_COLUMNS.map((column) => escapeCsvValue(column.heading)).join(',')}\r\n`,
        ...records.map(
          (record) =>
            `${EXPORT_COLUMNS.map((column) => escapeCsvValue(record[column.heading])).join(',')}\r\n`
        ),
      ];
    case 'json':
      return [JSON.stringify(records, null, 2)];
    case 'xlsx': {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(records, {
        header: EXPORT_COLUMNS.map((column) => column.heading),
      });
      worksheet['!cols'] = EXPORT_COLUMNS.map((column) => ({
        wch: Math.min(Math.max(column.heading.length + 2, 14), 42),
      }));
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');
      return [XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })];
    }
    case 'pdf':
      return [await buildPdf(records)];
  }
};

/**
 * Fetches every alert matching the filters and downloads it in the selected format.
 * Requests are sequential and bounded to 500 records to be safe for large exports.
 *    const apiUrl = `${config.api.baseUrl}/open-alerts-summary${
        queryString ? `?${queryString}` : ''
      }`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

 */
export const exportAllAlerts = async (
  filters: AlertFilters,
  format: AlertExportFormat,
  onProgress?: (progress: AlertsExportProgress) => void
): Promise<AlertsExportResult> => {
  const records: ExportRecord[] = [];
  const seenAlertIds = new Set<string>();
  let page = 1;
  let totalCount = 0;

  onProgress?.({
    progress: 2,
    stage: 'Gathering matching alerts…',
    exportedCount: 0,
    totalCount: 0,
  });
  while (true) {
    const queryString = buildExportQuery(filters);
    const response = await fetch(
      `${config.api.baseUrl}/download-alerts-summary${queryString ? `?${queryString}` : ''}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );
    if (!response.ok)
      throw new Error(`Unable to export alerts (HTTP ${response.status})`);

    const payload: AlertsPageResponse = await response.json();
    const pageAlerts = payload.data ?? [];
    totalCount = payload.total ?? totalCount;
    pageAlerts.forEach((alert) => {
      if (!seenAlertIds.has(alert.alert_id)) {
        seenAlertIds.add(alert.alert_id);
        records.push(toExportRecord(alert));
      }
    });

    const fetchProgress =
      totalCount > 0 ? 5 + Math.min(60, (records.length / totalCount) * 60) : 5;
    onProgress?.({
      progress: fetchProgress,
      stage: 'Gathering matching alerts…',
      exportedCount: records.length,
      totalCount,
    });
    if (!payload.has_next || pageAlerts.length === 0) break;
    page += 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  if (records.length === 0) return { exportedCount: 0, totalCount };

  onProgress?.({
    progress: 70,
    stage: 'Formatting rows…',
    exportedCount: records.length,
    totalCount,
  });
  const fileParts = await buildFile(records, format);
  onProgress?.({
    progress: 90,
    stage: 'Compiling file…',
    exportedCount: records.length,
    totalCount,
  });
  downloadBlob(fileParts, format);
  onProgress?.({
    progress: 100,
    stage: 'File ready',
    exportedCount: records.length,
    totalCount,
  });

  return { exportedCount: records.length, totalCount };
};

/** Backwards-compatible CSV entry point for callers that have not adopted format selection yet. */
export const exportAllAlertsToCsv = (
  filters: AlertFilters,
  onProgress?: (exportedCount: number, totalCount: number) => void
) =>
  exportAllAlerts(filters, 'csv', (progress) =>
    onProgress?.(progress.exportedCount, progress.totalCount)
  );
