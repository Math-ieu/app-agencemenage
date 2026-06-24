import { jsPDF } from "jspdf";

/** Format number with regular space as thousands separator */
const formatNumber = (n: number): string =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

interface Client {
  nom: string;
  telephone: string;
  whatsapp: string;
  email: string;
  adresse: string;
}

interface Ligne {
  designation: string;
  montant: number | string;
  isReduction?: boolean;
}

export interface DevisStandardData {
  numero: string;
  date: string;
  isGrand: boolean;
  isAbonnement: boolean;
  client: Client;
  lignes: Ligne[];
  total: number;
  codePromo?: string;
  codePromoPct?: number;
  total1erMois?: number;
  frequenceLabel?: string;
  avanceActive?: boolean;
  avanceType?: "pourcentage" | "fixe";
  avancePourcentage?: number;
  avanceFixe?: number;
  avancePaiement?: number;
}

export function genererDevisMenageStandard(data: DevisStandardData, logoBase64?: string, signatureBase64?: string): Blob {
  const doc = new jsPDF("p", "mm", "a4");
  const BLUE = [29, 78, 216];
  const MUTED = [107, 114, 128];
  const TEXT = [31, 41, 55];
  const PAGE_W = 210;
  const MARGIN = 20;
  const RIGHT = PAGE_W - MARGIN;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 24;

  const serviceLabel = data.isGrand ? "Grand ménage" : "Ménage standard";

  // ─── Header ───
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", MARGIN, y - 6, 38, 18);
      doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("Premium, tout simplement.", MARGIN, y + 16);
    } catch { /* ignore */ }
  } else {
    doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text("Agence Ménage", MARGIN, y);
  }

  doc.setFont("helvetica", "bold").setFontSize(32).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("DEVIS", RIGHT, y, { align: "right" });
  doc.setFontSize(14).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text(`N° ${data.numero}`, RIGHT, y + 10, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Date : ${data.date}`, RIGHT, y + 17, { align: "right" });
  doc.text("Valable 30 jours", RIGHT, y + 24, { align: "right" });

  y += 30;
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]).setLineWidth(0.5).line(MARGIN, y, RIGHT, y);
  y += 7;

  // ─── Objet ───
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]).setFont("helvetica", "bold").setFontSize(11);
  doc.text("Objet :", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${serviceLabel} — ${data.isAbonnement ? "abonnement mensuel" : "intervention ponctuelle"}`, MARGIN + 16, y);
  y += 10;

  // ─── Informations client ───
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("INFORMATIONS CLIENT", MARGIN, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240).setLineWidth(0.2).line(MARGIN, y, RIGHT, y);
  y += 7;
  const infoRows = [
    ["Nom / Prénom", data.client.nom],
    ["Téléphone", data.client.telephone],
    ["WhatsApp", data.client.whatsapp],
    ["Email", data.client.email],
    ["Adresse", data.client.adresse],
  ];
  doc.setFontSize(10);
  infoRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold").setTextColor(TEXT[0], TEXT[1], TEXT[2]).text(label, MARGIN, y);
    doc.setFont("helvetica", "normal").setTextColor(55, 65, 81).text(value || "—", MARGIN + 55, y);
    y += 6.5;
  });

  // ─── Intro ───
  y += 3;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(55, 65, 81);
  const intro = data.isAbonnement
    ? `Merci de nous faire confiance. Vous trouverez ci-dessous notre proposition d'abonnement pour l'entretien régulier de votre domicile. L'abonnement vous permet de bloquer votre créneau à l'avance et de bénéficier d'un tarif préférentiel. Votre planning est établi chaque mois par votre chargée de clientèle.`
    : `Merci de nous faire confiance. Vous trouverez ci-dessous notre proposition pour l'entretien de votre domicile. Nous mettons à votre disposition une femme de ménage qualifiée selon le nombre d'heures souhaité.`;
  const introWrapped = doc.splitTextToSize(intro, CONTENT_W);
  doc.text(introWrapped, MARGIN, y);
  y += introWrapped.length * 5 + 5;

  // ─── Prestations incluses ───
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("PRESTATIONS INCLUSES", MARGIN, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240).line(MARGIN, y, RIGHT, y);
  y += 6;
  const baseTasks = [
    "Nettoyage de la cuisine", "Lavage et rangement de la vaisselle",
    "Balayage et nettoyage des sols et tapis", "Nettoyage des portes de placard",
    "Nettoyage des chambres", "Nettoyage des salles de bain et toilettes",
    "Dépoussiérage des meubles", "Nettoyage des vitres intérieures accessibles",
    "Changement des draps", "Vidage et nettoyage des poubelles",
  ];
  const grandExtra = [
    "Lessivage des murs", "Nettoyage des dessous de lits et canapés",
    "Nettoyage intérieur des placards de cuisine", "Organisation du dressing (selon instructions du client en début de mission)",
    "Nettoyage intérieur du réfrigérateur (à vider avant l'intervention)",
  ];
  const tasks = data.isGrand ? [...baseTasks, ...grandExtra] : baseTasks;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const colW = CONTENT_W / 2;
  tasks.forEach((t, i) => {
    const col = i % 2;
    const rowY = y + Math.floor(i / 2) * 5.5;
    doc.text(`• ${t}`, MARGIN + col * colW, rowY, { maxWidth: colW - 4 });
  });
  y += Math.ceil(tasks.length / 2) * 5.5 + 4;
  doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(185, 28, 28);
  doc.text("Aucune tâche en dehors de cette liste ne peut être demandée à la femme de ménage.", MARGIN, y);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  y += 8;

  // ─── Détail de la prestation ───
  if (y > pageHeight - 80) { doc.addPage(); y = 24; }
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("DÉTAIL DE LA PRESTATION", MARGIN, y);
  y += 6;
  if (data.isAbonnement) {
    doc.setFillColor(26, 92, 76).rect(MARGIN, y, CONTENT_W, 8, "F");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
  } else {
    doc.setFillColor(243, 244, 246).rect(MARGIN, y, CONTENT_W, 8, "F");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(55, 65, 81);
  }
  doc.text("Désignation", MARGIN + 4, y + 5.5);
  doc.text("Montant", RIGHT - 4, y + 5.5, { align: "right" });
  y += 13;

  doc.setFont("helvetica", "normal").setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  
  const linesToRender = [...data.lignes];
  if (data.isAbonnement && data.codePromo && data.total1erMois !== undefined && data.total1erMois < data.total) {
    const economy = Math.round(data.total - data.total1erMois);
    if (economy > 0) {
      linesToRender.push({
        designation: `Remise code promo 1er mois -${data.codePromoPct || 0}%`,
        montant: -economy,
        isReduction: true
      });
    }
  }

  linesToRender.forEach((ligne, idx) => {
    if (idx % 2 === 1) { doc.setFillColor(249, 250, 251).rect(MARGIN, y - 4.5, CONTENT_W, 8, "F"); }
    const wrapped = doc.splitTextToSize(ligne.designation, CONTENT_W - 40);
    doc.setTextColor(ligne.isReduction ? 21 : TEXT[0], ligne.isReduction ? 128 : TEXT[1], ligne.isReduction ? 61 : TEXT[2]);
    doc.text(wrapped, MARGIN + 4, y);
    const montantStr = typeof ligne.montant === "number" ? `${ligne.montant < 0 ? "-" : ""}${formatNumber(Math.abs(ligne.montant))} DH` : String(ligne.montant);
    doc.text(montantStr, RIGHT - 4, y, { align: "right" });
    y += Math.max(8, wrapped.length * 5);
  });

  if (data.isAbonnement) {
    if (data.codePromo && data.total1erMois !== undefined && data.total1erMois < data.total) {
      // Case B: Code Promo active
      // TOTAL 1ER MOIS
      doc.setFillColor(26, 92, 76).rect(MARGIN, y - 4, CONTENT_W, 10, "F");
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255);
      doc.text("TOTAL 1ER MOIS", MARGIN + 4, y + 2.5);
      doc.text(`${formatNumber(data.total1erMois)} DH`, RIGHT - 4, y + 2.5, { align: "right" });
      y += 10;

      // Tarif mensuel à partir du 2ème mois
      doc.setFillColor(254, 249, 195).rect(MARGIN, y - 4, CONTENT_W, 10, "F");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(113, 63, 18);
      doc.text("Tarif mensuel à partir du 2ème mois", MARGIN + 4, y + 2.5);
      doc.text(`${formatNumber(data.total)} DH`, RIGHT - 4, y + 2.5, { align: "right" });
      y += 10;
    } else {
      // Case A: No Code Promo
      doc.setFillColor(26, 92, 76).rect(MARGIN, y - 4, CONTENT_W, 10, "F");
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(255, 255, 255);
      doc.text("TOTAL MENSUEL", MARGIN + 4, y + 2.5);
      doc.text(`${formatNumber(data.total)} DH`, RIGHT - 4, y + 2.5, { align: "right" });
      y += 10;
    }
  } else {
    // Non-subscription (ponctuel) case
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]).setLineWidth(0.4).line(MARGIN, y - 4, RIGHT, y - 4);
    doc.setFillColor(239, 246, 255).rect(MARGIN, y - 4, CONTENT_W, 10, "F");
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text("TOTAL", RIGHT - 50, y + 2, { align: "right" });
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]).text(`${formatNumber(data.total)} DH`, RIGHT - 4, y + 2, { align: "right" });
    y += 12;
  }

  // ─── Code promo 1er mois (uniquement en ponctuel si applicable) ───
  if (!data.isAbonnement && data.codePromo && data.total1erMois !== undefined && data.total1erMois < data.total) {
    doc.setFillColor(254, 252, 232).rect(MARGIN, y - 3, CONTENT_W, 14, "F");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(133, 77, 14);
    doc.text(`Offre 1er mois — code ${data.codePromo} (-${data.codePromoPct || 0}%)`, MARGIN + 4, y + 2);
    doc.text(`${formatNumber(data.total1erMois)} DH`, RIGHT - 4, y + 2, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    doc.text(`Tarif de base : ${formatNumber(data.total)} DH`, MARGIN + 4, y + 8);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    y += 18;
  }

  // ─── Avance ───
  if (data.avanceActive) {
    doc.setFillColor(239, 246, 255).rect(MARGIN, y - 4, CONTENT_W, 8, "F");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    const labelAvance = data.avanceType === "pourcentage" ? `Avance requise (${data.avancePourcentage}%)` : "Avance requise";
    doc.text(labelAvance, RIGHT - 65, y + 1.5);
    doc.text(`${formatNumber(data.avancePaiement || 0)} DH`, RIGHT - 4, y + 1.5, { align: "right" });
    y += 10;
  }

  // ─── Options disponibles ───
  if (y > pageHeight - 50) {
    doc.addPage();
    y = 24;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("OPTIONS", MARGIN, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, RIGHT, y);
  y += 5;

  // Header row
  doc.setFillColor(243, 244, 246);
  doc.rect(MARGIN, y, CONTENT_W, 8, "F");
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.setFont("helvetica", "bold");
  doc.text("Option", MARGIN + 4, y + 5.5);
  doc.text("Prix", RIGHT - 4, y + 5.5, { align: "right" });
  y += 11;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

  const optionsList = [
    { name: "Produits ménagers (nettoyant multi-usage, produit vitre, dégraissant, produit vaisselle, produit bois et parquets, neutralisant d'odeur)", price: "+90 DH" },
    { name: "Torchons et serpières (fournis par l'agence — usage unique — non laissés chez le client)", price: "+40 DH" },
    { name: "Pack Intégral (produits + torchons, serpière, raclette, balai, seau)", price: "+200 DH" },
    { name: "Zone éloignée (Bouskoura, Dar Bouazza, Mohammédia, Ville Verte...)", price: "+50 DH" }
  ];

  optionsList.forEach((opt, idx) => {
    const wrappedName = doc.splitTextToSize(opt.name, CONTENT_W - 45);
    const rowHeight = Math.max(8, wrappedName.length * 5);

    if (y + rowHeight > pageHeight - 28) {
      doc.addPage();
      y = 24;
      doc.setFillColor(243, 244, 246);
      doc.rect(MARGIN, y, CONTENT_W, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(55, 65, 81);
      doc.text("Option", MARGIN + 4, y + 5.5);
      doc.text("Prix", RIGHT - 4, y + 5.5, { align: "right" });
      y += 11;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(MARGIN, y - 4, CONTENT_W, rowHeight, "F");
    }

    doc.text(wrappedName, MARGIN + 4, y + 1);
    doc.text(opt.price, RIGHT - 4, y + 1, { align: "right" });
    y += rowHeight;
  });
  y += 6;

  // ─── Conditions du service ───
  if (y > pageHeight - 70) { doc.addPage(); y = 24; }
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("CONDITIONS DU SERVICE", MARGIN, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240).line(MARGIN, y, RIGHT, y);
  y += 6;
  const conditions = [
    "Le client doit mettre à disposition de la femme de ménage tout le nécessaire avant son arrivée : produits ménagers, torchons, seau, serpillère, raclette, balai ou aspirateur. Sans ces éléments, la mission ne peut pas démarrer. Cette obligation ne s'applique pas si le client a souscrit à une option matériel.",
    "Une tolérance de 30 minutes de retard est accordée. Nos intervenantes se déplacent en transport en commun.",
    "La femme de ménage effectue un tour du bien à son arrivée. Si le temps estimé dépasse la durée prévue de plus de 30 minutes, la mission est annulée sauf accord du client pour des heures supplémentaires, validé avec la chargée de clientèle.",
    "La femme de ménage n'utilise aucun appareil électroménager du client. L'aspirateur est la seule exception, sur accord explicite du client.",
    "Le lavage du linge et l'utilisation de la machine à laver ne font pas partie de la prestation.",
    "La désinsectisation n'est pas incluse dans la prestation.",
    ...(data.isAbonnement ? [
      "L'abonnement est valable du 1er au 31 de chaque mois.",
      "Le règlement s'effectue par virement bancaire avant le 20 du mois précédent. Cela nous permet de planifier les interventions et de bloquer le planning des intervenantes à l'avance.",
      "Votre facture et votre planning détaillé vous sont adressés entre le 15 et le 18 du mois. Ils indiquent le nombre exact de passages prévus et les dates correspondantes.",
      "En cas de 5ème semaine sur votre jour habituel, ce passage est calculé automatiquement au prorata et inclus dans votre facture.",
      "Nous faisons tout notre possible pour que ce soit la même intervenante à chaque passage. Cela ne peut pas être garanti dans tous les cas, notamment en cas d'absence ou d'imprévu.",
      "Par respect des jours de fête, aucune intervention ne peut avoir lieu 1 jour avant et 2 jours après les trois fêtes religieuses suivantes : Aïd el Kébir, Aïd el Fitr et Mawlid Ennabawi. Si votre jour de passage habituel tombe dans cette période, votre chargée de clientèle vous contactera pour convenir ensemble d'un report ou d'une annulation.",
    ] : []),
  ];
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  conditions.forEach((c, i) => {
    const wrapped = doc.splitTextToSize(`${i + 1}. ${c}`, CONTENT_W);
    if (y + wrapped.length * 4.8 > pageHeight - 28) { doc.addPage(); y = 24; }
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 4.8 + 1.5;
  });
  y += 4;

  // ─── Message d'accompagnement ───
  if (y > pageHeight - 50) { doc.addPage(); y = 24; }
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const msg = [
    `Bonjour ${data.client.nom},`,
    "",
    data.isAbonnement
      ? `Merci de faire appel à Agence Ménage ! Vous trouverez ci-joint votre devis d'abonnement pour un ${serviceLabel.toLowerCase()} — entretien régulier de votre domicile.`
      : `Merci de faire appel à Agence Ménage ! Vous trouverez ci-joint votre devis pour un ${serviceLabel.toLowerCase()} — intervention ponctuelle à domicile.`,
    "",
    data.isAbonnement
      ? "Votre facture et votre planning vous seront adressés entre le 15 et le 18 de chaque mois."
      : "Votre chargée de clientèle reste disponible pour toute question.",
    "",
    "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
  ];
  for (const para of msg) {
    if (para === "") { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, CONTENT_W);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 5;
  }
  y += 14;

  // ─── Signatures ───
  if (y > pageHeight - 55) { doc.addPage(); y = 24; }
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text("Pour Agence Ménage :", MARGIN, y);
  doc.text("Pour le client :", MARGIN + 95, y);
  y += 4;
  if (signatureBase64) { try { doc.addImage(signatureBase64, "PNG", MARGIN, y, 55, 25); } catch { /* ignore */ } }
  y += 28;
  doc.setDrawColor(156, 163, 175).line(MARGIN, y, MARGIN + 60, y).line(MARGIN + 95, y, MARGIN + 155, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Nom et cachet", MARGIN + 30, y, { align: "center" });
  doc.text('Nom, date et signature précédée', MARGIN + 95, y);
  doc.text('de "Bon pour accord"', MARGIN + 95, y + 5);

  // ─── Footer (dernière page) ───
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    if (p === totalPages) {
      doc.setPage(p);
      const footerY = 270;
      doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, footerY, RIGHT, footerY);
      
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(9);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text("Agence Ménage SARL — Groupe Agence PREMIUM Services", PAGE_W / 2, footerY + 5.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text("Bureau Casa : 36A Boulevard d'Anfa, 7ème étage  ·  Bureau Rabat : Avenue Hassan II, Centre commercial REDA porte G", PAGE_W / 2, footerY + 10.5, { align: 'center' });
      doc.text("Email : mehdi@agencemenage.ma  ·  RC : 704771  ·  Patente : 35409085  ·  IF : 71002832  ·  ICE : 003854034000063", PAGE_W / 2, footerY + 15, { align: 'center' });
    }
  }

  return doc.output("blob");
}
