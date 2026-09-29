import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CaseMetadata, LegalStrategyResult, TimelineKeyDate, EmailMessage } from '../types';

interface ExportPdfOptions {
  caseMeta: CaseMetadata;
  strategyResult: LegalStrategyResult;
  deadlines: TimelineKeyDate[];
  emails: EmailMessage[];
  includeExhibitExcerpts?: boolean;
}

export function exportStrategyAndTimelinePdf({
  caseMeta,
  strategyResult,
  deadlines,
  emails,
  includeExhibitExcerpts = true,
}: ExportPdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const accentColor: [number, number, number] = [79, 70, 229]; // indigo-600
  const darkTextColor: [number, number, number] = [15, 23, 42]; // slate-900
  const mutedTextColor: [number, number, number] = [100, 116, 139]; // slate-500

  // 1. Privileged Banner Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, 25, contentWidth, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(190, 18, 60); // rose-700
  doc.text('CONFIDENTIAL // ATTORNEY-CLIENT PRIVILEGED & WORK PRODUCT DOCTRINE // PRE-TRIAL REVIEW', pageWidth / 2, 38, { align: 'center' });

  // 2. Title & Date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...primaryColor);
  doc.text('LEGAL STRATEGY & CHRONOLOGICAL TIMELINE BRIEF', margin, 70);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedTextColor);
  const dateFormatted = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  doc.text(`Generated: ${dateFormatted} | Mode: ${strategyResult.budgetMode.toUpperCase()} Assessment`, margin, 85);

  // 3. Case Metadata Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 95, contentWidth, 75, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);
  doc.text('MATTER / CASE CAPTION:', margin + 12, 112);
  doc.setFont('helvetica', 'normal');
  doc.text(`${caseMeta.claimantName || 'Claimant'} v. ${caseMeta.opposingPartyName || 'Opposing Party'}`, margin + 145, 112);

  doc.setFont('helvetica', 'bold');
  doc.text('PRIMARY CAUSE OF ACTION:', margin + 12, 128);
  doc.setFont('helvetica', 'normal');
  doc.text(`${caseMeta.causeOfAction || 'Civil Dispute'}`, margin + 145, 128);

  doc.setFont('helvetica', 'bold');
  doc.text('DAMAGES DEMANDED:', margin + 12, 144);
  doc.setFont('helvetica', 'normal');
  doc.text(`${caseMeta.demandedAmount || 'TBD'}`, margin + 145, 144);

  doc.setFont('helvetica', 'bold');
  doc.text('VENUE / JURISDICTION:', margin + 12, 160);
  doc.setFont('helvetica', 'normal');
  doc.text(`${caseMeta.jurisdiction || 'Commercial Jurisdiction'}`, margin + 145, 160);

  let currentY = 185;

  // 4. Section I: Executive Assessment & Settlement Leverage
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text('I. EXECUTIVE CASE VIABILITY & SETTLEMENT LEVERAGE', margin, currentY);
  currentY += 12;

  // Leverage rating pill
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(margin, currentY, contentWidth, 24, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...accentColor);
  doc.text(`SETTLEMENT LEVERAGE POSTURE: ${strategyResult.settlementLeverage.rating.toUpperCase()}`, margin + 10, currentY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkTextColor);
  const leverageSnippet = doc.splitTextToSize(`Strategy: ${strategyResult.settlementLeverage.recommendedStrategy}`, contentWidth - 250);
  doc.text(leverageSnippet[0] || '', margin + 240, currentY + 16);
  currentY += 32;

  // Summary Text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkTextColor);
  const summaryLines = doc.splitTextToSize(strategyResult.executiveSummary || 'No executive summary provided.', contentWidth);
  doc.text(summaryLines, margin, currentY);
  currentY += summaryLines.length * 12 + 15;

  // 5. Section II: Elements of Proof Matrix Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text('II. ELEMENTS OF PROOF MATRIX & CORROBORATING EVIDENCE', margin, currentY);
  currentY += 8;

  const elementsData = strategyResult.elementsOfProof.map((item, idx) => [
    `${idx + 1}. ${item.element}`,
    item.status.toUpperCase(),
    (item.supportingExhibits || []).join(', ') || 'A-001',
    item.factualAnalysis,
    item.gapsAndDiscovery || 'None noted',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Legal Element', 'Status', 'Exhibits', 'Factual Corroboration', 'Discovery Subpoena Focus']],
    body: elementsData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: 'bold' },
      1: { cellWidth: 55, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 65, fontStyle: 'bold' },
      3: { cellWidth: 160 },
      4: { cellWidth: 132 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'STRONG') {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
        } else if (data.cell.raw === 'MODERATE') {
          data.cell.styles.textColor = [217, 119, 6]; // amber-600
        } else {
          data.cell.styles.textColor = [225, 29, 72]; // rose-600
        }
      }
    },
  });

  // 6. Section III: Anticipated Affirmative Defenses Table
  const lastTableEnd = (doc as any).lastAutoTable?.finalY || currentY + 100;
  currentY = lastTableEnd + 20;

  // Check if we need page break
  if (currentY + 120 > pageHeight - 50) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text('III. ANTICIPATED AFFIRMATIVE DEFENSES & COUNTER-REFUTATIONS', margin, currentY);
  currentY += 8;

  const defensesData = strategyResult.anticipatedDefenses.map(item => [
    item.defense,
    item.likelihood.toUpperCase(),
    item.counterRefutation,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Anticipated Defense', 'Risk Tier', 'Contemporaneous Documentary Refutation']],
    body: defensesData,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 140, fontStyle: 'bold' },
      1: { cellWidth: 70, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 322 },
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        if (data.cell.raw === 'HIGH') {
          data.cell.styles.textColor = [225, 29, 72];
        } else if (data.cell.raw === 'MEDIUM') {
          data.cell.styles.textColor = [217, 119, 6];
        } else {
          data.cell.styles.textColor = [71, 85, 105];
        }
      }
    },
  });

  // 7. Section IV: Chronological Evidentiary Timeline & Deadlines
  const lastDefensesEnd = (doc as any).lastAutoTable?.finalY || currentY + 100;
  currentY = lastDefensesEnd + 20;

  if (currentY + 140 > pageHeight - 50) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text('IV. CHRONOLOGICAL EVIDENTIARY TIMELINE & STATUTORY DEADLINES', margin, currentY);
  currentY += 8;

  const timelineRows = deadlines.map(item => [
    item.date,
    item.significance,
    item.exhibitRef || 'N/A',
    item.syncedToCalendar ? 'SYNCED' : 'PENDING SYNC',
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Evidentiary Event / Statutory Significance', 'Exhibit Reference', 'Calendar Status']],
    body: timelineRows,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 75, fontStyle: 'bold' },
      1: { cellWidth: 287 },
      2: { cellWidth: 90, fontStyle: 'bold' },
      3: { cellWidth: 80, halign: 'center' },
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: [30, 41, 59],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'SYNCED') {
          data.cell.styles.textColor = [5, 150, 105];
        } else {
          data.cell.styles.textColor = [100, 116, 139];
        }
      }
    },
  });

  // 8. Section V: Procedural Action Roadmap
  const lastTimelineEnd = (doc as any).lastAutoTable?.finalY || currentY + 100;
  currentY = lastTimelineEnd + 20;

  if (currentY + 80 > pageHeight - 50) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...accentColor);
  doc.text('V. RECOMMENDED PROCEDURAL ACTION ROADMAP', margin, currentY);
  currentY += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkTextColor);
  (strategyResult.recommendedActionItems || []).forEach((item, idx) => {
    doc.text(`[Step ${idx + 1}]  ${item}`, margin + 5, currentY);
    currentY += 12;
  });

  // 9. Add Header and Footer to every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Running header (on pages 2+)
    if (i > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...mutedTextColor);
      doc.text(
        `LEGAL STRATEGY & TIMELINE BRIEF — ${caseMeta.claimantName.toUpperCase()} v. ${caseMeta.opposingPartyName.toUpperCase()}`,
        margin,
        25
      );
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, 28, pageWidth - margin, 28);
    }

    // Running footer
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedTextColor);
    doc.text('CONFIDENTIAL WORK PRODUCT — FOR SETTLEMENT OR TRIAL PREPARATION ONLY', margin, pageHeight - 18);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
  }

  // Trigger Save / Download
  const cleanTitle = (caseMeta.claimantName || 'Legal_Strategy').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`${cleanTitle}_Strategy_Timeline_Brief.pdf`);
}
