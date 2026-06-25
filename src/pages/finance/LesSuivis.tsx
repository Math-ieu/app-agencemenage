import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { encodeId } from '../../utils/obfuscation';
import {
  Calendar,
  ChevronDown,
  Download,
  Eye,
  Pencil,
  Search,
  Users,
  TrendingUp,
  DollarSign,
  X
} from 'lucide-react';
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
import { hasPermission } from '../../utils/permissions';
import './LesSuivis.css';

// Interface matching the FacturationRow definition in VueGlobale
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
  statut: 'Annulé' | 'Facturation annulée' | 'Intervention annulée' | 'Intervention gratuite' | 'Confirmée' | 'Terminée' | 'Payé' | 'En attente';
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
  note_commercial?: string;
  _partProfilDue?: number;
  _partProfilVersee?: boolean;
  _partAgenceDue?: number;
  _partAgenceReversee?: boolean;
}

interface AgentApiItem {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  phone?: string;
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

const formatDateISO = (value?: string): string => {
  if (!value || value === '—') return '';
  if (value.includes('-')) return value;
  const [day, month, year] = value.split('/');
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
};

const isCreditRow = (row: FacturationRow): boolean => {
  return (
    row.statutPaiementUi === 'agence_payee_client' ||
    row.statutPaiementUi === 'Agence payée / Client' ||
    (row.statutPaiementUi === 'paye' && row.encaissePar === 'Agence') ||
    ((row.statutPaiementUi === 'facturation_annulee' || row.statutPaiementUi === 'Facturation annulée' || row.statut === 'Facturation annulée' || row.statut === 'Intervention annulée') && row.profilSeraPaye) ||
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

  return (
    !isCancelled &&
    (row.statutPaiementUi === 'profil_paye_client' ||
      row.statutPaiementUi === 'Profil payé / Client' ||
      (row.statutPaiementUi === 'paye' && row.encaissePar === 'Profil') ||
      (!row.statutPaiementUi && row.encaissePar === 'Profil'))
  );
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

const getISODateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const modeLabelFromCode = (value?: string): string => {
  if (value === 'virement') return 'Virement';
  if (value === 'cheque') return 'Chèque';
  if (value === 'especes') return 'Espèces';
  if (value === 'carte') return 'Carte Bancaire';
  if (value === 'especes_agence') return "Espèces à l'agence";
  if (value === 'sur_place') return 'Sur place';
  return '—';
};

const getPaymentUiLabel = (uiCode: string | undefined): string => {
  if (!uiCode) return 'Non payé';
  const labels: Record<string, string> = {
    paye: 'Payé',
    agence_payee_client: 'Agence payée / Client',
    profil_paye_client: 'Profil payé / Client',
    commercial_paye_client: 'Commercial payé / client',
    paiement_partiel: 'Paiement partiel',
    paiement_en_attente: 'Paiement en attente',
    non_confirme: 'Non confirmé',
    facturation_annulee: 'Annulé',
    intervention_gratuite: 'Intervention gratuite',
  };
  return labels[uiCode] || uiCode.replace(/_/g, ' ');
};

const getRealPaymentStatusLabel = (row: FacturationRow): string => {
  const uiVal = row.statutPaiementUi;
  const statut = row.statut;
  if (statut === 'Facturation annulée' || statut === 'Intervention annulée' || uiVal === 'facturation_annulee' || statut === 'Intervention gratuite' || uiVal === 'intervention_gratuite') {
    if (row.profilSeraPaye && (row.reglementInterne === 'Réglé' || row.partProfilVersee === true)) {
      return 'Payé';
    }
    return uiVal === 'intervention_gratuite' || statut === 'Intervention gratuite' ? 'Intervention gratuite' : (statut === 'Intervention annulée' ? 'Intervention annulée' : 'Annulé');
  }
  if (uiVal === 'paye' || row.paiement === 'paye') {
    return 'Payé';
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
  if (uiVal === 'paye' || row.paiement === 'paye') {
    return 'green';
  }
  if (['agence_payee_client', 'profil_paye_client', 'commercial_paye_client', 'paiement_partiel', 'paiement_en_attente'].includes(uiVal || '')) {
    return 'blue';
  }
  return 'gray';
};

// Top-level helpers identical to VueGlobale.tsx
const getPartProfilDueFromAgence = (row: FacturationRow): number => {
  if (row.statutPaiementUi === 'agence_payee_client' || row.statutPaiementUi === 'Agence payée / Client') {
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

  useEffect(() => {
    if (!canSeeDus && activeTab === 'dus-profils' && canSeeCommerciaux) {
      setActiveTab('commerciaux');
    } else if (!canSeeCommerciaux && activeTab === 'commerciaux' && canSeeDus) {
      setActiveTab('dus-profils');
    }
  }, [canSeeDus, canSeeCommerciaux, activeTab]);

  // Search & Filters Tab 1
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [freqFilter, setFreqFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  });

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FacturationRow | null>(null);

  // Edit form states
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editRemark, setEditRemark] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

    const isPaidStatus = ['paye', 'integral', 'effectue', 'profil_paye_client', 'Profil payé / Client', 'agence_payee_client', 'Agence payée / Client'].includes(rawStatutPaiementUi);
    const isPartiallyPaidStatus = ['paiement_partiel', 'paiement_en_attente', 'Paiement partiel', 'Paiement en attente', 'partiel', 'acompte'].includes(rawStatutPaiementUi);

    const paiement: FacturationRow['paiement'] =
      (isPaidStatus && allProfilesPaid)
        ? 'paye'
        : (isPartiallyPaidStatus || isPaidStatus)
          ? 'partiellement_paye'
          : 'non_paye';

    const missionStatus = item.statut;
    const isGratuit = rawStatutPaiementUi === 'intervention_gratuite';
    const isInterventionAnnulee = missionStatus === 'annulee' || demande?.statut === 'annule';
    const isFacturationAnnulee = !isInterventionAnnulee && !isGratuit && (
      facturationData.facturation_annulee === true ||
      rawStatutPaiementUi === 'facturation_annulee'
    );

    const statut: FacturationRow['statut'] =
      isGratuit
        ? 'Intervention gratuite'
        : isInterventionAnnulee
          ? 'Intervention annulée'
          : isFacturationAnnulee
            ? 'Facturation annulée'
            : paiement === 'paye'
              ? 'Payé'
              : paiement === 'partiellement_paye'
                ? 'Confirmée'
                : missionStatus === 'terminee'
                  ? 'Terminée'
                  : missionStatus === 'en_attente'
                    ? 'En attente'
                    : 'Confirmée';

    const partProfilVersee = encaissePar === 'Agence'
      ? (item.part_profil_versee ?? false)
      : (item.part_agence_reversee ?? false);

    const numMissions = Math.max(1, parts.length);
    const profilId = agent?.id;
    const partInfo = parts.find((p: any) => Number(p.profile_id) === Number(profilId));
    const montantProfile = Number(partInfo?.amount || 0);
    const totalProfilsAmount = parts.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
    const ratio = totalProfilsAmount > 0 && montantProfile > 0 ? (montantProfile / totalProfilsAmount) : (1 / numMissions);

    const montant = rawMontant * ratio;

    let montantPaye = rawMontantPaye * ratio;
    if (montantPaye === 0) {
      if (paiement === 'paye') montantPaye = montant;
      else if (paiement === 'partiellement_paye') montantPaye = 0;
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
      partAgenceReversee: item.part_agence_reversee,
      dateRemiseAgence: item.date_remise_agence || facturationData.date_remise_agence || '—',
      parentDemandeId: demande?.parent_demande || demande?.parent_demande_id || null,
      frequency: demande?.frequency || null,
      annulationRaison: demande?.annulation_raison || item.annulation_raison || facturationData.annulation_raison,
      profilSeraPaye: demande?.profil_sera_paye !== undefined ? demande.profil_sera_paye : item.profil_sera_paye,
      montantProfilAnnulation: Number(demande?.montant_profil_annulation || item.montant_profil_annulation || facturationData.montant_profil_annulation || 0) * ratio,
      montantAgenceDoitProfil: Number(demande?.montant_agence_doit_profil || item.montant_agence_doit_profil || facturationData.montant_agence_doit_profil || 0) * ratio,
      montantProfilDoitAgence: Number(demande?.montant_profil_doit_agence || item.montant_profil_doit_agence || facturationData.montant_profil_doit_agence || 0) * ratio,
      statutPaiementUi: rawStatutPaiementUi,
      tvaActive: Boolean(facturationData.tva_active ?? demande?.tva_active),
      originalDemande: demande,
      originalMission: item,
      parts_repartition: Array.isArray(facturationData.parts_repartition) && facturationData.parts_repartition.length > 0 ? facturationData.parts_repartition : Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0 ? d_parts_repartition : undefined,
      note_commercial: partInfo?.note_commercial || demande?.note_commercial || facturationData.note_commercial || '—',
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

    const isPaidStatus = ['paye', 'integral', 'effectue', 'profil_paye_client', 'Profil payé / Client', 'agence_payee_client', 'Agence payée / Client'].includes(rawStatutPaiementUi);
    const isPartiallyPaidStatus = ['paiement_partiel', 'paiement_en_attente', 'Paiement partiel', 'Paiement en attente', 'partiel', 'acompte'].includes(rawStatutPaiementUi);

    const paiement: FacturationRow['paiement'] =
      (isPaidStatus && allProfilesPaid)
        ? 'paye'
        : (isPartiallyPaidStatus || isPaidStatus)
          ? 'partiellement_paye'
          : 'non_paye';

    const isGratuit = rawStatutPaiementUi === 'intervention_gratuite';
    const isInterventionAnnulee = demande.statut === 'annule';
    const isFacturationAnnulee = !isInterventionAnnulee && !isGratuit && (
      facturationData.facturation_annulee === true ||
      rawStatutPaiementUi === 'facturation_annulee'
    );

    const statut: FacturationRow['statut'] =
      isGratuit ? 'Intervention gratuite' :
        isInterventionAnnulee ? 'Intervention annulée' :
          isFacturationAnnulee ? 'Facturation annulée' :
            paiement === 'paye' ? 'Payé' :
              paiement === 'partiellement_paye' ? 'Confirmée' :
                demande.statut === 'en_attente' ? 'En attente' : 'Confirmée';

    const partProfilVersee = Boolean(facturationData.part_profil_versee);
    const partAgenceReversee = Boolean(facturationData.part_agence_reversee);
    const reglementInterne = (encaissePar === 'Agence' ? partProfilVersee : partAgenceReversee) ? 'Réglé' : 'Non réglé';

    return {
      demandeId: demande?.id,
      clientId: demande?.client,
      profilId: demande?.profil_id,
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
      montantPaye: paiement === 'paye'
        ? (Number(facturationData.montant_verse) || montant)
        : (paiement === 'partiellement_paye' ? (Number(facturationData.montant_verse) || 0) : 0),
      montantEncaisseProfil: encaissePar === 'Profil' && paiement === 'paye' ? montant : 0,
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
      annulationRaison: demande.annulation_raison || facturationData.annulation_raison,
      profilSeraPaye: demande.profil_sera_paye !== undefined ? demande.profil_sera_paye : facturationData.profil_sera_paye,
      montantProfilAnnulation: Number(demande.montant_profil_annulation || facturationData.montant_profil_annulation || 0),
      montantAgenceDoitProfil: Number(demande.montant_agence_doit_profil || facturationData.montant_agence_doit_profil || 0),
      montantProfilDoitAgence: Number(demande.montant_profil_doit_agence || facturationData.montant_profil_doit_agence || 0),
      statutPaiementUi: rawStatutPaiementUi,
      tvaActive: Boolean(facturationData.tva_active ?? demande.tva_active),
      originalDemande: demande,
      originalMission: null,
      parts_repartition: Array.isArray(facturationData.parts_repartition) && facturationData.parts_repartition.length > 0 ? facturationData.parts_repartition : Array.isArray(d_parts_repartition) && d_parts_repartition.length > 0 ? d_parts_repartition : undefined,
      note_commercial: demande?.note_commercial || facturationData.note_commercial || '—',
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
    const missionDemandeIds = new Set(missions.map((m) => String(m.demande_detail?.id)).filter((id) => id !== 'undefined' && id !== 'null'));
    const uniqueDemands = demands.filter((d) => !missionDemandeIds.has(String(d.id)));

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

    for (const groupRows of subscriptionGroups.values()) {
      for (const row of groupRows) {
        const isRoot = !row.parentDemandeId;
        row.isSubscriptionPrimary = isRoot;
        row.isSubscriptionSecondary = !isRoot;
      }
    }

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

  const getSubInfo = useCallback((row: FacturationRow) => {
    const isSub = row.frequency === 'abonnement' || row.originalDemande?.frequency === 'abonnement';
    if (!isSub) return null;
    const parentId = row.originalDemande?.parent_demande || row.originalDemande?.id || row.demandeId;
    if (!parentId) return null;

    const subRows = facturationData
      .filter(r => {
        const rIsSub = r.frequency === 'abonnement' || r.originalDemande?.frequency === 'abonnement';
        if (!rIsSub) return false;
        const rParentId = r.originalDemande?.parent_demande || r.originalDemande?.id || r.demandeId;
        return rParentId === parentId;
      })
      .sort((a, b) => {
        const dateA = parseFrenchDate(a.date)?.getTime() || 0;
        const dateB = parseFrenchDate(b.date)?.getTime() || 0;
        return dateA - dateB;
      });

    const index = subRows.findIndex(r => r.missionId === row.missionId && r.demandeId === row.demandeId && r.date === row.date);
    if (index === -1) return null;
    
    let total = subRows.length;
    const parentRow = facturationData.find(r => r.demandeId === parentId && !r.parentDemandeId);
    const parentDemande = parentRow?.originalDemande || (row.parentDemandeId ? null : row.originalDemande);
    const weeks = parentDemande?.planning?.semaines;
    if (weeks && Array.isArray(weeks)) {
      let plannedCount = 0;
      weeks.forEach(w => {
        if (w.jours) {
          Object.keys(w.jours).forEach(dayKey => {
            if (w.jours[dayKey]?.selected) {
              plannedCount++;
            }
          });
        }
      });
      if (plannedCount > 0) {
        total = Math.max(subRows.length, plannedCount);
      }
    }
    
    return {
      rank: index + 1,
      total: total,
      isFirst: index === 0
    };
  }, [facturationData]);

  // Expanded Rows to match VueGlobale Credit and Debit logic
  const expandedRows = useMemo(() => {
    const result: FacturationRow[] = [];

    for (const row of facturationData) {
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
          for (const part of partsRep) {
            const isPaid = part.part_profil_versee ?? row.partProfilVersee;
            const pId = Number(part.profile_id);
            const agentObj = agentsList.find((a) => Number(a.id) === pId);
            const pName = agentObj
              ? (agentObj.full_name || `${agentObj.first_name || ''} ${agentObj.last_name || ''}`.trim())
              : part.profile_name || row.profil;
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

            result.push({
              ...row,
              profilId: pId,
              profil: pName,
              partProfil: portion,
              partProfilVersee: isPaid,
              reglementInterne: isPaid ? 'Réglé' : 'Non réglé',
              _partProfilVersee: isPaid,
              _uniqueKey: `${row.missionNo}-${pId}-credit`,
              dateVersementProfil: versementDate,
              note_commercial: noteCommercial,
            });
          }
        } else {
          const partProfilDue = getPartProfilDueFromAgence(row);
          const isPaid = row.partProfilVersee;
          const fallbackDate = isPaid ? (row.datePaiement && row.datePaiement !== '—' ? row.datePaiement : row.date) : '—';
          const versementDate = (row.dateVersementProfil && row.dateVersementProfil !== '—')
            ? row.dateVersementProfil
            : fallbackDate;

          result.push({
            ...row,
            partProfil: partProfilDue,
            _uniqueKey: `${row.missionNo}-credit`,
            dateVersementProfil: versementDate,
            note_commercial: row.note_commercial || '—',
          });
        }
      } else if (isDebit) {
        let partsRep = row.parts_repartition;
        if (partsRep && partsRep.length > 0) {
          const delegatePart = partsRep.find((p: any) => p.is_delegate) || partsRep[0];
          if (delegatePart) {
            const isPaid = delegatePart.part_agence_reversee ?? row.partAgenceReversee;
            const pId = Number(delegatePart.profile_id);
            const agentObj = agentsList.find((a) => Number(a.id) === pId);
            const pName = agentObj
              ? (agentObj.full_name || `${agentObj.first_name || ''} ${agentObj.last_name || ''}`.trim())
              : delegatePart.profile_name || row.profil;

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
              partAgence: getPartAgenceDueFromProfil(row),
              partAgenceReversee: isPaid,
              reglementInterne: isPaid ? 'Réglé' : 'Non réglé',
              _partAgenceReversee: isPaid,
              _uniqueKey: `${row.missionNo}-${pId}-debit`,
              dateRemiseAgence: remiseDate,
              note_commercial: noteCommercial,
            });
          }
        } else {
          const partAgenceDue = getPartAgenceDueFromProfil(row);
          const isPaid = row.partAgenceReversee;
          const fallbackDate = isPaid ? (row.datePaiement && row.datePaiement !== '—' ? row.datePaiement : row.date) : '—';
          const remiseDate = (row.dateRemiseAgence && row.dateRemiseAgence !== '—')
            ? row.dateRemiseAgence
            : fallbackDate;

          result.push({
            ...row,
            partAgence: partAgenceDue,
            _uniqueKey: `${row.missionNo}-debit`,
            dateRemiseAgence: remiseDate,
            note_commercial: row.note_commercial || '—',
          });
        }
      } else {
        // Unsettled / not collected yet
        result.push({
          ...row,
          _uniqueKey: `${row.missionNo}-unsettled`,
          note_commercial: row.note_commercial || '—',
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

    facturationData.filter(isInDateRange).forEach((row) => {
      const isCancelled =
        row.statut === 'Facturation annulée' ||
        row.statut === 'Intervention annulée' ||
        row.statutPaiementUi === 'facturation_annulee' ||
        row.statut === 'Intervention gratuite' ||
        row.statutPaiementUi === 'intervention_gratuite';

      if (!isCancelled) {
        if (!row.isSubscriptionSecondary) {
          if (row.paiement !== 'non_paye') {
            totalCa += (row.montantPaye ?? 0);
          }
          totalPartAgence += row.partAgence;
          
          const isProfilePaid = row.partProfilVersee || row.reglementInterne === 'Réglé';
          if (isProfilePaid) {
            totalPartProfil += row.partProfil;
          }
        }
      }
    });

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
          const isPaye = statut === 'Payé' || uiVal === 'paye' || uiVal === 'integral' || paiement === 'paye';
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

      // Frequency filter
      if (freqFilter !== 'all') {
        const isSub = row.frequency === 'abonnement' || row.originalDemande?.frequency === 'abonnement';
        if (freqFilter === 'ponctuel' && isSub) return false;
        if (freqFilter === 'abonnement' && !isSub) return false;
      }

      // Date Range filter
      const rowDate = parseFrenchDate(row.date);
      if (rowDate) {
        const rowIso = getISODateLocal(rowDate);
        if (dateFrom && rowIso < dateFrom) return false;
        if (dateTo && rowIso > dateTo) return false;
      }

      return true;
    });
  }, [expandedRows, searchQuery, statusFilter, freqFilter, dateFrom, dateTo]);

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
      const isCancelled =
        row.statut === 'Facturation annulée' ||
        row.statut === 'Intervention annulée' ||
        row.statutPaiementUi === 'facturation_annulee' ||
        row.statut === 'Intervention gratuite' ||
        row.statutPaiementUi === 'intervention_gratuite';

      if (isCancelled) return false;

      const rDate = parseFrenchDate(row.date);
      if (!rDate) return false;

      if (startDate && rDate < startDate) return false;
      if (endDate && rDate > endDate) return false;

      return true;
    });

    const statsMap = new Map<string, { name: string; ca: number; dossiers: number }>();
    
    commerciauxList.forEach((c) => {
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username || 'Commercial';
      statsMap.set(fullName, { name: fullName, ca: 0, dossiers: 0 });
    });

    rowsInPeriod.forEach((row) => {
      const commName = row.commercialName || '—';
      if (commName !== '—') {
        if (!statsMap.has(commName)) {
          statsMap.set(commName, { name: commName, ca: 0, dossiers: 0 });
        }
        const data = statsMap.get(commName)!;
        const subInfo = getSubInfo(row);
        if (!subInfo || subInfo.isFirst) {
          data.ca += row.montant;
        }
        data.dossiers += 1;
      }
    });

    let list = Array.from(statsMap.values());

    if (commercialFilter !== 'all') {
      list = list.filter((item) => item.name === commercialFilter);
    }

    const totalCA = list.reduce((sum, item) => sum + item.ca, 0);
    const totalDossiers = list.reduce((sum, item) => sum + item.dossiers, 0);
    const commissionAgence = totalCA * 0.03; // 3% commission

    const sortedList = list
      .map((item) => {
        const pct = totalCA > 0 ? (item.ca / totalCA) * 100 : 0;
        return {
          ...item,
          pct,
          commission: item.ca * 0.03, // 3%
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
  }, [facturationData, periodFilter, commercialFilter, commerciauxList, commDateFrom, commDateTo, getSubInfo]);

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
      const isCancelled =
        row.statut === 'Facturation annulée' ||
        row.statut === 'Intervention annulée' ||
        row.statutPaiementUi === 'facturation_annulee' ||
        row.statut === 'Intervention gratuite' ||
        row.statutPaiementUi === 'intervention_gratuite';

      if (isCancelled) return false;
      if (row.commercialName !== selectedCommercialName) return false;

      const rDate = parseFrenchDate(row.date);
      if (!rDate) return false;

      if (startDate && rDate < startDate) return false;
      if (endDate && rDate > endDate) return false;

      return true;
    });

    const totalRealisation = commRows.reduce((sum, r) => {
      const subInfo = getSubInfo(r);
      if (!subInfo || subInfo.isFirst) {
        return sum + r.montant;
      }
      return sum;
    }, 0);
    const totalDossiers = commRows.length;
    
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
      const isCancelled =
        row.statut === 'Facturation annulée' ||
        row.statut === 'Intervention annulée' ||
        row.statutPaiementUi === 'facturation_annulee' ||
        row.statut === 'Intervention gratuite' ||
        row.statutPaiementUi === 'intervention_gratuite';

      if (isCancelled) return;

      const rDate = parseFrenchDate(row.date);
      if (!rDate) return;

      const mKey = formatMonthFR(rDate);
      const qKey = formatQuarterFR(rDate);
      const yKey = formatYearFR(rDate);

      const subInfo = getSubInfo(row);
      if (!subInfo || subInfo.isFirst) {
        const ca = row.partProfil + row.partAgence;
        teamCAMap.set(mKey, (teamCAMap.get(mKey) || 0) + ca);
        teamCAMap.set(qKey, (teamCAMap.get(qKey) || 0) + ca);
        teamCAMap.set(yKey, (teamCAMap.get(yKey) || 0) + ca);
      }
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
          const subInfo = getSubInfo(r);
          const ca = (!subInfo || subInfo.isFirst) ? r.montant : 0;
          g.realisation += ca;
          g.dossiers += 1;
          g.commAgence += ca * 0.03;
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
  }, [facturationData, selectedCommercialName, periodFilter, commDateFrom, commDateTo, getSubInfo]);

  // Open Edit status modal
  const handleOpenEdit = (row: FacturationRow) => {
    setSelectedRow(row);
    const isCredit = isCreditRow(row);
    const isPaid = isCredit ? (row.partProfilVersee ?? row._partProfilVersee) : (row.partAgenceReversee ?? row._partAgenceReversee);
    setEditIsPaid(isPaid || false);
    
    const dateVal = isCredit
      ? (row.dateVersementProfil && row.dateVersementProfil !== '—' ? formatDateISO(row.dateVersementProfil) : getISODateLocal(new Date()))
      : (row.dateRemiseAgence && row.dateRemiseAgence !== '—' ? formatDateISO(row.dateRemiseAgence) : getISODateLocal(new Date()));
    
    setEditDate(dateVal);
    setEditRemark(row.note_commercial && row.note_commercial !== '—' ? row.note_commercial : '');
    setShowEditModal(true);
  };

  // Open View Details modal
  const handleOpenDetails = (row: FacturationRow) => {
    setSelectedRow(row);
    setShowDetailsModal(true);
  };

  // Save Edit function (marks as Réglé or Non réglé, syncs with backend)
  const handleSaveEdit = async () => {
    if (!selectedRow) return;
    setIsSaving(true);

    try {
      const isPaid = editIsPaid;
      const todayIso = editDate || getISODateLocal(new Date());
      const remark = editRemark;

      const isCancelled =
        selectedRow.statut === 'Facturation annulée' ||
        selectedRow.statut === 'Intervention annulée' ||
        selectedRow.statutPaiementUi === 'facturation_annulee' ||
        selectedRow.statutPaiementUi === 'Facturation annulée' ||
        selectedRow.statut === 'Intervention gratuite' ||
        selectedRow.statutPaiementUi === 'intervention_gratuite';

      const isCrediteur = isCreditRow(selectedRow);

      const isMultiProfile = Boolean(
        (selectedRow.originalDemande?.profils_envoyes && selectedRow.originalDemande.profils_envoyes.length > 1) ||
        (selectedRow.parts_repartition && selectedRow.parts_repartition.length > 0)
      );

      // ─── Credit logic (Agency owes profile) ───
      if (isCrediteur) {
        let allPaid = isPaid;
        let newParts = selectedRow.originalDemande?.formulaire_data?.facturation?.parts_repartition;

        if (selectedRow.demandeId && selectedRow.originalDemande) {
          const originalFormData = selectedRow.originalDemande.formulaire_data || {};
          const facturation = originalFormData.facturation || {};
          const profilsEnvoyes = selectedRow.originalDemande.profils_envoyes;

          if ((!newParts || newParts.length === 0) && profilsEnvoyes && profilsEnvoyes.length > 0) {
            const count = profilsEnvoyes.length;
            const totalProfilsAmount = selectedRow.partProfil;
            const defaultAmount = totalProfilsAmount / count;
            newParts = profilsEnvoyes.map((p: any, idx: number) => ({
              profile_id: p.id,
              profile_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
              amount: defaultAmount,
              is_delegate: idx === 0,
              part_profil_versee: Number(p.id) === selectedRow.profilId ? isPaid : false,
              date_versement_profil: Number(p.id) === selectedRow.profilId && isPaid ? todayIso : null,
              note_commercial: Number(p.id) === selectedRow.profilId ? remark : undefined,
            }));
            allPaid = newParts.every((p: any) => p.part_profil_versee);
          } else if (Array.isArray(facturation.parts_repartition) && facturation.parts_repartition.length > 0 && selectedRow.profilId) {
            newParts = facturation.parts_repartition.map((p: any) => {
              if (Number(p.profile_id) === selectedRow.profilId) {
                return {
                  ...p,
                  part_profil_versee: isPaid,
                  date_versement_profil: isPaid ? todayIso : null,
                  note_commercial: remark,
                };
              }
              return p;
            });
            allPaid = newParts.every((p: any) => p.part_profil_versee);
          }
        }

        if (selectedRow.missionId) {
          const originalFormData = selectedRow.originalDemande?.formulaire_data || {};
          const facturation = originalFormData.facturation || {};

          await updateMission(selectedRow.missionId, {
            part_profil_versee: allPaid,
            date_versement_profil: allPaid ? todayIso : null,
            paiement_client_statut: isCancelled
              ? (facturation.statut_paiement_ui === 'intervention_gratuite' || selectedRow.statutPaiementUi === 'intervention_gratuite' || selectedRow.statut === 'Intervention gratuite' ? 'intervention_gratuite' : 'facturation_annulee')
              : (allPaid ? 'paye' : 'agence_payee_client')
          });
        }

        if (selectedRow.demandeId && selectedRow.originalDemande) {
          const originalFormData = selectedRow.originalDemande.formulaire_data || {};
          const facturation = originalFormData.facturation || {};

          const updatePayload: any = {
            formulaire_data: {
              ...originalFormData,
              facturation: {
                ...facturation,
                parts_repartition: newParts,
                part_profil_versee: allPaid,
                date_versement_profil: allPaid ? todayIso : null,
                statut_paiement_ui: facturation.statut_paiement_ui === 'facturation_annulee'
                  ? 'facturation_annulee'
                  : facturation.statut_paiement_ui === 'intervention_gratuite'
                    ? 'intervention_gratuite'
                    : (allPaid ? 'paye' : 'agence_payee_client'),
              }
            },
            statut_paiement: allPaid ? 'integral' : 'partiel',
          };

          if (!isMultiProfile) {
            updatePayload.note_commercial = remark;
          }

          await updateDemande(selectedRow.demandeId, updatePayload);
        }
      }

      // ─── Debit logic (Profile owes agency) ───
      else {
        let allPaid = isPaid;
        let newParts = selectedRow.originalDemande?.formulaire_data?.facturation?.parts_repartition;

        if (selectedRow.demandeId && selectedRow.originalDemande) {
          const originalFormData = selectedRow.originalDemande.formulaire_data || {};
          const facturation = originalFormData.facturation || {};
          const profilsEnvoyes = selectedRow.originalDemande.profils_envoyes;

          if ((!newParts || newParts.length === 0) && profilsEnvoyes && profilsEnvoyes.length > 0) {
            const count = profilsEnvoyes.length;
            const totalProfilsAmount = selectedRow.partProfil;
            const defaultAmount = totalProfilsAmount / count;
            newParts = profilsEnvoyes.map((p: any, idx: number) => {
              const matchesProfil = Number(p.id) === selectedRow.profilId;
              const updated: any = {
                profile_id: p.id,
                profile_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                amount: defaultAmount,
                is_delegate: idx === 0,
                part_agence_reversee: matchesProfil ? isPaid : false,
                date_remise_agence: matchesProfil && isPaid ? todayIso : null,
                note_commercial: matchesProfil ? remark : undefined,
              };
              if (matchesProfil && selectedRow.encaissePar === 'Profil') {
                updated.part_profil_versee = true;
                updated.date_versement_profil = todayIso;
              }
              return updated;
            });
            allPaid = newParts.every((p: any) => p.part_agence_reversee);
          } else if (Array.isArray(facturation.parts_repartition) && facturation.parts_repartition.length > 0 && selectedRow.profilId) {
            newParts = facturation.parts_repartition.map((p: any) => {
              if (Number(p.profile_id) === selectedRow.profilId) {
                const updated: any = {
                  ...p,
                  part_agence_reversee: isPaid,
                  date_remise_agence: isPaid ? todayIso : null,
                  note_commercial: remark,
                };
                if (selectedRow.encaissePar === 'Profil') {
                  updated.part_profil_versee = true;
                  if (!updated.date_versement_profil) {
                    updated.date_versement_profil = todayIso;
                  }
                }
                return updated;
              }
              return p;
            });
            allPaid = newParts.every((p: any) => p.part_agence_reversee);
          }
        }

        if (selectedRow.missionId) {
          const originalFormData = selectedRow.originalDemande?.formulaire_data || {};
          const facturation = originalFormData.facturation || {};

          await updateMission(selectedRow.missionId, {
            part_agence_reversee: allPaid,
            date_remise_agence: allPaid ? todayIso : null,
            paiement_client_statut: isCancelled
              ? (facturation.statut_paiement_ui === 'intervention_gratuite' || selectedRow.statutPaiementUi === 'intervention_gratuite' || selectedRow.statut === 'Intervention gratuite' ? 'intervention_gratuite' : 'facturation_annulee')
              : (allPaid ? 'paye' : 'profil_paye_client'),
            ...(selectedRow.encaissePar === 'Profil' ? {
              part_profil_versee: true,
              date_versement_profil: todayIso
            } : {})
          });
        }

        if (selectedRow.demandeId && selectedRow.originalDemande) {
          const originalFormData = selectedRow.originalDemande.formulaire_data || {};
          const facturation = originalFormData.facturation || {};

          const updatePayload: any = {
            formulaire_data: {
              ...originalFormData,
              facturation: {
                ...facturation,
                parts_repartition: newParts,
                part_agence_reversee: allPaid,
                date_remise_agence: allPaid ? todayIso : null,
                ...(selectedRow.encaissePar === 'Profil' ? {
                  part_profil_versee: true,
                  date_versement_profil: facturation.date_versement_profil || todayIso
                } : {}),
                statut_paiement_ui: allPaid ? 'paye' : 'profil_paye_client',
              }
            },
            statut_paiement: allPaid ? 'integral' : 'partiel',
          };

          if (!isMultiProfile) {
            updatePayload.note_commercial = remark;
          }

          await updateDemande(selectedRow.demandeId, updatePayload);
        }
      }

      addToast('Mise à jour enregistrée avec succès', 'success');
      setShowEditModal(false);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast("Erreur lors de l'enregistrement de la mise à jour", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // CSV Exporters
  const exportDuesCsv = () => {
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
        `${row.partAgence} DH`,
        (() => {
          const subInfo = getSubInfo(row);
          if (subInfo && !subInfo.isFirst) {
            return `Abonnement ${subInfo.rank}/${subInfo.total}`;
          }
          return `${row.montant} DH`;
        })(),
        row.statut,
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
    const headers = ['Rang', 'Commercial', 'CA Realise', 'Part de l equipe', 'Nombre de dossiers', 'Commission Agence (3%)'];

    const rows = commercialPerformance.ranking.map((item, idx) => [
      idx + 1,
      item.name,
      `${item.ca} DH`,
      `${item.pct.toFixed(2)}%`,
      item.dossiers,
      `${item.commission} DH`,
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
                  <div className="ls-kpi-item indicator-green">
                    <span className="ls-kpi-item-value" style={{ color: '#10b981' }}>{money(kpiStats.unpaidPartAgence)}</span>
                    <span className="ls-kpi-item-label">Part agence non réglée</span>
                    <span className="ls-kpi-item-sub">Reste à percevoir par l'agence</span>
                  </div>
                  <div className="ls-kpi-item indicator-red">
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
                    <option value="paye">Payé</option>
                    <option value="facturation_annulee">Facturation annulée</option>
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
                </div>
              </div>

              {/* Main table */}
              <div className="ls-table-section">
                <div className="ls-table-wrapper">
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
                        <th>Action</th>
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
                              {row.profilId ? (
                                <button type="button" className="fg-link-btn" onClick={() => goToProfilDetails(row.profilId)}>
                                  {row.profil}
                                </button>
                              ) : row.profil}
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
                                const hasPartsRepartition = Array.isArray(row.parts_repartition) && row.parts_repartition.length > 0;
                                const hasExplicitPartAgence = row.partAgence > 0;
                                if (!hasPartsRepartition && !hasExplicitPartAgence) return '—';
                                return money(row.partAgence);
                              })()}
                            </td>
                            <td className="ls-val-bold">
                              {(() => {
                                const subInfo = getSubInfo(row);
                                if (subInfo && !subInfo.isFirst) {
                                  return `Abonnement ${subInfo.rank}/${subInfo.total}`;
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
                              <span className={`ls-pill ${reglementPaid ? 'outline-teal' : 'outline-pink'}`}>
                                {reglementPaid ? `Réglé - ${formatDateFR(reglementDate)}` : 'Non réglé'}
                              </span>
                            </td>
                            <td>{row.note_commercial || '—'}</td>
                            <td>
                              <span className={`ls-pill ${isSub ? 'blue' : 'gray'}`}>
                                {freqLabel}
                              </span>
                            </td>
                            <td>
                              <div className="ls-action-cell">
                                {hasPermission(user, 'validation_paiements_dus') && (
                                  <button
                                    type="button"
                                    className="ls-action-btn"
                                    title="Modifier le règlement"
                                    onClick={() => handleOpenEdit(row)}
                                  >
                                    <Pencil size={13} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="ls-action-btn"
                                  title="Voir les détails"
                                  onClick={() => handleOpenDetails(row)}
                                >
                                  <Eye size={13} />
                                </button>
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
                </div>
              </div>
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
                  <div className="ls-comm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
                  <div className="ls-comm-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
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
                        <p>Commission agence (3%)</p>
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
                              <span className="ls-ranking-progress-label">Contribution</span>
                              <span className="ls-ranking-progress-val">{item.pct.toFixed(2)}%</span>
                            </div>
                            <div className="ls-progress-bar">
                              <div className="ls-progress-fill" style={{ width: `${item.pct}%` }} />
                            </div>
                          </div>

                          <div className="ls-ranking-stats">
                            <div className="ls-ranking-stat-item">
                              <span className="ls-ranking-stat-label">CA Réalisé</span>
                              <span className="ls-ranking-stat-val">{money(item.ca)}</span>
                            </div>
                            <div className="ls-ranking-stat-item">
                              <span className="ls-ranking-stat-label">Dossiers</span>
                              <span className="ls-ranking-stat-val">{item.dossiers}</span>
                            </div>
                            <div className="ls-ranking-stat-item">
                              <span className="ls-ranking-stat-label">Commission</span>
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
                            <th>CA Réalisé</th>
                            <th>Taux</th>
                            <th>Dossiers</th>
                            <th>Commission Agence</th>
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
                                <td>
                                  <span className="ls-pill gray" style={{ backgroundColor: '#fce7f3', color: '#be185d', fontWeight: 'bold' }}>
                                    {item.pct.toFixed(2)}%
                                  </span>
                                </td>
                                <td>{item.dossiers}</td>
                                <td className="ls-val-bold" style={{ color: '#059669' }}>
                                  {money(item.commission)}
                                </td>
                              </tr>
                            );
                          })}
                          {commercialPerformance.ranking.length === 0 && (
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
              )}
            </>
          )}

          {/* ─── MODAL: EDIT REGLEMENT ─── */}
          {showEditModal && selectedRow && (
            <div className="ls-modal-backdrop">
              <div className="ls-modal">
                <div className="ls-modal-header">
                  <div>
                    <h3 className="ls-modal-title">Modifier la mission</h3>
                    <p className="ls-modal-subtitle">
                      {selectedRow.profil} · {selectedRow.client}
                    </p>
                  </div>
                  <button className="ls-modal-close" onClick={() => setShowEditModal(false)}>
                    <X size={18} />
                  </button>
                </div>

                <div className="ls-modal-body">
                  {/* Settle Toggle Switch */}
                  <div className="ls-form-toggle-row">
                    <div className="ls-form-toggle-info">
                      <span className="ls-form-toggle-title">
                        {isCreditRow(selectedRow) ? 'Règlement FDM' : 'Règlement Agence'}
                      </span>
                      <span className="ls-form-toggle-desc">
                        {isCreditRow(selectedRow)
                          ? 'Part profil versée à la FDM'
                          : "Part agence reversée par le profil à l'agence"}
                      </span>
                    </div>
                    <label className="ls-switch">
                      <input
                        type="checkbox"
                        checked={editIsPaid}
                        onChange={(e) => setEditIsPaid(e.target.checked)}
                      />
                      <span className="ls-slider" />
                    </label>
                  </div>

                  {/* Payment date picker */}
                  <div className="ls-form-group">
                    <label>Date de règlement</label>
                    <input
                      type="date"
                      className="ls-text-input"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>

                  {/* Internal remarks */}
                  <div className="ls-form-group">
                    <label>Remarque</label>
                    <textarea
                      className="ls-textarea"
                      placeholder="Note interne..."
                      value={editRemark}
                      onChange={(e) => setEditRemark(e.target.value)}
                    />
                  </div>
                </div>

                <div className="ls-modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowEditModal(false)}
                    disabled={isSaving}
                  >
                    Annuler
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
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
                        <span className="ls-detail-value">{selectedRow.profil || '—'}</span>
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
                        <span className={`ls-pill ${
                          (() => {
                            const isCredit = isCreditRow(selectedRow);
                            const reglementPaid = isCredit ? (selectedRow.partProfilVersee ?? selectedRow._partProfilVersee) : (selectedRow.partAgenceReversee ?? selectedRow._partAgenceReversee);
                            return reglementPaid ? 'outline-teal' : 'outline-pink';
                          })()
                        }`}>
                          {(() => {
                            const isCredit = isCreditRow(selectedRow);
                            const reglementPaid = isCredit ? (selectedRow.partProfilVersee ?? selectedRow._partProfilVersee) : (selectedRow.partAgenceReversee ?? selectedRow._partAgenceReversee);
                            const reglementDate = isCredit ? selectedRow.dateVersementProfil : selectedRow.dateRemiseAgence;
                            return reglementPaid
                              ? `Réglé - ${formatDateFR(reglementDate)}`
                              : 'Non réglé';
                          })()}
                        </span>
                      </div>
                      <div className="ls-detail-row">
                        <span className="ls-detail-label">Remarque</span>
                        <span className="ls-detail-value">{selectedRow.note_commercial || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ls-modal-footer">
                  <button className="btn btn-primary" onClick={() => setShowDetailsModal(false)}>
                    Fermer
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
