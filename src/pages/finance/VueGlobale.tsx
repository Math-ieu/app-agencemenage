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
} from 'lucide-react';
import { fetchSecureDocBlob, generateDocument, getAgents, getMissions, sendWhatsApp, updateMission } from '../../api/client';
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
const paymentStatusOptions = ['Non payé', 'Paiement en attente', 'Paiement effectué'];

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

const reglementClass = (value: string): string => (value === 'Réglé' ? 'fg-pill fg-pill-lime' : 'fg-pill fg-pill-yellow');

const paiementLabel = (value: FacturationRow['paiement']): string => {
  if (value === 'partiellement_paye') return 'partiellement payé';
  return value.replace('_', ' ');
};

const shortMissionNo = (missionNo: string): string => {
  const match = missionNo.match(/(\d+)$/);
  if (!match) return missionNo;
  return `M-${parseInt(match[1], 10)}`;
};

const reglementDetail = (row: FacturationRow): string => {
  if (row.reglementInterne === 'Réglé') {
    return row.encaissePar === 'Agence'
      ? `Agence -> Profil : ${money(row.partProfil)}`
      : `Profil -> Agence : ${money(row.partAgence)}`;
  }

  return row.encaissePar === 'Agence'
    ? `Agence doit ${money(row.partProfil)}`
    : `Profil doit ${money(row.partAgence)}`;
};

const creditPaymentLabel = (row: FacturationRow): 'Payé' | 'Non payé' => {
  if (row.encaissePar === 'Agence') {
    return row.partProfilVersee ? 'Payé' : 'Non payé';
  }

  return row.partProfilVersee ? 'Payé' : 'Non payé';
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
  if (row.encaissePar !== 'Agence') return 0;
  const due = Number((getMontantPaye(row) * 0.5).toFixed(2));
  if (due > 0) return Math.min(row.partProfil, due);

  // Fallback for legacy rows where paid amounts were not filled yet.
  if (row.statut !== 'Facturation annulée') return row.partProfil;
  return 0;
};

const getPartAgenceDueFromProfil = (row: FacturationRow): number => {
  if (row.encaissePar !== 'Profil') return 0;
  const due = Number((getMontantEncaisseProfil(row) * 0.5).toFixed(2));
  if (due > 0) return Math.min(row.partAgence, due);

  // Fallback for legacy rows where collected profile amount is missing.
  if (row.statut !== 'Facturation annulée') return row.partAgence;
  return 0;
};

const getCommissionAgenceEncaissee = (row: FacturationRow): number => {
  if (row.encaissePar === 'Agence') {
    const partProfilDue = getPartProfilDueFromAgence(row);
    return Math.max(getMontantPaye(row) - partProfilDue, 0);
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

const paiementStatusCodeFromLabel = (value: string): 'non_paye' | 'en_attente' | 'effectue' => {
  if (value === 'Paiement effectué') return 'effectue';
  if (value === 'Paiement en attente') return 'en_attente';
  return 'non_paye';
};

const mapMissionToFacturationRow = (item: MissionApiItem): FacturationRow => {
  const demande = item.demande_detail;
  const agent = item.agent_detail;
  const montant = Number(demande?.prix ?? 0);
  const partAgence = Number((montant * 0.5).toFixed(2));
  const partProfil = Number((montant - partAgence).toFixed(2));
  const rawMontantPaye = item.montant_paye !== undefined ? Number(item.montant_paye) : 0;
  const statutPaiement = item.paiement_client_statut
    || (rawMontantPaye >= montant && montant > 0
      ? 'effectue'
      : rawMontantPaye > 0
        ? 'en_attente'
        : 'non_paye');
  const paiement: FacturationRow['paiement'] =
    statutPaiement === 'effectue'
      ? 'paye'
      : statutPaiement === 'en_attente'
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

  const encaissePar: FacturationRow['encaissePar'] = item.encaisse_par === 'profil' || demande?.mode_paiement === 'sur_place' ? 'Profil' : 'Agence';
  const partProfilVersee = encaissePar === 'Agence'
    ? (item.part_profil_versee ?? false)
    : (item.part_agence_reversee ?? false);

  const montantPaye = item.montant_paye !== undefined
    ? Number(item.montant_paye)
    : paiement === 'paye'
      ? montant
      : paiement === 'partiellement_paye'
        ? Number((montant * 0.5).toFixed(2))
        : 0;

  const montantEncaisseProfil = encaissePar === 'Profil'
    ? (item.montant_encaisse_profil !== undefined ? Number(item.montant_encaisse_profil) : montantPaye)
    : 0;

  const reglementInterne = partProfilVersee ? 'Réglé' : 'Non réglé';

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
    modePaiement: demande?.mode_paiement_label || modeLabelFromCode(item.mode_paiement_reel),
    partAgence,
    partProfil,
    encaissePar,
    paiement,
    statut,
    reglementInterne,
    montantPaye,
    montantEncaisseProfil,
    datePaiement: item.date_paiement ? formatDateFR(item.date_paiement) : (paiement === 'non_paye' ? '—' : formatDateFR(demande?.date_intervention)),
    modePaiementReel: modeLabelFromCode(item.mode_paiement_reel) || demande?.mode_paiement_label || '—',
    commercialName: demande?.assigned_to_name || '—',
    partProfilVersee,
    dateVersementProfil: encaissePar === 'Agence'
      ? (item.date_versement_profil ? formatDateFR(item.date_versement_profil) : '—')
      : (item.date_remise_agence ? formatDateFR(item.date_remise_agence) : '—'),
  };
};

export default function VueGlobale() {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
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
  const [creditPaymentFilter, setCreditPaymentFilter] = useState<'Non payé' | 'Payé' | 'Tous'>('Non payé');
  const [suiviDateFrom, setSuiviDateFrom] = useState('');
  const [suiviDateTo, setSuiviDateTo] = useState('');
  const [suiviStatutFilter, setSuiviStatutFilter] = useState('Tous les statuts');
  const [suiviPaiementFilter, setSuiviPaiementFilter] = useState('Tous les paiements');
  const [suiviSegmentFilter, setSuiviSegmentFilter] = useState('Tous les segments');
  const [facturationData, setFacturationData] = useState<FacturationRow[]>([]);
  const [profileAccountsData, setProfileAccountsData] = useState<ProfileAccount[]>([]);
  const [invoicePreview, setInvoicePreview] = useState<{ url: string; type: 'devis' | 'png'; name: string; demandeId: number } | null>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [showInvoicePreviewPopup, setShowInvoicePreviewPopup] = useState(false);

  const loadFinanceData = useCallback(async () => {
    const missions: MissionApiItem[] = [];
    const agents: AgentApiItem[] = [];

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
      // Missions can fail independently; keep profiles load running.
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
      // Agents can fail due to permissions; UI will still show mission-derived accounts.
    }

    setFacturationData(missions.map(mapMissionToFacturationRow));

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
        });
      }
    }

    for (const item of missions) {
      const profileName = item.agent_detail?.full_name || 'Profil inconnu';
      const profileId = item.agent_detail?.id;
      const accountKey = profileId ? `agent-${profileId}` : `mission-${profileName}`;
      const montant = Number(item.demande_detail?.prix ?? 0);
      const partAgence = Number((montant * 0.5).toFixed(2));
      const partProfil = Number((montant - partAgence).toFixed(2));

      if (!grouped.has(accountKey)) {
        grouped.set(accountKey, {
          id: profileId ?? grouped.size + 1,
          key: accountKey,
          name: profileName,
          city: item.agent_detail?.city || 'Casablanca',
          phone: item.agent_detail?.phone || '—',
          missions: 0,
          caTotal: 0,
          partAgence: 0,
          partProfil: 0,
          verseAuProfil: 0,
          recuDuProfil: 0,
        });
      }

      const profile = grouped.get(accountKey)!;
      profile.missions += 1;
      profile.caTotal += montant;
      profile.partAgence += partAgence;
      profile.partProfil += partProfil;

      const encaissePar = item.encaisse_par === 'profil' || item.demande_detail?.mode_paiement === 'sur_place' ? 'Profil' : 'Agence';
      if (encaissePar === 'Agence') {
        if (item.part_profil_versee) {
          const montantPaye = item.montant_paye !== undefined ? Number(item.montant_paye) : montant;
          const partProfilDue = Math.min(partProfil, Number((montantPaye * 0.5).toFixed(2)));
          profile.verseAuProfil += partProfilDue;
        }
      } else if (item.part_agence_reversee) {
        const montantEncaisseProfil = item.montant_encaisse_profil !== undefined
          ? Number(item.montant_encaisse_profil)
          : (item.montant_paye !== undefined ? Number(item.montant_paye) : montant);
        const partAgenceDue = Math.min(partAgence, Number((montantEncaisseProfil * 0.5).toFixed(2)));
        profile.recuDuProfil += partAgenceDue;
      }
    }

    const accounts = Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    setProfileAccountsData(accounts);
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
    if (suiviStatutFilter === 'Facturation annulée') {
      return facturationData.filter((row) => row.statut === 'Facturation annulée');
    }
    return facturationData.filter((row) => row.statut !== 'Facturation annulée');
  }, [facturationData, suiviStatutFilter]);

  const filteredSuiviRows = useMemo(() => {
    return suiviBaseRows.filter((row) => {
      if (suiviSegmentFilter !== 'Tous les segments' && row.segment !== suiviSegmentFilter) return false;

      if (suiviStatutFilter !== 'Tous les statuts' && row.statut !== suiviStatutFilter) return false;

      if (suiviPaiementFilter === 'Non payé' && row.paiement !== 'non_paye') return false;
      if (suiviPaiementFilter === 'Paiement en attente' && row.paiement !== 'partiellement_paye') return false;
      if (suiviPaiementFilter === 'Paiement effectué' && row.paiement !== 'paye') return false;

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
  }, [suiviBaseRows, suiviDateFrom, suiviDateTo, suiviPaiementFilter, suiviSearch, suiviSegmentFilter, suiviStatutFilter]);

  const agenceNonPayeAmount = useMemo(
    () => facturationData
      .filter((row) => row.encaissePar === 'Profil' && row.reglementInterne !== 'Réglé')
      .reduce((sum, row) => sum + getPartAgenceDueFromProfil(row), 0),
    [facturationData]
  );

  const profilNonPayeAmount = useMemo(
    () => facturationData
      .filter((row) => row.encaissePar === 'Agence' && row.reglementInterne !== 'Réglé')
      .reduce((sum, row) => sum + getPartProfilDueFromAgence(row), 0),
    [facturationData]
  );

  const profileBalances = useMemo<ProfileBalance[]>(
    () =>
      profileAccountsData
        .map((profile) => ({
          ...profile,
          solde: profile.partProfil - profile.verseAuProfil - profile.recuDuProfil,
        }))
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
    const totalFacture = filteredSuiviRows.filter((row) => row.paiement === 'paye').length;
    const chiffreAffaires = filteredSuiviRows.reduce((sum, row) => sum + (row.montantPaye ?? 0), 0);
    const commissionEncaissementAgence = filteredSuiviRows.reduce((sum, row) => {
      if (row.encaissePar !== 'Agence') return sum;
      const partProfilDue = getPartProfilDueFromAgence(row);
      return sum + Math.max(getMontantPaye(row) - partProfilDue, 0);
    }, 0);
    const commissionEncaissementProfil = filteredSuiviRows.reduce((sum, row) => {
      if (row.encaissePar !== 'Profil' || row.reglementInterne !== 'Réglé') return sum;
      return sum + getPartAgenceDueFromProfil(row);
    }, 0);
    const commissionAgence = commissionEncaissementAgence + commissionEncaissementProfil;

    // Pending only tracks partial/waiting statuses. Non confirme + Paye are excluded.
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
    const missions = periodFilteredRows.filter((row) => row.statut !== 'Facturation annulée').length;
    const chiffreAffaires = periodFilteredRows.reduce((sum, row) => sum + (row.montantPaye ?? 0), 0);
    const commissionEncaissementAgence = periodFilteredRows.reduce((sum, row) => {
      if (row.encaissePar !== 'Agence') return sum;
      const partProfilDue = getPartProfilDueFromAgence(row);
      return sum + Math.max(getMontantPaye(row) - partProfilDue, 0);
    }, 0);
    const commissionEncaissementProfil = periodFilteredRows.reduce((sum, row) => {
      if (row.encaissePar !== 'Profil' || row.reglementInterne !== 'Réglé') return sum;
      return sum + getPartAgenceDueFromProfil(row);
    }, 0);
    const commissionAgence = commissionEncaissementAgence + commissionEncaissementProfil;
    const facturationAnnulee = periodFilteredRows
      .filter((row) => row.statut === 'Facturation annulée' && row.partProfilVersee)
      .reduce((sum, row) => sum + row.partProfil, 0);

    return { missions, chiffreAffaires, commissionAgence, facturationAnnulee };
  }, [periodFilteredRows]);

  const debitRows = useMemo(
    () => facturationData.filter((row) => row.encaissePar === 'Profil'),
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

      if (debitMissionFilter === 'Facturation annulée' && row.statut !== 'Facturation annulée') return false;
      if (debitMissionFilter === 'Facturée' && row.statut === 'Facturation annulée') return false;

      if (debitSearch.trim()) {
        const needle = debitSearch.toLowerCase();
        const haystack = `${row.client} ${row.profil} ${row.ville}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      return true;
    });
  }, [debitDateFrom, debitDateTo, debitMissionFilter, debitPaymentFilter, debitRows, debitSearch, debitSegmentFilter]);

  const creditRows = useMemo(
    () => facturationData.filter((row) => row.encaissePar === 'Agence'),
    [facturationData]
  );

  const filteredCreditRows = useMemo(() => {
    return creditRows.filter((row) => {
      if (creditPaymentFilter === 'Tous') return true;
      return creditPaymentLabel(row) === creditPaymentFilter;
    });
  }, [creditRows, creditPaymentFilter]);

  const debitTotal = useMemo(
    () => filteredDebitRows.reduce((sum, row) => sum + getPartAgenceDueFromProfil(row), 0),
    [filteredDebitRows]
  );

  const debitProfilesCount = useMemo(
    () => new Set(filteredDebitRows.map((row) => row.profilId || row.profil)).size,
    [filteredDebitRows]
  );

  const creditTotal = useMemo(
    () => filteredCreditRows.reduce((sum, row) => sum + getPartProfilDueFromAgence(row), 0),
    [filteredCreditRows]
  );

  const agenceNonPayeByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of facturationData) {
      if (row.encaissePar !== 'Profil' || row.reglementInterne === 'Réglé') continue;
      map.set(row.profil, (map.get(row.profil) || 0) + getPartAgenceDueFromProfil(row));
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [facturationData]);

  const profilNonPayeByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of facturationData) {
      if (row.encaissePar !== 'Agence' || row.reglementInterne === 'Réglé') continue;
      map.set(row.profil, (map.get(row.profil) || 0) + getPartProfilDueFromAgence(row));
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [facturationData]);

  const globalTableTotals = useMemo(() => {
    return globalTableRows.reduce(
      (acc, row) => {
        if (row.encaissePar === 'Profil') acc.debit += getPartAgenceDueFromProfil(row);
        if (row.encaissePar === 'Agence') acc.credit += getPartProfilDueFromAgence(row);
        acc.commission += getCommissionAgenceEncaissee(row);
        return acc;
      },
      { debit: 0, credit: 0, commission: 0 }
    );
  }, [globalTableRows]);

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

  const openMissionEditModal = () => {
    if (!selectedMission) return;
    const mappedStatutPaiement =
      selectedMission.paiement === 'paye'
        ? 'Paiement effectué'
        : selectedMission.paiement === 'partiellement_paye'
          ? 'Paiement en attente'
          : 'Non payé';

    setMissionEditForm({
      statutMission: selectedMission.statut,
      commission: '50',
      montantPaye: String(selectedMission.montantPaye ?? 0),
      montantEncaisseProfil: selectedMission.encaissePar === 'Profil'
        ? String(selectedMission.montantPaye ?? selectedMission.montant)
        : '0',
      modePaiementReel: selectedMission.modePaiementReel ?? 'Choisir',
      datePaiement: formatDateISO(selectedMission.datePaiement),
      statutPaiement: mappedStatutPaiement,
      justificatifName: 'Aucun fichier choisi',
      encaissePar: selectedMission.encaissePar,
      partProfilVersee: selectedMission.partProfilVersee ? 'Oui' : 'Non',
      dateVersementProfil: formatDateISO(selectedMission.dateVersementProfil),
    });

    setShowMissionEditModal(true);
  };

  const closeMissionEditModal = () => {
    setShowMissionEditModal(false);
  };

  const updateCreditPaymentStatus = async (row: FacturationRow, nextStatus: 'Payé' | 'Non payé') => {
    if (!row.missionId || row.encaissePar !== 'Agence') return;

    const todayIso = new Date().toISOString().slice(0, 10);
    await updateMission(row.missionId, {
      part_profil_versee: nextStatus === 'Payé',
      date_versement_profil: nextStatus === 'Payé' ? todayIso : null,
    });

    await loadFinanceData();
  };

  const updateDebitPaymentStatus = async (row: FacturationRow, nextStatus: 'Payé' | 'Non payé') => {
    if (!row.missionId || row.encaissePar !== 'Profil') return;

    const todayIso = new Date().toISOString().slice(0, 10);
    await updateMission(row.missionId, {
      part_agence_reversee: nextStatus === 'Payé',
      date_remise_agence: nextStatus === 'Payé' ? todayIso : null,
    });

    await loadFinanceData();
  };

  const handleGenerateInvoicePreview = async () => {
    if (!selectedMission?.demandeId) {
      addToast('Aucune demande liée à cette mission', 'error');
      return;
    }

    const type: 'devis' | 'png' = selectedMission.segment === 'Entreprise' ? 'devis' : 'png';
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
    if (!selectedMission?.missionId) {
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

    setIsSavingMissionEdit(true);
    try {
      await updateMission(selectedMission.missionId, payload);
      await loadFinanceData();
      closeMissionEditModal();
      closeMissionDetails();
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
      'Paye',
      'Reste a payer',
      'Part agence',
      'Part profil',
      'Encaisse par',
      'Paiement',
      'Statut',
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
                <th>N° Mission</th><th>Date</th><th>Client</th><th>Profil</th><th>Service</th><th>Segment</th><th>Montant TTC</th><th>Paye</th><th>Reste a payer</th>
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
              <p className="fg-global-kpi-title">Nombre de missions</p>
              <p className="fg-global-kpi-value">{globalKpis.missions}</p>
              <p className="fg-global-kpi-subtitle">missions non annulées (période)</p>
            </article>
            <article className="fg-global-kpi green">
              <p className="fg-global-kpi-title">Encaissements clients</p>
              <p className="fg-global-kpi-value">{money(globalKpis.chiffreAffaires)}</p>
              <p className="fg-global-kpi-subtitle">montant réellement encaissé (période)</p>
            </article>
            <article className="fg-global-kpi green">
              <p className="fg-global-kpi-title">Part Agence encaissée</p>
              <p className="fg-global-kpi-value">{money(globalKpis.commissionAgence)}</p>
              <p className="fg-global-kpi-subtitle">part agence sur encaissements réels</p>
            </article>
            <article className="fg-global-kpi red">
              <p className="fg-global-kpi-title">Perte sur annulations</p>
              <p className="fg-global-kpi-value">{money(globalKpis.facturationAnnulee)}</p>
              <p className="fg-global-kpi-subtitle">part profil déjà versée puis annulée</p>
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
                  {globalTableRows.map((row) => (
                    <tr key={`${row.missionNo}-${row.client}`}>
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
                      <td className="fg-text-red fw-semibold">{row.encaissePar === 'Profil' ? money(getPartAgenceDueFromProfil(row)) : '—'}</td>
                      <td className="fg-text-orange fw-semibold">{row.encaissePar === 'Agence' ? money(getPartProfilDueFromAgence(row)) : '—'}</td>
                      <td className="fg-text-green fw-semibold">
                        {money(getCommissionAgenceEncaissee(row))}
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
                  <option>Non payé</option>
                  <option>Payé</option>
                  <option>Tous</option>
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
                  {filteredDebitRows.map((row) => (
                    <tr key={row.missionNo}>
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
                      <td className="fg-text-red fw-bold">{money(getPartAgenceDueFromProfil(row))}</td>
                      <td>{money(row.partProfil)}</td>
                      <td>
                        <label className="fg-select-wrap fg-compact-select">
                          <select
                            value={row.reglementInterne === 'Réglé' ? 'Payé' : 'Non payé'}
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
                  {filteredDebitRows.length === 0 && (
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

          <div className="fg-filter-row">
            <label className="fg-select-wrap">
              <select
                value={creditPaymentFilter}
                onChange={(e) => setCreditPaymentFilter(e.target.value as 'Non payé' | 'Payé' | 'Tous')}
              >
                <option value="Non payé">Non payé</option>
                <option value="Payé">Payé</option>
                <option value="Tous">Non payé + Payé</option>
              </select>
              <ChevronDown size={14} />
            </label>
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
                  {filteredCreditRows.map((row) => (
                    <tr key={row.missionNo}>
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
                      <td className="fg-text-blue fw-bold">{money(getPartProfilDueFromAgence(row))}</td>
                      <td>
                        <label className="fg-select-wrap fg-compact-select">
                          <select
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
            <article><FileText size={20} /><div><strong>{suiviRecap.totalFacture}</strong><span>Missions totalement payées</span></div></article>
            <article><BarChart3 size={20} /><div><strong>{money(suiviRecap.chiffreAffaires)}</strong><span>Encaissements clients</span></div></article>
            <article><Clock3 size={20} /><div><strong>{money(suiviRecap.commissionAgence)}</strong><span>Part agence encaissée</span></div></article>
            <article><Users size={20} /><div><strong>{suiviRecap.paiementsEnAttente}</strong><span>Paiements partiels</span></div></article>
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
                <select value={suiviStatutFilter} onChange={(e) => setSuiviStatutFilter(e.target.value)}>
                  <option>Tous les statuts</option>
                  <option>Confirmée</option>
                  <option>Terminée</option>
                  <option>Payé</option>
                  <option>Facturation annulée</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="fg-select-wrap">
                <select value={suiviPaiementFilter} onChange={(e) => setSuiviPaiementFilter(e.target.value)}>
                  <option>Tous les paiements</option>
                  <option>Non payé</option>
                  <option>Paiement en attente</option>
                  <option>Paiement effectué</option>
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
                  <th>N° Mission</th>
                  <th>Date</th>
                  <th>Client / Ville</th>
                  <th>Profil</th>
                  <th>Service</th>
                  <th>Segment</th>
                  <th>Montant TTC</th>
                  <th>Payé</th>
                  <th>Reste à payer</th>
                  <th>Mode paiement</th>
                  <th>Part agence</th>
                  <th>Part profil</th>
                  <th>Encaissé par</th>
                  <th>Paiement</th>
                  <th>Statut</th>
                  <th>Règlement interne</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredSuiviRows.map((row) => {
                  const montantTtc = row.montant;
                  const montantPaye = row.montantPaye ?? 0;
                  const ecart = Number((montantTtc - montantPaye).toFixed(2));

                  return (
                    <tr key={row.missionNo}>
                    <td className="fw-bold fg-mission-no">{row.missionNo}</td>
                    <td>{row.date}</td>
                    <td>
                      {row.clientId ? (
                        <button type="button" className="fg-link-btn" onClick={() => goToClientDetails(row.clientId)}>{row.client}</button>
                      ) : <strong>{row.client}</strong>}
                      <small>{row.ville}</small>
                    </td>
                    <td>
                      {row.profilId ? (
                        <button type="button" className="fg-link-btn" onClick={() => goToProfilDetails(row.profilId)}>{row.profil}</button>
                      ) : row.profil}
                    </td>
                    <td>{row.service}</td>
                    <td><span className={`fg-pill ${row.segment === 'Particulier' ? 'fg-pill-sky' : 'fg-pill-violet'}`}>{row.segment}</span></td>
                    <td className="fw-semibold">{money(montantTtc)}</td>
                    <td className="fw-semibold">{money(montantPaye)}</td>
                    <td className={Math.abs(ecart) > 0.009 ? 'fg-text-red fw-semibold' : 'fw-semibold'}>{Math.abs(ecart) > 0.009 ? money(ecart) : '—'}</td>
                    <td>{row.modePaiement}</td>
                    <td className="fg-text-green fw-semibold">{money(row.partAgence)}</td>
                    <td className="fg-text-blue fw-semibold">{money(row.partProfil)}</td>
                    <td>{row.encaissePar}</td>
                    <td><span className={paiementClass(row.paiement)}>{row.paiement}</span></td>
                    <td><span className={statutClass(row.statut)}>{row.statut}</span></td>
                    <td className="fg-reglement-cell">
                      <span className={reglementClass(row.reglementInterne)}>{row.reglementInterne}</span>
                      <small>{reglementDetail(row)}</small>
                    </td>
                    <td><button className="icon-btn" title="Voir" onClick={() => openMissionDetails(row)}><Eye size={14} /></button></td>
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
              {profileBalances.map((profile) => (
                <article key={profile.id} className="fg-profile-card">
                  <header>
                    <div>
                      <h4>{profile.name}</h4>
                      <p>{profile.city} - {profile.phone}</p>
                    </div>
                    <span>{profile.missions} mission{profile.missions > 1 ? 's' : ''}</span>
                  </header>

                  <div className="fg-profile-balance">
                    <p>Agence doit au profil</p>
                    <strong>{money(profile.solde)}</strong>
                  </div>

                  <div className="fg-metric-grid">
                    <div><span>CA total généré</span><strong>{money(profile.caTotal)}</strong></div>
                    <div><span>Part agence cumulée</span><strong>{money(profile.partAgence)}</strong></div>
                    <div><span>Part profil cumulée</span><strong>{money(profile.partProfil)}</strong></div>
                    <div><span>Versé au profil</span><strong>{money(profile.verseAuProfil)}</strong></div>
                    <div><span>Reçu du profil</span><strong>{money(profile.recuDuProfil)}</strong></div>
                    <div><span>En attente (total)</span><strong>{money(profile.solde)}</strong></div>
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
                <strong>{money(Number((selectedMission.montant / 1.2).toFixed(2)))}</strong>
              </div>
              <div>
                <p>TVA</p>
                <strong className="fg-text-orange">{money(Number((selectedMission.montant - Number((selectedMission.montant / 1.2).toFixed(2))).toFixed(2)))}</strong>
              </div>
              <div>
                <p>Montant TTC</p>
                <strong className="fg-text-blue">{money(selectedMission.montant)}</strong>
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
                    <div className="fg-mission-info-card"><span>Commercial</span><strong>{selectedMission.commercialName || '—'}</strong></div>
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
                  <div className="fg-mission-info-card"><span>Mode de paiement réel</span><strong>{selectedMission.modePaiementReel ?? '—'}</strong></div>
                  <div className="fg-mission-info-card"><span>Date de paiement</span><strong>{selectedMission.datePaiement ?? '—'}</strong></div>
                </div>
              )}

              {missionDetailTab === 'repartition' && (
                <>
                  <div className="fg-mission-share-grid">
                    <div className="fg-mission-share-card agency"><span>Part agence</span><strong>{money(selectedMission.partAgence)}</strong></div>
                    <div className="fg-mission-share-card profile"><span>Part profil</span><strong>{money(selectedMission.partProfil)}</strong></div>
                  </div>
                  <div className="fg-mission-internal-box">
                    <h4>Répartition et encaissement</h4>
                    <div>
                      <p>Paiement encaissé par<br /><strong>{selectedMission.encaissePar === 'Agence' ? "L'agence" : 'Le profil'}</strong></p>
                      <p>Part profil versée<br /><strong>{selectedMission.partProfilVersee ? 'Oui' : 'Non'}</strong></p>
                      <p>Date versement profil<br /><strong>{selectedMission.dateVersementProfil ?? '—'}</strong></p>
                    </div>
                  </div>
                </>
              )}

            </div>

            <footer className="fg-mission-footer">
              <button type="button" className="btn btn-secondary" onClick={openMissionEditModal}>Modifier</button>
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
                <Eye size={24} className="text-teal-700" /> Aperçu — {invoicePreview.type === 'devis' ? 'Devis' : 'Récapitulatif'}
              </h2>
              <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowInvoicePreviewPopup(false)}>
                <XCircle size={20} />
              </button>
            </div>

            <div className="modal-body bg-slate-800 rounded-md border border-slate-700 shadow-inner" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
              {invoicePreview.type === 'devis' ? (
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
              <div className="fg-edit-summary">
                <p>Montant total : <strong>{money(selectedMission.montant)}</strong></p>
                <p>Commission : <strong>{missionEditForm.commission}%</strong></p>
                <p>Part agence : <strong>{money(selectedMission.partAgence)}</strong></p>
                <p>Part profil : <strong>{money(selectedMission.partProfil)}</strong></p>
              </div>

              <div className="fg-two-col-fields">
                <div className="fg-modal-field">
                  <label>Statut mission</label>
                  <label className="fg-select-wrap">
                    <select
                      value={missionEditForm.statutMission}
                      onChange={(e) => setMissionEditForm((prev) => ({
                        ...prev,
                        statutMission: e.target.value as FacturationRow['statut'],
                      }))}
                    >
                      {missionStatusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                </div>
                <div className="fg-modal-field">
                  <label>Commission %</label>
                  <input
                    value={missionEditForm.commission}
                    onChange={(e) => setMissionEditForm((prev) => ({ ...prev, commission: e.target.value }))}
                  />
                </div>
              </div>

              <div className="fg-edit-section-title">💳 Paiement client</div>
              <div className="fg-two-col-fields">
                <div className="fg-modal-field">
                  <label>Montant payé</label>
                  <input
                    value={missionEditForm.montantPaye}
                    onChange={(e) => setMissionEditForm((prev) => ({ ...prev, montantPaye: e.target.value }))}
                  />
                </div>
                <div className="fg-modal-field">
                  <label>Mode de paiement réel</label>
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
                  <label>Statut paiement</label>
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
