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
  prestations: Array<{ desc: string; montant: number | string }>;
  totalHT: number;
  validite?: string;
  message?: string;
  avanceActive?: boolean;
  avanceType?: 'pourcentage' | 'fixe';
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
  totalLabel?: string;
  totalMensuelLabel?: string;
  totalMensuel?: number;
  nbSemaines?: number;
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
  const TEAL_DARK = [26, 92, 76];       // Dark teal for table header & total row
  const YELLOW_BG = [254, 249, 195];     // Light yellow for TOTAL MENSUEL row
  const YELLOW_TEXT = [113, 63, 18];     // Dark amber text for TOTAL MENSUEL
  
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const footerThreshold = pageHeight - 40;
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
  pdf.text(data.validite || 'Valable 7 jours', pageWidth - margin, y + 24, { align: 'right' });
  
  y += 30;
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
  const remerciement = "Nous comprenons l'importance de trouver une personne de confiance pour accompagner votre proche au quotidien. Agence Ménage met à votre disposition une auxiliaire de vie formée, attentionnée et fiable, avec un suivi régulier pour votre tranquillité.";
  pdf.text(remerciement, margin, y, { maxWidth: contentWidth, align: 'justify' });
  y += 14;

  // ==================== PRESTATIONS INCLUSES ====================
  if (y > footerThreshold - 30) {
    pdf.addPage();
    y = 24;
  }

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('PRESTATIONS INCLUSES', margin, y);
  y += 3;
  pdf.setDrawColor(BORDER_GREY[0], BORDER_GREY[1], BORDER_GREY[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;

  const categories = [
    {
      title: "A — Présence et accompagnement (non médical)",
      items: [
        "Présence rassurante, compagnie et surveillance générale.",
        "Aide à la mobilité légère : se lever, marcher, s'installer — sans manipulation lourde.",
        "Assistance à l'organisation de la journée : routine, confort, sécurité."
      ]
    },
    {
      title: "B — Aide à l'hygiène et au confort",
      items: [
        "Aide à la toilette non médicale et à l'habillage selon le niveau d'autonomie.",
        "Changement de tenue et protections — si fournies par la famille.",
        "Mise en place d'un environnement confortable : lit, chambre, zone de vie."
      ]
    },
    {
      title: "C — Aide et suivi des médicaments oraux",
      items: [
        "L'auxiliaire de vie accompagne la personne dans la prise des médicaments par voie orale, selon les consignes de la famille et l'ordonnance. Elle assure les rappels, présente les médicaments préparés et note chaque prise dans le cahier de liaison. En cas d'anomalie (refus, oubli, effet indésirable), elle alerte immédiatement la famille.",
        "Limite : l'auxiliaire de vie ne modifie jamais la posologie, ne décide pas des médicaments et ne réalise aucun acte médical ou infirmier."
      ],
      isParagraph: true
    },
    {
      title: "D — Suivi et communication",
      items: [
        "Cahier de liaison mis à jour à chaque passage.",
        "Suivi WhatsApp avec la famille sur demande.",
        "Remontée immédiate des alertes : chute, fièvre, comportement inhabituel, refus de médicaments."
      ]
    }
  ];

  categories.forEach((cat) => {
    if (y > footerThreshold - 15) {
      pdf.addPage();
      y = 24;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
    pdf.text(cat.title, margin, y);
    y += 5.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(MEDIUM_GREY[0], MEDIUM_GREY[1], MEDIUM_GREY[2]);

    cat.items.forEach((item) => {
      const bulletText = cat.isParagraph ? item : `• ${item}`;
      const wrapped = pdf.splitTextToSize(bulletText, contentWidth - 4);
      
      if (y + wrapped.length * 4.5 > footerThreshold) {
        pdf.addPage();
        y = 24;
      }
      
      pdf.text(wrapped, margin + (cat.isParagraph ? 0 : 2), y);
      y += wrapped.length * 4.5 + 1.5;
    });
    y += 3.5;
  });
  y += 10;

  // ==================== TABLEAU DÉTAIL DE LA PRESTATION ====================
  // Calculate total height of the table block to prevent layout overflow
  const descColWidth = contentWidth - 40;
  // prestations rows + header(9) + OFFERT row(8) + TOTAL row(10) + MENSUEL row(10) + title(6) + avance(10?)
  let estimatedTableHeight = 6 + 9 + 8 + 10 + 10 + (data.avanceActive ? 10 : 0);
  for (let i = 0; i < data.prestations.length; i++) {
    const prestation = data.prestations[i];
    const lines = pdf.splitTextToSize(prestation.desc, descColWidth);
    const rowHeight = Math.max(8, lines.length * 5 + 2);
    estimatedTableHeight += rowHeight;
  }

  if (y + estimatedTableHeight > footerThreshold) {
    pdf.addPage();
    y = 24;
  }

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  pdf.text('DÉTAIL DE LA PRESTATION', margin, y);
  y += 6;

  // Table header — dark teal background, white text
  pdf.setFillColor(TEAL_DARK[0], TEAL_DARK[1], TEAL_DARK[2]);
  pdf.rect(margin, y, contentWidth, 9, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Désignation', margin + 5, y + 6);
  pdf.text('Montant', pageWidth - margin - 5, y + 6, { align: 'right' });
  y += 9;

  // Table rows — prestation lines
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  for (let i = 0; i < data.prestations.length; i++) {
    const prestation = data.prestations[i];
    const lines = pdf.splitTextToSize(prestation.desc, descColWidth);
    const rowHeight = Math.max(8, lines.length * 5 + 2);

    if (y + rowHeight > footerThreshold) {
      pdf.addPage();
      y = 24;
    }

    if (i % 2 === 1) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
    pdf.text(lines, margin + 5, y + 5);

    // Support string montant (e.g. "OFFERT") and numeric
    const montantVal = prestation.montant;
    if (typeof montantVal === 'string') {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(GREEN_TEXT[0], GREEN_TEXT[1], GREEN_TEXT[2]);
      pdf.text(montantVal, pageWidth - margin - 5, y + 5, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
    } else {
      const prefix = montantVal > 0 && prestation.desc.toLowerCase().includes('majoration') ? '+' : '';
      pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
      pdf.text(`${prefix}${formatNumber(montantVal)} DH`, pageWidth - margin - 5, y + 5, { align: 'right' });
    }
    y += rowHeight;
  }

  // "Frais de mise à disposition" → OFFERT row (if not already in prestations)
  const hasOffertLine = data.prestations.some(p => typeof p.montant === 'string' && p.montant.toUpperCase() === 'OFFERT');
  if (!hasOffertLine) {
    const offertRowH = 8;
    if (data.prestations.length % 2 === 1) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, y, contentWidth, offertRowH, 'F');
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
    pdf.text('Frais de mise à disposition', margin + 5, y + 5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(GREEN_TEXT[0], GREEN_TEXT[1], GREEN_TEXT[2]);
    pdf.text('OFFERT', pageWidth - margin - 5, y + 5, { align: 'right' });
    y += offertRowH;
  }

  // TOTAL SEMAINE row — dark teal background, white text
  const totalLabel = data.totalLabel || 'TOTAL SEMAINE';
  pdf.setFillColor(TEAL_DARK[0], TEAL_DARK[1], TEAL_DARK[2]);
  pdf.rect(margin, y, contentWidth, 10, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  pdf.text(totalLabel, margin + 5, y + 7);
  pdf.text(`${formatNumber(data.totalHT)} DH`, pageWidth - margin - 5, y + 7, { align: 'right' });
  y += 10;

  // TOTAL MENSUEL ESTIMÉ row — yellow background, dark amber text
  const nbSem = data.nbSemaines || 4;
  const totalMensuel = data.totalMensuel || data.totalHT * nbSem;
  const totalMensuelLabel = data.totalMensuelLabel || `TOTAL MENSUEL ESTIMÉ (${nbSem} semaines)`;
  pdf.setFillColor(YELLOW_BG[0], YELLOW_BG[1], YELLOW_BG[2]);
  pdf.rect(margin, y, contentWidth, 10, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(YELLOW_TEXT[0], YELLOW_TEXT[1], YELLOW_TEXT[2]);
  pdf.text(totalMensuelLabel, margin + 5, y + 7);
  pdf.text(`${formatNumber(totalMensuel)} DH`, pageWidth - margin - 5, y + 7, { align: 'right' });
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
  pdf.text('CONDITIONS DU SERVICE', margin, y);
  y += 3;
  pdf.setDrawColor(BORDER_GREY[0], BORDER_GREY[1], BORDER_GREY[2]);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 8;
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  const notes = [
    "• Le paiement est hebdomadaire, au plus tard le mercredi pour la semaine suivante. Sans confirmation de paiement, la prestation est mise en attente jusqu'à régularisation.",
    "• L'abonnement est calculé sur 4 passages par mois. En cas de 5ème occurrence du jour d'intervention dans le mois, ce passage est facturé en complément sur accord du client.",
    "• En cas d'absence ou d'indisponibilité de dernière minute, une intervenante de remplacement est mobilisée sous 2 heures.",
    "• Nous faisons tout notre possible pour assurer la continuité avec la même intervenante. Cela ne peut être garanti dans tous les cas.",
    "• Toute annulation doit être signalée au moins 48h à l'avance. En deçà de ce délai, le passage est dû.",
    "• Le matériel médical, les protections et les produits d'hygiène spécifiques sont fournis par la famille.",
    "• Les frais de courses, pharmacie ou transport sont à la charge du client, sur justificatifs.",
    "• Par respect des jours de fête, aucune intervention ne peut avoir lieu 1 jour avant et 2 jours après les fêtes suivantes : Aïd el Kébir, Aïd el Fitr et Mawlid Ennabawi. Votre chargée de clientèle vous contactera pour convenir d'un report ou d'une annulation.",
    "• Ce devis est valable 7 jours à compter de sa date d'émission."
  ];
  notes.forEach((note, ni) => {
    const noteWrapped = pdf.splitTextToSize(`${ni + 1}. ${note.replace(/^•\s*/, '')}`, contentWidth - 5);
    if (y + noteWrapped.length * 5.5 > pageHeight - 28) { pdf.addPage(); y = 24; }
    pdf.text(noteWrapped, margin + 5, y);
    y += noteWrapped.length * 5.5;
  });
  y += 8;

  // ==================== MESSAGE D'ACCOMPAGNEMENT ====================
  const message = data.message || `Bonjour Madame / Monsieur ${data.client.donneurOrdre},

Merci de faire confiance à Agence Ménage pour l'accompagnement de votre proche. Vous trouverez ci-joint notre proposition adaptée à votre situation.

Un cahier de liaison sera mis en place dès le démarrage pour un suivi transparent entre l'intervenante et votre famille. Votre chargée de clientèle reste disponible à tout moment.

Avec toute notre disponibilité,
L'équipe Agence Ménage — 05 22 20 02 39`;

  const messageLines = pdf.splitTextToSize(message, contentWidth);
  const messageHeight = messageLines.length * 5;

  if (y + messageHeight + 12 > footerThreshold) {
    pdf.addPage();
    y = 24;
  } else {
    y += 8;
  }
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  
  pdf.text(messageLines, margin, y);
  y += messageHeight + 12;

  // ==================== SIGNATURES ====================
  // Check for page break before signatures block
  if (y > footerThreshold - 35) {
    pdf.addPage();
    y = 24;
  }
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
      const footerY = pageHeight - 27;
      
      pdf.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
      pdf.setLineWidth(0.4);
      pdf.line(margin, footerY, pageWidth - margin, footerY);
      
      pdf.setFont('helvetica', 'bolditalic');
      pdf.setFontSize(9);
      pdf.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
      pdf.text("Agence Ménage SARL — Groupe Agence PREMIUM Services", pageWidth / 2, footerY + 5.5, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
      pdf.text("Bureau Casa : 36A Boulevard d'Anfa, 7ème étage  ·  Bureau Rabat : Avenue Hassan II, Centre commercial REDA porte G", pageWidth / 2, footerY + 10.5, { align: 'center' });
      pdf.text("Email : mehdi@agencemenage.ma  ·  RC : 704771  ·  Patente : 35409085  ·  IF : 71002832  ·  ICE : 003854034000063", pageWidth / 2, footerY + 15, { align: 'center' });
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