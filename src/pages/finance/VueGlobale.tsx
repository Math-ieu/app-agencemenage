import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  FileText,
  Grid3X3,
  List,
  MapPin,
  RefreshCw,
  Search,
  Send,
  User,
  Users,
  X,
  XCircle,
  Archive,
  Pencil,
  TrendingUp,
  Building2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { fetchSecureDocBlob, generateDocument, getAgents, getDemandesHistorique, getMissions, sendWhatsApp, updateMission, updateDemande, getUsers } from '../../api/client';
import { User as ApiUser } from '../../types';
import { encodeId } from '../../utils/obfuscation';
import { useToastStore } from '../../store/toast';
import './VueGlobale.css';

type FinanceSubTab = 'vue-globale' | 'debit-profil' | 'credit-profil' | 'suivi-facturation' | 'comptes-profils';
type ProfileDisplayMode = 'cards' | 'table';
type MissionEntryMode = 'demande' | 'manuel';
type MissionDetailTab = 'infos' | 'paiement' | 'repartition';

interface MissionEditForm {
  statutMission: FacturationRow['statut'];
  commission: string;
  montantPaye: string;
  montantEncaisseProfil: string;
  modePaiementReel: string;
  datePaiement: string;
  statutPaiement: string;
  justificatifName: string;
  encaissePar: 'Agence' | 'Profil';
  partProfilVersee: 'Oui' | 'Non';
  dateVersementProfil: string;
  partAgence: string;
  montantAgenceDoitProfil: string;
  commercialName: string;
  tvaRate: string;
  commentaire: string;
  montantHt: string;
  partsRepartition?: any[];
}

interface FacturationRow {
  missionId?: number;
  demandeId?: number;
  clientId?: number;
  profilId?: number;
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
  statut: 'Facturation annulée' | 'Confirmée' | 'Terminée' | 'Payé';
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
  parts_repartition?: any[];
}

interface ProfileAccount {
  id: number;
  key: string;
  name: string;
  city: string;
  phone: string;
  missions: number;
  caTotal: number;
  partAgence: number;
  partProfil: number;
  verseAuProfil: number;
  recuDuProfil: number;
  totalDueToProfile: number;
  totalDueToAgence: number;
  factAnnulee: number;
}

interface ProfileBalance extends ProfileAccount {
  solde: number;
}

interface MissionApiItem {
  id: number;
  statut: string;
  encaisse_par?: 'agence' | 'profil';
  montant_paye?: string | number;
  montant_encaisse_profil?: string | number;
  mode_paiement_reel?: string;
  date_paiement?: string;
  paiement_client_statut?: 'non_paye' | 'en_attente' | 'effectue';
  part_profil_versee?: boolean;
  date_versement_profil?: string;
  part_agence_reversee?: boolean;
  date_remise_agence?: string;
  annulation_raison?: string;
  profil_sera_paye?: boolean;
  montant_profil_annulation?: string | number;
  montant_agence_doit_profil?: string | number;
  montant_profil_doit_agence?: string | number;
  demande_detail?: {
    client?: number;
    id?: number;
    assigned_to_name?: string;
    date_intervention?: string;
    client_name?: string;
    client_city?: string;
    service?: string;
    segment?: string;
    prix?: string | number;
    mode_paiement?: string;
    mode_paiement_label?: string;
    statut_paiement?: string;
    reste_a_payer?: string | number;
    client_phone?: string;
    client_whatsapp?: string;
    part_agence?: string | number;
    parts_repartition?: any[];
  };
  agent_detail?: {
    id?: number;
    full_name?: string;
    city?: string;
    phone?: string;
  };
}

interface AgentApiItem {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  phone?: string;
}

const money = (value: number): string => `${new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value)} DH`;

const missionSourceOptions = [
  '#25 - DRISSI (CASABLANCA)',
  '#22 - Diane Adote (Casablanca)',
  '#23 - Meriem (Casablanca)',
  '#37 - julien client (Casablanca)',
  '#24 - agence premium services (Casablanca)',
  '#27 - Houda (Casablanca)',
  '#38 - julien client (Casablanca)',
  '#35 - maria (Casablanca)',
];

const missionProfileOptions = ['BONR Karidja', 'HARIT Imane', 'FLEAN Parfaite'];
const profileTypeOptions = ['Type de profil', 'Femme de ménage', 'Auxiliaire de vie'];
const segmentOptions = ['Particulier', 'Entreprise'];
const servicesBySegment: Record<'Particulier' | 'Entreprise', string[]> = {
  Particulier: [
    'Ménage standard',
    'Grand ménage',
    'Ménage Air BnB',
    'Nettoyage post-déménagement',
    'Ménage fin de chantier',
    'Auxiliaire de vie',
    'Ménage post-sinistre',
  ],
  Entreprise: [
    'Ménage bureaux',
    'Nettoyage fin de chantier',
    'Placement & gestion',
    'Ménage post-sinistre',
  ],
};

const missionPaymentModes = ['Choisir', 'Virement', 'Chèque', "Espèces à l'agence", 'Sur place'];
const missionStatusOptions = ['Confirmée', 'Terminée', 'Payé', 'Facturation annulée'];
const encaissementOptions: Array<'L\'Agence' | 'Le Profil'> = ["L'Agence", 'Le Profil'];
const paymentStatusOptions = [
  'Non confirmé',
  'Paiement en attente',
  'Agence payée / Client',
  'Profil payé / Client',
  'Payé',
  'Paiement partiel',
  'Facturation annulée'
];

const paiementClass = (value: FacturationRow['paiement']): string => {
  if (value === 'paye') return 'fg-pill fg-pill-teal';
  if (value === 'partiellement_paye') return 'fg-pill fg-pill-dark-teal';
  return 'fg-pill fg-pill-red';
};

const statutClass = (value: FacturationRow['statut']): string => {
  if (value === 'Confirmée') return 'fg-pill fg-pill-green';
  if (value === 'Payé') return 'fg-pill fg-pill-light-green';
  if (value === 'Terminée') return 'fg-pill fg-pill-blue';
  return 'fg-pill fg-pill-pink';
};

const paiementLabel = (value: FacturationRow['paiement']): string => {
  if (value === 'partiellement_paye') return 'partiellement payé';
  return value.replace('_', ' ');
};

const getPaymentUiLabel = (uiCode: string | undefined): string => {
  if (!uiCode) return 'Non payé';
  const labels: Record<string, string> = {
    paye: 'Payé',
    agence_payee_client: 'Agence payée / Client',
    profil_paye_client: 'Profil payé / Client',
    paiement_partiel: 'Paiement partiel',
    paiement_en_attente: 'Paiement en attente',
    non_confirme: 'Non confirmé',
    facturation_annulee: 'Facturation annulée',
  };
  return labels[uiCode] || uiCode.replace(/_/g, ' ');
};

const shortMissionNo = (missionNo: string): string => {
  const match = missionNo.match(/(\d+)$/);
  if (!match) return missionNo;
  return `M-${parseInt(match[1], 10)}`;
};

const creditPaymentLabel = (row: FacturationRow | any): 'Payé' | 'Non payé' => {
  if (row._partProfilVersee !== undefined) {
    return row._partProfilVersee ? 'Payé' : 'Non payé';
  }
  return row.partProfilVersee ? 'Payé' : 'Non payé';
};

const debitPaymentLabel = (row: FacturationRow | any): 'Payé' | 'Non payé' => {
  if (row._partAgenceReversee !== undefined) {
    return row._partAgenceReversee ? 'Payé' : 'Non payé';
  }
  return row.partAgenceReversee ? 'Payé' : 'Non payé';
};

const missionFinanceLabel = (row: FacturationRow): 'Facturation annulée' | 'Facturée' => (
  row.statut === 'Facturation annulée' ? 'Facturation annulée' : 'Facturée'
);

const getMontantPaye = (row: FacturationRow): number => Number(row.montantPaye ?? 0);

const getMontantEncaisseProfil = (row: FacturationRow): number => {
  if (row.encaissePar !== 'Profil') return 0;
  return Number(row.montantEncaisseProfil ?? row.montantPaye ?? 0);
};

const getPartProfilDueFromAgence = (row: FacturationRow): number => {
  if (row.statutPaiementUi === 'agence_payee_client' || row.statutPaiementUi === 'Agence payée / Client') {
    return Number(row.montantAgenceDoitProfil || 0);
  }

  if (row.statutPaiementUi === 'facturation_annulee' || row.statutPaiementUi === 'Facturation annulée' || row.statut === 'Facturation annulée') {
    return row.profilSeraPaye ? Number(row.montantProfilAnnulation || 0) : 0;
  }

  if (row.encaissePar !== 'Agence') return 0;

  if (row.montantAgenceDoitProfil !== undefined && row.montantAgenceDoitProfil > 0) {
    return row.montantAgenceDoitProfil;
  }

  const due = Number((getMontantPaye(row) * 0.5).toFixed(2));
  if (due > 0) return Math.min(row.partProfil, due);

  return row.partProfil;
};

const getPartAgenceDueFromProfil = (row: FacturationRow): number => {
  if (row.statutPaiementUi === 'profil_paye_client' || row.statutPaiementUi === 'Profil payé / Client') {
    return Number(row.montantProfilDoitAgence || 0);
  }

  if (row.statutPaiementUi === 'facturation_annulee' || row.statut === 'Facturation annulée') {
    return 0;
  }

  if (row.encaissePar !== 'Profil') return 0;

  if (row.montantProfilDoitAgence !== undefined && row.montantProfilDoitAgence > 0) {
    return row.montantProfilDoitAgence;
  }

  const due = Number((getMontantEncaisseProfil(row) * 0.5).toFixed(2));
  if (due > 0) return Math.min(row.partAgence, due);

  return row.partAgence;
};

const getCommissionAgenceEncaissee = (row: FacturationRow): number => {
  if (row.statutPaiementUi === 'facturation_annulee' || row.statutPaiementUi === 'Facturation annulée' || row.statut === 'Facturation annulée') {
    return row.profilSeraPaye ? -(Number(row.montantProfilAnnulation) || 0) : 0;
  }

  // Si le client n'a pas payé, on ne compte pas de commission
  if (row.paiement !== 'paye') return 0;

  // Agence payée / Client : l'agence a déjà l'argent → commission = partAgence (immédiat)
  if (row.statutPaiementUi === 'agence_payee_client' || row.statutPaiementUi === 'Agence payée / Client') {
    return row.partAgence;
  }

  // Profil payé / Client : le profil a l'argent → commission seulement si le profil a réglé l'agence
  if (row.statutPaiementUi === 'profil_paye_client' || row.statutPaiementUi === 'Profil payé / Client') {
    if (row.reglementInterne === 'Réglé') {
      return Number(row.montantProfilDoitAgence || row.partAgence || 0);
    }
    return 0;
  }

  if (row.encaissePar === 'Agence') {
    const partProfilDue = getPartProfilDueFromAgence(row);
    return Math.max(row.montant - partProfilDue, 0);
  }

  if (row.reglementInterne === 'Réglé') {
    return getPartAgenceDueFromProfil(row);
  }

  return 0;
};

const formatDateFR = (value?: string): string => {
  if (!value) return '—';
  if (value.includes('/')) return value;
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatDateISO = (value?: string): string => {
  if (!value || value === '—') return '';
  if (value.includes('-')) return value;
  const [day, month, year] = value.split('/');
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
};

const parseFrenchDate = (value?: string): Date | null => {
  if (!value) return null;
  if (value.includes('-')) {
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const [day, month, year] = value.split('/');
  if (!year || !month || !day) return null;
  const d = new Date(`${year}-${month}-${day}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getIsoWeekValue = (date: Date): string => {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const csvCell = (value: string | number): string => {
  const text = String(value ?? '');
  if (text.includes(';') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const modeLabelFromCode = (value?: string): string => {
  if (value === 'virement') return 'Virement';
  if (value === 'cheque') return 'Chèque';
  if (value === 'especes_agence') return "Espèces à l'agence";
  if (value === 'sur_place') return 'Sur place';
  return '—';
};

const modeCodeFromLabel = (value?: string): string => {
  if (value === 'Virement') return 'virement';
  if (value === 'Chèque') return 'cheque';
  if (value === "Espèces à l'agence") return 'especes_agence';
  if (value === 'Sur place') return 'sur_place';
  return '';
};

const statutMissionCodeFromLabel = (value: FacturationRow['statut']): string => {
  if (value === 'Facturation annulée') return 'annulee';
  if (value === 'Confirmée') return 'confirmee';
  if (value === 'Terminée') return 'terminee';
  if (value === 'Payé') return 'terminee';
  return 'en_attente';
};

const paiementStatusCodeFromLabel = (value: string): string => {
  if (value === 'Payé') return 'paye';
  if (value === 'Agence payée / Client') return 'agence_payee_client';
  if (value === 'Profil payé / Client') return 'profil_paye_client';
  if (value === 'Paiement partiel') return 'paiement_partiel';
  if (value === 'Paiement en attente') return 'paiement_en_attente';
  if (value === 'Facturation annulée') return 'facturation_annulee';
  return 'non_confirme';
};

const mapMissionToFacturationRow = (item: MissionApiItem): FacturationRow => {
  const demande = item.demande_detail;
  const agent = item.agent_detail;
  const montant = Number(demande?.prix ?? 0);
  const rawMontantPaye = item.montant_paye !== undefined ? Number(item.montant_paye) : 0;

  const facturationData = (demande as any)?.formulaire_data?.facturation || {};

  // Source de vérité : formulaire_data.facturation.statut_paiement_ui (défini par le Dashboard)
  // Puis statut mission, puis mapping des valeurs API legacy de statut_paiement
  const rawStatutPaiementUi =
    facturationData.statut_paiement_ui ||
    item.paiement_client_statut ||
    (demande?.statut_paiement === 'integral' ? 'paye' :
      demande?.statut_paiement === 'acompte' ? 'paiement_en_attente' :
        demande?.statut_paiement === 'partiel' ? 'paiement_partiel' :
          'non_paye');

  const commercialNameFallback = (demande as any)?.assigned_to_name || (demande as any)?.commercial_name || facturationData.commercial_name || '—';

  // Dériver le responsable de l'encaissement
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

  const paiement: FacturationRow['paiement'] =
    ['paye', 'agence_payee_client', 'profil_paye_client', 'Agence payée / Client', 'Profil payé / Client', 'effectue', 'integral'].includes(rawStatutPaiementUi)
      ? 'paye'
      : ['paiement_partiel', 'paiement_en_attente', 'Paiement partiel', 'Paiement en attente', 'partiel', 'acompte'].includes(rawStatutPaiementUi)
        ? 'partiellement_paye'
        : 'non_paye';

  const missionStatus = item.statut;
  const statut: FacturationRow['statut'] =
    missionStatus === 'annulee'
      ? 'Facturation annulée'
      : paiement === 'paye'
        ? 'Payé'
        : missionStatus === 'terminee'
          ? 'Terminée'
          : 'Confirmée';
  const partProfilVersee = encaissePar === 'Agence'
    ? (item.part_profil_versee ?? false)
    : (item.part_agence_reversee ?? false);

  // Rétrocompatibilité montant : si la BDD renvoie 0.00 mais que le statut est "payé", on calcule le dû réel
  let montantPaye = rawMontantPaye;
  if (montantPaye === 0) {
    if (paiement === 'paye') montantPaye = montant;
    else if (paiement === 'partiellement_paye') montantPaye = Number((montant * 0.5).toFixed(2));
  }

  let montantEncaisseProfil = item.montant_encaisse_profil !== undefined ? Number(item.montant_encaisse_profil) : 0;
  if (encaissePar === 'Profil' && montantEncaisseProfil === 0 && montantPaye > 0) {
    montantEncaisseProfil = montantPaye;
  }

  const reglementInterne = partProfilVersee ? 'Réglé' : 'Non réglé';

  // Nouveaux champs top-level du modèle Demande (Dashboard)
  const d_part_agence = (demande as any)?.part_agence;
  const d_parts_repartition = (demande as any)?.parts_repartition;

  const partAgence = (d_part_agence !== null && d_part_agence !== undefined)
    ? Number(d_part_agence)
    : Number(facturationData.part_agence ?? (montant * 0.5));

  const partProfil = (d_parts_repartition && Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0)
    ? d_parts_repartition.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
    : Number(facturationData.montant_agence_doit_profil ?? facturationData.part_profil ?? (montant - partAgence));

  return {
    missionId: item.id,
    demandeId: demande?.id,
    clientId: demande?.client,
    profilId: agent?.id,
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
    datePaiement: item.date_paiement ? formatDateFR(item.date_paiement) : (paiement === 'non_paye' ? '—' : formatDateFR(demande?.date_intervention)),
    modePaiementReel: modeLabelFromCode(item.mode_paiement_reel) || demande?.mode_paiement_label || modeLabelFromCode(demande?.mode_paiement) || '—',
    commercialName: commercialNameFallback,
    phone: agent?.phone || demande?.client_phone || '—',
    partProfilVersee,
    dateVersementProfil: item.date_versement_profil || '—',
    partAgenceReversee: item.part_agence_reversee,
    dateRemiseAgence: item.date_remise_agence || '—',
    // New fields
    annulationRaison: (demande as any)?.annulation_raison || item.annulation_raison || facturationData.annulation_raison,
    profilSeraPaye: (demande as any)?.profil_sera_paye !== undefined ? (demande as any).profil_sera_paye : item.profil_sera_paye,
    montantProfilAnnulation: Number((demande as any)?.montant_profil_annulation || item.montant_profil_annulation || facturationData.montant_profil_annulation || 0),
    montantAgenceDoitProfil: Number((demande as any)?.montant_agence_doit_profil || item.montant_agence_doit_profil || facturationData.montant_agence_doit_profil || 0),
    montantProfilDoitAgence: Number((demande as any)?.montant_profil_doit_agence || item.montant_profil_doit_agence || facturationData.montant_profil_doit_agence || 0),
    statutPaiementUi: rawStatutPaiementUi,
    tvaActive: Boolean(facturationData.tva_active ?? (demande as any)?.tva_active),
    originalDemande: demande,
    parts_repartition: Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0 ? d_parts_repartition : Array.isArray(facturationData.parts_repartition) ? facturationData.parts_repartition : undefined,
  };
};

const mapDemandeToFacturationRow = (demande: any): FacturationRow => {
  const montant = Number(demande?.prix ?? 0);
  const facturationData = demande?.formulaire_data?.facturation || {};

  // Nouveaux champs top-level du modèle Demande (Dashboard)
  const d_part_agence = demande?.part_agence;
  const d_parts_repartition = demande?.parts_repartition;

  const partAgence = (d_part_agence !== null && d_part_agence !== undefined)
    ? Number(d_part_agence)
    : Number(facturationData.part_agence ?? (montant * 0.5));

  const partProfil = (d_parts_repartition && Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0)
    ? d_parts_repartition.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
    : Number(facturationData.montant_agence_doit_profil ?? facturationData.part_profil ?? (montant - partAgence));

  // Source de vérité : formulaire_data.facturation.statut_paiement_ui (défini par le Dashboard)
  // Puis champ calculé par le backend (statut_paiement_ui du serializer historique)
  // Puis mapping des valeurs API legacy de statut_paiement
  const rawStatutPaiementUi =
    facturationData.statut_paiement_ui ||
    demande.statut_paiement_ui ||
    (demande.statut_paiement === 'integral' ? 'paye' :
      demande.statut_paiement === 'acompte' ? 'paiement_en_attente' :
        demande.statut_paiement === 'partiel' ? 'paiement_partiel' :
          'non_confirme');

  // Deriver le responsable de l'encaissement en fonction du statut ou de la demande
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

  const paiement: FacturationRow['paiement'] =
    ['paye', 'agence_payee_client', 'profil_paye_client', 'Agence payée / Client', 'Profil payé / Client', 'integral', 'effectue'].includes(rawStatutPaiementUi)
      ? 'paye'
      : ['paiement_partiel', 'paiement_en_attente', 'Paiement partiel', 'Paiement en attente', 'partiel', 'acompte'].includes(rawStatutPaiementUi)
        ? 'partiellement_paye'
        : 'non_paye';

  const statut: FacturationRow['statut'] =
    demande.statut === 'annule' ? 'Facturation annulée' : paiement === 'paye' ? 'Payé' : 'Confirmée';

  // For demands without missions, we check if payment was marked in formulaire_data
  const partProfilVersee = Boolean(facturationData.part_profil_versee);
  const partAgenceReversee = Boolean(facturationData.part_agence_reversee);
  const reglementInterne = (encaissePar === 'Agence' ? partProfilVersee : partAgenceReversee) ? 'Réglé' : 'Non réglé';

  return {
    demandeId: demande?.id,
    clientId: demande?.client,
    profilId: demande?.profil_id,
    missionNo: `DEM-${String(demande?.id).padStart(6, '0')}`,
    date: formatDateFR(demande?.date_intervention) || formatDateFR(demande?.created_at),
    client: demande?.client_name || '—',
    ville: demande?.client_city || 'Casablanca',
    profil: demande?.profil_name || '—',
    service: demande?.service || 'Service',
    segment: demande?.segment === 'entreprise' ? 'Entreprise' : 'Particulier',
    montant,
    modePaiement: demande?.mode_paiement_label || modeLabelFromCode(demande?.mode_paiement) || '—',
    partAgence,
    partProfil,
    encaissePar,
    paiement,
    statut,
    reglementInterne,
    montantPaye: paiement === 'paye'
      ? (Number(facturationData.montant_verse) || montant)
      : (paiement === 'partiellement_paye' ? (Number(facturationData.montant_verse) || Number((montant * 0.5).toFixed(2))) : 0),
    montantEncaisseProfil: Number(facturationData.montant_encaisse_profil || 0),
    datePaiement: facturationData.date_paiement ? formatDateFR(facturationData.date_paiement) : '—',
    modePaiementReel: demande?.mode_paiement_label || modeLabelFromCode(demande?.mode_paiement) || '—',
    commercialName: (demande as any)?.assigned_to_name || (demande as any)?.commercial_name || (demande?.formulaire_data?.facturation?.commercial_name) || '—',
    phone: demande?.client_phone || '—',
    partProfilVersee,
    dateVersementProfil: facturationData.date_versement_profil || '—',
    partAgenceReversee,
    dateRemiseAgence: facturationData.date_remise_agence || '—',
    annulationRaison: demande.annulation_raison || demande.motif || facturationData.annulation_raison,
    profilSeraPaye: demande.profil_sera_paye !== undefined ? demande.profil_sera_paye : facturationData.profil_sera_paye,
    montantProfilAnnulation: Number(demande.montant_profil_annulation || facturationData.montant_profil_annulation || 0),
    montantAgenceDoitProfil: Number(demande.montant_agence_doit_profil || facturationData.montant_agence_doit_profil || 0),
    montantProfilDoitAgence: Number(demande.montant_profil_doit_agence || facturationData.montant_profil_doit_agence || 0),
    statutPaiementUi: rawStatutPaiementUi,
    tvaActive: Boolean(facturationData.tva_active ?? demande?.tva_active),
    originalDemande: demande,
    parts_repartition: Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0 ? d_parts_repartition : Array.isArray(facturationData.parts_repartition) ? facturationData.parts_repartition : undefined,
  };
};

export default function VueGlobale() {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  const [commerciaux, setCommerciaux] = useState<ApiUser[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    getUsers({ role: 'commercial' })
      .then(res => setCommerciaux(res.data?.results || res.data || []))
      .catch(console.error);

    getAgents().then(res => setAgents(res.data?.results || res.data || [])).catch(console.error);
  }, []);

  const [activeTab, setActiveTab] = useState<FinanceSubTab>('vue-globale');
  const [displayMode, setDisplayMode] = useState<ProfileDisplayMode>('cards');
  const [showNewMissionModal, setShowNewMissionModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState<FacturationRow | null>(null);
  const [selectedProfileAccount, setSelectedProfileAccount] = useState<ProfileBalance | null>(null);
  const [missionDetailTab, setMissionDetailTab] = useState<MissionDetailTab>('infos');
  const [showMissionEditModal, setShowMissionEditModal] = useState(false);
  const [isSavingMissionEdit, setIsSavingMissionEdit] = useState(false);
  const [missionEditForm, setMissionEditForm] = useState<MissionEditForm>({
    statutMission: 'Confirmée',
    commission: '50',
    montantPaye: '0',
    montantEncaisseProfil: '0',
    modePaiementReel: 'Choisir',
    datePaiement: '',
    statutPaiement: 'Non payé',
    justificatifName: 'Aucun fichier choisi',
    encaissePar: 'Agence',
    partProfilVersee: 'Oui',
    dateVersementProfil: '',
    partAgence: '0',
    montantAgenceDoitProfil: '0',
    commercialName: '',
    tvaRate: '20',
    commentaire: '',
    montantHt: '0',
  });
  const [entryMode, setEntryMode] = useState<MissionEntryMode>('demande');
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  const [isEncaissementOpen, setIsEncaissementOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState('Choisir une demande');
  const [selectedProfile, setSelectedProfile] = useState('Choisir un profil (optionnel)');
  const [commission, setCommission] = useState('50');
  const [paymentMode, setPaymentMode] = useState('Choisir');
  const [missionStatus, setMissionStatus] = useState('Confirmée');
  const [encaissementPar, setEncaissementPar] = useState<"L'Agence" | 'Le Profil'>("L'Agence");
  const [manualDateIntervention, setManualDateIntervention] = useState('');
  const [manualProfileType, setManualProfileType] = useState('Type de profil');
  const [manualClientName, setManualClientName] = useState('');
  const [manualCity, setManualCity] = useState('Casablanca');
  const [manualServiceType, setManualServiceType] = useState('Ménage standard');
  const [manualSegment, setManualSegment] = useState<'Particulier' | 'Entreprise'>('Particulier');
  const [manualAmount, setManualAmount] = useState('0');

  const [globalPeriodMode, setGlobalPeriodMode] = useState<'jour' | 'semaine' | 'mois' | 'periode'>('mois');
  const [globalDay, setGlobalDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [globalWeek, setGlobalWeek] = useState(() => getIsoWeekValue(new Date()));
  const [globalMonth, setGlobalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [globalDateFrom, setGlobalDateFrom] = useState('');
  const [globalDateTo, setGlobalDateTo] = useState('');
  const [globalTableDateFrom, setGlobalTableDateFrom] = useState('');
  const [globalTableDateTo, setGlobalTableDateTo] = useState('');
  const [globalTableSearch, setGlobalTableSearch] = useState('');
  const [debitDateFrom, setDebitDateFrom] = useState('');
  const [debitDateTo, setDebitDateTo] = useState('');
  const [debitSegmentFilter, setDebitSegmentFilter] = useState<'Tous les segments' | 'Particulier' | 'Entreprise'>('Tous les segments');
  const [debitPaymentFilter, setDebitPaymentFilter] = useState<'Non payé' | 'Payé' | 'Tous'>('Non payé');
  const [debitMissionFilter, setDebitMissionFilter] = useState<'Tous' | 'Facturée' | 'Facturation annulée'>('Tous');
  const [debitSearch, setDebitSearch] = useState('');
  const [searchProfiles, setSearchProfiles] = useState('');
  const [suiviSearch, setSuiviSearch] = useState('');
  const [creditDateFrom, setCreditDateFrom] = useState('');
  const [creditDateTo, setCreditDateTo] = useState('');
  const [creditSegmentFilter, setCreditSegmentFilter] = useState<'Tous les segments' | 'Particulier' | 'Entreprise'>('Tous les segments');
  const [creditPaymentFilter, setCreditPaymentFilter] = useState<'Non payé' | 'Payé' | 'Tous'>('Non payé');
  const [creditMissionFilter, setCreditMissionFilter] = useState<'Tous' | 'Facturée' | 'Facturation annulée'>('Tous');
  const [creditSearch, setCreditSearch] = useState('');
  const [suiviDateFrom, setSuiviDateFrom] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [suiviDateTo, setSuiviDateTo] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [suiviPaiementFilter, setSuiviPaiementFilter] = useState('Tous les paiements');
  const [suiviSegmentFilter, setSuiviSegmentFilter] = useState('Tous les segments');
  const [facturationData, setFacturationData] = useState<FacturationRow[]>([]);
  const [profileAccountsData, setProfileAccountsData] = useState<ProfileAccount[]>([]);
  const [invoicePreview, setInvoicePreview] = useState<{ url: string; type: 'devis' | 'png' | 'facture'; name: string; demandeId: number } | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [showInvoicePreviewPopup, setShowInvoicePreviewPopup] = useState(false);

  const loadFinanceData = useCallback(async () => {
    const missions: MissionApiItem[] = [];
    const agents: AgentApiItem[] = [];
    const demands: any[] = [];

    try {
      let missionPage = 1;
      while (true) {
        const response = await getMissions({ ordering: '-created_at', page: missionPage });
        const data = response.data;
        const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        missions.push(...(rows as MissionApiItem[]));
        if (!data?.next || rows.length === 0) break;
        missionPage += 1;
      }
    } catch {
      // Missions can fail independently
    }

    try {
      let demandPage = 1;
      while (true) {
        const response = await getDemandesHistorique({ ordering: '-created_at', page: demandPage });
        const data = response.data;
        const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        demands.push(...rows);
        if (!data?.next || rows.length === 0) break;
        demandPage += 1;
      }
    } catch {
      // Demands can fail independently
    }

    try {
      let agentPage = 1;
      while (true) {
        const response = await getAgents({ ordering: '-created_at', page: agentPage });
        const data = response.data;
        const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        agents.push(...(rows as AgentApiItem[]));
        if (!data?.next || rows.length === 0) break;
        agentPage += 1;
      }
    } catch {
      // Agents can fail
    }

    // Fusionner les données : Missions prioritaires, puis Demandes sans mission
    const missionDemandeIds = new Set(missions.map(m => String(m.demande_detail?.id)).filter(id => id !== 'undefined' && id !== 'null'));
    const uniqueDemands = demands.filter(d => !missionDemandeIds.has(String(d.id)));

    const missionRows = missions.map(mapMissionToFacturationRow);
    const demandRows = uniqueDemands.map(mapDemandeToFacturationRow);
    const allRows = [...missionRows, ...demandRows]
      .filter((row) => !!row.clientId && row.originalDemande?.statut !== 'en_attente')
      .sort((a, b) => {
        const dateA = parseFrenchDate(a.date)?.getTime() || 0;
        const dateB = parseFrenchDate(b.date)?.getTime() || 0;
        return dateB - dateA;
      });

    setFacturationData(allRows);

    const grouped = new Map<string, ProfileAccount>();

    for (const agent of agents) {
      const fullName =
        agent.full_name?.trim()
        || `${agent.first_name || ''} ${agent.last_name || ''}`.trim()
        || 'Profil inconnu';
      const accountKey = `agent-${agent.id}`;

      if (!grouped.has(accountKey)) {
        grouped.set(accountKey, {
          id: agent.id,
          key: accountKey,
          name: fullName,
          city: agent.city || 'Casablanca',
          phone: agent.phone || '—',
          missions: 0,
          caTotal: 0,
          partAgence: 0,
          partProfil: 0,
          verseAuProfil: 0,
          recuDuProfil: 0,
          totalDueToProfile: 0,
          totalDueToAgence: 0,
          factAnnulee: 0,
        });
      }
    }

    for (const item of allRows) {
      if (item.parts_repartition && item.parts_repartition.length > 0) {
        // Multi-profile logic
        const splitPartAgence = item.partAgence / item.parts_repartition.length;


        for (const part of item.parts_repartition) {
          const profileId = Number(part.profile_id);
          // If we can't find the name in the part object, we'll try to find it in the agents list
          const agentObj = agents.find(a => a.id === profileId);
          const profileName = part.profile_name || (agentObj ? (agentObj.full_name || `${agentObj.first_name || ''} ${agentObj.last_name || ''}`).trim() : 'Profil inconnu');
          const accountKey = `agent-${profileId}`;
          const amount = Number(part.amount || 0);

          if (!grouped.has(accountKey)) {
            grouped.set(accountKey, {
              id: profileId,
              key: accountKey,
              name: profileName,
              city: item.ville || 'Casablanca',
              phone: agentObj?.phone || '—',
              missions: 0,
              caTotal: 0,
              partAgence: 0,
              partProfil: 0,
              verseAuProfil: 0,
              recuDuProfil: 0,
              totalDueToProfile: 0,
              totalDueToAgence: 0,
              factAnnulee: 0,
            });
          }

          const profile = grouped.get(accountKey)!;

          profile.missions += 1;
          const isAnnule = item.statut === 'Facturation annulée' || item.statutPaiementUi === 'facturation_annulee';

          if (isAnnule) {
            if (item.profilSeraPaye) {
              const annulationAmount = Number(item.montantProfilAnnulation || item.partProfil || 0) / (item.parts_repartition?.length || 1);
              profile.factAnnulee += annulationAmount;
              profile.partProfil += annulationAmount;
              
              if (item.encaissePar === 'Agence') {
                profile.totalDueToProfile += annulationAmount;
                if (item.reglementInterne === 'Réglé') {
                  profile.verseAuProfil += annulationAmount;
                }
              }
            }
          } else {
            profile.caTotal += (amount + splitPartAgence);
            profile.partAgence += splitPartAgence;
            profile.partProfil += amount;

            if (item.encaissePar === 'Agence') {
              const due = Number(item.montantAgenceDoitProfil || amount);
              profile.totalDueToProfile += due;
              if (item.reglementInterne === 'Réglé') {
                profile.verseAuProfil += due;
              }
            } else if (item.encaissePar === 'Profil') {
              const due = Number(item.montantProfilDoitAgence || splitPartAgence);
              profile.totalDueToAgence += due;
              if (item.reglementInterne === 'Réglé') {
                profile.recuDuProfil += due;
              }
            }
          }
        }
      } else {
        // Legacy single profile logic
        const profileName = item.profil || 'Profil inconnu';
        const profileId = item.profilId;
        const accountKey = profileId ? `agent-${profileId}` : `mission-${profileName}`;
        const partAgence = item.partAgence;
        const partProfil = item.partProfil;

        if (profileName === '—' && !profileId) continue;

        if (!grouped.has(accountKey)) {
          grouped.set(accountKey, {
            id: profileId ?? grouped.size + 1,
            key: accountKey,
            name: profileName,
            city: item.ville || 'Casablanca',
            phone: item.phone || '—',
            missions: 0,
            caTotal: 0,
            partAgence: 0,
            partProfil: 0,
            verseAuProfil: 0,
            recuDuProfil: 0,
            totalDueToProfile: 0,
            totalDueToAgence: 0,
            factAnnulee: 0,
          });
        }

        const profile = grouped.get(accountKey)!;
        profile.missions += 1;
        const isAnnule = item.statut === 'Facturation annulée' || item.statutPaiementUi === 'facturation_annulee';
        
        if (isAnnule) {
          if (item.profilSeraPaye) {
            const annulationAmount = Number(item.montantProfilAnnulation || item.partProfil || 0);
            profile.factAnnulee += annulationAmount;
            profile.partProfil += annulationAmount;
            
            if (item.encaissePar === 'Agence') {
              profile.totalDueToProfile += annulationAmount;
              if (item.reglementInterne === 'Réglé') {
                profile.verseAuProfil += annulationAmount;
              }
            }
          }
        } else {
          profile.caTotal += partProfil;
          profile.partAgence += partAgence;
          profile.partProfil += partProfil;

          const encaissePar = item.encaissePar;
          if (encaissePar === 'Agence') {
            const due = getPartProfilDueFromAgence(item);
            profile.totalDueToProfile += due;
            if (item.reglementInterne === 'Réglé') {
              profile.verseAuProfil += due;
            }
          } else if (encaissePar === 'Profil') {
            const due = getPartAgenceDueFromProfil(item);
            profile.totalDueToAgence += due;
            if (item.reglementInterne === 'Réglé') {
              profile.recuDuProfil += due;
            }
          }
        }
      }
    }

    const accounts = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    setProfileAccountsData(accounts);
    return allRows;
  }, []);

  useEffect(() => {
    void loadFinanceData();
  }, [loadFinanceData]);

  const periodFilteredRows = useMemo(() => {
    return facturationData.filter((row) => {
      const date = parseFrenchDate(row.date);
      if (!date) return false;
      const isoDate = date.toISOString().slice(0, 10);

      if (globalPeriodMode === 'jour') {
        return isoDate === globalDay;
      }

      if (globalPeriodMode === 'semaine') {
        return getIsoWeekValue(date) === globalWeek;
      }

      if (globalPeriodMode === 'mois') {
        const rowMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return rowMonth === globalMonth;
      }

      if (globalDateFrom && isoDate < globalDateFrom) return false;
      if (globalDateTo && isoDate > globalDateTo) return false;
      return true;
    });
  }, [facturationData, globalDay, globalDateFrom, globalDateTo, globalMonth, globalPeriodMode, globalWeek]);

  const globalTableRows = useMemo(() => {
    return facturationData.filter((row) => {
      // Filtrer uniquement pour afficher "Non payé"
      if (row.paiement !== 'non_paye') return false;

      if (row.encaissePar === 'Profil' && row.reglementInterne === 'Réglé') return false;

      const date = parseFrenchDate(row.date);
      if (!date) return false;
      const isoDate = date.toISOString().slice(0, 10);

      if (globalTableDateFrom && isoDate < globalTableDateFrom) return false;
      if (globalTableDateTo && isoDate > globalTableDateTo) return false;

      if (globalTableSearch.trim()) {
        const needle = globalTableSearch.toLowerCase();
        const haystack = `${row.client} ${row.profil}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [facturationData, globalTableDateFrom, globalTableDateTo, globalTableSearch]);

  const suiviBaseRows = useMemo(() => {
    return periodFilteredRows;
  }, [periodFilteredRows]);

  const filteredSuiviRows = useMemo(() => {
    return suiviBaseRows.filter((row) => {
      if (suiviSegmentFilter !== 'Tous les segments' && row.segment !== suiviSegmentFilter) return false;



      if (suiviPaiementFilter !== 'Tous les paiements') {
        const rowUi = row.statutPaiementUi;
        if (suiviPaiementFilter === 'Non payé' && rowUi !== 'non_paye' && rowUi !== 'non_confirme') return false;
        if (suiviPaiementFilter === 'Paiement en attente' && rowUi !== 'paiement_en_attente') return false;
        if (suiviPaiementFilter === 'Agence payé/client' && rowUi !== 'agence_payee_client') return false;
        if (suiviPaiementFilter === 'Profil payé/client' && rowUi !== 'profil_paye_client') return false;
        if (suiviPaiementFilter === 'Paiement partiel' && rowUi !== 'paiement_partiel') return false;
        if (suiviPaiementFilter === 'Payé' && rowUi !== 'paye') return false;
        if (suiviPaiementFilter === 'Confirmé' && row.statut !== 'Confirmée') return false;
      }

      if (suiviDateFrom || suiviDateTo) {
        const parts = row.date.split('/');
        if (parts.length === 3) {
          const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          if (suiviDateFrom && isoDate < suiviDateFrom) return false;
          if (suiviDateTo && isoDate > suiviDateTo) return false;
        }
      }

      if (suiviSearch.trim()) {
        const needle = suiviSearch.toLowerCase();
        const haystack = `${row.missionNo} ${row.client} ${row.ville} ${row.profil} ${row.service}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [suiviBaseRows, suiviDateFrom, suiviDateTo, suiviPaiementFilter, suiviSearch, suiviSegmentFilter]);

  const agenceNonPayeAmount = useMemo(() => {
    let total = 0;
    for (const row of facturationData) {
      const isDebit = row.statutPaiementUi === 'profil_paye_client' || row.statutPaiementUi === 'Profil payé / Client' || (!row.statutPaiementUi && row.encaissePar === 'Profil');
      if (!isDebit) continue;

      const totalDue = getPartAgenceDueFromProfil(row);
      if (row.parts_repartition && row.parts_repartition.length > 0) {
        const delegatePart = row.parts_repartition.find((p: any) => p.is_delegate) || row.parts_repartition[0];
        if (!delegatePart.part_agence_reversee) {
          total += totalDue;
        }
      } else if (row.reglementInterne !== 'Réglé') {
        total += totalDue;
      }
    }
    return total;
  }, [facturationData]);

  const profilNonPayeAmount = useMemo(() => {
    let total = 0;
    for (const row of facturationData) {
      const isCredit = row.statutPaiementUi === 'agence_payee_client' || row.statutPaiementUi === 'Agence payée / Client' || (row.statutPaiementUi === 'facturation_annulee' && row.profilSeraPaye) || (row.statutPaiementUi === 'Facturation annulée' && row.profilSeraPaye) || (!row.statutPaiementUi && row.encaissePar === 'Agence');
      if (!isCredit) continue;

      const totalDue = getPartProfilDueFromAgence(row);
      if (row.parts_repartition && row.parts_repartition.length > 0) {
        const totalParts = row.parts_repartition.reduce((s, p) => s + Number(p.amount || 0), 0) || 1;
        for (const part of row.parts_repartition) {
          if (!part.part_profil_versee) {
            total += (Number(part.amount || 0) / totalParts) * totalDue;
          }
        }
      } else if (row.reglementInterne !== 'Réglé') {
        total += totalDue;
      }
    }
    return total;
  }, [facturationData]);

  const profileBalances = useMemo<ProfileBalance[]>(
    () =>
      profileAccountsData
        .map((profile) => {
          const profilDoitAgence = Math.max(0, profile.totalDueToAgence - profile.recuDuProfil);
          const agenceDoitProfil = Math.max(0, profile.totalDueToProfile - profile.verseAuProfil);
          return {
            ...profile,
            profilDoitAgence,
            agenceDoitProfil,
            solde: agenceDoitProfil - profilDoitAgence,
          };
        })
        .filter((profile) =>
          `${profile.name} ${profile.city}`.toLowerCase().includes(searchProfiles.toLowerCase())
        ),
    [profileAccountsData, searchProfiles]
  );

  const availableManualServices = useMemo(
    () => servicesBySegment[manualSegment],
    [manualSegment]
  );

  const selectedProfileMissions = useMemo(
    () =>
      selectedProfileAccount
        ? facturationData.filter((row) =>
          row.profilId
            ? row.profilId === selectedProfileAccount.id
            : row.profil === selectedProfileAccount.name
        )
        : [],
    [selectedProfileAccount, facturationData]
  );

  const displayedMissionCount = filteredSuiviRows.length;
  const displayedMissionTotal = filteredSuiviRows.reduce((sum, row) => sum + row.montant, 0);

  const suiviRecap = useMemo(() => {
    const totalFacture = filteredSuiviRows.length;
    const activeRows = filteredSuiviRows.filter((row) => row.statut !== 'Facturation annulée' && row.statutPaiementUi !== 'facturation_annulee');
    const cancelledRows = filteredSuiviRows.filter((row) => row.statut === 'Facturation annulée' || row.statutPaiementUi === 'facturation_annulee');

    const chiffreAffaires = activeRows
      .filter((row) => row.paiement !== 'non_paye')
      .reduce((sum, row) => sum + (row.montantPaye ?? 0), 0);

    const commissionBrute = activeRows.reduce((sum, row) => sum + getCommissionAgenceEncaissee(row), 0);
    const pertes = cancelledRows.reduce((sum, row) => sum + (row.profilSeraPaye ? Number(row.montantProfilAnnulation || 0) : 0), 0);
    const commissionAgence = commissionBrute - pertes;

    const paiementsEnAttente = filteredSuiviRows.filter((row) => row.paiement === 'partiellement_paye').length;

    return { totalFacture, chiffreAffaires, commissionAgence, paiementsEnAttente };
  }, [filteredSuiviRows]);

  const globalSegmentStats = useMemo(() => {
    const particulier = facturationData.filter((row) => row.segment === 'Particulier').length;
    const entreprise = facturationData.filter((row) => row.segment === 'Entreprise').length;
    const total = particulier + entreprise;
    const particulierRatio = total > 0 ? (particulier / total) * 100 : 0;
    const entrepriseRatio = total > 0 ? (entreprise / total) * 100 : 0;
    return { particulier, entreprise, total, particulierRatio, entrepriseRatio };
  }, [facturationData]);

  const globalKpis = useMemo(() => {
    const activeRows = periodFilteredRows.filter((row) => row.statut !== 'Facturation annulée' && row.statutPaiementUi !== 'facturation_annulee');
    const cancelledRows = periodFilteredRows.filter((row) => row.statut === 'Facturation annulée' || row.statutPaiementUi === 'facturation_annulee');

    const missions = activeRows.length;
    const chiffreAffaires = activeRows
      .filter((row) => row.paiement !== 'non_paye')
      .reduce((sum, row) => sum + (row.montantPaye ?? 0), 0);

    // Commission brute (hors annulations)
    const commissionBrute = activeRows.reduce((sum, row) => sum + getCommissionAgenceEncaissee(row), 0);

    // Perte = total payé au profil pour les facturations annulées
    const facturationAnnulee = cancelledRows
      .reduce((sum, row) => sum + (row.profilSeraPaye ? Number(row.montantProfilAnnulation || 0) : 0), 0);

    // Commission nette = brute - pertes
    const commissionAgence = commissionBrute - facturationAnnulee;

    return { missions, chiffreAffaires, commissionAgence, facturationAnnulee };
  }, [periodFilteredRows]);

  const debitRows = useMemo(
    () => facturationData.filter((row) =>
      row.statutPaiementUi === 'profil_paye_client' ||
      row.statutPaiementUi === 'Profil payé / Client' ||
      (row.statutPaiementUi === 'paye' && row.encaissePar === 'Profil') ||
      (!row.statutPaiementUi && row.encaissePar === 'Profil')
    ),
    [facturationData]
  );

  const filteredDebitRows = useMemo(() => {
    return debitRows.filter((row) => {
      const rowDate = parseFrenchDate(row.date);
      if (!rowDate) return false;
      const isoDate = rowDate.toISOString().slice(0, 10);

      if (debitDateFrom && isoDate < debitDateFrom) return false;
      if (debitDateTo && isoDate > debitDateTo) return false;

      if (debitSegmentFilter !== 'Tous les segments' && row.segment !== debitSegmentFilter) return false;

      if (debitPaymentFilter === 'Non payé' && row.reglementInterne === 'Réglé') return false;
      if (debitPaymentFilter === 'Payé' && row.reglementInterne !== 'Réglé') return false;

      if (debitMissionFilter === 'Facturation annulée' && row.statut !== 'Facturation annulée' && row.statutPaiementUi !== 'facturation_annulee') return false;
      if (debitMissionFilter === 'Facturée' && (row.statut === 'Facturation annulée' || row.statutPaiementUi === 'facturation_annulee')) return false;

      if (debitSearch.trim()) {
        const needle = debitSearch.toLowerCase();
        const haystack = `${row.client} ${row.profil} ${row.ville}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [debitDateFrom, debitDateTo, debitMissionFilter, debitPaymentFilter, debitRows, debitSearch, debitSegmentFilter]);

  const creditRows = useMemo(
    () => facturationData.filter((row) =>
      row.statutPaiementUi === 'agence_payee_client' ||
      row.statutPaiementUi === 'Agence payée / Client' ||
      (row.statutPaiementUi === 'paye' && row.encaissePar === 'Agence') ||
      (row.statutPaiementUi === 'facturation_annulee' && row.profilSeraPaye) ||
      (row.statutPaiementUi === 'Facturation annulée' && row.profilSeraPaye) ||
      (!row.statutPaiementUi && row.encaissePar === 'Agence')
    ),
    [facturationData]
  );

  const filteredCreditRows = useMemo(() => {
    return creditRows.filter((row) => {
      const rowDate = parseFrenchDate(row.date);
      if (!rowDate) return false;
      const isoDate = rowDate.toISOString().slice(0, 10);

      if (creditDateFrom && isoDate < creditDateFrom) return false;
      if (creditDateTo && isoDate > creditDateTo) return false;

      if (creditSegmentFilter !== 'Tous les segments' && row.segment !== creditSegmentFilter) return false;

      if (creditPaymentFilter === 'Non payé' && creditPaymentLabel(row) === 'Payé') return false;
      if (creditPaymentFilter === 'Payé' && creditPaymentLabel(row) !== 'Payé') return false;

      if (creditMissionFilter === 'Facturation annulée' && row.statut !== 'Facturation annulée' && row.statutPaiementUi !== 'facturation_annulee') return false;
      if (creditMissionFilter === 'Facturée' && (row.statut === 'Facturation annulée' || row.statutPaiementUi === 'facturation_annulee')) return false;

      if (creditSearch.trim()) {
        const needle = creditSearch.toLowerCase();
        const haystack = `${row.client} ${row.profil} ${row.ville}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [creditDateFrom, creditDateTo, creditMissionFilter, creditPaymentFilter, creditRows, creditSearch, creditSegmentFilter]);

  const debitTotal = useMemo(
    () => filteredDebitRows.reduce((sum, row) => sum + getPartAgenceDueFromProfil(row), 0),
    [filteredDebitRows]
  );

  const expandedDebitRows = useMemo(() => {
    const result: any[] = [];
    for (const row of filteredDebitRows) {
      if (row.parts_repartition && row.parts_repartition.length > 0) {
        const totalDue = getPartAgenceDueFromProfil(row);
        const delegatePart = row.parts_repartition.find((p: any) => p.is_delegate) || row.parts_repartition[0];
        const isPaid = delegatePart.part_agence_reversee ?? row.partAgenceReversee;

        if (debitPaymentFilter === 'Non payé' && isPaid) continue;
        if (debitPaymentFilter === 'Payé' && !isPaid) continue;

        const pId = Number(delegatePart.profile_id);
        const pName = profileAccountsData.find(a => a.id === pId)?.name || delegatePart.profile_name || row.profil;

        result.push({
          ...row,
          profilId: pId,
          profil: pName,
          _partAgenceDue: totalDue,
          _partAgenceReversee: isPaid,
          _uniqueKey: `${row.missionNo}-${pId}`
        });
      } else {
        result.push({
          ...row,
          _partAgenceDue: getPartAgenceDueFromProfil(row),
          _uniqueKey: row.missionNo
        });
      }
    }
    return result;
  }, [filteredDebitRows, profileAccountsData]);

  const debitProfilesCount = useMemo(
    () => new Set(expandedDebitRows.map((row) => row.profilId || row.profil)).size,
    [expandedDebitRows]
  );

  const creditTotal = useMemo(
    () => filteredCreditRows.reduce((sum, row) => sum + getPartProfilDueFromAgence(row), 0),
    [filteredCreditRows]
  );

  const expandedCreditRows = useMemo(() => {
    const result: any[] = [];
    for (const row of filteredCreditRows) {
      if (row.parts_repartition && row.parts_repartition.length > 0) {
        const totalDue = getPartProfilDueFromAgence(row);
        const totalParts = row.parts_repartition.reduce((s, p) => s + Number(p.amount || 0), 0) || 1;
        for (const part of row.parts_repartition) {
          const isPaid = part.part_profil_versee ?? row.partProfilVersee;
          if (creditPaymentFilter === 'Non payé' && isPaid) continue;
          if (creditPaymentFilter === 'Payé' && !isPaid) continue;

          const pId = Number(part.profile_id);
          const pName = profileAccountsData.find(a => a.id === pId)?.name || part.profile_name || row.profil;
          const portion = (Number(part.amount || 0) / totalParts) * totalDue;
          result.push({
            ...row,
            profilId: pId,
            profil: pName,
            _partProfilDue: portion,
            _partProfilVersee: isPaid,
            _uniqueKey: `${row.missionNo}-${pId}`
          });
        }
      } else {
        result.push({
          ...row,
          _partProfilDue: getPartProfilDueFromAgence(row),
          _uniqueKey: row.missionNo
        });
      }
    }
    return result;
  }, [filteredCreditRows, profileAccountsData]);

  const agenceNonPayeByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of facturationData) {
      const isDebit = row.statutPaiementUi === 'profil_paye_client' || row.statutPaiementUi === 'Profil payé / Client' || (!row.statutPaiementUi && row.encaissePar === 'Profil');
      if (!isDebit) continue;

      const totalDue = getPartAgenceDueFromProfil(row);
      if (row.parts_repartition && row.parts_repartition.length > 0) {
        const delegatePart = row.parts_repartition.find((p: any) => p.is_delegate) || row.parts_repartition[0];
        if (delegatePart.part_agence_reversee) continue;

        const profileId = Number(delegatePart.profile_id);
        const pName = profileAccountsData.find(a => a.id === profileId)?.name || delegatePart.profile_name || row.profil;
        map.set(pName, (map.get(pName) || 0) + totalDue);
      } else {
        if (row.reglementInterne === 'Réglé') continue;
        map.set(row.profil, (map.get(row.profil) || 0) + totalDue);
      }
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [facturationData, profileAccountsData]);

  const profilNonPayeByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of facturationData) {
      const isCredit = row.statutPaiementUi === 'agence_payee_client' || row.statutPaiementUi === 'Agence payée / Client' || (row.statutPaiementUi === 'facturation_annulee' && row.profilSeraPaye) || (row.statutPaiementUi === 'Facturation annulée' && row.profilSeraPaye) || (!row.statutPaiementUi && row.encaissePar === 'Agence');
      if (!isCredit) continue;

      const totalDue = getPartProfilDueFromAgence(row);
      if (row.parts_repartition && row.parts_repartition.length > 0) {
        const totalParts = row.parts_repartition.reduce((s, p) => s + Number(p.amount || 0), 0) || 1;
        for (const part of row.parts_repartition) {
          if (part.part_profil_versee) continue;

          const pId = Number(part.profile_id);
          const pName = profileAccountsData.find(a => a.id === pId)?.name || part.profile_name || row.profil;
          const portion = (Number(part.amount || 0) / totalParts) * totalDue;
          map.set(pName, (map.get(pName) || 0) + portion);
        }
      } else {
        if (row.reglementInterne === 'Réglé') continue;
        map.set(row.profil, (map.get(row.profil) || 0) + totalDue);
      }
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [facturationData, profileAccountsData]);

  const globalTableTotals = useMemo(() => {
    return globalTableRows.reduce(
      (acc, row) => {
        const isDebit = row.statutPaiementUi === 'profil_paye_client' || (!row.statutPaiementUi && row.encaissePar === 'Profil');
        const isCredit = row.statutPaiementUi === 'agence_payee_client' || (row.statutPaiementUi === 'facturation_annulee' && row.profilSeraPaye) || (!row.statutPaiementUi && row.encaissePar === 'Agence');

        if (isDebit) acc.debit += getPartAgenceDueFromProfil(row);
        if (isCredit) acc.credit += getPartProfilDueFromAgence(row);
        acc.commission += getCommissionAgenceEncaissee(row);
        return acc;
      },
      { debit: 0, credit: 0, commission: 0 }
    );
  }, [globalTableRows]);

  const expandedGlobalTableRows = useMemo(() => {
    const result: any[] = [];
    for (const row of globalTableRows) {
      const isDebit = row.statutPaiementUi === 'profil_paye_client' || (!row.statutPaiementUi && row.encaissePar === 'Profil');
      const isCredit = row.statutPaiementUi === 'agence_payee_client' || (row.statutPaiementUi === 'facturation_annulee' && row.profilSeraPaye) || (!row.statutPaiementUi && row.encaissePar === 'Agence');

      if (row.parts_repartition && row.parts_repartition.length > 0) {
        if (isDebit) {
          const delegatePart = row.parts_repartition.find((p: any) => p.is_delegate) || row.parts_repartition[0];
          const pId = Number(delegatePart.profile_id);
          const pName = profileAccountsData.find(a => a.id === pId)?.name || delegatePart.profile_name || row.profil;

          result.push({
            ...row,
            profilId: pId,
            profil: pName,
            _partAgenceDue: getPartAgenceDueFromProfil(row),
            _partProfilDue: null,
            _commission: getCommissionAgenceEncaissee(row),
            _uniqueKey: `${row.missionNo}-${pId}-debit`,
            _isDebit: isDebit,
            _isCredit: isCredit
          });
        } else if (isCredit) {
          const totalDue = getPartProfilDueFromAgence(row);
          const totalParts = row.parts_repartition.reduce((s, p) => s + Number(p.amount || 0), 0) || 1;
          for (let i = 0; i < row.parts_repartition.length; i++) {
            const part = row.parts_repartition[i];
            const pId = Number(part.profile_id);
            const pName = profileAccountsData.find(a => a.id === pId)?.name || part.profile_name || row.profil;
            const portion = (Number(part.amount || 0) / totalParts) * totalDue;
            result.push({
              ...row,
              profilId: pId,
              profil: pName,
              _partAgenceDue: null,
              _partProfilDue: portion,
              _commission: i === 0 ? getCommissionAgenceEncaissee(row) : null,
              _uniqueKey: `${row.missionNo}-${pId}-credit`,
              _isDebit: isDebit,
              _isCredit: isCredit
            });
          }
        } else {
          result.push({
            ...row,
            _partAgenceDue: getPartAgenceDueFromProfil(row),
            _partProfilDue: getPartProfilDueFromAgence(row),
            _commission: getCommissionAgenceEncaissee(row),
            _uniqueKey: row.missionNo,
            _isDebit: isDebit,
            _isCredit: isCredit
          });
        }
      } else {
        result.push({
          ...row,
          _partAgenceDue: getPartAgenceDueFromProfil(row),
          _partProfilDue: getPartProfilDueFromAgence(row),
          _commission: getCommissionAgenceEncaissee(row),
          _uniqueKey: row.missionNo,
          _isDebit: isDebit,
          _isCredit: isCredit
        });
      }
    }
    return result;
  }, [globalTableRows, profileAccountsData]);

  const goToClientDetails = useCallback((clientId?: number) => {
    if (!clientId) return;
    navigate(`/clients/${encodeId(clientId)}`);
  }, [navigate]);

  const goToProfilDetails = useCallback((profilId?: number) => {
    if (!profilId) return;
    navigate(`/profils/${encodeId(profilId)}`);
  }, [navigate]);

  const closeMissionModal = () => {
    setShowNewMissionModal(false);
    setIsSourceOpen(false);
    setIsEncaissementOpen(false);
  };

  const openMissionDetails = (mission: FacturationRow) => {
    setSelectedMission(mission);
    setMissionDetailTab('infos');
  };

  const closeMissionDetails = () => {
    if (invoicePreview?.url) {
      URL.revokeObjectURL(invoicePreview.url);
    }
    setShowInvoicePreviewPopup(false);
    setInvoicePreview(null);
    setSelectedMission(null);
  };

  const openProfileAccountDetails = (profile: ProfileBalance) => {
    setSelectedProfileAccount(profile);
  };

  const closeProfileAccountDetails = () => {
    setSelectedProfileAccount(null);
  };

  const openMissionEditModal = (mission?: FacturationRow) => {
    const target = mission || selectedMission;
    if (!target) return;

    if (mission) setSelectedMission(mission);

    const mappedStatutPaiement =
      target.paiement === 'paye'
        ? 'Payé'
        : target.paiement === 'partiellement_paye'
          ? 'Paiement partiel'
          : 'Non confirmé';

    // Commission auto-calculée : (partAgence / montant TTC) * 100, 0 si facturation annulée
    const autoCommission = target.statut === 'Facturation annulée' || target.montant === 0
      ? '0'
      : String(Math.round((target.partAgence / target.montant) * 100));

    setMissionEditForm({
      statutMission: target.statut as any,
      commission: autoCommission,
      montantPaye: String(target.montantPaye ?? 0),
      montantEncaisseProfil: target.encaissePar === 'Profil'
        ? String(target.montantPaye ?? target.montant)
        : '0',
      modePaiementReel: target.modePaiementReel ?? 'Choisir',
      datePaiement: formatDateISO(target.datePaiement),
      statutPaiement: mappedStatutPaiement,
      justificatifName: 'Aucun fichier choisi',
      encaissePar: target.encaissePar,
      partProfilVersee: target.partProfilVersee ? 'Oui' : 'Non',
      dateVersementProfil: formatDateISO(target.dateVersementProfil),
      partAgence: String(target.partAgence ?? 0),
      montantAgenceDoitProfil: String(target.montantAgenceDoitProfil ?? 0),
      commercialName: target.commercialName || '',
      tvaRate: target.tvaActive ? '20' : '0',
      commentaire: target.originalDemande?.note_commercial || '',
      montantHt: target.tvaActive
        ? String(Number((target.montant / 1.2).toFixed(2)))
        : String(target.montant),
      partsRepartition: target.parts_repartition
        ? JSON.parse(JSON.stringify(target.parts_repartition)).map((p: any) => {
          if (!p.profile_name && p.profile_id) {
            const agent = agents.find(a => a.id === Number(p.profile_id));
            if (agent) {
              p.profile_name = agent.full_name || `${agent.first_name} ${agent.last_name}`;
            }
          }
          return p;
        })
        : [],
    });

    setShowMissionEditModal(true);
  };

  const closeMissionEditModal = () => {
    setShowMissionEditModal(false);
  };

  const updateCreditPaymentStatus = async (row: FacturationRow, nextStatus: 'Payé' | 'Non payé') => {
    const isPaid = nextStatus === 'Payé';
    const todayIso = new Date().toISOString().slice(0, 10);

    if (row.missionId) {
      await updateMission(row.missionId, {
        part_profil_versee: isPaid,
        date_versement_profil: isPaid ? todayIso : null,
      });
    }

    if (row.demandeId && row.originalDemande) {
      const originalFormData = row.originalDemande.formulaire_data || {};
      const facturation = originalFormData.facturation || {};

      let allPaid = isPaid; // By default if single profile
      let newParts = facturation.parts_repartition;

      if (Array.isArray(facturation.parts_repartition) && facturation.parts_repartition.length > 0 && row.profilId) {
        newParts = facturation.parts_repartition.map((p: any) => {
          if (Number(p.profile_id) === row.profilId) {
            return { ...p, part_profil_versee: isPaid, date_versement_profil: isPaid ? todayIso : null };
          }
          return p;
        });
        allPaid = newParts.every((p: any) => p.part_profil_versee);
      }

      await updateDemande(row.demandeId, {
        formulaire_data: {
          ...originalFormData,
          facturation: {
            ...facturation,
            parts_repartition: newParts,
            // Sync règlement interne if all are paid or single
            part_profil_versee: allPaid,
            date_versement_profil: allPaid ? todayIso : null,
            // Sync statut Dashboard : Payé ou retour à Agence payée / Client
            statut_paiement_ui: allPaid ? 'paye' : (facturation.statut_paiement_ui === 'facturation_annulee' ? 'facturation_annulee' : 'agence_payee_client'),
          }
        },
        // Sync champ API : integral ou partiel
        statut_paiement: allPaid ? 'integral' : 'partiel',
      });
    }

    await loadFinanceData();
  };

  const updateDebitPaymentStatus = async (row: FacturationRow, nextStatus: 'Payé' | 'Non payé') => {
    const isPaid = nextStatus === 'Payé';
    const todayIso = new Date().toISOString().slice(0, 10);

    if (row.missionId) {
      await updateMission(row.missionId, {
        part_agence_reversee: isPaid,
        date_remise_agence: isPaid ? todayIso : null,
      });
    }

    if (row.demandeId && row.originalDemande) {
      const originalFormData = row.originalDemande.formulaire_data || {};
      const facturation = originalFormData.facturation || {};

      let allPaid = isPaid; // By default if single profile
      let newParts = facturation.parts_repartition;

      if (Array.isArray(facturation.parts_repartition) && facturation.parts_repartition.length > 0 && row.profilId) {
        newParts = facturation.parts_repartition.map((p: any) => {
          if (Number(p.profile_id) === row.profilId) {
            return { ...p, part_agence_reversee: isPaid, date_remise_agence: isPaid ? todayIso : null };
          }
          return p;
        });
        allPaid = newParts.every((p: any) => p.part_agence_reversee);
      }

      await updateDemande(row.demandeId, {
        formulaire_data: {
          ...originalFormData,
          facturation: {
            ...facturation,
            parts_repartition: newParts,
            // Sync règlement interne if all are paid or single
            part_agence_reversee: allPaid,
            date_remise_agence: allPaid ? todayIso : null,
            // Sync statut Dashboard : Payé ou retour à Profil payé / Client
            statut_paiement_ui: allPaid ? 'paye' : 'profil_paye_client',
          }
        },
        // Sync champ API : integral ou partiel
        statut_paiement: allPaid ? 'integral' : 'partiel',
      });
    }

    await loadFinanceData();
  };

  const handleGenerateInvoicePreview = async () => {
    if (!selectedMission?.demandeId) {
      addToast('Aucune demande liée à cette mission', 'error');
      return;
    }

    const type: 'devis' | 'png' | 'facture' = 'facture';
    setIsGeneratingInvoice(true);
    try {
      const response = await generateDocument(selectedMission.demandeId, type);
      const doc = response.data;
      const { blobUrl } = await fetchSecureDocBlob(doc.download_url);

      if (invoicePreview?.url) {
        URL.revokeObjectURL(invoicePreview.url);
      }

      setInvoicePreview({
        url: blobUrl,
        type,
        name: doc.nom,
        demandeId: selectedMission.demandeId,
      });
      setShowInvoicePreviewPopup(true);

      addToast('Facture générée et prête en prévisualisation', 'success');
    } catch {
      addToast('Erreur lors de la génération de la facture', 'error');
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!invoicePreview) {
      addToast('Générez la facture puis vérifiez la prévisualisation', 'info');
      return;
    }

    setIsSendingInvoice(true);
    try {
      await sendWhatsApp(invoicePreview.demandeId, invoicePreview.type);
      addToast('Facture envoyée au client', 'success');
    } catch {
      addToast('Erreur lors de l’envoi de la facture', 'error');
    } finally {
      setIsSendingInvoice(false);
    }
  };

  const handleSaveMissionEdit = async () => {
    if (!selectedMission?.missionId && !selectedMission?.demandeId) {
      closeMissionEditModal();
      return;
    }

    const payload: Record<string, unknown> = {
      statut: statutMissionCodeFromLabel(missionEditForm.statutMission),
      encaisse_par: missionEditForm.encaissePar === 'Profil' ? 'profil' : 'agence',
      montant_paye: Number(missionEditForm.montantPaye || 0),
      mode_paiement_reel: modeCodeFromLabel(missionEditForm.modePaiementReel),
      date_paiement: missionEditForm.datePaiement || null,
      paiement_client_statut: paiementStatusCodeFromLabel(missionEditForm.statutPaiement),
      part_profil_versee: missionEditForm.encaissePar === 'Agence' ? missionEditForm.partProfilVersee === 'Oui' : false,
      date_versement_profil: missionEditForm.encaissePar === 'Agence' ? (missionEditForm.dateVersementProfil || null) : null,
      montant_encaisse_profil: missionEditForm.encaissePar === 'Profil' ? Number(missionEditForm.montantEncaisseProfil || 0) : 0,
      part_agence_reversee: missionEditForm.encaissePar === 'Profil' ? missionEditForm.partProfilVersee === 'Oui' : false,
      date_remise_agence: missionEditForm.encaissePar === 'Profil' ? (missionEditForm.dateVersementProfil || null) : null,
    };

    // Forcer le statut à annulé si le paiement est marqué comme tel
    if (missionEditForm.statutPaiement === 'facturation_annulee') {
      payload.statut = 'annulee';
    }

    const newHt = Number(missionEditForm.montantHt) || 0;
    const newTvaRate = Number(missionEditForm.tvaRate) || 0;
    const newTtc = Number((newHt * (1 + newTvaRate / 100)).toFixed(2));
    payload.montant = newTtc;

    setIsSavingMissionEdit(true);
    try {
      if (selectedMission.missionId) {
        await updateMission(selectedMission.missionId, payload);
      }

      // Synchronisation avec la Demande liée
      if (selectedMission.demandeId && selectedMission.originalDemande) {
        const originalFormData = selectedMission.originalDemande.formulaire_data || {};
        const facturation = originalFormData.facturation || {};

        const mappedDemandeStatut = {
          'paye': 'integral',
          'agence_payee_client': 'integral',
          'profil_paye_client': 'integral',
          'paiement_partiel': 'partiel',
          'paiement_en_attente': 'en_attente',
        }[payload.paiement_client_statut as string] || 'non_paye';

        const demandePayload: any = {
          note_commercial: missionEditForm.commentaire,
          formulaire_data: {
            ...originalFormData,
            facturation: {
              ...facturation,
              montant_ht: newHt,
              tva_active: newTvaRate > 0,
              statut_paiement_ui: (payload.paiement_client_statut as string) || facturation.statut_paiement_ui,
              facturation_annulee: payload.paiement_client_statut === 'facturation_annulee',
              part_agence: Number(missionEditForm.partAgence || facturation.part_agence || 0),
              montant_agence_doit_profil: Number(missionEditForm.montantAgenceDoitProfil || facturation.montant_agence_doit_profil || 0),
              part_profil_versee: payload.part_profil_versee,
              date_versement_profil: payload.date_versement_profil,
              part_agence_reversee: payload.part_agence_reversee,
              date_remise_agence: payload.date_remise_agence,
              parts_repartition: missionEditForm.partsRepartition?.length ? missionEditForm.partsRepartition : facturation.parts_repartition,
              montant_verse: Number(missionEditForm.montantPaye || 0),
              montant_encaisse_profil: missionEditForm.encaissePar === 'Profil' ? Number(missionEditForm.montantEncaisseProfil || 0) : 0,
              date_paiement: missionEditForm.datePaiement || null,
              commercial_name: missionEditForm.commercialName,
            }
          },
          prix: newTtc,
          statut_paiement: mappedDemandeStatut,
          part_agence: missionEditForm.partAgence ? Number(missionEditForm.partAgence) : undefined,
          parts_repartition: missionEditForm.partsRepartition?.length ? missionEditForm.partsRepartition : undefined,
        };

        const matchingCommercial = commerciaux.find(c => (c.full_name || `${c.first_name} ${c.last_name}`) === missionEditForm.commercialName);
        if (matchingCommercial) {
          demandePayload.assigned_to = matchingCommercial.id;
        }

        // Supprimer explicitement commercial_name s'il n'est pas supporté en backend
        await updateDemande(selectedMission.demandeId, demandePayload);
      }

      const refreshedRows = await loadFinanceData();

      // Update the currently selected mission if it exists to reflect changes in the details modal
      if (refreshedRows && selectedMission) {
        const updated = refreshedRows.find(m =>
          (m.missionId && m.missionId === selectedMission.missionId) ||
          (!m.missionId && m.demandeId && m.demandeId === selectedMission.demandeId)
        );
        if (updated) setSelectedMission(updated);
      }

      closeMissionEditModal();
      // On ne ferme plus les détails pour que l'utilisateur voie la mise à jour
    } finally {
      setIsSavingMissionEdit(false);
    }
  };

  const exportSuiviReportExcel = useCallback(() => {
    const headers = [
      'N° Mission',
      'Date',
      'Client',
      'Ville',
      'Profil',
      'Service',
      'Segment',
      'Montant TTC',
      'A payé',
      'Reste a payer',
      'Part agence',
      'Part profil',
      'Encaisse par',
      'Paiement',
      'Statut Paiem.',
      'Reglement interne',
    ];

    const rows = filteredSuiviRows.map((row) => {
      const ttc = row.montant;
      const paid = row.montantPaye ?? 0;
      const ecart = Number((ttc - paid).toFixed(2));
      return [
        row.missionNo,
        row.date,
        row.client,
        row.ville,
        row.profil,
        row.service,
        row.segment,
        ttc,
        paid,
        ecart,
        row.partAgence,
        row.partProfil,
        row.encaissePar,
        paiementLabel(row.paiement),
        row.statut,
        row.reglementInterne,
      ];
    });

    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => csvCell(cell as string | number)).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suivi-facturation-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredSuiviRows]);

  const exportSuiviReportPdf = useCallback(() => {
    const lines = filteredSuiviRows.map((row) => {
      const ttc = row.montant;
      const paid = row.montantPaye ?? 0;
      const ecart = Number((ttc - paid).toFixed(2));
      return `<tr>
        <td>${row.missionNo}</td>
        <td>${row.date}</td>
        <td>${row.client}</td>
        <td>${row.profil}</td>
        <td>${row.service}</td>
        <td>${row.segment}</td>
        <td>${money(ttc)}</td>
        <td>${money(paid)}</td>
        <td>${money(ecart)}</td>
      </tr>`;
    }).join('');

    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.document.write(`
      <html>
        <head><title>Suivi Facturation</title></head>
        <body style="font-family: Arial, sans-serif; padding: 16px;">
          <h2>Rapport Suivi Facturation</h2>
          <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead>
              <tr>
                <th>N° Mission</th><th>Date</th><th>Client</th><th>Profil</th><th>Service</th><th>Segment</th><th>Montant TTC</th><th>À payer</th><th>Reste a payer</th>
              </tr>
            </thead>
            <tbody>${lines}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }, [filteredSuiviRows]);

  return (
    <div className="page fg-page">

      <div className="fg-tabs" role="tablist" aria-label="Navigation gestion financière">
        <button
          type="button"
          className={`fg-tab ${activeTab === 'vue-globale' ? 'active' : ''}`}
          onClick={() => setActiveTab('vue-globale')}
        >
          <BarChart3 size={15} /> Vue globale
        </button>
        <button
          type="button"
          className={`fg-tab ${activeTab === 'debit-profil' ? 'active active-red' : ''}`}
          onClick={() => setActiveTab('debit-profil')}
        >
          <ArrowUpRight size={15} /> Débit (Profil doit à l'Agence)
        </button>
        <button
          type="button"
          className={`fg-tab ${activeTab === 'credit-profil' ? 'active active-blue' : ''}`}
          onClick={() => setActiveTab('credit-profil')}
        >
          <ArrowUpRight size={15} /> Crédit (L'Agence doit au Profil)
        </button>
        <button
          type="button"
          className={`fg-tab ${activeTab === 'suivi-facturation' ? 'active active-amber' : ''}`}
          onClick={() => setActiveTab('suivi-facturation')}
        >
          <FileText size={15} /> Suivi Facturation
        </button>
        <button
          type="button"
          className={`fg-tab ${activeTab === 'comptes-profils' ? 'active active-purple' : ''}`}
          onClick={() => setActiveTab('comptes-profils')}
        >
          <Users size={15} /> Comptes Profils
        </button>
      </div>

      {activeTab === 'vue-globale' && (
        <>
          <div className="fg-global-period-row">
            <span className="fg-global-period-label">Période :</span>
            <label className="fg-select-wrap fg-global-mode-select">
              <select value={globalPeriodMode} onChange={(e) => setGlobalPeriodMode(e.target.value as 'jour' | 'semaine' | 'mois' | 'periode')}>
                <option value="jour">Par jour</option>
                <option value="semaine">Par semaine</option>
                <option value="mois">Par mois</option>
                <option value="periode">Période X → Y</option>
              </select>
              <ChevronDown size={14} />
            </label>
            {globalPeriodMode === 'jour' && (
              <div className="fg-period-wrap">
                <label><Calendar size={14} /><input type="date" aria-label="Jour" value={globalDay} onChange={(e) => setGlobalDay(e.target.value)} /></label>
              </div>
            )}
            {globalPeriodMode === 'semaine' && (
              <div className="fg-period-wrap">
                <label><Calendar size={14} /><input type="week" aria-label="Semaine" value={globalWeek} onChange={(e) => setGlobalWeek(e.target.value)} /></label>
              </div>
            )}
            {globalPeriodMode === 'mois' && (
              <div className="fg-period-wrap">
                <label><Calendar size={14} /><input type="month" aria-label="Mois" value={globalMonth} onChange={(e) => setGlobalMonth(e.target.value)} /></label>
              </div>
            )}
            {globalPeriodMode === 'periode' && (
              <div className="fg-period-wrap">
                <label><Calendar size={14} /><input type="date" aria-label="Date début" value={globalDateFrom} onChange={(e) => setGlobalDateFrom(e.target.value)} /></label>
                <span className="fg-period-arrow">→</span>
                <label><Calendar size={14} /><input type="date" aria-label="Date fin" value={globalDateTo} onChange={(e) => setGlobalDateTo(e.target.value)} /></label>
              </div>
            )}
          </div>

          <div className="fg-global-kpis">
            <article className="fg-global-kpi blue">
              <p className="fg-global-kpi-title">NOMBRE DE MISSIONS</p>
              <p className="fg-global-kpi-value">{globalKpis.missions}</p>
              <p className="fg-global-kpi-subtitle">missions en cours (temps réel)</p>
            </article>
            <article className="fg-global-kpi green">
              <p className="fg-global-kpi-title">CHIFFRE D'AFFAIRES</p>
              <p className="fg-global-kpi-value">{money(globalKpis.chiffreAffaires)}</p>
              <p className="fg-global-kpi-subtitle">paiements reçus des clients</p>
            </article>
            <article className="fg-global-kpi green">
              <p className="fg-global-kpi-title">COMMISSION AGENCE</p>
              <p className="fg-global-kpi-value">{money(globalKpis.commissionAgence)}</p>
              <p className="fg-global-kpi-subtitle">net (après déduction pertes)</p>
            </article>
            <article className="fg-global-kpi red">
              <p className="fg-global-kpi-title">FACTURATION ANNULÉE / PERTE</p>
              <p className="fg-global-kpi-value">{money(globalKpis.facturationAnnulee)}</p>
              <p className="fg-global-kpi-subtitle">montant payé aux profils</p>
            </article>
          </div>

          <section className="fg-global-repartition-card">
            <h3>Répartition des missions</h3>
            <div className="fg-global-repartition-content">
              <div className="fg-repartition-label left">Particuliers: {globalSegmentStats.particulier}</div>
              <div
                className="fg-global-pie"
                style={{
                  background: `conic-gradient(#3f7fe6 0% ${globalSegmentStats.particulierRatio}%, #8b5cf6 ${globalSegmentStats.particulierRatio}% 100%)`,
                }}
              />
              <div className="fg-repartition-label right">Entreprises: {globalSegmentStats.entreprise}</div>
            </div>
            <div className="fg-repartition-legend">
              <span><i className="dot blue" />Particuliers</span>
              <span><i className="dot purple" />Entreprises</span>
            </div>
          </section>

          <div className="fg-global-balance-grid">
            <article className="fg-global-balance-card red">
              <header>
                <p>Agence non payée</p>
                <span>{money(agenceNonPayeAmount)}</span>
              </header>
              <small>Ce que les profils doivent à l'agence</small>
              <div className="fg-global-bars">
                {agenceNonPayeByProfile.map((item) => (
                  <div key={`debit-${item.name}`} className="fg-global-bar-row">
                    <div className="fg-global-bar-top">
                      <span>{item.name}</span>
                      <strong>{money(item.amount)}</strong>
                    </div>
                    <div className="fg-global-balance-track">
                      <div
                        className="fg-global-balance-fill red"
                        style={{ width: `${Math.min(100, (item.amount / Math.max(agenceNonPayeByProfile[0]?.amount || 1, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="fg-global-balance-card blue">
              <header>
                <p>Profil non payé</p>
                <span>{money(profilNonPayeAmount)}</span>
              </header>
              <small>Ce que l'agence doit aux profils</small>
              <div className="fg-global-bars">
                {profilNonPayeByProfile.map((item) => (
                  <div key={`credit-${item.name}`} className="fg-global-bar-row">
                    <div className="fg-global-bar-top">
                      <span>{item.name}</span>
                      <strong>{money(item.amount)}</strong>
                    </div>
                    <div className="fg-global-balance-track">
                      <div
                        className="fg-global-balance-fill blue"
                        style={{ width: `${Math.min(100, (item.amount / Math.max(profilNonPayeByProfile[0]?.amount || 1, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="fg-facturation-filters">
            <label className="fg-search-wrap">
              <Search size={15} />
              <input
                type="text"
                placeholder="Rechercher par nom client ou profil..."
                value={globalTableSearch}
                onChange={(e) => setGlobalTableSearch(e.target.value)}
              />
            </label>
            <div className="fg-period-wrap">
              <label><Calendar size={14} /><input type="date" aria-label="Filtre date début" value={globalTableDateFrom} onChange={(e) => setGlobalTableDateFrom(e.target.value)} /></label>
              <span className="fg-period-arrow">→</span>
              <label><Calendar size={14} /><input type="date" aria-label="Filtre date fin" value={globalTableDateTo} onChange={(e) => setGlobalTableDateTo(e.target.value)} /></label>
            </div>
          </div>

          <section className="fg-table-section">
            <div className="fg-section-head">
              <h3>Tableau Débit / Crédit</h3>
              <span>{globalTableRows.length} ligne(s)</span>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Profil</th>
                    <th>Débit</th>
                    <th>Crédit</th>
                    <th>Commission agence encaissée</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedGlobalTableRows.map((row) => (
                    <tr key={row._uniqueKey}>
                      <td>{row.date || '—'}</td>
                      <td className="fw-bold">
                        {row.clientId ? (
                          <button type="button" className="fg-link-btn" onClick={() => goToClientDetails(row.clientId)}>{row.client}</button>
                        ) : row.client}
                      </td>
                      <td>
                        {row.profilId ? (
                          <button type="button" className="fg-link-btn" onClick={() => goToProfilDetails(row.profilId)}>{row.profil || '—'}</button>
                        ) : (row.profil || '—')}
                      </td>
                      <td className="fg-text-red fw-semibold">
                        {row._isDebit && row._partAgenceDue !== null ? money(row._partAgenceDue) : '—'}
                      </td>
                      <td className="fg-text-orange fw-semibold">
                        {row._isCredit && row._partProfilDue !== null ? money(row._partProfilDue) : '—'}
                      </td>
                      <td className="fg-text-green fw-semibold">
                        {row._commission !== null ? money(row._commission) : '—'}
                      </td>
                    </tr>
                  ))}
                  {globalTableRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-row">Aucune ligne trouvée pour ce filtre.</td>
                    </tr>
                  )}
                  <tr>
                    <td className="fw-bold">TOTAL</td>
                    <td>—</td>
                    <td>—</td>
                    <td className="fg-text-red fw-bold">{money(globalTableTotals.debit)}</td>
                    <td className="fg-text-orange fw-bold">{money(globalTableTotals.credit)}</td>
                    <td className="fg-text-green fw-bold">{money(globalTableTotals.commission)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'debit-profil' && (
        <>
          <div className="fg-global-kpis fg-duo-kpis">
            <article className="fg-global-kpi red">
              <p className="fg-global-kpi-title">Profils débiteurs</p>
              <p className="fg-global-kpi-value">{debitProfilesCount}</p>
            </article>
            <article className="fg-global-kpi red">
              <p className="fg-global-kpi-title">Total dû à l'agence</p>
              <p className="fg-global-kpi-value">{money(debitTotal)}</p>
            </article>
          </div>

          <div className="fg-facturation-filters">
            <label className="fg-search-wrap">
              <Search size={15} />
              <input
                type="text"
                placeholder="Rechercher par nom client/profil..."
                value={debitSearch}
                onChange={(e) => setDebitSearch(e.target.value)}
              />
            </label>
            <div className="fg-period-wrap">
              <label><Calendar size={14} /><input type="date" aria-label="Date début débit" value={debitDateFrom} onChange={(e) => setDebitDateFrom(e.target.value)} /></label>
              <span className="fg-period-arrow">→</span>
              <label><Calendar size={14} /><input type="date" aria-label="Date fin débit" value={debitDateTo} onChange={(e) => setDebitDateTo(e.target.value)} /></label>
            </div>
            <div className="fg-select-group">
              <label className="fg-select-wrap">
                <select value={debitSegmentFilter} onChange={(e) => setDebitSegmentFilter(e.target.value as 'Tous les segments' | 'Particulier' | 'Entreprise')}>
                  <option>Tous les segments</option>
                  <option>Particulier</option>
                  <option>Entreprise</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="fg-select-wrap">
                <select value={debitPaymentFilter} onChange={(e) => setDebitPaymentFilter(e.target.value as 'Non payé' | 'Payé' | 'Tous')}>
                  <option value="Non payé">Non payé</option>
                  <option value="Payé">Payé</option>
                  <option value="Tous">Tous</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="fg-select-wrap">
                <select value={debitMissionFilter} onChange={(e) => setDebitMissionFilter(e.target.value as 'Tous' | 'Facturée' | 'Facturation annulée')}>
                  <option>Tous</option>
                  <option>Facturée</option>
                  <option>Facturation annulée</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>

          <section className="fg-table-section">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date mission</th>
                    <th>Client - Ville</th>
                    <th>Nom du profil</th>
                    <th>Service</th>
                    <th>Segment</th>
                    <th>Montant encaissé (profil)</th>
                    <th>Doit à l'agence (réel)</th>
                    <th>Part du profil</th>
                    <th>Statut du paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedDebitRows.map((row) => (
                    <tr key={row._uniqueKey} style={debitPaymentLabel(row) === 'Payé' ? { opacity: 0.45 } : undefined}>
                      <td>{row.date || '—'}</td>
                      <td>
                        {row.clientId ? (
                          <button type="button" className="fg-link-btn" onClick={() => goToClientDetails(row.clientId)}>{row.client}</button>
                        ) : <span className="fw-bold">{row.client}</span>}
                        <br />{row.ville}
                      </td>
                      <td>
                        {row.profilId ? (
                          <button type="button" className="fg-link-btn" onClick={() => goToProfilDetails(row.profilId)}>{row.profil || '—'}</button>
                        ) : (row.profil || '—')}
                      </td>
                      <td>{row.service}</td>
                      <td><span className="fg-pill fg-pill-blue">{row.segment}</span></td>
                      <td className="fw-semibold">{money(getMontantEncaisseProfil(row))}</td>
                      <td className="fg-text-red fw-bold">{money(row._partAgenceDue)}</td>
                      <td>{money(row.partProfil)}</td>
                      <td>
                        <label className="fg-select-wrap fg-compact-select">
                          <select
                            className={`fg-status-select ${debitPaymentLabel(row) === 'Payé' ? 'paid' : 'unpaid'}`}
                            value={debitPaymentLabel(row)}
                            onChange={(e) => void updateDebitPaymentStatus(row, e.target.value as 'Payé' | 'Non payé')}
                          >
                            <option value="Non payé">Non payé</option>
                            <option value="Payé">Payé</option>
                          </select>
                          <ChevronDown size={14} />
                        </label>
                      </td>
                    </tr>
                  ))}
                  {expandedDebitRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty-row">Aucune ligne pour ce filtre.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'credit-profil' && (
        <>
          <div className="fg-global-kpis fg-duo-kpis">
            <article className="fg-global-kpi blue">
              <p className="fg-global-kpi-title">Profils créditeurs</p>
              <p className="fg-global-kpi-value">{filteredCreditRows.length}</p>
            </article>
            <article className="fg-global-kpi blue">
              <p className="fg-global-kpi-title">Total dû au profil</p>
              <p className="fg-global-kpi-value">{money(creditTotal)}</p>
            </article>
          </div>

          <div className="fg-facturation-filters">
            <label className="fg-search-wrap">
              <Search size={15} />
              <input
                type="text"
                placeholder="Rechercher par nom client/profil..."
                value={creditSearch}
                onChange={(e) => setCreditSearch(e.target.value)}
              />
            </label>
            <div className="fg-period-wrap">
              <label><Calendar size={14} /><input type="date" aria-label="Date début crédit" value={creditDateFrom} onChange={(e) => setCreditDateFrom(e.target.value)} /></label>
              <span className="fg-period-arrow">→</span>
              <label><Calendar size={14} /><input type="date" aria-label="Date fin crédit" value={creditDateTo} onChange={(e) => setCreditDateTo(e.target.value)} /></label>
            </div>
            <div className="fg-select-group">
              <label className="fg-select-wrap">
                <select value={creditSegmentFilter} onChange={(e) => setCreditSegmentFilter(e.target.value as 'Tous les segments' | 'Particulier' | 'Entreprise')}>
                  <option>Tous les segments</option>
                  <option>Particulier</option>
                  <option>Entreprise</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="fg-select-wrap">
                <select value={creditPaymentFilter} onChange={(e) => setCreditPaymentFilter(e.target.value as 'Non payé' | 'Payé' | 'Tous')}>
                  <option value="Non payé">Non payé</option>
                  <option value="Payé">Payé</option>
                  <option value="Tous">Tous</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="fg-select-wrap">
                <select value={creditMissionFilter} onChange={(e) => setCreditMissionFilter(e.target.value as 'Tous' | 'Facturée' | 'Facturation annulée')}>
                  <option>Tous</option>
                  <option>Facturée</option>
                  <option>Facturation annulée</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>

          <section className="fg-table-section">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date mission</th>
                    <th>Client - Ville</th>
                    <th>Nom du profil</th>
                    <th>Service</th>
                    <th>Mission</th>
                    <th>Segment</th>
                    <th>Montant TTC</th>
                    <th>Part de l'agence</th>
                    <th>Doit au profil (réel)</th>
                    <th>Statut paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedCreditRows.map((row) => (
                    <tr key={row._uniqueKey} style={creditPaymentLabel(row) === 'Payé' ? { opacity: 0.45 } : undefined}>
                      <td>{row.date || '—'}</td>
                      <td>
                        {row.clientId ? (
                          <button type="button" className="fg-link-btn" onClick={() => goToClientDetails(row.clientId)}>{row.client}</button>
                        ) : row.client}
                        <small>{row.ville}</small>
                      </td>
                      <td>
                        {row.profilId ? (
                          <button type="button" className="fg-link-btn" onClick={() => goToProfilDetails(row.profilId)}>{row.profil || '—'}</button>
                        ) : (row.profil || '—')}
                      </td>
                      <td>{row.service}</td>
                      <td>
                        <span className={`fg-pill ${missionFinanceLabel(row) === 'Facturation annulée' ? 'fg-pill-pink' : 'fg-pill-light-green'}`}>
                          {missionFinanceLabel(row)}
                        </span>
                        {row.statut === 'Facturation annulée' && <small>Montant profil: {money(row.partProfil)}</small>}
                      </td>
                      <td><span className="fg-pill fg-pill-blue">{row.segment}</span></td>
                      <td className="fw-semibold">{money(row.montant)}</td>
                      <td>{money(row.partAgence)}</td>
                      <td className="fg-text-blue fw-bold">{money(row._partProfilDue)}</td>
                      <td>
                        <label className="fg-select-wrap fg-compact-select">
                          <select
                            className={`fg-status-select ${creditPaymentLabel(row) === 'Payé' ? 'paid' : 'unpaid'}`}
                            value={creditPaymentLabel(row)}
                            onChange={(e) => void updateCreditPaymentStatus(row, e.target.value as 'Payé' | 'Non payé')}
                          >
                            <option value="Non payé">Non payé</option>
                            <option value="Payé">Payé</option>
                          </select>
                          <ChevronDown size={14} />
                        </label>
                      </td>
                    </tr>
                  ))}
                  {filteredCreditRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="empty-row">Aucune ligne pour ce filtre.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === 'suivi-facturation' && (
        <>
          <section className="fg-hero">
            <div>
              <h2>Suivi Facturation</h2>
              <p>Suivi complet de toutes les factures</p>
            </div>
            <div className="fg-export-actions">
              <button className="btn btn-secondary" onClick={exportSuiviReportPdf}>Exporter PDF</button>
              <button className="btn btn-primary" onClick={exportSuiviReportExcel}>Exporter Excel</button>
            </div>
          </section>

          <div className="fg-hero-stats">
            <article><FileText size={20} /><div><strong>{suiviRecap.totalFacture}</strong><span>Total factures</span></div></article>
            <article><BarChart3 size={20} /><div><strong>{money(suiviRecap.chiffreAffaires)}</strong><span>CHIFFRE D'AFFAIRES</span></div></article>
            <article><Clock3 size={20} /><div><strong>{money(suiviRecap.commissionAgence)}</strong><span>COMMISSION AGENCE</span></div></article>
            <article><Users size={20} /><div><strong>{suiviRecap.paiementsEnAttente}</strong><span>Paiements en attente</span></div></article>
          </div>

          <div className="fg-facturation-filters">
            <label className="fg-search-wrap">
              <Search size={15} />
              <input
                type="text"
                placeholder="Rechercher client, mission, ville..."
                value={suiviSearch}
                onChange={(e) => setSuiviSearch(e.target.value)}
              />
            </label>
            <div className="fg-period-wrap">
              <label><Calendar size={14} /><input type="date" aria-label="Date début" value={suiviDateFrom} onChange={(e) => setSuiviDateFrom(e.target.value)} /></label>
              <label><Calendar size={14} /><input type="date" aria-label="Date fin" value={suiviDateTo} onChange={(e) => setSuiviDateTo(e.target.value)} /></label>
            </div>
            <div className="fg-select-group">
              <label className="fg-select-wrap">
                <select value={suiviPaiementFilter} onChange={(e) => setSuiviPaiementFilter(e.target.value)}>
                  <option>Tous les paiements</option>
                  <option>Non payé</option>
                  <option>Paiement en attente</option>
                  <option>Agence payé/client</option>
                  <option>Profil payé/client</option>
                  <option>Paiement partiel</option>
                  <option>Payé</option>
                  <option>Confirmé</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="fg-select-wrap">
                <select value={suiviSegmentFilter} onChange={(e) => setSuiviSegmentFilter(e.target.value)}>
                  <option>Tous les segments</option>
                  <option>Particulier</option>
                  <option>Entreprise</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table fg-facturation-table">
              <thead>
                <tr>
                  <th>Commercial</th>
                  <th>N°<br />Facture</th>
                  <th>Date<br />prestation</th>
                  <th>Client -<br />Ville</th>
                  <th>Service</th>
                  <th>Segment</th>
                  <th>Montant<br />HT</th>
                  <th>TVA</th>
                  <th>Montant<br />TTC</th>
                  <th>Mode<br />paiement</th>
                  <th>A payé</th>
                  <th>Reste à<br />payer</th>
                  <th style={{ textAlign: 'center' }}>Statut Paiem.</th>
                  <th>Date<br />paiement</th>
                  <th>Commentaire</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredSuiviRows.map((row) => {
                  const ttc = row.montant;
                  const tva = row.tvaActive ? Math.round((ttc - Math.round((ttc / 1.20) * 100) / 100) * 100) / 100 : 0;
                  const ht = row.tvaActive ? Math.round((ttc / 1.20) * 100) / 100 : ttc;
                  const paye = row.montantPaye ?? 0;
                  const ecart = Number((ttc - paye).toFixed(2));

                  const renderMoney = (val: number) => {
                    const formatted = money(val);
                    const match = formatted.match(/^(.*?)\s+([^\d\s]+)$/);
                    if (match) {
                      return <>{match[1]}<br />{match[2]}</>;
                    }
                    return formatted;
                  };

                  let statusContent: React.ReactNode = row.statut;
                  let statusPillClass = 'fg-pill-pale-orange';

                  if (row.statut === 'Facturation annulée') {
                    statusPillClass = 'fg-pill-pale-red';
                    statusContent = 'Facturation annulée';
                  } else if (row.statut === 'Payé' || (row.reglementInterne === 'Réglé' && row.paiement === 'paye')) {
                    statusPillClass = 'fg-pill-pale-green';
                    statusContent = 'Payé';
                  } else if (row.reglementInterne === 'Réglé' && row.paiement !== 'paye') {
                    statusPillClass = 'fg-pill-pale-orange';
                    statusContent = <>Profil<br />payé /<br />Client</>;
                  } else {
                    // Fallback sur le statut de paiement détaillé
                    statusContent = getPaymentUiLabel(row.statutPaiementUi);
                    if (row.paiement === 'non_paye') {
                      statusPillClass = 'fg-pill-outline';
                    } else {
                      statusPillClass = 'fg-pill-pale-orange';
                    }
                  }

                  return (
                    <tr key={row.missionNo}>
                      <td className="fw-bold" style={{ color: '#334155' }}>{row.commercialName || '—'}</td>
                      <td className="fw-bold fg-mission-no">{row.missionNo}</td>
                      <td>{row.date || '—'}</td>
                      <td style={{ lineHeight: '1.3' }}>
                        {row.clientId ? (
                          <button type="button" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontWeight: 800, color: '#0f5f5b', textAlign: 'left', fontSize: '1rem' }} onClick={() => goToClientDetails(row.clientId)}>{row.client}</button>
                        ) : <strong style={{ fontWeight: 800, color: '#0f5f5b' }}>{row.client}</strong>}
                        <small style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'block' }}>{row.ville}</small>
                      </td>
                      <td style={{ color: '#64748b' }}>{row.service}</td>
                      <td><span className={`fg-pill ${row.segment === 'Particulier' ? 'fg-pill-outline-sky' : 'fg-pill-violet'}`}>{row.segment}</span></td>
                      <td className="fw-bold" style={{ color: '#0f5f5b' }}>{renderMoney(ht)}</td>
                      <td style={{ color: '#0f5f5b' }}>{renderMoney(tva)}</td>
                      <td className="fw-bold" style={{ color: '#0f5f5b' }}>{renderMoney(ttc)}</td>
                      <td style={{ color: '#64748b' }}>{row.modePaiementReel || row.modePaiement || '—'}</td>
                      <td className="fw-bold" style={{ color: '#059669' }}>{renderMoney(paye)}</td>
                      <td className="fw-bold" style={{ color: '#d97706' }}>{Math.abs(ecart) > 0.009 ? renderMoney(ecart) : renderMoney(0)}</td>
                      <td>
                        <span className={`fg-pill ${statusPillClass}`} style={{ textAlign: 'left', display: 'inline-block', lineHeight: '1.3', border: 'none', padding: '0.35rem 0.55rem' }}>
                          {statusContent}
                        </span>
                      </td>
                      <td style={{ color: '#64748b' }}>{row.datePaiement || '—'}</td>
                      <td style={{ color: '#64748b' }}>—</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button className="icon-btn" title="Voir" onClick={() => openMissionDetails(row)}><Eye size={16} color="#64748b" /></button>
                          <button className="icon-btn" title="Archiver"><Archive size={16} color="#64748b" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSuiviRows.length === 0 && (
                  <tr>
                    <td colSpan={17} className="empty-row">Aucune mission trouvée.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={17}>
                    <div className="fg-table-footer-summary">
                      <span className="fg-summary-count">{displayedMissionCount} mission(s) affichée(s)</span>
                      <span className="fg-summary-total">Total affiché : <strong>{money(displayedMissionTotal)}</strong></span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {activeTab === 'comptes-profils' && (
        <>
          <section className="fg-hero">
            <div>
              <h2>Comptes Financiers des Profils</h2>
              <p>Suivi des soldes et répartitions par femme de ménage</p>
            </div>
          </section>

          <div className="fg-profile-toolbar">
            <label className="fg-search-wrap compact">
              <Search size={15} />
              <input
                type="text"
                placeholder="Rechercher un profil..."
                value={searchProfiles}
                onChange={(e) => setSearchProfiles(e.target.value)}
              />
            </label>

            <div className="fg-mode-toggle">
              <button
                type="button"
                className={displayMode === 'cards' ? 'active' : ''}
                onClick={() => setDisplayMode('cards')}
                title="Vue cartes"
              >
                <Grid3X3 size={15} />
              </button>
              <button
                type="button"
                className={displayMode === 'table' ? 'active' : ''}
                onClick={() => setDisplayMode('table')}
                title="Vue tableau"
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {displayMode === 'cards' ? (
            <div className="fg-profile-cards">
              {profileBalances.map((profile: any) => (
                <article key={profile.id} className="fg-profile-card" style={{ border: 'none', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.1)', background: 'white' }}>
                  <header style={{ background: '#1e293b', padding: '1.25rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, textTransform: 'capitalize' }}>{profile.name.toLowerCase()}</h4>
                      <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.95rem' }}>{profile.city}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6, marginBottom: '2px' }}>MISSIONS</span>
                      <strong style={{ fontSize: '1.25rem' }}>{profile.missions}</strong>
                    </div>
                  </header>

                  <div className="fg-modal-body" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '1rem', borderRadius: '12px' }}>
                        <span style={{ display: 'block', color: '#9a3412', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>PROFIL DOIT À L'AGENCE</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {profile.profilDoitAgence > 0 && <AlertCircle size={18} color="#ea580c" />}
                          <strong style={{ fontSize: '1.35rem', color: '#c2410c' }}>{profile.profilDoitAgence > 0 ? money(profile.profilDoitAgence) : '—'}</strong>
                        </div>
                      </div>
                      <div style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '1rem', borderRadius: '12px' }}>
                        <span style={{ display: 'block', color: '#9a3412', fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>AGENCE DOIT AU PROFIL</span>
                        <strong style={{ fontSize: '1.35rem', color: '#c2410c' }}>{profile.agenceDoitProfil > 0 ? money(profile.agenceDoitProfil) : '—'}</strong>
                      </div>
                    </div>

                    <div className="fg-metric-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <TrendingUp size={18} color="#64748b" />
                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>CA total généré</span>
                          <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{money(profile.caTotal)}</strong>
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Building2 size={18} color="#64748b" />
                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Part agence cumulée</span>
                          <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{money(profile.partAgence)}</strong>
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <User size={18} color="#64748b" />
                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Part profil cumulée</span>
                          <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{money(profile.partProfil)}</strong>
                        </div>
                      </div>
                      <div style={{ background: '#fff1f2', border: '1px solid #ffe4e6', padding: '0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AlertTriangle size={18} color="#e11d48" />
                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#9f1239', fontWeight: 700 }}>TOTAL FACT. ANNULÉE</span>
                          <strong style={{ fontSize: '1rem', color: '#be123c' }}>{money(profile.factAnnulee)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Profil</th>
                    <th>Missions</th>
                    <th>CA généré</th>
                    <th>Part agence</th>
                    <th>Part profil</th>
                    <th>Versé au profil</th>
                    <th>Reçu du profil</th>
                    <th>Solde</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {profileBalances.map((profile) => (
                    <tr key={profile.id}>
                      <td>
                        {profile.key.startsWith('agent-') ? (
                          <button type="button" className="fg-link-btn" onClick={() => goToProfilDetails(profile.id)}>{profile.name}</button>
                        ) : <strong>{profile.name}</strong>}
                        <small>{profile.city} - {profile.phone}</small>
                      </td>
                      <td>{profile.missions}</td>
                      <td className="fw-semibold">{money(profile.caTotal)}</td>
                      <td className="fg-text-green fw-semibold">{money(profile.partAgence)}</td>
                      <td className="fg-text-blue fw-semibold">{money(profile.partProfil)}</td>
                      <td>{money(profile.verseAuProfil)}</td>
                      <td>{money(profile.recuDuProfil)}</td>
                      <td><span className="fg-pill fg-pill-soft-blue">À verser {money(profile.solde)}</span></td>
                      <td>
                        <button
                          className="icon-btn"
                          title="Voir"
                          onClick={() => openProfileAccountDetails(profile)}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedProfileAccount && (
        <div className="fg-profile-modal-overlay" onClick={closeProfileAccountDetails}>
          <div className="fg-profile-modal" onClick={(e) => e.stopPropagation()}>
            <header className="fg-profile-modal-header">
              <h3>Compte financier — {selectedProfileAccount.name}</h3>
              <button type="button" className="fg-profile-modal-close" onClick={closeProfileAccountDetails}>
                <X size={16} />
              </button>
            </header>

            <div className="fg-profile-modal-body">
              <div className="fg-profile-kpis-grid">
                <article className="fg-profile-kpi-card">
                  <p>Missions</p>
                  <strong>{selectedProfileAccount.missions}</strong>
                </article>
                <article className="fg-profile-kpi-card">
                  <p>CA généré</p>
                  <strong>{money(selectedProfileAccount.caTotal)}</strong>
                </article>
                <article className="fg-profile-kpi-card">
                  <p>Part agence</p>
                  <strong className="fg-text-green">{money(selectedProfileAccount.partAgence)}</strong>
                </article>
                <article className="fg-profile-kpi-card">
                  <p>Part profil</p>
                  <strong className="fg-text-blue">{money(selectedProfileAccount.partProfil)}</strong>
                </article>
              </div>

              <section className="fg-profile-current-balance">
                <div>
                  <h4>Solde actuel</h4>
                  <p>
                    {selectedProfileAccount.solde >= 0
                      ? "L'agence doit de l'argent au profil"
                      : 'Le profil doit de l\'argent a l\'agence'}
                  </p>
                </div>
                <strong>{money(Math.abs(selectedProfileAccount.solde))}</strong>
              </section>

              <div className="table-wrapper fg-profile-detail-table-wrap">
                <table className="data-table fg-profile-detail-table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Date</th>
                      <th>Client</th>
                      <th>Montant</th>
                      <th>Encaissé par</th>
                      <th>Paiement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProfileMissions.map((mission) => (
                      <tr key={mission.missionNo}>
                        <td>{shortMissionNo(mission.missionNo)}</td>
                        <td>{mission.date}</td>
                        <td>
                          {mission.clientId ? (
                            <button type="button" className="fg-link-btn" onClick={() => goToClientDetails(mission.clientId)}>{mission.client}</button>
                          ) : mission.client}
                        </td>
                        <td className="fw-semibold">{money(mission.montant)}</td>
                        <td>
                          <span className="fg-pill fg-pill-outline">{mission.encaissePar}</span>
                        </td>
                        <td>
                          <span className={paiementClass(mission.paiement)}>{paiementLabel(mission.paiement)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewMissionModal && (
        <div className="fg-modal-overlay" onClick={closeMissionModal}>
          <div className="fg-modal" onClick={(e) => e.stopPropagation()}>
            <header className="fg-modal-header">
              <div>
                <h3>Nouvelle mission</h3>
                <p>Remplissez les informations de la mission</p>
              </div>
              <button type="button" className="fg-modal-close" onClick={closeMissionModal}>
                <X size={16} />
              </button>
            </header>

            <div className="fg-modal-body">
              <div className="fg-entry-mode">
                <button
                  type="button"
                  className={entryMode === 'demande' ? 'active' : ''}
                  onClick={() => {
                    setEntryMode('demande');
                    setIsSourceOpen(false);
                    setIsEncaissementOpen(false);
                  }}
                >
                  Depuis une demande
                </button>
                <button
                  type="button"
                  className={entryMode === 'manuel' ? 'active' : ''}
                  onClick={() => {
                    setEntryMode('manuel');
                    setIsSourceOpen(false);
                    setIsEncaissementOpen(false);
                  }}
                >
                  Saisie manuelle
                </button>
              </div>

              {entryMode === 'demande' ? (
                <>
                  <div className="fg-modal-field">
                    <label>Demande source</label>
                    <div className="fg-custom-select">
                      <button
                        type="button"
                        className="fg-custom-select-trigger"
                        onClick={() => {
                          setIsSourceOpen((prev) => !prev);
                          setIsEncaissementOpen(false);
                        }}
                      >
                        <span>{selectedSource}</span>
                        <ChevronDown size={15} />
                      </button>
                      {isSourceOpen && (
                        <div className="fg-custom-select-menu">
                          {missionSourceOptions.map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`fg-custom-select-item ${selectedSource === option ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedSource(option);
                                setIsSourceOpen(false);
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="fg-modal-field">
                    <label>Profil assigné</label>
                    <label className="fg-select-wrap">
                      <select value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)}>
                        <option>Choisir un profil (optionnel)</option>
                        {missionProfileOptions.map((profile) => (
                          <option key={profile} value={profile}>{profile}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </label>
                  </div>

                  <div className="fg-modal-field fg-short-field">
                    <label>Commission agence (%)</label>
                    <input value={commission} onChange={(e) => setCommission(e.target.value)} />
                  </div>

                  <div className="fg-two-col-fields">
                    <div className="fg-modal-field">
                      <label>Mode de paiement prévu</label>
                      <label className="fg-select-wrap">
                        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                          {missionPaymentModes.map((mode) => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>

                    <div className="fg-modal-field">
                      <label>Statut mission</label>
                      <label className="fg-select-wrap">
                        <select value={missionStatus} onChange={(e) => setMissionStatus(e.target.value)}>
                          {missionStatusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="fg-two-col-fields">
                    <div className="fg-modal-field">
                      <label>Date intervention</label>
                      <div className="fg-input-with-icon">
                        <input
                          placeholder="jj/mm/aaaa"
                          value={manualDateIntervention}
                          onChange={(e) => setManualDateIntervention(e.target.value)}
                        />
                        <Calendar size={14} />
                      </div>
                    </div>
                    <div className="fg-modal-field">
                      <label>Profil</label>
                      <label className="fg-select-wrap">
                        <select value={manualProfileType} onChange={(e) => setManualProfileType(e.target.value)}>
                          {profileTypeOptions.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                  </div>

                  <div className="fg-modal-field">
                    <label>Nom du client</label>
                    <input
                      placeholder="Nom complet du client"
                      value={manualClientName}
                      onChange={(e) => setManualClientName(e.target.value)}
                    />
                  </div>

                  <div className="fg-modal-field">
                    <label>Ville</label>
                    <input value={manualCity} onChange={(e) => setManualCity(e.target.value)} />
                  </div>

                  <div className="fg-two-col-fields">
                    <div className="fg-modal-field">
                      <label>Type de service</label>
                      <label className="fg-select-wrap">
                        <select
                          value={manualServiceType}
                          onChange={(e) => setManualServiceType(e.target.value)}
                        >
                          {availableManualServices.map((service) => (
                            <option key={service} value={service}>{service}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                    <div className="fg-modal-field">
                      <label>Segment</label>
                      <label className="fg-select-wrap">
                        <select
                          value={manualSegment}
                          onChange={(e) => {
                            const nextSegment = e.target.value as 'Particulier' | 'Entreprise';
                            setManualSegment(nextSegment);
                            setManualServiceType(servicesBySegment[nextSegment][0]);
                          }}
                        >
                          {segmentOptions.map((segment) => (
                            <option key={segment} value={segment}>{segment}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                  </div>

                  <div className="fg-modal-field">
                    <label>Profil assigné</label>
                    <label className="fg-select-wrap">
                      <select value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)}>
                        <option>Choisir un profil (optionnel)</option>
                        {missionProfileOptions.map((profile) => (
                          <option key={profile} value={profile}>{profile}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </label>
                  </div>

                  <div className="fg-two-col-fields">
                    <div className="fg-modal-field">
                      <label>Montant total (MAD)</label>
                      <input value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
                    </div>
                    <div className="fg-modal-field">
                      <label>Commission agence (%)</label>
                      <input value={commission} onChange={(e) => setCommission(e.target.value)} />
                    </div>
                  </div>

                  <div className="fg-two-col-fields">
                    <div className="fg-modal-field">
                      <label>Mode de paiement prévu</label>
                      <label className="fg-select-wrap">
                        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                          {missionPaymentModes.map((mode) => (
                            <option key={mode} value={mode}>{mode}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                    <div className="fg-modal-field">
                      <label>Statut mission</label>
                      <label className="fg-select-wrap">
                        <select value={missionStatus} onChange={(e) => setMissionStatus(e.target.value)}>
                          {missionStatusOptions.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div className="fg-modal-field">
                <label>Encaissement par</label>
                <div className="fg-custom-select">
                  <button
                    type="button"
                    className="fg-custom-select-trigger"
                    onClick={() => {
                      setIsEncaissementOpen((prev) => !prev);
                      setIsSourceOpen(false);
                    }}
                  >
                    <span>{encaissementPar}</span>
                    <ChevronDown size={15} />
                  </button>
                  {isEncaissementOpen && (
                    <div className="fg-custom-select-menu compact">
                      {encaissementOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`fg-custom-select-item ${encaissementPar === option ? 'selected' : ''}`}
                          onClick={() => {
                            setEncaissementPar(option);
                            setIsEncaissementOpen(false);
                          }}
                        >
                          {encaissementPar === option ? <Check size={15} /> : <span className="fg-check-placeholder" />}
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className="fg-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeMissionModal}>Annuler</button>
              <button type="button" className="btn btn-primary">Créer la mission</button>
            </footer>
          </div>
        </div>
      )}

      {selectedMission && (
        <div className="fg-mission-modal-overlay" onClick={closeMissionDetails}>
          <div className="fg-mission-modal" onClick={(e) => e.stopPropagation()}>
            <header className="fg-mission-header">
              <div>
                <div className="fg-mission-top-row">
                  <span className="fg-mission-ref">{selectedMission.missionNo}</span>
                  <span className={statutClass(selectedMission.statut)}>{selectedMission.statut}</span>
                </div>
                <h3>{selectedMission.client}</h3>
                <div className="fg-mission-meta">
                  <span><Calendar size={13} /> {selectedMission.date}</span>
                  <span><MapPin size={13} /> {selectedMission.ville}</span>
                  <span><User size={13} /> {selectedMission.profil}</span>
                </div>
              </div>
              <button type="button" className="fg-modal-close" onClick={closeMissionDetails}>
                <X size={16} />
              </button>
            </header>

            <div className="fg-mission-kpis">
              <div>
                <p>Montant HT</p>
                <strong>{money(selectedMission.tvaActive ? Number((selectedMission.montant / 1.2).toFixed(2)) : selectedMission.montant)}</strong>
              </div>
              <div>
                <p>TVA</p>
                <strong className="fg-text-orange">{selectedMission.tvaActive ? money(Number((selectedMission.montant - Number((selectedMission.montant / 1.2).toFixed(2))).toFixed(2))) : money(0)}</strong>
              </div>
              <div>
                <p>Montant TTC</p>
                <strong className="fg-text-blue">{money(selectedMission.montant)}</strong>
              </div>
              <div>
                <p>Commission</p>
                <strong>{selectedMission.statut === 'Facturation annulée' || selectedMission.montant === 0 ? '0%' : Math.round((selectedMission.partAgence / selectedMission.montant) * 100) + '%'}</strong>
              </div>
            </div>

            <div className="fg-mission-tabs">
              <button className={missionDetailTab === 'infos' ? 'active' : ''} onClick={() => setMissionDetailTab('infos')}>Informations</button>
              <button className={missionDetailTab === 'paiement' ? 'active' : ''} onClick={() => setMissionDetailTab('paiement')}>Paiement</button>
              <button className={missionDetailTab === 'repartition' ? 'active' : ''} onClick={() => setMissionDetailTab('repartition')}>Répartition interne</button>
            </div>

            <div className="fg-mission-content">
              {missionDetailTab === 'infos' && (
                <>
                  <div className="fg-mission-info-grid">
                    <div className="fg-mission-info-card">
                      <span>Commercial</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong>{selectedMission.commercialName || '—'}</strong>
                        <button
                          className="fg-btn-mini"
                          onClick={() => {
                            // On ouvre la modale de modification directement
                            openMissionEditModal(selectedMission);
                          }}
                          title="Modifier le commercial"
                          style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="fg-mission-info-card"><span>Type de service</span><strong>{selectedMission.service}</strong></div>
                    <div className="fg-mission-info-card"><span>Segment</span><strong>{selectedMission.segment}</strong></div>
                    <div className="fg-mission-info-card"><span>Mode de paiement</span><strong>{selectedMission.modePaiement}</strong></div>
                    <div className="fg-mission-info-card"><span>Encaissement par</span><strong>{selectedMission.encaissePar === 'Agence' ? "L'agence" : 'Le profil'}</strong></div>
                    <div className="fg-mission-info-card"><span>Profil assigné</span><strong>{selectedMission.profil}</strong></div>
                  </div>
                  <div className="fg-mission-status-box">
                    <p>Statut paiement</p>
                    <div>
                      <span className={paiementClass(selectedMission.paiement)}>{selectedMission.paiement.replace('_', ' ')}</span>
                      <span>Encaissé : {money(selectedMission.montantPaye ?? 0)} / {money(selectedMission.montant)}</span>
                    </div>
                  </div>
                </>
              )}

              {missionDetailTab === 'paiement' && (
                <div className="fg-mission-info-grid two-col">
                  <div className="fg-mission-info-card"><span>Montant payé</span><strong>{money(selectedMission.montantPaye ?? 0)}</strong></div>
                  <div className="fg-mission-info-card"><span>Reste à payer</span><strong className="fg-text-orange">{money(Math.max(selectedMission.montant - (selectedMission.montantPaye ?? 0), 0))}</strong></div>
                  <div className="fg-mission-info-card"><span>Statut du paiement</span><strong>{paiementLabel(selectedMission.paiement)}</strong></div>
                  <div className="fg-mission-info-card"><span>Mode de paiement</span><strong>{selectedMission.modePaiementReel ?? '—'}</strong></div>
                  <div className="fg-mission-info-card"><span>Date de paiement</span><strong>{selectedMission.datePaiement ?? '—'}</strong></div>
                </div>
              )}

              {missionDetailTab === 'repartition' && (
                <>
                  <div className="fg-mission-share-grid">
                    <div className="fg-mission-share-card agency"><span>Part agence</span><strong>{money(selectedMission.partAgence)}</strong></div>
                    <div className="fg-mission-share-card profile"><span>Part profil {selectedMission.parts_repartition && selectedMission.parts_repartition.length > 1 ? '(Total)' : ''}</span><strong>{money(selectedMission.partProfil)}</strong></div>
                  </div>
                  <div className="fg-mission-internal-box" style={{ padding: '1rem', border: '1px solid #1E293B', borderRadius: '4px', marginTop: '1rem' }}>
                    <h4>Répartition et encaissement</h4>
                    {selectedMission.parts_repartition && selectedMission.parts_repartition.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                        {selectedMission.parts_repartition.map((p, idx) => {
                          const agentName = p.profile_name || agents.find(a => a.id === Number(p.profile_id))?.full_name || agents.find(a => a.id === Number(p.profile_id)) ? `${agents.find(a => a.id === Number(p.profile_id))?.first_name} ${agents.find(a => a.id === Number(p.profile_id))?.last_name}` : `Profil ${p.profile_id}`;
                          return (
                            <div key={idx} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                              <div>
                                <p style={{ margin: 0, fontWeight: 'bold' }}>{agentName}</p>
                                <p style={{ margin: 0, fontSize: '0.85em', color: '#94a3b8' }}>Montant: {money(p.amount)}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ margin: 0, fontSize: '0.85em', color: p.part_profil_versee ? '#10b981' : '#f43f5e' }}>
                                  {p.part_profil_versee ? 'Versée' : 'Non versée'}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.85em', color: '#94a3b8' }}>
                                  {p.date_versement_profil ? p.date_versement_profil : '—'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                        <div><p style={{ margin: 0, color: '#94a3b8' }}>Paiement encaissé par</p><strong style={{ color: '#fff' }}>{selectedMission.encaissePar === 'Agence' ? "L'agence" : 'Le profil'}</strong></div>
                        <div><p style={{ margin: 0, color: '#94a3b8' }}>Part profil versée</p><strong style={{ color: '#fff' }}>{selectedMission.partProfilVersee ? 'Oui' : 'Non'}</strong></div>
                        <div><p style={{ margin: 0, color: '#94a3b8' }}>Date versement profil</p><strong style={{ color: '#fff' }}>{selectedMission.dateVersementProfil ?? '—'}</strong></div>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>

            <footer className="fg-mission-footer">
              <button type="button" className="btn btn-secondary" onClick={() => openMissionEditModal()}>Modifier</button>
              <button type="button" className="btn btn-secondary" onClick={handleGenerateInvoicePreview} disabled={isGeneratingInvoice}>
                {isGeneratingInvoice ? 'Génération...' : 'Générer la facture'}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSendInvoice} disabled={!invoicePreview || isSendingInvoice}>
                {isSendingInvoice ? 'Envoi...' : 'Envoyer au client'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeMissionDetails}>Fermer</button>
            </footer>
          </div>
        </div>
      )}

      {showInvoicePreviewPopup && invoicePreview && (
        <div className="modal-overlay z-[100]" onClick={() => setShowInvoicePreviewPopup(false)}>
          <div
            className="modal-content max-w-[1200px]"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '95%', height: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', padding: '24px' }}
          >
            <div className="modal-header border-b-0 pb-2 mb-4 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-teal-900">
                <Eye size={24} className="text-teal-700" /> Aperçu — {invoicePreview.type === 'devis' ? 'Devis' : (invoicePreview.type === 'facture' ? 'Facture' : 'Récapitulatif')}
              </h2>
              <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowInvoicePreviewPopup(false)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body bg-slate-800 rounded-md border border-slate-700 shadow-inner" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
              {invoicePreview.type === 'devis' || invoicePreview.type === 'facture' ? (
                <iframe src={invoicePreview.url} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="Apercu" />
              ) : (
                <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '24px', backgroundColor: '#ffffff' }}>
                  <img src={invoicePreview.url} alt="Recapitulatif" style={{ maxWidth: '100%', width: 'auto', height: 'auto', objectFit: 'contain', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: '8px', display: 'block' }} />
                </div>
              )}
            </div>

            <div className="modal-footer border-t-0 pt-0 mt-6 bg-white flex justify-center sm:justify-end gap-3 flex-wrap">
              <button className="btn transition-all" style={{ border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#475569', fontWeight: 500, padding: '10px 24px', borderRadius: '6px' }} onClick={() => setShowInvoicePreviewPopup(false)}>
                Fermer
              </button>
              <a href={invoicePreview.url} download={invoicePreview.name} target="_blank" rel="noreferrer" className="btn transition-all flex items-center gap-2" style={{ backgroundColor: '#f1f5f9', color: '#0f766e', fontWeight: 500, padding: '10px 24px', borderRadius: '6px', border: 'none' }}>
                <Download size={18} /> Télécharger
              </a>
              <button
                className="btn transition-all flex items-center gap-2"
                style={{ backgroundColor: '#0f766e', color: 'white', fontWeight: 500, padding: '10px 24px', borderRadius: '6px', border: 'none', opacity: isSendingInvoice ? 0.7 : 1 }}
                onClick={handleSendInvoice}
                disabled={isSendingInvoice}
              >
                {isSendingInvoice ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                {isSendingInvoice ? 'Envoi...' : 'Envoyer au client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMissionEditModal && selectedMission && (
        <div className="fg-mission-modal-overlay" onClick={closeMissionEditModal}>
          <div className="fg-edit-modal" onClick={(e) => e.stopPropagation()}>
            <header className="fg-edit-header">
              <div>
                <h3>Modifier - {selectedMission.missionNo}</h3>
                <p>{selectedMission.client}</p>
              </div>
              <button type="button" className="fg-modal-close" onClick={closeMissionEditModal}>
                <X size={16} />
              </button>
            </header>

            <div className="fg-edit-body">
              {(() => {
                const ht = Number(missionEditForm.montantHt) || 0;
                const tvaRateNum = Number(missionEditForm.tvaRate) || 0;
                const tvaValue = ht * (tvaRateNum / 100);
                const ttc = ht + tvaValue;
                const montantPaye = Number(missionEditForm.montantPaye) || 0;
                const reste = Math.max(ttc - montantPaye, 0);

                return (
                  <>
                    <div className="fg-edit-summary">
                      <p>Montant HT : <strong>{money(ht)}</strong></p>
                      <p>TVA ({missionEditForm.tvaRate}%) : <strong>{money(tvaValue)}</strong></p>
                      <p>Montant TTC : <strong>{money(ttc)}</strong></p>
                      <p>Commission : <strong>{missionEditForm.commission}%</strong></p>
                    </div>

                    <div className="fg-two-col-fields">
                      <div className="fg-modal-field">
                        <label>Commercial</label>
                        <label className="fg-select-wrap">
                          <select
                            value={missionEditForm.commercialName}
                            onChange={(e) => setMissionEditForm((prev) => ({ ...prev, commercialName: e.target.value }))}
                          >
                            <option value="">Choisir un commercial</option>
                            {commerciaux.map((c) => (
                              <option key={c.id} value={c.full_name || `${c.first_name} ${c.last_name}`}>
                                {c.full_name || `${c.first_name} ${c.last_name}`}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={14} />
                        </label>
                      </div>
                      <div className="fg-modal-field">
                        <label>TVA %</label>
                        <input
                          type="number"
                          value={missionEditForm.tvaRate}
                          onChange={(e) => setMissionEditForm((prev) => ({ ...prev, tvaRate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="fg-modal-field">
                      <label>Commentaire</label>
                      <textarea
                        className="fg-edit-textarea"
                        style={{ width: '100%', minHeight: '80px', padding: '0.6rem', borderRadius: '8px', border: '1px solid #d4e2e0' }}
                        value={missionEditForm.commentaire}
                        onChange={(e) => setMissionEditForm((prev) => ({ ...prev, commentaire: e.target.value }))}
                        placeholder="Commentaire sur la facture..."
                      />
                    </div>

                    <div className="fg-edit-section-title">💳 Paiement</div>
                    <div className="fg-two-col-fields">
                      <div className="fg-modal-field">
                        <label>Montant payé</label>
                        <input
                          type="number"
                          value={missionEditForm.montantPaye}
                          onChange={(e) => setMissionEditForm((prev) => ({ ...prev, montantPaye: e.target.value }))}
                        />
                        <div style={{ color: '#c27803', fontSize: '0.85rem', fontWeight: '600', marginTop: '4px' }}>
                          Reste : {money(reste)}
                        </div>
                      </div>
                      <div className="fg-modal-field">
                        <label>Mode de paiement</label>
                        <label className="fg-select-wrap">
                          <select
                            value={missionEditForm.modePaiementReel}
                            onChange={(e) => setMissionEditForm((prev) => ({ ...prev, modePaiementReel: e.target.value }))}
                          >
                            {missionPaymentModes.map((mode) => (
                              <option key={mode} value={mode}>{mode}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} />
                        </label>
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="fg-two-col-fields">
                <div className="fg-modal-field">
                  <label>Date de paiement</label>
                  <div className="fg-input-with-icon">
                    <input
                      type="date"
                      value={missionEditForm.datePaiement}
                      onChange={(e) => setMissionEditForm((prev) => ({ ...prev, datePaiement: e.target.value }))}
                    />
                    <Calendar size={14} />
                  </div>
                </div>
                <div className="fg-modal-field">
                  <label>Statut de paiement</label>
                  <label className="fg-select-wrap">
                    <select
                      value={missionEditForm.statutPaiement}
                      onChange={(e) => setMissionEditForm((prev) => ({ ...prev, statutPaiement: e.target.value }))}
                    >
                      {paymentStatusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                </div>
              </div>

              <div className="fg-modal-field">
                <label>Justificatif</label>
                <label className="fg-file-input">
                  <input
                    type="file"
                    onChange={(e) => {
                      const name = e.target.files?.[0]?.name ?? 'Aucun fichier choisi';
                      setMissionEditForm((prev) => ({ ...prev, justificatifName: name }));
                    }}
                  />
                  <span className="fg-file-input-btn">Choisir un fichier</span>
                  <span className="fg-file-input-name">{missionEditForm.justificatifName}</span>
                </label>
              </div>

              <div className="fg-edit-section-title">🔁 Répartition interne</div>
              {missionEditForm.partsRepartition && missionEditForm.partsRepartition.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '1rem' }}>
                  {missionEditForm.partsRepartition.map((part, index) => (
                    <div key={index} style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '4px' }}>
                      <div className="fg-two-col-fields">
                        <div className="fg-modal-field">
                          <label>Profil</label>
                          <input value={part.profile_name || `Profil ${part.profile_id}`} disabled />
                        </div>
                        <div className="fg-modal-field">
                          <label>Montant</label>
                          <input
                            type="number"
                            value={part.amount || 0}
                            onChange={(e) => {
                              const newParts = [...missionEditForm.partsRepartition!];
                              newParts[index].amount = Number(e.target.value);
                              setMissionEditForm(prev => ({ ...prev, partsRepartition: newParts }));
                            }}
                          />
                        </div>
                      </div>
                      <div className="fg-two-col-fields">
                        <div className="fg-modal-field">
                          <label>Part profil versée ?</label>
                          <label className="fg-select-wrap">
                            <select
                              value={part.part_profil_versee ? 'Oui' : 'Non'}
                              onChange={(e) => {
                                const newParts = [...missionEditForm.partsRepartition!];
                                newParts[index].part_profil_versee = e.target.value === 'Oui';
                                setMissionEditForm(prev => ({ ...prev, partsRepartition: newParts }));
                              }}
                            >
                              <option>Oui</option>
                              <option>Non</option>
                            </select>
                            <ChevronDown size={14} />
                          </label>
                        </div>
                        <div className="fg-modal-field">
                          <label>Date versement</label>
                          <div className="fg-input-with-icon">
                            <input
                              type="date"
                              value={part.date_versement_profil || ''}
                              onChange={(e) => {
                                const newParts = [...missionEditForm.partsRepartition!];
                                newParts[index].date_versement_profil = e.target.value;
                                setMissionEditForm(prev => ({ ...prev, partsRepartition: newParts }));
                              }}
                            />
                            <Calendar size={14} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="fg-two-col-fields">
                    <div className="fg-modal-field">
                      <label>Encaissé par</label>
                      <label className="fg-select-wrap">
                        <select
                          value={missionEditForm.encaissePar}
                          onChange={(e) => setMissionEditForm((prev) => ({
                            ...prev,
                            encaissePar: e.target.value as 'Agence' | 'Profil',
                          }))}
                        >
                          <option value="Agence">Agence</option>
                          <option value="Profil">Profil</option>
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>

                    {missionEditForm.encaissePar === 'Profil' && (
                      <div className="fg-modal-field">
                        <label>Montant encaissé par le profil</label>
                        <input
                          value={missionEditForm.montantEncaisseProfil}
                          onChange={(e) => setMissionEditForm((prev) => ({ ...prev, montantEncaisseProfil: e.target.value }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="fg-two-col-fields">
                    <div className="fg-modal-field">
                      <label>{missionEditForm.encaissePar === 'Profil' ? 'Part agence reversée ?' : 'Part profil versée ?'}</label>
                      <label className="fg-select-wrap">
                        <select
                          value={missionEditForm.partProfilVersee}
                          onChange={(e) => setMissionEditForm((prev) => ({
                            ...prev,
                            partProfilVersee: e.target.value as 'Oui' | 'Non',
                          }))}
                        >
                          <option>Oui</option>
                          <option>Non</option>
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>

                    <div className="fg-modal-field">
                      <label>{missionEditForm.encaissePar === 'Profil' ? "Date remise à l'agence" : 'Date versement au profil'}</label>
                      <div className="fg-input-with-icon">
                        <input
                          type="date"
                          value={missionEditForm.dateVersementProfil}
                          onChange={(e) => setMissionEditForm((prev) => ({ ...prev, dateVersementProfil: e.target.value }))}
                        />
                        <Calendar size={14} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <footer className="fg-edit-footer">
              <button type="button" className="btn btn-secondary" onClick={closeMissionEditModal} disabled={isSavingMissionEdit}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveMissionEdit} disabled={isSavingMissionEdit}>Enregistrer</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
