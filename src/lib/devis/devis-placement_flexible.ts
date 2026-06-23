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
  ferie?: boolean;
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

  // ==================== 1. INTRO & 2. GARANTIES (Page 1) ====================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...LIGHT);
  const introTxt1 = "Madame, Monsieur, nous vous remercions de l'intérêt que vous portez aux services d'Agence Ménage.";
  const introTxt2 = "Vous trouverez ci-dessous notre proposition pour la mise à disposition d'une intervenante dédiée à votre entreprise. Agence Ménage prend en charge l'intégralité du processus : sélection du profil, gestion administrative et sociale, couverture assurantielle et continuité en cas d'absence. Vous bénéficiez d'une intervenante qualifiée sans les contraintes de gestion d'un employeur.";
  
  const introLines1 = doc.splitTextToSize(introTxt1, contentWidth);
  doc.text(introLines1, margin, y);
  y += introLines1.length * LINE_H + 2;

  const introLines2 = doc.splitTextToSize(introTxt2, contentWidth);
  doc.text(introLines2, margin, y);
  y += introLines2.length * LINE_H + 8;

  // Title for Guarantees
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BLUE);
  doc.text("CE QUE VOTRE TARIF INCLUT QUE NOS CONCURRENTS N'OFFRENT PAS", margin, y);
  y += 4;
  doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  const guarantees = [
    { label: "Déclaration CNSS obligatoire", desc: "L'intervenante bénéficie d'une couverture maladie, retraite et allocations familiales. En cas de contrôle, vous êtes protégé." },
    { label: "Assurance Accident du Travail", desc: "Tout incident sur le lieu de travail est couvert by notre assurance. Sans déclaration, c'est vous qui êtes responsable." },
    { label: "Assurance RC Professionnelle", desc: "Casse, dégâts matériels, incidents accidentels — notre RC couvre les dommages causés par l'intervenante chez vous." },
    { label: "Contrat de travail légal (loi 19-12)", desc: "L'intervenante est employée selon la réglementation marocaine des employés de maison. Cadre juridique clair et sécurisé." }
  ];

  // Draw table header
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...LIGHT);
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
    doc.setFont('helvetica', 'bold').setTextColor(...TEXT);
    doc.text(wrappedLabel, margin + 4, y + 4);
    
    // Draw right col
    doc.setFont('helvetica', 'normal').setTextColor(...LIGHT);
    doc.text(wrappedDesc, margin + 55, y + 4);
    
    y += h;
  });

  // Page break to Page 2
  doc.addPage();
  y = 24;

  // ==================== 3. PRESTATION COMPRISE (Page 2) ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BLUE);
  doc.text("CE QUE COMPREND LA PRESTATION", margin, y);
  y += 4;
  doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  const inclusionItems = [
    "Entretien préalable et validation des références",
    "Rédaction et signature du contrat de travail",
    "Déclaration CNSS mensuelle et gestion des cotisations patronales et salariales",
    "Couverture Assurance RC et Accident du Travail",
    "Tenue professionnelle fournie — facturée au 1er mois uniquement (+200 DH HT / personne)",
    "Suivi régulier et gestion des litiges ou incidents",
    "Remplacement sous 48h en cas d'absence prolongée ou rupture",
    "Cahier de liaison et point mensuel avec votre chargée de clientèle",
    "Non inclus : produits, matériel, transport, congés au-delà du cadre légal."
  ];

  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...LIGHT);
  inclusionItems.forEach(item => {
    doc.setFont('helvetica', 'bold').setTextColor(...BLUE);
    doc.text("✓", margin + 2, y);
    doc.setFont('helvetica', 'normal').setTextColor(...LIGHT);
    const wrappedItem = doc.splitTextToSize(item, contentWidth - 8);
    doc.text(wrappedItem, margin + 8, y);
    y += Math.max(5, wrappedItem.length * 4.5) + 1.5;
  });
  y += 10;

  // ==================== GRILLE JOURS FACTURÉS ====================
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...BLUE);
  doc.text('TARIFICATION', margin, y);
  y += 4;
  doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(margin, y, right, y);
  y += 5;

  // Table header
  const col1Width = contentWidth * 0.5;
  const col2Width = contentWidth * 0.5;
  doc.setFillColor(...BLUE);
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
    doc.setFont('helvetica', 'bold').setTextColor(...TEXT);
    doc.text(jr[0], margin + 4, y + 5.5);
    doc.setFont('helvetica', 'normal').setTextColor(...LIGHT);
    doc.text(jr[1], margin + col1Width + 4, y + 5.5);
    y += 8;
  });

  // Formula note
  y += 3;
  doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(...MUTED);
  doc.text('Formule de calcul : Heures/jour × Jours/mois × 32 DH × Nb personnes × (1 – remise)', margin, y);
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
  const joursParMois = data.details.joursParSemaine === 5 ? 22 : data.details.joursParSemaine === 6 ? 26 : data.details.joursParSemaine === 7 ? 30 : data.details.joursParSemaine * 4;
  const ferieAmount = Math.round(cleanForfait * 0.20);
  const reductionPourcentage = data.details.reductionPourcentage || 0;
  const remiseAmount = Math.round(cleanForfait * (data.ferie ? 1.2 : 1) * (reductionPourcentage / 100));
  const tenueCost = data.details.tenueTravail || 0;

  const rows: Array<{ label: string; value: string; isItalic?: boolean; isReduction?: boolean; isBold?: boolean }> = [];
  
  rows.push({
    label: "Frais de dossier (sélection, vérification, onboarding)",
    value: "OFFERT"
  });

  const persLabel = data.details.nbIntervenantes > 1 ? "personnes" : "personne";
  rows.push({
    label: `Forfait mensuel — ${data.details.nbIntervenantes} ${persLabel} × ${data.details.heuresParJour}h/j × ${joursParMois} j/mois × 32 DH`,
    value: `${formatNumber(cleanForfait)} DH HT`
  });

  if (data.ferie) {
    rows.push({
      label: "Couverture jours fériés (+20%)",
      value: `+${formatNumber(ferieAmount)} DH HT`,
      isItalic: true
    });
  }

  if (reductionPourcentage > 0) {
    const engLabel = data.details.engagementMois > 0 ? ` engagement ${data.details.engagementMois} mois` : "";
    rows.push({
      label: `Remise${engLabel} -${reductionPourcentage}%`,
      value: `-${formatNumber(remiseAmount)} DH HT`,
      isReduction: true
    });
  }

  if (tenueCost > 0) {
    const persTenue = data.details.nbIntervenantes > 1 ? "personnes" : "personne";
    rows.push({
      label: `Tenue professionnelle × ${data.details.nbIntervenantes} ${persTenue} (1er mois)`,
      value: `+${formatNumber(tenueCost)} DH HT`
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
    
    doc.setFontSize(9.5).setTextColor(31, 41, 55);
    doc.text(r.label, margin + 4, y + 5.5);
    doc.text(r.value, right - 4, y + 5.5, { align: 'right' });
    y += 8;
  });

  // Calculate totals
  const totalMoisSuivants = cleanForfait + (data.ferie ? ferieAmount : 0) - remiseAmount;
  const total1erMois = totalMoisSuivants + tenueCost;

  // Draw double footer
  // Row 1: TOTAL 1ER MOIS HT
  doc.setFillColor(30, 41, 59); // Slate `#1e293b`
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(255, 255, 255);
  doc.text('TOTAL 1ER MOIS HT', margin + 4, y + 6);
  doc.text(`${formatNumber(total1erMois)} DH HT`, right - 4, y + 6, { align: 'right' });
  y += 9;

  // Row 2: TOTAL MOIS SUIVANTS HT (sans tenue)
  doc.setFillColor(254, 240, 138); // Yellow `#fef08a`
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(15, 23, 42); // Black `#0f172a`
  doc.text('TOTAL MOIS SUIVANTS HT (sans tenue)', margin + 4, y + 6);
  doc.text(`${formatNumber(totalMoisSuivants)} DH HT`, right - 4, y + 6, { align: 'right' });
  y += 12;

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

  // Options table
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 24;
  } else {
    y += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BLUE);
  doc.text('OPTIONS', margin, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, right, y);
  y += 5;

  // Header row
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.setFont('helvetica', 'bold');
  doc.text('Option', margin + 4, y + 5.5);
  doc.text('Prix', right - 4, y + 5.5, { align: 'right' });
  y += 11;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT);

  const optionsList = [
    { name: "Couverture jours fériés", price: "+20% sur le forfait mensuel" },
    { name: "Audit qualité mensuel (visite + compte rendu)", price: "Défini par le commercial" }
  ];

  optionsList.forEach((opt, idx) => {
    const wrappedName = doc.splitTextToSize(opt.name, contentWidth - 45);
    const rowHeight = Math.max(8, wrappedName.length * 5);

    if (y + rowHeight > pageHeight - 28) {
      doc.addPage();
      y = 24;
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y, contentWidth, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(55, 65, 81);
      doc.text('Option', margin + 4, y + 5.5);
      doc.text('Prix', right - 4, y + 5.5, { align: 'right' });
      y += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y - 4, contentWidth, rowHeight, 'F');
    }

    doc.text(wrappedName, margin + 4, y + 1);
    doc.text(opt.price, right - 4, y + 1, { align: 'right' });
    y += rowHeight;
  });
  y += 6;

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
  // Check for page break before signatures block
  const footerThreshold = pageHeight - 40;
  if (y > footerThreshold - 40) {
    doc.addPage();
    y = 24;
  } else {
    y += 20;
  }

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