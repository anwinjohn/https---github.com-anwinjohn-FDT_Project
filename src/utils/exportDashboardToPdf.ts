// utils/exportDashboardToPdf.ts
//
// Exports a DOM node (the dashboard section) to a paginated PDF.
// Dependencies (jspdf, html2canvas) are dynamically imported so this
// utility has zero impact on initial bundle size or any other screen
// until "Export PDF" is actually clicked.
//
//   npm install jspdf html2canvas
//
// Usage:
//   await exportDashboardToPdf(dashboardRef.current, {
//     fileName: 'fraud-trend-report.pdf',
//     title: 'Fraud Trend — Management Dashboard',
//     subtitle: 'Jul 1 – Jul 24, 2026',
//   });

export interface ExportPdfOptions {
  fileName?: string;
  title?: string;
  subtitle?: string;
  /** Called with true/false to drive a loading spinner on the trigger button */
  onProgress?: (isExporting: boolean) => void;
}

export async function exportDashboardToPdf(
  node: HTMLElement | null,
  options: ExportPdfOptions = {}
): Promise<void> {
  if (!node) {
    console.error('exportDashboardToPdf: no DOM node provided');
    return;
  }

  const {
    fileName = `fraud-trend-dashboard-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`,
    title = 'Fraud Trend — Management Dashboard',
    subtitle = '',
    onProgress,
  } = options;

  try {
    onProgress?.(true);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    // Header
    pdf.setFontSize(16);
    pdf.setTextColor(20, 20, 20);
    pdf.text(title, margin, 15);
    if (subtitle) {
      pdf.setFontSize(10);
      pdf.setTextColor(110, 110, 110);
      pdf.text(subtitle, margin, 21);
    }
    pdf.setDrawColor(225, 225, 225);
    pdf.line(margin, 25, pageWidth - margin, 25);

    // Image, paginated if taller than one page
    const imgData = canvas.toDataURL('image/png');
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 30;

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
    heightLeft -= pageHeight - position;

    while (heightLeft > 0) {
      pdf.addPage();
      position = heightLeft - imgHeight + margin;
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    // Footer with generation timestamp on every page
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Generated ${new Date().toLocaleString()} · Page ${i} of ${pageCount}`,
        margin,
        pageHeight - 6
      );
    }

    pdf.save(fileName);
  } catch (err) {
    console.error('PDF export failed:', err);
    throw err;
  } finally {
    onProgress?.(false);
  }
}
