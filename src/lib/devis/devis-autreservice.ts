import { jsPDF } from "jspdf";

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

interface DevisLine {
  designation: string;
  montant: number;
}

interface DevisAutreServiceData {
  numero: string;
  date: string;
  client: Client;
  objet: string;
  lignes: DevisLine[];
  totalHT: number;
  vatRate: number;
  totalTTC: number;
  description: string;
  avanceRequired?: boolean;
  avanceMode?: 'percent' | 'fixed';
  avancePercent?: number;
  avanceAmount?: number;
  avancePaiement?: number;
  surface?: number;
  duree?: number;
  durationUnit?: string;
  staffCount?: number;
  frequence?: string;
  datePrestation?: string;
  heurePrestation?: string;
}

export function genererDevisAutreService(data: DevisAutreServiceData, logoBase64?: string, signatureBase64?: string) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const BLUE = [29, 78, 216]; // Royal Blue to match devis brand identity
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
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Premium, tout simplement.', MARGIN, y + 16);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
      doc.text('Agence Ménage', MARGIN, y);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Premium, tout simplement.', MARGIN, y + 6);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text('Agence Ménage', MARGIN, y);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Premium, tout simplement.', MARGIN, y + 6);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('DEVIS', RIGHT, y, { align: 'right' });
  
  doc.setFontSize(14);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  doc.text(`N° ${data.numero}`, RIGHT, y + 10, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Date : ${data.date}`, RIGHT, y + 17, { align: 'right' });
  doc.text('Valable 30 jours', RIGHT, y + 24, { align: 'right' });

  y += 30;
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.5);
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



  const pageHeight = doc.internal.pageSize.getHeight();
  const footerThreshold = pageHeight - 40;

  if (y > footerThreshold - 40) {
    doc.addPage();
    y = 24;
  } else {
    y += 4;
  }

  // Table header
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

  // Financial breakdown box
  doc.setFillColor(239, 246, 255);
  const showTva = data.vatRate > 0;
  const breakdownH = showTva ? 22 : 12;

  doc.rect(MARGIN, y - 4, CONTENT_W, breakdownH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);

  doc.text('TOTAL HT', RIGHT - 50, y + 2, { align: 'right' });
  doc.text(`${formatNumber(data.totalHT)} DH`, RIGHT - 4, y + 2, { align: 'right' });

  if (showTva) {
    const tvaAmount = data.totalHT * (data.vatRate / 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`TVA (${data.vatRate}%)`, RIGHT - 50, y + 8, { align: 'right' });
    doc.text(`${formatNumber(tvaAmount)} DH`, RIGHT - 4, y + 8, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL TTC', RIGHT - 50, y + 14, { align: 'right' });
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text(`${formatNumber(data.totalTTC)} DH`, RIGHT - 4, y + 14, { align: 'right' });
  }
  y += breakdownH + 4;

  // Advance Payment (if active)
  if (data.avanceRequired && data.avancePaiement) {
    if (y > footerThreshold - 15) {
      doc.addPage();
      y = 24;
    }
    doc.setFillColor(254, 243, 199); // light orange background
    doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(146, 64, 14); // brown text
    const labelAvance = data.avanceMode === 'percent'
      ? `Avance requise (${data.avancePercent}%)`
      : 'Avance requise';
    doc.text(labelAvance, MARGIN + 4, y + 5.5);
    doc.text(`${formatNumber(data.avancePaiement)} DH`, RIGHT - 4, y + 5.5, { align: 'right' });
    y += 12;
  }

  // Check page break for description
  if (data.description) {
    const wrappedDesc = doc.splitTextToSize(data.description, CONTENT_W - 8);
    const boxH = wrappedDesc.length * 5 + 14;

    if (y > footerThreshold - boxH - 10) {
      doc.addPage();
      y = 24;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.text("Consignes importantes & Conditions de la prestation", MARGIN + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    doc.text(wrappedDesc, MARGIN + 4, y + 12);
    y += boxH + 8;
  }

  // Accompanying message
  if (y > footerThreshold - 40) {
    doc.addPage();
    y = 24;
  } else {
    y += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
  const msgLines = [
    `Bonjour ${data.client.nom},`,
    '',
    `Suite à notre échange, veuillez trouver ci-dessous notre proposition tarifaire pour notre prestation sur mesure : "${data.objet}". Notre équipe de professionnels veillera à respecter l'ensemble des consignes formulées ci-dessus.`,
    '',
    "N'hésitez pas à nous contacter pour toute question ou pour planifier votre première intervention.",
    '',
    "Cordialement, L'équipe Agence Ménage — 05 22 20 02 39",
  ];
  for (const para of msgLines) {
    if (para === '') { y += 3; continue; }
    const wrapped = doc.splitTextToSize(para, CONTENT_W);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 5;
  }
  y += 16;

  // Signatures
  doc.setFont('helvetica', 'bold');
  doc.text('Pour Agence Ménage :', MARGIN, y);
  doc.text('Pour le client :', MARGIN + 95, y);
  y += 4;
  if (signatureBase64) {
    try { doc.addImage(signatureBase64, 'PNG', MARGIN, y, 55, 25); } catch { /* ignore */ }
  }
  y += 28;
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

  // Footer on last page
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

  return doc.output('blob');
}
