import jsPDF from 'jspdf';

/** Format number with regular space as thousands separator (jsPDF can't render non-breaking spaces from toLocaleString) */
const formatNumber = (n: number): string => {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface DevisPlacementFlexibleData {
  numDevis: string;
  date: string;
  client: {
    raisonSociale: string;
    interlocuteur: string;
    telephone: string;
    whatsapp: string;
    email: string;
    adresse: string;
  };
  prestations: Array<{
    designation: string;
    montant: number | string;
    isReduction?: boolean;
  }>;
  details: {
    nbIntervenantes: number;
    heuresParJour: number;
    joursParSemaine: number;
    heuresParMois: number;
    prixBase: number;
    reduction: number;
    reductionPourcentage: number;
    engagementMois: number;
    tenueTravail: number;
    prixApresReduction: number;
  };
}


export async function genererDevisPlacementFlexible(data: DevisPlacementFlexibleData, logoBase64?: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const BLUE   = [29,  78,  216] as const;
  const MUTED  = [107, 114, 128] as const;
  const TEXT   = [31,  41,  55]  as const;
  const LIGHT  = [55,  65,  81]  as const;


  const pageWidth    = doc.internal.pageSize.getWidth();
  const pageHeight   = doc.internal.pageSize.getHeight();
  const margin       = 20;
  const right        = pageWidth - margin;
  const contentWidth = pageWidth - margin * 2;
  const LINE_H       = 5.5;

  let y = 24;

  // Header
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, y - 12, 28, 28);
      y += 10;
    } catch (e) {
      doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...TEXT);
      doc.text('Agence Ménage', margin, y);
    }
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...TEXT);
    doc.text('Agence Ménage', margin, y);
    doc.setFont('helvetica', 'italic').setFontSize(10).setTextColor(...MUTED);
    doc.text('Premium, tout simplement.', margin, y + 6);
  }

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...BLUE);
  doc.text('DEVIS', right, y, { align: 'right' });

  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
  doc.text(`N° ${data.numDevis}`, right, y + 8,  { align: 'right' });
  doc.text(`Date : ${data.date}`,  right, y + 14, { align: 'right' });
  doc.text('Valable 30 jours',     right, y + 20, { align: 'right' });

  doc.setFontSize(9.5).setTextColor(...MUTED);
  doc.text("36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca", margin, y + 16);
  doc.text('Tél : 06 64 22 67 90 | contact@agencemenage.ma', margin, y + 22);
  doc.setTextColor(...BLUE).text('agencemenage.ma', margin, y + 28);

  y += 36;
  doc.setDrawColor(...BLUE).setLineWidth(0.4).line(margin, y, right, y);
  y += 8;

  // Objet
  doc.setTextColor(...TEXT).setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Objet :', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Mise à disposition de personnel (Placement Flexible)', margin + 14, y);
  y += 12;

  // Client
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BLUE);
  doc.text('INFORMATIONS CLIENT', margin, y);
  y += 3;
  doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(margin, y, right, y);
  y += 7;

  const infoRows: [string, string][] = [
    ['Raison Sociale', data.client.raisonSociale],
    ['Interlocuteur',  data.client.interlocuteur],
    ['Téléphone',       data.client.telephone],
    ['WhatsApp',        data.client.whatsapp],
    ['Email',           data.client.email],
    ['Adresse',         data.client.adresse],
  ];
  const valueX = margin + 55;
  doc.setFontSize(10);
  for (const [label, value] of infoRows) {
    doc.setFont('helvetica', 'bold').setTextColor(...TEXT).text(label, margin, y);
    doc.setFont('helvetica', 'normal').setTextColor(...LIGHT);
    const wrapped = doc.splitTextToSize(value || '—', contentWidth - 55);
    doc.text(wrapped, valueX, y);
    y += Math.max(LINE_H, wrapped.length * LINE_H);
  }
  y += 6;

  // Intro
  const intro = [
    "Nous vous remercions de l'intérêt porté à nos services de placement flexible.",
    "Cette formule vous permet de disposer de personnel qualifié avec une gestion administrative simplifiée.",
  ];
  doc.setFontSize(10).setTextColor(...LIGHT);
  for (const para of intro) {
    const lines = doc.splitTextToSize(para, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * LINE_H;
  }
  y += 8;

  // Table
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BLUE);
  doc.text('DÉTAIL DE LA PRESTATION', margin, y);
  y += 7;

  doc.setFillColor(243, 244, 246).rect(margin, y, contentWidth, 8, 'F');
  doc.setFontSize(10).setTextColor(...LIGHT).text('Désignation', margin + 4, y + 5.5);
  doc.text('Montant HT / mois', right - 4, y + 5.5, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal').setTextColor(...TEXT);
  data.prestations.forEach((p, idx) => {
    const desLines = doc.splitTextToSize(p.designation, contentWidth - 50);
    const h = Math.max(8, desLines.length * LINE_H + 2);
    if (idx % 2 === 1) doc.setFillColor(249, 250, 251).rect(margin, y - 4.5, contentWidth, h, 'F');
    doc.text(desLines, margin + 4, y);
    const m = typeof p.montant === 'number' ? `${formatNumber(p.montant)} DH` : p.montant;
    doc.text(m, right - 4, y, { align: 'right' });
    y += h;
  });

  const totalHT = data.details.prixApresReduction;
  doc.setDrawColor(...BLUE).setLineWidth(0.4).line(margin, y - 4, right, y - 4);
  doc.setFillColor(239, 246, 255).rect(margin, y - 4, contentWidth, 10, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12).text('TOTAL HT / MOIS', right - 60, y + 2, { align: 'right' });
  doc.setTextColor(...BLUE).text(`${formatNumber(totalHT)} DH`, right - 4, y + 2, { align: 'right' });
  y += 15;

  // Footer / Signatures
  const footerY = pageHeight - 20;
  doc.setFontSize(8).setTextColor(...MUTED);
  doc.text("Agence Ménage — Casablanca | 06 64 22 67 90 | agencemenage.ma", pageWidth/2, footerY, { align: 'center' });

  return doc.output('blob');
}

export type { DevisPlacementFlexibleData };