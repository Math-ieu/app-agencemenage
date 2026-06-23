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

  y += 30;
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

  const isEntreprise = data.client.segment === 'entreprise';

  y += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  const introText = isEntreprise
    ? [
        "Madame, Monsieur,",
        "",
        "Nous vous remercions de votre demande. Vous trouverez ci-dessous notre proposition pour le nettoyage de vos locaux en fin de chantier. Notre équipe prend en charge l'intégralité de la prestation et se déplace avec le matériel adapté à la nature et à l'envergure de votre chantier.",
      ]
    : [
        "Merci de nous faire confiance. Vous trouverez ci-dessous notre proposition pour le nettoyage de votre bien en fin de chantier.",
        "",
        "Notre équipe prend en charge l'intégralité de la prestation, du matériel aux produits, pour vous livrer un espace propre, sain et prêt à être occupé.",
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

  // TVA 20% + TOTAL TTC (entreprises uniquement)
  if (isEntreprise) {
    const tva = totalHT * 0.2;
    const totalTTC = totalHT + tva;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('TVA 20%', right - 55, y, { align: 'right' });
    doc.text(`${formatNumber(tva)} DH`, right - 2, y, { align: 'right' });
    y += 7;
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setLineWidth(0.4);
    doc.line(margin, y - 3, right, y - 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('TOTAL TTC', right - 55, y + 3.5, { align: 'right' });
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setFontSize(13);
    doc.text(`${formatNumber(totalTTC)} DH`, right - 2, y + 3.5, { align: 'right' });
    y += 14;
  }

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



  // Options table
  if (y > footerThreshold - 30) {
    doc.addPage();
    y = 24;
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
  doc.rect(margin, y, contentWidth, 8, 'F');
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
    { name: "Grattage vitres léger (stickers, traces légères)", price: `Forfait +150 DH${suffix}` },
    { name: "Grattage vitres profond (silicone, béton)", price: `25 DH${suffix} / m² vitré` },
    { name: "Ramassage déchets — moins de 100 kg", price: `+200 DH${suffix}` },
    { name: "Ramassage déchets — 100 à 300 kg", price: `+380 DH${suffix}` },
    { name: "Ramassage déchets — 300 à 500 kg", price: `+650 DH${suffix}` },
    { name: "Ramassage déchets — plus de 500 kg", price: "Devis spécifique" },
    { name: "Cristallisation du marbre", price: `25 DH${suffix} / m² de marbre` },
    { name: "Zone éloignée (Bouskoura, Dar Bouazza, Mohammédia...)", price: `+200 DH${suffix}` }
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
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
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
  const finChantierConditions = [
    "• Aucune intervention ne peut avoir lieu tant que les travaux ne sont pas totalement terminés et qu'aucun ouvrier n'est présent sur site.",
    "• Le client doit obligatoirement mettre à disposition un point d'eau et une alimentation électrique fonctionnels. En cas de non-respect, l'agence peut annuler ou reporter la mission, et facturer des frais de déplacement.",
    "• Notre équipe effectue une visite préalable gratuite du site avant le démarrage. Si l'état réel dépasse l'estimation, un devis révisé est soumis avant toute intervention.",
    "• L'agence est seule responsable de l'estimation du temps de travail et du nombre d'intervenants à mobiliser.",
    "• Un acompte de 50% du montant total est exigé avant le début de la prestation.",
    "• Le client doit être présent à la fin de la mission pour signer le PV de livraison. Le solde restant est payable sur place, en présence de l'équipe Agence Ménage.",
    "• La désinsectisation n'est pas incluse dans la prestation.",
  ];
  finChantierConditions.forEach((c, ci) => {
    const wrapped = doc.splitTextToSize(`${ci + 1}. ${c.replace(/^•\s*/, '')}`, contentWidth);
    if (y + wrapped.length * 5 > pageHeight - 28) { doc.addPage(); y = 24; }
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 1.5;
  });
  y += 2;

  if (y > pageHeight - 80) {
    doc.addPage();
    y = 24;
  } else {
    y += 8;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const msgLines = isEntreprise
    ? [
        "Madame, Monsieur,",
        '',
        "Merci de faire appel à Agence Ménage. Veuillez trouver ci-joint notre estimation pour le nettoyage de vos locaux en fin de chantier.",
        '',
        "Notre équipe se déplace avec tout le matériel nécessaire. Une visite préalable gratuite sera planifiée pour confirmer les conditions d'intervention.",
        '',
        "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
      ]
    : [
        `Bonjour ${data.client.nom},`,
        '',
        "Merci de faire appel à Agence Ménage ! Vous trouverez ci-joint notre proposition pour le nettoyage de votre bien en fin de chantier.",
        '',
        "Notre équipe se déplace avec tout le matériel nécessaire. Une visite préalable gratuite sera organisée avant le démarrage.",
        '',
        "Votre chargée de clientèle est disponible pour toute question.",
        '',
        "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
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