import jsPDF from 'jspdf';

/** Format number with regular space as thousands separator (jsPDF can't render non-breaking spaces from toLocaleString) */
const formatNumber = (n: number): string => {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface DevisData {
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
  prestations: Array<{ designation: string; montant: number | string }>;
  surface: number;
  details: {
    terrasseIncluse: boolean;
    grattageVitres: { surface: number; prix: number };
    evacuationDechets: { poids: number; prix: number };
    cristallisationMarbre: { surface: number; prix: number };
  };
  avanceActive?: boolean;
  avanceType?: 'pourcentage' | 'fixe';
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
}

// Données d'exemple (correspondant au devis original)
const devisData: DevisData = {
  numDevis: "DEV-2026-0043",
  date: "29 avril 2026",
  client: {
    nom: "M. Khalil Benali",
    telephone: "06 61 23 45 67",
    whatsapp: "06 61 23 45 67",
    email: "khalil.benali@email.ma",
    adresse: "Résidence Palmier, Appt 4B, Maarif, Casablanca"
  },
  surface: 180,
  prestations: [
    { designation: "Nettoyage fin de chantier — 180 m2 (rénovation totale)", montant: 3240 },
    { designation: "Terrasse et rooftop (inclus dans forfait)", montant: 0 },
    { designation: "Grattage vitres profond — 20 m² vitrés", montant: 500 },
    { designation: "Ramassage et évacuation déchets — 200 kg", montant: 380 },
    { designation: "Cristallisation du marbre — 40 m2", montant: 1000 }
  ],
  details: {
    terrasseIncluse: true,
    grattageVitres: { surface: 20, prix: 500 },
    evacuationDechets: { poids: 200, prix: 380 },
    cristallisationMarbre: { surface: 40, prix: 1000 }
  }
};

async function genererDevis(data: DevisData, logoBase64?: string, signatureBase64?: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const BLUE = [29, 78, 216];
  const MUTED = [107, 114, 128];
  const TEXT = [31, 41, 55];
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const right = pageWidth - margin;
  const contentWidth = pageWidth - margin * 2;
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
  doc.line(margin, y, right, y);
  y += 12;

  // Objet
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Objet :', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nettoyage fin de chantier — Rénovation totale — ${data.surface} m2`, margin + 14, y);
  y += 10;

  // Informations client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('INFORMATIONS CLIENT', margin, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, y, right, y);
  y += 7;

  const infoRows = [
    [data.client.segment === 'entreprise' ? 'Raison sociale' : 'Nom / Prénom', data.client.nom],
    ['Téléphone', data.client.telephone],
    ['WhatsApp', data.client.whatsapp],
    ['Email', data.client.email],
    ['Adresse', data.client.adresse],
  ];
  const labelX = margin;
  const valueX = margin + 55;
  doc.setFontSize(10);
  infoRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(55, 65, 81);
    doc.text(value, valueX, y);
    y += 6.5;
  });

  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  const introText = [
    "Nous vous remercions pour votre demande et avons le plaisir de vous soumettre notre devis pour le nettoyage complet de votre bien en fin de chantier.",
    "",
    "Notre intervention comprend l'élimination de l'ensemble des résidus de travaux (poussières, résidus de peinture, traces de plâtre), le grattage des surfaces selon le niveau convenu, et la remise en état complète du bien pour sa réception ou sa mise en location.",
  ];
  for (const para of introText) {
    if (para === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }
  y += 6;

  // Table — DÉTAIL DE LA PRESTATION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('DÉTAIL DE LA PRESTATION', margin, y);
  y += 3;
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, right, y);
  y += 7;

  // Header row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('Désignation', margin + 2, y);
  doc.text('Montant HT', right - 2, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, right, y);
  y += 6;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  data.prestations.forEach((p) => {
    const montant = typeof p.montant === 'number'
      ? `${formatNumber(p.montant)} DH`
      : String(p.montant);
    doc.text(p.designation, margin + 2, y);
    doc.text(montant, right - 2, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.15);
    doc.line(margin, y, right, y);
    y += 6;
  });

  // TOTAL HT
  const totalHT = data.prestations.reduce((sum, p) => sum + (typeof p.montant === 'number' ? p.montant : 0), 0);
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y - 3, right, y - 3);
  doc.setFillColor(239, 246, 255);
  doc.rect(margin, y - 3, contentWidth, 11, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('TOTAL HT', right - 55, y + 3.5, { align: 'right' });
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setFontSize(13);
  doc.text(`${formatNumber(totalHT)} DH`, right - 2, y + 3.5, { align: 'right' });
  y += 14;

  if (data.avanceActive) {
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    const labelAvance = data.avanceType === 'pourcentage'
      ? `Avance requise (${data.avancePourcentage}%)`
      : 'Avance requise';
    doc.text(labelAvance, right - 65, y + 1.5);
    doc.text(`${formatNumber(data.avancePaiement || 0)} DH`, right - 2, y + 1.5, { align: 'right' });
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
  doc.roundedRect(margin, y, contentWidth, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(154, 52, 18); // Texte orange foncé
  doc.text(
    "• Ce devis a été établi sur la base des informations communiquées. Une visite préalable peut être organisée pour affiner l'estimation. Devis soumis à validation avant envoi.",
    margin + 4,
    y + 5,
    { maxWidth: contentWidth - 8 }
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
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, right, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('• La terrasse et le rooftop sont inclus dans la surface globale au même taux au m2.', margin, y);
  y += 6.5;
  doc.text('• La cristallisation du marbre sera réalisée après le nettoyage de base.', margin, y);
  y += 6.5;
  doc.text("• Délai d'intervention : 48 à 72h après acceptation du devis.", margin, y);
  y += 6.5;
  doc.text('• Minimum facturable : 1 500 DH HT.', margin, y);
  y += 10;

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
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, right, y);
  y += 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const msgLines = [
    `Bonjour ${data.client.nom},`,
    '',
    "Suite à votre demande de nettoyage post-chantier, nous vous adressons notre proposition détaillée.",
    "Notre équipe spécialisée est habituée aux interventions de fin de chantier et dispose de l'équipement",
    "nécessaire pour traiter tout type de surface.",
    '',
    "Le présent devis inclut l'ensemble des prestations discutées, notamment le grattage des vitres et la",
    "cristallisation du marbre en option premium.",
    '',
    "Nous restons disponibles pour planifier une visite préalable à votre convenance.",
    '',
    "Cordialement, L'équipe Agence Ménage — 06 64 22 67 90",
  ];
  for (const para of msgLines) {
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
      doc.setDrawColor(226, 232, 240);
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

// ==================== FONCTION D'UTILISATION ====================
// Charge le logo depuis un fichier et génère le devis
async function chargerLogoEtGenererDevis(): Promise<Blob | null> {
  // Pour charger un logo depuis un fichier local (environnement navigateur)
  // Cette fonction est à adapter selon votre environnement
  
  // Exemple avec fetch (pour un fichier public)
  try {
    const logoResponse = await fetch('/logo-entreprise.png');
    const logoBlob = await logoResponse.blob();
    const logoBase64 = await blobToBase64(logoBlob);
    return await genererDevis(devisData, logoBase64);
  } catch (error) {
    console.warn("Logo non trouvé, génération sans logo");
    return await genererDevis(devisData);
  }
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

// ==================== EXPORT ====================
export { genererDevis, chargerLogoEtGenererDevis, devisData, type DevisData };