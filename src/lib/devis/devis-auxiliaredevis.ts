import jsPDF from 'jspdf';

/** Format number with regular space as thousands separator (jsPDF can't render non-breaking spaces from toLocaleString) */
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
  validite: string;
  objet: string;
  client: DevisAuxiliaireClient;
  prestations: Array<{ desc: string; montant: string | number }>;
  totalHT: string | number;
  message?: string;
}

async function genererDevisAuxiliaire(data: DevisAuxiliaireData, logoBase64?: string): Promise<Blob> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const BLUE = [29, 78, 216];
  const MUTED = [107, 114, 128];
  const TEXT = [31, 41, 55];
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const right = pageWidth - margin;
  let y = 24;

  // Header — Logo
  if (logoBase64) {
    try {
      pdf.addImage(logoBase64, 'PNG', margin, y - 6, 38, 18);
    } catch {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      pdf.text('Agence Ménage', margin, y);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(10);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text('Premium, tout simplement.', margin, y + 6);
    }
  } else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    pdf.text('Agence Ménage', margin, y);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text('Premium, tout simplement.', margin, y + 6);
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('DEVIS', right, y, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text(`N° ${data.numDevis}`, right, y + 8, { align: 'right' });
  pdf.text(`Date : ${data.date}`, right, y + 14, { align: 'right' });
  pdf.text(data.validite, right, y + 20, { align: 'right' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text("36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca", margin, y + 16);
  pdf.text('Tél : 06 64 22 67 90 | contact@agencemenage.ma', margin, y + 22);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('agencemenage.ma', margin, y + 28);

  y += 34;
  pdf.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, right, y);
  y += 7;

  pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Objet :', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.objet, margin + 14, y);
  y += 10;

  // ---- Bloc informations client ----
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('INFORMATIONS CLIENT', margin, y);
  y += 2.5;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, right, y);
  y += 7;

  const labels = ["Bénéficiaire", "Donneur d'ordre", "Téléphone", "Adresse"];
  const values = [
    data.client.beneficiaire,
    data.client.donneurOrdre,
    data.client.telephone,
    data.client.adresse,
  ];
  const labelX = margin;
  const valueX = margin + 55;
  pdf.setFontSize(10);
  for (let i = 0; i < labels.length; i++) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    pdf.text(labels[i], labelX, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    pdf.text(values[i], valueX, y);
    y += 6.5;
  }

  y += 3;

  // ---- Texte de remerciement ----
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'italic');
  pdf.text(
    "Nous vous remercions de la confiance que vous nous accordez pour l'accompagnement de votre proche. " +
    "Agence Ménage met à disposition des auxiliaires de vie formées, attentionnées et expérimentées, " +
    "sélectionnées pour leur sens du soin et leur bienveillance. Notre engagement est de garantir confort, " +
    "sécurité et qualité de vie au quotidien.",
    margin, y,
    { maxWidth: contentWidth, align: 'justify' }
  );
  y += 12;

  // ---- Tableau DÉTAIL DE LA PRESTATION ----
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('DÉTAIL DE LA PRESTATION', margin, y);
  y += 6;

  const colDescX = margin;
  pdf.setFillColor(243, 244, 246);
  pdf.rect(margin, y, contentWidth, 8, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(55, 65, 81);
  pdf.text('Désignation', colDescX + 4, y + 5.5);
  pdf.text('Montant HT', pageWidth - margin - 4, y + 5.5, { align: 'right' });
  y += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  data.prestations.forEach((ligne, idx) => {
    if (idx % 2 === 1) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, y - 4.5, contentWidth, 8, 'F');
    }
    pdf.text(ligne.desc, colDescX + 4, y, { maxWidth: 115 });
    const montant = typeof ligne.montant === 'number'
      ? `${formatNumber(ligne.montant)} DH`
      : ligne.montant;
    pdf.text(montant, pageWidth - margin - 4, y, { align: 'right' });
    y += 8;
  });

  // Ligne Total
  pdf.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y - 4, pageWidth - margin, y - 4);
  pdf.setFillColor(239, 246, 255);
  pdf.rect(margin, y - 4, contentWidth, 10, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  pdf.text('TOTAL HT', pageWidth - margin - 50, y + 2, { align: 'right' });
  const totalHT = typeof data.totalHT === 'number'
    ? `${formatNumber(data.totalHT)} DH`
    : data.totalHT;
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text(totalHT, pageWidth - margin - 4, y + 2, { align: 'right' });
  y += 12;

  // Note tarif longue durée
  pdf.setFillColor(236, 253, 245);
  pdf.rect(margin, y, contentWidth, 12, 'F');
  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(22, 101, 52);
  pdf.text(
    '✓ Pour les missions de plus d\'un mois, un tarif préférentiel de −10% est appliqué automatiquement. Contactez-nous pour un devis mission longue durée.',
    margin + 4,
    y + 7,
    { maxWidth: contentWidth - 8 }
  );
  y += 18;

  // ---- NOTES ET CONDITIONS PARTICULIÈRES ----
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('NOTES ET CONDITIONS PARTICULIÈRES', margin, y);
  y += 2.5;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, right, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const notes = [
    "• Intervenant(e) dédié(e) et stable sur toute la durée de la mission.",
    "• Remplacement garanti en cas d'absence de l'intervenante.",
    "• Un bilan hebdomadaire peut être transmis à la famille sur demande.",
    "• Discrétion et confidentialité assurées."
  ];
  for (const note of notes) {
    pdf.text(note, margin + 5, y);
    y += 5;
  }
  y += 7;

  // ---- MESSAGE D'ACCOMPAGNEMENT ----
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text("MESSAGE D'ACCOMPAGNEMENT", margin, y);
  y += 2.5;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, right, y);
  y += 6.5;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

  const defaultMessage = `Cher M. Benali,

Nous comprenons l’importance de trouver une personne de confiance pour accompagner votre mère au quotidien. Nous vous assurons de notre engagement à vous proposer une auxiliaire de vie attentive, professionnelle et stable tout au long de la mission.

Ce devis couvre 4 semaines d'accompagnement avec les prestations sélectionnées. N'hésitez pas à nous contacter pour ajuster la mission à l'évolution des besoins.

Avec toute notre disponibilité,
  L’équipe Agence Ménage — 06 64 22 67 90`;

  const message = data.message || defaultMessage;

  const messageLines = pdf.splitTextToSize(message, contentWidth);
  const lineHeight = 5; // mm par ligne
  const messageBlockHeight = messageLines.length * lineHeight;
  if (y + messageBlockHeight > 270) {
    pdf.addPage();
    y = margin;
  }
  pdf.text(messageLines, margin, y);
  y += messageBlockHeight + 12;

  // ---- Bloc signatures ----
  const sigBlockHeight = 25;
  if (y + sigBlockHeight > 270) {
    pdf.addPage();
    y = margin;
  }

  const sigLeftX = margin;
  const sigRightX = margin + 100;
  const sigY = y;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text("Pour Agence Ménage :", sigLeftX, sigY);
  pdf.line(sigLeftX, sigY + 5, sigLeftX + 75, sigY + 5);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text("Nom et cachet", sigLeftX, sigY + 9);

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text("Pour le client :", sigRightX, sigY);
  pdf.line(sigRightX, sigY + 5, sigRightX + 75, sigY + 5);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Nom, date et signature précédée de "Bon pour accord"', sigRightX, sigY + 9);

  y = sigY + 20;

  const totalPages = (pdf.internal as any).getNumberOfPages?.() ?? pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7.5);
    pdf.setTextColor(100);
    const footerLineY = pageHeight - 22;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, footerLineY, pageWidth - margin, footerLineY);
    
    pdf.text(
      "Agence Ménage — 36 Boulevard d’Anfa, Résidence Anafe A, 7ème étage, Casablanca | 06 64 22 67 90 | contact@agencemenage.ma | agencemenage.ma",
      pageWidth / 2,
      footerLineY + 4,
      { align: 'center', maxWidth: contentWidth }
    );
    pdf.text(
      "Ce devis est établi sans TVA. Il est valable 30 jours à compter de sa date d’émission. Toute acceptation vaut engagement contractuel.",
      pageWidth / 2,
      footerLineY + 12,
      { align: 'center', maxWidth: contentWidth }
    );
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

export {
  genererDevisAuxiliaire,
  genererDevisAuxiliaireAvecLogo,
  type DevisAuxiliaireData,
};