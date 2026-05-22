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


export async function genererDevisPlacementFlexible(data: DevisPlacementFlexibleData, logoBase64?: string, signatureBase64?: string): Promise<Blob> {
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
      doc.addImage(logoBase64, 'PNG', margin, y - 6, 38, 18);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text('Premium, tout simplement.', margin, y + 16);
    } catch (e) {
      doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...TEXT);
      doc.text('Agence Ménage', margin, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      doc.text('Premium, tout simplement.', margin, y + 6);
    }
  } else {
    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...TEXT);
    doc.text('Agence Ménage', margin, y);
    doc.setFont('helvetica', 'italic').setFontSize(10).setTextColor(...MUTED);
    doc.text('Premium, tout simplement.', margin, y + 6);
  }

  doc.setFont('helvetica', 'bold').setFontSize(32).setTextColor(...BLUE);
  doc.text('DEVIS', right, y, { align: 'right' });
  
  doc.setFontSize(14).setTextColor(...TEXT);
  doc.text(`N° ${data.numDevis}`, right, y + 10, { align: 'right' });
  
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTED);
  doc.text(`Date : ${data.date}`,  right, y + 17, { align: 'right' });
  doc.text('Valable 30 jours',     right, y + 24, { align: 'right' });

  // Agency address
  y += 34;
  doc.setFontSize(9).setTextColor(...MUTED);
  doc.text("36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca", margin, y);
  doc.text('Tél : 06 64 22 67 90 | contact@agencemenage.ma', margin, y + 5);
  doc.setTextColor(...BLUE).text('agencemenage.ma', margin, y + 10);

  y += 18;
  doc.setDrawColor(...BLUE).setLineWidth(0.5).line(margin, y, right, y);
  y += 12;

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

  // ==================== MESSAGE D'ACCOMPAGNEMENT (Page 2) ====================
  doc.addPage();
  y = margin + 10;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("MESSAGE D'ACCOMPAGNEMENT", margin, y);
  y += 3;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, y, right, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  
  const msgLines = [
    `Bonjour ${data.client.interlocuteur},`,
    '',
    "Suite à notre échange, nous avons le plaisir de vous soumettre notre proposition pour la mise à disposition de personnel (Placement Flexible).",
    '',
    `Cette solution vous permet de bénéficier de ${data.details.nbIntervenantes} intervenante(s) qualifiée(s) pour un volume de ${data.details.heuresParMois}h par mois, avec une gestion administrative et RH entièrement prise en charge par Agence Ménage.`,
    '',
    "Nous restons à votre entière disposition pour finaliser les détails de cette collaboration et organiser le démarrage de la mission.",
    '',
    "Bien cordialement, L'équipe Agence Ménage — 06 64 22 67 90",
  ];
  for (const para of msgLines) {
    if (para === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }
  y += 20;

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.text('Pour Agence Ménage :', margin, y);
  doc.text('Pour le client :', margin + 100, y);
  y += 4;
  if (signatureBase64) {
    try { doc.addImage(signatureBase64, 'PNG', margin, y, 55, 25); } catch { /* ignore */ }
  }
  y += 28;
  doc.setDrawColor(156, 163, 175);
  doc.line(margin, y, margin + 65, y);
  doc.line(margin + 100, y, margin + 165, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Nom et cachet', margin, y);
  doc.text('Nom, date et signature précédée de "Bon pour accord"', margin + 100, y);

  // Footer sur toutes les pages
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footY = pageHeight - 25;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, footY, right, footY);
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const footerText = "Agence Ménage — 36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca | 06 64 22 67 90 | agencemenage.ma";
    doc.text(footerText, pageWidth/2, footY + 5, { align: 'center' });
    doc.text("Ce devis est valable 30 jours. Toute acceptation vaut engagement contractuel.", pageWidth/2, footY + 10, { align: 'center' });
  }

  return doc.output('blob');
}

export type { DevisPlacementFlexibleData };