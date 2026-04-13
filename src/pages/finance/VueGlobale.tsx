import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  Clock3,
  Eye,
  FileText,
  Grid3X3,
  List,
  MapPin,
  Search,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getMissions } from '../../api/client';
import './VueGlobale.css';

type FinanceSubTab = 'vue-globale' | 'suivi-facturation' | 'comptes-profils';
type ProfileDisplayMode = 'cards' | 'table';
type MissionEntryMode = 'demande' | 'manuel';
type MissionDetailTab = 'infos' | 'paiement' | 'repartition';

interface MissionEditForm {
  statutMission: FacturationRow['statut'];
  commission: string;
  montantPaye: string;
  modePaiementReel: string;
  datePaiement: string;
  statutPaiement: string;
  justificatifName: string;
  encaissePar: 'Agence' | 'Profil';
  partProfilVersee: 'Oui' | 'Non';
  dateVersementProfil: string;
}

interface OverviewCard {
  id: string;
  title: string;
  value: number;
  subtitle: string;
  tone: 'teal' | 'green' | 'amber' | 'slate';
  icon: LucideIcon;
}

interface MissionSummaryRow {
  profil: string;
  missions: number;
  caTotal: number;
  commissionAgence: number;
  aVerserProfils: number;
  paiementRecuClient: number;
  enAttenteClient: number;
}

interface FacturationRow {
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
  datePaiement?: string;
  modePaiementReel?: string;
  partProfilVersee?: boolean;
  dateVersementProfil?: string;
}

interface ProfileAccount {
  id: number;
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
  demande_detail?: {
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
    full_name?: string;
    city?: string;
    phone?: string;
  };
}

const money = (value: number): string => `${new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(value)} DH`;

const facturationRows: FacturationRow[] = [
  {
    missionNo: 'MSN-000013',
    date: '—',
    client: 'maria',
    ville: 'Casablanca',
    profil: 'BONR Karidja',
    service: 'Ménage post-sinistre',
    segment: 'Particulier',
    montant: 0,
    modePaiement: 'Sur place',
    partAgence: 0,
    partProfil: 0,
    encaissePar: 'Agence',
    paiement: 'non_paye',
    statut: 'Facturation annulée',
    reglementInterne: 'Réglé',
    montantPaye: 0,
    datePaiement: '—',
    modePaiementReel: '—',
    partProfilVersee: true,
    dateVersementProfil: '08/04/2026',
  },
  {
    missionNo: 'MSN-000012',
    date: '10/02/2026',
    client: 'julien client',
    ville: 'Casablanca',
    profil: 'HARIT Imane',
    service: 'Ménage bureaux',
    segment: 'Entreprise',
    montant: 600,
    modePaiement: '—',
    partAgence: 300,
    partProfil: 300,
    encaissePar: 'Agence',
    paiement: 'partiellement_paye',
    statut: 'Confirmée',
    reglementInterne: 'Non réglé',
  },
  {
    missionNo: 'MSN-000011',
    date: '—',
    client: 'test air bnb',
    ville: 'Casablanca',
    profil: '—',
    service: 'Ménage Air BnB',
    segment: 'Particulier',
    montant: 500,
    modePaiement: 'Paiement sur place',
    partAgence: 250,
    partProfil: 250,
    encaissePar: 'Agence',
    paiement: 'non_paye',
    statut: 'Terminée',
    reglementInterne: 'Non réglé',
  },
  {
    missionNo: 'MSN-000010',
    date: '—',
    client: 'Houda',
    ville: 'Casablanca',
    profil: 'FLEAN Parfaite',
    service: 'Grand ménage',
    segment: 'Particulier',
    montant: 1200,
    modePaiement: '—',
    partAgence: 600,
    partProfil: 600,
    encaissePar: 'Agence',
    paiement: 'paye',
    statut: 'Payé',
    reglementInterne: 'Non réglé',
  },
  {
    missionNo: 'MSN-000009',
    date: '01/03/2026',
    client: 'BONO',
    ville: 'Casablanca',
    profil: 'HARIT Imane',
    service: 'Grand ménage',
    segment: 'Particulier',
    montant: 1500,
    modePaiement: '—',
    partAgence: 750,
    partProfil: 750,
    encaissePar: 'Profil',
    paiement: 'paye',
    statut: 'Payé',
    reglementInterne: 'Réglé',
  },
];

const profileAccounts: ProfileAccount[] = [
  {
    id: 1,
    name: 'FLEAN Parfaite',
    city: 'Casablanca',
    phone: '0700000000',
    missions: 1,
    caTotal: 1200,
    partAgence: 600,
    partProfil: 600,
    verseAuProfil: 0,
    recuDuProfil: 0,
  },
  {
    id: 2,
    name: 'BONR Karidja',
    city: 'Casablanca',
    phone: '0700000000',
    missions: 4,
    caTotal: 9700,
    partAgence: 4850,
    partProfil: 4850,
    verseAuProfil: 0,
    recuDuProfil: 0,
  },
  {
    id: 3,
    name: 'HARIT Imane',
    city: 'Casablanca',
    phone: '0700000000',
    missions: 5,
    caTotal: 4280,
    partAgence: 2140,
    partProfil: 2140,
    verseAuProfil: 0,
    recuDuProfil: 750,
  },
];

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

const formatDateFR = (value?: string): string => {
  if (!value) return '—';
  if (value.includes('/')) return value;
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const mapMissionToFacturationRow = (item: MissionApiItem): FacturationRow => {
  const demande = item.demande_detail;
  const agent = item.agent_detail;
  const montant = Number(demande?.prix ?? 0);
  const partAgence = Number((montant * 0.5).toFixed(2));
  const partProfil = Number((montant - partAgence).toFixed(2));
  const statutPaiement = demande?.statut_paiement ?? 'non_paye';
  const paiement: FacturationRow['paiement'] =
    statutPaiement === 'integral'
      ? 'paye'
      : statutPaiement === 'partiel' || statutPaiement === 'acompte'
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

  const encaissePar: FacturationRow['encaissePar'] = demande?.mode_paiement === 'sur_place' ? 'Profil' : 'Agence';

  const montantPaye =
    paiement === 'paye'
      ? montant
      : paiement === 'partiellement_paye'
        ? Number((montant * 0.5).toFixed(2))
        : 0;

  const reglementInterne = paiement === 'paye' ? 'Réglé' : 'Non réglé';

  return {
    missionNo: `MSN-${String(item.id).padStart(6, '0')}`,
    date: formatDateFR(demande?.date_intervention),
    client: demande?.client_name || '—',
    ville: demande?.client_city || 'Casablanca',
    profil: agent?.full_name || '—',
    service: demande?.service || 'Service',
    segment: demande?.segment === 'entreprise' ? 'Entreprise' : 'Particulier',
    montant,
    modePaiement: demande?.mode_paiement_label || '—',
    partAgence,
    partProfil,
    encaissePar,
    paiement,
    statut,
    reglementInterne,
    montantPaye,
    datePaiement: paiement === 'non_paye' ? '—' : formatDateFR(demande?.date_intervention),
    modePaiementReel: demande?.mode_paiement_label || '—',
    partProfilVersee: paiement === 'paye',
    dateVersementProfil: paiement === 'paye' ? formatDateFR(demande?.date_intervention) : '—',
  };
};

export default function VueGlobale() {
  const [activeTab, setActiveTab] = useState<FinanceSubTab>('vue-globale');
  const [displayMode, setDisplayMode] = useState<ProfileDisplayMode>('cards');
  const [showNewMissionModal, setShowNewMissionModal] = useState(false);
  const [selectedMission, setSelectedMission] = useState<FacturationRow | null>(null);
  const [selectedProfileAccount, setSelectedProfileAccount] = useState<ProfileBalance | null>(null);
  const [missionDetailTab, setMissionDetailTab] = useState<MissionDetailTab>('infos');
  const [showMissionEditModal, setShowMissionEditModal] = useState(false);
  const [missionEditForm, setMissionEditForm] = useState<MissionEditForm>({
    statutMission: 'Confirmée',
    commission: '50',
    montantPaye: '0',
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

  const [monthFilter, setMonthFilter] = useState('Tous les mois');
  const [profilFilter, setProfilFilter] = useState('Tous les profils');
  const [modeFilter, setModeFilter] = useState('Tous les modes');
  const [statutFilter, setStatutFilter] = useState('Tous les statuts');
  const [searchProfiles, setSearchProfiles] = useState('');
  const [suiviSearch, setSuiviSearch] = useState('');
  const [suiviDateFrom, setSuiviDateFrom] = useState('');
  const [suiviDateTo, setSuiviDateTo] = useState('');
  const [suiviStatutFilter, setSuiviStatutFilter] = useState('Tous les statuts');
  const [suiviPaiementFilter, setSuiviPaiementFilter] = useState('Tous les paiements');
  const [suiviSegmentFilter, setSuiviSegmentFilter] = useState('Tous les segments');
  const [facturationData, setFacturationData] = useState<FacturationRow[]>(facturationRows);
  const [profileAccountsData, setProfileAccountsData] = useState<ProfileAccount[]>(profileAccounts);

  useEffect(() => {
    const loadFinanceData = async () => {
      try {
        const response = await getMissions({ ordering: '-created_at' });
        const payload = response.data?.results ?? response.data;
        if (!Array.isArray(payload) || payload.length === 0) return;

        const mappedRows = (payload as MissionApiItem[]).map(mapMissionToFacturationRow);
        setFacturationData(mappedRows);

        const grouped = new Map<string, ProfileAccount>();
        for (const item of payload as MissionApiItem[]) {
          const profileName = item.agent_detail?.full_name || 'Profil inconnu';
          const montant = Number(item.demande_detail?.prix ?? 0);
          const partAgence = Number((montant * 0.5).toFixed(2));
          const partProfil = Number((montant - partAgence).toFixed(2));

          if (!grouped.has(profileName)) {
            grouped.set(profileName, {
              id: grouped.size + 1,
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

          const profile = grouped.get(profileName)!;
          profile.missions += 1;
          profile.caTotal += montant;
          profile.partAgence += partAgence;
          profile.partProfil += partProfil;

          const statutPaiement = item.demande_detail?.statut_paiement;
          const encaissePar = item.demande_detail?.mode_paiement === 'sur_place' ? 'Profil' : 'Agence';
          if (statutPaiement === 'integral') {
            if (encaissePar === 'Agence') {
              profile.verseAuProfil += partProfil;
            } else {
              profile.recuDuProfil += partAgence;
            }
          }
        }

        const accounts = Array.from(grouped.values());
        if (accounts.length > 0) {
          setProfileAccountsData(accounts);
        }
      } catch {
        // keep fallback static data when API is unavailable
      }
    };

    void loadFinanceData();
  }, []);

  const filteredFacturationRows = useMemo(() => {
    const monthMap: Record<string, number> = {
      janvier: 1,
      février: 2,
      mars: 3,
      avril: 4,
      mai: 5,
      juin: 6,
      juillet: 7,
      août: 8,
      septembre: 9,
      octobre: 10,
      novembre: 11,
      décembre: 12,
    };

    return facturationData.filter((row) => {
      if (profilFilter !== 'Tous les profils' && row.profil !== profilFilter) return false;
      if (modeFilter !== 'Tous les modes' && row.modePaiement !== modeFilter) return false;
      if (statutFilter === 'Non payé' && row.paiement !== 'non_paye') return false;
      if (statutFilter === 'Partiellement payé' && row.paiement !== 'partiellement_paye') return false;
      if (statutFilter === 'Payé' && row.paiement !== 'paye') return false;

      if (monthFilter !== 'Tous les mois' && row.date.includes('/')) {
        const month = Number(row.date.split('/')[1]);
        if (monthMap[monthFilter] !== month) return false;
      }

      return true;
    });
  }, [facturationData, monthFilter, profilFilter, modeFilter, statutFilter]);

  const profileFilterOptions = useMemo(
    () => ['Tous les profils', ...Array.from(new Set(facturationData.map((row) => row.profil).filter((name) => name !== '—')))],
    [facturationData]
  );

  const modeFilterOptions = useMemo(
    () => ['Tous les modes', ...Array.from(new Set(facturationData.map((row) => row.modePaiement).filter((m) => m && m !== '—')))],
    [facturationData]
  );

  const filteredSuiviRows = useMemo(() => {
    return facturationData.filter((row) => {
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
  }, [facturationData, suiviDateFrom, suiviDateTo, suiviPaiementFilter, suiviSearch, suiviSegmentFilter, suiviStatutFilter]);

  const overviewCardsData: OverviewCard[] = useMemo(() => {
    const totalMissions = filteredFacturationRows.length;
    const totalCa = filteredFacturationRows.reduce((sum, row) => sum + row.montant, 0);
    const totalCommission = filteredFacturationRows.reduce((sum, row) => sum + row.partAgence, 0);
    const attente = filteredFacturationRows.reduce((sum, row) => sum + Math.max(row.montant - (row.montantPaye ?? 0), 0), 0);

    return [
      { id: 'missions', title: 'Missions (filtré)', value: totalMissions, subtitle: 'interventions', tone: 'slate', icon: FileText },
      { id: 'ca', title: "Chiffre d'affaires", value: totalCa, subtitle: 'HT missions', tone: 'teal', icon: BarChart3 },
      { id: 'commission', title: 'Commissions agence', value: totalCommission, subtitle: 'total gagné', tone: 'green', icon: ArrowUpRight },
      { id: 'attente', title: 'Montants en attente', value: attente, subtitle: 'non encaissé', tone: 'amber', icon: Clock3 },
    ];
  }, [filteredFacturationRows]);

  const missionSummaryRowsData = useMemo<MissionSummaryRow[]>(() => {
    const grouped = new Map<string, MissionSummaryRow>();
    for (const row of filteredFacturationRows) {
      if (!grouped.has(row.profil)) {
        grouped.set(row.profil, {
          profil: row.profil,
          missions: 0,
          caTotal: 0,
          commissionAgence: 0,
          aVerserProfils: 0,
          paiementRecuClient: 0,
          enAttenteClient: 0,
        });
      }

      const target = grouped.get(row.profil)!;
      target.missions += 1;
      target.caTotal += row.montant;
      target.commissionAgence += row.partAgence;
      target.aVerserProfils += row.partProfil;
      target.paiementRecuClient += row.montantPaye ?? 0;
      target.enAttenteClient += Math.max(row.montant - (row.montantPaye ?? 0), 0);
    }

    return Array.from(grouped.values());
  }, [filteredFacturationRows]);

  const agenceNonPayeAmount = useMemo(
    () => facturationData.filter((row) => row.encaissePar === 'Profil' && row.reglementInterne !== 'Réglé').reduce((sum, row) => sum + row.partAgence, 0),
    [facturationData]
  );

  const profilNonPayeAmount = useMemo(
    () => facturationData.filter((row) => row.encaissePar === 'Agence' && row.reglementInterne !== 'Réglé').reduce((sum, row) => sum + row.partProfil, 0),
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
        ? facturationData.filter((row) => row.profil === selectedProfileAccount.name)
        : [],
    [selectedProfileAccount, facturationData]
  );

  const displayedMissionCount = filteredSuiviRows.length;
  const displayedMissionTotal = filteredSuiviRows.reduce((sum, row) => sum + row.montant, 0);

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
      modePaiementReel: selectedMission.modePaiementReel ?? 'Choisir',
      datePaiement: selectedMission.datePaiement === '—' ? '' : (selectedMission.datePaiement ?? ''),
      statutPaiement: mappedStatutPaiement,
      justificatifName: 'Aucun fichier choisi',
      encaissePar: selectedMission.encaissePar,
      partProfilVersee: selectedMission.partProfilVersee ? 'Oui' : 'Non',
      dateVersementProfil: selectedMission.dateVersementProfil === '—' ? '' : (selectedMission.dateVersementProfil ?? ''),
    });

    setShowMissionEditModal(true);
  };

  const closeMissionEditModal = () => {
    setShowMissionEditModal(false);
  };

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
          className={`fg-tab ${activeTab === 'suivi-facturation' ? 'active' : ''}`}
          onClick={() => setActiveTab('suivi-facturation')}
        >
          <FileText size={15} /> Suivi Facturation
        </button>
        <button
          type="button"
          className={`fg-tab ${activeTab === 'comptes-profils' ? 'active' : ''}`}
          onClick={() => setActiveTab('comptes-profils')}
        >
          <Users size={15} /> Comptes Profils
        </button>
      </div>

      {activeTab === 'vue-globale' && (
        <>
          <div className="fg-filter-row">
            <label className="fg-select-wrap">
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                <option>Tous les mois</option>
                <option>janvier</option>
                <option>février</option>
                <option>mars</option>
                <option>avril</option>
                <option>mai</option>
                <option>juin</option>
                <option>juillet</option>
                <option>août</option>
                <option>septembre</option>
                <option>octobre</option>
                <option>novembre</option>
                <option>décembre</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <label className="fg-select-wrap">
              <select value={profilFilter} onChange={(e) => setProfilFilter(e.target.value)}>
                {profileFilterOptions.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <label className="fg-select-wrap">
              <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                {modeFilterOptions.map((mode) => (
                  <option key={mode}>{mode}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <label className="fg-select-wrap">
              <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
                <option>Tous les statuts</option>
                <option>Non payé</option>
                <option>Partiellement payé</option>
                <option>Payé</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>

          <div className="fg-overview-grid">
            {overviewCardsData.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.id} className={`fg-overview-card tone-${card.tone}`}>
                  <div>
                    <p className="fg-overview-title">{card.title}</p>
                    <p className="fg-overview-value">{card.id === 'missions' ? card.value : money(card.value)}</p>
                    <p className="fg-overview-subtitle">{card.subtitle}</p>
                  </div>
                  <Icon size={18} />
                </article>
              );
            })}
          </div>

          <div className="fg-highlight-grid">
            <article className="fg-highlight-card red">
              <div>
                <p className="fg-highlight-label">Agence non payée</p>
                <h3>{money(agenceNonPayeAmount)}</h3>
                <p>
                  {facturationData.filter((row) => row.encaissePar === 'Profil' && row.reglementInterne !== 'Réglé').length}
                  {' '}mission(s) - encaissé par profil, part agence non reversée
                </p>
              </div>
              <AlertTriangle size={18} />
            </article>

            <article className="fg-highlight-card blue">
              <div>
                <p className="fg-highlight-label">Profil non payé</p>
                <h3>{money(profilNonPayeAmount)}</h3>
                <p>
                  {facturationData.filter((row) => row.encaissePar === 'Agence' && row.reglementInterne !== 'Réglé').length}
                  {' '}mission(s) - encaissé par agence, part profil non versée
                </p>
              </div>
              <AlertTriangle size={18} />
            </article>
          </div>

          <div className="fg-dual-panels">
            <section className="fg-panel red">
              <header>
                <h4>Profils débiteurs</h4>
                <span>{profileBalances.filter((profile) => profile.solde < 0).length}</span>
              </header>
              {profileBalances.filter((profile) => profile.solde < 0).length === 0 ? (
                <p>Aucun profil débiteur</p>
              ) : (
                <ul>
                  {profileBalances.filter((profile) => profile.solde < 0).map((profile) => (
                    <li key={profile.id}><strong>{profile.name}</strong><span>{money(Math.abs(profile.solde))}</span></li>
                  ))}
                </ul>
              )}
            </section>
            <section className="fg-panel blue">
              <header>
                <h4>Agence doit au profil</h4>
                <span>{profileBalances.filter((profile) => profile.solde > 0).length}</span>
              </header>
              <ul>
                {profileBalances.filter((profile) => profile.solde > 0).map((profile) => (
                  <li key={profile.id}><strong>{profile.name}</strong><span>{money(profile.solde)}</span></li>
                ))}
              </ul>
            </section>
          </div>

          <section className="fg-table-section">
            <div className="fg-section-head">
              <h3>Récapitulatif missions filtrées</h3>
              <span>{missionSummaryRowsData.length} résultat(s)</span>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Profil</th>
                    <th>Missions</th>
                    <th>CA total</th>
                    <th>Commission agence</th>
                    <th>À verser profils</th>
                    <th>Paiement reçu du client</th>
                    <th>En attente du client</th>
                  </tr>
                </thead>
                <tbody>
                  {missionSummaryRowsData.map((row) => (
                    <tr key={row.profil}>
                      <td className="fw-bold">{row.profil}</td>
                      <td>{row.missions}</td>
                      <td className="fw-semibold">{money(row.caTotal)}</td>
                      <td>{money(row.commissionAgence)}</td>
                      <td className="fg-text-green fw-semibold">{money(row.aVerserProfils)}</td>
                      <td>{money(row.paiementRecuClient)}</td>
                      <td className={row.enAttenteClient > 0 ? 'fg-text-red fw-semibold' : 'fw-semibold'}>
                        {money(row.enAttenteClient)}
                      </td>
                    </tr>
                  ))}
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
              <h2>Historique des Missions</h2>
              <p>Suivi complet de toutes les interventions</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowNewMissionModal(true)}>+ Nouvelle mission</button>
          </section>

          <div className="fg-hero-stats">
            <article><FileText size={20} /><div><strong>{facturationData.length}</strong><span>Total missions</span></div></article>
            <article><BarChart3 size={20} /><div><strong>{money(facturationData.reduce((sum, row) => sum + row.montant, 0))}</strong><span>Chiffre d'affaires</span></div></article>
            <article><Clock3 size={20} /><div><strong>{facturationData.filter((row) => row.statut === 'Confirmée').length}</strong><span>En cours</span></div></article>
            <article><Users size={20} /><div><strong>{facturationData.filter((row) => row.paiement !== 'paye').length}</strong><span>Paiements en attente</span></div></article>
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
                  <th>Montant</th>
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
                {filteredSuiviRows.map((row) => (
                  <tr key={row.missionNo}>
                    <td className="fw-bold fg-mission-no">{row.missionNo}</td>
                    <td>{row.date}</td>
                    <td>
                      <strong>{row.client}</strong>
                      <small>{row.ville}</small>
                    </td>
                    <td>{row.profil}</td>
                    <td>{row.service}</td>
                    <td><span className={`fg-pill ${row.segment === 'Particulier' ? 'fg-pill-sky' : 'fg-pill-violet'}`}>{row.segment}</span></td>
                    <td className="fw-semibold">{money(row.montant)}</td>
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
                ))}
                {filteredSuiviRows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="empty-row">Aucune mission trouvée.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={15}>
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
                        <strong>{profile.name}</strong>
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
                        <td>{mission.client}</td>
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
                <p>Montant mission</p>
                <strong>{money(selectedMission.montant)}</strong>
              </div>
              <div>
                <p>Part agence (50%)</p>
                <strong className="fg-text-green">{money(selectedMission.partAgence)}</strong>
              </div>
              <div>
                <p>Part profil</p>
                <strong className="fg-text-blue">{money(selectedMission.partProfil)}</strong>
              </div>
            </div>

            <div className="fg-mission-tabs">
              <button className={missionDetailTab === 'infos' ? 'active' : ''} onClick={() => setMissionDetailTab('infos')}>Informations</button>
              <button className={missionDetailTab === 'paiement' ? 'active' : ''} onClick={() => setMissionDetailTab('paiement')}>Paiement client</button>
              <button className={missionDetailTab === 'repartition' ? 'active' : ''} onClick={() => setMissionDetailTab('repartition')}>Répartition interne</button>
            </div>

            <div className="fg-mission-content">
              {missionDetailTab === 'infos' && (
                <>
                  <div className="fg-mission-info-grid">
                    <div className="fg-mission-info-card"><span>Type de service</span><strong>{selectedMission.service}</strong></div>
                    <div className="fg-mission-info-card"><span>Segment</span><strong>{selectedMission.segment}</strong></div>
                    <div className="fg-mission-info-card"><span>Paiement prévu</span><strong>{selectedMission.modePaiement}</strong></div>
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
                    <h4>Encaissé par l'agence</h4>
                    <div>
                      <p>Part profil versée<br /><strong>{selectedMission.partProfilVersee ? 'Oui' : 'Non'}</strong></p>
                      <p>Date versement profil<br /><strong>{selectedMission.dateVersementProfil ?? '—'}</strong></p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <footer className="fg-mission-footer">
              <button type="button" className="btn btn-secondary" onClick={openMissionEditModal}>Modifier</button>
              <button type="button" className="btn btn-secondary" onClick={closeMissionDetails}>Fermer</button>
            </footer>
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
                <div className="fg-modal-field">
                  <label>Part profil versée ?</label>
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
              </div>

              <div className="fg-modal-field fg-short-field">
                <label>Date versement au profil</label>
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

            <footer className="fg-edit-footer">
              <button type="button" className="btn btn-secondary" onClick={closeMissionEditModal}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={closeMissionEditModal}>Enregistrer</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
