import jsPDF from 'jspdf';

/** Format number with regular space as thousands separator (jsPDF can't render non-breaking spaces from toLocaleString) */
const formatNumber = (n: number): string => {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
import 'jspdf-autotable';

interface DevisPostSinistreData {
  numDevis: string;
  date: string;
  client: {
    nom: string;
    telephone: string;
    whatsapp: string;
    email: string;
    adresse: string;
    segment?: string;
  };
  prestations: Array<{ designation: string; montant: number; isMajoration?: boolean }>;
  details: {
    typeSinistre: string;
    niveau: string;
    surface: number;
    prixBase: number;
    coefficientMajoration: number;
    majorationMontant: number;
    desodorisation: number;
    rapportPhoto: number;
  };
  avanceActive?: boolean;
  avanceType?: 'pourcentage' | 'fixe';
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
}

// Données d'exemple (correspondant au devis original)
const devisPostSinistreData: DevisPostSinistreData = {
  numDevis: "DEV-2026-0045",
  date: "29 avril 2026",
  client: {
    nom: "M. Khalil Benali",
    telephone: "06 61 23 45 67",
    whatsapp: "06 61 23 45 67",
    email: "khalil.benali@email.ma",
    adresse: "Résidence Palmier, Appt 4B, Maarif, Casablanca"
  },
  prestations: [
    { designation: "Nettoyage post-sinistre — Dégât des eaux niveau moyen — 75 m²", montant: 2625 },
    { designation: "Majoration intervention sous 48h (x1,25)", montant: 656, isMajoration: true },
    { designation: "Désodorisation et désinfection complète", montant: 200 },
    { designation: "Rapport photographique PDF (avant / après par zone)", montant: 150 }
  ],
  details: {
    typeSinistre: "Dégât des eaux",
    niveau: "moyen",
    surface: 75,
    prixBase: 2625,
    coefficientMajoration: 1.25,
    majorationMontant: 656,
    desodorisation: 200,
    rapportPhoto: 150
  }
};

async function genererDevisPostSinistre(data: DevisPostSinistreData, logoBase64?: string, signatureBase64?: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const right = pageWidth - margin;
  const contentWidth = right - margin;
  const BLUE: [number, number, number] = [30, 58, 138];
  const TEXT: [number, number, number] = [15, 23, 42];
  const MUTED: [number, number, number] = [100, 116, 139];
  const BORDER: [number, number, number] = [226, 232, 240];
  let y = 24;

  // Header — Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', margin, y - 6, 38, 18);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Premium, tout simplement.', margin, y + 16);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text('Agence Ménage', margin, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Premium, tout simplement.', margin, y + 6);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Agence Ménage', margin, y);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Premium, tout simplement.', margin, y + 6);
  }

  // Right side - DEVIS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('DEVIS', right, y, { align: 'right' });
  
  doc.setFontSize(14);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text(`N° ${data.numDevis}`, right, y + 10, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Date : ${data.date}`, right, y + 17, { align: 'right' });
  doc.text('Valable 30 jours', right, y + 24, { align: 'right' });

  // Agency address
  y += 34;
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca", margin, y);
  doc.text('Tél : 06 64 22 67 90 | contact@agencemenage.ma', margin, y + 5);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('agencemenage.ma', margin, y + 10);

  y += 18;
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // ==================== INFORMATIONS CLIENT ====================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('INFORMATIONS CLIENT', margin, y);
  y += 3;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const clientInfo = [
    { label: data.client.segment === 'entreprise' ? "Raison sociale" : "Nom", value: data.client.nom },
    { label: "Téléphone", value: data.client.telephone },
    { label: "WhatsApp", value: data.client.whatsapp },
    { label: "Email", value: data.client.email },
    { label: "Adresse", value: data.client.adresse },
  ];

  doc.setFontSize(10);
  for (const info of clientInfo) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(info.label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`: ${info.value}`, margin + 40, y);
    y += 6.5;
  }
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text(`OBJET : Nettoyage post-sinistre — ${data.details.typeSinistre} — Intervention sous 48h`, margin, y);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin, y + 2.5, right, y + 2.5);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('DETAILS SINISTRE', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Type : ${data.details.typeSinistre}`, margin, y);
  doc.text(`Niveau : ${data.details.niveau}`, margin + 80, y);
  y += 6;
  doc.text(`Surface : ${data.details.surface} m²`, margin, y);
  doc.text(`Coeff. majoration : x${data.details.coefficientMajoration}`, margin + 80, y);
  y += 6;
  doc.text(`Majoration : ${formatNumber(data.details.majorationMontant)} DH`, margin, y);
  doc.text(`Désodorisation : ${formatNumber(data.details.desodorisation)} DH`, margin + 80, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('DÉTAIL DE LA PRESTATION', margin, y);
  y += 3;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin, y + 2.5, right, y + 2.5);
  y += 7;

  const rows = data.prestations.map((item) => ({
    label: item.designation,
    value: `${formatNumber(item.montant)} DH`,
  }));
  const totalHT = data.prestations.reduce((sum, item) => sum + item.montant, 0);

  const col1 = margin + 2;
  const col2 = right - 40;
  const tableWidth = right - margin;
  const rowHeight = 8;
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('Désignation', col1, y + 5.5);
  doc.text('Montant HT', right - 5, y + 5.5, { align: 'right' });
  y += rowHeight;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  rows.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(row.label, col1, y + 5.5, { maxWidth: col2 - col1 - 4 });
    doc.text(row.value, right - 5, y + 5.5, { align: 'right' });
    y += rowHeight;
  });

  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL HT', col1, y + 5.5);
  doc.text(`${formatNumber(totalHT)} DH`, right - 5, y + 5.5, { align: 'right' });
  y += rowHeight + 6;

  if (data.avanceActive) {
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y - 4, tableWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    const labelAvance = data.avanceType === 'pourcentage'
      ? `Avance requise (${data.avancePourcentage}%)`
      : 'Avance requise';
    doc.text(labelAvance, right - 65, y + 1.5);
    doc.text(`${formatNumber(data.avancePaiement || 0)} DH`, right - 5, y + 1.5, { align: 'right' });
    y += 10;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerThreshold = pageHeight - 40;

  // Check for page break before orange note
  if (y > footerThreshold - 15) {
    doc.addPage();
    y = 24;
  }

  // Note indicative orange
  doc.setFillColor(255, 247, 237); // Fond orange clair
  doc.roundedRect(margin, y, tableWidth, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(154, 52, 18); // Texte orange foncé / marron
  doc.text(
    "• Ce devis est indicatif. L'évaluation finale sera confirmée lors de la visite préalable. Validation manager obligatoire avant envoi.",
    margin + 4,
    y + 5,
    { maxWidth: tableWidth - 8 }
  );
  y += 18;

  // Check for page break before Notes section
  if (y > footerThreshold - 20) {
    doc.addPage();
    y = 24;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('NOTES ET CONDITIONS PARTICULIÈRES', margin, y);
  y += 2.5;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin, y, right, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('• Le rapport photographique est structuré zone par zone et livré en PDF sous en-tête Agence Ménage.', margin, y);
  y += 6.5;
  doc.text('• Ce document est directement utilisable pour votre déclaration auprès de votre assureur.', margin, y);
  y += 6.5;
  doc.text('• En cas d\'aggravation constatée lors de l\'intervention, un avenant de devis vous sera soumis avant poursuite.', margin, y);

  if (y > pageHeight - 110) {
    doc.addPage();
    y = 24;
  } else {
    y += 12;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("MESSAGE D'ACCOMPAGNEMENT", margin, y);
  y += 2.5;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin, y, right, y);
  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const msgParagraphs = [
    `Bonjour ${data.client.nom},`,
    '',
    "Nous avons bien pris note de votre situation et nous vous assurons de notre entière mobilisation pour intervenir dans les meilleurs délais.",
    '',
    "Le devis ci-joint reprend l'ensemble des prestations nécessaires à la remise en état de votre bien. Nous avons intégré le rapport photographique complet, fortement recommandé dans le cadre d'un dossier assurance, afin de documenter précisément les dégâts avant et après intervention.",
    '',
    'Notre équipe peut se déplacer pour une visite préalable dans les 24h si vous le souhaitez.',
    '',
    "Cordialement, L'équipe Agence Ménage — 06 64 22 67 90",
  ];
  for (const para of msgParagraphs) {
    if (para === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.text('Pour Agence Ménage :', margin, y);
  doc.text('Pour le client :', margin + 95, y);
  y += 4;
  if (signatureBase64) {
    try { doc.addImage(signatureBase64, 'PNG', margin, y, 55, 25); } catch { /* ignore */ }
  }
  y += 28;
  doc.setDrawColor(156, 163, 175);
  doc.line(margin, y, margin + 60, y);
  doc.line(margin + 95, y, margin + 155, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Nom et cachet', margin + 30, y, { align: 'center' });
  doc.text('Nom, date et signature précédée', margin + 95, y, { align: 'left' });
  doc.text('de "Bon pour accord"', margin + 95, y + 5, { align: 'left' });

  // Footer sur la dernière page uniquement
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    if (p === totalPages) {
      doc.setPage(p);
      const footerY = pageHeight - 22;
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, footerY, right, footerY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(
        "Agence Ménage — 36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca | 06 64 22 67 90 | contact@agencemenage.ma | agencemenage.ma",
        pageWidth / 2,
        footerY + 4,
        { maxWidth: contentWidth, align: 'center' }
      );
      doc.text(
        "Ce devis est établi sans TVA. Il est valable 30 jours à compter de sa date d'émission. Toute acceptation vaut engagement contractuel.",
        pageWidth / 2,
        footerY + 12,
        { maxWidth: contentWidth, align: 'center' }
      );
    }
  }

  return doc.output('blob');
}

// Utilitaire de conversion Blob -> Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Fonction pour générer le devis avec logo
async function genererDevisPostSinistreAvecLogo(logoUrl?: string): Promise<Blob | null> {
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await blobToBase64(logoBlob);
      return await genererDevisPostSinistre(devisPostSinistreData, logoBase64);
    } catch (error) {
      console.warn("Logo non trouvé, génération sans logo");
      return await genererDevisPostSinistre(devisPostSinistreData);
    }
  }
  return await genererDevisPostSinistre(devisPostSinistreData);
}

// ==================== EXPORT ====================
export { 
  genererDevisPostSinistre, 
  genererDevisPostSinistreAvecLogo, 
  devisPostSinistreData, 
  type DevisPostSinistreData 
};