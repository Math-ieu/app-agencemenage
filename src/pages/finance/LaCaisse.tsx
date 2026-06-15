import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar, Check, ChevronDown, Download, FileText, Pencil, Plus, Search, Upload, X, Slash } from 'lucide-react';
import { createCaisseMouvement, exportCaisseCsv, getCaisse, getCaisseSolde, updateCaisseMouvement, getMissions, getDemandesHistorique } from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { checkPermission, hasPermission } from '../../utils/permissions';
import './LaCaisse.css';

interface CashRow {
  id: number;
  date: string;
  type: 'Entrée' | 'Sortie' | 'Alimentation de la caisse';
  typeCode: 'entree' | 'sortie' | 'alimentation';
  libelle: string;
  client: string;
  modePaiement: string;
  modePaiementCode: 'especes' | 'virement' | 'cheque' | 'paiement_agence';
  montant: string;
  montantNumber: number;
  utilisateur: string;
  document: string;
}

const paymentModes = ['Espèces', 'Virement', 'Chèque', 'Paiement agence'];
const operationTypes = ['Entrée', 'Sortie', 'Alimentation de la caisse'];

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
  const [rows, setRows] = useState<CashRow[]>([]);
  const [operationsCount, setOperationsCount] = useState(0);
  const [stats, setStats] = useState({ total_entrees: 0, total_sorties: 0, solde: 0, solde_jour: 0 });
  const [loadingRows, setLoadingRows] = useState(true);
  const [commissionAgence, setCommissionAgence] = useState(0);

  const [typeFilter, setTypeFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showMovementModal, setShowMovementModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMovementId, setEditingMovementId] = useState<number | null>(null);
  const [savingMovement, setSavingMovement] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const [selectedOperationType, setSelectedOperationType] = useState('Entrée');
  const [isOperationMenuOpen, setIsOperationMenuOpen] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('Espèces');
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [movementDate, setMovementDate] = useState(todayInputDate());
  const [movementAmount, setMovementAmount] = useState('0.00');
  const [movementLabel, setMovementLabel] = useState('');
  const [movementClient, setMovementClient] = useState('');
  const [movementUser, setMovementUser] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [movementDocumentName, setMovementDocumentName] = useState('Cliquer pour télécharger (facture, reçu...)');
  const [movementDocumentFile, setMovementDocumentFile] = useState<File | null>(null);

  const fetchStats = async () => {
    const response = await getCaisseSolde();
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
      const params: Record<string, string> = {};
      if (typeFilter !== 'all') params.type_mouvement = typeFilter;
      if (modeFilter !== 'all') params.mode_paiement = modeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await getCaisse(params);
      const payload = response.data.results ?? response.data;
      const total = typeof response.data.count === 'number' ? response.data.count : payload.length;

      const mappedRows: CashRow[] = payload.map((item: Record<string, unknown>) => {
        const montant = Number(item.montant ?? 0);
        const typeCode = String(item.type_mouvement || 'entree') as 'entree' | 'sortie';
        const modeCode = String(item.mode_paiement || 'especes') as 'especes' | 'virement' | 'cheque' | 'paiement_agence';

        return {
          id: Number(item.id),
          date: toDisplayDate(String(item.date || '')),
          type: typeCodeToLabel(typeCode),
          typeCode,
          libelle: String(item.description || ''),
          client: String(item.client_display || item.client_nom || '—'),
          modePaiement: paymentCodeToLabel(modeCode),
          modePaiementCode: modeCode,
          montant: `${typeCode === 'sortie' ? '-' : '+'}${moneyFormatter.format(Math.abs(montant))} DH`,
          montantNumber: montant,
          utilisateur: String(item.utilisateur || '—'),
          document: item.document_file ? 'Fichier' : '—',
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
          const isInterventionAnnulee = m.statut === 'annulee' || dem?.statut === 'annule';
          const isFacturationAnnulee = !isInterventionAnnulee && !isGratuit && (fact.facturation_annulee === true || rawStatus === 'facturation_annulee');
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
          const partProfil = Number(fact.part_profil ?? 0) * ratio;
          const montant = Number(dem?.prix ?? 0) * ratio;
          const rawMontantPaye = m.montant_paye !== undefined ? Number(m.montant_paye) : 0;
          const montantPaye = (rawMontantPaye || (['paye', 'agence_payee_client', 'profil_paye_client', 'effectue', 'integral'].includes(rawStatus) ? Number(dem?.prix ?? 0) : 0)) * ratio;
          const montantProfilAnnulation = Number(dem?.montant_profil_annulation || m.montant_profil_annulation || fact.montant_profil_annulation || 0) * ratio;

          return {
            demandeId: dem.id,
            parentDemandeId: dem.parent_demande || dem.parent_demande_id || null,
            frequency: dem.frequency || null,
            date: dem.date_intervention ? formatDateFR(dem.date_intervention) : '',
            statut,
            statutPaiementUi: rawStatus,
            paiement: ['paye', 'agence_payee_client', 'profil_paye_client', 'effectue', 'integral'].includes(rawStatus) ? 'paye' : ['paiement_partiel', 'paiement_en_attente', 'partiel', 'acompte'].includes(rawStatus) ? 'partiellement_paye' : 'non_paye',
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
          const isInterventionAnnulee = d.statut === 'annule';
          const isFacturationAnnulee = !isInterventionAnnulee && !isGratuit && (fact.facturation_annulee === true || rawStatus === 'facturation_annulee');
          const statut = isGratuit ? 'Intervention gratuite' : isInterventionAnnulee ? 'Intervention annulée' : isFacturationAnnulee ? 'Facturation annulée' : 'Confirmée';
          const encaissePar = ['profil_paye_client'].includes(rawStatus) ? 'Profil' : 'Agence';
          const partProfilVersee = encaissePar === 'Agence' ? Boolean(fact.part_profil_versee) : Boolean(fact.part_agence_reversee);
          const reglementInterne = partProfilVersee ? 'Réglé' : 'Non réglé';

          const partAgence = (fact.part_agence !== null && fact.part_agence !== undefined)
            ? Number(fact.part_agence)
            : (d?.part_agence !== null && d?.part_agence !== undefined)
              ? Number(d.part_agence)
              : 0;

          const partProfil = Number(fact.part_profil ?? (fact.montant_agence_doit_profil || (Number(d?.prix ?? 0) - partAgence)));
          const montant = Number(d?.prix ?? 0);
          const paiement = ['paye', 'agence_payee_client', 'profil_paye_client', 'effectue', 'integral'].includes(rawStatus) ? 'paye' : 'non_paye';
          const montantPaye = paiement === 'paye' ? (Number(fact.montant_verse) || montant) : 0;
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
          return Number(row.montantAgenceDoitProfil || 0);
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
      for (const row of mappedRows) {
        if (row.date) {
          const parts = row.date.split('/');
          const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : row.date;
          const rowMonth = isoDate.slice(0, 7);
          if (rowMonth !== currentMonth) continue;
        } else continue;

        totalCommission += getCommissionAgenceEncaissee(row);
      }

      setCommissionAgence(totalCommission);
    } catch { /* skip */ }
  };

  useEffect(() => {
    void fetchStats();
    void fetchFinanceKpis();
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [typeFilter, modeFilter, dateFrom, dateTo, searchTerm]);

  const closeMovementModal = () => {
    setShowMovementModal(false);
    setIsOperationMenuOpen(false);
    setIsPaymentMenuOpen(false);
  };

  const openAddMovementModal = () => {
    setIsEditMode(false);
    setEditingMovementId(null);
    setSelectedOperationType(hasPermission(user, 'mouvements_caisse') ? 'Entrée' : 'Sortie');
    setSelectedPaymentMode('Espèces');
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
    setMovementDate(toInputDate(row.date));
    setMovementAmount(extractAmount(row.montant));
    setMovementLabel(row.libelle);
    setMovementClient(row.client === '—' ? '' : row.client);
    setMovementUser(row.utilisateur === '—' ? '' : row.utilisateur);
    setMovementNotes('');
    setMovementDocumentName('Cliquer pour télécharger (facture, reçu...)');
    setMovementDocumentFile(null);
    setShowMovementModal(true);
  };

  const saveMovement = async () => {
    if (!movementLabel.trim() || !movementDate) return;

    const opTypeCode = typeLabelToCode(selectedOperationType);
    if (opTypeCode === 'sortie' && !hasPermission(user, 'sorties_caisse')) {
      alert("Vous n'avez pas la permission de saisir une sortie.");
      return;
    }
    if (opTypeCode !== 'sortie' && !hasPermission(user, 'mouvements_caisse')) {
      alert("Vous n'avez pas la permission de saisir une entrée/alimentation.");
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

  const perm = checkPermission(user, 'financier');
  if (!perm.allowed) {
    return (
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#ef4444', fontWeight: 600, fontSize: 16 }}>
        <Slash size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
        {perm.message || "Vous n'avez pas l'autorisation d'accéder à la gestion financière."}
      </div>
    );
  }

  return (
    <div className="page lc-page">
      <section className="lc-hero">
        <div className="lc-hero-title-wrap">
          <FileText size={20} />
          <div>
            <h1>Gestion de Caisse</h1>
            <p>Suivi des entrées et sorties de trésorerie</p>
          </div>
        </div>
      </section>

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
              {rows.map((row) => (
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
                    {((row.typeCode === 'sortie' && hasPermission(user, 'sorties_caisse')) ||
                      (row.typeCode !== 'sortie' && hasPermission(user, 'mouvements_caisse'))) && (
                      <button type="button" className="icon-btn" title="Modifier" onClick={() => openEditMovementModal(row)}>
                        <Pencil size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loadingRows && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-row">Aucun mouvement trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
