import jsPDF from 'jspdf';

/** Format number with regular space as thousands separator (jsPDF can't render non-breaking spaces from toLocaleString) */
const formatNumber = (n: number): string => {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
import 'jspdf-autotable';

interface DevisMenageBureauxData {
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
  prestations: Array<{ designation: string; montant: number | string }>;
  details: {
    dureeParSession: number; // heures
    nbIntervenantes: number;
    nbPassagesParMois: number;
    reductionAbonnement: number; // en pourcentage
    prixBase: number;
    prixProduits: number;
  };
  avanceActive?: boolean;
  avanceType?: 'pourcentage' | 'fixe';
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
}

// Données d'exemple (correspondant au devis original)
const devisMenageBureauxData: DevisMenageBureauxData = {
  numDevis: "DEV-2026-0046",
  date: "29 avril 2026",
  client: {
    raisonSociale: "Immobilière Atlas SARL",
    interlocuteur: "Mme Nadia Chraibi — Directrice Administrative",
    telephone: "05 22 45 67 89",
    whatsapp: "06 72 34 56 78",
    email: "nadia.chraibi@atlas-immo.ma",
    adresse: "23 Rue Abou Inane, Quartier des Hôpitaux, Casablanca"
  },
  prestations: [
    { designation: "Ménage bureaux — 3h × 1 intervenante × 4 passages/mois (abonnement –10%)", montant: 648 },
    { designation: "Produits ménagers professionnels fournis par l'agence", montant: 90 }
  ],
  details: {
    dureeParSession: 3,
    nbIntervenantes: 1,
    nbPassagesParMois: 4,
    reductionAbonnement: 10,
    prixBase: 648,
    prixProduits: 90
  }
};

async function genererDevisMenageBureaux(data: DevisMenageBureauxData, logoBase64?: string, signatureBase64?: string): Promise<Blob> {
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

  const isAbonnement = data.details.nbPassagesParMois > 1;

  const formatAmount = (value: number | string) =>
    typeof value === 'number' ? `${formatNumber(value)} DH` : value;

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

  y += 30;
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
    { label: "Raison sociale", value: data.client.raisonSociale },
    { label: "Interlocuteur", value: data.client.interlocuteur },
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
  doc.text(
    `OBJET : Ménage bureaux — ${isAbonnement ? 'Abonnement mensuel' : 'Prestation ponctuelle'} — ${data.details.dureeParSession}h × ${data.details.nbIntervenantes} intervenante`,
    margin,
    y
  );
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin, y + 2.5, right, y + 2.5);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const introLines = doc.splitTextToSize(
    isAbonnement
      ? "Madame, Monsieur, nous vous remercions de l'intérêt que vous portez aux services d'Agence Ménage. Vous trouverez ci-dessous notre proposition d'abonnement pour l'entretien régulier de vos locaux. En optant pour l'abonnement, vous bénéficiez d'un tarif préférentiel et d'une intervenante stable, avec un planning établi à l'avance chaque mois."
      : "Madame, Monsieur, nous vous remercions de l'intérêt que vous portez aux services d'Agence Ménage. Vous trouverez ci-dessous notre proposition pour l'entretien ponctuel de vos locaux. Nous mettons à votre disposition une femme de ménage qualifiée pour garantir un environnement de travail propre, sain et agréable pour vos équipes et vos visiteurs.",
    contentWidth
  );
  doc.text(introLines, margin, y);
  y += introLines.length * 4.6 + 6;

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
    value: formatAmount(item.montant),
  }));
  const totalHT = data.prestations.reduce((sum, item) => {
    if (typeof item.montant === 'number') {
      return sum + item.montant;
    }
    return sum;
  }, 0);

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
    doc.text(`${formatAmount(data.avancePaiement || 0)}`, right - 5, y + 1.5, { align: 'right' });
    y += 10;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerThreshold = pageHeight - 40;

  // Check for page break before green note
  if (y > footerThreshold - 15) {
    doc.addPage();
    y = 24;
  }

  // Note abonnement verte
  if (isAbonnement) {
    const remiseTxt = data.details.reductionAbonnement > 0
      ? `Tarif abonnement appliqué (–${data.details.reductionAbonnement}%). `
      : '';
    doc.setFillColor(240, 253, 244); // Fond vert clair
    doc.roundedRect(margin, y, tableWidth, 12, 1, 1, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(21, 128, 61); // Texte vert foncé
    doc.text(
      `• ${remiseTxt}Planning adapté à vos horaires (matin ou soir). Remplacement assuré en cas d'absence.`,
      margin + 4,
      y + 5,
      { maxWidth: tableWidth - 8 }
    );
    y += 18;
  }

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
  const bureauxConditions = [
    "• Le ménage bureaux ne comprend ni produits ni matériel. Votre entreprise doit mettre à disposition tout le nécessaire avant son arrivée. Cette obligation ne s'applique pas si vous avez souscrit à une option matériel.",
    "• Une tolérance de 30 minutes de retard est accordée. Nos intervenantes se déplacent en transport en commun.",
    "• La femme de ménage effectue un tour de vos locaux à son arrivée. Tout dépassement de 30 minutes est soumis à validation de votre chargée de clientèle.",
    "• La femme de ménage n'utilise aucun appareil électroménager du client. L'aspirateur est la seule exception, sur accord explicite du client.",
    "• La désinsectisation n'est pas incluse dans la prestation.",
    ...(isAbonnement ? [
      "• L'abonnement est valable du 1er au 31 de chaque mois.",
      "• Le règlement s'effectue par virement bancaire avant le 20 du mois précédent.",
      "• Votre planning détaillé vous est adressé entre le 15 et le 18 du mois. Il indique le nombre exact de passages prévus et les dates correspondantes.",
      "• En cas de 5ème semaine sur votre jour habituel, ce passage est calculé automatiquement au prorata et inclus dans votre facture.",
      "• Nous faisons tout notre possible pour que ce soit la même intervenante à chaque passage. Cela ne peut pas être garanti dans tous les cas, notamment en cas d'absence ou d'imprévu.",
      "• Par respect des jours de fête, aucune intervention ne peut avoir lieu 1 jour avant et 2 jours après les trois fêtes religieuses suivantes : Aïd el Kébir, Aïd el Fitr et Mawlid Ennabawi. Si votre jour de passage habituel tombe dans cette période, votre chargée de clientèle vous contactera pour convenir ensemble d'un report ou d'une annulation.",
    ] : []),
  ];
  bureauxConditions.forEach((c, ci) => {
    const wrapped = doc.splitTextToSize(`${ci + 1}. ${c.replace(/^•\s*/, '')}`, contentWidth);
    if (y + wrapped.length * 5 > pageHeight - 28) { doc.addPage(); y = 24; }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 1.5;
  });

  if (y > pageHeight - 80) {
    doc.addPage();
    y = 24;
  } else {
    y += 8;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const msgLines = [
    `Bonjour ${data.client.interlocuteur},`,
    '',
    isAbonnement 
      ? "Suite à notre échange, nous vous adressons notre proposition pour l'entretien régulier de vos locaux."
      : "Suite à notre échange, nous vous adressons notre proposition pour l'entretien de vos locaux.",
    '',
    isAbonnement
      ? "L'abonnement mensuel vous permet de bénéficier d'un tarif préférentiel tout en garantissant une intervenante stable et formée à vos standards."
      : "Cette prestation comprend un nettoyage complet de vos espaces de travail par une intervenante professionnelle formée à nos standards de qualité.",
    '',
    "Nous nous adaptons entièrement à vos contraintes horaires et pouvons organiser une première visite de vos locaux à votre convenance.",
    '',
    "Dans l'attente de votre retour, L'équipe Agence Ménage — 05 22 20 02 39",
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
      const footerY = pageHeight - 27;
      doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.setLineWidth(0.4);
      doc.line(margin, footerY, right, footerY);
      
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(9);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text("Agence Ménage SARL — Groupe Agence PREMIUM Services", pageWidth / 2, footerY + 5.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("Bureau Casa : 36A Boulevard d'Anfa, 7ème étage  ·  Bureau Rabat : Avenue Hassan II, Centre commercial REDA porte G", pageWidth / 2, footerY + 10.5, { align: 'center' });
      doc.text("Email : mehdi@agencemenage.ma  ·  RC : 704771  ·  Patente : 35409085  ·  IF : 71002832  ·  ICE : 003854034000063", pageWidth / 2, footerY + 15, { align: 'center' });
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
async function genererDevisMenageBureauxAvecLogo(data: DevisMenageBureauxData, logoUrl?: string): Promise<Blob | null> {
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await blobToBase64(logoBlob);
      return await genererDevisMenageBureaux(data, logoBase64);
    } catch (error) {
      console.warn("Logo non trouvé, génération sans logo");
      return await genererDevisMenageBureaux(data);
    }
  }
  return await genererDevisMenageBureaux(data);
}

// ==================== EXPORT ====================
export { 
  genererDevisMenageBureaux, 
  genererDevisMenageBureauxAvecLogo, 
  devisMenageBureauxData, 
  type DevisMenageBureauxData 
};