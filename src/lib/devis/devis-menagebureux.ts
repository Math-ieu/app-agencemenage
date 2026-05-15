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

async function genererDevisMenageBureaux(data: DevisMenageBureauxData, logoBase64?: string): Promise<Blob> {
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
    `OBJET : Ménage bureaux — Abonnement hebdomadaire — ${data.details.dureeParSession}h × ${data.details.nbIntervenantes} intervenante`,
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
    "Nous vous remercions de votre intérêt pour nos services de nettoyage de bureaux et avons le plaisir de vous adresser notre proposition. Notre prestation comprend le dépoussiérage des bureaux et surfaces accessibles, le nettoyage des sols, le vidage des poubelles, l'entretien des espaces communs (salles de réunion, cuisine, sanitaires) et le nettoyage des vitres accessibles.",
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

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerThreshold = pageHeight - 40;

  // Check for page break before green note
  if (y > footerThreshold - 15) {
    doc.addPage();
    y = 24;
  }

  // Note abonnement verte
  doc.setFillColor(240, 253, 244); // Fond vert clair
  doc.roundedRect(margin, y, tableWidth, 12, 1, 1, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(21, 128, 61); // Texte vert foncé
  doc.text(
    `• Tarif abonnement appliqué (–${data.details.reductionAbonnement}%). Planning adapté à vos horaires (matin ou soir). Remplacement assuré en cas d'absence.`,
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
  doc.text('• Intervention planifiable en dehors des heures de bureau sur demande.', margin, y);
  y += 6.5;
  doc.text("• Remplacement organisé automatiquement en cas d'absence de l'intervenante.", margin, y);
  y += 6.5;
  doc.text('• Supplément de 50 DH par passage pour les zones éloignées (Bouskoura, Dar Bouazza, Mohammédia).', margin, y);

  doc.addPage();
  y = 30;
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
  const interlocuteurNom = data.client.interlocuteur.split('—')[0].trim();
  const msgLines = [
    `${interlocuteurNom}.`,
    '',
    "Suite à notre échange, nous vous adressons notre proposition pour l'entretien régulier de vos locaux.",
    '',
    "L'abonnement mensuel vous permet de bénéficier d'un tarif préférentiel tout en garantissant une intervenante stable et formée à vos standards.",
    '',
    "Nous nous adaptons entièrement à vos contraintes horaires et pouvons organiser une première visite de vos locaux à votre convenance.",
    '',
    "Dans l'attente de votre retour, L'équipe Agence Ménage — 06 64 22 67 90",
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
  y += 12;
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

  // Footer sur toutes les pages
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
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
async function genererDevisMenageBureauxAvecLogo(logoUrl?: string): Promise<Blob | null> {
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await blobToBase64(logoBlob);
      return await genererDevisMenageBureaux(devisMenageBureauxData, logoBase64);
    } catch (error) {
      console.warn("Logo non trouvé, génération sans logo");
      return await genererDevisMenageBureaux(devisMenageBureauxData);
    }
  }
  return await genererDevisMenageBureaux(devisMenageBureauxData);
}

// ==================== EXPORT ====================
export { 
  genererDevisMenageBureaux, 
  genererDevisMenageBureauxAvecLogo, 
  devisMenageBureauxData, 
  type DevisMenageBureauxData 
};