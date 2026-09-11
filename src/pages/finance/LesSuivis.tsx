import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { encodeId } from '../../utils/obfuscation';
import StickyHorizontalScrollbar from '../../components/common/StickyHorizontalScrollbar';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Search,
  Users,
  TrendingUp,
  DollarSign,
  X,
  Clock,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Info,
  Sparkles,
  Folder
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getMissions,
  getDemandesHistorique,
  getAgents,
  getDemandes,
  updateMission,
  updateDemande,
  getUsers
} from '../../api/client';
import { useToastStore } from '../../store/toast';
import { useAuthStore } from '../../store/auth';
import { hasPermission, hasPermissionWithContext } from '../../utils/permissions';
import { getDynamicMonthPassagesCount } from '../../utils/pricing';
import { isFinanceRowVisible, getStatusInfo } from '../../utils/statusUtils';
import { getStatutPaiementFromMode } from '../../utils/paymentRules';
import { emitFinanceSync, useFinanceSync } from '../../utils/paymentSync';
import './LesSuivis.css';
import logoUrl from '../../assets/LOGO-AGENCE-MENAGE.png';
import signatureUrl from '../../assets/signature.png';

let cachedLogoBase64: string | null = null;
const loadLogoBase64 = async (): Promise<string | null> => {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

let cachedSignatureBase64: string | null = null;
const loadSignatureBase64 = async (): Promise<string | null> => {
  if (cachedSignatureBase64) return cachedSignatureBase64;
  try {
    const response = await fetch(signatureUrl);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedSignatureBase64 = reader.result as string;
        resolve(cachedSignatureBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// Interface matching the FacturationRow definition in VueGlobale
interface FacturationRow {
  missionId?: number;
  demandeId?: number;
  clientId?: number;
  profilId?: number;
  categorie?: 'interne' | 'externe' | string;
  missionNo: string;
  date: string;
  client: string;
  ville: string;
  profil: string;
  service: string;
  segment: 'Particulier' | 'Entreprise';
  montant: number;
  modePaiement: string;
  partAgence: number;
  partProfil: number;
  encaissePar: 'Agence' | 'Profil';
  paiement: 'non_paye' | 'partiellement_paye' | 'paye';
  statut: 'Annulé' | 'Facturation annulée' | 'Intervention annulée' | 'Intervention gratuite' | 'Confirmée' | 'Terminée' | 'Payé' | 'A jour' | 'En attente';
  reglementInterne: string;
  montantPaye?: number;
  montantEncaisseProfil?: number;
  datePaiement?: string;
  modePaiementReel?: string;
  commercialName?: string;
  partProfilVersee?: boolean;
  dateVersementProfil?: string;
  partAgenceReversee?: boolean;
  dateRemiseAgence?: string;
  parentDemandeId?: number | null;
  frequency?: string | null;
  isSubscriptionPrimary?: boolean;
  isSubscriptionSecondary?: boolean;
  subscriptionDenominator?: number;
  subscriptionInterventionCA?: number;
  subscriptionMonth?: number | null;
  // New fields from Dashboard
  annulationRaison?: string;
  profilSeraPaye?: boolean;
  montantProfilAnnulation?: number;
  montantAgenceDoitProfil?: number;
  montantProfilDoitAgence?: number;
  statutPaiementUi?: string;
  phone?: string;
  tvaActive?: boolean;
  originalDemande?: any;
  originalMission?: any;
  parts_repartition?: any[];
  _uniqueKey?: string;
  cao?: boolean | string | number;
  note_commercial?: string;
  _partProfilDue?: number;
  _partProfilVersee?: boolean;
  _partAgenceDue?: number;
  _partAgenceReversee?: boolean;
  isFirstProfileOfRow?: boolean;
  isDelegate?: boolean;
  hasSupplementHeures?: boolean;
  supplementHeuresMontant?: number;
  supplementHeuresRecupereEspeces?: boolean;
  supplementEncaissePar?: 'femme_de_menage' | 'agence' | string;
  especesRecuperees?: number;
}

interface AgentApiItem {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  phone?: string;
  categorie?: 'interne' | 'externe' | string;
}

const money = (value: number): string => {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} DH`;
};

const formatDateFR = (value?: string): string => {
  if (!value) return '—';
  if (value.includes('/')) return value;
  const cleanValue = value.includes('T') ? value.split('T')[0] : value.split(' ')[0];
  const [year, month, day] = cleanValue.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};


/** Formats a date string into e.g. "vendredi 04/09/2026" */
const formatDateFRWithDay = (value?: string): string => {
  if (!value || value === '—') return '—';
  const clean = value.includes('T') ? value.split('T')[0] : value.split(' ')[0];
  let d: Date | null = null;
  if (clean.includes('/')) {
    const [day, month, year] = clean.split('/');
    d = new Date(Number(year), Number(month) - 1, Number(day));
  } else if (clean.includes('-')) {
    const [year, month, day] = clean.split('-');
    d = new Date(Number(year), Number(month) - 1, Number(day));
  }
  if (!d || isNaN(d.getTime())) return formatDateFR(value);
  const weekday = d.toLocaleDateString('fr-FR', { weekday: 'long' });
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${weekday} ${day}/${month}/${year}`;
};

/** Calculates Friday-to-Thursday cycle for a given base date string (YYYY-MM-DD) or Date object, with week offset */
const getWeekFromFriday = (baseDate?: string | Date, offsetWeeks: number = 0) => {
  let ref: Date;
  if (typeof baseDate === 'string' && baseDate) {
    const clean = baseDate.includes('T') ? baseDate.split('T')[0] : baseDate.split(' ')[0];
    if (clean.includes('-')) {
      const [y, m, d] = clean.split('-').map(Number);
      ref = new Date(y, m - 1, d);
    } else if (clean.includes('/')) {
      const [d, m, y] = clean.split('/').map(Number);
      ref = new Date(y, m - 1, d);
    } else {
      ref = new Date();
    }
  } else if (baseDate instanceof Date && !isNaN(baseDate.getTime())) {
    ref = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  } else {
    ref = new Date();
  }

  if (isNaN(ref.getTime())) {
    ref = new Date();
  }

  // Friday is day 5. If day is 5 (Fri) -> diff is 0; 6 (Sat) -> 1; 0 (Sun) -> 2; 1 (Mon) -> 3; 2 (Tue) -> 4; 3 (Wed) -> 5; 4 (Thu) -> 6
  const day = ref.getDay();
  const diffToFriday = day >= 5 ? day - 5 : day + 2;
  const friday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - diffToFriday + (offsetWeeks * 7));
  const thursday = new Date(friday.getFullYear(), friday.getMonth(), friday.getDate() + 6);

  const formatISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    from: formatISO(friday),
    to: formatISO(thursday),
    friday,
    thursday,
  };
};

/** Calculates the default weekly cycle from Friday to Thursday for any given reference date */
const getDefaultWeeklyFridayToThursday = (refDate = new Date()) => {
  return getWeekFromFriday(refDate, 0);
};

const isCreditRow = (row: FacturationRow): boolean => {
  const isCancelled =
    row.statut === 'Facturation annulée' ||
    row.statut === 'Intervention annulée' ||
    row.statutPaiementUi === 'facturation_annulee' ||
    row.statutPaiementUi === 'Facturation annulée';

  if (!isCancelled && (row.statutPaiementUi === 'paiement_partiel' || row.statutPaiementUi === 'Paiement partiel' || row.modePaiement === 'virement_especes' || row.modePaiementReel === 'Virement / Espèce')) {
    return Number(row.montantAgenceDoitProfil || 0) > 0;
  }

  return (
    row.statutPaiementUi === 'agence_payee_client' ||
    row.statutPaiementUi === 'Agence payée / Client' ||
    row.statutPaiementUi === 'commercial_paye_client' ||
    row.statutPaiementUi === 'Commercial payé / client' ||
    (row.statutPaiementUi === 'paye' && row.encaissePar === 'Agence') ||
    ((isCancelled || row.statut === 'Intervention annulée') && row.profilSeraPaye) ||
    row.statutPaiementUi === 'intervention_gratuite' ||
    row.statut === 'Intervention gratuite' ||
    (!row.statutPaiementUi && row.encaissePar === 'Agence')
  );
};

const isDebitRow = (row: FacturationRow): boolean => {
  const isCancelled =
    row.statut === 'Facturation annulée' ||
    row.statut === 'Intervention annulée' ||
    row.statutPaiementUi === 'facturation_annulee' ||
    row.statutPaiementUi === 'Facturation annulée' ||
    row.statut === 'Intervention gratuite' ||
    row.statutPaiementUi === 'intervention_gratuite';

  if (isCancelled) return false;

  if (row.statutPaiementUi === 'paiement_partiel' || row.statutPaiementUi === 'Paiement partiel' || row.modePaiement === 'virement_especes' || row.modePaiementReel === 'Virement / Espèce') {
    return Number(row.montantProfilDoitAgence || 0) > 0;
  }

  return (
    row.statutPaiementUi === 'profil_paye_client' ||
    row.statutPaiementUi === 'Profil payé / Client' ||
    (row.statutPaiementUi === 'paye' && row.encaissePar === 'Profil') ||
    (!row.statutPaiementUi && row.encaissePar === 'Profil')
  );
};

const parseFrenchDate = (value?: string): Date | null => {
  if (!value || value === '—') return null;
  const clean = value.includes('T') ? value.split('T')[0] : value.split(' ')[0];
  if (clean.includes('-')) {
    const [year, month, day] = clean.split('-').map(Number);
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (clean.includes('/')) {
    const [day, month, year] = clean.split('/').map(Number);
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const getISODateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const modeLabelFromCode = (value?: string): string => {
  if (value === 'virement_ag' || value === 'virement') return 'Virement Ag';
  if (value === 'virement_com') return 'Virement Com';
  if (value === 'virement_especes') return 'Virement / Espèces';
  if (value === 'especes') return 'Espèces';
  if (value === 'carte') return 'Carte bancaire';
  if (value === 'cheque') return 'Par chèque';
  if (value === 'especes_agence') return "Espèces à l'agence";
  if (value === 'sur_place') return 'Sur place';
  return '—';
};

const getPaymentUiLabel = (uiCode: string | undefined): string => {
  if (!uiCode) return 'Non payé';
  const labels: Record<string, string> = {
    paye: 'A jour',
    agence_payee_client: 'Agence payée / Client',
    profil_paye_client: 'Profil payé / Client',
    commercial_paye_client: 'Commercial payé / client',
    paiement_partiel: 'Paiement partiel',
    paiement_en_attente: 'Paiement en attente',
    non_confirme: 'Non confirmé',
    facturation_annulee: 'Facturation annulée',
    intervention_gratuite: 'Intervention gratuite',
  };
  return labels[uiCode] || uiCode.replace(/_/g, ' ');
};

const getRealPaymentStatusLabel = (row: FacturationRow): string => {
  const uiVal = row.statutPaiementUi;
  const statut = row.statut;
  if (statut === 'Facturation annulée' || statut === 'Intervention annulée' || uiVal === 'facturation_annulee' || statut === 'Intervention gratuite' || uiVal === 'intervention_gratuite') {
    if (row.profilSeraPaye && (row.reglementInterne === 'Réglé' || row.partProfilVersee === true)) {
      return 'A jour';
    }
    return uiVal === 'intervention_gratuite' || statut === 'Intervention gratuite' ? 'Intervention gratuite' : (statut === 'Intervention annulée' ? 'Intervention annulée' : 'Facturation annulée');
  }
  if (uiVal === 'paye' || row.paiement === 'paye' || statut === 'Payé' || statut === 'A jour') {
    return 'A jour';
  }
  return getPaymentUiLabel(uiVal);
};

const getRealPaymentStatusClass = (row: FacturationRow): string => {
  const uiVal = row.statutPaiementUi;
  const statut = row.statut;
  if (statut === 'Facturation annulée' || statut === 'Intervention annulée' || uiVal === 'facturation_annulee' || statut === 'Intervention gratuite' || uiVal === 'intervention_gratuite') {
    if (row.profilSeraPaye && (row.reglementInterne === 'Réglé' || row.partProfilVersee === true)) {
      return 'green';
    }
    return uiVal === 'intervention_gratuite' || statut === 'Intervention gratuite' ? 'green' : 'pink';
  }
  if (uiVal === 'paye' || row.paiement === 'paye' || statut === 'Payé' || statut === 'A jour') {
    return 'green';
  }
  if (['agence_payee_client', 'profil_paye_client', 'commercial_paye_client', 'paiement_partiel', 'paiement_en_attente'].includes(uiVal || '')) {
    return 'blue';
  }
  return 'gray';
};

// Top-level helpers identical to VueGlobale.tsx
const getPartProfilDueFromAgence = (row: FacturationRow): number => {
  const isVirEsp = row.statutPaiementUi === 'paiement_partiel' || row.statutPaiementUi === 'Paiement partiel' || row.modePaiement === 'virement_especes' || row.modePaiementReel === 'Virement / Espèce';
  if (isVirEsp) {
    return Number(row.montantAgenceDoitProfil || 0);
  }

  if (
    row.statutPaiementUi === 'agence_payee_client' ||
    row.statutPaiementUi === 'Agence payée / Client' ||
    row.statutPaiementUi === 'commercial_paye_client' ||
    row.statutPaiementUi === 'Commercial payé / client'
  ) {
    if (Number(row.montantAgenceDoitProfil || 0) > 0) {
      return Number(row.montantAgenceDoitProfil);
    }
  }

  const isInterventionGratuite = row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite';

  if (row.statutPaiementUi === 'facturation_annulee' || row.statutPaiementUi === 'Facturation annulée' || row.statut === 'Facturation annulée' || row.statut === 'Intervention annulée' || isInterventionGratuite) {
    return row.profilSeraPaye ? Number(row.montantProfilAnnulation || 0) : 0;
  }

  if (row.encaissePar !== 'Agence') return 0;

  if (row.montantAgenceDoitProfil !== undefined && row.montantAgenceDoitProfil > 0) {
    return row.montantAgenceDoitProfil;
  }

  if (row.montant > 0) {
    const due = Number((Number(row.montantPaye ?? 0) * (row.partProfil / row.montant)).toFixed(2));
    if (due > 0) return Math.min(row.partProfil, due);
  }

  return row.partProfil;
};

const getPartAgenceDueFromProfil = (row: FacturationRow): number => {
  const isVirEsp = row.statutPaiementUi === 'paiement_partiel' || row.statutPaiementUi === 'Paiement partiel' || row.modePaiement === 'virement_especes' || row.modePaiementReel === 'Virement / Espèce';
  if (isVirEsp) {
    return Number(row.montantProfilDoitAgence || 0);
  }

  if (row.statutPaiementUi === 'profil_paye_client' || row.statutPaiementUi === 'Profil payé / Client') {
    return Number(row.montantProfilDoitAgence || 0);
  }

  if (row.statutPaiementUi === 'facturation_annulee' || row.statut === 'Facturation annulée' || row.statut === 'Intervention annulée' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite') {
    return 0;
  }

  if (row.encaissePar !== 'Profil') return 0;

  if (row.reglementInterne === 'Réglé' || row.partAgenceReversee) {
    return Number(row.montantProfilDoitAgence || row.partAgence || 0);
  }

  if (row.montantProfilDoitAgence !== undefined && row.montantProfilDoitAgence > 0) {
    return row.montantProfilDoitAgence;
  }

  if (row.montant > 0) {
    const due = Number((Number(row.montantEncaisseProfil ?? row.montantPaye ?? 0) * (row.partAgence / row.montant)).toFixed(2));
    if (due > 0) return Math.min(row.partAgence, due);
  }

  return row.partAgence;
};

const isRowEncaisseEtValide = (row: FacturationRow): boolean => {
  const isCancelled =
    row.statut === 'Facturation annulée' ||
    row.statut === 'Intervention annulée' ||
    row.statutPaiementUi === 'facturation_annulee' ||
    row.statut === 'Intervention gratuite' ||
    row.statutPaiementUi === 'intervention_gratuite';

  if (isCancelled) return false;

  return (
    row.statut === 'Payé' ||
    row.statut === 'A jour' ||
    row.statutPaiementUi === 'paye' ||
    row.statutPaiementUi === 'integral' ||
    row.paiement === 'paye'
  );
};

const getSubscriptionDeductions = (parentDemandeId: number, allRows: FacturationRow[]): number => {
  return allRows.reduce((sum, r) => {
    if (
      r.isSubscriptionSecondary &&
      Number(r.parentDemandeId) === Number(parentDemandeId) &&
      r.statut !== 'Facturation annulée' &&
      r.statut !== 'Intervention annulée' &&
      r.statutPaiementUi !== 'facturation_annulee' &&
      r.statut !== 'Intervention gratuite' &&
      r.statutPaiementUi !== 'intervention_gratuite'
    ) {
      return sum + r.partProfil;
    }
    return sum;
  }, 0);
};

const getRowCommercialStats = (row: FacturationRow, allRows: FacturationRow[]) => {
  if (row.isSubscriptionSecondary) {
    return { ca: 0, partAgence: 0 };
  }

  if (row.frequency === 'abonnement' || row.isSubscriptionPrimary) {
    const parentId = row.demandeId;
    if (parentId) {
      const deductions = getSubscriptionDeductions(parentId, allRows);
      return {
        ca: Math.max(0, row.montant - deductions),
        partAgence: Math.max(0, row.partAgence - deductions)
      };
    }
  }

  return {
    ca: row.montant,
    partAgence: row.partAgence
  };
};

const getRowDuesBreakdown = (row: FacturationRow) => {
  const isVirEsp = row.statutPaiementUi === 'paiement_partiel' || row.statutPaiementUi === 'Paiement partiel' || row.modePaiement === 'virement_especes' || row.modePaiementReel === 'Virement / Espèce';
  const isCredit = isCreditRow(row);
  const isDebit = isDebitRow(row);

  let doitAgence = 0;
  let hasSupplementNote = false;
  let agenceDoit = 0;
  const supplementMontant = Number(row.supplementHeuresMontant || 0);
  const hasSupplement = Boolean(row.hasSupplementHeures && supplementMontant > 0);
  const isFdmCash = row.supplementEncaissePar === 'femme_de_menage' || (
    row.supplementEncaissePar !== 'agence' && Boolean(row.supplementHeuresRecupereEspeces)
  );

  if (isVirEsp) {
    if (Number(row.montantAgenceDoitProfil || 0) > 0) {
      agenceDoit = Number(row.montantAgenceDoitProfil);
    }
    if (Number(row.montantProfilDoitAgence || 0) > 0) {
      doitAgence = Number(row.montantProfilDoitAgence);
    }
  } else if (isCredit) {
    agenceDoit = Number(row.montantAgenceDoitProfil || row.partProfil || 0);
    if (row.isDelegate && hasSupplement && isFdmCash) {
      doitAgence += supplementMontant;
      hasSupplementNote = true;
    }
  } else if (isDebit) {
    if (row.montantProfilDoitAgence !== undefined && Number(row.montantProfilDoitAgence) > 0) {
      doitAgence = Number(row.montantProfilDoitAgence);
    } else if (hasSupplement && row.supplementEncaissePar === 'agence') {
      doitAgence = Math.max(0, (row.partAgence || 0) - supplementMontant);
    } else {
      doitAgence = row.partAgence || 0;
    }
    if (hasSupplement && isFdmCash) {
      hasSupplementNote = true;
    }
  }

  return {
    doitAgence,
    hasSupplementNote,
    agenceDoit,
    hasSupplement,
    supplementMontant,
    especesRecuperees: Number(row.especesRecuperees || 0),
  };
};

const generateProfileReceiptPdf = async (
  profile: {
    profilName: string;
    phone?: string;
    rows: FacturationRow[];
  },
  dateFromStr: string,
  dateToStr: string
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primaryColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const tealColor: [number, number, number] = [15, 118, 110]; // #0f766e
  const greenColor: [number, number, number] = [21, 128, 61]; // #15803d
  const pinkColor: [number, number, number] = [190, 18, 60]; // #be123c
  const textDark: [number, number, number] = [30, 41, 59];

  // 1. Logo et cachet de l'agence
  const [logoBase64, signatureBase64] = await Promise.all([
    loadLogoBase64(),
    loadSignatureBase64()
  ]);
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 11, 44, 19.3);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('AGENCE MÉNAGE', 14, 22);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('AGENCE MÉNAGE', 14, 22);
  }

  // Document Info Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(tealColor[0], tealColor[1], tealColor[2]);
  doc.text('REÇU DE RÈGLEMENT & DÉCOMPTE', 196, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, 196, 24, { align: 'right' });
  const periodLabel = `Semaine du ${formatDateFRWithDay(dateFromStr)} au ${formatDateFRWithDay(dateToStr)}`;
  doc.text(periodLabel, 196, 29, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 34, 196, 34);

  // Profile Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 38, 182, 22, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 38, 182, 22, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('FEMME DE MÉNAGE / INTERVENANTE', 20, 44);

  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(profile.profilName, 20, 52);

  if (profile.phone && profile.phone !== '—') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Tél : ${profile.phone}`, 120, 52);
  }

  // Filter rows strictly to the specified week period
  const periodRows = (profile.rows || []).filter((r) => {
    if (!dateFromStr && !dateToStr) return true;
    const rDate = parseFrenchDate(r.date);
    if (!rDate) return false;
    const rIso = getISODateLocal(rDate);
    if (dateFromStr && rIso < dateFromStr) return false;
    if (dateToStr && rIso > dateToStr) return false;
    return true;
  });

  // Calculate table rows and totals for the selected period
  let totalDoitAgence = 0;
  let totalAgenceDoit = 0;
  let totalSupplements = 0;

  const tableRows = periodRows.map((row) => {
    const b = getRowDuesBreakdown(row);
    totalDoitAgence += b.doitAgence;
    totalAgenceDoit += b.agenceDoit;
    if (b.hasSupplementNote && b.supplementMontant > 0) {
      totalSupplements += b.supplementMontant;
    }

    const dateVal = row.date ? formatDateFR(row.date) : '—';
    const suppBadge = b.supplementMontant > 0 ? ` (Supplément : ${b.supplementMontant.toFixed(2)} DH)` : '';
    const espBadge = b.especesRecuperees > 0 ? ` (Espèces perçues FDM : ${b.especesRecuperees.toFixed(2)} DH)` : '';
    const clientVal = `${row.client || '—'}${suppBadge}${espBadge}`;
    const suppLabel = b.supplementMontant > 0
      ? ` (Supplément espèces : ${b.supplementMontant.toFixed(2)} DH)`
      : (b.hasSupplementNote ? ' (Supplément espèces)' : '');
    const doitAgenceCell = b.doitAgence > 0 ? `${b.doitAgence.toFixed(2)} DH${suppLabel}` : '—';
    const agenceDoitCell = b.agenceDoit > 0 ? `${b.agenceDoit.toFixed(2)} DH` : '—';

    return [dateVal, clientVal, doitAgenceCell, agenceDoitCell];
  });

  // Summary KPI Boxes
  const kpiY = 65;
  const colW = 58;

  // Box 1: Missions
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, kpiY, colW, 16, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, kpiY, colW, 16, 2, 2, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Missions', 18, kpiY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`${periodRows.length}`, 18, kpiY + 13);

  // Box 2: Revenu (Doit à l'agence)
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14 + colW + 4, kpiY, colW, 16, 2, 2, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14 + colW + 4, kpiY, colW, 16, 2, 2, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52);
  doc.text("Revenu (Doit à l'agence)", 18 + colW + 4, kpiY + 6);
  if (totalSupplements > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`dont suppl.: ${totalSupplements.toFixed(2)} DH`, 18 + colW + 28, kpiY + 6);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(greenColor[0], greenColor[1], greenColor[2]);
  doc.text(`${totalDoitAgence.toFixed(2)} DH`, 18 + colW + 4, kpiY + 13);

  // Box 3: À payer (Agence doit au profil)
  doc.setFillColor(255, 241, 242);
  doc.roundedRect(14 + (colW + 4) * 2, kpiY, colW, 16, 2, 2, 'F');
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(14 + (colW + 4) * 2, kpiY, colW, 16, 2, 2, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(159, 18, 57);
  doc.text('À payer (Agence doit au profil)', 18 + (colW + 4) * 2, kpiY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(pinkColor[0], pinkColor[1], pinkColor[2]);
  doc.text(`${totalAgenceDoit.toFixed(2)} DH`, 18 + (colW + 4) * 2, kpiY + 13);

  // AutoTable
  autoTable(doc, {
    startY: kpiY + 22,
    margin: { left: 14, right: 14 },
    head: [['Date', 'Client', "Doit à l'agence", 'Agence doit au profil']],
    body: tableRows,
    foot: [
      ['Total', '', `${totalDoitAgence.toFixed(2)} DH`, `${totalAgenceDoit.toFixed(2)} DH`]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    bodyStyles: {
      textColor: [30, 41, 59],
      fontSize: 9,
      cellPadding: 4,
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 4,
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 56 },
      2: { cellWidth: 44, halign: 'right' },
      3: { cellWidth: 44, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        if (data.column.index === 2 || data.column.index === 3) {
          data.cell.styles.halign = 'right';
        }
      }
      if (data.section === 'body') {
        if (data.column.index === 2) {
          data.cell.styles.textColor = [21, 128, 61];
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        } else if (data.column.index === 3) {
          data.cell.styles.textColor = [190, 18, 60];
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.section === 'foot') {
        if (data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [15, 23, 42];
        } else if (data.column.index === 2) {
          data.cell.styles.textColor = [21, 128, 61];
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        } else if (data.column.index === 3) {
          data.cell.styles.textColor = [190, 18, 60];
          data.cell.styles.halign = 'right';
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Bottom Note
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(217, 119, 6);
  doc.text('• NB : La période mentionnée va toujours du vendredi au jeudi.', 14, finalY + 8);

  // Net Balance box
  const netSolde = totalAgenceDoit - totalDoitAgence;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY + 14, 182, 14, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, finalY + 14, 182, 14, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('SOLDE NET :', 20, finalY + 23);

  doc.setFontSize(11);
  if (netSolde > 0) {
    doc.setTextColor(pinkColor[0], pinkColor[1], pinkColor[2]);
    doc.text(`Agence doit au profil : ${netSolde.toFixed(2)} DH`, 110, finalY + 23);
  } else if (netSolde < 0) {
    doc.setTextColor(greenColor[0], greenColor[1], greenColor[2]);
    doc.text(`Profil doit à l'agence : ${Math.abs(netSolde).toFixed(2)} DH`, 110, finalY + 23);
  } else {
    doc.setTextColor(71, 85, 105);
    doc.text('Solde équilibré : 0,00 DH', 110, finalY + 23);
  }

  // Signatures
  let signY = finalY + 34;
  if (signY + 32 > 282) {
    doc.addPage();
    signY = 25;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text("Signature & Cachet de l'Agence", 30, signY);
  doc.text("Signature de l'Intervenante", 130, signY);

  if (signatureBase64) {
    try {
      doc.addImage(signatureBase64, 'PNG', 28, signY + 3, 50, 24);
    } catch {
      // ignore
    }
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(30, signY + 28, 85, signY + 28);
  doc.line(130, signY + 28, 185, signY + 28);

  const cleanName = profile.profilName.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Recu_${cleanName}_${dateFromStr}_${dateToStr}.pdf`);
};

export default function LesSuivis() {
  const { user } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const navigate = useNavigate();

  // Navigation handlers
  const goToProfilDetails = (id?: number) => {
    if (id) navigate(`/profils/${encodeId(id)}`);
  };
  const goToClientDetails = (id?: number) => {
    if (id) navigate(`/clients/${encodeId(id)}`);
  };

  const canSeeDus = hasPermission(user, 'consulter_dus_agences_profils');
  const canSeeCommerciaux = hasPermission(user, 'consulter_suivi_commerciaux');
  const defaultTab = canSeeDus ? 'dus-profils' : (canSeeCommerciaux ? 'commerciaux' : 'dus-profils');

  // State Management
  const [activeTab, setActiveTab] = useState<'dus-profils' | 'commerciaux'>(defaultTab);
  const [isLoading, setIsLoading] = useState(true);
  const [facturationData, setFacturationData] = useState<FacturationRow[]>([]);
  const [commerciauxList, setCommerciauxList] = useState<any[]>([]);
  const [agentsList, setAgentsList] = useState<AgentApiItem[]>([]);
  const [demandsMap, setDemandsMap] = useState<Map<number, any>>(new Map());
  const dusTableWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canSeeDus && activeTab === 'dus-profils' && canSeeCommerciaux) {
      setActiveTab('commerciaux');
    } else if (!canSeeCommerciaux && activeTab === 'commerciaux' && canSeeDus) {
      setActiveTab('dus-profils');
    }
  }, [canSeeDus, canSeeCommerciaux, activeTab]);

  // Default weekly date filter (Friday to Thursday)
  const defaultWeeklyDates = useMemo(() => getDefaultWeeklyFridayToThursday(), []);

  // Search & Filters Tab 1
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [encaissementFilter, setEncaissementFilter] = useState('all');
  const [kpiFilter, setKpiFilter] = useState<'all' | 'unpaid_agence' | 'unpaid_profil'>('all');
  const [isGroupedByProfil, setIsGroupedByProfil] = useState(false);
  const [freqFilter, setFreqFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(defaultWeeklyDates.from);
  const [dateTo, setDateTo] = useState(defaultWeeklyDates.to);

  // Week navigation (Friday to Thursday jumps)
  const handlePrevWeek = useCallback(() => {
    const week = getWeekFromFriday(dateFrom || new Date(), -1);
    setDateFrom(week.from);
    setDateTo(week.to);
  }, [dateFrom]);

  const handleNextWeek = useCallback(() => {
    const week = getWeekFromFriday(dateFrom || new Date(), 1);
    setDateFrom(week.from);
    setDateTo(week.to);
  }, [dateFrom]);

  const handleCurrentWeek = useCallback(() => {
    const week = getDefaultWeeklyFridayToThursday();
    setDateFrom(week.from);
    setDateTo(week.to);
  }, []);

  // New profile dues modals
  const [selectedDuesProfile, setSelectedDuesProfile] = useState<any | null>(null);
  const [settleConfirmProfile, setSettleConfirmProfile] = useState<any | null>(null);

  // Filters Tab 2
  const [periodFilter, setPeriodFilter] = useState<'mois-en-cours' | 'mois-dernier' | 'annee-en-cours' | 'tous' | 'personnalise'>('mois-en-cours');
  const [commercialFilter, setCommercialFilter] = useState<string>('all');
  const [commDateFrom, setCommDateFrom] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [commDateTo, setCommDateTo] = useState(() => getISODateLocal(new Date()));
  const [selectedCommercialName, setSelectedCommercialName] = useState<string | null>(null);

  // Modals
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FacturationRow | null>(null);

  // Mapping functions matching VueGlobale's logic exactly
  const mapMissionToFacturationRow = useCallback((item: any): FacturationRow => {
    const demande = item.demande_detail;
    const agent = item.agent_detail;
    const facturationData = demande?.formulaire_data?.facturation || {};
    const rawMontant = Number(demande?.prix) || Number(facturationData?.montant_ht) || 0;
    const rawMontantPaye = item.montant_paye !== undefined ? Number(item.montant_paye) : 0;

    const rawStatutPaiementUi =
      facturationData.statut_paiement_ui ||
      item.paiement_client_statut ||
      (demande?.statut_paiement === 'integral' ? 'paye' :
        demande?.statut_paiement === 'acompte' ? 'paiement_en_attente' :
          demande?.statut_paiement === 'partiel' ? 'paiement_partiel' :
            'non_paye');

    const commercialNameFallback = demande?.assigned_to_name || demande?.commercial_name || facturationData.commercial_name || '—';

    let encaissePar: FacturationRow['encaissePar'] = 'Agence';
    if (item.encaisse_par === 'profil') {
      encaissePar = 'Profil';
    } else if (item.encaisse_par === 'agence') {
      encaissePar = 'Agence';
    } else if (demande?.mode_paiement === 'sur_place') {
      encaissePar = 'Profil';
    } else if (['profil_paye_client', 'Profil payé / Client'].includes(rawStatutPaiementUi)) {
      encaissePar = 'Profil';
    } else if (['agence_payee_client', 'Agence payée / Client'].includes(rawStatutPaiementUi)) {
      encaissePar = 'Agence';
    } else if (['paye', 'integral', 'effectue'].includes(rawStatutPaiementUi)) {
      if (item.part_agence_reversee || facturationData.part_agence_reversee) {
        encaissePar = 'Profil';
      } else if (item.part_profil_versee || facturationData.part_profil_versee) {
        encaissePar = 'Agence';
      }
    }

    const parts = facturationData.parts_repartition || demande?.parts_repartition || [];
    let allProfilesPaid = false;
    if (Array.isArray(parts) && parts.length > 0) {
      allProfilesPaid = parts.every((p: any) => p.part_profil_versee);
    } else {
      if (encaissePar === 'Profil') {
        allProfilesPaid = true;
      } else {
        allProfilesPaid = Boolean(item.part_profil_versee || facturationData.part_profil_versee);
      }
    }

    const isPaidStatus = ['paye', 'integral', 'effectue', 'profil_paye_client', 'Profil payé / Client', 'agence_payee_client', 'Agence payée / Client', 'commercial_paye_client', 'Commercial payé / client'].includes(rawStatutPaiementUi);
    const isPartiallyPaidStatus = ['paiement_partiel', 'paiement_en_attente', 'Paiement partiel', 'Paiement en attente', 'partiel', 'acompte'].includes(rawStatutPaiementUi);

    const paiement: FacturationRow['paiement'] =
      (isPaidStatus && allProfilesPaid)
        ? 'paye'
        : (isPartiallyPaidStatus || isPaidStatus)
          ? 'partiellement_paye'
          : 'non_paye';

    const missionStatus = item.statut;
    const isGratuit = rawStatutPaiementUi === 'intervention_gratuite';
    const isFacturationAnnulee = !isGratuit && (facturationData.facturation_annulee === true || rawStatutPaiementUi === 'facturation_annulee' || rawStatutPaiementUi === 'Facturation annulée');
    const isInterventionAnnulee = !isFacturationAnnulee && (missionStatus === 'annulee' || missionStatus === 'annulée' || demande?.statut === 'annule' || demande?.statut === 'annulée');

    const statut: FacturationRow['statut'] =
      isGratuit
        ? 'Intervention gratuite'
        : isInterventionAnnulee
          ? 'Intervention annulée'
          : isFacturationAnnulee
            ? 'Facturation annulée'
            : paiement === 'paye'
              ? 'A jour'
              : paiement === 'partiellement_paye'
                ? 'Confirmée'
                : missionStatus === 'terminee'
                  ? 'Terminée'
                  : missionStatus === 'en_attente'
                    ? 'En attente'
                    : 'Confirmée';

    const partProfilVersee = Boolean(item.part_profil_versee || facturationData.part_profil_versee || (encaissePar === 'Agence' && allProfilesPaid));
    const partAgenceReversee = Boolean(item.part_agence_reversee || facturationData.part_agence_reversee || (encaissePar === 'Profil' && allProfilesPaid));

    const numMissions = Math.max(1, parts.length);
    const profilId = agent?.id;
    const partInfo = parts.find((p: any) => Number(p.profile_id) === Number(profilId));
    const montantProfile = Number(partInfo?.amount || 0);
    const totalProfilsAmount = parts.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
    const ratio = totalProfilsAmount > 0 && montantProfile > 0 ? (montantProfile / totalProfilsAmount) : (1 / numMissions);

    const montant = rawMontant * ratio;

    let montantPaye = rawMontantPaye * ratio;
    if (isPaidStatus) {
      montantPaye = Number(facturationData.montant_verse) || montant;
    } else if (isPartiallyPaidStatus) {
      montantPaye = Number(facturationData.montant_verse) || 0;
    } else if (montantPaye === 0 && paiement === 'paye') {
      montantPaye = montant;
    }

    let montantEncaisseProfil = item.montant_encaisse_profil !== undefined ? Number(item.montant_encaisse_profil) : 0;
    montantEncaisseProfil = montantEncaisseProfil * ratio;
    if (encaissePar === 'Profil' && montantEncaisseProfil === 0 && montantPaye > 0) {
      montantEncaisseProfil = montantPaye;
    }

    const reglementInterne = partProfilVersee ? 'Réglé' : 'Non réglé';

    const d_part_agence = demande?.part_agence;
    const d_parts_repartition = demande?.parts_repartition;

    const rawPartAgence = (facturationData.part_agence !== null && facturationData.part_agence !== undefined)
      ? Number(facturationData.part_agence)
      : (d_part_agence !== null && d_part_agence !== undefined)
        ? Number(d_part_agence)
        : 0;

    const partsSum = (d_parts_repartition && Array.isArray(d_parts_repartition))
      ? d_parts_repartition.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
      : 0;

    const hasRepartition = partsSum > 0 || 
      (facturationData.part_profil !== null && facturationData.part_profil !== undefined && Number(facturationData.part_profil) > 0) ||
      (facturationData.part_agence !== null && facturationData.part_agence !== undefined && Number(facturationData.part_agence) > 0) ||
      (d_part_agence !== null && d_part_agence !== undefined && Number(d_part_agence) > 0);

    const rawPartProfil = partsSum > 0
      ? partsSum
      : (facturationData.part_profil !== null && facturationData.part_profil !== undefined)
        ? Number(facturationData.part_profil)
        : (facturationData.montant_agence_doit_profil !== null && facturationData.montant_agence_doit_profil !== undefined && facturationData.montant_agence_doit_profil > 0)
          ? Number(facturationData.montant_agence_doit_profil)
          : hasRepartition
            ? Math.max(0, rawMontant - rawPartAgence)
            : 0;

    const partAgence = rawPartAgence * ratio;
    const partProfil = rawPartProfil * ratio;

    return {
      missionId: item.id,
      demandeId: demande?.id,
      clientId: demande?.client,
      profilId: agent?.id,
      categorie: agent?.categorie || demande?.profil_detail?.categorie,
      missionNo: `MSN-${String(item.id).padStart(6, '0')}`,
      date: formatDateFR(demande?.date_intervention),
      client: demande?.client_name || '—',
      ville: demande?.client_city || 'Casablanca',
      profil: agent?.full_name || '—',
      service: demande?.service || 'Service',
      segment: demande?.segment === 'entreprise' ? 'Entreprise' : 'Particulier',
      montant,
      modePaiement: demande?.mode_paiement_label || modeLabelFromCode(demande?.mode_paiement) || modeLabelFromCode(item.mode_paiement_reel),
      partAgence,
      partProfil,
      encaissePar,
      paiement,
      statut,
      reglementInterne,
      montantPaye,
      montantEncaisseProfil,
      datePaiement: item.date_paiement ? formatDateFR(item.date_paiement) : (paiement === 'non_paye' ? '—' : (demande?.date_intervention ? formatDateFR(demande.date_intervention) : formatDateFR(demande?.created_at))),
      modePaiementReel: modeLabelFromCode(item.mode_paiement_reel) || demande?.mode_paiement_label || modeLabelFromCode(demande?.mode_paiement) || '—',
      commercialName: commercialNameFallback,
      phone: agent?.phone || demande?.client_phone || '—',
      partProfilVersee,
      dateVersementProfil: item.date_versement_profil || facturationData.date_versement_profil || '—',
      partAgenceReversee,
      dateRemiseAgence: item.date_remise_agence || facturationData.date_remise_agence || '—',
      parentDemandeId: demande?.parent_demande || demande?.parent_demande_id || null,
      frequency: demande?.frequency || null,
      subscriptionMonth: demande?.formulaire_data?.subscription_month || null,
      annulationRaison: demande?.annulation_raison || item.annulation_raison || facturationData.annulation_raison,
      profilSeraPaye: (() => {
        const raw = demande?.profil_sera_paye !== undefined
          ? demande.profil_sera_paye
          : (item.profil_sera_paye !== undefined ? item.profil_sera_paye : facturationData.profil_sera_paye);
        return raw === true || raw === 1 || raw === '1' || String(raw).trim().toLowerCase() === 'oui' || String(raw).trim().toLowerCase() === 'true';
      })(),
      montantProfilAnnulation: Number(demande?.montant_profil_annulation || item.montant_profil_annulation || facturationData.montant_profil_annulation || 0) * ratio,
      montantAgenceDoitProfil: Number(demande?.montant_agence_doit_profil || item.montant_agence_doit_profil || facturationData.montant_agence_doit_profil || 0) * ratio,
      montantProfilDoitAgence: Number(demande?.montant_profil_doit_agence || item.montant_profil_doit_agence || facturationData.montant_profil_doit_agence || 0) * ratio,
      statutPaiementUi: rawStatutPaiementUi,
      tvaActive: Boolean(facturationData.tva_active ?? demande?.tva_active),
      originalDemande: demande,
      originalMission: item,
      parts_repartition: Array.isArray(facturationData.parts_repartition) && facturationData.parts_repartition.length > 0 ? facturationData.parts_repartition : Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0 ? d_parts_repartition : undefined,
      note_commercial: partInfo?.note_commercial || demande?.note_commercial || facturationData.note_commercial || '—',
      cao: (demande as any)?.cao || (item?.demande_detail as any)?.cao || (item as any)?.cao,
      isDelegate: Boolean(
        partInfo?.is_delegate ||
        (parts.length > 0 && parts.every((p: any) => !p.is_delegate) && Number(parts[0]?.profile_id) === Number(profilId)) ||
        parts.length <= 1 ||
        item.delegue_id === profilId ||
        demande?.delegue_id === profilId ||
        (!parts.length && agent?.id)
      ),
      hasSupplementHeures: Boolean(
        facturationData.has_supplement_heures ??
        demande?.has_supplement_heures ??
        item.has_supplement_heures ??
        (Number(facturationData.supplement_heures_montant ?? demande?.formulaire_data?.supplement_heures_montant ?? demande?.supplement_heures_montant ?? item.supplement_heures_montant ?? 0) > 0 ||
         Boolean(facturationData.supplement_heures_recupere_especes ?? demande?.formulaire_data?.supplement_heures_recupere_especes ?? demande?.supplement_heures_recupere_especes ?? item.supplement_heures_recupere_especes ?? false))
      ),
      supplementHeuresMontant: Number(facturationData.supplement_heures_montant ?? demande?.formulaire_data?.supplement_heures_montant ?? demande?.supplement_heures_montant ?? item.supplement_heures_montant ?? 0),
      supplementHeuresRecupereEspeces: Boolean(facturationData.supplement_heures_recupere_especes ?? demande?.formulaire_data?.supplement_heures_recupere_especes ?? demande?.supplement_heures_recupere_especes ?? item.supplement_heures_recupere_especes ?? false),
      supplementEncaissePar: (
        facturationData.supplement_encaisse_par ||
        demande?.formulaire_data?.facturation?.supplement_encaisse_par ||
        demande?.formulaire_data?.supplement_encaisse_par ||
        demande?.supplement_encaisse_par ||
        item.supplement_encaisse_par ||
        (facturationData.supplement_heures_recupere_especes === false && (facturationData.has_supplement_heures || item.has_supplement_heures) ? 'agence' : 'femme_de_menage')
      ),
      especesRecuperees: Number(
        facturationData.montant_especes ??
        demande?.formulaire_data?.facturation?.montant_especes ??
        demande?.formulaire_data?.montant_especes ??
        (demande?.mode_paiement === 'virement_especes' ? Math.max(0, Number(demande?.prix || 0) - Number(demande?.avance_paiement || facturationData.montant_verse || 0)) : 0)
      ),
    };
  }, []);

  const mapDemandeToFacturationRow = useCallback((demande: any): FacturationRow => {
    const facturationData = demande?.formulaire_data?.facturation || {};
    const montant = Number(demande?.prix) || Number(facturationData?.montant_ht) || 0;

    const d_part_agence = demande?.part_agence;
    const d_parts_repartition = demande?.parts_repartition;

    const partAgence = (facturationData.part_agence !== null && facturationData.part_agence !== undefined)
      ? Number(facturationData.part_agence)
      : (d_part_agence !== null && d_part_agence !== undefined)
        ? Number(d_part_agence)
        : 0;

    const partsSum = (d_parts_repartition && Array.isArray(d_parts_repartition))
      ? d_parts_repartition.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
      : 0;

    const hasRepartition = partsSum > 0 || 
      (facturationData.part_profil !== null && facturationData.part_profil !== undefined && Number(facturationData.part_profil) > 0) ||
      (facturationData.part_agence !== null && facturationData.part_agence !== undefined && Number(facturationData.part_agence) > 0) ||
      (d_part_agence !== null && d_part_agence !== undefined && Number(d_part_agence) > 0);

    const partProfil = partsSum > 0
      ? partsSum
      : (facturationData.part_profil !== null && facturationData.part_profil !== undefined)
        ? Number(facturationData.part_profil)
        : (facturationData.montant_agence_doit_profil !== null && facturationData.montant_agence_doit_profil !== undefined && facturationData.montant_agence_doit_profil > 0)
          ? Number(facturationData.montant_agence_doit_profil)
          : hasRepartition
            ? Math.max(0, montant - partAgence)
            : 0;

    const rawStatutPaiementUi =
      facturationData.statut_paiement_ui ||
      demande.statut_paiement_ui ||
      (demande.statut_paiement === 'integral' ? 'paye' :
        demande.statut_paiement === 'acompte' ? 'paiement_en_attente' :
          demande.statut_paiement === 'partiel' ? 'paiement_partiel' :
            'non_confirme');

    let encaissePar: FacturationRow['encaissePar'] = demande?.mode_paiement === 'sur_place' ? 'Profil' : 'Agence';
    if (['profil_paye_client', 'Profil payé / Client'].includes(rawStatutPaiementUi)) {
      encaissePar = 'Profil';
    } else if (['agence_payee_client', 'Agence payée / Client'].includes(rawStatutPaiementUi)) {
      encaissePar = 'Agence';
    } else if (['paye', 'integral', 'effectue'].includes(rawStatutPaiementUi)) {
      if (facturationData.part_agence_reversee || facturationData.montant_profil_doit_agence > 0) {
        encaissePar = 'Profil';
      } else if (facturationData.part_profil_versee || facturationData.montant_agence_doit_profil > 0) {
        encaissePar = 'Agence';
      }
    }

    const parts = facturationData.parts_repartition || demande?.parts_repartition || [];
    let allProfilesPaid = false;
    if (Array.isArray(parts) && parts.length > 0) {
      allProfilesPaid = parts.every((p: any) => p.part_profil_versee);
    } else {
      if (encaissePar === 'Profil') {
        allProfilesPaid = true;
      } else {
        allProfilesPaid = Boolean(facturationData.part_profil_versee);
      }
    }

    const isPaidStatus = ['paye', 'integral', 'effectue', 'profil_paye_client', 'Profil payé / Client', 'agence_payee_client', 'Agence payée / Client', 'commercial_paye_client', 'Commercial payé / client'].includes(rawStatutPaiementUi);
    const isPartiallyPaidStatus = ['paiement_partiel', 'paiement_en_attente', 'Paiement partiel', 'Paiement en attente', 'partiel', 'acompte'].includes(rawStatutPaiementUi);

    const paiement: FacturationRow['paiement'] =
      (isPaidStatus && allProfilesPaid)
        ? 'paye'
        : (isPartiallyPaidStatus || isPaidStatus)
          ? 'partiellement_paye'
          : 'non_paye';

    const isGratuit = rawStatutPaiementUi === 'intervention_gratuite';
    const isFacturationAnnulee = !isGratuit && (facturationData.facturation_annulee === true || rawStatutPaiementUi === 'facturation_annulee' || rawStatutPaiementUi === 'Facturation annulée');
    const isInterventionAnnulee = !isFacturationAnnulee && (demande.statut === 'annule' || demande.statut === 'annulée' || demande.statut === 'refuse' || demande.statut === 'rejete');

    const statut: FacturationRow['statut'] =
      isGratuit ? 'Intervention gratuite' :
        isInterventionAnnulee ? 'Intervention annulée' :
          isFacturationAnnulee ? 'Facturation annulée' :
            paiement === 'paye' ? 'A jour' :
              paiement === 'partiellement_paye' ? 'Confirmée' :
                demande.statut === 'en_attente' ? 'En attente' : 'Confirmée';

    const partProfilVersee = Boolean(facturationData.part_profil_versee);
    const partAgenceReversee = Boolean(facturationData.part_agence_reversee);
    const reglementInterne = (encaissePar === 'Agence' ? partProfilVersee : partAgenceReversee) ? 'Réglé' : 'Non réglé';

    return {
      demandeId: demande?.id,
      clientId: demande?.client,
      profilId: demande?.profil_id,
      categorie: demande?.profil_detail?.categorie,
      missionNo: `DEM-${String(demande?.id).padStart(6, '0')}`,
      date: demande?.date_intervention ? formatDateFR(demande.date_intervention) : formatDateFR(demande?.created_at),
      client: demande?.client_name || '—',
      ville: demande?.client_city || 'Casablanca',
      profil: demande?.profil_name || '—',
      service: demande?.service || 'Service',
      segment: demande?.segment === 'entreprise' ? 'Entreprise' : 'Particulier',
      montant,
      modePaiement: demande?.mode_paiement_label || modeLabelFromCode(demande?.mode_paiement),
      partAgence,
      partProfil,
      encaissePar,
      paiement,
      statut,
      reglementInterne,
      montantPaye: isPaidStatus
        ? (Number(facturationData.montant_verse) || montant)
        : (isPartiallyPaidStatus ? (Number(facturationData.montant_verse) || 0) : 0),
      montantEncaisseProfil: encaissePar === 'Profil' && isPaidStatus ? montant : 0,
      datePaiement: facturationData.date_paiement ? formatDateFR(facturationData.date_paiement) : (paiement === 'non_paye' ? '—' : formatDateFR(demande.date_intervention || demande.created_at)),
      modePaiementReel: modeLabelFromCode(demande.mode_paiement) || '—',
      commercialName: demande.assigned_to_name || demande.commercial_name || facturationData.commercial_name || '—',
      phone: demande.client_phone || '—',
      partProfilVersee,
      dateVersementProfil: facturationData.date_versement_profil || '—',
      partAgenceReversee,
      dateRemiseAgence: facturationData.date_remise_agence || '—',
      parentDemandeId: demande.parent_demande || demande.parent_demande_id || null,
      frequency: demande.frequency || null,
      subscriptionMonth: demande?.formulaire_data?.subscription_month || null,
      annulationRaison: demande.annulation_raison || facturationData.annulation_raison,
      profilSeraPaye: (() => {
        const raw = demande?.profil_sera_paye !== undefined ? demande.profil_sera_paye : facturationData.profil_sera_paye;
        return raw === true || raw === 1 || raw === '1' || String(raw).trim().toLowerCase() === 'oui' || String(raw).trim().toLowerCase() === 'true';
      })(),
      montantProfilAnnulation: Number(demande.montant_profil_annulation || facturationData.montant_profil_annulation || 0),
      montantAgenceDoitProfil: Number(demande.montant_agence_doit_profil || facturationData.montant_agence_doit_profil || 0),
      montantProfilDoitAgence: Number(demande.montant_profil_doit_agence || facturationData.montant_profil_doit_agence || 0),
      statutPaiementUi: rawStatutPaiementUi,
      tvaActive: Boolean(facturationData.tva_active ?? demande.tva_active),
      originalDemande: demande,
      originalMission: null,
      parts_repartition: Array.isArray(facturationData.parts_repartition) && facturationData.parts_repartition.length > 0 ? facturationData.parts_repartition : Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0 ? d_parts_repartition : undefined,
      note_commercial: demande?.note_commercial || facturationData.note_commercial || '—',
      cao: demande?.cao,
      isDelegate: Boolean(
        (parts.find((p: any) => Number(p.profile_id) === Number(demande?.profil_id)))?.is_delegate ||
        (parts.length > 0 && parts.every((p: any) => !p.is_delegate) && Number(parts[0]?.profile_id) === Number(demande?.profil_id)) ||
        parts.length <= 1 ||
        demande?.delegue_id === demande?.profil_id
      ),
      hasSupplementHeures: Boolean(
        facturationData.has_supplement_heures ??
        demande?.has_supplement_heures ??
        (Number(facturationData.supplement_heures_montant ?? demande?.formulaire_data?.supplement_heures_montant ?? demande?.supplement_heures_montant ?? 0) > 0 ||
         Boolean(facturationData.supplement_heures_recupere_especes ?? demande?.formulaire_data?.supplement_heures_recupere_especes ?? demande?.supplement_heures_recupere_especes ?? false))
      ),
      supplementHeuresMontant: Number(facturationData.supplement_heures_montant ?? demande?.formulaire_data?.supplement_heures_montant ?? demande?.supplement_heures_montant ?? 0),
      supplementHeuresRecupereEspeces: Boolean(facturationData.supplement_heures_recupere_especes ?? demande?.formulaire_data?.supplement_heures_recupere_especes ?? demande?.supplement_heures_recupere_especes ?? false),
      supplementEncaissePar: (
        facturationData.supplement_encaisse_par ||
        demande?.formulaire_data?.facturation?.supplement_encaisse_par ||
        demande?.formulaire_data?.supplement_encaisse_par ||
        demande?.supplement_encaisse_par ||
        (facturationData.supplement_heures_recupere_especes === false && (facturationData.has_supplement_heures || demande?.has_supplement_heures) ? 'agence' : 'femme_de_menage')
      ),
      especesRecuperees: Number(
        facturationData.montant_especes ??
        demande?.formulaire_data?.facturation?.montant_especes ??
        demande?.formulaire_data?.montant_especes ??
        (demande?.mode_paiement === 'virement_especes' ? Math.max(0, Number(demande?.prix || 0) - Number(demande?.avance_paiement || facturationData.montant_verse || 0)) : 0)
      ),
    };
  }, []);

  // Fetch Data function
  const loadData = useCallback(async () => {
    setIsLoading(true);
    const missions: any[] = [];
    const demands: any[] = [];
    const agents: AgentApiItem[] = [];

    // 1. Fetch Missions
    try {
      let page = 1;
      while (true) {
        const res = await getMissions({ ordering: '-created_at', page });
        const rows = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
        missions.push(...rows);
        if (!res.data?.next || rows.length === 0) break;
        page += 1;
      }
    } catch (e) {
      console.error('Failed to load missions', e);
    }

    // 2. Fetch Demands History
    try {
      let page = 1;
      while (true) {
        const res = await getDemandesHistorique({ ordering: '-created_at', page });
        const rows = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
        demands.push(...rows);
        if (!res.data?.next || rows.length === 0) break;
        page += 1;
      }
    } catch (e) {
      console.error('Failed to load demands history', e);
    }

    // 3. Fetch Agents
    try {
      let page = 1;
      while (true) {
        const res = await getAgents({ ordering: '-created_at', page });
        const rows = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
        agents.push(...rows);
        if (!res.data?.next || rows.length === 0) break;
        page += 1;
      }
    } catch (e) {
      console.error('Failed to load agents', e);
    }

    // 4. Fetch Dashboard Demands for detail enrichment
    let dashDemandes: any[] = [];
    try {
      const res = await getDemandes({ no_page: 'true' });
      dashDemandes = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error('Failed to load dashboard demands', e);
    }

    const dashDemandsMap = new Map<number, any>();
    dashDemandes.forEach((d) => {
      if (d.id) dashDemandsMap.set(Number(d.id), d);
    });

    const allDemandsMap = new Map<number, any>();
    demands.forEach((d) => {
      if (d.id) allDemandsMap.set(Number(d.id), d);
    });
    dashDemandes.forEach((d) => {
      if (d.id) allDemandsMap.set(Number(d.id), d);
    });

    // Merge dashboard data with demands history
    demands.forEach((d) => {
      const dashD = dashDemandsMap.get(Number(d.id));
      if (dashD) {
        d.profils_envoyes = dashD.profils_envoyes || d.profils_envoyes;
        d.parts_repartition = dashD.parts_repartition || d.parts_repartition;
        d.note_commercial = dashD.note_commercial || d.note_commercial;
        d.note_operationnel = dashD.note_operationnel || d.note_operationnel;
        d.nb_heures = dashD.nb_heures || d.nb_heures;
        d.planning = dashD.planning || d.planning;
        if (d.formulaire_data && dashD.formulaire_data) {
          d.formulaire_data.facturation = {
            ...d.formulaire_data.facturation,
            ...dashD.formulaire_data.facturation,
          };
        }
      }
    });

    // Merge all full demand data (active + history) with missions
    missions.forEach((m) => {
      if (m.demande_detail?.id) {
        const fullD = allDemandsMap.get(Number(m.demande_detail.id));
        const detailObj = m.demande_detail;
        if (fullD && detailObj) {
          detailObj.profils_envoyes = fullD.profils_envoyes || detailObj.profils_envoyes;
          detailObj.parts_repartition = fullD.parts_repartition || detailObj.parts_repartition;
          detailObj.note_commercial = fullD.note_commercial || detailObj.note_commercial;
          detailObj.note_operationnel = fullD.note_operationnel || detailObj.note_operationnel;
          detailObj.nb_heures = fullD.nb_heures || detailObj.nb_heures;
          detailObj.planning = fullD.planning || detailObj.planning;
          if (fullD.formulaire_data) {
            detailObj.formulaire_data = {
              ...detailObj.formulaire_data,
              ...fullD.formulaire_data,
              facturation: {
                ...(detailObj.formulaire_data?.facturation || {}),
                ...(fullD.formulaire_data?.facturation || {}),
              }
            };
          }
        }
      }
    });

    // Merge all rows
    const parentIdsWithChildren = new Set(
      demands.filter((d) => !!d.parent_demande).map((d) => Number(d.parent_demande))
    );

    const missionDemandeIds = new Set(missions.map((m) => String(m.demande_detail?.id)).filter((id) => id !== 'undefined' && id !== 'null'));
    const uniqueDemands = demands.filter((d) => {
      if (missionDemandeIds.has(String(d.id))) return false;
      // Exclure la demande mère d'abonnement si elle possède déjà des interventions enfants générées
      const isRootContractWithChildren =
        !d.parent_demande &&
        d.frequency === 'abonnement' &&
        parentIdsWithChildren.has(Number(d.id));
      if (isRootContractWithChildren) return false;
      return true;
    });

    const missionRows = missions.map(mapMissionToFacturationRow);
    const demandRows = uniqueDemands.map(mapDemandeToFacturationRow);
    
    // Sort chronologically
    const allMappedRows = [...missionRows, ...demandRows]
      .filter((row) => !!row.clientId && row.originalDemande?.statut !== 'en_attente')
      .sort((a, b) => {
        const dateA = parseFrenchDate(a.date)?.getTime() || 0;
        const dateB = parseFrenchDate(b.date)?.getTime() || 0;
        return dateB - dateA;
      });

    // Group by subscription and identify primary vs secondary rows
    const subscriptionGroups = new Map<number, FacturationRow[]>();
    for (const row of allMappedRows) {
      const subId = row.parentDemandeId || (row.frequency === 'abonnement' ? row.demandeId : null);
      if (subId) {
        if (!subscriptionGroups.has(subId)) {
          subscriptionGroups.set(subId, []);
        }
        subscriptionGroups.get(subId)!.push(row);
      }
    }

    for (const [subId, groupRows] of subscriptionGroups.entries()) {
      const parentDemande = allDemandsMap.get(Number(subId)) || groupRows.find(r => !r.parentDemandeId)?.originalDemande;
      const weeks = parentDemande?.planning?.semaines;
      
      let totalPlanned = 0;
      if (weeks && Array.isArray(weeks)) {
        weeks.forEach(week => {
          if (week.jours) {
            Object.keys(week.jours).forEach(dayKey => {
              if (week.jours[dayKey]?.selected) {
                totalPlanned++;
              }
            });
          }
        });
      }
      
      const parentMontant = Number(parentDemande?.prix) || Number(parentDemande?.montant) || Number(parentDemande?.formulaire_data?.facturation?.montant_ht) || 0;
      const denominator = totalPlanned > 0 ? totalPlanned : (parentDemande ? getDynamicMonthPassagesCount(parentDemande, demands) : groupRows.length);
      const interventionCA = denominator > 0 ? parentMontant / denominator : 0;

      const monthGroups = new Map<number, FacturationRow[]>();
      for (const row of groupRows) {
        const m = row.subscriptionMonth || 1;
        if (!monthGroups.has(m)) {
          monthGroups.set(m, []);
        }
        monthGroups.get(m)!.push(row);
      }

      for (const [, rows] of monthGroups.entries()) {
        const sorted = [...rows].sort((a, b) => {
          const dateA = parseFrenchDate(a.date)?.getTime() || 0;
          const dateB = parseFrenchDate(b.date)?.getTime() || 0;
          if (dateA !== dateB) return dateA - dateB;
          return (a.demandeId || 0) - (b.demandeId || 0);
        });

        for (let i = 0; i < sorted.length; i++) {
          const row = sorted[i];
          const isPrimary = i === 0;
          row.isSubscriptionPrimary = isPrimary;
          row.isSubscriptionSecondary = !isPrimary;
          row.subscriptionDenominator = denominator || sorted.length;
          row.subscriptionInterventionCA = Number(interventionCA.toFixed(2));

          if (isPrimary && parentMontant > 0) {
            row.montant = parentMontant;
            if (parentDemande?.part_agence !== undefined && parentDemande?.part_agence !== null) {
              row.partAgence = Number(parentDemande.part_agence);
            }
          }

          // Inherit invoice payment status from parentDemande if child doesn't have an explicit override
          if (parentDemande?.formulaire_data?.facturation) {
            const pFact = parentDemande.formulaire_data.facturation;
            if (!row.statutPaiementUi || row.statutPaiementUi === 'non_confirme' || row.statutPaiementUi === 'non_paye') {
              if (pFact.statut_paiement_ui) {
                row.statutPaiementUi = pFact.statut_paiement_ui;
                if (['paye', 'integral', 'effectue', 'profil_paye_client', 'agence_payee_client'].includes(pFact.statut_paiement_ui)) {
                  row.paiement = 'paye';
                  row.statut = 'A jour';
                }
              }
            }
          }
        }
      }
    }

    setDemandsMap(allDemandsMap);
    setFacturationData(allMappedRows);
    setAgentsList(agents);

    // 5. Fetch Commercial Users
    try {
      const res = await getUsers({ role: 'commercial' });
      setCommerciauxList(Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to load commercials', e);
    }

    setIsLoading(false);
  }, [mapMissionToFacturationRow, mapDemandeToFacturationRow]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useFinanceSync(loadData, { ignoreSource: 'LesSuivis' });

  const getSubInfo = useCallback((row: FacturationRow) => {
    const isSub = row.frequency === 'abonnement' || row.originalDemande?.frequency === 'abonnement';
    if (!isSub) return null;
    const parentId = row.originalDemande?.parent_demande || row.originalDemande?.id || row.demandeId;
    if (!parentId) return null;

    const parentRow = facturationData.find(r => Number(r.demandeId) === Number(parentId) && !r.parentDemandeId);
    const parentDemande = demandsMap.get(Number(parentId)) || parentRow?.originalDemande || (row.parentDemandeId ? null : row.originalDemande);

    const rowDate = parseFrenchDate(row.date);
    const rowMonth = rowDate ? rowDate.getMonth() : null;
    const rowYear = rowDate ? rowDate.getFullYear() : null;
    const subMonthIndex = row.subscriptionMonth || row.originalDemande?.formulaire_data?.subscription_month || 1;

    const allSubRows = facturationData.filter(r => {
      const rIsSub = r.frequency === 'abonnement' || r.originalDemande?.frequency === 'abonnement';
      if (!rIsSub) return false;
      const rParentId = r.originalDemande?.parent_demande || r.originalDemande?.id || r.demandeId;
      return Number(rParentId) === Number(parentId);
    });

    const hasChildRows = allSubRows.some(r => !!r.parentDemandeId || !!r.originalDemande?.parent_demande);

    const monthSubRows = allSubRows
      .filter(r => {
        // If child rows exist, the actual intervention sessions are the child rows
        if (hasChildRows && !r.parentDemandeId && !r.originalDemande?.parent_demande) {
          return false;
        }
        if (r.subscriptionMonth && r.subscriptionMonth === subMonthIndex) {
          return true;
        }
        if (rowMonth !== null && rowYear !== null) {
          const rDate = parseFrenchDate(r.date);
          if (rDate) {
            return rDate.getMonth() === rowMonth && rDate.getFullYear() === rowYear;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = parseFrenchDate(a.date)?.getTime() || 0;
        const dateB = parseFrenchDate(b.date)?.getTime() || 0;
        return dateA - dateB;
      });

    // Real dynamic number of planned passages on the month calendar (denominator for child intervention demands)
    let monthTotal = parentDemande ? getDynamicMonthPassagesCount(parentDemande, Array.from(demandsMap.values())) : 0;
    if (!monthTotal || monthTotal === 0) {
      monthTotal = monthSubRows.length || 4;
    }

    const indexInMonth = monthSubRows.findIndex(r => 
      (r.demandeId && r.demandeId === row.demandeId) ||
      (r.missionId && r.missionId === row.missionId) ||
      (r.date === row.date && r.client === row.client)
    );
    const rank = indexInMonth !== -1 ? indexInMonth + 1 : 1;
    const parentMontant = Number(parentDemande?.prix) || Number(parentDemande?.montant) || Number(parentDemande?.formulaire_data?.facturation?.montant_ht) || Number(row.montant) || 0;

    return {
      rank,
      total: monthTotal,
      isFirst: rank === 1,
      parentMontant,
    };
  }, [facturationData, demandsMap]);

  // Expanded Rows to match VueGlobale Credit and Debit logic
  const expandedRows = useMemo(() => {
    const result: FacturationRow[] = [];

    for (const row of facturationData) {
      if (!isFinanceRowVisible(row)) continue;
      const isCredit = isCreditRow(row);
      const isDebit = isDebitRow(row);

      if (isCredit) {
        let partsRep = row.parts_repartition;
        if ((!partsRep || partsRep.length === 0) && row.originalDemande?.profils_envoyes && row.originalDemande.profils_envoyes.length > 0) {
          const count = row.originalDemande.profils_envoyes.length;
          const totalProfilsAmount = getPartProfilDueFromAgence(row);
          const defaultAmount = totalProfilsAmount / count;
          partsRep = row.originalDemande.profils_envoyes.map((p: any, idx: number) => ({
            profile_id: p.id,
            profile_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            amount: defaultAmount,
            is_delegate: idx === 0,
          }));
        }

        if (partsRep && partsRep.length > 0) {
          partsRep.forEach((part: any, index: number) => {
            const isPaid = Boolean(part.part_profil_versee || row.partProfilVersee || row.reglementInterne === 'Réglé');
            const pId = Number(part.profile_id);
            const agentObj = agentsList.find((a) => Number(a.id) === pId);
            const pName = agentObj
              ? (agentObj.full_name || `${agentObj.first_name || ''} ${agentObj.last_name || ''}`.trim())
              : part.profile_name || row.profil;
            
            if (!pName || pName.trim() === '—' || pName === 'Non assigné' || pName === 'Profil inconnu') {
              return;
            }

            let portion = Number(part.amount || 0);

            const isGratuit = row.statut === 'Intervention gratuite' || row.statutPaiementUi === 'intervention_gratuite';
            const isAnn = !isGratuit && (row.statut === 'Facturation annulée' || row.statut === 'Intervention annulée' || row.statutPaiementUi === 'facturation_annulee' || row.statutPaiementUi === 'Facturation annulée');
            if (isAnn) {
              const totalProfilsAmount = partsRep.reduce((s: number, p: any) => s + Number(p.amount || 0), 0) || 1;
              portion = Number(row.montantProfilAnnulation || 0) * (portion / totalProfilsAmount);
            }

            const fallbackDate = isPaid ? (row.datePaiement && row.datePaiement !== '—' ? row.datePaiement : row.date) : '—';
            const versementDate = (part.date_versement_profil && part.date_versement_profil !== '—')
              ? part.date_versement_profil
              : (row.dateVersementProfil && row.dateVersementProfil !== '—')
                ? row.dateVersementProfil
                : fallbackDate;

            const noteCommercial = part.note_commercial !== undefined && part.note_commercial !== null
              ? part.note_commercial
              : (row.note_commercial || '—');

            const isDelegate = Boolean(part.is_delegate) || partsRep.length === 1 || (partsRep.every((p: any) => !p.is_delegate) && index === 0);

            result.push({
              ...row,
              profilId: pId,
              profil: pName,
              categorie: agentObj?.categorie || row.categorie,
              partProfil: portion,
              partProfilVersee: isPaid,
              reglementInterne: isPaid ? 'Réglé' : 'Non réglé',
              _partProfilVersee: isPaid,
              _uniqueKey: `${row.missionNo}-${pId}-credit`,
              dateVersementProfil: versementDate,
              note_commercial: noteCommercial,
              isFirstProfileOfRow: index === 0,
              isDelegate,
              hasSupplementHeures: row.hasSupplementHeures,
              supplementHeuresMontant: row.supplementHeuresMontant,
              supplementHeuresRecupereEspeces: row.supplementHeuresRecupereEspeces,
              supplementEncaissePar: row.supplementEncaissePar,
            });
          });
        } else {
          const pName = (row.profil || '').trim();
          if (!pName || pName === '—' || pName === 'Non assigné' || pName === 'Profil inconnu') {
            continue;
          }

          const partProfilDue = getPartProfilDueFromAgence(row);
          const isPaid = row.partProfilVersee;
          const fallbackDate = isPaid ? (row.datePaiement && row.datePaiement !== '—' ? row.datePaiement : row.date) : '—';
          const versementDate = (row.dateVersementProfil && row.dateVersementProfil !== '—')
            ? row.dateVersementProfil
            : fallbackDate;

          result.push({
            ...row,
            categorie: row.categorie || agentsList.find((a) => Number(a.id) === Number(row.profilId))?.categorie,
            partProfil: partProfilDue,
            _uniqueKey: `${row.missionNo}-credit`,
            dateVersementProfil: versementDate,
            note_commercial: row.note_commercial || '—',
            isFirstProfileOfRow: true,
            isDelegate: true,
            hasSupplementHeures: row.hasSupplementHeures,
            supplementHeuresMontant: row.supplementHeuresMontant,
            supplementHeuresRecupereEspeces: row.supplementHeuresRecupereEspeces,
            supplementEncaissePar: row.supplementEncaissePar,
          });
        }
      } else if (isDebit) {
        let partsRep = row.parts_repartition;
        if (partsRep && partsRep.length > 0) {
          const delegatePart = partsRep.find((p: any) => p.is_delegate) || partsRep[0];
          if (delegatePart) {
            const isPaid = Boolean(delegatePart.part_agence_reversee || row.partAgenceReversee || row.reglementInterne === 'Réglé');
            const pId = Number(delegatePart.profile_id);
            const agentObj = agentsList.find((a) => Number(a.id) === pId);
            const pName = agentObj
              ? (agentObj.full_name || `${agentObj.first_name || ''} ${agentObj.last_name || ''}`.trim())
              : delegatePart.profile_name || row.profil;

            if (!pName || pName.trim() === '—' || pName === 'Non assigné' || pName === 'Profil inconnu') {
              continue;
            }

            const fallbackDate = isPaid ? (row.datePaiement && row.datePaiement !== '—' ? row.datePaiement : row.date) : '—';
            const remiseDate = (delegatePart.date_remise_agence && delegatePart.date_remise_agence !== '—')
              ? delegatePart.date_remise_agence
              : (row.dateRemiseAgence && row.dateRemiseAgence !== '—')
                ? row.dateRemiseAgence
                : fallbackDate;

            const noteCommercial = delegatePart.note_commercial !== undefined && delegatePart.note_commercial !== null
              ? delegatePart.note_commercial
              : (row.note_commercial || '—');

            result.push({
              ...row,
              profilId: pId,
              profil: pName,
              categorie: agentObj?.categorie || row.categorie,
              partAgence: getPartAgenceDueFromProfil(row),
              partAgenceReversee: isPaid,
              reglementInterne: isPaid ? 'Réglé' : 'Non réglé',
              _partAgenceReversee: isPaid,
              _uniqueKey: `${row.missionNo}-${pId}-debit`,
              dateRemiseAgence: remiseDate,
              note_commercial: noteCommercial,
              isFirstProfileOfRow: true,
              isDelegate: true,
              hasSupplementHeures: row.hasSupplementHeures,
              supplementHeuresMontant: row.supplementHeuresMontant,
              supplementHeuresRecupereEspeces: row.supplementHeuresRecupereEspeces,
              supplementEncaissePar: row.supplementEncaissePar,
            });
          }
        } else {
          const pName = (row.profil || '').trim();
          if (!pName || pName === '—' || pName === 'Non assigné' || pName === 'Profil inconnu') {
            continue;
          }

          const partAgenceDue = getPartAgenceDueFromProfil(row);
          const isPaid = row.partAgenceReversee;
          const fallbackDate = isPaid ? (row.datePaiement && row.datePaiement !== '—' ? row.datePaiement : row.date) : '—';
          const remiseDate = (row.dateRemiseAgence && row.dateRemiseAgence !== '—')
            ? row.dateRemiseAgence
            : fallbackDate;

          result.push({
            ...row,
            categorie: row.categorie || agentsList.find((a) => Number(a.id) === Number(row.profilId))?.categorie,
            partAgence: partAgenceDue,
            _uniqueKey: `${row.missionNo}-debit`,
            dateRemiseAgence: remiseDate,
            note_commercial: row.note_commercial || '—',
            isFirstProfileOfRow: true,
            isDelegate: true,
            hasSupplementHeures: row.hasSupplementHeures,
            supplementHeuresMontant: row.supplementHeuresMontant,
            supplementHeuresRecupereEspeces: row.supplementHeuresRecupereEspeces,
            supplementEncaissePar: row.supplementEncaissePar,
          });
        }
      } else {
        // Unsettled / not collected yet
        const pName = (row.profil || '').trim();
        if (!pName || pName === '—' || pName === 'Non assigné' || pName === 'Profil inconnu') {
          continue;
        }

        result.push({
          ...row,
          _uniqueKey: `${row.missionNo}-unsettled`,
          note_commercial: row.note_commercial || '—',
          isFirstProfileOfRow: true,
          isDelegate: row.isDelegate ?? true,
          hasSupplementHeures: row.hasSupplementHeures,
          supplementHeuresMontant: row.supplementHeuresMontant,
          supplementHeuresRecupereEspeces: row.supplementHeuresRecupereEspeces,
        });
      }
    }

    return result;
  }, [facturationData, agentsList]);

  // Tab 1 Calculations: KPI Totals (filtered by date range)
  const kpiStats = useMemo(() => {
    let totalCa = 0;
    let totalPartAgence = 0;
    let totalPartProfil = 0;
    let unpaidPartAgence = 0;
    let unpaidPartProfil = 0;

    const isInDateRange = (row: FacturationRow): boolean => {
      const rowDate = parseFrenchDate(row.date);
      if (!rowDate) return false;
      const rowIso = getISODateLocal(rowDate);
      if (dateFrom && rowIso < dateFrom) return false;
      if (dateTo && rowIso > dateTo) return false;
      return true;
    };

    facturationData.filter((r) => isFinanceRowVisible(r) && isInDateRange(r)).forEach((row) => {
      const isCancelled =
        row.statut === 'Facturation annulée' ||
        row.statut === 'Intervention annulée' ||
        row.statutPaiementUi === 'facturation_annulee' ||
        row.statut === 'Intervention gratuite' ||
        row.statutPaiementUi === 'intervention_gratuite';

      const isCaoConfirmed = (r: FacturationRow): boolean => {
        const val = r.cao ?? r.originalDemande?.cao ?? (r.originalMission as any)?.demande_detail?.cao;
        return val === true || val === 1 || String(val).toLowerCase() === 'oui' || String(val).toLowerCase() === 'true';
      };

      const isClientPaidStatus = (statutUi?: string): boolean => {
        if (!statutUi) return false;
        return ['paye', 'integral', 'effectue', 'profil_paye_client', 'Profil payé / Client', 'agence_payee_client', 'Agence payée / Client', 'commercial_paye_client', 'Commercial payé / client'].includes(statutUi);
      };

      if (!isCancelled) {
        if (!row.isSubscriptionSecondary) {
          if (row.paiement !== 'non_paye' || isCaoConfirmed(row) || isClientPaidStatus(row.statutPaiementUi)) {
            if (row.frequency === 'abonnement' && row.isSubscriptionPrimary) {
              totalCa += row.montant;
            } else if (isCaoConfirmed(row) || isClientPaidStatus(row.statutPaiementUi) || row.paiement === 'paye') {
              totalCa += row.montant;
            } else {
              totalCa += (row.montantPaye && row.montantPaye > 0) ? row.montantPaye : row.montant;
            }
          }
          totalPartAgence += row.partAgence;
          
          const isProfilePaid = row.partProfilVersee || row.reglementInterne === 'Réglé';
          if (isProfilePaid) {
            totalPartProfil += row.partProfil;
          }
        }
      } else {
        const isSub = row.frequency === 'abonnement' || row.originalDemande?.frequency === 'abonnement' || row.parentDemandeId;
        const isTrueCancellation = row.statutPaiementUi === 'facturation_annulee' || row.statut === 'Facturation annulée' || row.statut === 'Intervention annulée';
        if (isSub && isTrueCancellation) {
          totalCa -= (row.subscriptionInterventionCA || 0);
        }
      }
    });

    totalCa = Math.max(0, totalCa);

    expandedRows.filter(isInDateRange).forEach((row) => {
      const isCredit = isCreditRow(row);
      const isDebit = isDebitRow(row);

      if (isCredit) {
        const isPaid = row.partProfilVersee ?? row._partProfilVersee;
        if (!isPaid && row.reglementInterne !== 'Réglé') {
          if (!row.isSubscriptionSecondary) {
            unpaidPartProfil += row.partProfil;
          }
        }
      } else if (isDebit) {
        const isPaid = row.partAgenceReversee ?? row._partAgenceReversee;
        if (!isPaid && row.reglementInterne !== 'Réglé') {
          if (!row.isSubscriptionSecondary) {
            unpaidPartAgence += row.partAgence;
          }
        }
      }
    });

    return {
      totalCa,
      totalPartAgence,
      totalPartProfil,
      unpaidPartAgence,
      unpaidPartProfil
    };
  }, [facturationData, expandedRows, getSubInfo, dateFrom, dateTo]);

  // Tab 1: Filtered Rows
  const filteredRows = useMemo(() => {
    return expandedRows.filter((row) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientMatch = row.client?.toLowerCase().includes(query);
        const profilMatch = row.profil?.toLowerCase().includes(query);
        const cityMatch = row.ville?.toLowerCase().includes(query);
        if (!clientMatch && !profilMatch && !cityMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const uiVal = row.statutPaiementUi || '';
        const statut = row.statut || '';
        const paiement = row.paiement || '';

        if (statusFilter === 'paiement_en_attente') {
          const isPending = uiVal === 'paiement_en_attente' || uiVal === 'Paiement en attente' || uiVal === 'acompte';
          if (!isPending) return false;
        } else if (statusFilter === 'agence_payee_client') {
          const isAgencePayee = uiVal === 'agence_payee_client' || uiVal === 'Agence payée / Client' || uiVal === 'Agence payée/client';
          if (!isAgencePayee) return false;
        } else if (statusFilter === 'profil_paye_client') {
          const isProfilPaye = uiVal === 'profil_paye_client' || uiVal === 'Profil payé / Client' || uiVal === 'Profil payé/client';
          if (!isProfilPaye) return false;
        } else if (statusFilter === 'paiement_partiel') {
          const isPartiel = uiVal === 'paiement_partiel' || uiVal === 'Paiement partiel' || uiVal === 'partiel' || paiement === 'partiellement_paye';
          if (!isPartiel) return false;
        } else if (statusFilter === 'paye') {
          const isPaye = statut === 'Payé' || statut === 'A jour' || uiVal === 'paye' || uiVal === 'integral' || paiement === 'paye';
          if (!isPaye) return false;
        } else if (statusFilter === 'facturation_annulee') {
          const isAnnule =
            statut === 'Facturation annulée' ||
            statut === 'Intervention annulée' ||
            statut === 'Intervention gratuite' ||
            uiVal === 'facturation_annulee' ||
            uiVal === 'Facturation annulée' ||
            uiVal === 'intervention_gratuite';
          if (!isAnnule) return false;
        }
      }

      // Encaissement filter
      if (encaissementFilter !== 'all') {
        const isCredit = isCreditRow(row);
        const isDebit = isDebitRow(row);
        if (encaissementFilter === 'crediteur' && !isCredit) return false;
        if (encaissementFilter === 'debiteur' && !isDebit) return false;
      }

      // KPI Card quick filter (Part agence non réglée / Part profils non réglée)
      if (kpiFilter === 'unpaid_agence') {
        const isDebit = isDebitRow(row);
        const isPaid = row.partAgenceReversee ?? row._partAgenceReversee;
        if (!isDebit || isPaid || row.reglementInterne === 'Réglé') return false;
      } else if (kpiFilter === 'unpaid_profil') {
        const isCredit = isCreditRow(row);
        const isPaid = row.partProfilVersee ?? row._partProfilVersee;
        if (!isCredit || isPaid || row.reglementInterne === 'Réglé') return false;
      }

      // Frequency filter
      if (freqFilter !== 'all') {
        const isSub = row.frequency === 'abonnement' || row.originalDemande?.frequency === 'abonnement';
        if (freqFilter === 'ponctuel' && isSub) return false;
        if (freqFilter === 'abonnement' && !isSub) return false;
      }

      // Date Range filter (strict filtering: if date filter is active, rows must have a valid date in range)
      if (dateFrom || dateTo) {
        const rowDate = parseFrenchDate(row.date);
        if (!rowDate) return false;
        const rowIso = getISODateLocal(rowDate);
        if (dateFrom && rowIso < dateFrom) return false;
        if (dateTo && rowIso > dateTo) return false;
      }

      return true;
    });
  }, [expandedRows, searchQuery, statusFilter, encaissementFilter, kpiFilter, freqFilter, dateFrom, dateTo]);

  // Tab 1: Grouped by Profile
  const groupedProfiles = useMemo(() => {
    const map = new Map<string, {
      profilId?: number;
      profilName: string;
      phone?: string;
      categorie?: 'interne' | 'externe' | string;
      nbMissions: number;
      profilDoitAgence: number;
      agenceDoitProfil: number;
      rows: FacturationRow[];
    }>();

    filteredRows.forEach((row) => {
      const pName = (row.profil || '').trim();
      if (!pName || pName === '—' || pName === 'Non assigné' || pName === 'Profil inconnu') {
        return;
      }

      const key = row.profilId ? `id-${row.profilId}` : pName;
      if (!map.has(key)) {
        map.set(key, {
          profilId: row.profilId,
          profilName: pName,
          phone: row.phone,
          categorie: row.categorie,
          nbMissions: 0,
          profilDoitAgence: 0,
          agenceDoitProfil: 0,
          rows: [],
        });
      }

      const item = map.get(key)!;
      item.nbMissions += 1;
      item.rows.push(row);

      const b = getRowDuesBreakdown(row);
      const isCredit = isCreditRow(row);
      const isDebit = isDebitRow(row);

      if (isCredit) {
        const isPaid = row.partProfilVersee ?? row._partProfilVersee;
        if (!isPaid && row.reglementInterne !== 'Réglé') {
          item.agenceDoitProfil += b.agenceDoit;
        }
        if (b.doitAgence > 0) {
          const isRemitted = row.partAgenceReversee ?? row._partAgenceReversee;
          if (!isRemitted && row.reglementInterne !== 'Réglé') {
            item.profilDoitAgence += b.doitAgence;
          }
        }
      } else if (isDebit) {
        const isPaid = row.partAgenceReversee ?? row._partAgenceReversee;
        if (!isPaid && row.reglementInterne !== 'Réglé') {
          item.profilDoitAgence += b.doitAgence;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.nbMissions - a.nbMissions);
  }, [filteredRows]);

  // Dynamically sync selectedDuesProfile with current groupedProfiles (strictly bound to chosen week)
  const activeDuesProfile = useMemo(() => {
    if (!selectedDuesProfile) return null;
    const match = groupedProfiles.find((item) =>
      (selectedDuesProfile.profilId && item.profilId === selectedDuesProfile.profilId) ||
      (selectedDuesProfile.profilName && item.profilName.trim().toLowerCase() === selectedDuesProfile.profilName.trim().toLowerCase())
    );
    if (match) return match;
    return {
      profilId: selectedDuesProfile.profilId,
      profilName: selectedDuesProfile.profilName,
      phone: selectedDuesProfile.phone,
      categorie: selectedDuesProfile.categorie,
      nbMissions: selectedDuesProfile.nbMissions || 0,
      profilDoitAgence: selectedDuesProfile.profilDoitAgence || 0,
      agenceDoitProfil: selectedDuesProfile.agenceDoitProfil || 0,
      rows: selectedDuesProfile.rows || [],
    };
  }, [selectedDuesProfile, groupedProfiles]);

  // Dynamically sync settleConfirmProfile with current groupedProfiles (strictly bound to chosen week)
  const activeSettleProfile = useMemo(() => {
    if (!settleConfirmProfile) return null;
    const match = groupedProfiles.find((item) =>
      (settleConfirmProfile.profilId && item.profilId === settleConfirmProfile.profilId) ||
      item.profilName === settleConfirmProfile.profilName
    );
    if (match) return match;
    return settleConfirmProfile;
  }, [settleConfirmProfile, groupedProfiles]);

  const getProfilCategorie = useCallback((
    rowOrItem: { profilId?: number; profil?: string; profilName?: string; categorie?: string } | undefined
  ): 'interne' | 'externe' => {
    if (!rowOrItem) return 'externe';
    const directCat = (rowOrItem.categorie || '').toLowerCase();
    if (directCat === 'interne' || directCat === 'externe') {
      return directCat as 'interne' | 'externe';
    }
    const pId = rowOrItem.profilId;
    if (pId) {
      const ag = agentsList.find((a) => Number(a.id) === Number(pId));
      const agCat = (ag?.categorie || '').toLowerCase();
      if (agCat === 'interne' || agCat === 'externe') {
        return agCat as 'interne' | 'externe';
      }
    }
    const pName = (rowOrItem.profil || rowOrItem.profilName || '').trim().toLowerCase();
    if (pName && pName !== '—' && pName !== 'non assigné') {
      const ag = agentsList.find((a) => {
        const fullName = (a.full_name || `${a.first_name || ''} ${a.last_name || ''}`).trim().toLowerCase();
        return fullName && fullName === pName;
      });
      const agCat = (ag?.categorie || '').toLowerCase();
      if (agCat === 'interne' || agCat === 'externe') {
        return agCat as 'interne' | 'externe';
      }
    }
    return 'externe';
  }, [agentsList]);

  // Tab 2 Calculations: Commercials Performance
  const commercialPerformance = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (periodFilter === 'mois-en-cours') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (periodFilter === 'mois-dernier') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (periodFilter === 'annee-en-cours') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (periodFilter === 'personnalise') {
      if (commDateFrom) {
        startDate = new Date(commDateFrom);
        startDate.setHours(0, 0, 0, 0);
      }
      if (commDateTo) {
        endDate = new Date(commDateTo);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const rowsInPeriod = facturationData.filter((row) => {
      if (!isRowEncaisseEtValide(row)) return false;

      const rDate = parseFrenchDate(row.date);
      if (!rDate) return false;

      if (startDate && rDate < startDate) return false;
      if (endDate && rDate > endDate) return false;

      return true;
    });

    const statsMap = new Map<string, { name: string; ca: number; dossiers: number; commission: number }>();
    
    commerciauxList.forEach((c) => {
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'Commercial';
      statsMap.set(fullName, { name: fullName, ca: 0, dossiers: 0, commission: 0 });
    });

    rowsInPeriod.forEach((row) => {
      const commName = row.commercialName || '—';
      if (commName !== '—') {
        if (!statsMap.has(commName)) {
          statsMap.set(commName, { name: commName, ca: 0, dossiers: 0, commission: 0 });
        }
        const data = statsMap.get(commName)!;
        
        const { ca, partAgence } = getRowCommercialStats(row, facturationData);
        data.ca += ca;
        data.commission += partAgence;
        
        if (!row.isSubscriptionSecondary) {
          data.dossiers += 1;
        }
      }
    });

    let list = Array.from(statsMap.values());
    const overallTeamCA = list.reduce((sum, item) => sum + item.ca, 0);

    if (commercialFilter !== 'all') {
      list = list.filter((item) => item.name === commercialFilter);
    }

    const totalCA = list.reduce((sum, item) => sum + item.ca, 0);
    const totalDossiers = list.reduce((sum, item) => sum + item.dossiers, 0);
    const commissionAgence = list.reduce((sum, item) => sum + item.commission, 0);

    const sortedList = list
      .map((item) => {
        const pct = overallTeamCA > 0 ? (item.ca / overallTeamCA) * 100 : 0;
        return {
          ...item,
          pct,
          commission: item.commission,
        };
      })
      .sort((a, b) => b.ca - a.ca);

    const activeCount = list.filter((item) => item.dossiers > 0).length;

    return {
      ranking: sortedList,
      totalCA,
      totalDossiers,
      commissionAgence,
      activeCount,
    };
  }, [facturationData, periodFilter, commercialFilter, commerciauxList, commDateFrom, commDateTo]);

  // Tab 2 Calculations: Selected Commercial Detail Breakdown
  const selectedCommercialDetail = useMemo(() => {
    if (!selectedCommercialName) return null;

    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (periodFilter === 'mois-en-cours') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (periodFilter === 'mois-dernier') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (periodFilter === 'annee-en-cours') {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (periodFilter === 'personnalise') {
      if (commDateFrom) {
        startDate = new Date(commDateFrom);
        startDate.setHours(0, 0, 0, 0);
      }
      if (commDateTo) {
        endDate = new Date(commDateTo);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const commRows = facturationData.filter((row) => {
      if (!isRowEncaisseEtValide(row)) return false;
      if (row.commercialName !== selectedCommercialName) return false;

      const rDate = parseFrenchDate(row.date);
      if (!rDate) return false;

      if (startDate && rDate < startDate) return false;
      if (endDate && rDate > endDate) return false;

      return true;
    });

    const totalRealisation = commRows.reduce((sum, r) => {
      const { ca } = getRowCommercialStats(r, facturationData);
      return sum + ca;
    }, 0);
    const totalDossiers = commRows.filter(r => !r.isSubscriptionSecondary).length;
    
    const activeMonthsSet = new Set<string>();
    commRows.forEach((r) => {
      const rDate = parseFrenchDate(r.date);
      if (rDate) {
        const monthKey = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
        activeMonthsSet.add(monthKey);
      }
    });
    const monthsWorked = activeMonthsSet.size || 1;
    const moyenneParMois = totalRealisation / monthsWorked;

    const formatMonthFR = (date: Date): string => {
      const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    const formatQuarterFR = (date: Date): string => {
      const q = Math.floor(date.getMonth() / 3) + 1;
      return `T${q} ${date.getFullYear()}`;
    };

    const formatYearFR = (date: Date): string => {
      return `${date.getFullYear()}`;
    };

    const teamCAMap = new Map<string, number>();
    facturationData.forEach((row) => {
      if (!isRowEncaisseEtValide(row)) return;

      const rDate = parseFrenchDate(row.date);
      if (!rDate) return;

      if (startDate && rDate < startDate) return;
      if (endDate && rDate > endDate) return;

      const mKey = formatMonthFR(rDate);
      const qKey = formatQuarterFR(rDate);
      const yKey = formatYearFR(rDate);

      const { ca } = getRowCommercialStats(row, facturationData);
      teamCAMap.set(mKey, (teamCAMap.get(mKey) || 0) + ca);
      teamCAMap.set(qKey, (teamCAMap.get(qKey) || 0) + ca);
      teamCAMap.set(yKey, (teamCAMap.get(yKey) || 0) + ca);
    });

    const groupByPeriod = (
      formatter: (d: Date) => string
    ) => {
      const groups = new Map<string, { realisation: number; dossiers: number; commAgence: number }>();
      commRows.forEach((r) => {
        const rDate = parseFrenchDate(r.date);
        if (rDate) {
          const key = formatter(rDate);
          if (!groups.has(key)) {
            groups.set(key, { realisation: 0, dossiers: 0, commAgence: 0 });
          }
          const g = groups.get(key)!;
          const { ca, partAgence } = getRowCommercialStats(r, facturationData);
          g.realisation += ca;
          if (!r.isSubscriptionSecondary) {
            g.dossiers += 1;
          }
          g.commAgence += partAgence;
        }
      });

      return Array.from(groups.entries()).map(([period, data]) => {
        const teamTotal = teamCAMap.get(period) || 0;
        const pct = teamTotal > 0 ? (data.realisation / teamTotal) * 100 : 0;
        return {
          period,
          ...data,
          pct,
        };
      }).sort((a, b) => b.period.localeCompare(a.period));
    };

    const parMois = groupByPeriod(formatMonthFR);
    const parTrimestre = groupByPeriod(formatQuarterFR);
    const parAnnee = groupByPeriod(formatYearFR);

    return {
      totalRealisation,
      monthsWorked,
      moyenneParMois,
      totalDossiers,
      parMois,
      parTrimestre,
      parAnnee,
    };
  }, [facturationData, selectedCommercialName, periodFilter, commDateFrom, commDateTo]);


  // Open View Details modal
  const handleOpenDetails = (row: FacturationRow) => {
    setSelectedRow(row);
    setShowDetailsModal(true);
  };



  const [isSettlingProfile, setIsSettlingProfile] = useState(false);

  const handleSettleProfileAllDues = async (profileItem: any) => {
    if (!profileItem || !profileItem.rows || profileItem.rows.length === 0) return;
    setIsSettlingProfile(true);
    const todayIso = getISODateLocal(new Date());

    try {
      for (const row of profileItem.rows) {
        const isCredit = isCreditRow(row);
        const isDebit = isDebitRow(row);
        const isCancelled =
          row.statut === 'Facturation annulée' ||
          row.statut === 'Intervention annulée' ||
          row.statutPaiementUi === 'facturation_annulee' ||
          row.statutPaiementUi === 'Facturation annulée' ||
          row.statut === 'Intervention gratuite' ||
          row.statutPaiementUi === 'intervention_gratuite';

        const pId = row.profilId || profileItem.profilId;
        const originalFormData = row.originalDemande?.formulaire_data || {};
        const facturation = originalFormData.facturation || {};
        const currentParts = facturation.parts_repartition || row.originalDemande?.parts_repartition || [];

        if (isCredit) {
          let updatedParts = currentParts;
          let allPaid = true;
          if (Array.isArray(currentParts) && currentParts.length > 0 && pId) {
            updatedParts = currentParts.map((p: any) => {
              if (Number(p.profile_id) === Number(pId)) {
                return {
                  ...p,
                  part_profil_versee: true,
                  date_versement_profil: todayIso,
                };
              }
              return p;
            });
            allPaid = updatedParts.every((p: any) => p.part_profil_versee);
          }

          let partAgenceReversee = row.partAgenceReversee;
          let dateRemiseAgence = row.dateRemiseAgence;
          if (row.isDelegate && row.hasSupplementHeures && row.supplementHeuresRecupereEspeces) {
            partAgenceReversee = true;
            dateRemiseAgence = todayIso;
          }

          const fallbackStatut = getStatutPaiementFromMode(row.originalDemande?.mode_paiement || row.modePaiement);

          if (row.missionId) {
            await updateMission(row.missionId, {
              part_profil_versee: allPaid,
              date_versement_profil: allPaid ? todayIso : null,
              part_agence_reversee: partAgenceReversee,
              date_remise_agence: dateRemiseAgence,
              paiement_client_statut: isCancelled
                ? (facturation.statut_paiement_ui === 'intervention_gratuite' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite' ? 'intervention_gratuite' : 'facturation_annulee')
                : (allPaid ? 'paye' : (fallbackStatut || 'agence_payee_client'))
            });
          }

          if (row.demandeId && row.originalDemande) {
            const newDoitProfil = allPaid ? 0 : Number(facturation.montant_agence_doit_profil || row.montantAgenceDoitProfil || 0);
            await updateDemande(row.demandeId, {
              montant_agence_doit_profil: newDoitProfil,
              formulaire_data: {
                ...originalFormData,
                facturation: {
                  ...facturation,
                  parts_repartition: updatedParts,
                  part_profil_versee: allPaid,
                  date_versement_profil: allPaid ? todayIso : null,
                  part_agence_reversee: partAgenceReversee,
                  date_remise_agence: dateRemiseAgence,
                  montant_agence_doit_profil: newDoitProfil,
                  statut_paiement_ui: facturation.statut_paiement_ui === 'facturation_annulee'
                    ? 'facturation_annulee'
                    : facturation.statut_paiement_ui === 'intervention_gratuite'
                      ? 'intervention_gratuite'
                      : (allPaid ? 'paye' : (fallbackStatut || 'agence_payee_client')),
                }
              },
              statut_paiement: allPaid ? 'integral' : 'partiel',
            });
          }
        } else if (isDebit) {
          let updatedParts = currentParts;
          let allPaid = true;
          if (Array.isArray(currentParts) && currentParts.length > 0 && pId) {
            updatedParts = currentParts.map((p: any) => {
              if (Number(p.profile_id) === Number(pId)) {
                return {
                  ...p,
                  part_agence_reversee: true,
                  date_remise_agence: todayIso,
                  part_profil_versee: true,
                  date_versement_profil: p.date_versement_profil || todayIso,
                };
              }
              return p;
            });
            allPaid = updatedParts.every((p: any) => p.part_agence_reversee);
          }

          const fallbackStatut = getStatutPaiementFromMode(row.originalDemande?.mode_paiement || row.modePaiement);

          if (row.missionId) {
            await updateMission(row.missionId, {
              part_agence_reversee: allPaid,
              date_remise_agence: allPaid ? todayIso : null,
              paiement_client_statut: isCancelled
                ? (facturation.statut_paiement_ui === 'intervention_gratuite' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite' ? 'intervention_gratuite' : 'facturation_annulee')
                : (allPaid ? 'paye' : (fallbackStatut || 'profil_paye_client')),
              part_profil_versee: true,
              date_versement_profil: todayIso
            });
          }

          if (row.demandeId && row.originalDemande) {
            const newDoitAgence = allPaid ? 0 : Number(facturation.montant_profil_doit_agence || row.montantProfilDoitAgence || 0);
            await updateDemande(row.demandeId, {
              montant_profil_doit_agence: newDoitAgence,
              formulaire_data: {
                ...originalFormData,
                facturation: {
                  ...facturation,
                  parts_repartition: updatedParts,
                  part_agence_reversee: allPaid,
                  date_remise_agence: allPaid ? todayIso : null,
                  part_profil_versee: true,
                  date_versement_profil: facturation.date_versement_profil || todayIso,
                  montant_profil_doit_agence: newDoitAgence,
                  statut_paiement_ui: isCancelled
                    ? (facturation.statut_paiement_ui === 'intervention_gratuite' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite' ? 'intervention_gratuite' : 'facturation_annulee')
                    : (allPaid ? 'paye' : (fallbackStatut || 'profil_paye_client')),
                }
              },
              statut_paiement: allPaid ? 'integral' : 'partiel',
            });
          }
        }
      }

      addToast(`Règlement complet enregistré pour ${profileItem.profilName}`, 'success');
      setSettleConfirmProfile(null);
      setSelectedDuesProfile(null);
      await loadData();
    } catch (err) {
      console.error('Erreur lors du règlement global:', err);
      addToast('Erreur lors du règlement global du profil', 'error');
    } finally {
      setIsSettlingProfile(false);
    }
  };

  const handleUpdateRowReglement = async (row: FacturationRow, targetStatus: 'Payé' | 'Non payé') => {
    const isPaid = targetStatus === 'Payé';
    const todayIso = getISODateLocal(new Date());

    try {
      const isCredit = isCreditRow(row);
      const isDebit = isDebitRow(row);
      const isCancelled =
        row.statut === 'Facturation annulée' ||
        row.statut === 'Intervention annulée' ||
        row.statutPaiementUi === 'facturation_annulee' ||
        row.statutPaiementUi === 'Facturation annulée' ||
        row.statut === 'Intervention gratuite' ||
        row.statutPaiementUi === 'intervention_gratuite';

      const pId = row.profilId;
      const originalFormData = row.originalDemande?.formulaire_data || {};
      const facturation = originalFormData.facturation || {};
      const currentParts = facturation.parts_repartition || row.originalDemande?.parts_repartition || [];

      if (isCredit) {
        let updatedParts = currentParts;
        let allPaid = isPaid;
        if (Array.isArray(currentParts) && currentParts.length > 0 && pId) {
          updatedParts = currentParts.map((p: any) => {
            if (Number(p.profile_id) === Number(pId)) {
              return {
                ...p,
                part_profil_versee: isPaid,
                date_versement_profil: isPaid ? todayIso : null,
              };
            }
            return p;
          });
          allPaid = updatedParts.every((p: any) => p.part_profil_versee);
        }

        let partAgenceReversee = row.partAgenceReversee;
        let dateRemiseAgence = row.dateRemiseAgence;
        if (row.isDelegate && row.hasSupplementHeures && row.supplementHeuresRecupereEspeces && isPaid) {
          partAgenceReversee = true;
          dateRemiseAgence = todayIso;
        }

        const fallbackStatut = getStatutPaiementFromMode(row.originalDemande?.mode_paiement || row.modePaiement);

        if (row.missionId) {
          await updateMission(row.missionId, {
            part_profil_versee: allPaid,
            date_versement_profil: allPaid ? todayIso : null,
            part_agence_reversee: partAgenceReversee,
            date_remise_agence: dateRemiseAgence,
            paiement_client_statut: isCancelled
              ? (facturation.statut_paiement_ui === 'intervention_gratuite' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite' ? 'intervention_gratuite' : 'facturation_annulee')
              : (allPaid ? 'paye' : (fallbackStatut || 'agence_payee_client'))
          });
        }

        if (row.demandeId && row.originalDemande) {
          const newDoitProfil = allPaid ? 0 : Number(facturation.montant_agence_doit_profil || row.montantAgenceDoitProfil || 0);
          await updateDemande(row.demandeId, {
            montant_agence_doit_profil: newDoitProfil,
            formulaire_data: {
              ...originalFormData,
              facturation: {
                ...facturation,
                parts_repartition: updatedParts,
                part_profil_versee: allPaid,
                date_versement_profil: allPaid ? todayIso : null,
                part_agence_reversee: partAgenceReversee,
                date_remise_agence: dateRemiseAgence,
                montant_agence_doit_profil: newDoitProfil,
                statut_paiement_ui: facturation.statut_paiement_ui === 'facturation_annulee'
                  ? 'facturation_annulee'
                  : facturation.statut_paiement_ui === 'intervention_gratuite'
                    ? 'intervention_gratuite'
                    : (allPaid ? 'paye' : (fallbackStatut || 'agence_payee_client')),
              }
            },
            statut_paiement: allPaid ? 'integral' : 'partiel',
          });
        }
      } else if (isDebit) {
        let updatedParts = currentParts;
        let allPaid = isPaid;
        if (Array.isArray(currentParts) && currentParts.length > 0 && pId) {
          updatedParts = currentParts.map((p: any) => {
            if (Number(p.profile_id) === Number(pId)) {
              return {
                ...p,
                part_agence_reversee: isPaid,
                date_remise_agence: isPaid ? todayIso : null,
                part_profil_versee: true,
                date_versement_profil: p.date_versement_profil || todayIso,
              };
            }
            return p;
          });
          allPaid = updatedParts.every((p: any) => p.part_agence_reversee);
        }

        const fallbackStatut = getStatutPaiementFromMode(row.originalDemande?.mode_paiement || row.modePaiement);

        if (row.missionId) {
          await updateMission(row.missionId, {
            part_agence_reversee: allPaid,
            date_remise_agence: allPaid ? todayIso : null,
            paiement_client_statut: isCancelled
              ? (facturation.statut_paiement_ui === 'intervention_gratuite' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite' ? 'intervention_gratuite' : 'facturation_annulee')
              : (allPaid ? 'paye' : (fallbackStatut || 'profil_paye_client')),
            part_profil_versee: true,
            date_versement_profil: todayIso
          });
        }

        if (row.demandeId && row.originalDemande) {
          const newDoitAgence = allPaid ? 0 : Number(facturation.montant_profil_doit_agence || row.montantProfilDoitAgence || 0);
          await updateDemande(row.demandeId, {
            montant_profil_doit_agence: newDoitAgence,
            formulaire_data: {
              ...originalFormData,
              facturation: {
                ...facturation,
                parts_repartition: updatedParts,
                part_agence_reversee: allPaid,
                date_remise_agence: allPaid ? todayIso : null,
                part_profil_versee: true,
                date_versement_profil: facturation.date_versement_profil || todayIso,
                montant_profil_doit_agence: newDoitAgence,
                statut_paiement_ui: facturation.statut_paiement_ui === 'facturation_annulee'
                  ? 'facturation_annulee'
                  : facturation.statut_paiement_ui === 'intervention_gratuite'
                    ? 'intervention_gratuite'
                    : (allPaid ? 'paye' : (fallbackStatut || 'profil_paye_client')),
              }
            },
            statut_paiement: allPaid ? 'integral' : 'partiel',
          });
        }
      }

      addToast(isPaid ? 'Règlement enregistré avec succès' : 'Règlement réinitialisé', 'success');
      await loadData();
      emitFinanceSync({ source: 'LesSuivis', missionId: row.missionId, demandeId: row.demandeId });
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour du règlement:', err);
      addToast(err?.message || 'Erreur lors de la mise à jour du règlement', 'error');
    }
  };

  // CSV Exporters
  const exportDuesCsv = () => {
    if (isGroupedByProfil) {
      const headers = [
        'Profil',
        'Nombre de missions',
        "Profil doit à l'agence",
        'Agence doit au profil',
        'Solde final',
      ];

      const rows = groupedProfiles.map((item) => {
        const solde = item.agenceDoitProfil - item.profilDoitAgence;
        let soldeText = '0,00 DH';
        if (solde > 0) soldeText = `Profil : ${money(solde)}`;
        else if (solde < 0) soldeText = `Agence : ${money(Math.abs(solde))}`;

        return [
          item.profilName,
          item.nbMissions,
          `${item.profilDoitAgence.toFixed(2)} DH`,
          `${item.agenceDoitProfil.toFixed(2)} DH`,
          soldeText,
        ];
      });

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `recapitulatif_par_profil_${getISODateLocal(new Date())}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const headers = [
      'Date Prestation',
      'Profil',
      'Client',
      'Ville',
      'Service',
      'Nbre H',
      'Taux Horaire',
      'Part Profil',
      'Part Agence',
      'CA',
      'Statut Paiement',
      'Statut Encaissement',
      'Reglement',
      'Frequence',
      'Remarque',
    ];

    const rows = filteredRows.map((row) => {
      const isSub = row.frequency === 'abonnement' || row.originalDemande?.frequency === 'abonnement';
      const freqLabel = isSub ? 'Abonnement' : 'Ponctuel';

      let statutEncais = '—';
      const isCredit = isCreditRow(row);
      const isDebit = isDebitRow(row);

      if (isCredit) {
        const isPaid = row.partProfilVersee ?? row._partProfilVersee;
        if (!isPaid) statutEncais = 'Créditeur';
      } else if (isDebit) {
        const isPaid = row.partAgenceReversee ?? row._partAgenceReversee;
        if (!isPaid) statutEncais = 'Débiteur';
      }

      const reglementPaid = isCredit ? (row.partProfilVersee ?? row._partProfilVersee) : (row.partAgenceReversee ?? row._partAgenceReversee);
      const reglementDate = isCredit ? row.dateVersementProfil : row.dateRemiseAgence;
      const reglementLabel = reglementPaid
        ? `Réglé - ${formatDateFR(reglementDate)}`
        : 'Non réglé';

      const hours = row.originalDemande?.nb_heures || row.originalDemande?.formulaire_data?.duree || row.originalDemande?.formulaire_data?.nb_heures || '—';

      return [
        row.date || '—',
        row.profil || '—',
        row.client || '—',
        row.ville || '—',
        row.service || '—',
        hours,
        row.originalDemande?.formulaire_data?.planning?.hourly_rate ? `${row.originalDemande?.formulaire_data?.planning?.hourly_rate} DH/h` : '30 DH/h',
        `${row.partProfil} DH`,
        row.isFirstProfileOfRow === false ? '—' : `${row.partAgence} DH`,
        (() => {
          if (row.isFirstProfileOfRow === false) {
            return '—';
          }
          const subInfo = getSubInfo(row);
          if (subInfo) {
            if (subInfo.rank === 1) {
              return `${subInfo.parentMontant || row.montant} DH (Abonnement 1/${subInfo.total})`;
            }
            return `Abonnement ${subInfo.rank}/${subInfo.total}`;
          }
          return `${row.montant} DH`;
        })(),
        getRealPaymentStatusLabel(row),
        statutEncais,
        reglementLabel,
        freqLabel,
        row.note_commercial || '',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suivi_dus_agence_profils_${getISODateLocal(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportCommerciauxCsv = () => {
    const headers = ['Rang', 'Commercial', "Chiffre d'affaires réalisé", 'Taux de contribution (%)', 'Commission agence'];

    const rows = commercialPerformance.ranking.map((item, idx) => [
      idx + 1,
      item.name,
      `${item.ca.toFixed(2)} DH`,
      `${item.pct.toFixed(2)}%`,
      `${item.commission.toFixed(2)} DH`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `suivi_commerciaux_${getISODateLocal(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canSeeDus && !canSeeCommerciaux) {
    return (
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#ef4444', fontWeight: 600, fontSize: 16 }}>
        <X size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
        Vous n'avez pas l'autorisation d'accéder aux suivis financiers.
      </div>
    );
  }

  return (
    <div className="ls-page">
      {/* Page Title & Subtitle */}
      <div className="ls-header">
        <h1>Les suivis</h1>
        <p>Suivi des dus Agence-Profils et des commerciaux</p>
      </div>

      {/* Tabs Menu */}
      <div className="ls-tabs-container">
        {canSeeDus && (
          <button
            className={`ls-tab-btn tab-dus ${activeTab === 'dus-profils' ? 'active' : ''}`}
            onClick={() => setActiveTab('dus-profils')}
          >
            Suivi des dus Agence-Profils
          </button>
        )}
        {canSeeCommerciaux && (
          <button
            className={`ls-tab-btn tab-comm ${activeTab === 'commerciaux' ? 'active' : ''}`}
            onClick={() => setActiveTab('commerciaux')}
          >
            Suivi des commerciaux
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Chargement des données en cours...
        </div>
      ) : (
        <>
          {/* ─── TAB 1: DUS AGENCE ↔ PROFILS ─── */}
          {activeTab === 'dus-profils' && canSeeDus && (
            <>
              {/* KPI Header block */}
              <div className="ls-kpi-banner">
                <div className="ls-kpi-banner-header">
                  <div className="ls-kpi-banner-title">
                    <h3>Suivi des dus Agence ↔ Profils</h3>
                    <p>Détail par mission FDM : parts, encaissement et règlement</p>
                  </div>
                  {hasPermission(user, 'consulter_dus_agences_profils') && (
                    <button className="ls-export-btn" onClick={exportDuesCsv}>
                      <Download size={14} /> Exporter CSV
                    </button>
                  )}
                </div>

                <div className="ls-kpi-banner-grid">
                  <div className="ls-kpi-item">
                    <span className="ls-kpi-item-value">{money(kpiStats.totalCa)}</span>
                    <span className="ls-kpi-item-label">Chiffre d'affaires total</span>
                    <span className="ls-kpi-item-sub">paiements reçus des clients</span>
                  </div>
                  <div className="ls-kpi-item">
                    <span className="ls-kpi-item-value">{money(kpiStats.totalPartAgence)}</span>
                    <span className="ls-kpi-item-label">Part agence</span>
                    <span className="ls-kpi-item-sub">Commission de l'agence (temps réel)</span>
                  </div>
                  <div className="ls-kpi-item">
                    <span className="ls-kpi-item-value">{money(kpiStats.totalPartProfil)}</span>
                    <span className="ls-kpi-item-label">Total versé aux profils</span>
                    <span className="ls-kpi-item-sub">Montant versé aux intervenants (temps réel)</span>
                  </div>
                  <div
                    className={`ls-kpi-item indicator-green ls-kpi-clickable ${kpiFilter === 'unpaid_agence' ? 'active' : ''}`}
                    onClick={() => setKpiFilter(prev => prev === 'unpaid_agence' ? 'all' : 'unpaid_agence')}
                    title="Cliquer pour filtrer les parts agence non réglées"
                  >
                    <span className="ls-kpi-item-value" style={{ color: '#10b981' }}>{money(kpiStats.unpaidPartAgence)}</span>
                    <span className="ls-kpi-item-label">Part agence non réglée</span>
                    <span className="ls-kpi-item-sub">Reste à percevoir par l'agence</span>
                  </div>
                  <div
                    className={`ls-kpi-item indicator-red ls-kpi-clickable ${kpiFilter === 'unpaid_profil' ? 'active' : ''}`}
                    onClick={() => setKpiFilter(prev => prev === 'unpaid_profil' ? 'all' : 'unpaid_profil')}
                    title="Cliquer pour filtrer les parts profils non réglées"
                  >
                    <span className="ls-kpi-item-value" style={{ color: '#ef4444' }}>{money(kpiStats.unpaidPartProfil)}</span>
                    <span className="ls-kpi-item-label">Part profils non réglée</span>
                    <span className="ls-kpi-item-sub">Reste à verser aux profils</span>
                  </div>
                </div>
              </div>

              {/* Filters container */}
              <div className="ls-filters-container">
                <div className="ls-search-box">
                  <Search size={16} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Rechercher profil, client, ville..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="ls-select-wrap">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">Tous les statuts</option>
                    <option value="paiement_en_attente">Paiement en attente</option>
                    <option value="agence_payee_client">Agence payée/client</option>
                    <option value="profil_paye_client">Profil payé/client</option>
                    <option value="paiement_partiel">Paiement partiel</option>
                    <option value="paye">A jour</option>
                    <option value="facturation_annulee">Facturation annulée</option>
                  </select>
                  <ChevronDown size={14} />
                </div>

                <div className="ls-select-wrap">
                  <select value={encaissementFilter} onChange={(e) => setEncaissementFilter(e.target.value)}>
                    <option value="all">Tous (Encaissement)</option>
                    <option value="crediteur">Créditeur</option>
                    <option value="debiteur">Débiteur</option>
                  </select>
                  <ChevronDown size={14} />
                </div>

                <div className="ls-select-wrap">
                  <select value={freqFilter} onChange={(e) => setFreqFilter(e.target.value)}>
                    <option value="all">Tous (Fréquence)</option>
                    <option value="ponctuel">Ponctuel</option>
                    <option value="abonnement">Abonnement</option>
                  </select>
                  <ChevronDown size={14} />
                </div>

                <div className="ls-period-box">
                  <button
                    type="button"
                    className="ls-week-arrow-btn"
                    title="Semaine précédente (Ven - Jeu)"
                    aria-label="Semaine précédente"
                    onClick={handlePrevWeek}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>Période:</span>
                  <label>
                    <Calendar size={14} />
                    <input
                      type="date"
                      aria-label="Date début"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <span style={{ color: '#64748b' }}>→</span>
                  <label>
                    <Calendar size={14} />
                    <input
                      type="date"
                      aria-label="Date fin"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="ls-week-arrow-btn"
                    title="Semaine suivante (Ven - Jeu)"
                    aria-label="Semaine suivante"
                    onClick={handleNextWeek}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <button
                  type="button"
                  className={`ls-group-btn ${isGroupedByProfil ? 'active' : ''}`}
                  onClick={() => {
                    setIsGroupedByProfil((prev) => {
                      const next = !prev;
                      if (next && (!dateFrom || !dateTo)) {
                        const w = getDefaultWeeklyFridayToThursday();
                        setDateFrom(w.from);
                        setDateTo(w.to);
                      }
                      return next;
                    });
                  }}
                >
                  <Users size={15} />
                  <span>Regrouper par profil</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isGroupedByProfil ? 'none' : 'rotate(180deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>
              </div>

              {kpiFilter !== 'all' && (
                <div className="ls-active-kpi-banner">
                  <span>
                    Filtre actif : <strong>{kpiFilter === 'unpaid_agence' ? "Part agence non réglée (Débiteur non réglé)" : "Part profils non réglée (Créditeur non réglé)"}</strong>
                  </span>
                  <button type="button" onClick={() => setKpiFilter('all')} className="ls-clear-kpi-filter">
                    Réinitialiser le filtre <X size={12} />
                  </button>
                </div>
              )}

              {isGroupedByProfil && (
                <div className="ls-group-summary-bar">
                  <div className="ls-group-summary-title">
                    <Users size={16} color="#0f766e" />
                    <span>Récapitulatif par profil ({groupedProfiles.length})</span>
                    <span className="ls-group-period-badge">
                      Semaine du {formatDateFRWithDay(dateFrom)} au {formatDateFRWithDay(dateTo)}
                    </span>
                  </div>
                  <div className="ls-group-week-nav">
                    <button
                      type="button"
                      className="ls-week-nav-btn"
                      onClick={handlePrevWeek}
                      title="Semaine précédente (Ven - Jeu)"
                    >
                      <ChevronLeft size={14} />
                      <span>Sem. préc.</span>
                    </button>
                    <button
                      type="button"
                      className="ls-week-nav-btn today"
                      onClick={handleCurrentWeek}
                      title="Revenir à la semaine en cours"
                    >
                      Cette semaine
                    </button>
                    <button
                      type="button"
                      className="ls-week-nav-btn"
                      onClick={handleNextWeek}
                      title="Semaine suivante (Ven - Jeu)"
                    >
                      <span>Sem. suiv.</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Main table */}
              <div className="ls-table-section">
                <div className="ls-table-wrapper sticky-table-wrap" ref={dusTableWrapRef}>
                  {isGroupedByProfil ? (
                    <table className="ls-table">
                      <thead>
                        <tr>
                          <th>PROFIL</th>
                          <th>NB MISSIONS</th>
                          <th>PROFIL DOIT À L'AGENCE</th>
                          <th>AGENCE DOIT AU PROFIL</th>
                          <th>SOLDE FINAL</th>
                          <th style={{ textAlign: 'center' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedProfiles.map((item) => {
                          const solde = item.agenceDoitProfil - item.profilDoitAgence;

                          return (
                            <tr key={item.profilName}>
                              <td>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    className="fg-link-btn"
                                    onClick={() => setSelectedDuesProfile(item)}
                                    title="Afficher le décompte et reçu des dûs"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {item.profilName}
                                  </button>
                                  {(() => {
                                    const cat = getProfilCategorie(item);
                                    return (
                                      <span className={`ls-badge-cat ${cat}`}>
                                        {cat === 'interne' ? 'Interne' : 'Externe'}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td>
                                <span className="ls-badge-count">{item.nbMissions}</span>
                              </td>
                              <td className="ls-val-bold ls-val-teal">
                                {money(item.profilDoitAgence)}
                              </td>
                              <td className="ls-val-bold ls-val-pink">
                                {money(item.agenceDoitProfil)}
                              </td>
                              <td>
                                {(() => {
                                  if (solde > 0) {
                                    return (
                                      <span className="ls-pill-solde pink">
                                        Profil : {money(solde)}
                                      </span>
                                    );
                                  }
                                  if (solde < 0) {
                                    return (
                                      <span className="ls-pill-solde green">
                                        Agence : {money(Math.abs(solde))}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="ls-pill-solde gray">
                                      0,00 DH
                                    </span>
                                  );
                                })()}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="ls-grouped-actions">
                                  <button
                                    type="button"
                                    className="ls-grouped-btn missions"
                                    title="Missions"
                                    aria-label="Missions"
                                    onClick={() => setSelectedDuesProfile(item)}
                                  >
                                    <Folder size={14} />
                                    <span className="ls-btn-tooltip">Missions</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="ls-grouped-btn pay"
                                    title="Régler la totalité des dûs entre l'agence et ce profil"
                                    onClick={() => setSettleConfirmProfile(item)}
                                  >
                                    <Pencil size={13} />
                                    <span>Payer</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="ls-grouped-btn receipt"
                                    title="Générer le reçu PDF"
                                    onClick={() => generateProfileReceiptPdf(item, dateFrom, dateTo)}
                                  >
                                    <FileText size={13} />
                                    <span>Générer le reçu</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {groupedProfiles.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                              Aucun profil trouvé pour les filtres sélectionnés.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="ls-table">
                      <thead>
                      <tr>
                        <th>Date Prestation</th>
                        <th>Profil (FDM)</th>
                        <th>Client / Ville</th>
                        <th>Type de service</th>
                        <th>Nbre H</th>
                        <th>Taux Horaire</th>
                        <th>Part Profil</th>
                        <th>Part Agence</th>
                        <th>CA</th>
                        <th>Statut Paiem.</th>
                        <th>Statut Encais.</th>
                        <th>Règlement FDM</th>
                        <th>Remarque</th>
                        <th>Fréquence</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, idx) => {
                        const isSub = row.frequency === 'abonnement' || row.originalDemande?.frequency === 'abonnement';
                        const freqLabel = isSub ? 'Abonnement' : 'Ponctuel';

                        let statusEncais = '—';
                        const isCredit = isCreditRow(row);
                        const isDebit = isDebitRow(row);

                        if (isCredit) {
                          const isPaid = row.partProfilVersee ?? row._partProfilVersee;
                          if (!isPaid) statusEncais = 'Créditeur';
                        } else if (isDebit) {
                          const isPaid = row.partAgenceReversee ?? row._partAgenceReversee;
                          if (!isPaid) statusEncais = 'Débiteur';
                        }

                        const reglementPaid = isCredit ? (row.partProfilVersee ?? row._partProfilVersee) : (row.partAgenceReversee ?? row._partAgenceReversee);
                        const reglementDate = isCredit ? row.dateVersementProfil : row.dateRemiseAgence;
                        const hours = row.originalDemande?.nb_heures || row.originalDemande?.formulaire_data?.duree || row.originalDemande?.formulaire_data?.nb_heures || '—';

                        return (
                          <tr key={row._uniqueKey || `${row.missionNo}-${idx}`}>
                            <td>{row.date || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {row.profilId ? (
                                    <button type="button" className="fg-link-btn" onClick={() => goToProfilDetails(row.profilId)}>
                                      {row.profil}
                                    </button>
                                  ) : (
                                    <span>{row.profil}</span>
                                  )}
                                  {(() => {
                                    const cat = getProfilCategorie(row);
                                    return (
                                      <span className={`ls-badge-cat ${cat}`}>
                                        {cat === 'interne' ? 'Interne' : 'Externe'}
                                      </span>
                                    );
                                  })()}
                                </div>
                                {row.isDelegate && (
                                  <span className="ls-badge-delegate" title="Profil délégué sur la mission">
                                    👑 Délégué
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {row.clientId ? (
                                <button type="button" className="fg-link-btn" onClick={() => goToClientDetails(row.clientId)}>
                                  {row.client}
                                </button>
                              ) : row.client}
                              <small className="ls-text-muted">{row.ville}</small>
                            </td>
                            <td>{row.service}</td>
                            <td>{hours}</td>
                            <td>
                              {row.originalDemande?.formulaire_data?.planning?.hourly_rate
                                ? `${row.originalDemande?.formulaire_data?.planning?.hourly_rate} DH/h`
                                : '30 DH/h'}
                            </td>
                            <td className="ls-val-bold ls-val-teal">
                              {(() => {
                                const hasPartsRepartition = Array.isArray(row.parts_repartition) && row.parts_repartition.length > 0;
                                const hasExplicitPartAgence = row.partAgence > 0;
                                if (!hasPartsRepartition && !hasExplicitPartAgence) return '—';
                                return money(row.partProfil);
                              })()}
                            </td>
                            <td className="ls-val-bold ls-val-blue">
                              {(() => {
                                if (row.isFirstProfileOfRow === false) {
                                  return '—';
                                }
                                const hasPartsRepartition = Array.isArray(row.parts_repartition) && row.parts_repartition.length > 0;
                                const hasExplicitPartAgence = row.partAgence > 0;
                                if (!hasPartsRepartition && !hasExplicitPartAgence) return '—';
                                return money(row.partAgence);
                              })()}
                            </td>
                            <td className="ls-val-bold">
                              {(() => {
                                if (row.isFirstProfileOfRow === false) {
                                  return '—';
                                }
                                const subInfo = getSubInfo(row);
                                if (subInfo) {
                                  if (subInfo.rank === 1) {
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', lineHeight: '1.2' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{money(subInfo.parentMontant || row.montant)}</span>
                                        <span style={{ fontSize: '0.8rem', color: '#0f5f5b', fontWeight: 600 }}>Abonnement</span>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{subInfo.rank}/{subInfo.total}</span>
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', lineHeight: '1.2' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#0f5f5b', fontWeight: 600 }}>Abonnement</span>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{subInfo.rank}/{subInfo.total}</span>
                                      </div>
                                    );
                                  }
                                }
                                return money(row.montant);
                              })()}
                            </td>
                            <td>
                              <span className={`ls-pill ${getRealPaymentStatusClass(row)}`}>
                                {getRealPaymentStatusLabel(row)}
                              </span>
                            </td>
                            <td>
                              {statusEncais === 'Créditeur' && <span className="ls-pill red">Créditeur</span>}
                              {statusEncais === 'Débiteur' && <span className="ls-pill green">Débiteur</span>}
                              {statusEncais === '—' && '—'}
                            </td>
                            <td>
                              <label className="fg-select-wrap fg-compact-select" style={{ minWidth: '110px' }}>
                                <select
                                  className={`ls-status-select ${reglementPaid ? 'paid' : 'unpaid'}`}
                                  value={reglementPaid ? 'Payé' : 'Non payé'}
                                  onChange={(e) => void handleUpdateRowReglement(row, e.target.value as 'Payé' | 'Non payé')}
                                >
                                  <option value="Non payé">Non réglé</option>
                                  <option value="Payé">{reglementPaid && reglementDate ? `Réglé (${formatDateFR(reglementDate)})` : 'Réglé'}</option>
                                </select>
                                <ChevronDown size={14} />
                              </label>
                            </td>
                            <td>{row.note_commercial || '—'}</td>
                            <td>
                              <span className={`ls-pill ${isSub ? 'blue' : 'gray'}`}>
                                {freqLabel}
                              </span>
                            </td>
                            <td>
                              <div className="ls-action-cell" style={{ justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="ls-action-btn"
                                  title="Voir les détails"
                                  onClick={() => handleOpenDetails(row)}
                                >
                                  <Eye size={13} />
                                </button>
                                {(() => {
                                  const pName = (row.profil || '').trim();
                                  const hasProfil = pName && pName !== '—' && pName !== 'Non assigné' && pName !== 'Profil inconnu';
                                  if (!hasProfil) {
                                    return (
                                      <button
                                        type="button"
                                        className="ls-action-btn disabled"
                                        disabled
                                        title="Aucun profil assigné"
                                        aria-label="Aucun profil assigné"
                                        style={{ opacity: 0.35, cursor: 'not-allowed' }}
                                      >
                                        <Folder size={13} />
                                      </button>
                                    );
                                  }

                                  const profileItem = groupedProfiles.find((item) =>
                                    (row.profilId && item.profilId === row.profilId) ||
                                    item.profilName.trim().toLowerCase() === pName.toLowerCase()
                                  );

                                  return (
                                    <button
                                      type="button"
                                      className="ls-action-btn missions"
                                      title="Missions"
                                      aria-label="Missions"
                                      onClick={() => {
                                        if (profileItem) {
                                          setSelectedDuesProfile(profileItem);
                                        } else {
                                          setSelectedDuesProfile({
                                            profilId: row.profilId,
                                            profilName: pName,
                                            phone: row.phone,
                                            categorie: row.categorie,
                                            nbMissions: 1,
                                            profilDoitAgence: 0,
                                            agenceDoitProfil: 0,
                                            rows: [row],
                                          });
                                        }
                                      }}
                                    >
                                      <Folder size={13} />
                                      <span className="ls-btn-tooltip">Missions</span>
                                    </button>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={15} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                            Aucune donnée disponible pour les filtres sélectionnés.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  )}
                </div>
              </div>

              {/* Bottom Sticky Horizontal Scrollbar - Figée en bas comme sur le dashboard */}
              <StickyHorizontalScrollbar
                targetRef={dusTableWrapRef}
                dependencies={[filteredRows, isGroupedByProfil]}
              />
            </>
          )}

          {/* ─── TAB 2: SUIVI DES COMMERCIAUX ─── */}
          {activeTab === 'commerciaux' && canSeeCommerciaux && (
            <>
              {/* Filter Row */}
              <div className="ls-filters-container" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Période</span>
                    <div className="ls-select-wrap">
                      <select
                        value={periodFilter}
                        onChange={(e) => setPeriodFilter(e.target.value as any)}
                        disabled={!hasPermission(user, 'filtrer_suivi_commerciaux')}
                      >
                        <option value="mois-en-cours">Ce mois</option>
                        <option value="mois-dernier">Le mois dernier</option>
                        <option value="annee-en-cours">Cette année</option>
                        <option value="tous">Tous</option>
                        <option value="personnalise">Personnalisé</option>
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>

                  {periodFilter === 'personnalise' && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Du</span>
                        <input
                          type="date"
                          style={{
                            height: '40px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0 0.75rem',
                            fontSize: '0.875rem',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            width: '140px'
                          }}
                          value={commDateFrom}
                          onChange={(e) => setCommDateFrom(e.target.value)}
                          disabled={!hasPermission(user, 'filtrer_suivi_commerciaux')}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Au</span>
                        <input
                          type="date"
                          style={{
                            height: '40px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0 0.75rem',
                            fontSize: '0.875rem',
                            color: '#0f172a',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                            width: '140px'
                          }}
                          value={commDateTo}
                          onChange={(e) => setCommDateTo(e.target.value)}
                          disabled={!hasPermission(user, 'filtrer_suivi_commerciaux')}
                        />
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Commercial</span>
                    <div className="ls-select-wrap">
                      <select
                        value={selectedCommercialName || 'all'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCommercialFilter(val);
                          setSelectedCommercialName(val === 'all' ? null : val);
                        }}
                        disabled={!hasPermission(user, 'filtrer_suivi_commerciaux')}
                      >
                        <option value="all">Tous les commerciaux</option>
                        {commerciauxList.map((c) => {
                          const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username;
                          return (
                            <option key={c.id} value={fullName}>
                              {fullName}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '40px' }}
                  onClick={exportCommerciauxCsv}
                >
                  <Download size={14} /> Exporter
                </button>
              </div>

              {selectedCommercialName && selectedCommercialDetail ? (
                <>
                  {/* Detailed Drilldown View */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setSelectedCommercialName(null);
                        setCommercialFilter('all');
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '40px' }}
                    >
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>←</span> Retour
                    </button>
                    <div className="ls-avatar" style={{ width: '40px', height: '40px', fontSize: '0.875rem', backgroundColor: '#e2e8f0', color: '#475569' }}>
                      {(() => {
                        const name = selectedCommercialName || '';
                        return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
                      })()}
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {selectedCommercialName}
                      </h2>
                      <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: 0 }}>
                        Détail des réalisations
                      </p>
                    </div>
                  </div>

                  {/* 4 KPIs */}
                  <div className="ls-comm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="ls-comm-kpi-card">
                      <div className="ls-comm-kpi-icon" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
                        <DollarSign size={20} />
                      </div>
                      <div className="ls-comm-kpi-info">
                        <p>Total réalisations</p>
                        <h4 style={{ color: '#137333' }}>{money(selectedCommercialDetail.totalRealisation)}</h4>
                      </div>
                    </div>
                    <div className="ls-comm-kpi-card">
                      <div className="ls-comm-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#1a73e8' }}>
                        <Calendar size={20} />
                      </div>
                      <div className="ls-comm-kpi-info">
                        <p>Mois travaillés</p>
                        <h4>{selectedCommercialDetail.monthsWorked}</h4>
                      </div>
                    </div>
                    <div className="ls-comm-kpi-card">
                      <div className="ls-comm-kpi-icon" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
                        <TrendingUp size={20} />
                      </div>
                      <div className="ls-comm-kpi-info">
                        <p>Moyenne / mois travaillé</p>
                        <h4 style={{ color: '#137333' }}>{money(selectedCommercialDetail.moyenneParMois)}</h4>
                      </div>
                    </div>
                    <div className="ls-comm-kpi-card">
                      <div className="ls-comm-kpi-icon" style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}>
                        <Users size={20} />
                      </div>
                      <div className="ls-comm-kpi-info">
                        <p>Dossiers</p>
                        <h4>{selectedCommercialDetail.totalDossiers}</h4>
                      </div>
                    </div>
                  </div>

                  {/* Tables */}
                  <h3 className="ls-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                    <Calendar size={16} /> PAR MOIS
                  </h3>
                  <div className="ls-table-section" style={{ marginBottom: '0.75rem' }}>
                    <div className="ls-table-wrapper">
                      <table className="ls-table">
                        <thead>
                          <tr>
                            <th>PÉRIODE</th>
                            <th>RÉALISATION</th>
                            <th>DOSSIERS</th>
                            <th>COMMISSION AGENCE</th>
                            <th>PART</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCommercialDetail.parMois.map((item) => (
                            <tr key={item.period}>
                              <td className="ls-val-bold">{item.period}</td>
                              <td className="ls-val-bold">{money(item.realisation)}</td>
                              <td>{item.dossiers}</td>
                              <td className="ls-val-bold" style={{ color: '#059669' }}>{money(item.commAgence)}</td>
                              <td>
                                <span className="ls-pill gray" style={{ backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold' }}>
                                  {item.pct.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                          {selectedCommercialDetail.parMois.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                Aucune donnée disponible.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <h3 className="ls-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                    <Calendar size={16} /> PAR TRIMESTRE
                  </h3>
                  <div className="ls-table-section" style={{ marginBottom: '0.75rem' }}>
                    <div className="ls-table-wrapper">
                      <table className="ls-table">
                        <thead>
                          <tr>
                            <th>PÉRIODE</th>
                            <th>RÉALISATION</th>
                            <th>DOSSIERS</th>
                            <th>COMMISSION AGENCE</th>
                            <th>PART</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCommercialDetail.parTrimestre.map((item) => (
                            <tr key={item.period}>
                              <td className="ls-val-bold">{item.period}</td>
                              <td className="ls-val-bold">{money(item.realisation)}</td>
                              <td>{item.dossiers}</td>
                              <td className="ls-val-bold" style={{ color: '#059669' }}>{money(item.commAgence)}</td>
                              <td>
                                <span className="ls-pill gray" style={{ backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold' }}>
                                  {item.pct.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                          {selectedCommercialDetail.parTrimestre.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                Aucune donnée disponible.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <h3 className="ls-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                    <Calendar size={16} /> PAR ANNÉE
                  </h3>
                  <div className="ls-table-section" style={{ marginBottom: '0.75rem' }}>
                    <div className="ls-table-wrapper">
                      <table className="ls-table">
                        <thead>
                          <tr>
                            <th>PÉRIODE</th>
                            <th>RÉALISATION</th>
                            <th>DOSSIERS</th>
                            <th>COMMISSION AGENCE</th>
                            <th>PART</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCommercialDetail.parAnnee.map((item) => (
                            <tr key={item.period}>
                              <td className="ls-val-bold">{item.period}</td>
                              <td className="ls-val-bold">{money(item.realisation)}</td>
                              <td>{item.dossiers}</td>
                              <td className="ls-val-bold" style={{ color: '#059669' }}>{money(item.commAgence)}</td>
                              <td>
                                <span className="ls-pill gray" style={{ backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 'bold' }}>
                                  {item.pct.toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                          {selectedCommercialDetail.parAnnee.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                Aucune donnée disponible.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* General Overview Tab */}
                  <div className="ls-comm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="ls-comm-kpi-card">
                      <div className="ls-comm-kpi-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                        <Users size={20} />
                      </div>
                      <div className="ls-comm-kpi-info">
                        <h4>{commercialPerformance.activeCount}</h4>
                        <p>Commerciaux actifs</p>
                      </div>
                    </div>
                    <div className="ls-comm-kpi-card">
                      <div className="ls-comm-kpi-icon" style={{ backgroundColor: '#e6f4ea', color: '#137333' }}>
                        <TrendingUp size={20} />
                      </div>
                      <div className="ls-comm-kpi-info">
                        <h4 style={{ color: '#137333' }}>{money(commercialPerformance.totalCA)}</h4>
                        <p>CA total équipe</p>
                      </div>
                    </div>
                    <div className="ls-comm-kpi-card">
                      <div className="ls-comm-kpi-icon" style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}>
                        <DollarSign size={20} />
                      </div>
                      <div className="ls-comm-kpi-info">
                        <h4>{money(commercialPerformance.commissionAgence)}</h4>
                        <p>Commission agence</p>
                      </div>
                    </div>
                  </div>

                  <h3 className="ls-section-title">Classement des Commerciaux</h3>
                  <div className="ls-ranking-grid" style={{ marginBottom: '1.5rem' }}>
                    {commercialPerformance.ranking.map((item, idx) => {
                      const initials = item.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <div
                          className="ls-ranking-card"
                          key={item.name}
                          onClick={() => {
                            setSelectedCommercialName(item.name);
                            setCommercialFilter(item.name);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className={`ls-ranking-badge ${idx === 0 ? 'first' : ''}`}>
                            #{idx + 1}
                          </span>
                          <div className="ls-ranking-profile">
                            <div className="ls-avatar">{initials}</div>
                            <div>
                              <span className="ls-ranking-name">{item.name}</span>
                              <span className="ls-ranking-role">Commercial</span>
                            </div>
                          </div>
                          
                          <div className="ls-ranking-progress-wrap">
                            <div className="ls-ranking-progress-header">
                              <span className="ls-ranking-progress-label">Taux de contribution (%)</span>
                              <span className="ls-ranking-progress-val">{item.pct.toFixed(2)}%</span>
                            </div>
                            <div className="ls-progress-bar">
                              <div className="ls-progress-fill" style={{ width: `${item.pct}%` }} />
                            </div>
                          </div>

                          <div className="ls-ranking-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                            <div className="ls-ranking-stat-item">
                              <span className="ls-ranking-stat-label">Chiffre d'affaires réalisé</span>
                              <span className="ls-ranking-stat-val">{money(item.ca)}</span>
                            </div>
                            <div className="ls-ranking-stat-item">
                              <span className="ls-ranking-stat-label">Commission agence</span>
                              <span className="ls-ranking-stat-val commission">{money(item.commission)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {commercialPerformance.ranking.length === 0 && (
                      <div style={{ gridColumn: 'span 4', textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        Aucune performance enregistrée pour cette période.
                      </div>
                    )}
                  </div>

                  <h3 className="ls-section-title">Détail par Commercial</h3>
                  <div className="ls-table-section">
                    <div className="ls-table-wrapper">
                      <table className="ls-table">
                        <thead>
                          <tr>
                            <th>Commercial</th>
                            <th>Chiffre d'affaires réalisé</th>
                            <th>Commission agence</th>
                            <th>Taux de contribution (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {commercialPerformance.ranking.map((item) => {
                            const initials = item.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2);

                            return (
                              <tr key={item.name} style={{ cursor: 'pointer' }} onClick={() => {
                                setSelectedCommercialName(item.name);
                                setCommercialFilter(item.name);
                              }}>
                                <td>
                                  <div className="ls-commercial-avatar-cell">
                                    <div className="ls-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>
                                      {initials}
                                    </div>
                                    <span className="ls-val-bold">{item.name}</span>
                                  </div>
                                </td>
                                <td className="ls-val-bold">{money(item.ca)}</td>
                                <td className="ls-val-bold" style={{ color: '#059669' }}>
                                  {money(item.commission)}
                                </td>
                                <td>
                                  <span className="ls-pill gray" style={{ backgroundColor: '#fce7f3', color: '#be185d', fontWeight: 'bold' }}>
                                    {item.pct.toFixed(2)}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {commercialPerformance.ranking.length === 0 && (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                Aucune donnée disponible.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}



          {/* ─── MODAL: VIEW DETAILS ─── */}
          {showDetailsModal && selectedRow && (
            <div className="ls-modal-backdrop">
              <div className="ls-modal large">
                <div className="ls-modal-header">
                  <div>
                    <h3 className="ls-modal-title">Résumé de la mission</h3>
                    <p className="ls-modal-subtitle">Détails financiers et d'intervention</p>
                  </div>
                  <button className="ls-modal-close" onClick={() => setShowDetailsModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="ls-modal-body">
                  <div className="ls-details-grid">
                    {/* Left Column */}
                    <div className="ls-details-column">
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Date Prestation</span>
                        <span className="ls-detail-value">{selectedRow.date || '—'}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Profil (FDM)</span>
                        <span className="ls-detail-value" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>{selectedRow.profil || '—'}</span>
                          {(() => {
                            const cat = getProfilCategorie(selectedRow);
                            return (
                              <span className={`ls-badge-cat ${cat}`}>
                                {cat === 'interne' ? 'Interne' : 'Externe'}
                              </span>
                            );
                          })()}
                        </span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Client</span>
                        <span className="ls-detail-value">{selectedRow.client || '—'}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Ville</span>
                        <span className="ls-detail-value">{selectedRow.ville || '—'}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Type de service</span>
                        <span className="ls-detail-value">{selectedRow.service || '—'}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Fréquence</span>
                        <span className="ls-detail-value">{selectedRow.frequency === 'abonnement' ? 'Abonnement' : 'Ponctuel'}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Nbre Heures</span>
                        <span className="ls-detail-value">
                          {selectedRow.originalDemande?.nb_heures || selectedRow.originalDemande?.formulaire_data?.duree || selectedRow.originalDemande?.formulaire_data?.nb_heures || '—'}
                        </span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Taux Horaire</span>
                        <span className="ls-detail-value">
                          {selectedRow.originalDemande?.formulaire_data?.planning?.hourly_rate
                            ? `${selectedRow.originalDemande?.formulaire_data?.planning?.hourly_rate} DH/h`
                            : '30 DH/h'}
                        </span>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="ls-details-column">
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">CA Total</span>
                        <span className="ls-detail-value">{money(selectedRow.montant)}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Part Agence</span>
                        <span className="ls-detail-value blue">{money(selectedRow.partAgence)}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Part Profil</span>
                        <span className="ls-detail-value teal">{money(selectedRow.partProfil)}</span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Statut Paiement</span>
                        <span className={`ls-pill ${getRealPaymentStatusClass(selectedRow)}`}>
                          {getRealPaymentStatusLabel(selectedRow)}
                        </span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Statut Encaissement</span>
                        <span className="ls-detail-value">
                          {(() => {
                            if (isCreditRow(selectedRow)) return 'Créditeur';
                            if (isDebitRow(selectedRow)) return 'Débiteur';
                            return '—';
                          })()}
                        </span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Règlement FDM</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className="fg-select-wrap fg-compact-select" style={{ minWidth: '120px' }}>
                            <select
                              className={`ls-status-select ${(() => {
                                const isCredit = isCreditRow(selectedRow);
                                const reglementPaid = isCredit ? (selectedRow.partProfilVersee ?? selectedRow._partProfilVersee) : (selectedRow.partAgenceReversee ?? selectedRow._partAgenceReversee);
                                return reglementPaid ? 'paid' : 'unpaid';
                              })()}`}
                              value={(() => {
                                const isCredit = isCreditRow(selectedRow);
                                const reglementPaid = isCredit ? (selectedRow.partProfilVersee ?? selectedRow._partProfilVersee) : (selectedRow.partAgenceReversee ?? selectedRow._partAgenceReversee);
                                return reglementPaid ? 'Payé' : 'Non payé';
                              })()}
                              onChange={async (e) => {
                                const next = e.target.value as 'Payé' | 'Non payé';
                                await handleUpdateRowReglement(selectedRow, next);
                                const isPaid = next === 'Payé';
                                setSelectedRow((prev) => prev ? {
                                  ...prev,
                                  partProfilVersee: isPaid,
                                  _partProfilVersee: isPaid,
                                  partAgenceReversee: isPaid,
                                  _partAgenceReversee: isPaid,
                                  dateVersementProfil: isPaid ? getISODateLocal(new Date()) : undefined,
                                  dateRemiseAgence: isPaid ? getISODateLocal(new Date()) : undefined
                                } : null);
                              }}
                            >
                              <option value="Non payé">Non réglé</option>
                              <option value="Payé">Réglé</option>
                            </select>
                            <ChevronDown size={14} />
                          </label>
                        </div>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Remarque</span>
                        <span className="ls-detail-value">{selectedRow.note_commercial || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Traçabilité du workflow de prestation */}
                  {(() => {
                    const history = selectedRow.originalDemande?.formulaire_data?.workflow_history;
                    if (!Array.isArray(history) || history.length === 0) return null;

                    return (
                      <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={16} style={{ color: '#0d9488' }} />
                          Traçabilité du workflow de prestation
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {history.map((entry: any, idx: number) => {
                            const fromInfo = entry.from_statut ? getStatusInfo(entry.from_statut) : null;
                            const toInfo = entry.to_statut ? getStatusInfo(entry.to_statut) : null;
                            const dateStr = entry.changed_at
                              ? new Date(entry.changed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : '—';
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '12.5px',
                                  gap: '12px',
                                  flexWrap: 'wrap'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, color: '#475569' }}>{dateStr}</span>
                                  {fromInfo && (
                                    <>
                                      <span className={`badge ${fromInfo.badgeClass}`} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                                        {fromInfo.label}
                                      </span>
                                      <span style={{ color: '#94a3b8' }}>→</span>
                                    </>
                                  )}
                                  {toInfo && (
                                    <span className={`badge ${toInfo.badgeClass}`} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                                      {toInfo.label}
                                    </span>
                                  )}
                                  {entry.note && (
                                    <span style={{ color: '#64748b', fontSize: '11.5px', fontStyle: 'italic' }}>({entry.note})</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>
                                  {entry.changed_by || 'Système'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="ls-modal-footer">
                  {(selectedRow.demandeId || selectedRow.originalDemande?.id) &&
                    (hasPermissionWithContext(user, 'editer_besoin_facture', selectedRow.originalDemande) ||
                     hasPermissionWithContext(user, 'editer_besoin', selectedRow.originalDemande) ||
                     hasPermissionWithContext(user, 'editer_besoin_agence', selectedRow.originalDemande) ||
                     hasPermission(user, 'modifier_demande')) && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => {
                        const targetId = selectedRow.originalDemande?.id || selectedRow.demandeId;
                        setShowDetailsModal(false);
                        navigate(`/?edit=${targetId}`);
                      }}
                    >
                      <Pencil size={14} /> Éditer le besoin
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={() => setShowDetailsModal(false)}>
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── MODAL: PROFILE DUES & RECEIPT POPUP (Redesigned Executive UI) ─── */}
          {activeDuesProfile && (() => {
            const initials = (activeDuesProfile.profilName || '')
              .split(' ')
              .map((n: string) => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase() || 'P';

            return (
              <div className="ls-dues-modal-overlay" onClick={() => setSelectedDuesProfile(null)}>
                <div className="ls-dues-modal-card" onClick={(e) => e.stopPropagation()}>
                  {/* Header */}
                  <div className="ls-dues-modal-header">
                    <div className="ls-dues-header-profile">
                      <div className="ls-dues-avatar">{initials}</div>
                      <div>
                        <div className="ls-dues-profile-badge-row">
                          <span className="ls-dues-profile-badge">INTERVENANTE</span>
                          {(() => {
                            const cat = getProfilCategorie(activeDuesProfile);
                            return (
                              <span className={`ls-badge-cat ${cat}`}>
                                {cat === 'interne' ? 'Interne' : 'Externe'}
                              </span>
                            );
                          })()}
                          {activeDuesProfile.profilId && (
                            <span className="ls-dues-profile-id">#{activeDuesProfile.profilId}</span>
                          )}
                        </div>
                        <h2 className="ls-dues-profile-name">{activeDuesProfile.profilName}</h2>
                        <div className="ls-dues-period-tag">
                          <button
                            type="button"
                            className="ls-dues-nav-arrow"
                            title="Semaine précédente (Ven - Jeu)"
                            aria-label="Semaine précédente"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePrevWeek();
                            }}
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <Calendar size={14} />
                          <span>Semaine du {formatDateFRWithDay(dateFrom)} au {formatDateFRWithDay(dateTo)}</span>
                          <button
                            type="button"
                            className="ls-dues-nav-arrow"
                            title="Semaine suivante (Ven - Jeu)"
                            aria-label="Semaine suivante"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNextWeek();
                            }}
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="ls-dues-header-actions">
                      <button
                        type="button"
                        className="ls-dues-btn-pay"
                        onClick={() => setSettleConfirmProfile(activeDuesProfile)}
                        title="Régler le paiement total entre l'agence et ce profil pour cette semaine"
                      >
                        <Pencil size={15} />
                        <span>Régler le paiement</span>
                      </button>
                      {activeDuesProfile.profilId && (
                        <button
                          type="button"
                          className="ls-dues-btn-details"
                          onClick={() => goToProfilDetails(activeDuesProfile.profilId)}
                          title="Voir la fiche détaillée du profil"
                        >
                          <Eye size={15} />
                          <span>Fiche profil</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="ls-dues-btn-close"
                        onClick={() => setSelectedDuesProfile(null)}
                        title="Fermer"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* 3 KPI Bento Cards */}
                  {/* KPI Cards */}
                  {(() => {
                    const totalSupplementsPeriod = activeDuesProfile.rows.reduce((sum: number, r: FacturationRow) => {
                      return sum + (r.hasSupplementHeures && r.supplementHeuresRecupereEspeces ? Number(r.supplementHeuresMontant || 0) : 0);
                    }, 0);

                    return (
                      <div className="ls-dues-kpis-grid">
                        <div className="ls-dues-kpi-card missions">
                          <div className="ls-dues-kpi-header">
                            <span className="ls-dues-kpi-label">Prestations</span>
                            <div className="ls-dues-kpi-icon-wrap neutral">
                              <FileText size={16} />
                            </div>
                          </div>
                          <div className="ls-dues-kpi-value neutral">{activeDuesProfile.rows.length}</div>
                          <div className="ls-dues-kpi-sub">Missions sur la période</div>
                        </div>

                        <div className="ls-dues-kpi-card revenue">
                          <div className="ls-dues-kpi-header">
                            <span className="ls-dues-kpi-label">Encaissé par le profil</span>
                            <div className="ls-dues-kpi-icon-wrap emerald">
                              <ArrowDownLeft size={16} />
                            </div>
                          </div>
                          <div className="ls-dues-kpi-value emerald">
                            {money(activeDuesProfile.profilDoitAgence)}
                          </div>
                          <div className="ls-dues-kpi-sub">
                            Montant dû à l'agence (espèces)
                            {totalSupplementsPeriod > 0 && (
                              <span style={{ display: 'block', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                dont {money(totalSupplementsPeriod)} de suppléments
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="ls-dues-kpi-card to-pay">
                          <div className="ls-dues-kpi-header">
                            <span className="ls-dues-kpi-label">Rémunération due</span>
                            <div className="ls-dues-kpi-icon-wrap rose">
                              <ArrowUpRight size={16} />
                            </div>
                          </div>
                          <div className="ls-dues-kpi-value rose">
                            {money(activeDuesProfile.agenceDoitProfil)}
                          </div>
                          <div className="ls-dues-kpi-sub">Part intervenante à verser</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Dues breakdown table */}
                  <div className="ls-dues-table-box">
                    <table className="ls-dues-table">
                      <thead>
                        <tr>
                          <th>Date de mission</th>
                          <th>Client & Prestation</th>
                          <th style={{ textAlign: 'right' }}>Dû à l'agence</th>
                          <th style={{ textAlign: 'right' }}>Agence doit au profil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDuesProfile.rows.map((row: FacturationRow, idx: number) => {
                          const b = getRowDuesBreakdown(row);
                          const dateObj = parseFrenchDate(row.date);
                          const dayNumber = dateObj ? dateObj.getDate() : '';

                          return (
                            <tr key={row._uniqueKey || `${row.missionNo}-${idx}`}>
                              <td>
                                <div className="ls-dues-date-cell">
                                  {dayNumber && <span className="ls-dues-day-circle">{dayNumber}</span>}
                                  <span className="ls-dues-date-text">{row.date ? formatDateFRWithDay(row.date) : '—'}</span>
                                </div>
                              </td>
                              <td>
                                <div className="ls-dues-client-cell">
                                  <span className="ls-dues-client-pill">
                                    <User size={13} />
                                    <span>{row.client || '—'}</span>
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                    {row.service && (
                                      <span className="ls-dues-service-hint">
                                        {row.missionNo ? `#${row.missionNo} • ` : ''}{row.service}
                                      </span>
                                    )}
                                    {b.supplementMontant > 0 && (
                                      <span className="ls-dues-supplement-tag" title="Supplément d'heures réglé par le client">
                                        <Sparkles size={11} />
                                        <span>Supplément : {money(b.supplementMontant)}</span>
                                      </span>
                                    )}
                                    {b.especesRecuperees > 0 && (
                                      <span className="ls-dues-supplement-tag" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }} title="Part espèces perçue directement auprès du client sur place">
                                        <span>Espèces perçues FDM : {money(b.especesRecuperees)}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {b.doitAgence > 0 ? (
                                  <div className="ls-dues-val-wrap align-right">
                                    <span className="ls-dues-val-badge green">
                                      <ArrowDownLeft size={13} />
                                      {money(b.doitAgence)}
                                    </span>
                                    {b.hasSupplementNote && b.supplementMontant > 0 && (
                                      <span className="ls-dues-subtext-orange" style={{ fontWeight: 700, display: 'block', marginTop: '2px' }}>
                                        Supplément espèces : {money(b.supplementMontant)}
                                      </span>
                                    )}
                                    {b.hasSupplementNote && !b.supplementMontant && (
                                      <span className="ls-dues-subtext-orange">
                                        Supplément espèces
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="ls-dues-empty-val">—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {b.agenceDoit > 0 ? (
                                  <div className="ls-dues-val-wrap align-right">
                                    <span className="ls-dues-val-badge rose">
                                      <ArrowUpRight size={13} />
                                      {money(b.agenceDoit)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="ls-dues-empty-val">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {activeDuesProfile.rows.length === 0 && (
                          <tr>
                            <td colSpan={4} className="ls-dues-empty-row">
                              Aucune mission trouvée pour cette période.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>
                            <span className="ls-dues-total-label">Total de la période</span>
                            {(() => {
                              const suppSum = activeDuesProfile.rows.reduce((sum: number, r: FacturationRow) => {
                                return sum + (r.hasSupplementHeures && r.supplementHeuresRecupereEspeces ? Number(r.supplementHeuresMontant || 0) : 0);
                              }, 0);
                              const espSum = activeDuesProfile.rows.reduce((sum: number, r: FacturationRow) => {
                                return sum + Number(r.especesRecuperees || 0);
                              }, 0);
                              return (
                                <>
                                  {suppSum > 0 && (
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                      (dont {money(suppSum)} de suppléments espèces)
                                    </span>
                                  )}
                                  {espSum > 0 && (
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginTop: '2px' }}>
                                      (dont {money(espSum)} d'espèces perçues sur place)
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="ls-dues-total-val green">
                              {money(activeDuesProfile.profilDoitAgence)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="ls-dues-total-val rose">
                              {money(activeDuesProfile.agenceDoitProfil)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Footer Note & PDF Download */}
                  <div className="ls-dues-modal-footer">
                    <div className="ls-dues-nb-note">
                      <Info size={15} className="ls-dues-info-icon" />
                      <span>Période de facturation hebdomadaire : du vendredi au jeudi inclus.</span>
                    </div>
                    <button
                      type="button"
                      className="ls-dues-pdf-btn"
                      onClick={() => generateProfileReceiptPdf(activeDuesProfile, dateFrom, dateTo)}
                    >
                      <Download size={16} />
                      <span>Générer le reçu en PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ─── MODAL: SETTLE CONFIRMATION ─── */}
          {activeSettleProfile && (
            <div className="ls-modal-backdrop" onClick={() => !isSettlingProfile && setSettleConfirmProfile(null)}>
              <div className="ls-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                <div className="ls-modal-header">
                  <div>
                    <h3 className="ls-modal-title">Confirmer le règlement complet</h3>
                    <p className="ls-modal-subtitle" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span>{activeSettleProfile.profilName}</span>
                      {(() => {
                        const cat = getProfilCategorie(activeSettleProfile);
                        return (
                          <span className={`ls-badge-cat ${cat}`}>
                            {cat === 'interne' ? 'Interne' : 'Externe'}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                  <button
                    className="ls-modal-close"
                    onClick={() => !isSettlingProfile && setSettleConfirmProfile(null)}
                    disabled={isSettlingProfile}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="ls-modal-body">
                  <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.5', marginBottom: '1rem' }}>
                    Êtes-vous sûr de vouloir régler la totalité des sommes dues entre l'agence et{' '}
                    <strong>{activeSettleProfile.profilName}</strong> pour la période du{' '}
                    <strong>{formatDateFR(dateFrom)}</strong> au <strong>{formatDateFR(dateTo)}</strong> ?
                  </p>
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>Agence verse au profil :</span>
                      <strong style={{ color: '#be123c' }}>{money(activeSettleProfile.agenceDoitProfil)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: '#64748b' }}>Profil remet à l'agence :</span>
                      <strong style={{ color: '#15803d' }}>{money(activeSettleProfile.profilDoitAgence)}</strong>
                    </div>
                    <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700 }}>
                      <span>Solde net à régler :</span>
                      {(() => {
                        const net = activeSettleProfile.agenceDoitProfil - activeSettleProfile.profilDoitAgence;
                        if (net > 0) {
                          return <span style={{ color: '#be123c' }}>Agence doit : {money(net)}</span>;
                        }
                        if (net < 0) {
                          return <span style={{ color: '#15803d' }}>Profil doit : {money(Math.abs(net))}</span>;
                        }
                        return <span style={{ color: '#64748b' }}>Équilibré (0,00 DH)</span>;
                      })()}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.75rem', fontStyle: 'italic' }}>
                    Cette action mettra à jour le statut de versement pour l'ensemble des {activeSettleProfile.rows.length} mission(s) de ce profil sur cette période.
                  </p>
                </div>
                <div className="ls-modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setSettleConfirmProfile(null)}
                    disabled={isSettlingProfile}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSettleProfileAllDues(activeSettleProfile)}
                    disabled={isSettlingProfile}
                  >
                    {isSettlingProfile ? 'Règlement en cours...' : 'Confirmer et Régler'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
