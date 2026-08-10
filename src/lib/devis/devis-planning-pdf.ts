import { jsPDF } from 'jspdf';
import { Demande } from '../../types';
import { extractJoursPassage, parseDateRobust } from '../../utils/pricing';

export interface SubscriptionDayDetail {
  dayKey: string;      // e.g. 'lundi'
  dayName: string;     // e.g. 'Lundi'
  heureDebut: string;  // e.g. '09:00'
  heureFin: string;    // e.g. '13:00'
}

export interface PlanningCalendarDay {
  dayNumber: number;
  dateIso: string;
  dayOfWeekIndex: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  isCurrentMonth: boolean;
  isIntervention: boolean;
  is5thWeek?: boolean;
  heureDebut?: string;
  heureFin?: string;
}

export interface SubscriptionScheduleData {
  isAbonnement: boolean;
  frequencyLabel: string;
  startDateStr: string;
  formattedStartDate: string;
  monthTitle: string; // e.g. "Juillet 2026"
  interventionDays: SubscriptionDayDetail[];
  calendarDays: PlanningCalendarDay[];
  totalPassagesCount: number;
  fifthWeekCount: number;
}

const DAY_NAMES_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const DAY_LABELS_CAP = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_MAP_INDEX: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6
};

/**
 * Computes end time from start time and duration in hours
 */
const computeEndTimeStr = (startStr: string, dureeHours: number): string => {
  if (!startStr) return '13:00';
  const parts = startStr.split(':');
  let h = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  if (isNaN(h)) h = 9;
  if (isNaN(m)) m = 0;
  const totalMin = h * 60 + m + Math.round(dureeHours * 60);
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
};

/**
 * Extracts full subscription scheduling details from a Demande object
 */
export const extractSubscriptionScheduleData = (demande: Demande): SubscriptionScheduleData => {
  const form = demande.formulaire_data || {};
  const isAbonnement =
    demande.frequency === 'abonnement' ||
    form.frequency === 'subscription' ||
    form.frequency === 'abonnement' ||
    Boolean(form.is_abonnement) ||
    Boolean(demande.planning);

  const freqLabel =
    demande.frequency_label ||
    form.frequence ||
    form.frequency_label ||
    (isAbonnement ? 'Abonnement mensuel' : 'Prestation ponctuelle');

  // Start Date
  const rawStart =
    form.date_demarrage ||
    form.date_debut ||
    demande.planning?.date_debut ||
    demande.date_intervention ||
    demande.created_at;

  const parsedStart = parseDateRobust(rawStart) || new Date();
  const startDateStr = `${parsedStart.getFullYear()}-${String(parsedStart.getMonth() + 1).padStart(2, '0')}-${String(parsedStart.getDate()).padStart(2, '0')}`;
  const formattedStartDate = parsedStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Default duration
  const isGrand = String(demande.service || form.type_prestation || form.service || '').toLowerCase().includes('grand');
  const defaultDuree = Number(demande.nb_heures || form.duree || form.nb_heures || (isGrand ? 6 : 4));
  const defaultStart = form.heure || (demande as any).heure || '09:00';
  const defaultEnd = computeEndTimeStr(defaultStart, defaultDuree);

  // Extract Days
  let interventionDays: SubscriptionDayDetail[] = [];
  const rawDetail = form.jours_intervention_detail;

  if (Array.isArray(rawDetail) && rawDetail.length > 0) {
    rawDetail.forEach((item: any) => {
      const jKey = typeof item === 'string' ? item.toLowerCase() : item?.jour?.toLowerCase();
      if (jKey && DAY_MAP_INDEX[jKey] !== undefined) {
        const sTime = item?.heure_debut || defaultStart;
        const eTime = item?.heure_fin || computeEndTimeStr(sTime, defaultDuree);
        const idx = DAY_MAP_INDEX[jKey];
        interventionDays.push({
          dayKey: jKey,
          dayName: DAY_LABELS_CAP[idx],
          heureDebut: sTime,
          heureFin: eTime
        });
      }
    });
  }

  if (interventionDays.length === 0) {
    const rawJours = form.jours_intervention || demande.planning?.jours_intervention || form.jours_passage || (demande as any).jours_passage;
    const extracted = extractJoursPassage(rawJours);

    if (extracted.length > 0) {
      extracted.forEach((jKey: string) => {
        const idx = DAY_MAP_INDEX[jKey.toLowerCase()];
        if (idx !== undefined) {
          interventionDays.push({
            dayKey: jKey.toLowerCase(),
            dayName: DAY_LABELS_CAP[idx],
            heureDebut: defaultStart,
            heureFin: defaultEnd
          });
        }
      });
    }
  }

  // Fallback if no days specified but it's subscription
  if (interventionDays.length === 0 && isAbonnement) {
    // Pick start date day of week
    const startDow = parsedStart.getDay();
    const jKey = DAY_NAMES_FR[startDow];
    interventionDays.push({
      dayKey: jKey,
      dayName: DAY_LABELS_CAP[startDow],
      heureDebut: defaultStart,
      heureFin: defaultEnd
    });
  }

  // Build Calendar for the target month
  const targetYear = parsedStart.getFullYear();
  const targetMonth = parsedStart.getMonth(); // 0-indexed
  const monthNameStr = parsedStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthTitle = monthNameStr.charAt(0).toUpperCase() + monthNameStr.slice(1);

  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const activeDowSet = new Set(interventionDays.map(d => DAY_MAP_INDEX[d.dayKey]));

  // Track occurrences per day of week to flag 5th week
  const dowCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const calendarDays: PlanningCalendarDay[] = [];

  let totalPassagesCount = 0;
  let fifthWeekCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(targetYear, targetMonth, d);
    const dow = dateObj.getDay();
    const dateIso = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const isMatchDay = activeDowSet.has(dow);
    const isAfterStart = dateIso >= startDateStr;
    const isIntervention = isMatchDay && isAfterStart;

    let is5thWeek = false;
    if (isMatchDay) {
      dowCounts[dow]++;
      if (dowCounts[dow] >= 5 && isIntervention) {
        is5thWeek = true;
        fifthWeekCount++;
      }
    }

    if (isIntervention) {
      totalPassagesCount++;
    }

    const matchedDetail = interventionDays.find(id => DAY_MAP_INDEX[id.dayKey] === dow);

    calendarDays.push({
      dayNumber: d,
      dateIso,
      dayOfWeekIndex: dow,
      isCurrentMonth: true,
      isIntervention,
      is5thWeek,
      heureDebut: matchedDetail?.heureDebut || defaultStart,
      heureFin: matchedDetail?.heureFin || defaultEnd
    });
  }

  return {
    isAbonnement,
    frequencyLabel: freqLabel,
    startDateStr,
    formattedStartDate,
    monthTitle,
    interventionDays,
    calendarDays,
    totalPassagesCount,
    fifthWeekCount
  };
};

/**
 * Renders the Jours d'intervention & Planning Calendar section into a jsPDF document.
 * Returns the updated Y coordinate.
 */
export const renderSubscriptionPlanningPDF = (
  doc: jsPDF,
  demande: Demande,
  startY: number
): number => {
  const schedule = extractSubscriptionScheduleData(demande);
  if (!schedule.isAbonnement || schedule.interventionDays.length === 0) {
    return startY;
  }

  const PAGE_W = 210;
  const MARGIN = 15;
  const RIGHT = PAGE_W - MARGIN;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color palette matching Agence Ménage PDF styling
  const TEAL = [3, 114, 101];        // #037265
  const LIGHT_TEAL = [230, 246, 244]; // #e6f6f4
  const PURPLE = [147, 51, 234];     // #9333ea
  const LIGHT_PURPLE = [243, 232, 255];
  const TEXT_DARK = [30, 41, 59];    // #1e293b
  const MUTED = [100, 116, 139];     // #64748b
  const BORDER_COLOR = [226, 232, 240];

  let y = startY;

  // Check if we need a new page for the planning
  if (y + 110 > pageHeight - 20) {
    doc.addPage();
    y = 20;
  } else {
    y += 8;
  }

  // Section Header Divider
  doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]).setLineWidth(0.6).line(MARGIN, y, RIGHT, y);
  y += 6;

  // Title: JOURS D'INTERVENTION & HORAIRES
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text("1. JOURS D'INTERVENTION & HORAIRES", MARGIN, y);
  y += 7;

  // Render Days Pills / Cards
  const colWidth = Math.min(CONTENT_W / schedule.interventionDays.length, 85);
  let cardX = MARGIN;

  schedule.interventionDays.forEach((day) => {
    // Pill Card Box
    doc.setFillColor(LIGHT_TEAL[0], LIGHT_TEAL[1], LIGHT_TEAL[2]);
    doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, y, colWidth - 4, 14, 3, 3, "FD");

    // Day Name
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(TEAL[0], TEAL[1], TEAL[2]);
    doc.text(day.dayName, cardX + 6, y + 6);

    // Horaires
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
    doc.text(`${day.heureDebut} à ${day.heureFin}`, cardX + 6, y + 11);

    cardX += colWidth;
  });

  y += 19;

  // Section Title: CALENDRIER PRÉVISIONNEL DES INTERVENTIONS
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text(`2. CALENDRIER PRÉVISIONNEL (${schedule.monthTitle.toUpperCase()})`, MARGIN, y);

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`Date de démarrage : ${schedule.formattedStartDate}`, RIGHT, y, { align: "right" });
  y += 6;

  // Render Calendar Table Grid (7 Columns: LUN, MAR, MER, JEU, VEN, SAM, DIM)
  const COL_NAMES = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
  const colW = CONTENT_W / 7; // ~25.7 mm
  const headerH = 7;
  const rowH = 11;

  // Calendar Header Row
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(MARGIN, y, CONTENT_W, headerH, "F");

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(255, 255, 255);
  COL_NAMES.forEach((colName, idx) => {
    const cx = MARGIN + idx * colW + colW / 2;
    doc.text(colName, cx, y + 5, { align: "center" });
  });

  y += headerH;

  // Calculate calendar grid structure
  // In JS Date, Sunday is 0, Monday is 1...
  // For French Monday-first grid: Monday=0, Tuesday=1, ..., Sunday=6
  const getFrenchDowIndex = (jsDow: number) => (jsDow === 0 ? 6 : jsDow - 1);

  const firstDayObj = new Date(schedule.calendarDays[0].dateIso);
  const firstDowFrench = getFrenchDowIndex(firstDayObj.getDay());

  let currentGridRow = 0;
  let cellY = y;

  // Draw empty leading cells before 1st of month if any
  for (let emptyIdx = 0; emptyIdx < firstDowFrench; emptyIdx++) {
    const ex = MARGIN + emptyIdx * colW;
    doc.setFillColor(248, 250, 252); // light slate #f8fafc
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.2);
    doc.rect(ex, cellY, colW, rowH, "FD");
  }

  // Draw month day cells
  schedule.calendarDays.forEach((dayData) => {
    const dowFrench = getFrenchDowIndex(dayData.dayOfWeekIndex);
    const cx = MARGIN + dowFrench * colW;
    const cy = y + currentGridRow * rowH;

    if (dayData.isIntervention) {
      if (dayData.is5thWeek) {
        doc.setFillColor(LIGHT_PURPLE[0], LIGHT_PURPLE[1], LIGHT_PURPLE[2]);
        doc.setDrawColor(PURPLE[0], PURPLE[1], PURPLE[2]);
      } else {
        doc.setFillColor(LIGHT_TEAL[0], LIGHT_TEAL[1], LIGHT_TEAL[2]);
        doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
      }
      doc.setLineWidth(0.4);
      doc.rect(cx, cy, colW, rowH, "FD");

      // Day number
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(TEAL[0], TEAL[1], TEAL[2]);
      doc.text(String(dayData.dayNumber), cx + 2.5, cy + 4.5);

      // Intervention Badge inside cell
      const badgeW = colW - 4;
      const badgeH = 4.5;
      const badgeX = cx + 2;
      const badgeY = cy + 5.5;

      if (dayData.is5thWeek) {
        doc.setFillColor(PURPLE[0], PURPLE[1], PURPLE[2]);
      } else {
        doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
      }
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1, 1, "F");

      doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(255, 255, 255);
      doc.text("À VENIR", badgeX + badgeW / 2, badgeY + 3.2, { align: "center" });

    } else {
      // Normal Day
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      doc.setLineWidth(0.2);
      doc.rect(cx, cy, colW, rowH, "FD");

      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(String(dayData.dayNumber), cx + 2.5, cy + 4.5);
    }

    if (dowFrench === 6) {
      currentGridRow++;
    }
  });

  // Fill trailing empty cells of last week row
  const lastDayObj = new Date(schedule.calendarDays[schedule.calendarDays.length - 1].dateIso);
  const lastDowFrench = getFrenchDowIndex(lastDayObj.getDay());
  if (lastDowFrench < 6) {
    for (let emptyIdx = lastDowFrench + 1; emptyIdx <= 6; emptyIdx++) {
      const ex = MARGIN + emptyIdx * colW;
      const ey = y + currentGridRow * rowH;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      doc.setLineWidth(0.2);
      doc.rect(ex, ey, colW, rowH, "FD");
    }
    currentGridRow++;
  } else {
    currentGridRow++;
  }

  y += currentGridRow * rowH + 4;

  // Summary & Legend Row
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text(`Total : ${schedule.totalPassagesCount} intervention(s) prévues sur ${schedule.monthTitle.toLowerCase()}`, MARGIN, y);

  // Legend badges on right
  let legX = RIGHT - 75;
  // Legend 1: Passage prévu
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(legX, y - 2.5, 3, 3, "F");
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text("Passage prévu", legX + 4.5, y);

  legX += 35;
  // Legend 2: 5ème semaine
  doc.setFillColor(PURPLE[0], PURPLE[1], PURPLE[2]);
  doc.rect(legX, y - 2.5, 3, 3, "F");
  doc.text("5ème semaine", legX + 4.5, y);

  y += 8;

  // Check if validation box fits before signatures on current page
  if (y + 16 > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  // Validation Note & Client Agreement Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 2, 2, "FD");

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
  doc.text("Validation du planning d'intervention et Bon pour accord :", MARGIN + 4, y + 5);

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Ce planning est établi à titre prévisionnel et servira de référence pour les prestations de l'abonnement.", MARGIN + 4, y + 10);
  doc.text("Nom & Signature du client précédés de la mention « Bon pour accord » :", RIGHT - 4, y + 5, { align: "right" });

  y += 32; // 16mm box height + 16mm breathing space before signatures block

  return y;
};
