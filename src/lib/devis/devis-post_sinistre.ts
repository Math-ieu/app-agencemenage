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
    interlocuteur?: string;
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
    { label: data.client.segment === 'entreprise' ? "Raison sociale" : "Nom", value: data.client.nom },
  ];
  if (data.client.segment === 'entreprise') {
    clientInfo.push({ label: "Interlocuteur", value: data.client.interlocuteur || '—' });
  }
  clientInfo.push(
    { label: "Téléphone", value: data.client.telephone },
    { label: "WhatsApp", value: data.client.whatsapp },
    { label: "Email", value: data.client.email },
    { label: "Adresse", value: data.client.adresse }
  );

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

  // ==================== INTRO ====================
  const isEntreprise = data.client.segment === 'entreprise';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  
  const introText = isEntreprise
    ? "Madame, Monsieur, suite à votre demande d'intervention post-sinistre, nous vous adressons notre estimation pour la remise en état de vos locaux. Notre équipe prend en charge l'ensemble de la prestation et se déplace avec le matériel adapté. Vous n'avez rien à préparer."
    : "Nous comprenons l'urgence de votre situation et mettons tout en œuvre pour intervenir dans les meilleurs délais. Notre équipe prend en charge l'intégralité de la remise en état de votre bien après sinistre : produits, matériel, équipes. Vous n'avez rien à préparer.";

  const introLines = doc.splitTextToSize(introText, contentWidth);
  doc.text(introLines, margin, y);
  y += introLines.length * 4.8 + 6;

  // ==================== DETAILS SINISTRE ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('DÉTAILS DU SINISTRE', margin, y);
  y += 4;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('Type de sinistre', margin, y);
  doc.text('Gravité / Niveau', margin + 60, y);
  doc.text('Superficie', margin + 120, y);
  y += 5;

  doc.setFont('helvetica', 'normal').setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(data.details.typeSinistre || '—', margin, y);
  doc.text(data.details.niveau || '—', margin + 60, y);
  doc.text(`${data.details.surface} m²`, margin + 120, y);
  y += 8;

  // ==================== PRESTATIONS INCLUSES ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('PRESTATIONS INCLUSES', margin, y);
  y += 4;
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  const inclusions = [
    "Évacuation des résidus et débris liés au sinistre",
    "Nettoyage et assèchement des surfaces affectées",
    "Désinfection des zones touchées",
    "Dépoussiérage et nettoyage des surfaces, murs et sols",
    "Nettoyage des vitres intérieures accessibles"
  ];

  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  inclusions.forEach(item => {
    doc.setFont('helvetica', 'bold').setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text("✓", margin + 2, y);
    doc.setFont('helvetica', 'normal').setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    const wrappedItem = doc.splitTextToSize(item, contentWidth - 8);
    doc.text(wrappedItem, margin + 8, y);
    y += Math.max(5, wrappedItem.length * 4.5) + 1.5;
  });
  y += 4;

  // Warning note below checklist
  doc.setFillColor(254, 243, 199); // Fond jaune/orange clair `#fef3c7`
  doc.roundedRect(margin, y, contentWidth, 8, 1, 1, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(146, 64, 14); // Texte orange foncé `#92400e`
  doc.text("Toute tâche non mentionnée dans cette liste n'est pas incluse dans la prestation.", margin + 4, y + 5.5);
  y += 14;

  // Page break to Page 2
  doc.addPage();
  y = 24;

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

  // TVA 20% + TOTAL TTC (entreprises uniquement)
  if (isEntreprise) {
    const tva = totalHT * 0.2;
    const totalTTC = totalHT + tva;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('TVA 20%', right - 45, y - 2, { align: 'right' });
    doc.text(`${formatNumber(tva)} DH`, right - 5, y - 2, { align: 'right' });
    y += 4;
    doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.rect(margin, y, tableWidth, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TTC', col1, y + 5.5);
    doc.text(`${formatNumber(totalTTC)} DH`, right - 5, y + 5.5, { align: 'right' });
    y += rowHeight + 6;
  }

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

  const suffix = isEntreprise ? " HT" : "";
  const optionsList = [
    { name: "Évacuation de mobilier ou d'objets endommagés", price: `+350 DH${suffix}` },
    { name: "Rapport photographique PDF (photos avant/après par zone — dossier assurance)", price: `+150 DH${suffix}` },
    { name: "Zone éloignée (Bouskoura, Dar Bouazza, Mohammédia...)", price: `+200 DH${suffix}` }
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
  const sinistreConditions = [
    "• Le présent devis est une estimation basée sur les informations communiquées. Une visite sur site est effectuée avant le démarrage. Si l'état réel dépasse l'estimation, un devis révisé est soumis avant toute intervention.",
    "• Notre équipe se déplace avec l'ensemble des produits et du matériel nécessaires. Le client n'a rien à préparer.",
    "• Un acompte de 50% du montant total est exigé avant le début de la prestation.",
    "• Le client doit être présent à la fin de la mission pour signer le PV de livraison. Le solde restant est payable sur place, en présence de l'équipe Agence Ménage.",
    "• Seules les zones et tâches mentionnées dans le devis sont prises en charge. Toute extension fait l'objet d'un avenant validé par le client.",
    "• La désinsectisation n'est pas incluse dans la prestation.",
  ];
  sinistreConditions.forEach((c, ci) => {
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
  const msgParagraphs = isEntreprise
    ? [
        "Madame, Monsieur,",
        '',
        "Merci pour votre demande d'intervention post-sinistre. Veuillez trouver ci-joint notre estimation pour la remise en état de vos locaux.",
        '',
        "Notre équipe prend en charge l'ensemble de la prestation et se déplace avec le matériel adapté. Une visite préalable gratuite sera planifiée pour valider les conditions d'intervention.",
        '',
        "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
      ]
    : [
        `Bonjour Madame / Monsieur ${data.client.nom},`,
        '',
        "Nous avons bien pris note de votre situation. Toute l'équipe Agence Ménage se mobilise pour intervenir dans les meilleurs délais.",
        '',
        "Vous trouverez ci-joint notre estimation pour la remise en état de votre bien. Une visite préalable sera organisée pour confirmer les conditions d'intervention. Notre équipe se déplace avec tout le matériel et les produits nécessaires : vous n'avez rien à préparer.",
        '',
        "Votre chargée de clientèle reste disponible à tout moment.",
        '',
        "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
      ];
  for (const para of msgParagraphs) {
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