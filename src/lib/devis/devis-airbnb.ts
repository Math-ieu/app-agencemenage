import { jsPDF } from "jspdf";

/** Format number with regular space as thousands separator (jsPDF can't render non-breaking spaces from toLocaleString) */
const formatNumber = (n: number): string => {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

interface Client {
  nom: string;
  telephone: string;
  whatsapp: string;
  email: string;
  adresse: string;
}

interface DevisAirbnbLine {
  designation: string;
  montant: number;
}

interface DevisAirbnbData {
  numero: string;
  date: string;
  client: Client;
  objet: string;
  lignes: DevisAirbnbLine[];
  totalHT: number;
  note?: string;
}

export function genererDevisAirbnb(data: DevisAirbnbData, logoBase64?: string) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const BLUE = [29, 78, 216];
  const MUTED = [107, 114, 128];
  const TEXT = [31, 41, 55];
  const PAGE_W = 210;
  const MARGIN = 20;
  const RIGHT = PAGE_W - MARGIN;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = 24;

  // Header — Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', MARGIN, y - 6, 38, 18);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text('Agence Ménage', MARGIN, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Premium, tout simplement.', MARGIN, y + 6);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Agence Ménage', MARGIN, y);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Premium, tout simplement.', MARGIN, y + 6);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('DEVIS', RIGHT, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`N° ${data.numero}`, RIGHT, y + 8, { align: 'right' });
  doc.text(`Date : ${data.date}`, RIGHT, y + 14, { align: 'right' });
  doc.text('Valable 30 jours', RIGHT, y + 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca", MARGIN, y + 16);
  doc.text('Tél : 06 64 22 67 90 | contact@agencemenage.ma', MARGIN, y + 22);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('agencemenage.ma', MARGIN, y + 28);

  y += 34;
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, RIGHT, y);
  y += 7;

  // Objet
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Objet :', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.objet, MARGIN + 14, y);
  y += 10;

  // Informations client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('INFORMATIONS CLIENT', MARGIN, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, RIGHT, y);
  y += 7;

  const labelX = MARGIN;
  const valueX = MARGIN + 55;
  const infoRows = [
    ['Nom / Prénom', data.client.nom],
    ['Téléphone', data.client.telephone],
    ['WhatsApp', data.client.whatsapp],
    ['Email', data.client.email],
    ['Adresse', data.client.adresse],
  ];

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
  const introTexts = [
    "Nous vous remercions de votre confiance et avons le plaisir de vous adresser notre proposition tarifaire pour l'entretien de votre bien en location courte durée.",
    "",
    "Notre service Airbnb est conçu pour garantir à chaque passage un logement impeccable, prêt à accueillir vos voyageurs dans les meilleures conditions. Vous gérez les réservations, nous gérons la propreté.",
  ];
  for (const para of introTexts) {
    if (para === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, CONTENT_W);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 5;
  }
  y += 6;

  // Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('DÉTAIL DE LA PRESTATION', MARGIN, y);
  y += 6;

  doc.setFillColor(243, 244, 246);
  doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text('Désignation', MARGIN + 4, y + 5.5);
  doc.text('Montant HT', RIGHT - 4, y + 5.5, { align: 'right' });
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  data.lignes.forEach((ligne, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(MARGIN, y - 4.5, CONTENT_W, 8, 'F');
    }
    doc.text(ligne.designation, MARGIN + 4, y);
    doc.text(`${formatNumber(ligne.montant)} DH`, RIGHT - 4, y, { align: 'right' });
    y += 8;
  });

  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y - 4, RIGHT, y - 4);
  doc.setFillColor(239, 246, 255);
  doc.rect(MARGIN, y - 4, CONTENT_W, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text('TOTAL HT', RIGHT - 50, y + 2, { align: 'right' });
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text(`${formatNumber(data.totalHT)} DH`, RIGHT - 4, y + 2, { align: 'right' });
  y += 12;

  // Note box
  const noteText = `Note : ${data.note || "Ce tarif est valable pour chaque passage. En cas de fréquence mensuelle (4 passages ou plus), un tarif préférentiel peut être discuté avec votre chargé de clientèle."}`;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  const noteWrapped = doc.splitTextToSize(noteText, CONTENT_W - 8);
  const noteBoxH = noteWrapped.length * 4.5 + 8;
  doc.setFillColor(236, 253, 245);
  doc.rect(MARGIN, y, CONTENT_W, noteBoxH, 'F');
  doc.setTextColor(22, 101, 52);
  doc.text(noteWrapped, MARGIN + 4, y + 6);
  y += noteBoxH + 6;

  // Conditions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('NOTES ET CONDITIONS PARTICULIÈRES', MARGIN, y);
  y += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, y, RIGHT, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const conditions = [
    "• Intervention planifiable en moins de 24h entre deux séjours.",
    "• Un rapport de passage (photos clés de l'appartement) peut être fourni sur demande.",
    "• Produits ménagers professionnels utilisés par nos intervenantes.",
  ];
  conditions.forEach((c) => {
    doc.text(c, MARGIN, y);
    y += 6.5;
  });

  // Page 2
  doc.addPage();
  y = 30;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const msgLines = [
    `Bonjour ${data.client.nom.split(' ')[0] || 'M.'},`,
    '',
    "Suite à notre échange, veuillez trouver ci-dessous notre proposition pour l'entretien de votre appartement Airbnb. Notre Formule B intègre le ménage complet ainsi que la collecte, le lavage et le repassage du linge, vous permettant de proposer un logement toujours frais à vos voyageurs.",
    '',
    "N'hésitez pas à nous contacter pour toute question ou pour planifier votre première intervention.",
    '',
    "Cordialement, L'équipe Agence Ménage — 06 64 22 67 90",
  ];
  for (const para of msgLines) {
    if (para === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, CONTENT_W);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 5;
  }
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.text('Pour Agence Ménage :', MARGIN, y);
  doc.text('Pour le client :', MARGIN + 95, y);
  y += 12;
  doc.setDrawColor(156, 163, 175);
  doc.line(MARGIN, y, MARGIN + 60, y);
  doc.line(MARGIN + 95, y, MARGIN + 155, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Nom et cachet', MARGIN + 30, y, { align: 'center' });
  doc.text('Nom, date et signature précédée', MARGIN + 95, y, { align: 'left' });
  doc.text('de "Bon pour accord"', MARGIN + 95, y + 5, { align: 'left' });

  // Footer sur toutes les pages
  const totalPages = (doc.internal as any).getNumberOfPages?.() ?? doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = 275;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, footerY, RIGHT, footerY);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      "Agence Ménage — 36 Boulevard d'Anfa, Résidence Anafe A, 7ème étage, Casablanca | 06 64 22 67 90 | contact@agencemenage.ma | agencemenage.ma",
      PAGE_W / 2,
      footerY + 4,
      { maxWidth: CONTENT_W, align: 'center' }
    );
    doc.text(
      "Ce devis est établi sans TVA. Il est valable 30 jours à compter de sa date d'émission. Toute acceptation vaut engagement contractuel.",
      PAGE_W / 2,
      footerY + 12,
      { maxWidth: CONTENT_W, align: 'center' }
    );
  }

  return doc.output('blob');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function genererDevisAirbnbAvecLogo(data: DevisAirbnbData, logoUrl?: string): Promise<Blob> {
  if (logoUrl) {
    try {
      const logoResponse = await fetch(logoUrl);
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await blobToBase64(logoBlob);
      return genererDevisAirbnb(data, logoBase64);
    } catch {
      return genererDevisAirbnb(data);
    }
  }
  return genererDevisAirbnb(data);
}

export type { DevisAirbnbData };