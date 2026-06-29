import { useEffect, useState, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar, Check, ChevronDown, Download, FileText, Pencil, Plus, Search, Upload, X, Trash2, Info } from 'lucide-react';
import { createCaisseMouvement, exportCaisseCsv, getCaisse, getCaisseSolde, updateCaisseMouvement, getMissions, getDemandesHistorique, deleteCaisseMouvement } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { hasPermission } from '../../utils/permissions';
import './LaCaisse.css';

interface CashRow {
  id: number;
  date: string;
  type: 'Entrée' | 'Sortie' | 'Alimentation de la caisse';
  typeCode: 'entree' | 'sortie' | 'alimentation';
  categorie: string;
  libelle: string;
  client: string;
  modePaiement: string;
  modePaiementCode: 'especes' | 'virement' | 'cheque' | 'paiement_agence';
  montant: string;
  montantNumber: number;
  utilisateur: string;
  document: string;
  notes: string; 
}

const paymentModes = ['Espèces', 'Virement', 'Chèque', 'Paiement agence'];
const operationTypes = ['Entrée', 'Sortie', 'Alimentation de la caisse'];
const categories = [
  'Encaissement client (auto)',
  'Remise FM — espèces',
  'Dépôt commercial — espèces',
  'Virement client reçu',
  'Autre entrée',
  'Salaires (équipe agence)',
  'Paiement femmes de ménage',
  'Achat produits ménagers',
  'Achat matériel / équipement',
  'Loyer & charges bureaux',
  'Publicité & Marketin'
];

const todayInputDate = (): string => new Date().toISOString().slice(0, 10);
const moneyFormatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const paymentCodeToLabel = (value: string): 'Espèces' | 'Virement' | 'Chèque' | 'Paiement agence' => {
  if (value === 'virement') return 'Virement';
  if (value === 'cheque') return 'Chèque';
  if (value === 'paiement_agence') return 'Paiement agence';
  return 'Espèces';
};

const paymentLabelToCode = (value: string): 'especes' | 'virement' | 'cheque' | 'paiement_agence' => {
  if (value === 'Virement') return 'virement';
  if (value === 'Chèque') return 'cheque';
  if (value === 'Paiement agence') return 'paiement_agence';
  return 'especes';
};

const typeCodeToLabel = (value: string): 'Entrée' | 'Sortie' | 'Alimentation de la caisse' => {
  if (value === 'sortie') return 'Sortie';
  if (value === 'alimentation') return 'Alimentation de la caisse';
  return 'Entrée';
};
const typeLabelToCode = (value: string): 'entree' | 'sortie' | 'alimentation' => {
  if (value === 'Sortie') return 'sortie';
  if (value === 'Alimentation de la caisse') return 'alimentation';
  return 'entree';
};

const toDisplayDate = (value: string): string => {
  if (!value) return '—';
  if (value.includes('/')) return value;
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const toInputDate = (value: string): string => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
};

const extractAmount = (value: string): string => {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return '0.00';
  return parsed.toString();
};

export default function LaCaisse() {
  const user = useAuthStore(state => state.user);

  const canSeeTresorerie = hasPermission(user, 'consulter_tresorerie');
  const canSeeCaisse = hasPermission(user, 'consulter_solde_caisse') || hasPermission(user, 'mouvements_caisse') || hasPermission(user, 'sorties_caisse');
  const defaultTab = canSeeTresorerie ? 'tresorerie' : (canSeeCaisse ? 'caisse' : 'tresorerie');

  const [activeTab, setActiveTab] = useState<'tresorerie' | 'caisse'>(defaultTab);

  useEffect(() => {
    if (!canSeeTresorerie && activeTab === 'tresorerie' && canSeeCaisse) {
      setActiveTab('caisse');
    } else if (!canSeeCaisse && activeTab === 'caisse' && canSeeTresorerie) {
      setActiveTab('tresorerie');
    }
  }, [canSeeTresorerie, canSeeCaisse, activeTab]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState<CashRow[]>([]);
  const [operationsCount, setOperationsCount] = useState(0);
  const [stats, setStats] = useState({ total_entrees: 0, total_sorties: 0, solde: 0, solde_jour: 0 });
  const [loadingRows, setLoadingRows] = useState(true);
  const [commissionAgence, setCommissionAgence] = useState(0);
  const [caTotal, setCaTotal] = useState(0);
  const [partAgence, setPartAgence] = useState(0);

  const [typeFilter, setTypeFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [uniqueUsers, setUniqueUsers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null);
  const [savingMovement, setSavingMovement] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [selectedOperationType, setSelectedOperationType] = useState('Entrée');
  const [isOperationMenuOpen, setIsOperationMenuOpen] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('Espèces');
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const [movementDate, setMovementDate] = useState(todayInputDate());
  const [movementAmount, setMovementAmount] = useState('0.00');
  const [movementLabel, setMovementLabel] = useState('');
  const [movementClient, setMovementClient] = useState('');
  const [movementUser, setMovementUser] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [movementDocumentName, setMovementDocumentName] = useState('Cliquer pour télécharger (facture, reçu...)');
  const [movementDocumentFile, setMovementDocumentFile] = useState<File | null>(null);

  const soldeSparklineData = useMemo(() => {
    if (rows.length === 0) {
      return {
        strokePath: 'M 0,10 L 100,10',
        fillPath: 'M 0,10 L 100,10 L 100,20 L 0,20 Z'
      };
    }

    const chronological = [...rows].reverse();
    const balances: number[] = [];
    let current = 0;
    for (const r of chronological) {
      if (r.typeCode === 'sortie') {
        current -= r.montantNumber;
      } else {
        current += r.montantNumber;
      }
      balances.push(current);
    }

    if (balances.length === 1) {
      return {
        strokePath: 'M 0,10 L 100,10',
        fillPath: 'M 0,10 L 100,10 L 100,20 L 0,20 Z'
      };
    }

    const minVal = Math.min(...balances);
    const maxVal = Math.max(...balances);
    const range = maxVal - minVal;

    const points = balances.map((val, idx) => {
      const x = (idx / (balances.length - 1)) * 100;
      const y = range === 0 ? 10 : 18 - ((val - minVal) / range) * 16;
      return { x, y };
    });

    const strokePath = `M ${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
    const fillPath = `${strokePath} L 100,20 L 0,20 Z`;

    return { strokePath, fillPath };
  }, [rows]);

  const fetchStats = async () => {
    const response = await getCaisseSolde({ caisse_type: activeTab });
    setStats({
      total_entrees: Number(response.data.total_entrees || 0),
      total_sorties: Number(response.data.total_sorties || 0),
      solde: Number(response.data.solde || 0),
      solde_jour: Number(response.data.solde_jour || 0),
    });
  };

  const fetchRows = async () => {
    setLoadingRows(true);
    try {
      const params: Record<string, string | number> = {};
      params.caisse_type = activeTab;
      if (activeTab === 'tresorerie') {
        if (typeFilter !== 'all') params.type_mouvement = typeFilter;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (userFilter !== 'all') params.utilisateur = userFilter;
        if (searchTerm.trim()) params.search = searchTerm.trim();
        params.page = currentPage;
      } else {
        if (typeFilter !== 'all') params.type_mouvement = typeFilter;
        if (modeFilter !== 'all') params.mode_paiement = modeFilter;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (searchTerm.trim()) params.search = searchTerm.trim();
      }

      const response = await getCaisse(params);
      const payload = response.data.results ?? response.data;
      const total = typeof response.data.count === 'number' ? response.data.count : payload.length;

      const mappedRows: CashRow[] = payload.map((item: Record<string, unknown>) => {
        const montant = Number(item.montant ?? 0);
        const typeCode = String(item.type_mouvement || 'entree') as 'entree' | 'sortie' | 'alimentation';
        const modeCode = String(item.mode_paiement || 'especes') as 'especes' | 'virement' | 'cheque' | 'paiement_agence';

        return {
          id: Number(item.id),
          date: toDisplayDate(String(item.date || '')),
          type: typeCodeToLabel(typeCode),
          typeCode,
          categorie: String(item.categorie || 'Non catégorisé'),
          libelle: String(item.description || ''),
          client: String(item.client_display || item.client_nom || '—'),
          modePaiement: paymentCodeToLabel(modeCode),
          modePaiementCode: modeCode,
          montant: `${typeCode === 'sortie' ? '-' : '+'}${moneyFormatter.format(Math.abs(montant))} DH`,
          montantNumber: montant,
          utilisateur: String(item.utilisateur || '—'),
          document: item.document_file ? 'Fichier' : '—',
          notes: String(item.notes || '—'),
        };
      });

      setRows(mappedRows);
      setOperationsCount(total);
    } finally {
      setLoadingRows(false);
    }
  };

  // Charger les données de commission et CA depuis les mêmes sources que Vue Globale
  const fetchFinanceKpis = async () => {
    try {
      const missions: any[] = [];
      const demands: any[] = [];

      try {
        let page = 1;
        while (true) {
          const res = await getMissions({ ordering: '-created_at', page });
          const data = res.data;
          const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
          missions.push(...rows);
          if (!data?.next || rows.length === 0) break;
          page++;
        }
      } catch { /* skip */ }

      try {
        let page = 1;
        while (true) {
          const res = await getDemandesHistorique({ ordering: '-created_at', page });
          const data = res.data;
          const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
          demands.push(...rows);
          if (!data?.next || rows.length === 0) break;
          page++;
        }
      } catch { /* skip */ }

      const missionDemandeIds = new Set(missions.map((m: any) => m.demande_detail?.id).filter(Boolean));
      const uniqueDemands = demands.filter((d: any) => !missionDemandeIds.has(d.id));

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;



      const formatDateFR = (value?: string): string => {
        if (!value) return '—';
        if (value.includes('/')) return value;
        const cleanValue = value.includes('T') ? value.split('T')[0] : value.split(' ')[0];
        const [year, month, day] = cleanValue.split('-');
        if (!year || !month || !day) return value;
        return `${day}/${month}/${year}`;
      };

      const mappedRows = [
        ...missions.map(m => {
          const dem = m.demande_detail || {};
          const fact = dem?.formulaire_data?.facturation || {};
          const rawStatus = fact.statut_paiement_ui || m.paiement_client_statut || (dem?.statut_paiement === 'integral' ? 'paye' : dem?.statut_paiement === 'acompte' ? 'paiement_en_attente' : dem?.statut_paiement === 'partiel' ? 'paiement_partiel' : 'non_paye');
          const isGratuit = rawStatus === 'intervention_gratuite';
          const isFacturationAnnulee = !isGratuit && fact.facturation_annulee === true;
          const isInterventionAnnulee = !isFacturationAnnulee && (m.statut === 'annulee' || dem?.statut === 'annule');
          const statut = isGratuit ? 'Intervention gratuite' : isInterventionAnnulee ? 'Intervention annulée' : isFacturationAnnulee ? 'Facturation annulée' : 'Confirmée';
          const encaissePar = ['profil_paye_client'].includes(rawStatus) ? 'Profil' : 'Agence';
          const partProfilVersee = encaissePar === 'Agence' ? Boolean(m.part_profil_versee) : Boolean(m.part_agence_reversee);
          const reglementInterne = partProfilVersee ? 'Réglé' : 'Non réglé';

          const parts = dem?.parts_repartition || fact.parts_repartition || [];
          const numMissions = Math.max(1, parts.length);
          const profilId = m.agent_detail?.id;
          const partInfo = parts.find((p: any) => p.profile_id == profilId);
          const montantProfile = Number(partInfo?.amount || 0);
          const totalProfilsAmount = parts.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
          const ratio = totalProfilsAmount > 0 && montantProfile > 0 ? (montantProfile / totalProfilsAmount) : (1 / numMissions);

          const partAgence = Number(fact.part_agence ?? 0) * ratio;
          const partsSum = parts.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
          const rawPartProfil = partsSum > 0
            ? partsSum
            : Number(fact.part_profil ?? (fact.montant_agence_doit_profil || (Number(dem?.prix ?? 0) - Number(fact.part_agence ?? 0))));
          const partProfil = rawPartProfil * ratio;
          const montant = Number(dem?.prix ?? 0) * ratio;
          const rawMontantPaye = m.montant_paye !== undefined ? Number(m.montant_paye) : 0;
          const paiement = ['paye', 'agence_payee_client', 'profil_paye_client', 'effectue', 'integral'].includes(rawStatus) ? 'paye' : ['paiement_partiel', 'paiement_en_attente', 'partiel', 'acompte'].includes(rawStatus) ? 'partiellement_paye' : 'non_paye';
          let montantPaye = rawMontantPaye * ratio;
          if (montantPaye === 0) {
            if (paiement === 'paye') montantPaye = montant;
            else if (paiement === 'partiellement_paye') montantPaye = 0;
          }
          const montantProfilAnnulation = Number(dem?.montant_profil_annulation || m.montant_profil_annulation || fact.montant_profil_annulation || 0) * ratio;

          return {
            demandeId: dem.id,
            parentDemandeId: dem.parent_demande || dem.parent_demande_id || null,
            frequency: dem.frequency || null,
            date: dem.date_intervention ? formatDateFR(dem.date_intervention) : '',
            statut,
            statutPaiementUi: rawStatus,
            paiement,
            partAgence,
            partProfil,
            montant,
            montantPaye,
            montantProfilAnnulation,
            profilSeraPaye: dem.profil_sera_paye !== undefined ? Boolean(dem.profil_sera_paye) : Boolean(m.profil_sera_paye !== undefined ? m.profil_sera_paye : fact.profil_sera_paye),
            encaissePar,
            reglementInterne,
            montantProfilDoitAgence: Number(fact.montant_profil_doit_agence || 0) * ratio,
            montantAgenceDoitProfil: Number(fact.montant_agence_doit_profil || 0) * ratio,
            isSubscriptionPrimary: false,
            isSubscriptionSecondary: false,
            profilId,
            profil: m.agent_detail ? (m.agent_detail.full_name || `${m.agent_detail.first_name || ''} ${m.agent_detail.last_name || ''}`).trim() : '—',
            parts_repartition: parts,
          };
        }),
        ...uniqueDemands.map(d => {
          const fact = d?.formulaire_data?.facturation || {};
          const rawStatus = fact.statut_paiement_ui || d.statut_paiement_ui || (d.statut_paiement === 'integral' ? 'paye' : d.statut_paiement === 'acompte' ? 'paiement_en_attente' : d.statut_paiement === 'partiel' ? 'paiement_partiel' : 'non_confirme');
          const isGratuit = rawStatus === 'intervention_gratuite';
          const isFacturationAnnulee = !isGratuit && fact.facturation_annulee === true;
          const isInterventionAnnulee = !isFacturationAnnulee && (d.statut === 'annule');
          const statut = isGratuit ? 'Intervention gratuite' : isInterventionAnnulee ? 'Intervention annulée' : isFacturationAnnulee ? 'Facturation annulée' : 'Confirmée';
          const encaissePar = ['profil_paye_client'].includes(rawStatus) ? 'Profil' : 'Agence';
          const partProfilVersee = encaissePar === 'Agence' ? Boolean(fact.part_profil_versee) : Boolean(fact.part_agence_reversee);
          const reglementInterne = partProfilVersee ? 'Réglé' : 'Non réglé';

          const partAgence = (fact.part_agence !== null && fact.part_agence !== undefined)
            ? Number(fact.part_agence)
            : (d?.part_agence !== null && d?.part_agence !== undefined)
              ? Number(d.part_agence)
              : 0;

          const parts = fact.parts_repartition || d.parts_repartition || [];
          const partsSum = parts.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
          const partProfil = partsSum > 0
            ? partsSum
            : Number(fact.part_profil ?? (fact.montant_agence_doit_profil || (Number(d?.prix ?? 0) - partAgence)));
          const montant = Number(d?.prix ?? 0);
          const isPaidStatus = ['paye', 'integral', 'effectue', 'profil_paye_client', 'Profil payé / Client', 'agence_payee_client', 'Agence payée / Client'].includes(rawStatus);
          const isPartiallyPaidStatus = ['paiement_partiel', 'paiement_en_attente', 'Paiement partiel', 'Paiement en attente', 'partiel', 'acompte'].includes(rawStatus);
          const paiement = isPaidStatus ? 'paye' : (isPartiallyPaidStatus ? 'partiellement_paye' : 'non_paye');
          const montantPaye = paiement === 'paye'
            ? (Number(fact.montant_verse) || montant)
            : (paiement === 'partiellement_paye' ? (Number(fact.montant_verse) || 0) : 0);
          const montantProfilAnnulation = Number(d.montant_profil_annulation || fact.montant_profil_annulation || 0);

          return {
            demandeId: d.id,
            parentDemandeId: d.parent_demande || d.parent_demande_id || null,
            frequency: d.frequency || null,
            date: d.date_intervention ? formatDateFR(d.date_intervention) : '',
            statut,
            statutPaiementUi: rawStatus,
            paiement,
            partAgence,
            partProfil,
            montant,
            montantPaye,
            montantProfilAnnulation,
            profilSeraPaye: d.profil_sera_paye !== undefined ? Boolean(d.profil_sera_paye) : Boolean(fact.profil_sera_paye),
            encaissePar,
            reglementInterne,
            montantProfilDoitAgence: Number(fact.montant_profil_doit_agence || 0),
            montantAgenceDoitProfil: Number(fact.montant_agence_doit_profil || 0),
            isSubscriptionPrimary: false,
            isSubscriptionSecondary: false,
            profilId: d.profil_id || null,
            profil: d.profil_name || '—',
            parts_repartition: fact.parts_repartition || d.parts_repartition || [],
          };
        })
      ];

      // Group by subscription and identify primary vs secondary rows
      const subscriptionGroups = new Map<number, any[]>();
      for (const row of mappedRows) {
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

      const getPartProfilDueFromAgence = (row: any): number => {
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
          const due = Number((row.montantPaye * (row.partProfil / row.montant)).toFixed(2));
          if (due > 0) return Math.min(row.partProfil, due);
        }

        return row.partProfil;
      };

      const getPartAgenceDueFromProfil = (row: any): number => {
        if (row.statutPaiementUi === 'profil_paye_client' || row.statutPaiementUi === 'Profil payé / Client') {
          return Number(row.montantProfilDoitAgence || 0);
        }

        if (row.statutPaiementUi === 'facturation_annulee' || row.statut === 'Facturation annulée' || row.statut === 'Intervention annulée' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite') {
          return 0;
        }

        if (row.encaissePar !== 'Profil') return 0;

        if (row.reglementInterne === 'Réglé') {
          return Number(row.montantProfilDoitAgence || row.partAgence || 0);
        }

        if (row.montantProfilDoitAgence !== undefined && row.montantProfilDoitAgence > 0) {
          return row.montantProfilDoitAgence;
        }

        if (row.montant > 0) {
          const due = Number((row.montantPaye * (row.partAgence / row.montant)).toFixed(2));
          if (due > 0) return Math.min(row.partAgence, due);
        }

        return row.partAgence;
      };

      const getCommissionAgenceEncaissee = (row: any): number => {
        if (row.statutPaiementUi === 'facturation_annulee' || row.statutPaiementUi === 'Facturation annulée' || row.statut === 'Facturation annulée' || row.statut === 'Intervention annulée' || row.statutPaiementUi === 'intervention_gratuite' || row.statut === 'Intervention gratuite') {
          return row.profilSeraPaye ? -(Number(row.montantProfilAnnulation) || 0) : 0;
        }

        if (row.isSubscriptionSecondary) {
          const hasProfile = row.profilId ||
            (row.parts_repartition && row.parts_repartition.length > 0) ||
            (row.profil && row.profil !== '—' && row.profil !== 'Profil inconnu');
          return hasProfile ? -row.partProfil : 0;
        }

        // If this is a primary subscription intervention, we compute the commission dynamically
        // based on the total subscription price minus this row's profile part (our share for this run).
        if (row.isSubscriptionPrimary) {
          const isPaid = row.paiement === 'paye' ||
            row.paiement === 'partiellement_paye' ||
            ['paye', 'Payé', 'agence_payee_client', 'Agence payée / Client', 'profil_paye_client', 'Profil payé / Client'].includes(row.statutPaiementUi);
          if (!isPaid) return 0;
          return Math.max(0, row.montant - row.partProfil);
        }

        if (row.statutPaiementUi === 'agence_payee_client' || row.statutPaiementUi === 'Agence payée / Client') {
          return row.partAgence;
        }

        if (row.statutPaiementUi === 'profil_paye_client' || row.statutPaiementUi === 'Profil payé / Client') {
          return Number(row.montantProfilDoitAgence || row.partAgence || 0);
        }

        if (row.statutPaiementUi === 'paye' || row.statutPaiementUi === 'Payé') {
          return row.partAgence;
        }

        if (row.paiement !== 'paye') return 0;

        if (row.encaissePar === 'Agence') {
          const partProfilDue = getPartProfilDueFromAgence(row);
          return Math.max(row.montant - partProfilDue, 0);
        }

        if (row.reglementInterne === 'Réglé') {
          return getPartAgenceDueFromProfil(row);
        }

        return 0;
      };

      let totalCommission = 0;
      let totalCA = 0;
      let totalPartAgence = 0;
      for (const row of mappedRows) {
        if (row.date) {
          const parts = row.date.split('/');
          const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : row.date;
          const rowMonth = isoDate.slice(0, 7);
          if (rowMonth !== currentMonth) continue;
        } else continue;

        totalCommission += getCommissionAgenceEncaissee(row);

        const isCancelled = row.statut === 'Intervention annulée' || row.statut === 'Facturation annulée' || row.statutPaiementUi === 'facturation_annulee';
        const isGratuit = row.statut === 'Intervention gratuite' || row.statutPaiementUi === 'intervention_gratuite';
        if (isCancelled || isGratuit) continue;
        if (row.isSubscriptionSecondary) continue;

        if (row.paiement !== 'non_paye') {
          totalCA += (row.montantPaye ?? 0);
        }
        totalPartAgence += row.partAgence;
      }

      setCommissionAgence(totalCommission);
      setCaTotal(totalCA);
      setPartAgence(totalPartAgence);
    } catch { /* skip */ }
  };

  useEffect(() => {
    void fetchStats();
    void fetchFinanceKpis();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setTypeFilter('all');
    setModeFilter('all');
    setUserFilter('all');
  }, [activeTab]);

  useEffect(() => {
    void fetchRows();
    void fetchStats();
  }, [activeTab, typeFilter, modeFilter, dateFrom, dateTo, searchTerm, userFilter, currentPage]);

  useEffect(() => {
    if (userFilter === 'all') {
      const users = Array.from(new Set(rows.map(r => r.utilisateur).filter((u) => u && u !== '—')));
      setUniqueUsers(users);
    }
  }, [rows, userFilter]);

  const closeMovementModal = () => {
    setShowMovementModal(false);
    setIsOperationMenuOpen(false);
    setIsPaymentMenuOpen(false);
    setIsCategoryMenuOpen(false);
  };

  const openAddMovementModal = () => {
    setIsEditMode(false);
    setEditingMovementId(null);
    setSelectedOperationType(hasPermission(user, 'mouvements_caisse') ? 'Entrée' : 'Sortie');
    setSelectedPaymentMode('Espèces');
    setSelectedCategory('');
    setMovementDate(todayInputDate());
    setMovementAmount('0.00');
    setMovementLabel('');
    setMovementClient('');
    setMovementUser(user?.full_name || user?.first_name || '');
    setMovementNotes('');
    setMovementDocumentName('Cliquer pour télécharger (facture, reçu...)');
    setMovementDocumentFile(null);
    setShowMovementModal(true);
  };

  const openEditMovementModal = (row: CashRow) => {
    setIsEditMode(true);
    setEditingMovementId(row.id);
    setSelectedOperationType(row.type);
    setSelectedPaymentMode(row.modePaiement);
    setSelectedCategory(row.categorie === 'Non catégorisé' ? '' : row.categorie);
    setMovementDate(toInputDate(row.date));
    setMovementAmount(extractAmount(row.montant));
    setMovementLabel(row.libelle);
    setMovementClient(row.client === '—' ? '' : row.client);
    setMovementUser(row.utilisateur === '—' ? '' : row.utilisateur);
    setMovementNotes(row.notes === '—' ? '' : row.notes);
    setMovementDocumentName('Cliquer pour télécharger (facture, reçu...)');
    setMovementDocumentFile(null);
    setShowMovementModal(true);
  };

  const saveMovement = async () => {
    if (!movementLabel.trim() || !movementDate) return;

    const opTypeCode = typeLabelToCode(selectedOperationType);
    const hasCaissePerm = opTypeCode === 'sortie' ? hasPermission(user, 'sorties_caisse') : hasPermission(user, 'mouvements_caisse');
    const hasTresorPerm = activeTab === 'tresorerie' && hasPermission(user, 'creer_mouvements_tresorerie');
    if (!hasCaissePerm && !hasTresorPerm) {
      alert("Vous n'avez pas la permission de saisir cette opération.");
      return;
    }

    const formData = new FormData();
    formData.append('type_mouvement', opTypeCode);
    formData.append('date', movementDate);
    formData.append('montant', extractAmount(movementAmount));
    formData.append('description', movementLabel.trim());
    formData.append('mode_paiement', paymentLabelToCode(selectedPaymentMode));
    formData.append('client_nom', movementClient.trim());
    formData.append('utilisateur', movementUser.trim());
    formData.append('notes', movementNotes.trim());
    formData.append('categorie', selectedCategory);
    formData.append('caisse_type', activeTab);
    if (movementDocumentFile) formData.append('document_file', movementDocumentFile);

    setSavingMovement(true);
    try {
      if (isEditMode && editingMovementId) {
        await updateCaisseMouvement(editingMovementId, formData);
      } else {
        await createCaisseMouvement(formData);
      }
      await Promise.all([fetchRows(), fetchStats()]);
      closeMovementModal();
    } finally {
      setSavingMovement(false);
    }
  };

  const handleDeleteMovement = async (id: number) => {
    try {
      await deleteCaisseMouvement(id);
      await Promise.all([fetchRows(), fetchStats()]);
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
    }
  };

  const buildFiltersParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (typeFilter !== 'all') params.type_mouvement = typeFilter;
    if (modeFilter !== 'all') params.mode_paiement = modeFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (searchTerm.trim()) params.search = searchTerm.trim();
    return params;
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const response = await exportCaisseCsv(buildFiltersParams());
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      link.href = url;
      link.download = `mouvements-caisse-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  const hasAccess = hasPermission(user, 'consulter_tresorerie') || hasPermission(user, 'mouvements_caisse') || hasPermission(user, 'sorties_caisse') || hasPermission(user, 'consulter_solde_caisse');
  if (!hasAccess) {
    return (
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#ef4444', fontWeight: 600, fontSize: 16 }}>
        <X size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
        Vous n'avez pas l'autorisation d'accéder à la gestion de trésorerie et caisse.
      </div>
    );
  }

  return (
    <div className="page lc-page">
      <section className="lc-hero">
        <div className="lc-hero-title-wrap">
          <FileText size={20} />
          <div>
            <h1>Trésorerie et Caisse</h1>
            <p>Vue trésorerie et gestion de la caisse</p>
          </div>
        </div>
      </section>

      {/* TABS SWITCHER */}
      <div className="lc-tabs" style={{ marginBottom: '1.5rem' }}>
        {canSeeTresorerie && (
          <button
            type="button"
            className={`lc-tab ${activeTab === 'tresorerie' ? 'active' : ''}`}
            onClick={() => setActiveTab('tresorerie')}
          >
            Trésorerie
          </button>
        )}
        {canSeeCaisse && (
          <button
            type="button"
            className={`lc-tab ${activeTab === 'caisse' ? 'active' : ''}`}
            onClick={() => setActiveTab('caisse')}
          >
            La Caisse
          </button>
        )}
      </div>

      {activeTab === 'tresorerie' && canSeeTresorerie ? (
        <>
          {/* TRESORERIE STATS GRID */}
          <div className="lc-stats-banner" style={{ marginBottom: '1.5rem' }}>
            {/* VISION COMMERCIALE */}
            <div className="lc-stats-group commercial">
              <div className="lc-stats-group-header">
                <span>Vision Commerciale</span>
                <div className="lc-header-line" />
              </div>
              <div className="lc-stats-group-row">
                <div className="lc-stat-card card-ca-total">
                  <div className="lc-stat-card-title">
                    <span>CA Total</span>
                  </div>
                  <strong>{moneyFormatter.format(caTotal)} DH</strong>
                  <span className="lc-stat-subtitle">Total encaissé clients</span>
                </div>
                <div className="lc-stats-operator">→</div>
                <div className="lc-stat-card card-part-agence">
                  <div className="lc-stat-card-title">
                    <span>Part de l'agence</span>
                    <span className="lc-info-trigger" title={`${caTotal > 0 ? Math.round((partAgence / caTotal) * 100) : 0}% du CA total`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <Info size={12} />
                    </span>
                  </div>
                  <strong>{moneyFormatter.format(partAgence)} DH</strong>
                  <span className="lc-stat-subtitle" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ padding: '2px 6px', background: '#fef3c7', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>
                      {caTotal > 0 ? Math.round((partAgence / caTotal) * 100) : 0}% du CA total
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* VISION TRÉSORERIE */}
            <div className="lc-stats-group treasury">
              <div className="lc-stats-group-header">
                <span>Vision Trésorerie</span>
                <div className="lc-header-line" />
              </div>
              <div className="lc-stats-group-row">
                <div className="lc-stat-card card-total-entrees">
                  <div className="lc-stat-card-title">
                    <span>Total Entrées</span>
                  </div>
                  <strong>+{moneyFormatter.format(rows.filter(r => r.typeCode === 'entree' || r.typeCode === 'alimentation').reduce((acc, r) => acc + r.montantNumber, 0))} DH</strong>
                  <span className="lc-stat-subtitle">Flux entrants</span>
                </div>
                <div className="lc-stats-operator">-</div>
                <div className="lc-stat-card card-total-sorties">
                  <div className="lc-stat-card-title">
                    <span>Total Sorties</span>
                  </div>
                  <strong>-{moneyFormatter.format(rows.filter(r => r.typeCode === 'sortie').reduce((acc, r) => acc + r.montantNumber, 0))} DH</strong>
                  <span className="lc-stat-subtitle">Flux sortants</span>
                </div>
                <div className="lc-stats-operator">=</div>
                <div className="lc-stat-card card-solde-net">
                  <div className="lc-stat-card-title">
                    <span>Solde Net</span>
                    <span className="lc-info-trigger" title="Solde net sur la période" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <Info size={12} />
                    </span>
                  </div>
                  <strong>{moneyFormatter.format(
                    rows.filter(r => r.typeCode === 'entree' || r.typeCode === 'alimentation').reduce((acc, r) => acc + r.montantNumber, 0) -
                    rows.filter(r => r.typeCode === 'sortie').reduce((acc, r) => acc + r.montantNumber, 0)
                  )} DH</strong>
                  <div className="lc-solde-net-chart">
                    <svg viewBox="0 0 100 20" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="soldeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={soldeSparklineData.fillPath} fill="url(#soldeGrad)" stroke="none" />
                      <path d={soldeSparklineData.strokePath} fill="none" stroke="#10b981" strokeWidth="1.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TRESORERIE FILTERS ACTIONS BAR */}
          <section className="lc-filters-actions-bar" style={{ marginBottom: '1.5rem' }}>
            <div className="lc-filters-inputs">
              <div className="lc-filter-group">
                <span className="lc-filter-label">Du</span>
                <div className="lc-filter-input-wrapper date">
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} disabled={!hasPermission(user, 'filtrer_tresorerie')} />
                  <Calendar size={14} className="lc-input-icon-right" />
                </div>
              </div>
              <div className="lc-filter-group">
                <span className="lc-filter-label">Au</span>
                <div className="lc-filter-input-wrapper date">
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} disabled={!hasPermission(user, 'filtrer_tresorerie')} />
                  <Calendar size={14} className="lc-input-icon-right" />
                </div>
              </div>
              <div className="lc-filter-group">
                <span className="lc-filter-label">Type</span>
                <div className="lc-filter-input-wrapper">
                  <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} disabled={!hasPermission(user, 'filtrer_tresorerie')}>
                    <option value="all">Tous</option>
                    <option value="entree">Entrée</option>
                    <option value="sortie">Sortie</option>
                  </select>
                  <ChevronDown size={14} className="lc-input-icon-right" />
                </div>
              </div>
              <div className="lc-filter-group">
                <span className="lc-filter-label">Saisi par</span>
                <div className="lc-filter-input-wrapper">
                  <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} disabled={!hasPermission(user, 'filtrer_tresorerie')}>
                    <option value="all">Tous</option>
                    {uniqueUsers.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="lc-input-icon-right" />
                </div>
              </div>
              <div className="lc-filter-group search-group">
                <span className="lc-filter-label">Recherche</span>
                <div className="lc-filter-input-wrapper search">
                  <Search size={14} className="lc-input-icon-left" />
                  <input
                    type="text"
                    placeholder="Libellé, catégorie, notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={!hasPermission(user, 'filtrer_tresorerie')}
                  />
                </div>
              </div>
            </div>

            <div className="lc-actions-buttons">
              <button type="button" className="lc-action-btn-white" onClick={handleExportCsv} disabled={exportingCsv}>
                <Download size={14} /> Excel
              </button>
              <button type="button" className="lc-action-btn-white" onClick={() => window.print()}>
                <FileText size={14} /> PDF
              </button>
              {(hasPermission(user, 'mouvements_caisse') || hasPermission(user, 'sorties_caisse') || hasPermission(user, 'creer_mouvements_tresorerie')) && (
                <button type="button" className="lc-action-btn-green" onClick={openAddMovementModal}>
                  <Plus size={14} /> + Ajouter un mouvement
                </button>
              )}
            </div>
          </section>

          {/* TRESORERIE TABLE */}
          <section className="lc-table-section">
            <header className="lc-table-header">
              <h2>Mouvements de trésorerie</h2>
              <span>{operationsCount} opération(s)</span>
            </header>

            <div className="table-wrapper lc-table-wrap">
              <table className="data-table lc-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>DATE</th>
                    <th>TYPE</th>
                    <th>CATÉGORIE</th>
                    <th>LIBELLÉ</th>
                    <th>MODE</th>
                    <th>MONTANT (DH)</th>
                    <th>SAISI PAR</th>
                    <th>DOCUMENT</th>
                    <th>NOTES</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const rowNumber = operationsCount - ((currentPage - 1) * 20) - index;
                    const isAuto = row.categorie.toLowerCase().includes('auto');
                    return (
                      <tr key={row.id}>
                        <td>{rowNumber}</td>
                        <td>{row.date}</td>
                        <td>
                          <span className={`lc-type-pill ${row.typeCode === 'sortie' ? 'lc-type-pill-sortie' : ''}`}>
                            {row.type}
                          </span>
                        </td>
                        <td>{row.categorie}</td>
                        <td className="lc-libelle">{row.libelle}</td>
                        <td>{row.modePaiementCode === 'especes' && !row.modePaiement ? '—' : (row.modePaiement || '—')}</td>
                        <td className={`lc-amount ${row.typeCode === 'sortie' ? 'lc-amount-out' : ''}`}>
                          {row.montant}
                        </td>
                        <td>{row.utilisateur}</td>
                        <td>{row.document}</td>
                        <td>{row.notes}</td>
                        <td>
                          {isAuto ? (
                            <span className="lc-action-auto">Auto</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {(((row.typeCode === 'sortie' && hasPermission(user, 'sorties_caisse')) ||
                                (row.typeCode !== 'sortie' && hasPermission(user, 'mouvements_caisse'))) ||
                                hasPermission(user, 'creer_mouvements_tresorerie')) && (
                                <>
                                  <button type="button" className="icon-btn" title="Modifier" onClick={() => openEditMovementModal(row)}>
                                    <Pencil size={14} />
                                  </button>
                                  <button type="button" className="icon-btn lc-delete-btn" title="Supprimer" onClick={() => setDeleteConfirmId(row.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!loadingRows && rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="empty-row">Aucun mouvement trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            {operationsCount > 20 && (
              <div className="lc-pagination-container">
                <span className="lc-pagination-info">
                  Affichage {((currentPage - 1) * 20) + 1} - {Math.min(currentPage * 20, operationsCount)} sur {operationsCount}
                </span>
                <div className="lc-pagination-controls">
                  <button
                    type="button"
                    className="lc-pagination-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    &lt;
                  </button>
                  <span className="lc-pagination-text">Page {currentPage} sur {Math.ceil(operationsCount / 20)}</span>
                  <button
                    type="button"
                    className="lc-pagination-btn"
                    disabled={currentPage >= Math.ceil(operationsCount / 20)}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    &gt;
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (canSeeCaisse ? (
        <>
          {/* ORIGINAL CAISSE TAB RENDER */}
          <section className="lc-actions-row">
            {(hasPermission(user, 'mouvements_caisse') || hasPermission(user, 'sorties_caisse')) && (
              <button type="button" className="btn btn-primary lc-add-btn" onClick={openAddMovementModal}>
                <Plus size={18} /> Ajouter un mouvement
              </button>
            )}
            <button type="button" className="btn btn-secondary lc-export-btn" onClick={handleExportCsv} disabled={exportingCsv}>
              <Download size={16} /> Export CSV
            </button>
          </section>

          <section className="lc-stats-grid">
            <article className="lc-stat-card lc-stat-teal">
              <p>SOLDE ACTUEL</p>
              <strong>{hasPermission(user, 'consulter_solde_caisse') ? `${moneyFormatter.format(stats.solde)} DH` : '*** DH'}</strong>
            </article>
            <article className="lc-stat-card lc-stat-green">
              <p>TOTAL ENTRÉES CAISSE</p>
              <strong>{moneyFormatter.format(stats.total_entrees)} DH</strong>
              <ArrowDownRight size={18} className="lc-stat-arrow lc-arrow-green" />
            </article>
            <article className="lc-stat-card lc-stat-red">
              <p>TOTAL SORTIES CAISSE</p>
              <strong>{moneyFormatter.format(stats.total_sorties)} DH</strong>
              <ArrowUpRight size={18} className="lc-stat-arrow lc-arrow-red" />
            </article>
            <article className="lc-stat-card lc-stat-amber">
              <p>COMMISSION AGENCE</p>
              <strong>{moneyFormatter.format(commissionAgence)} DH</strong>
              <span className="lc-stat-subtitle">mois en cours</span>
              <ArrowUpRight size={18} className="lc-stat-arrow lc-arrow-green" />
            </article>
          </section>

          <section className="lc-filters-row">
            <label className="lc-filter-field">
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Tous les types</option>
                <option value="entree">Entrée</option>
                <option value="sortie">Sortie</option>
                <option value="alimentation">Alimentation de la caisse</option>
              </select>
            </label>

            <label className="lc-filter-field">
              <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                <option value="all">Tous les modes</option>
                <option value="especes">Espèces</option>
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="paiement_agence">Paiement agence</option>
              </select>
            </label>

            <label className="lc-filter-field lc-date-field">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Calendar size={15} />
            </label>

            <label className="lc-filter-field lc-date-field">
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <Calendar size={15} />
            </label>

            <label className="lc-filter-field">
              <input
                type="text"
                placeholder="Rechercher client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
          </section>

          <section className="lc-table-section">
            <header className="lc-table-header">
              <h2>Mouvements de caisse</h2>
              <span>{operationsCount} opération(s)</span>
            </header>

            <div className="table-wrapper lc-table-wrap">
              <table className="data-table lc-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>TYPE</th>
                    <th>LIBELLÉ</th>
                    <th>CLIENT</th>
                    <th>MODE PAIEMENT</th>
                    <th>MONTANT</th>
                    <th>UTILISATEUR</th>
                    <th>DOCUMENT</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isAuto = row.categorie.toLowerCase().includes('auto');
                    return (
                      <tr key={row.id}>
                        <td>{row.date}</td>
                        <td><span className={`lc-type-pill ${row.typeCode === 'sortie' ? 'lc-type-pill-sortie' : ''}`}>{row.type}</span></td>
                        <td className="lc-libelle">{row.libelle}</td>
                        <td>{row.client}</td>
                        <td>{row.modePaiement}</td>
                        <td className={`lc-amount ${row.typeCode === 'sortie' ? 'lc-amount-out' : ''}`}>{row.montant}</td>
                        <td>{row.utilisateur}</td>
                        <td>{row.document}</td>
                        <td>
                          {isAuto ? (
                            <span className="lc-action-auto">Auto</span>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {(((row.typeCode === 'sortie' && hasPermission(user, 'sorties_caisse')) ||
                                (row.typeCode !== 'sortie' && hasPermission(user, 'mouvements_caisse'))) ||
                                hasPermission(user, 'creer_mouvements_tresorerie')) && (
                                <>
                                  <button type="button" className="icon-btn" title="Modifier" onClick={() => openEditMovementModal(row)}>
                                    <Pencil size={14} />
                                  </button>
                                  <button type="button" className="icon-btn lc-delete-btn" title="Supprimer" onClick={() => setDeleteConfirmId(row.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!loadingRows && rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="empty-row">Aucun mouvement trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null)}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId !== null && (
        <div className="lc-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="lc-modal" style={{ width: 'min(100%, 420px)' }} onClick={(e) => e.stopPropagation()}>
            <header className="lc-modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
              <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <Trash2 size={18} />
                <span>Confirmation de suppression</span>
              </h3>
              <button type="button" className="lc-modal-close" onClick={() => setDeleteConfirmId(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="lc-modal-body" style={{ padding: '1.5rem', textAlign: 'center', background: '#ffffff' }}>
              <p style={{ fontSize: '0.95rem', color: '#1e293b', margin: 0, fontWeight: 500 }}>
                Êtes-vous sûr de vouloir supprimer ce mouvement ?
              </p>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '8px', margin: '8px 0 0 0' }}>
                Cette action est irréversible et effacera définitivement cette transaction de la caisse.
              </p>
            </div>
            <footer className="lc-modal-footer" style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  minWidth: '92px',
                  minHeight: '38px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
                onClick={async () => {
                  const id = deleteConfirmId;
                  setDeleteConfirmId(null);
                  await handleDeleteMovement(id);
                }}
              >
                Supprimer
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* MOVEMENT DIALOG MODAL */}
      {showMovementModal && (
        <div className="lc-modal-overlay" onClick={closeMovementModal}>
          <div className="lc-modal" onClick={(e) => e.stopPropagation()}>
            <header className="lc-modal-header">
              <h3>{isEditMode ? "Modifier l'opération" : 'Ajouter un mouvement'}</h3>
              <button type="button" className="lc-modal-close" onClick={closeMovementModal}>
                <X size={16} />
              </button>
            </header>

            <div className="lc-modal-body">
              {activeTab === 'tresorerie' ? (
                <>
                  {/* Date & Montant (DH) */}
                  <div className="lc-modal-grid-two">
                    <div className="lc-modal-field">
                      <label>Date</label>
                      <div className="lc-modal-input-icon">
                        <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
                        <Calendar size={15} />
                      </div>
                    </div>

                    <div className="lc-modal-field">
                      <label>Montant (DH) *</label>
                      <input type="text" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
                    </div>
                  </div>

                  {/* Type de mouvement & Catégorie */}
                  <div className="lc-modal-grid-two">
                    <div className="lc-modal-field">
                      <label>Type de mouvement</label>
                      <div className="lc-modal-custom-select">
                        <button
                          type="button"
                          className="lc-modal-custom-trigger"
                          onClick={() => {
                            setIsOperationMenuOpen((prev) => !prev);
                            setIsPaymentMenuOpen(false);
                            setIsCategoryMenuOpen(false);
                          }}
                        >
                          <span>{selectedOperationType}</span>
                          <ChevronDown size={15} />
                        </button>

                        {isOperationMenuOpen && (
                          <div className="lc-modal-custom-menu">
                            {operationTypes
                              .filter((type) => {
                                if (type === 'Sortie') return hasPermission(user, 'sorties_caisse');
                                return hasPermission(user, 'mouvements_caisse');
                              })
                              .map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  className={`lc-modal-custom-item ${selectedOperationType === type ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSelectedOperationType(type);
                                    setIsOperationMenuOpen(false);
                                  }}
                                >
                                  <span className="lc-check-wrap">
                                    {selectedOperationType === type ? <Check size={14} /> : null}
                                  </span>
                                  <span>{type}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lc-modal-field">
                      <label>Catégorie</label>
                      <div className="lc-modal-custom-select">
                        <button
                          type="button"
                          className="lc-modal-custom-trigger"
                          onClick={() => {
                            setIsCategoryMenuOpen((prev) => !prev);
                            setIsOperationMenuOpen(false);
                            setIsPaymentMenuOpen(false);
                          }}
                        >
                          <span>{selectedCategory || 'Choisir une catégorie'}</span>
                          <ChevronDown size={15} />
                        </button>

                        {isCategoryMenuOpen && (
                          <div className="lc-modal-custom-menu" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <button
                              type="button"
                              className={`lc-modal-custom-item ${selectedCategory === '' ? 'selected' : ''}`}
                              onClick={() => {
                                setSelectedCategory('');
                                setIsCategoryMenuOpen(false);
                              }}
                            >
                              <span className="lc-check-wrap">
                                {selectedCategory === '' ? <Check size={14} /> : null}
                              </span>
                              <span>Choisir une catégorie</span>
                            </button>
                            {categories.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                className={`lc-modal-custom-item ${selectedCategory === cat ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedCategory(cat);
                                  setIsCategoryMenuOpen(false);
                                }}
                              >
                                <span className="lc-check-wrap">
                                  {selectedCategory === cat ? <Check size={14} /> : null}
                                </span>
                                <span>{cat}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Libellé / Description */}
                  <div className="lc-modal-field">
                    <label>Libellé / Description *</label>
                    <input
                      type="text"
                      placeholder="Décrivez le motif de l'opération..."
                      value={movementLabel}
                      onChange={(e) => setMovementLabel(e.target.value)}
                    />
                  </div>

                  {/* Mode de paiement & Saisi par * */}
                  <div className="lc-modal-grid-two">
                    <div className="lc-modal-field">
                      <label>Mode de paiement</label>
                      <div className="lc-modal-custom-select">
                        <button
                          type="button"
                          className="lc-modal-custom-trigger"
                          onClick={() => {
                            setIsPaymentMenuOpen((prev) => !prev);
                            setIsOperationMenuOpen(false);
                            setIsCategoryMenuOpen(false);
                          }}
                        >
                          <span>{selectedPaymentMode}</span>
                          <ChevronDown size={15} />
                        </button>

                        {isPaymentMenuOpen && (
                          <div className="lc-modal-custom-menu">
                            {paymentModes.map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                className={`lc-modal-custom-item ${selectedPaymentMode === mode ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedPaymentMode(mode);
                                  setIsPaymentMenuOpen(false);
                                }}
                              >
                                <span className="lc-check-wrap">
                                  {selectedPaymentMode === mode ? <Check size={14} /> : null}
                                </span>
                                <span>{mode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lc-modal-field">
                      <label>Saisi par *</label>
                      <input
                        type="text"
                        value={movementUser}
                        readOnly
                        disabled
                        style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                      />
                    </div>
                  </div>

                  {/* Document justificatif (optionnel) */}
                  <div className="lc-modal-field">
                    <label>Document justificatif (optionnel)</label>
                    <label className="lc-upload-box">
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setMovementDocumentFile(file);
                          setMovementDocumentName(file?.name ?? 'Cliquer pour télécharger (facture, reçu...)');
                        }}
                      />
                      <Upload size={16} />
                      <span>{movementDocumentName}</span>
                    </label>
                  </div>

                  {/* Notes */}
                  <div className="lc-modal-field">
                    <label>Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Remarques..."
                      value={movementNotes}
                      onChange={(e) => setMovementNotes(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Original Caisse Fields with Categorie added */}
                  <div className="lc-modal-grid-two">
                    <div className="lc-modal-field">
                      <label>Type d'opération</label>
                      <div className="lc-modal-custom-select">
                        <button
                          type="button"
                          className="lc-modal-custom-trigger"
                          onClick={() => {
                            setIsOperationMenuOpen((prev) => !prev);
                            setIsPaymentMenuOpen(false);
                            setIsCategoryMenuOpen(false);
                          }}
                        >
                          <span>{selectedOperationType}</span>
                          <ChevronDown size={15} />
                        </button>

                        {isOperationMenuOpen && (
                          <div className="lc-modal-custom-menu">
                            {operationTypes
                              .filter((type) => {
                                if (type === 'Sortie') return hasPermission(user, 'sorties_caisse');
                                return hasPermission(user, 'mouvements_caisse');
                              })
                              .map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  className={`lc-modal-custom-item ${selectedOperationType === type ? 'selected' : ''}`}
                                  onClick={() => {
                                    setSelectedOperationType(type);
                                    setIsOperationMenuOpen(false);
                                  }}
                                >
                                  <span className="lc-check-wrap">
                                    {selectedOperationType === type ? <Check size={14} /> : null}
                                  </span>
                                  <span>{type}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="lc-modal-field">
                      <label>Date</label>
                      <div className="lc-modal-input-icon">
                        <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
                        <Calendar size={15} />
                      </div>
                    </div>
                  </div>

                  <div className="lc-modal-grid-two">
                    <div className="lc-modal-field">
                      <label>Montant (MAD) *</label>
                      <input type="text" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
                    </div>

                    <div className="lc-modal-field">
                      <label>Mode de paiement</label>
                      <div className="lc-modal-custom-select">
                        <button
                          type="button"
                          className="lc-modal-custom-trigger"
                          onClick={() => {
                            setIsPaymentMenuOpen((prev) => !prev);
                            setIsOperationMenuOpen(false);
                            setIsCategoryMenuOpen(false);
                          }}
                        >
                          <span>{selectedPaymentMode}</span>
                          <ChevronDown size={15} />
                        </button>

                        {isPaymentMenuOpen && (
                          <div className="lc-modal-custom-menu">
                            {paymentModes.map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                className={`lc-modal-custom-item ${selectedPaymentMode === mode ? 'selected' : ''}`}
                                onClick={() => {
                                  setSelectedPaymentMode(mode);
                                  setIsPaymentMenuOpen(false);
                                }}
                              >
                                <span className="lc-check-wrap">
                                  {selectedPaymentMode === mode ? <Check size={14} /> : null}
                                </span>
                                <span>{mode}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="lc-modal-field">
                    <label>Libellé / Motif *</label>
                    <textarea
                      rows={3}
                      placeholder="Décrivez le motif de l'opération..."
                      value={movementLabel}
                      onChange={(e) => setMovementLabel(e.target.value)}
                    />
                  </div>

                  <div className="lc-modal-field">
                    <label>Client associé (optionnel)</label>
                    <div className="lc-modal-search-wrap">
                      <input
                        type="text"
                        placeholder="Nom du client"
                        value={movementClient}
                        onChange={(e) => setMovementClient(e.target.value)}
                      />
                      <button type="button" className="lc-modal-search-btn" title="Rechercher">
                        <Search size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="lc-modal-field">
                    <label>Utilisateur</label>
                    <input type="text" value={movementUser} onChange={(e) => setMovementUser(e.target.value)} />
                  </div>

                  <div className="lc-modal-field">
                    <label>Document justificatif (optionnel)</label>
                    <label className="lc-upload-box">
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setMovementDocumentFile(file);
                          setMovementDocumentName(file?.name ?? 'Cliquer pour télécharger (facture, reçu...)');
                        }}
                      />
                      <Upload size={16} />
                      <span>{movementDocumentName}</span>
                    </label>
                  </div>

                  <div className="lc-modal-field">
                    <label>Notes (optionnel)</label>
                    <textarea rows={3} placeholder="Remarques..." value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <footer className="lc-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeMovementModal} disabled={savingMovement}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={saveMovement} disabled={savingMovement}>
                {isEditMode ? 'Modifier' : 'Enregistrer'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
