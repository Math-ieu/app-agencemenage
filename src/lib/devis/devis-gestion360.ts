import jsPDF from 'jspdf';

/** Format number with regular space as thousands separator (jsPDF can't render non-breaking spaces from toLocaleString) */
const formatNumber = (n: number): string => {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
import 'jspdf-autotable';

interface DevisGestion360Data {
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
  prestations: Array<{ designation: string; montant: number | string; isReduction?: boolean }>;
  details: {
    nbIntervenantes: number;
    heuresParJour: number;
    joursParSemaine: number;
    heuresParMois: number;
    prixBase: number;
    reduction: number;
    engagementMois: number;
  };
  avanceActive?: boolean;
  avanceType?: 'pourcentage' | 'fixe';
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
  ferie?: boolean;
}

// Données d'exemple (correspondant au devis original)
const devisGestion360Data: DevisGestion360Data = {
  numDevis: "DEV-2026-0048",
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
    { designation: "Gestion 360° — 3 intervenantes — 4h/j × 6j/sem (312h/mois)", montant: 14040 },
    { designation: "Réduction engagement 6 mois (-5%)", montant: -702, isReduction: true },
    { designation: "Tenues de travail incluses (3 personnes)", montant: "Inclus" },
    { designation: "Supervision qualité incluse (≥3 personnes)", montant: "Inclus" }
  ],
  details: {
    nbIntervenantes: 3,
    heuresParJour: 4,
    joursParSemaine: 6,
    heuresParMois: 312,
    prixBase: 14040,
    reduction: 702,
    engagementMois: 6
  }
};

async function genererDevisGestion360(data: DevisGestion360Data, logoBase64?: string, signatureBase64?: string): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const right = pageWidth - margin;
  const contentWidth = right - margin;
  const tableWidth = contentWidth;
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerThreshold = pageHeight - 40;
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
    `OBJET : Gestion 360° All Inclusive — ${data.details.nbIntervenantes} intervenantes — Engagement ${data.details.engagementMois} mois`,
    margin,
    y
  );
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin, y + 2.5, right, y + 2.5);
  y += 10;

  // ==================== 1. INTRO & 2. GARANTIES (Page 1) ====================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const introTxt = "Madame, Monsieur, nous vous remercions de l'intérêt que vous portez aux services d'Agence Ménage. Vous trouverez ci-dessous notre proposition Gestion 360°, notre offre clé en main. Avec Gestion 360°, vous n'achetez pas du ménage. Vous achetez un standard de propreté garanti. Agence Ménage pilote l'intégralité de la prestation : équipes, méthodes, produits, supervision et reporting. Vous n'avez rien à gérer.";
  
  const introLines = doc.splitTextToSize(introTxt, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 4.8 + 8;

  // Title for Guarantees
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("CE QUE VOTRE TARIF INCLUT QUE NOS CONCURRENTS N'OFFRENT PAS", margin, y);
  y += 4;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  const guarantees = [
    { label: "Déclaration CNSS obligatoire", desc: "Personnel déclaré et couvert. Vous êtes à l'abri de tout risque juridique." },
    { label: "Assurance Accident du Travail", desc: "Tout incident sur site est couvert. Aucune responsabilité pour votre entreprise." },
    { label: "Assurance RC Professionnelle", desc: "Dommages accidentels causés par nos équipes — intégralement couverts." },
    { label: "Contrat de travail légal (loi 19-12)", desc: "Cadre juridique clair, conforme à la réglementation marocaine." }
  ];

  // Draw table header
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Garantie", margin + 4, y + 5.5);
  doc.text("Ce que ça signifie pour vous", margin + 55, y + 5.5);
  y += 8;

  // Draw rows
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  guarantees.forEach((g, idx) => {
    const wrappedLabel = doc.splitTextToSize(g.label, 48);
    const wrappedDesc = doc.splitTextToSize(g.desc, contentWidth - 56);
    const h = Math.max(wrappedLabel.length * 4.5, wrappedDesc.length * 4.5) + 4;
    
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentWidth, h, 'F');
    }
    
    // Draw left col
    doc.setFont('helvetica', 'bold').setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(wrappedLabel, margin + 4, y + 4);
    
    // Draw right col
    doc.setFont('helvetica', 'normal').setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(wrappedDesc, margin + 55, y + 4);
    
    y += h;
  });

  // Page break to Page 2
  doc.addPage();
  y = 24;

  // ==================== 3. PRESTATION COMPRISE (Page 2) ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("CE QUE COMPREND LA PRESTATION", margin, y);
  y += 4;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  const inclusionItems = [
    "Dimensionnement et organisation des équipes selon vos locaux",
    "Planification des interventions adaptée à votre activité",
    "Fourniture des produits ménagers et du matériel nécessaire",
    "Tenues professionnelles fournies — incluses dans le forfait",
    "Supervision sur site selon le volume de l'équipe",
    "Check-lists qualité et inspections régulières",
    "Remplacement le jour même en cas d'absence",
    "Rapport mensuel d'activité transmis avant le 5 de chaque mois",
    "Traitement de toute réclamation sous 24h avec plan d'action",
    "Point mensuel avec votre chargée de clientèle dédiée"
  ];

  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  inclusionItems.forEach(item => {
    doc.setFont('helvetica', 'bold').setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text("✓", margin + 2, y);
    doc.setFont('helvetica', 'normal').setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    const wrappedItem = doc.splitTextToSize(item, contentWidth - 8);
    doc.text(wrappedItem, margin + 8, y);
    y += Math.max(5, wrappedItem.length * 4.5) + 1.5;
  });
  y += 6;

  // ==================== 4. NOS ENGAGEMENTS (SLA) ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("NOS ENGAGEMENTS (SLA)", margin, y);
  y += 4;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  const slaItems = [
    { label: "Remplacement en cas d'absence", val: "Le jour même" },
    { label: "Traitement des réclamations", val: "Sous 24h avec plan d'action" },
    { label: "Rapport mensuel d'activité", val: "Avant le 5 de chaque mois" },
    { label: "Visite préalable des locaux", val: "Gratuite — avant tout démarrage" }
  ];

  // Draw SLA header
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Engagement", margin + 4, y + 5.5);
  doc.text("Délai / Modalité", margin + 75, y + 5.5);
  y += 8;

  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  slaItems.forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentWidth, 8, 'F');
    }
    doc.setFont('helvetica', 'bold').setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(item.label, margin + 4, y + 5.5);
    doc.setFont('helvetica', 'normal').setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(item.val, margin + 75, y + 5.5);
    y += 8;
  });
  y += 8;

  // ==================== GRILLE JOURS FACTURÉS ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('TARIFICATION', margin, y);
  y += 4;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  // Table header
  const col1Width = contentWidth * 0.5;
  const col2Width = contentWidth * 0.5;
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.rect(margin, y, col1Width, 8, 'F');
  doc.rect(margin + col1Width, y, col2Width, 8, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(255, 255, 255);
  doc.text('Jours / semaine', margin + 4, y + 5.5);
  doc.text('Jours facturés / mois', margin + col1Width + 4, y + 5.5);
  y += 8;

  // Table rows
  const joursRows: [string, string][] = [
    ['5 jours / semaine', '22 jours / mois'],
    ['6 jours / semaine', '26 jours / mois'],
    ['7 jours / semaine', '30 jours / mois'],
  ];
  doc.setFont('helvetica', 'normal').setFontSize(9.5);
  joursRows.forEach((jr, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentWidth, 8, 'F');
    }
    doc.setFont('helvetica', 'bold').setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(jr[0], margin + 4, y + 5.5);
    doc.setFont('helvetica', 'normal').setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(jr[1], margin + col1Width + 4, y + 5.5);
    y += 8;
  });

  // Formula note
  y += 3;
  doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Formule de calcul : Heures/jour × Jours/mois × 45 DH × Nb personnes × (1 – remise)', margin, y);
  y += 10;

  // ==================== DÉTAIL DE LA PRESTATION ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(4, 80, 59);
  doc.text('DÉTAIL DE LA PRESTATION', margin, y);
  y += 7;

  // Header row
  doc.setFillColor(4, 80, 59);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('Désignation', margin + 4, y + 5.5);
  doc.text('Montant', right - 4, y + 5.5, { align: 'right' });
  y += 8;

  // Prepare table rows
  const cleanForfait = Math.round(data.details.prixBase / (data.ferie ? 1.20 : 1));
  const joursParSem = data.details.joursParSemaine || 5;
  const joursParMois = joursParSem === 5 ? 22 : joursParSem === 6 ? 26 : joursParSem === 7 ? 30 : joursParSem * 4;
  const superv = data.details.nbIntervenantes < 3 ? 800 : 0;
  const ferieAmount = Math.round((cleanForfait + superv) * 0.20);
  const discountPct = data.details.prixBase > 0 ? (data.details.reduction / data.details.prixBase) : 0;
  const remiseAmount = Math.round((cleanForfait + superv) * (data.ferie ? 1.2 : 1) * discountPct);

  const rows: Array<{ label: string; value: string; isItalic?: boolean; isReduction?: boolean; isBold?: boolean }> = [];

  const persLabel = data.details.nbIntervenantes > 1 ? "personnes" : "personne";
  rows.push({
    label: `Forfait mensuel — ${data.details.nbIntervenantes} ${persLabel} × ${data.details.heuresParJour}h/j × ${joursParMois} j/mois × 45 DH`,
    value: `${formatNumber(cleanForfait)} DH HT`
  });

  if (superv > 0) {
    rows.push({
      label: `Supervision (${data.details.nbIntervenantes} personnes < 3)`,
      value: `+${formatNumber(superv)} DH HT`
    });
  }

  if (data.ferie) {
    rows.push({
      label: "Couverture jours fériés (+20%)",
      value: `+${formatNumber(ferieAmount)} DH HT`,
      isItalic: true
    });
  }

  if (discountPct > 0) {
    const engLabel = data.details.engagementMois > 0 ? ` engagement ${data.details.engagementMois} mois` : "";
    rows.push({
      label: `Remise${engLabel} -${Math.round(discountPct * 100)}%`,
      value: `-${formatNumber(remiseAmount)} DH HT`,
      isReduction: true
    });
  }

  // Draw rows
  rows.forEach((r, idx) => {
    // Alternating background
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentWidth, 8, 'F');
    }

    if (r.isItalic) {
      doc.setFont('helvetica', 'italic');
    } else if (r.isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }

    doc.setFontSize(9.5).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(r.label, margin + 4, y + 5.5);
    doc.text(r.value, right - 4, y + 5.5, { align: 'right' });
    y += 8;
  });

  // Calculate totals
  const totalHT = cleanForfait + superv + (data.ferie ? ferieAmount : 0) - remiseAmount;

  // Draw footer
  doc.setFillColor(30, 41, 59); // Slate `#1e293b`
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(255, 255, 255);
  doc.text('TOTAL MENSUEL HT', margin + 4, y + 6);
  doc.text(`${formatNumber(totalHT)} DH HT`, right - 4, y + 6, { align: 'right' });
  y += 15;



  // Options table
  if (y > footerThreshold - 30) {
    doc.addPage();
    y = 24;
  } else {
    y += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('OPTIONS', margin, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, right, y);
  y += 5;

  // Header row
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, tableWidth, 8, 'F');
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'bold');
  doc.text('Option', margin + 4, y + 5.5);
  doc.text('Prix', right - 4, y + 5.5, { align: 'right' });
  y += 11;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

  const optionsList = [
    { name: "Couverture jours fériés", price: "+20% sur le forfait mensuel" },
    { name: "Audit qualité supplémentaire (visite inopinée + compte rendu)", price: "Défini par le commercial" }
  ];

  optionsList.forEach((opt, idx) => {
    const wrappedName = doc.splitTextToSize(opt.name, tableWidth - 45);
    const rowHeight = Math.max(8, wrappedName.length * 5);

    if (y + rowHeight > pageHeight - 28) {
      doc.addPage();
      y = 24;
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y, tableWidth, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(55, 65, 81);
      doc.text('Option', margin + 4, y + 5.5);
      doc.text('Prix', right - 4, y + 5.5, { align: 'right' });
      y += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y - 4, tableWidth, rowHeight, 'F');
    }

    doc.text(wrappedName, margin + 4, y + 1);
    doc.text(opt.price, right - 4, y + 1, { align: 'right' });
    y += rowHeight;
  });
  y += 6;

  // Check for page break before Notes section
  if (y > footerThreshold - 20) {
    doc.addPage();
    y = 24;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('CONDITIONS DU SERVICE', margin, y);
  y += 2.5;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin, y, right, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const gestion360Conditions = [
    "• Démarrage sous 5 à 10 jours ouvrables après validation, selon la taille de l'équipe.",
    "• Une visite préalable gratuite de vos locaux est obligatoire avant le démarrage.",
    "• Période de rodage de 30 jours : période d'ajustement mutuel. Aucune pénalité applicable durant cette phase.",
    "• Engagement minimum : 3 mois — renouvelable par accord mutuel.",
    "• Paiement : facturation mensuelle — règlement en fin de mois.",
    "• Résiliation : préavis de 2 mois par écrit.",
  ];
  gestion360Conditions.forEach((c, ci) => {
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
    "Madame, Monsieur,",
    '',
    "Merci de faire appel à Agence Ménage. Veuillez trouver ci-joint notre proposition Gestion 360°, notre offre clé en main pour l'entretien de vos locaux.",
    '',
    `Ce dispositif de ${data.details.nbIntervenantes} intervenante(s) couvre l'ensemble de vos besoins en propreté sur ${data.details.joursParSemaine} jours par semaine. Avec Gestion 360°, vous bénéficiez d'une équipe supervisée et remplacée le jour même en cas d'absence. Zéro gestion pour vous.`,
    '',
    "Nous pouvons organiser une visite gratuite de vos locaux pour établir un plan de nettoyage sur mesure.",
    '',
    "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
  ];
  for (const para of msgLines) {
    if (para === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, contentWidth);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5;
  }
  // Check for page break before signatures block
  if (y > footerThreshold - 40) {
    doc.addPage();
    y = 24;
  } else {
    y += 16;
  }

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
async function genererDevisGestion360AvecLogo(logoUrl?: string): Promise<Blob | null> {
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await blobToBase64(logoBlob);
      return await genererDevisGestion360(devisGestion360Data, logoBase64);
    } catch (error) {
      console.warn("Logo non trouvé, génération sans logo");
      return await genererDevisGestion360(devisGestion360Data);
    }
  }
  return await genererDevisGestion360(devisGestion360Data);
}

// ==================== EXPORT ====================
export { 
  genererDevisGestion360, 
  genererDevisGestion360AvecLogo, 
  devisGestion360Data, 
  type DevisGestion360Data 
};