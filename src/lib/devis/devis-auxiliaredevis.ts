import jsPDF from 'jspdf';

/** Format number with regular space as thousands separator */
const formatNumber = (n: number): string => {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface DevisAuxiliaireClient {
  beneficiaire: string;
  donneurOrdre: string;
  telephone: string;
  adresse: string;
}

interface DevisAuxiliaireData {
  numDevis: string;
  date: string;
  objet: string;
  client: DevisAuxiliaireClient;
  prestations: Array<{ desc: string; montant: number }>;
  totalHT: number;
  validite?: string;
  message?: string;
  avanceActive?: boolean;
  avanceType?: 'pourcentage' | 'fixe';
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
}

async function genererDevisAuxiliaire(data: DevisAuxiliaireData, logoBase64?: string, signatureBase64?: string): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Colors
  const DARK_GREY = [31, 41, 55];
  const MEDIUM_GREY = [75, 85, 99];
  const LIGHT_GREY = [107, 114, 128];
  const BLUE = [37, 99, 235];
  const LIGHT_BLUE = [239, 246, 255];
  const GREEN_BG = [236, 253, 245];
  const GREEN_TEXT = [22, 101, 52];
  const BORDER_GREY = [229, 231, 235];
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = 24;

  // ==================== HEADER ====================
  // Logo area
  if (logoBase64) {
    try {
      pdf.addImage(logoBase64, 'PNG', margin, y - 6, 45, 20);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
      pdf.text('Premium, tout simplement.', margin, y + 18);
    } catch {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
      pdf.text('Agence Ménage', margin, y);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
      pdf.text('Premium, tout simplement.', margin, y + 6);
    }
  } else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
    pdf.text('Agence Ménage', margin, y);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
    pdf.text('Premium, tout simplement.', margin, y + 6);
  }

  // Right side - DEVIS
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(32);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('DEVIS', pageWidth - margin, y, { align: 'right' });
  
  pdf.setFontSize(14);
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  pdf.text(`N° ${data.numDevis}`, pageWidth - margin, y + 10, { align: 'right' });
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
  pdf.text(`Date : ${data.date}`, pageWidth - margin, y + 17, { align: 'right' });
  pdf.text('Valable 30 jours', pageWidth - margin, y + 24, { align: 'right' });
  
  // Agency address
  y += 34;
  pdf.setFontSize(9);
  pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
  pdf.text("36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca", margin, y);
  pdf.text('Tél : 06 64 22 67 90 | contact@agencemenage.ma', margin, y + 5);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('agencemenage.ma', margin, y + 10);

  y += 18;
  pdf.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ==================== OBJET ====================
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  pdf.text('Objet :', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.objet, margin + 18, y);
  y += 12;

  // ==================== INFORMATIONS CLIENT ====================
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('INFORMATIONS CLIENT', margin, y);
  y += 3;
  pdf.setDrawColor(BORDER_GREY[0], BORDER_GREY[1], BORDER_GREY[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;

  const clientLabels = ["Bénéficiaire", "Donneur d'ordre", "Téléphone", "Adresse"];
  const clientValues = [
    data.client.beneficiaire,
    data.client.donneurOrdre,
    data.client.telephone,
    data.client.adresse,
  ];
  
  pdf.setFontSize(10);
  for (let i = 0; i < clientLabels.length; i++) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
    pdf.text(clientLabels[i], margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(MEDIUM_GREY[0], MEDIUM_GREY[1], MEDIUM_GREY[2]);
    pdf.text(clientValues[i], margin + 50, y);
    y += 6.5;
  }
  y += 6;

  // ==================== TEXTE DE REMERCIEMENT ====================
  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  const remerciement = "Nous vous remercions de la confiance que vous nous accordez pour l'accompagnement de votre proche. Agence Ménage met à disposition des auxiliaires de vie formées, attentionnées et expérimentées, sélectionnées pour leur sens du soin et leur bienveillance. Notre engagement est de garantir confort, sécurité et qualité de vie au quotidien.";
  pdf.text(remerciement, margin, y, { maxWidth: contentWidth, align: 'justify' });
  y += 14;

  // ==================== TABLEAU DÉTAIL DE LA PRESTATION ====================
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('DÉTAIL DE LA PRESTATION', margin, y);
  y += 6;

  // Table header
  pdf.setFillColor(243, 244, 246);
  pdf.rect(margin, y, contentWidth, 9, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  pdf.text('Désignation', margin + 5, y + 6);
  pdf.text('Montant HT', pageWidth - margin - 5, y + 6, { align: 'right' });
  y += 9;

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  const descColWidth = contentWidth - 40;
  for (let i = 0; i < data.prestations.length; i++) {
    const prestation = data.prestations[i];
    const lines = pdf.splitTextToSize(prestation.desc, descColWidth);
    const rowHeight = Math.max(8, lines.length * 5 + 2);

    if (i % 2 === 1) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    
    pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
    pdf.text(lines, margin + 5, y + 5);
    pdf.text(`${formatNumber(prestation.montant)} DH`, pageWidth - margin - 5, y + 5, { align: 'right' });
    y += rowHeight;
  }

  // Total line
  pdf.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y + 1, pageWidth - margin, y + 1);
  pdf.setFillColor(LIGHT_BLUE[0], LIGHT_BLUE[1], LIGHT_BLUE[2]);
  pdf.rect(margin, y + 1, contentWidth, 10, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  pdf.text('TOTAL HT', pageWidth - margin - 55, y + 7);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text(`${formatNumber(data.totalHT)} DH`, pageWidth - margin - 5, y + 7, { align: 'right' });
  y += 17;

  if (data.avanceActive) {
    pdf.setFillColor(LIGHT_BLUE[0], LIGHT_BLUE[1], LIGHT_BLUE[2]);
    pdf.rect(margin, y - 4, contentWidth, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
    const labelAvance = data.avanceType === 'pourcentage'
      ? `Avance requise (${data.avancePourcentage}%)`
      : 'Avance requise';
    pdf.text(labelAvance, pageWidth - margin - 65, y + 1.5);
    pdf.text(`${formatNumber(data.avancePaiement || 0)} DH`, pageWidth - margin - 5, y + 1.5, { align: 'right' });
    y += 10;
  }

  // ==================== NOTE MISSION LONGUE DURÉE ====================
  const noteText = "Pour les missions de plus d'un mois, un tarif préférentiel de -10% est appliqué automatiquement. Contactez-nous pour un devis mission longue durée.";
  const noteLines = pdf.splitTextToSize(noteText, contentWidth - 15);
  const noteHeight = noteLines.length * 5 + 6;

  const footerThreshold = pageHeight - 40;

  // Check for page break before note
  if (y > footerThreshold - 15) {
    pdf.addPage();
    y = 24;
  }

  pdf.setFillColor(GREEN_BG[0], GREEN_BG[1], GREEN_BG[2]);
  pdf.roundedRect(margin, y, contentWidth, noteHeight, 1.5, 1.5, 'F');
  
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(GREEN_TEXT[0], GREEN_TEXT[1], GREEN_TEXT[2]);
  
  pdf.text('•', margin + 5, y + 5.5);
  pdf.text(noteLines, margin + 9, y + 5.5);
  y += noteHeight + 12;

  // Check for page break before Notes section
  if (y > footerThreshold - 20) {
    pdf.addPage();
    y = 24;
  }

  // ==================== NOTES ET CONDITIONS PARTICULIÈRES ====================
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('NOTES ET CONDITIONS PARTICULIÈRES', margin, y);
  y += 3;
  pdf.setDrawColor(BORDER_GREY[0], BORDER_GREY[1], BORDER_GREY[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  const notes = [
    "• Intervenant(e) dédié(e) et stable sur toute la durée de la mission.",
    "• Remplacement garanti en cas d'absence de l'intervenante.",
    "• Un bilan hebdomadaire peut être transmis à la famille sur demande.",
    "• Discrétion et confidentialité assurées."
  ];
  for (const note of notes) {
    pdf.text(note, margin + 5, y);
    y += 5.5;
  }
  y += 8;

  // ==================== MESSAGE D'ACCOMPAGNEMENT ====================
  if (y > pageHeight - 110) {
    pdf.addPage();
    y = 24;
  } else {
    y += 12;
  }
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text("MESSAGE D'ACCOMPAGNEMENT", margin, y);
  y += 3;
  pdf.setDrawColor(BORDER_GREY[0], BORDER_GREY[1], BORDER_GREY[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  
  const message = data.message || `Bonjour ${data.client.donneurOrdre},

Nous comprenons l'importance de trouver une personne de confiance pour accompagner votre mère au quotidien. Nous vous assurons de notre engagement à vous proposer une auxiliaire de vie attentive, professionnelle et stable tout au long de la mission.

Ce devis couvre 4 semaines d'accompagnement avec les prestations sélectionnées. N'hésitez pas à nous contacter pour ajuster la mission à l'évolution des besoins.

Avec toute notre disponibilité,
L'équipe Agence Ménage — 06 64 22 67 90`;

  const messageLines = pdf.splitTextToSize(message, contentWidth);
  const messageHeight = messageLines.length * 5;
  
  pdf.text(messageLines, margin, y);
  y += messageHeight + 12;

  // ==================== SIGNATURES ====================
  const sigY = y;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  pdf.text("Pour Agence Ménage :", margin, sigY);
  if (signatureBase64) {
    try { pdf.addImage(signatureBase64, 'PNG', margin, sigY + 3, 55, 25); } catch { /* ignore */ }
  }
  pdf.line(margin, sigY + 31, margin + 80, sigY + 31);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
  pdf.text("Nom et cachet", margin, sigY + 35);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  pdf.text("Pour le client :", margin + 110, sigY);
  pdf.line(margin + 110, sigY + 31, margin + 190, sigY + 31);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
  pdf.text('Nom, date et signature précédée de "Bon pour accord"', margin + 110, sigY + 35);

  y = sigY + 45;

  // ==================== FOOTER (last page only) ====================
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    if (i === pageCount) {
      pdf.setPage(i);
      const footerY = pageHeight - 30;
      
      pdf.setDrawColor(BORDER_GREY[0], BORDER_GREY[1], BORDER_GREY[2]);
      pdf.setLineWidth(0.3);
      pdf.line(margin, footerY, pageWidth - margin, footerY);
      
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
      
      const footerText1 = "Agence Ménage — 36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca | 06 64 22 67 90 | contact@agencemenage.ma | agencemenage.ma";
      pdf.text(footerText1, pageWidth / 2, footerY + 4, { align: 'center', maxWidth: contentWidth });
      
      const footerText2 = "Ce devis est établi sans TVA. Il est valable 30 jours à compter de sa date d'émission. Toute acceptation vaut engagement contractuel.";
      pdf.text(footerText2, pageWidth / 2, footerY + 11, { align: 'center', maxWidth: contentWidth });
    }
  }

  return pdf.output('blob');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function genererDevisAuxiliaireAvecLogo(data: DevisAuxiliaireData, logoUrl?: string): Promise<Blob> {
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await blobToBase64(logoBlob);
      return await genererDevisAuxiliaire(data, logoBase64);
    } catch {
      return await genererDevisAuxiliaire(data);
    }
  }
  return await genererDevisAuxiliaire(data);
}

// Exemple d'utilisation avec les données du devis original
const exempleDevisData: DevisAuxiliaireData = {
  numDevis: "DEV-2024-001",
  date: "15/05/2026",
  objet: "Auxiliaire de vie — Accompagnement journée — Mission 4 semaines",
  client: {
    beneficiaire: "Mme Fatima Benali (mère de M. Khalil Benali)",
    donneurOrdre: "M. Khalil Benali",
    telephone: "06 61 23 45 67",
    adresse: "123 Avenue des FAR, Casablanca"
  },
  prestations: [
    { desc: "Accompagnement journée (8h/j) — 5 j/semaine × 4 semaines (20 jours)", montant: 4800 },
    { desc: "Aide à la toilette — 20 jours", montant: 1000 },
    { desc: "Préparation des repas — 20 jours", montant: 800 }
  ],
  totalHT: 6600
};

export {
  genererDevisAuxiliaire,
  genererDevisAuxiliaireAvecLogo,
  type DevisAuxiliaireData,
  exempleDevisData
};