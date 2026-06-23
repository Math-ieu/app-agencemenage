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
  avanceActive?: boolean;
  avanceType?: 'pourcentage' | 'fixe';
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
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

  y += 30;
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
    "Madame, Monsieur, nous vous remercions de l'intérêt que vous portez aux services d'Agence Ménage.",
    "Vous trouverez ci-dessous notre proposition pour la mise à disposition d'une intervenante dédiée à votre entreprise. Agence Ménage prend en charge l'intégralité du processus : sélection du profil, gestion administrative et sociale, couverture assurantielle et continuité en cas d'absence — sans les contraintes de gestion d'un employeur.",
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

  const totalHT = data.prestations.reduce((sum, p) => {
    const amt = typeof p.montant === 'number' ? p.montant : 0;
    return sum + amt;
  }, 0);
  doc.setDrawColor(...BLUE).setLineWidth(0.4).line(margin, y - 4, right, y - 4);
  doc.setFillColor(239, 246, 255).rect(margin, y - 4, contentWidth, 10, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12).text('TOTAL HT / MOIS', right - 60, y + 2, { align: 'right' });
  doc.setTextColor(...BLUE).text(`${formatNumber(totalHT)} DH`, right - 4, y + 2, { align: 'right' });
  y += 15;

  if (data.avanceActive) {
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    const labelAvance = data.avanceType === 'pourcentage'
      ? `Avance requise (${data.avancePourcentage}%)`
      : 'Avance requise';
    doc.text(labelAvance, right - 65, y + 1.5);
    doc.text(`${formatNumber(data.avancePaiement || 0)} DH`, right - 4, y + 1.5, { align: 'right' });
    y += 10;
  }

  // ==================== CONDITIONS & GARANTIES ====================
  if (y > pageHeight - 90) {
    doc.addPage();
    y = 24;
  }
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BLUE);
  doc.text('CONDITIONS DU SERVICE', margin, y);
  y += 3;
  doc.setDrawColor(229, 231, 235).setLineWidth(0.3).line(margin, y, right, y);
  y += 7;
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...TEXT);
  const placementConditions = [
    "• Démarrage sous 5 jours ouvrables après validation du devis, selon disponibilité des profils.",
    "• Une visite préalable gratuite de vos locaux est organisée avant le démarrage pour valider le profil et les consignes.",
    "• Période d'ajustement de 30 jours : vous pouvez affiner le profil ou les missions sans frais supplémentaires.",
    "• Engagement minimum : 3 mois — renouvelable par accord mutuel.",
    "• Paiement : facturation mensuelle — règlement en fin de mois.",
    "• Résiliation : préavis de 2 mois par écrit.",
  ];
  placementConditions.forEach((c, ci) => {
    const wrapped = doc.splitTextToSize(`${ci + 1}. ${c.replace(/^•\s*/, '')}`, contentWidth);
    if (y + wrapped.length * 5 > pageHeight - 28) { doc.addPage(); y = 24; }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 1.5;
  });

  // ==================== MESSAGE D'ACCOMPAGNEMENT ====================
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 24;
  } else {
    y += 8;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  
  const msgLines = [
    "Madame, Monsieur,",
    '',
    "Merci de faire appel à Agence Ménage. Veuillez trouver ci-joint notre proposition pour la mise à disposition d'une intervenante dédiée à votre entreprise.",
    '',
    `Cette solution vous permet de bénéficier de ${data.details.nbIntervenantes} intervenante(s) qualifiée(s) pour un volume de ${data.details.heuresParMois}h par mois, avec une gestion administrative et RH entièrement prise en charge par Agence Ménage. Notre service inclut CNSS, assurance Accident du Travail, RC professionnelle et contrat de travail légal.`,
    '',
    "Nous pouvons organiser une visite gratuite de vos locaux à votre convenance pour finaliser cette collaboration.",
    '',
    "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
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

  // Footer sur la dernière page uniquement
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    if (p === totalPages) {
      doc.setPage(p);
      const footY = pageHeight - 27;
      doc.setDrawColor(...BLUE);
      doc.setLineWidth(0.4);
      doc.line(margin, footY, right, footY);
      
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text("Agence Ménage SARL — Groupe Agence PREMIUM Services", pageWidth/2, footY + 5.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text("Bureau Casa : 36A Boulevard d'Anfa, 7ème étage  ·  Bureau Rabat : Avenue Hassan II, Centre commercial REDA porte G", pageWidth/2, footY + 10.5, { align: 'center' });
      doc.text("Email : mehdi@agencemenage.ma  ·  RC : 704771  ·  Patente : 35409085  ·  IF : 71002832  ·  ICE : 003854034000063", pageWidth/2, footY + 15, { align: 'center' });
    }
  }

  return doc.output('blob');
}

export type { DevisPlacementFlexibleData };