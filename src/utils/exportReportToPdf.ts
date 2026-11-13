// Builds a real PDF from the generated report payload (the same records that
// CSV and Excel exports contain). Uses jsPDF only — no print dialog, so it
// also works inside sandboxed preview frames.
import type { GeneratePayload } from '../components/reports/ReportBuilder';

const MARGIN = 12;
const HEADER_H = 34;

export async function exportReportToPdf(
  payload: GeneratePayload,
  fileName: string
): Promise<void> {
  const [{ jsPDF }] = await Promise.all([import('jspdf')]);
  const { definition, rows, columns, options } = payload;

  const pdf = new jsPDF({
    orientation: options.orientation === 'portrait' ? 'p' : 'l',
    unit: 'mm',
    format: options.paper === 'Letter' ? 'letter' : 'a4',
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  const drawHeader = (first: boolean) => {
    if (first) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.setTextColor(15, 23, 42);
      pdf.text(definition.name || 'Report', MARGIN, 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      const info = [
        `Generated ${new Date().toLocaleString()}`,
        `Records: ${rows.length.toLocaleString()}`,
      ].join('   ·   ');
      pdf.text(info, MARGIN, 20);
      if (definition.description) {
        pdf.text(
          pdf.splitTextToSize(definition.description, contentWidth),
          MARGIN,
          25
        );
      }
      pdf.setDrawColor(226, 232, 240);
      pdf.line(MARGIN, HEADER_H - 5, pageWidth - MARGIN, HEADER_H - 5);
    }
  };

  drawHeader(true);

  // Column widths: spread proportionally, text columns capped and wrapped.
  const cols = columns.filter((c) => c.key);
  const totalWeight = cols.reduce(
    (s, c) => s + (c.type === 'text' ? 1.6 : 1),
    0
  );
  const widths = cols.map(
    (c) => (contentWidth * (c.type === 'text' ? 1.6 : 1)) / totalWeight
  );
  const rowH = 6;
  const maxRowsPerPage = Math.max(
    1,
    Math.floor((pageHeight - HEADER_H - 10) / rowH)
  );

  const drawRow = (
    values: string[],
    y: number,
    opts: { header?: boolean; zebra?: boolean }
  ) => {
    let x = MARGIN;
    if (opts.header) {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(MARGIN, y - rowH + 1.6, contentWidth, rowH, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
    } else if (opts.zebra) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(MARGIN, y - rowH + 1.6, contentWidth, rowH, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
    } else {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
    }
    cols.forEach((c, i) => {
      const w = widths[i];
      const raw = values[i] ?? '';
      const lines = pdf.splitTextToSize(String(raw), w - 2);
      const clip =
        Array.isArray(lines) && lines.length > 2
          ? lines.slice(0, 2).join(' ').concat('…')
          : lines;
      pdf.text(
        clip,
        c.type === 'number' || c.type === 'currency' || c.type === 'decimal'
          ? x + w - 2
          : x,
        y,
        {
          align:
            c.type === 'number' || c.type === 'currency' || c.type === 'decimal'
              ? 'right'
              : 'left',
          maxWidth: w - 2,
        }
      );
      x += w;
    });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(MARGIN, y + 1.6, pageWidth - MARGIN, y + 1.6);
  };

  const headerLabels = cols.map((c) => c.label);
  drawRow(headerLabels, HEADER_H + rowH, { header: true });
  let y = HEADER_H + rowH * 2;
  let onFirstPage = true;

  rows.forEach((r, i) => {
    if (y > pageHeight - 12) {
      pdf.addPage();
      onFirstPage = false;
      drawHeader(false);
      drawRow(headerLabels, HEADER_H + rowH, { header: true });
      y = HEADER_H + rowH * 2;
    }
    drawRow(
      cols.map((c) =>
        r[c.key] === null || r[c.key] === undefined ? '' : String(r[c.key])
      ),
      y,
      { zebra: i % 2 === 1 }
    );
    y += rowH;
    void onFirstPage;
  });

  if (rows.length === 0) {
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text('No records match the current filters.', MARGIN, y);
  }

  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(
      `${definition.name || 'Report'} · Page ${i} of ${pageCount}`,
      MARGIN,
      pageHeight - 6
    );
  }

  pdf.save(fileName);
}
