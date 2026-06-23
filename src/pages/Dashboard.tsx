import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw, ClipboardCheck, Building2, Clock, Search, List, Grid, MoreVertical, Edit2, Settings,
  CheckCircle, UserCheck, MessageSquare, AlertTriangle, Gift,
  Check, ChevronLeft, ChevronUp, ChevronDown, FileText, ClipboardList, UserPlus, Eye, Download, Send, Save, XCircle, Calendar, Trash2, Plus, Pencil
} from 'lucide-react';

import { Demande, User } from '../types';
import { getDemandes, updateDemande, annulerDemande, confirmerCAO, getUsers, affecterDemande, affecterOperations, generateDocument, fetchSecureDocBlob, deleteDemande, sendWhatsApp, getAuditLogs, getAgents, sendProfilToDemande, removeProfilFromDemande, uploadDocument, getDemande } from '../api/client';
import { useToastStore } from '../store/toast';
import { useAuthStore } from '../store/auth';
import { encodeId } from '../utils/obfuscation';
import { checkPermission, hasPermission } from '../utils/permissions';
import { normalizeFrequence, normalizeStructure, normalizeTimePref, normalizeMobilite, normalizeSexe, normalizeQuartier } from '../utils/formNormalizers';
import { renderStatusBadge, getStatusInfo } from '../utils/statusUtils';
import { generateDevisPdf } from '../lib/devis/generate-devis';
import { DynamicServiceForm } from '../components/demandes/forms/DynamicServiceForm';
// Services qui nécessitent un devis PDF (les autres ont un récapitulatif PNG)
const isDevisRequired = (d: Demande | null): boolean => {
  if (!d) return false;
  if (d.segment === 'entreprise') return true;
  const devisParticuliers = ['Ménage Air BnB', 'Ménage post-sinistre', 'Auxiliaire de vie', 'Ménage fin chantier', 'Nettoyage fin de chantier'];
  return devisParticuliers.includes(d.service);
};

interface DashboardStats {
  en_cours: number;
  en_cours_particulier: number;
  en_cours_entreprise: number;
  en_cours_nouveau: number;
  en_attente: number;
}

interface AuditLogItem {
  id: number;
  action: string;
  model_name: string;
  object_id: number;
  extra_data?: Record<string, any>;
  timestamp: string;
  user_name?: string;
}

interface PartRepartitionItem {
  profile_id: number | '';
  amount: number;
  is_delegate?: boolean;
  rate_type?: 'taux_horaire_standard' | 'taux_horaire_exceptionnel' | 'taux_forfaitaire';
  hours?: number;
  days?: number;
  rate_value?: number;
  created_at?: string;
  created_by_name?: string;
}


const PAYMENT_STATUS_OPTIONS = [
  { value: 'non_confirme', apiValue: 'non_paye', label: 'Non confirmé' },
  { value: 'paiement_en_attente', apiValue: 'acompte', label: 'Paiement en attente' },
  { value: 'agence_payee_client', apiValue: 'partiel', label: 'Agence payée / Client' },
  { value: 'profil_paye_client', apiValue: 'partiel', label: 'Profil payé / Client' },
  { value: 'commercial_paye_client', apiValue: 'partiel', label: 'Commercial payé / client' },
  { value: 'paiement_partiel', apiValue: 'partiel', label: 'Paiement partiel' },
  { value: 'paye', apiValue: 'integral', label: 'Payé' },
  { value: 'facturation_annulee', apiValue: 'facturation_annulee', label: 'Annulé' },
  { value: 'intervention_gratuite', apiValue: 'intervention_gratuite', label: 'Intervention gratuite' },
];

const getPaymentUiValue = (statutPaiement: string, facturationAnnulee: boolean, fallback?: string): string => {
  if (fallback && PAYMENT_STATUS_OPTIONS.some((option) => option.value === fallback)) return fallback;
  if (statutPaiement === 'intervention_gratuite') return 'intervention_gratuite';
  if (statutPaiement === 'facturation_annulee') return 'facturation_annulee';
  if (facturationAnnulee) return 'facturation_annulee';
  if (statutPaiement === 'integral') return 'paye';
  if (statutPaiement === 'acompte') return 'paiement_en_attente';
  if (statutPaiement === 'partiel') return 'paiement_partiel';
  return 'non_confirme';
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const asArray = <T,>(value: unknown, fallback: T[]): T[] =>
  Array.isArray(value) ? (value as T[]) : fallback;

const getServiceDefaultRate = (service: string, rateType: string, hours?: number): { rate: number; type: 'hourly' | 'forfait' } => {
  const norm = (service || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  
  if (rateType === 'taux_forfaitaire') {
    if (norm.includes('auxiliaire')) {
      return { rate: 150, type: 'forfait' };
    }
    if (norm.includes('placement')) {
      return { rate: 200, type: 'forfait' };
    }
    return { rate: 150, type: 'forfait' }; // Default flat rate
  }
  
  // hourly rates:
  if (norm.includes('menage standard') || norm.includes('standard')) {
    return { rate: 30, type: 'hourly' };
  }
  if (norm.includes('grand menage') || norm.includes('grand')) {
    return { rate: 40, type: 'hourly' };
  }
  if (norm.includes('fin de chantier') || norm.includes('fin chantier') || norm.includes('nettoyage fin')) {
    return { rate: 40, type: 'hourly' };
  }
  if (norm.includes('post-sinistre') || norm.includes('post sinistre')) {
    return { rate: 40, type: 'hourly' };
  }
  if (norm.includes('airbnb') || norm.includes('air bnb')) {
    const h = hours || 0;
    return { rate: (h > 0 && h <= 2) ? 40 : 30, type: 'hourly' };
  }
  if (norm.includes('bureaux') || norm.includes('bureau')) {
    return { rate: 30, type: 'hourly' };
  }
  
  return { rate: 30, type: 'hourly' }; // Default hourly rate
};

const getDefaultRateTypeForService = (service: string): 'taux_horaire_standard' | 'taux_forfaitaire' => {
  const norm = (service || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (norm.includes('auxiliaire') || norm.includes('placement')) {
    return 'taux_forfaitaire';
  }
  return 'taux_horaire_standard';
};


const AUDIT_FIELD_LABELS: Record<string, string> = {
  service: 'Service',
  segment: 'Segment',
  statut: 'Statut de la demande',
  prix: 'Montant TTC',
  nb_heures: 'Duree (heures)',
  frequency: 'Type de frequence',
  frequency_label: 'Frequence',
  mode_paiement: 'Mode de paiement',
  statut_paiement: 'Statut de paiement',
  avance_paiement: 'Montant verse',
  date_intervention: 'Date d intervention',
  heure_intervention: 'Heure d intervention',
  note_commercial: 'Note commerciale',
  note_operationnel: 'Note operationnelle',
  preference_horaire: 'Preference horaire',
  avec_produit: 'Produits fournis',
  formulaire_data: 'Formulaire detaille',
  assigned_to: 'Commercial assigne',
};

const toStartCase = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const formatAuditFieldName = (fieldName: string): string => AUDIT_FIELD_LABELS[fieldName] || toStartCase(fieldName);

const getAuditChangedFieldsSummary = (log: AuditLogItem): string | null => {
  const rawChanges = log.extra_data?.changes;
  if (!rawChanges || typeof rawChanges !== 'object') return null;

  const fields = Object.keys(rawChanges as Record<string, unknown>);
  if (fields.length === 0) return null;

  const labels = fields.map(formatAuditFieldName);
  const visible = labels.slice(0, 4);
  const remaining = labels.length - visible.length;
  return remaining > 0
    ? `${visible.join(', ')} +${remaining}`
    : visible.join(', ');
};

const auditActionLabel = (action: string): string => {
  const map: Record<string, string> = {
    update: 'Modification du besoin',
    valider: 'Validation du besoin',
    annuler: 'Annulation du besoin',
    affecter: 'Affectation commerciale',
    envoyer_profil: 'Envoi de profil',
    generate_devis: 'Generation du devis',
    generate_png: 'Generation du recapitulatif',
    send_wa_devis: 'Envoi WhatsApp devis',
    send_wa_png: 'Envoi WhatsApp recapitulatif',
  };
  return map[action] || action.replace(/_/g, ' ');
};

const getClientKey = (demande: Demande): string => {
  if (demande.client) return `client:${demande.client}`;

  const phone = (
    demande.client_phone ||
    demande.client_whatsapp ||
    demande.formulaire_data?.whatsapp_phone ||
    ''
  ).replace(/\s+/g, '');

  if (phone) return `phone:${phone}`;

  const normalizedName = (demande.client_name || demande.formulaire_data?.nom || '').trim().toLowerCase();
  if (normalizedName) return `name:${normalizedName}`;

  return `demande:${demande.id}`;
};



const SERVICES_LIST = {
  particulier: [
    "Ménage standard",
    "Grand ménage",
    "Ménage Air BnB",
    "Ménage fin de chantier",
    "Auxiliaire de vie",
    "Ménage post-sinistre"
  ],
  entreprise: [
    "Ménage bureaux",
    "Nettoyage fin de chantier",
    "Placement & gestion",
    "Ménage post-sinistre"
  ]
};

const getGesteMessage = (geste: any) => {
  if (!geste) return null;
  if (geste.gesture_type === 'intervention_gratuite') {
    return `« -100% appliqué sur cette demande. » source geste commercial`;
  }
  if (geste.gesture_type === 'facturation_annulee') {
    return `« Facturation annulée sur cette demande. » source geste commercial`;
  }
  if (geste.gesture_type === 'reduction_tarif') {
    if (geste.reduction_type === 'pourcentage') {
      return `« -${geste.reduction_value}% appliqué sur cette demande. » source geste commercial`;
    } else {
      return `« -${geste.reduction_value} dh appliqué sur cette demande. » source geste commercial`;
    }
  }
  return null;
};

export default function Dashboard() {

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [allDemandes, setAllDemandes] = useState<Demande[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ en_cours: 0, en_cours_particulier: 0, en_cours_entreprise: 0, en_cours_nouveau: 0, en_attente: 0 });
  const [clientDemandeCounts, setClientDemandeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'besoins' | 'abonnements'>('besoins');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showNoteModal, setShowNoteModal] = useState<{ demandeId: number; type: 'commercial' | 'operationnel'; note: string } | null>(null);
  const [showCAOModal, setShowCAOModal] = useState<Demande | null>(null);
  const [showAnnulationModal, setShowAnnulationModal] = useState<{ demandeId: number; isSubscription?: boolean } | null>(null);
  const [annulationReason, setAnnulationReason] = useState('');
  const [showFacturationAnnuleeModal, setShowFacturationAnnuleeModal] = useState<{ demandeId: number; type: 'facturation_annulee' | 'intervention_gratuite' } | null>(null);
  const [facturationAnnuleeReason, setFacturationAnnuleeReason] = useState('');
  const [facturationAnnuleeProfilPaye, setFacturationAnnuleeProfilPaye] = useState(false);
  const [caoDecision, setCaoDecision] = useState<'confirmed' | 'postponed' | 'cancelled' | null>(null);
  const [caoCancelReason, setCaoCancelReason] = useState('');
  const [caoPostponedDate, setCaoPostponedDate] = useState('');
  const [caoPostponedTime, setCaoPostponedTime] = useState('');
  const [caoNote, setCaoNote] = useState('');
  const [caoMenuOpen, setCaoMenuOpen] = useState(false);
  const [sendingCaoWhatsApp, setSendingCaoWhatsApp] = useState(false);
  const [caoPreviewIndex, setCaoPreviewIndex] = useState(0);
  const [allProfils, setAllProfils] = useState<any[]>([]);

  // Filtres
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('tous');
  const [prestationFilter, setPrestationFilter] = useState('toutes');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});

  // Nouveaux flags pour le formulaire complet
  const exactEditService = (editFormData.service || selectedDemande?.service || '').toString();
  const exactEditServiceNormalized = exactEditService.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const isCleaningService = exactEditServiceNormalized.includes('menage') || exactEditServiceNormalized.includes('nettoyage') || exactEditServiceNormalized.includes('chantier') || exactEditServiceNormalized.includes('sinistre') || exactEditServiceNormalized.includes('demenagement');
  // @ts-ignore
  const isMenageStandardService = exactEditServiceNormalized.includes('menage standard');
  const isMenageAirBnBService = exactEditServiceNormalized.includes('air bnb') || exactEditServiceNormalized.includes('airbnb');
  const isGrandMenageService = exactEditServiceNormalized.includes('grand menage') || exactEditServiceNormalized.includes('grand');
  const isFinChantierService = exactEditServiceNormalized.includes('fin de chantier') || exactEditServiceNormalized.includes('fin chantier');
  const isMenageBureauxService = exactEditServiceNormalized.includes('menage bureaux') || exactEditServiceNormalized.includes('bureaux');
  const isPostDemenagementService = exactEditServiceNormalized.includes('post-demenagement') || exactEditServiceNormalized.includes('post demenagement') || exactEditServiceNormalized.includes('demenagement');
  // @ts-ignore
  const isPostSinistreService = exactEditServiceNormalized.includes('post-sinistre') || exactEditServiceNormalized.includes('post sinistre') || exactEditServiceNormalized.includes('sinistre');
  const isAuxiliaireService = exactEditServiceNormalized.includes('auxiliaire de vie') || exactEditServiceNormalized.includes('auxiliaire');
  // @ts-ignore
  const isPlacementGestionService = exactEditServiceNormalized.includes('placement & gestion') || exactEditServiceNormalized.includes('placement et gestion') || exactEditServiceNormalized.includes('placement');
  const minDuree = (isGrandMenageService || isPostDemenagementService || isFinChantierService) ? 4 : isMenageBureauxService ? (editFormData.frequence === 'une fois' ? 4 : 2) : isMenageAirBnBService ? 2 : 3;

  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string, type: 'devis' | 'png' | 'facture', name: string, demandeId: number } | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [blinkNouveau, setBlinkNouveau] = useState(false);

  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const [commerciaux, setCommerciaux] = useState<User[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState<number | null>(null);
  const [showOpsAssignmentModal, setShowOpsAssignmentModal] = useState<number | null>(null);
  const [operationsOfficers, setOperationsOfficers] = useState<User[]>([]);

  useEffect(() => {
    if (checkPermission(user, 'affecter_commercial').allowed) {
      getUsers({ role: 'commercial' }).then(res => setCommerciaux(res.data?.results || res.data)).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (hasPermission(user, 'assigner_charge_operation')) {
      getUsers({ role: 'charge_operations' }).then(res => setOperationsOfficers(res.data?.results || res.data)).catch(console.error);
    }
  }, [user]);

  const handleAffecter = async (demandeId: number, commercialId: number) => {
    try {
      await affecterDemande(demandeId, commercialId);
      addToast('Demande affectée avec succès', 'success');
      fetchData();
      setShowAssignmentModal(null);
    } catch (err) {
      addToast('Erreur lors de l\'affectation', 'error');
    }
  };

  const handleAffecterOperations = async (demandeId: number, opsId: number) => {
    try {
      await affecterOperations(demandeId, opsId);
      addToast('Demande affectée au chargé d\'opération avec succès', 'success');
      fetchData();
      setShowOpsAssignmentModal(null);
    } catch (err) {
      addToast('Erreur lors de l\'affectation', 'error');
    }
  };

  const handlePreviewDocument = async (type: 'devis' | 'png' | 'facture') => {
    if (!selectedDemande) return;
    try {
      const typeLabel = type === 'devis' ? 'du devis' : (type === 'facture' ? 'de la facture' : 'du récapitulatif');
      if (type === 'devis') {
        addToast('Génération du devis côté frontend...', 'info');
        const { blob, name } = await generateDevisPdf(selectedDemande);
        const uploadResponse = await uploadDocument(selectedDemande.id, blob, 'devis', name);
        const doc = uploadResponse.data;

        let blobUrl = URL.createObjectURL(blob);
        if (doc?.download_url) {
          const secure = await fetchSecureDocBlob(doc.download_url);
          blobUrl = secure.blobUrl;
        }

        setShowPreviewModal({ url: blobUrl, type, name: doc?.nom || name, demandeId: selectedDemande.id });
      } else {
        addToast(`Génération ${typeLabel} sur le serveur...`, 'info');
        const response = await generateDocument(selectedDemande.id, type);
        const doc = response.data;
        const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
        setShowPreviewModal({ url: blobUrl, type, name: doc.nom, demandeId: selectedDemande.id });
      }

      const refreshed = await getDemandes();
      const allResults: Demande[] = Array.isArray(refreshed.data?.results)
        ? refreshed.data.results
        : (Array.isArray(refreshed.data) ? refreshed.data : []);
      const updatedDemande = allResults.find(d => d.id === selectedDemande.id);
      if (updatedDemande) setSelectedDemande(updatedDemande);
      fetchData();

      addToast('Aperçu prêt', 'success');
    } catch (error) {
      console.error(error);
      addToast('Erreur lors de la génération', 'error');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!showPreviewModal) return;
    setSendingWhatsApp(true);
    try {
      await sendWhatsApp(showPreviewModal.demandeId, showPreviewModal.type);
      addToast('Document envoyé via WhatsApp avec succès !', 'success');
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'envoi WhatsApp.", 'error');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const [showDetail, setShowDetail] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeMoreMenu, setActiveMoreMenu] = useState<number | null>(null);
  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('down');
  const [isAgencyExpanded, setIsAgencyExpanded] = useState(false);
  const [showPartsSection, setShowPartsSection] = useState(false);
  const [showHistorySection, setShowHistorySection] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  const fetchAuditHistory = async (demandeId: number) => {
    setLoadingAuditLogs(true);
    try {
      const response = await getAuditLogs({ model_name: 'Demande', object_id: demandeId });
      const data = response.data;
      const results: AuditLogItem[] = Array.isArray(data?.results)
        ? data.results
        : (Array.isArray(data) ? data : []);
      setAuditLogs(results);
    } catch (error) {
      console.error(error);
      setAuditLogs([]);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resDemandes, resAgents] = await Promise.all([
        getDemandes({ no_page: 'true' }),
        getAgents({ limit: 1000 })
      ]);
      const data = resDemandes.data;
      const allResults: Demande[] = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);

      if (resAgents.data) {
        const agents = resAgents.data.results || [];
        agents.sort((a: any, b: any) => {
          const nameA = (a.full_name || `${a.first_name || ''} ${a.last_name || ''}`).trim().toLowerCase();
          const nameB = (b.full_name || `${b.first_name || ''} ${b.last_name || ''}`).trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setAllProfils(agents);
      }

      const enAttenteList = allResults.filter(d => d.statut === 'en_attente');
      const results = allResults.filter(d => {
        if (d.statut === 'en_attente') return false;
        
        const facturation = d.formulaire_data?.facturation || {};
        const statutUi = facturation.statut_paiement_ui || getPaymentUiValue(d.statut_paiement || 'non_paye', Boolean(facturation.facturation_annulee));
        
        const isAnnule = d.statut === 'annule' || statutUi === 'facturation_annulee' || facturation.facturation_annulee;
        if (isAnnule) {
          const profilSeraPaye = (d as any).profil_sera_paye !== undefined ? Boolean((d as any).profil_sera_paye) : Boolean(facturation.profil_sera_paye);
          if (profilSeraPaye) {
            let allProfilesPaid = false;
            const parts = (d as any).parts_repartition || facturation.parts_repartition || d.formulaire_data?.parts_repartition || [];
            if (Array.isArray(parts) && parts.length > 0) {
              allProfilesPaid = parts.every((p: any) => p.part_profil_versee);
            } else {
              allProfilesPaid = Boolean(facturation.part_profil_versee);
            }
            if (!allProfilesPaid) return true; // Keep it on the dashboard
          }
          return false;
        }

        if (statutUi === 'paye') {
          return false;
        }
        
        return true;
      });
      setDemandes(results);
      setAllDemandes(allResults);

      const enCours = results.filter(d => !!d);
      const enCoursParticulier = enCours.filter(d => d.segment === 'particulier').length;
      const enCoursEntreprise = enCours.filter(d => d.segment === 'entreprise').length;
      const enCoursNouveau = enCours.filter(d => !d.cao).length;

      const counts = allResults
        .filter(d => d.statut !== 'annule')
        .reduce<Record<string, number>>((acc, d) => {
          const key = getClientKey(d);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      setClientDemandeCounts(counts);

      setStats({
        en_cours: enCours.length,
        en_cours_particulier: enCoursParticulier,
        en_cours_entreprise: enCoursEntreprise,
        en_cours_nouveau: enCoursNouveau,
        en_attente: enAttenteList.length,
      });
    } catch (err) {
      console.error(err);
      addToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getRowClass = (d: Demande) => {
    const classes = [];
    if (!d.cao && d.date_intervention && new Date(d.date_intervention).getTime() - new Date().getTime() < 86400000) {
      classes.push('row-alert');
    }

    // Color according to demand status (statut)
    if (d.statut === 'en_cours') {
      if (blinkNouveau && !d.cao) classes.push('blink-animation');
      else classes.push('row-status-nouveau');
    }
    else if (d.statut === 'en_attente') classes.push('row-status-attente');
    else if (d.statut === 'pres_en_cours') classes.push('row-status-pres-en-cours');
    else if (d.statut === 'pres_terminee') classes.push('row-status-pres-terminee');
    else if (d.statut === 'termine') classes.push('row-status-termine');
    else if (d.statut === 'annule') classes.push('row-status-annulee');

    return classes.join(' ');
  };

  const renderPaymentStatus = (d: Demande) => {
    const facturation = d.formulaire_data?.facturation || {};
    const statutUi = facturation.statut_paiement_ui || getPaymentUiValue(d.statut_paiement || 'non_paye', Boolean(facturation.facturation_annulee));
    
    const option = PAYMENT_STATUS_OPTIONS.find(o => o.value === statutUi);
    const label = option ? option.label : (d.statut_paiement_label || d.statut_paiement || 'Non payé');
    
    let badgeClass = 'badge-red';
    if (statutUi === 'paye' || statutUi === 'integral' || statutUi === 'intervention_gratuite') badgeClass = 'badge-green';
    else if (['agence_payee_client', 'profil_paye_client', 'paiement_partiel', 'paiement_en_attente'].includes(statutUi)) badgeClass = 'badge-orange';
    else if (statutUi === 'facturation_annulee') badgeClass = 'badge-red';
    
    return <span className={`badge ${badgeClass}`}>{label}</span>;
  };

  const handleCAOUpdate = async (demande: Demande, status: 'confirmed' | 'postponed' | 'cancelled') => {
    try {
      if (status === 'confirmed') {
        // Mark CAO as confirmed (cao = true)
        await confirmerCAO(demande.id);
        // Change status to "pres_en_cours" (Confirmation automatique)
        const updateData: any = { statut: 'pres_en_cours', cao: true, note_operationnel: caoNote || '' };
        await updateDemande(demande.id, updateData);

        addToast('Besoin confirmé intervention avec succès (sans envoi WhatsApp automatique)', 'success');
      } else if (status === 'postponed') {
        if (!caoPostponedDate) {
          addToast('Veuillez renseigner une nouvelle date proposée', 'warning');
          return;
        }

        // Reste dans le dashboard (statut en_cours) mais CAO redevient "NON" (Nouveau besoin en UI)
        await updateDemande(demande.id, {
          statut: 'en_cours',
          cao: false,
          date_intervention: caoPostponedDate,
          heure_intervention: caoPostponedTime,
          note_operationnel: caoNote || '',
        });
        addToast('CAO reporté : La demande reste dans le dashboard', 'info');
      } else if (status === 'cancelled') {
        if (!caoCancelReason.trim()) {
          addToast('Le motif d\'annulation est requis', 'warning');
          return;
        }

        // Statut devient "demande annulée" (annule - no accent for backend)
        await annulerDemande(demande.id, caoCancelReason.trim());
        if (caoNote.trim()) {
          await updateDemande(demande.id, { note_operationnel: caoNote });
        }
        addToast('Demande annulée', 'warning');
      }
      setShowCAOModal(null);
      setCaoDecision(null);
      setCaoCancelReason('');
      setCaoPostponedDate('');
      setCaoPostponedTime('');
      setCaoNote('');
      setCaoMenuOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de la mise à jour CAO', 'error');
    }
  };

  const openCAOModal = (demande: Demande) => {
    setShowCAOModal(demande);
    
    // Initialiser la décision selon l'état actuel de la demande
    let initialDecision: 'confirmed' | 'postponed' | 'cancelled' | null = null;
    if (demande.cao || ['pres_en_cours', 'pres_terminee', 'termine'].includes(demande.statut)) {
      initialDecision = 'confirmed';
    } else if (demande.statut === 'annule') {
      initialDecision = 'cancelled';
    }

    setCaoDecision(initialDecision);
    setCaoCancelReason('');
    setCaoPostponedDate((demande.date_intervention || '').slice(0, 10));
    setCaoPostponedTime(demande.heure_intervention || '');
    setCaoNote(demande.note_operationnel || '');
    setCaoMenuOpen(false);
    setCaoPreviewIndex(0);
  };

  const closeCAOModal = () => {
    setShowCAOModal(null);
    setCaoDecision(null);
    setCaoCancelReason('');
    setCaoPostponedDate('');
    setCaoPostponedTime('');
    setCaoNote('');
    setCaoMenuOpen(false);
    setCaoPreviewIndex(0);
  };

  const copyText = async (value: string, successMessage: string) => {
    if (!value) {
      addToast('Valeur introuvable', 'warning');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      addToast(successMessage, 'success');
    } catch (error) {
      window.prompt('Copiez la valeur :', value);
    }
  };

  const getCaoProfileLinks = (demande: Demande) => {
    const links = Array.isArray(demande.profil_share_links) ? demande.profil_share_links : [];
    if (links.length > 0) return links;

    if (demande.profil_share_link) {
      return [{
        agent_id: demande.profils_envoyes?.[demande.profils_envoyes.length - 1]?.id || 0,
        agent_name:
          demande.profils_envoyes?.[demande.profils_envoyes.length - 1]?.full_name ||
          [
            demande.profils_envoyes?.[demande.profils_envoyes.length - 1]?.first_name,
            demande.profils_envoyes?.[demande.profils_envoyes.length - 1]?.last_name,
          ].filter(Boolean).join(' ') ||
          'Candidat',
        link: demande.profil_share_link,
      }];
    }

    return [];
  };

  const handleSendCaoWhatsApp = async (demande: Demande) => {
    if (!demande.profils_envoyes?.length) {
      addToast('Aucun candidat assigné pour cet envoi', 'warning');
      return;
    }

    setSendingCaoWhatsApp(true);
    try {
      const response = await sendWhatsApp(demande.id, 'cao_profil');
      const sentCount = Number(response?.data?.sent_count || 0);
      const totalCount = Number(response?.data?.total || demande.profils_envoyes.length || 0);
      addToast(`${sentCount}/${totalCount} message(s) profil envoyé(s) via WhatsApp`, 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de l\'envoi WhatsApp de la candidature', 'error');
    } finally {
      setSendingCaoWhatsApp(false);
    }
  };

  const getSubscriptionDemandes = (parentId: number | string) => {
    const list = allDemandes.length > 0 ? allDemandes : demandes;
    const pId = Number(parentId);
    const filtered = list.filter(d => Number(d.id) === pId || (d.parent_demande && Number(d.parent_demande) === pId));
    console.log(`[getSubscriptionDemandes] parentId: ${parentId}, pId: ${pId}`);
    console.log(`[getSubscriptionDemandes] list length: ${list.length}, filtered length: ${filtered.length}`);
    console.log(`[getSubscriptionDemandes] list is allDemandes: ${allDemandes.length > 0}`);
    console.log(`[getSubscriptionDemandes] filtered items:`, filtered.map(x => ({ id: x.id, parent_demande: x.parent_demande, parts: x.parts_repartition })));
    return filtered;
  };
  
  const getParentDemande = (parentId: number | string, fallback: Demande) => {
    const list = allDemandes.length > 0 ? allDemandes : demandes;
    const pId = Number(parentId);
    return list.find(d => Number(d.id) === pId) || fallback;
  };

  const updatePartsAndAgency = (newParts: PartRepartitionItem[], overrideTvaActive?: boolean) => {
    setEditFormData((prev: any) => {
      const isFreeOrCancelled = prev.statut_paiement_ui === 'intervention_gratuite' || prev.statut_paiement_ui === 'facturation_annulee' || Boolean(prev.facturation_annulee);
      const montantHT = isFreeOrCancelled ? 0 : toNumber(prev.montant_ht ?? prev.prix);
      const tvaActive = overrideTvaActive !== undefined ? overrideTvaActive : (isFreeOrCancelled ? false : Boolean(prev.tva_active));
      const currentMontantTTC = isFreeOrCancelled ? 0 : roundMoney(tvaActive ? montantHT * 1.2 : montantHT);

      let adjustedParts = [...newParts];
      let nextMontantProfilAnnulation = prev.montant_profil_annulation;
      let nextProfilSeraPaye = prev.profil_sera_paye;

      if (isFreeOrCancelled) {
        // Do not redistribute the amountToDistribute. The parts amounts are calculated from hours/rates.
        // We sum them up to update the montant_profil_annulation automatically.
        const totalParts = adjustedParts.reduce((sum, p) => sum + toNumber(p.amount), 0);
        nextMontantProfilAnnulation = totalParts;
        nextProfilSeraPaye = totalParts > 0;
      }

      const totalParts = adjustedParts.reduce((sum, p) => sum + toNumber(p.amount), 0);
      
      let nextPartAgence = 0;
      const isAbonnement = prev.frequency === 'abonnement' || !!prev.parent_demande || !!selectedDemande?.parent_demande;

      if (isAbonnement) {
        const parentId = prev.parent_demande || selectedDemande?.parent_demande || selectedDemande?.id;
        const parentDemande = getParentDemande(parentId, selectedDemande!);
        const parentPrice = (selectedDemande?.id && Number(selectedDemande.id) === Number(parentId))
          ? currentMontantTTC
          : (parentDemande ? toNumber(parentDemande.prix) : 0);
          
        const subscriptionDemandes = getSubscriptionDemandes(parentId);
        const otherDemandsProfilesTotal = subscriptionDemandes.filter(d => Number(d.id) !== Number(selectedDemande?.id)).reduce((sum, d) => {
          const parts = d.parts_repartition || d.formulaire_data?.facturation?.parts_repartition || [];
          return sum + parts.reduce((s: number, p: any) => s + toNumber(p.amount), 0);
        }, 0);
        
        const remainingAgencyShare = parentPrice - (totalParts + otherDemandsProfilesTotal);
        
        if (prev.parent_demande) {
          // Child demand: Agency share is frozen to 0
          nextPartAgence = 0;
        } else {
          // Parent demand: Agency share is the remaining agency share
          nextPartAgence = isFreeOrCancelled ? 0 : roundMoney(remainingAgencyShare);
        }
      } else {
        nextPartAgence = isFreeOrCancelled ? 0 : roundMoney(currentMontantTTC - totalParts);
      }

      const updates: any = {
        ...prev,
        parts_repartition: adjustedParts,
        part_agence: nextPartAgence,
      };

      if (overrideTvaActive !== undefined) {
        updates.tva_active = overrideTvaActive;
      }

      if (isFreeOrCancelled) {
        updates.montant_profil_annulation = nextMontantProfilAnnulation;
        updates.profil_sera_paye = nextProfilSeraPaye;
        updates.montant_agence_doit_profil = nextProfilSeraPaye ? nextMontantProfilAnnulation : 0;
        updates.montant_profil_doit_agence = 0;
      } else {
        if (prev.statut_paiement_ui === 'profil_paye_client') {
          updates.montant_profil_doit_agence = nextPartAgence;
          updates.montant_agence_doit_profil = 0;
        } else if (prev.statut_paiement_ui === 'agence_payee_client') {
          updates.montant_agence_doit_profil = totalParts;
          updates.montant_profil_doit_agence = 0;
        } else {
          updates.montant_profil_doit_agence = 0;
          updates.montant_agence_doit_profil = 0;
        }
      }

      return updates;
    });
  };

  const handleUpdate = async () => {
    if (!selectedDemande) return;
    
    const form = document.getElementById('edit-mission-form') as HTMLFormElement;
    if (form && !form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid') as HTMLElement;
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
        addToast("Veuillez remplir tous les champs obligatoires", "error");
      }
      return;
    }
    
    try {
      const isFreeOrCancelled = editFormData.statut_paiement_ui === 'intervention_gratuite' || editFormData.statut_paiement_ui === 'facturation_annulee' || Boolean(editFormData.facturation_annulee);
      const montantHT = isFreeOrCancelled ? 0 : toNumber(editFormData.montant_ht ?? editFormData.prix);
      const tvaActive = isFreeOrCancelled ? false : Boolean(editFormData.tva_active);
      const montantTTC = isFreeOrCancelled ? 0 : roundMoney(tvaActive ? montantHT * 1.2 : montantHT);
      const montantVerse = isFreeOrCancelled ? 0 : toNumber(editFormData.montant_verse);
      const partAgence = isFreeOrCancelled ? 0 : toNumber(editFormData.part_agence);

      const normalizedFrequence = (editFormData.frequence || '').toString().toLowerCase();
      const frequency = normalizedFrequence
        ? (normalizedFrequence === 'une fois' ? 'oneshot' : 'abonnement')
        : selectedDemande.frequency;

      let partsRepartition = asArray<PartRepartitionItem>(editFormData.parts_repartition, [])
        .map((item) => ({
          profile_id: item.profile_id,
          amount: toNumber(item.amount),
          is_delegate: Boolean(item.is_delegate),
          rate_type: item.rate_type,
          hours: item.hours,
          days: item.days,
          rate_value: item.rate_value,
          created_at: item.created_at,
          created_by_name: item.created_by_name,
        }))
        .filter((item) => item.profile_id !== '');

      const isAbonnement = frequency === 'abonnement' || !!editFormData.parent_demande || !!selectedDemande.parent_demande;
      let finalPartAgence = partAgence;
      if (isAbonnement) {
        const parentId = editFormData.parent_demande || selectedDemande.parent_demande || selectedDemande.id;
        const parentDemande = getParentDemande(parentId, selectedDemande!);
        const parentPrice = (Number(selectedDemande.id) === Number(parentId))
          ? montantTTC
          : (parentDemande ? toNumber(parentDemande.prix) : 0);
          
        const subscriptionDemandes = getSubscriptionDemandes(parentId);
        const totalParts = partsRepartition.reduce((sum, p) => sum + toNumber(p.amount), 0);
        const otherDemandsProfilesTotal = subscriptionDemandes.filter(d => Number(d.id) !== Number(selectedDemande.id)).reduce((sum, d) => {
          const parts = d.parts_repartition || d.formulaire_data?.facturation?.parts_repartition || [];
          return sum + parts.reduce((s: number, p: any) => s + toNumber(p.amount), 0);
        }, 0);
        
        const remainingAgencyShare = parentPrice - (totalParts + otherDemandsProfilesTotal);
        
        if (editFormData.parent_demande) {
          finalPartAgence = 0;
        } else {
          finalPartAgence = isFreeOrCancelled ? 0 : roundMoney(remainingAgencyShare);
        }
      }

      if (isFreeOrCancelled) {
        const amountToDistribute = editFormData.profil_sera_paye ? toNumber(editFormData.montant_profil_annulation) : 0;
        const totalParts = partsRepartition.reduce((sum, p) => sum + toNumber(p.amount), 0);
        if (Math.abs(totalParts - amountToDistribute) > 0.01 && partsRepartition.length > 0) {
          const count = partsRepartition.length;
          const amountPerProfile = roundMoney(amountToDistribute / count);
          partsRepartition = partsRepartition.map((p, i) => ({
            ...p,
            amount: i === count - 1 ? roundMoney(amountToDistribute - (amountPerProfile * (count - 1))) : amountPerProfile
          }));
        }
      }

      const formatPhone = (p: string) => {
        if (!p) return "";
        let cleaned = p.replace(/\s+/g, '');
        if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
        if (!cleaned.startsWith('+')) return `+212${cleaned}`;
        return cleaned;
      };

      const isAuxiliaire = exactEditServiceNormalized.includes('auxiliaire de vie') || exactEditServiceNormalized.includes('auxiliaire');
      const cleanerCount = isAuxiliaire ? (parseInt(editFormData.nb_personnel) || 1) : (parseInt(editFormData.nb_intervenants) || 1);

      const updateData: any = {
        service: editFormData.service,
        segment: editFormData.segment,
        statut: editFormData.statut,
        prix: montantTTC,
        nb_heures: parseInt(editFormData.duree || editFormData.nb_heures) || 0,
        nb_intervenants: cleanerCount,
        avec_produit: Boolean(editFormData.produits || editFormData.avec_produit),
        frequency,
        frequency_label: editFormData.frequence || selectedDemande.frequency_label || '',
        mode_paiement: editFormData.mode_paiement || '',
        statut_paiement: 'non_paye',
        avance_paiement: montantVerse,
        date_intervention: editFormData.date || editFormData.date_intervention || null,
        heure_intervention: editFormData.heure || editFormData.heure_intervention || '',
        note_commercial: editFormData.note_commercial || '',
        note_operationnel: editFormData.note_operationnel || '',
        preference_horaire: editFormData.preference_horaire || '',
        client_name: editFormData.client_name || '',
        client_phone: formatPhone(editFormData.client_phone || ''),
        client_whatsapp: formatPhone(editFormData.client_whatsapp || editFormData.client_phone || ''),
        client_city: editFormData.ville || '',
        client_neighborhood: editFormData.quartier || '',
        client_address: editFormData.adresse || '',
      };

      const paymentUiValue = editFormData.statut_paiement_ui || getPaymentUiValue(editFormData.statut_paiement || 'non_paye', Boolean(editFormData.facturation_annulee));

      // Logic: Status transitions
      let finalStatutPaiementUi = paymentUiValue;
      let triggerSatisfactionWhatsApp = false;

      if (finalStatutPaiementUi === 'paye' && editFormData.statut !== 'pres_terminee') {
        addToast("Le statut 'Payé' ne peut être sélectionné que si la prestation est terminée.", "error");
        return;
      }

      if (editFormData.statut === 'termine' && selectedDemande.statut !== 'termine') {
        finalStatutPaiementUi = 'paiement_en_attente';
        triggerSatisfactionWhatsApp = true;
      } else if (editFormData.statut === 'pres_terminee' && selectedDemande.statut !== 'pres_terminee') {
        finalStatutPaiementUi = 'paiement_en_attente';
      }


      const paymentOption = PAYMENT_STATUS_OPTIONS.find((option) => option.value === finalStatutPaiementUi);
      updateData.statut_paiement = paymentOption?.apiValue || editFormData.statut_paiement || 'non_paye';

      const previousFormData = selectedDemande.formulaire_data || {};
      const previousAdditional = previousFormData.additionalServices || {};

      updateData.formulaire_data = {
        ...(selectedDemande.formulaire_data || {}),
        nom: editFormData.client_name || previousFormData.nom || '',
        whatsapp_phone: formatPhone(editFormData.client_whatsapp || editFormData.client_phone || '') || previousFormData.whatsapp_phone || '',
        ville: editFormData.ville || '',
        quartier: editFormData.quartier || '',
        adresse: editFormData.adresse || '',
        preference_horaire: editFormData.preference_horaire || '',
        type_habitation: editFormData.type_habitation || '',
        frequence: editFormData.frequence || '',
        nb_intervenants: cleanerCount,
        numberOfPeople: cleanerCount,
        nb_intervenantes: cleanerCount,
        surface: toNumber(editFormData.surface),
        details_pieces: editFormData.details_pieces || '',
        duree: parseInt(editFormData.duree || editFormData.nb_heures) || 0,
        produits: Boolean(editFormData.produits || editFormData.avec_produit),
        torchons: Boolean(editFormData.torchons || editFormData.avec_torchons),
        rooms: editFormData.rooms || previousFormData.rooms || {},
        service_type: editFormData.service_type || '',
        structure_type: editFormData.structure_type || '',
        scheduling_type: editFormData.scheduling_type || '',
        intervention_nature: editFormData.intervention_nature || '',
        accommodation_state: editFormData.accommodation_state || '',
        cleanliness_type: editFormData.cleanliness_type || '',
        heure: editFormData.heure || editFormData.heure_intervention || '',
        formula: editFormData.formula || previousFormData.formula || 'A',
        size_tier: editFormData.size_tier || previousFormData.size_tier || '1chambre',
        sizeTier: editFormData.size_tier || previousFormData.size_tier || '1chambre',
        conso: Boolean(editFormData.conso),
        linen_sets: parseInt(editFormData.linen_sets) || 0,
        linenSets: parseInt(editFormData.linen_sets) || 0,
        date: editFormData.date || editFormData.date_intervention || '',
        nb_personnel: cleanerCount,
        lieu_garde: editFormData.lieu_garde || 'domicile',
        age_personne: editFormData.age_personne || '',
        sexe_personne: editFormData.sexe_personne || '',
        mobilite: editFormData.mobilite || '',
        situation_medicale: editFormData.situation_medicale || '',
        nb_jours: parseInt(editFormData.nb_jours) || 1,
        additionalServices: {
          ...previousAdditional,
          produitsEtOutils: Boolean(editFormData.produits || editFormData.avec_produit),
          torchonsEtSerpierres: Boolean(editFormData.torchons || editFormData.avec_torchons),
        },
        facturation: {
          ...(previousFormData.facturation || {}),
          montant_ht: montantHT,
          tva_active: tvaActive,
          montant_ttc: montantTTC,
          montant_verse: montantVerse,
          montant_profil_doit: toNumber(editFormData.montant_profil_doit),
          facturation_annulee: finalStatutPaiementUi === 'facturation_annulee' || finalStatutPaiementUi === 'intervention_gratuite',
          statut_paiement_ui: finalStatutPaiementUi,
          mode_paiement: editFormData.mode_paiement || '',
          encaisse_par: editFormData.encaisse_par || '',
          part_agence: finalPartAgence,
          parts_repartition: partsRepartition,
          annulation_raison: editFormData.annulation_raison || '',
          profil_sera_paye: Boolean(editFormData.profil_sera_paye),
          montant_profil_annulation: editFormData.profil_sera_paye ? toNumber(editFormData.montant_profil_annulation) : 0,
          montant_agence_doit_profil: finalStatutPaiementUi === 'agence_payee_client'
            ? partsRepartition.reduce((sum, p) => sum + toNumber(p.amount), 0)
            : (editFormData.profil_sera_paye ? toNumber(editFormData.montant_profil_annulation) : 0),
          montant_profil_doit_agence: finalStatutPaiementUi === 'profil_paye_client'
            ? finalPartAgence
            : 0,
          ca_initial: toNumber(editFormData.ca_initial),
        },
        part_agence: finalPartAgence,
        parts_repartition: partsRepartition,
        notes: editFormData.note_client || '',
      };

      updateData.avec_produit = Boolean(editFormData.produits || editFormData.avec_produit);
      updateData.part_agence = finalPartAgence;

      const response = await updateDemande(selectedDemande.id, updateData);

      // If child subscription demand, update parent demand's part_agence in the DB
      const parentId = editFormData.parent_demande || selectedDemande.parent_demande;
      if (isAbonnement && parentId) {
        const parentDem = getParentDemande(parentId, selectedDemande!);
        if (parentDem) {
          const parentPrevForm = parentDem.formulaire_data || {};
          const parentPrevFact = parentPrevForm.facturation || {};
          const parentStatutPaiementUi = parentPrevFact.statut_paiement_ui;
          
          const totalParts = partsRepartition.reduce((sum, p) => sum + toNumber(p.amount), 0);
          const subscriptionDemandes = getSubscriptionDemandes(parentId);
          const otherDemandsProfilesTotal = subscriptionDemandes.filter(d => Number(d.id) !== Number(selectedDemande.id)).reduce((sum, d) => {
            const parts = d.parts_repartition || d.formulaire_data?.facturation?.parts_repartition || [];
            return sum + parts.reduce((s: number, p: any) => s + toNumber(p.amount), 0);
          }, 0);
          
          const parentPrice = toNumber(parentDem.prix);
          const newParentPartAgence = roundMoney(parentPrice - (totalParts + otherDemandsProfilesTotal));
          
          const parentUpdateData: any = {
            part_agence: newParentPartAgence,
            formulaire_data: {
              ...parentPrevForm,
              facturation: {
                ...parentPrevFact,
                part_agence: newParentPartAgence,
                montant_profil_doit_agence: parentStatutPaiementUi === 'profil_paye_client' ? newParentPartAgence : 0,
              },
              part_agence: newParentPartAgence
            }
          };
          await updateDemande(parentId, parentUpdateData);
        }
      }

      // Automated Action: Satisfaction WhatsApp
      if (triggerSatisfactionWhatsApp || (editFormData.statut === 'pres_terminee' && selectedDemande.statut !== 'pres_terminee')) {
        try {
          const clientPhone = editFormData.client_whatsapp || editFormData.client_phone || previousFormData.whatsapp_phone;
          if (clientPhone) {
            await sendWhatsApp(selectedDemande.id, 'feedback');
            addToast('Lien de satisfaction envoyé au client via WhatsApp', 'info');
          }
        } catch (waErr) {
          console.error("WhatsApp error:", waErr);
        }
      }

      // Assignation automatique des profils (Gestion des parts)
      const existingProfilIds = selectedDemande.profils_envoyes?.map((p: any) => p.id) || [];
      const currentProfilIds = partsRepartition
        .map((p) => parseInt(p.profile_id as unknown as string))
        .filter((id) => !isNaN(id));
      const newProfilIds = currentProfilIds.filter((id) => !existingProfilIds.includes(id));

      if (newProfilIds.length > 0) {
        for (const id of newProfilIds) {
          try {
            await sendProfilToDemande(selectedDemande.id, id);
          } catch (err) {
            console.error("Erreur lors de l'assignation automatique du profil", err);
          }
        }
        addToast(`${newProfilIds.length} profil(s) automatiquement assigné(s) au besoin`, 'success');
      }

      // Retrait automatique des profils supprimés de la répartition
      const removedProfilIds = existingProfilIds.filter((id: number) => !currentProfilIds.includes(id));
      if (removedProfilIds.length > 0) {
        for (const id of removedProfilIds) {
          try {
            await removeProfilFromDemande(selectedDemande.id, id);
          } catch (err) {
            console.error("Erreur lors du retrait automatique du profil", err);
          }
        }
        addToast(`${removedProfilIds.length} profil(s) retiré(s) du besoin`, 'info');
      }

      // Mettre à jour selectedDemande
      if (response.data) {
        setSelectedDemande(response.data);
      }

      await fetchData();
      setShowDetail(false);
      setIsEditing(false);
      addToast('Mise à jour effectuée avec succès !', 'success');

      if (editFormData.envoyer_whatsapp) {
        addToast('Demande de régénération et envoi WhatsApp transmise.', 'info');
      }
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de la mise à jour.', 'error');
    }
  };

  const openDetail = (d: Demande) => {
    const formData = d.formulaire_data || {};
    const facturationData = formData.facturation || {};
    const prixValue = toNumber(d.prix);
    const tvaActive = Boolean(facturationData.tva_active);
    const montantHT = toNumber(facturationData.montant_ht) || (tvaActive ? roundMoney(prixValue / 1.2) : prixValue);
    const caInitial = toNumber(facturationData.ca_initial) || 
      (facturationData.facturation_annulee 
        ? (tvaActive ? roundMoney(prixValue / 1.2) : prixValue)
        : (montantHT > 0 ? montantHT : (tvaActive ? roundMoney(prixValue / 1.2) : prixValue)));

    const paymentUiValue = getPaymentUiValue(
      d.statut_paiement,
      Boolean(facturationData.facturation_annulee),
      facturationData.statut_paiement_ui
    );

    // Synchroniser automatiquement parts_repartition avec les profils actuellement assignés (profils_envoyes)
    let savedParts = asArray<PartRepartitionItem>(facturationData.parts_repartition || formData.parts_repartition, []);
    
    if (d.profils_envoyes && d.profils_envoyes.length > 0) {
      const activeProfileIds = new Set(d.profils_envoyes.map((p: any) => Number(p.id)).filter(id => !isNaN(id)));
      
      // 1. Conserver uniquement les parts des profils encore assignés à la demande
      savedParts = savedParts.filter(p => {
        const pId = Number(p.profile_id);
        return !pId || activeProfileIds.has(pId);
      });
      
      const existingProfileIds = new Set(savedParts.map(p => Number(p.profile_id)).filter(id => !isNaN(id)));
      
      // 2. Ajouter automatiquement les profils actuellement assignés mais absents de la répartition
      d.profils_envoyes.forEach((p: any, idx: number) => {
        const pId = Number(p.id);
        if (pId && !existingProfileIds.has(pId)) {
          savedParts.push({
            profile_id: pId,
            amount: 0,
            is_delegate: savedParts.length === 0 && idx === 0,
          });
          existingProfileIds.add(pId);
        }
      });
    } else {
      // Si aucun profil n'est assigné, la répartition doit être vide
      savedParts = [];
    }

    // Ensure all savedParts elements are fully initialized with rate details
    savedParts = savedParts.map(p => {
      const rateType = p.rate_type || getDefaultRateTypeForService(d.service);
      let hours = p.hours;
      let days = p.days;
      let rateValue = p.rate_value;
      let amount = p.amount;

      const defaultHours = Number(d.nb_heures || d.formulaire_data?.duree || d.formulaire_data?.nb_heures || 4);
      const defaultDays = Number(d.formulaire_data?.nb_jours || 1);

      if (rateType === 'taux_forfaitaire') {
        if (days === undefined) days = defaultDays;
        if (rateValue === undefined) {
          if (amount > 0) {
            rateValue = roundMoney(amount / days);
          } else {
            rateValue = getServiceDefaultRate(d.service, rateType).rate;
          }
        }
        amount = roundMoney(days * rateValue);
      } else {
        // hourly
        if (hours === undefined) hours = defaultHours;
        if (rateValue === undefined) {
          if (amount > 0) {
            rateValue = roundMoney(amount / hours);
          } else {
            rateValue = getServiceDefaultRate(d.service, rateType, hours).rate;
          }
        }
        // Check if the rate_type wasn't set and rate matches standard, or if it differs:
        let finalRateType = p.rate_type;
        if (!finalRateType) {
          const standardRate = getServiceDefaultRate(d.service, 'taux_horaire_standard', hours).rate;
          if (Math.abs(rateValue - standardRate) < 0.01) {
            finalRateType = 'taux_horaire_standard';
            rateValue = standardRate;
          } else {
            finalRateType = 'taux_horaire_exceptionnel';
          }
        }
        amount = roundMoney(hours * rateValue);
        return {
          ...p,
          rate_type: finalRateType,
          hours,
          rate_value: rateValue,
          amount
        };
      }

      return {
        ...p,
        rate_type: rateType,
        days,
        rate_value: rateValue,
        amount
      };
    });

    let initialPartAgence = (paymentUiValue === 'intervention_gratuite' || paymentUiValue === 'facturation_annulee')
      ? 0
      : toNumber(facturationData.part_agence || formData.part_agence);

    if (d.frequency === 'abonnement' || !!d.parent_demande) {
      const parentId = d.parent_demande || d.id;
      const parentDemande = getParentDemande(parentId, d);
      const parentPrice = toNumber(parentDemande.prix);
      
      const subscriptionDemandes = getSubscriptionDemandes(parentId);
      const otherDemandsProfilesTotal = subscriptionDemandes.filter(x => Number(x.id) !== Number(d.id)).reduce((sum, x) => {
        const parts = x.parts_repartition || x.formulaire_data?.facturation?.parts_repartition || [];
        return sum + parts.reduce((s: number, p: any) => s + toNumber(p.amount), 0);
      }, 0);
      const currentDemandProfilesTotal = savedParts.reduce((sum, p) => sum + toNumber(p.amount), 0);
      
      const remainingAgencyShare = parentPrice - (currentDemandProfilesTotal + otherDemandsProfilesTotal);
      
      if (d.parent_demande) {
        initialPartAgence = 0;
      } else {
        initialPartAgence = (paymentUiValue === 'intervention_gratuite' || paymentUiValue === 'facturation_annulee')
          ? 0
          : roundMoney(remainingAgencyShare);
      }
    }

    setSelectedDemande(d);
    setIsEditing(true);
    setEditFormData({
      parent_demande: d.parent_demande || null,
      prix: prixValue,
      montant_ht: montantHT,
      ca_initial: caInitial,
      tva_active: tvaActive,
      geste_commercial: d.geste_commercial || null,
      montant_verse: toNumber(facturationData.montant_verse),
      montant_profil_doit: toNumber(facturationData.montant_profil_doit),
      facturation_annulee: Boolean(facturationData.facturation_annulee),
      part_agence: initialPartAgence,
      parts_repartition: savedParts,
      mode_paiement: facturationData.mode_paiement || d.mode_paiement || '',
      statut_paiement: d.statut_paiement,
      statut_paiement_ui: paymentUiValue,
      encaisse_par: facturationData.encaisse_par || '',
      annulation_raison: facturationData.annulation_raison || '',
      profil_sera_paye: Boolean(facturationData.profil_sera_paye),
      montant_profil_annulation: toNumber(facturationData.montant_profil_annulation),
      montant_agence_doit_profil: toNumber(facturationData.montant_agence_doit_profil),
      montant_profil_doit_agence: toNumber(facturationData.montant_profil_doit_agence),
      nb_heures: d.nb_heures || d.formulaire_data?.duree || d.formulaire_data?.nb_heures || '',
      duree: formData.duree || d.nb_heures || formData.duration || '',
      date_intervention: d.date_intervention || formData.date || '',
      date: formData.date || d.date_intervention || '',
      heure_intervention: d.heure_intervention || formData.heure || '',
      heure: formData.heure || d.heure_intervention || '',
      note_commercial: d.note_commercial || '',
      note_operationnel: d.note_operationnel || '',
      note_client: formData.notes || formData.message || '',
      service: d.service,
      segment: d.segment,
      frequency: (d.parent_demande || d.frequency === 'abonnement') ? 'abonnement' : 'oneshot',
      frequence: normalizeFrequence(formData.frequence || d.frequency_label || ((d.frequency === 'oneshot' && !d.parent_demande) ? 'une fois' : '1/sem')),
      client_name: d.client_name || formData.nom || formData.fullName || '',
      client_phone: d.client_phone || formData.phone || formData.whatsapp_phone || '',
      client_whatsapp: d.client_whatsapp || formData.whatsapp_phone || formData.whatsapp || '',
      client_email: d.client_detail?.email || formData.email || '',
      neighborhood: d.neighborhood_city || 'Casablanca',
      is_devis: d.is_devis,
      statut: d.statut,
      type_habitation: normalizeStructure(formData.type_habitation || formData.structure_type || ''),
      structure_type: normalizeStructure(formData.structure_type || ''),
      service_type: formData.service_type || 'flexible',
      scheduling_type: formData.scheduling_type || formData.type_planification || (d.heure_intervention ? 'fixed' : 'flexible'),
      intervention_nature: formData.intervention_nature || formData.nature_intervention || 'entretien_regulier',
      accommodation_state: formData.accommodation_state || formData.etat_logement || 'habite',
      cleanliness_type: formData.cleanliness_type || formData.type_proprete || 'regulier',
      nb_personnel: formData.nb_intervenants || formData.nb_personnel || formData.numberOfPeople || d.nb_intervenants || 1,
      surface: formData.surface || formData.surfaceArea || 0,
      details_pieces: formData.details_pieces || '',
      ville: formData.ville || d.client_city || 'Casablanca',
      quartier: normalizeQuartier(formData.quartier || d.client_neighborhood || ''),
      adresse: formData.adresse || d.client_address || '',
      preference_horaire: normalizeTimePref(formData.preference_horaire || ''),
      nb_intervenants: formData.nb_intervenants || formData.nb_personnel || formData.numberOfPeople || d.nb_intervenants || 1,
      rooms: formData.rooms || {
        cuisine: 0,
        suiteAvecBain: 0,
        suiteSansBain: 0,
        salleDeBain: 0,
        chambre: 0,
        salonMarocain: 0,
        salonEuropeen: 0,
        toilettesLavabo: 0,
        rooftop: 0,
        escalier: 0,
      },
      avec_produit: d.avec_produit || formData.produits || formData.produitsEtOutils || false,
      produits: d.avec_produit || formData.produits || formData.produitsEtOutils || false,
      avec_torchons: formData.torchons || formData.torchonsEtSerpierres || false,
      torchons: formData.torchons || formData.torchonsEtSerpierres || false,
      lieu_garde: formData.lieu_garde || 'domicile',
      age_personne: formData.age_personne || '',
      sexe_personne: normalizeSexe(formData.sexe_personne || ''),
      mobilite: normalizeMobilite(formData.mobilite || ''),
      situation_medicale: formData.situation_medicale || '',
      nb_jours: formData.nb_jours || 1,
      formula: formData.formula || 'A',
      size_tier: formData.size_tier || formData.sizeTier || '1chambre',
      conso: formData.conso || false,
      linen_sets: formData.linen_sets || formData.linenSets || 0,
      regenerer_devis: false,
      envoyer_whatsapp: false
    });
    setIsFormExpanded(false);
    setIsAgencyExpanded(false);
    setShowPartsSection(false);
    setShowHistorySection(false);
    fetchAuditHistory(d.id);
    setShowDetail(true);
  };

  useEffect(() => {
    if (editFormData?.duree !== undefined && editFormData.duree < minDuree) {
      setEditFormData((prev: any) => ({ ...prev, duree: minDuree }));
    }
  }, [minDuree, editFormData?.duree]);

  useEffect(() => { fetchData(); }, []);

  // Auto-open edit modal when navigating with ?edit=<demandeId>
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || loading) return;
    const id = Number(editId);
    if (isNaN(id)) return;

    // Try to find it in the current dashboard list first
    const found = demandes.find(d => d.id === id);
    if (found) {
      openDetail(found);
      setSearchParams({}, { replace: true });
    } else {
      // Demande has left the dashboard — fetch it directly
      getDemande(id).then(res => {
        if (res.data) {
          openDetail(res.data as Demande);
        } else {
          addToast('Demande introuvable', 'error');
        }
        setSearchParams({}, { replace: true });
      }).catch(() => {
        addToast('Erreur lors du chargement de la demande', 'error');
        setSearchParams({}, { replace: true });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, searchParams]);



  // Ferme les menus d'action lorsqu'on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest && (target.closest('.action-menu') || target.closest('.icon-btn'))) {
        return;
      }
      setActiveMenu(null);
      setActiveMoreMenu(null);
    };

    if (activeMenu !== null || activeMoreMenu !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenu, activeMoreMenu]);

  const filtered = useMemo(() => {
    return demandes.filter((d) => {
      // Filtre Onglet (Besoins vs Abonnements)
      const isAbonn = d.frequency === 'abonnement' || !!d.parent_demande;
      if (activeTab === 'abonnements' && !isAbonn) return false;
      if (activeTab === 'besoins' && isAbonn) return false;
      
      // Exclure les missions payées du tableau de bord
      const facturation = d.formulaire_data?.facturation || {};
      const statutUi = facturation.statut_paiement_ui || getPaymentUiValue(d.statut_paiement || 'non_paye', Boolean(facturation.facturation_annulee));
      if (statutUi === 'paye') {
        return false;
      }

      // Recherche
      if (search) {
        const clientName = d.client_name || d.formulaire_data?.nom || '';
        if (!clientName.toLowerCase().includes(search.toLowerCase()) && !d.service.toLowerCase().includes(search.toLowerCase())) return false;
      }

      // Filtre Service (SPP/SPE)
      if (serviceFilter !== 'tous') {
        if (serviceFilter === 'spp' && d.segment !== 'particulier') return false;
        if (serviceFilter === 'spe' && d.segment !== 'entreprise') return false;
      }

      // Filtre Prestation
      if (prestationFilter !== 'toutes' && d.service !== prestationFilter) return false;

      // Filtre Date
      if (dateRange.start || dateRange.end) {
        // En Dashboard, on utilise la date d'intervention
        const dateInterventionStr = d.date_intervention || d.formulaire_data?.date_intervention;
        if (dateInterventionStr) {
          const dateInterObj = new Date(dateInterventionStr);
          if (dateRange.start && dateInterObj < new Date(dateRange.start)) return false;
          if (dateRange.end) {
            const endObj = new Date(dateRange.end);
            endObj.setHours(23, 59, 59, 999);
            if (dateInterObj > endObj) return false;
          }
        }
      }

      return true;
    });
  }, [demandes, activeTab, search, serviceFilter, prestationFilter, dateRange]);

  const busyAgentIds = useMemo(() => {
    const activeIds = new Set<number>();
    const list = allDemandes.length > 0 ? allDemandes : demandes;
    for (const d of list) {
      if (selectedDemande && Number(d.id) === Number(selectedDemande.id)) continue;
      if (d.statut === 'en_attente' || d.statut === 'pres_terminee' || d.statut === 'termine') continue;

      const factDataDef = d.formulaire_data?.facturation || {};
      const statutUi = factDataDef.statut_paiement_ui || d.statut_paiement_ui || getPaymentUiValue(d.statut_paiement || 'non_paye', Boolean(factDataDef.facturation_annulee));

      if (statutUi === 'paye') continue;

      const isAnnule = d.statut === 'annule' || statutUi === 'facturation_annulee' || factDataDef.facturation_annulee;
      if (isAnnule) {
        const profilSeraPaye = (d as any).profil_sera_paye !== undefined ? Boolean((d as any).profil_sera_paye) : Boolean(factDataDef.profil_sera_paye);
        if (profilSeraPaye) {
          let allProfilesPaid = false;
          const parts = d.parts_repartition || factDataDef.parts_repartition || d.formulaire_data?.parts_repartition || [];
          if (Array.isArray(parts) && parts.length > 0) {
            allProfilesPaid = parts.every((p: any) => p.part_profil_versee);
          } else {
            allProfilesPaid = Boolean(factDataDef.part_profil_versee);
          }
          if (allProfilesPaid) continue;
        } else {
          continue;
        }
      }

      if (Array.isArray(d.profils_envoyes)) {
        for (const p of d.profils_envoyes) {
          if (p.id) activeIds.add(Number(p.id));
        }
      }

      const parts = d.parts_repartition || factDataDef.parts_repartition || d.formulaire_data?.parts_repartition || [];
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const pid = Number(part.profile_id);
          if (pid) activeIds.add(pid);
        }
      }
    }
    return activeIds;
  }, [allDemandes, demandes, selectedDemande]);
  const montantHT = toNumber(editFormData.montant_ht ?? editFormData.prix);
  const montantTTC = roundMoney(editFormData.tva_active ? montantHT * 1.2 : montantHT);
  const partsRepartition: PartRepartitionItem[] = asArray<PartRepartitionItem>(editFormData.parts_repartition, []);
  
  const currentPaymentStatutUi = editFormData.statut_paiement_ui || getPaymentUiValue(editFormData.statut_paiement || 'non_paye', Boolean(editFormData.facturation_annulee));
  const isPartsLocked = currentPaymentStatutUi === 'commercial_paye_client';  // Subscription remaining agency share calculation
  let remainingAgencyShare = 0;
  if (editFormData.frequency === 'abonnement' && selectedDemande) {
    const parentId = editFormData.parent_demande || selectedDemande.parent_demande || selectedDemande.id;
    const parentDemande = getParentDemande(parentId, selectedDemande);
    const parentPrice = (Number(selectedDemande.id) === Number(parentId))
      ? montantTTC
      : (parentDemande ? toNumber(parentDemande.prix) : 0);
      
    const subscriptionDemandes = getSubscriptionDemandes(parentId);
    const totalParts = partsRepartition.reduce((sum, p) => sum + toNumber(p.amount), 0);
    const otherDemandsProfilesTotal = subscriptionDemandes.filter(d => Number(d.id) !== Number(selectedDemande.id)).reduce((sum, d) => {
      const parts = d.parts_repartition || d.formulaire_data?.facturation?.parts_repartition || [];
      return sum + parts.reduce((s: number, p: any) => s + toNumber(p.amount), 0);
    }, 0);
    
    remainingAgencyShare = parentPrice - (totalParts + otherDemandsProfilesTotal);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble des besoins clients validés (en cours et terminés)</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div
          className="stat-card"
          style={{ backgroundColor: '#edba54', color: 'white', cursor: 'pointer' }}
          onClick={() => {
            setBlinkNouveau(true);
            setTimeout(() => setBlinkNouveau(false), 5000);
          }}
        >
          <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><ClipboardCheck size={22} /></div>
          <div>
            <p className="stat-value">{stats.en_cours}</p>
            <p className="stat-label">Demandes en cours</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {stats.en_cours_particulier} part. - {stats.en_cours_entreprise} ent. ({stats.en_cours_nouveau} nouveaux)
            </p>
          </div>
        </div>
        <div
          className="stat-card"
          style={{ backgroundColor: '#d9c532', color: 'white', cursor: 'pointer' }}
          onClick={() => navigate('/demandes')}
        >
          <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><Clock size={22} /></div>
          <div>
            <p className="stat-value">{stats.en_attente}</p>
            <p className="stat-label">En attente</p>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="dashboard-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="filter-select" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="tous">Tous segments</option>
          <option value="spp">Segment Particuliers (SPP)</option>
          <option value="spe">Segment Entreprises (SPE)</option>
        </select>

        <select className="filter-select" value={prestationFilter} onChange={(e) => setPrestationFilter(e.target.value)}>
          <option value="toutes">Toutes les prestations</option>
          {Array.from(new Set([...SERVICES_LIST.particulier, ...SERVICES_LIST.entreprise])).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <div className="pro-date-picker">
            <Calendar size={18} className="calendar-icon" />
            <input
              type="text"
              placeholder="Du"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="pro-date-input"
            />
          </div>
          <div className="pro-date-picker">
            <Calendar size={18} className="calendar-icon" />
            <input
              type="text"
              placeholder="Au"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="pro-date-input"
            />
          </div>
        </div>

        <div className="view-toggles">
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Vue liste"
          >
            <List size={20} />
          </button>
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Vue icônes"
          >
            <Grid size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'besoins' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('besoins')}
        >
          Besoins ({demandes.filter(d => d.frequency !== 'abonnement' && !d.parent_demande).length})
        </button>
        <button
          className={`tab ${activeTab === 'abonnements' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('abonnements')}
        >
          Abonnements ({demandes.filter(d => d.frequency === 'abonnement' || !!d.parent_demande).length})
        </button>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className={`table-wrapper dashboard-table-wrapper ${filtered.length >= 8 ? 'enable-table-scroll' : 'disable-table-scroll'}`}>
              <table className="data-table dashboard-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Com</th>
                    <th>Date d'interv.</th>
                    <th>Statut besoin</th>
                    <th>Nom du client</th>
                    <th>Quartier / Ville</th>
                    <th>Type de service</th>
                    <th>Seg.</th>
                    <th>Nb d'heures</th>
                    <th>Profils envoyés</th>
                    <th>Option sup.</th>
                    <th>CAO</th>
                    <th>Tarif total</th>
                    <th>Statut paie.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className={getRowClass(d)}>
                      <td className="relative">
                        <button
                          className="icon-btn"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            setMenuDirection(spaceBelow < 300 ? 'up' : 'down');
                            setActiveMenu(activeMenu === d.id ? null : d.id);
                            setActiveMoreMenu(null);
                          }}
                          aria-label="Actions"
                        >
                          <Settings size={14} />
                        </button>

                        {activeMenu === d.id && (
                          <div className="action-menu" style={{
                            left: 0,
                            right: 'auto',
                            ...(menuDirection === 'up' ? { top: 'auto', bottom: '100%', marginBottom: '5px' } : { top: '100%', bottom: 'auto', marginTop: '5px' })
                          }}>
                            {hasPermission(user, 'editer_besoin') && (
                              <button className="menu-item" onClick={() => { openDetail(d); setActiveMenu(null); }}>
                                <Edit2 size={14} /> Éditer le besoin
                              </button>
                            )}

                            {hasPermission(user, 'confirmation_avant_operation') && (
                              <button
                                className="menu-item w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCAOModal(d);
                                  setActiveMenu(null);
                                }}
                              >
                                <CheckCircle size={14} className={d.cao ? 'text-green-500' : ''} /> {d.cao ? 'Confirmation avant opération' : 'Confirmation avant opération'}
                              </button>
                            )}

                            {hasPermission(user, 'consulter_compte_client_dashboard') && (
                              <Link
                                to={d.client ? `/clients/${encodeId(d.client)}` : '#'}
                                className="menu-item"
                                onClick={() => setActiveMenu(null)}
                                style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                              >
                                <UserCheck size={14} /> Compte Client
                              </Link>
                            )}
                          </div>
                        )}
                      </td>
                      <td>{d.commercial_name || d.assigned_to_name || '—'}</td>
                      <td>{d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : (d.formulaire_data?.date_intervention || '—')}</td>
                      <td>
                        {renderStatusBadge(d.statut, d.cao)}
                      </td>
                      <td>
                        <div className="client-link-group">
                          {d.client ? (
                            <Link to={`/clients/${encodeId(d.client)}`} className="client-link">
                              {d.client_name || d.formulaire_data?.nom || '—'}
                            </Link>
                          ) : (
                            <span>{d.client_name || d.formulaire_data?.nom || '—'}</span>
                          )}
                          {(d.client_name || d.formulaire_data?.nom) && (
                            <span className="client-demandes-count">
                              x{clientDemandeCounts[getClientKey(d)] || 1}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {[d.formulaire_data?.quartier || d.client_neighborhood, d.formulaire_data?.ville || d.client_city].filter(Boolean).join(', ') || d.neighborhood_city || '—'}
                      </td>
                      <td>{d.service}</td>
                      <td>
                        <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>
                          {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                        </span>
                      </td>
                      <td>{d.nb_heures || d.formulaire_data?.duree || d.formulaire_data?.nb_heures || '—'}</td>
                      <td>
                        {(d.profils_envoyes?.length ?? 0) > 0 ? (
                          <div className="avatar-group">
                            {d.profils_envoyes?.map(p => (
                              <Link key={p.id} to={`/profils/${encodeId(p.id)}`} className="avatar-sm" title={p.full_name}>
                                {`${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}`.toUpperCase()}
                              </Link>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {d.service.toLowerCase().includes('bureaux') ? (
                          d.avec_produit ? 'Avec produits' : 'Sans produits'
                        ) : d.avec_produit ? (
                          <span className="text-sm">Oui ({d.tarif_produit} MAD)</span>
                        ) : 'Non'}
                      </td>
                      <td>
                        {d.cao ? (
                          <span className="badge badge-green">Oui</span>
                        ) : (
                          <span className="badge badge-red animate-pulse">Non</span>
                        )}
                      </td>
                      <td>
                        <div className="price-info">
                          <p className="price-main">{typeof d.prix === 'number' ? d.prix.toLocaleString('fr-FR') : (d.prix || '0')} MAD</p>
                          <p className="price-sub">{d.is_devis ? 'Prix/devis' : 'Prix/réservation'}</p>
                        </div>
                      </td>
                      <td>
                        {renderPaymentStatus(d)}
                      </td>
                      <td className="relative">
                        <button
                          className="icon-btn"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            setMenuDirection(spaceBelow < 350 ? 'up' : 'down');
                            setActiveMoreMenu(activeMoreMenu === d.id ? null : d.id);
                            setActiveMenu(null);
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>

                        {activeMoreMenu === d.id && (
                          <div className="action-menu shadow-xl border-0" style={{
                            right: 0,
                            left: 'auto',
                            minWidth: '220px',
                            ...(menuDirection === 'up' ? { top: 'auto', bottom: '100%', marginBottom: '5px' } : { top: '100%', bottom: 'auto', marginTop: '5px' })
                          }}>
                            {hasPermission(user, 'editer_besoin') && (
                              <button className="menu-item" style={{ color: '#334155' }} onClick={() => { openDetail(d); setActiveMoreMenu(null); }}>
                                <Pencil size={16} /> Éditer le besoin
                              </button>
                            )}

                            {hasPermission(user, 'note_commerciale_dashboard') && (
                              <button className="menu-item" style={{ color: '#0d9488' }} onClick={() => {
                                setShowNoteModal({ demandeId: d.id, type: 'commercial', note: '' });
                                setActiveMoreMenu(null);
                              }}>
                                <MessageSquare size={16} /> Note commerciale
                              </button>
                            )}
                            {hasPermission(user, 'note_operationnelle_dashboard') && (
                              <button className="menu-item" style={{ color: '#0d9488' }} onClick={() => {
                                setShowNoteModal({ demandeId: d.id, type: 'operationnel', note: '' });
                                setActiveMoreMenu(null);
                              }}>
                                <MessageSquare size={16} /> Note opérationnelle
                              </button>
                            )}

                            {hasPermission(user, 'assigner_charge_operation') && (
                              <button className="menu-item" style={{ color: '#0f766e' }} onClick={() => {
                                setShowOpsAssignmentModal(d.id);
                                setActiveMoreMenu(null);
                              }}>
                                <UserPlus size={16} /> Assigner au chargé d'opération
                              </button>
                            )}

                            {(hasPermission(user, 'editer_besoin') || hasPermission(user, 'note_commerciale_dashboard') || hasPermission(user, 'note_operationnelle_dashboard') || hasPermission(user, 'assigner_charge_operation')) && <div className="menu-divider" />}

                            {hasPermission(user, 'editer_besoin') && (
                              <>
                                <button 
                                  className="menu-item" 
                                  style={{ 
                                    color: '#6366f1',
                                    opacity: !d.cao ? 0.5 : 1,
                                    cursor: !d.cao ? 'not-allowed' : 'pointer'
                                  }} 
                                  disabled={!d.cao}
                                  onClick={async () => {
                                    if (!d.cao) return;
                                    await updateDemande(d.id, { statut: 'pres_en_cours' });
                                    addToast('Statut mis à jour : Prestation en cours', 'success');
                                    fetchData();
                                    setActiveMoreMenu(null);
                                  }}
                                >
                                  <CheckCircle size={16} /> Pres. en cours
                                </button>

                                <button 
                                  className="menu-item" 
                                  style={{ 
                                    color: '#0ea5e9',
                                    opacity: !(d.cao && d.statut === 'pres_en_cours') ? 0.5 : 1,
                                    cursor: !(d.cao && d.statut === 'pres_en_cours') ? 'not-allowed' : 'pointer'
                                  }} 
                                  disabled={!(d.cao && d.statut === 'pres_en_cours')}
                                  onClick={async () => {
                                    if (!(d.cao && d.statut === 'pres_en_cours')) return;
                                    await updateDemande(d.id, { statut: 'pres_terminee' });
                                    addToast('Statut mis à jour : Prestation terminée', 'success');
                                    addToast('Lien de satisfaction envoyé au client via WhatsApp', 'info');
                                    fetchData();
                                    setActiveMoreMenu(null);
                                  }}
                                >
                                  <CheckCircle size={16} /> Pres. terminée
                                </button>
                                <div className="menu-divider" />
                              </>
                            )}

                            {hasPermission(user, 'annulation_demande') && (
                              <button className="menu-item" style={{ color: '#ef4444' }} onClick={() => {
                                setAnnulationReason('');
                                const isSubscription = d.frequency === 'abonnement' || !!d.parent_demande;
                                setShowAnnulationModal({ demandeId: d.id, isSubscription });
                                setActiveMoreMenu(null);
                              }}>
                                <XCircle size={16} /> Rejeté / Annulé
                              </button>
                            )}

                            {hasPermission(user, 'facturation_annulee') && (
                              <button className="menu-item" style={{ color: '#f97316' }} onClick={() => {
                                const parts = (d.formulaire_data?.facturation?.parts_repartition || d.formulaire_data?.parts_repartition || []) as any[];
                                const totalParts = parts.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0);
                                setFacturationAnnuleeReason('');
                                setFacturationAnnuleeProfilPaye(totalParts > 0);
                                setShowFacturationAnnuleeModal({ demandeId: d.id, type: 'facturation_annulee' });
                                setActiveMoreMenu(null);
                              }}>
                                <XCircle size={16} /> Facturation annulée
                              </button>
                            )}

                            {hasPermission(user, 'supprimer_demande_dashboard') && (
                              <button className="menu-item" style={{ color: '#ef4444' }} onClick={async () => {
                                if (confirm('Êtes-vous sûr de vouloir supprimer définitivement cette demande ?')) {
                                  try {
                                    await deleteDemande(d.id);
                                    addToast('Demande supprimée avec succès', 'success');
                                    fetchData();
                                    setActiveMoreMenu(null);
                                  } catch (err) {
                                    addToast('Erreur lors de la suppression', 'error');
                                  }
                                }
                              }}>
                                <Trash2 size={16} /> Supprimer
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="demandes-grid">
              {filtered.map((d) => (
                <div key={d.id} className={`demande-card-detail ${getRowClass(d)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="client-name" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', lineHeight: '1.2' }}>
                        <span className="client-link-group">
                          {d.client ? (
                            <Link to={`/clients/${encodeId(d.client)}`} className="client-link">
                              {d.client_name || d.formulaire_data?.nom || '—'}
                            </Link>
                          ) : (
                            <span>{d.client_name || d.formulaire_data?.nom || '—'}</span>
                          )}
                          {(d.client_name || d.formulaire_data?.nom) && (
                            <span className="client-demandes-count">
                              x{clientDemandeCounts[getClientKey(d)] || 1}
                            </span>
                          )}
                        </span>
                      </h3>
                      <div className="text-muted text-xs font-semibold mt-1">
                        # {d.id} · {d.service}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>
                        {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                      </span>
                      {d.identification_statut === 'nouvelle' && <span className="badge badge-green" style={{ fontSize: '10px' }}>Nouvelle</span>}
                      {d.identification_statut === 'existant_valide' && <span className="badge badge-teal" style={{ fontSize: '10px' }}>Existant</span>}
                      {d.identification_statut === 'verification_requise' && <span className="badge badge-orange" style={{ fontSize: '10px' }}>Vérif.</span>}
                      <div className="relative">
                        <button
                          className="icon-btn"
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            setMenuDirection(spaceBelow < 350 ? 'up' : 'down');
                            setActiveMoreMenu(activeMoreMenu === d.id ? null : d.id);
                            setActiveMenu(null);
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>

                        {activeMoreMenu === d.id && (
                          <div className="action-menu shadow-xl border-0" style={{
                            right: 0,
                            left: 'auto',
                            minWidth: '220px',
                            zIndex: 50,
                            ...(menuDirection === 'up' ? { top: 'auto', bottom: '100%', marginBottom: '5px' } : { top: '100%', bottom: 'auto', marginTop: '5px' })
                          }}>
                            {hasPermission(user, 'editer_besoin') && (
                              <button className="menu-item" style={{ color: '#334155' }} onClick={() => { openDetail(d); setActiveMoreMenu(null); }}>
                                <Pencil size={16} /> Éditer le besoin
                              </button>
                            )}

                            {hasPermission(user, 'note_commerciale_dashboard') && (
                              <button className="menu-item" style={{ color: '#0d9488' }} onClick={() => {
                                setShowNoteModal({ demandeId: d.id, type: 'commercial', note: '' });
                                setActiveMoreMenu(null);
                              }}>
                                <MessageSquare size={16} /> Note commerciale
                              </button>
                            )}
                            {hasPermission(user, 'note_operationnelle_dashboard') && (
                              <button className="menu-item" style={{ color: '#0d9488' }} onClick={() => {
                                setShowNoteModal({ demandeId: d.id, type: 'operationnel', note: '' });
                                setActiveMoreMenu(null);
                              }}>
                                <MessageSquare size={16} /> Note opérationnelle
                              </button>
                            )}

                            {hasPermission(user, 'assigner_charge_operation') && (
                              <button className="menu-item" style={{ color: '#0f766e' }} onClick={() => {
                                setShowOpsAssignmentModal(d.id);
                                setActiveMoreMenu(null);
                              }}>
                                <UserPlus size={16} /> Assigner au chargé d'opération
                              </button>
                            )}

                            {(hasPermission(user, 'editer_besoin') || hasPermission(user, 'note_commerciale_dashboard') || hasPermission(user, 'note_operationnelle_dashboard') || hasPermission(user, 'assigner_charge_operation')) && <div className="menu-divider" />}

                            {hasPermission(user, 'editer_besoin') && (
                              <>
                                <button 
                                  className="menu-item" 
                                  style={{ 
                                    color: '#6366f1',
                                    opacity: !d.cao ? 0.5 : 1,
                                    cursor: !d.cao ? 'not-allowed' : 'pointer'
                                  }} 
                                  disabled={!d.cao}
                                  onClick={async () => {
                                    if (!d.cao) return;
                                    await updateDemande(d.id, { statut: 'pres_en_cours' });
                                    addToast('Statut mis à jour : Prestation en cours', 'success');
                                    fetchData();
                                    setActiveMoreMenu(null);
                                  }}
                                >
                                  <CheckCircle size={16} /> Pres. en cours
                                </button>

                                <button 
                                  className="menu-item" 
                                  style={{ 
                                    color: '#0ea5e9',
                                    opacity: !(d.cao && d.statut === 'pres_en_cours') ? 0.5 : 1,
                                    cursor: !(d.cao && d.statut === 'pres_en_cours') ? 'not-allowed' : 'pointer'
                                  }} 
                                  disabled={!(d.cao && d.statut === 'pres_en_cours')}
                                  onClick={async () => {
                                    if (!(d.cao && d.statut === 'pres_en_cours')) return;
                                    await updateDemande(d.id, { statut: 'pres_terminee' });
                                    addToast('Statut mis à jour : Prestation terminée', 'success');
                                    addToast('Lien de satisfaction envoyé au client via WhatsApp', 'info');
                                    fetchData();
                                    setActiveMoreMenu(null);
                                  }}
                                >
                                  <CheckCircle size={16} /> Pres. terminée
                                </button>
                                <div className="menu-divider" />
                              </>
                            )}

                            {hasPermission(user, 'annulation_demande') && (
                              <button className="menu-item" style={{ color: '#ef4444' }} onClick={() => {
                                setAnnulationReason('');
                                const isSubscription = d.frequency === 'abonnement' || !!d.parent_demande;
                                setShowAnnulationModal({ demandeId: d.id, isSubscription });
                                setActiveMoreMenu(null);
                              }}>
                                <XCircle size={16} /> Rejeté / Annulé
                              </button>
                            )}

                            {hasPermission(user, 'facturation_annulee') && (
                              <button className="menu-item" style={{ color: '#f97316' }} onClick={() => {
                                const parts = (d.formulaire_data?.facturation?.parts_repartition || d.formulaire_data?.parts_repartition || []) as any[];
                                const totalParts = parts.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0);
                                setFacturationAnnuleeReason('');
                                setFacturationAnnuleeProfilPaye(totalParts > 0);
                                setShowFacturationAnnuleeModal({ demandeId: d.id, type: 'facturation_annulee' });
                                setActiveMoreMenu(null);
                              }}>
                                <XCircle size={16} /> Facturation annulée
                              </button>
                            )}

                            {hasPermission(user, 'supprimer_demande_dashboard') && (
                              <button className="menu-item" style={{ color: '#ef4444' }} onClick={async () => {
                                if (confirm('Êtes-vous sûr de vouloir supprimer définitivement cette demande ?')) {
                                  try {
                                    await deleteDemande(d.id);
                                    addToast('Demande supprimée avec succès', 'success');
                                    fetchData();
                                    setActiveMoreMenu(null);
                                  } catch (err) {
                                    addToast('Erreur lors de la suppression', 'error');
                                  }
                                }
                              }}>
                                <Trash2 size={16} /> Supprimer
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.875rem', margin: '12px 0' }}>
                    <div>
                      <span className="text-muted" style={{ marginRight: '4px' }}>Date :</span>
                      <span style={{ fontWeight: '500' }}>
                        {d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : (d.formulaire_data?.date_intervention || '—')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted" style={{ marginRight: '4px' }}>Heures :</span>
                      <span style={{ fontWeight: '500' }}>
                        {d.nb_heures || d.formulaire_data?.duree || d.formulaire_data?.nb_heures || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted" style={{ marginRight: '4px' }}>Lieu :</span>
                      <span className="truncate" style={{ fontWeight: '500' }} title={d.neighborhood_city}>
                        {d.neighborhood_city || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted" style={{ marginRight: '4px' }}>Tarif :</span>
                      <span className="fw-bold">
                        {typeof d.prix === 'number' && d.prix > 0 ? `${d.prix.toLocaleString('fr-FR')} MAD` : (d.prix && d.prix !== '0' ? `${d.prix} MAD` : '—')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4 items-center flex-wrap">
                    {(d.avec_produit || d.formulaire_data?.produits) && (
                      <span className="badge badge-teal" style={{ padding: '4px 10px', borderRadius: '8px' }}>
                        Produits
                      </span>
                    )}
                    <span className={`badge ${d.statut === 'en_cours' ? 'badge-nouveau' :
                      d.statut === 'termine' ? 'badge-green' :
                        d.statut === 'pres_en_cours' ? 'badge-purple' :
                          d.statut === 'pres_terminee' ? 'badge-orange' :
                            'badge-orange'
                      }`} style={{ padding: '4px 12px', borderRadius: '8px' }}>
                      {d.statut === 'en_cours' ? (<><span>Nouveau</span><span>besoin</span></>) :
                        d.statut === 'termine' ? 'Terminé' :
                          d.statut === 'pres_en_cours' ? 'Pres. en cours' :
                            d.statut === 'pres_terminee' ? 'Pres. terminée' :
                              'En attente'}
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', justifyContent: 'flex-start' }}>
                    <div className="relative">
                      <button
                        className="icon-btn border"
                        style={{ backgroundColor: 'white', color: 'var(--primary)', borderRadius: '4px', width: '36px', height: '36px' }}
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setMenuDirection(spaceBelow < 300 ? 'up' : 'down');
                          setActiveMenu(activeMenu === d.id ? null : d.id);
                          setActiveMoreMenu(null);
                        }}
                      >
                        <Settings size={18} />
                      </button>

                      {activeMenu === d.id && (
                        <div className="action-menu shadow-xl border-0" style={{
                          right: 'auto', left: 0, zIndex: 50, minWidth: '220px',
                          ...(menuDirection === 'up' ? { top: 'auto', bottom: '100%', marginBottom: '8px' } : { top: '100%', bottom: 'auto', marginTop: '8px' })
                        }}>
                          {hasPermission(user, 'editer_besoin') && (
                            <button className="menu-item" style={{ color: '#334155' }} onClick={() => { openDetail(d); setActiveMenu(null); }}>
                              <Pencil size={16} /> Éditer le besoin
                            </button>
                          )}

                          {hasPermission(user, 'confirmation_avant_operation') && (
                            <button className="menu-item" style={{ color: '#0d9488' }} onClick={(e) => { e.stopPropagation(); openCAOModal(d); setActiveMenu(null); }}>
                              <CheckCircle size={16} className={d.cao ? 'text-green-500' : ''} /> Confirmation avant opération
                            </button>
                          )}

                          {hasPermission(user, 'consulter_compte_client_dashboard') && (
                            <Link to={d.client ? `/clients/${encodeId(d.client)}` : '#'} className="menu-item" onClick={() => setActiveMenu(null)} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <UserCheck size={16} /> Compte Client
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <div className="empty-state">
              <ClipboardCheck size={48} className="text-muted" />
              <p>Aucun besoin ne correspond à vos critères.</p>
              <button className="btn btn-secondary" onClick={() => {
                setSearch('');
                setServiceFilter('tous');
                setPrestationFilter('toutes');
              }}>Réinitialiser les filtres</button>
            </div>
          )}
        </>
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <div className="modal-overlay z-[110]" onClick={() => setShowNoteModal(null)}>
          <div className="modal-content max-w-[500px]" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: 0, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: 'none' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ccfbf1', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#0d9488' }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    {showNoteModal.type === 'commercial' ? 'Note Commerciale' : 'Note Opérationnelle'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Saisie des informations de la demande</p>
                </div>
              </div>
              <button
                onClick={() => setShowNoteModal(null)}
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
              >
                <XCircle size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Note History */}
              {(() => {
                const demandObj = demandes.find(x => x.id === showNoteModal.demandeId);
                const currentNotes = showNoteModal.type === 'commercial' 
                  ? demandObj?.note_commercial 
                  : demandObj?.note_operationnel;
                if (!currentNotes) return null;
                return (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Historique des notes</label>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {currentNotes}
                    </div>
                  </div>
                );
              })()}

              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Nouvelle note</label>
              <textarea
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', fontSize: '14px', color: '#0f172a', minHeight: '100px', resize: 'vertical', outline: 'none', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                placeholder={`Veuillez rédiger la note ${showNoteModal.type === 'commercial' ? 'commerciale' : 'opérationnelle'}...`}
                value={showNoteModal.note}
                onChange={(e) => setShowNoteModal({ ...showNoteModal, note: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#ffffff' }}>
              <button
                onClick={() => setShowNoteModal(null)}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', backgroundColor: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#475569'; }}
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  try {
                    const demandObj = demandes.find(d => d.id === showNoteModal.demandeId);
                    const existingNotes = showNoteModal.type === 'commercial'
                      ? (demandObj?.note_commercial || '')
                      : (demandObj?.note_operationnel || '');
                    
                    const newNote = showNoteModal.note.trim();
                    if (!newNote) {
                      addToast('Veuillez saisir une note', 'info');
                      return;
                    }
                    
                    const formattedDate = new Date().toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const noteWithHeader = `[${formattedDate}] : ${newNote}`;
                    const updatedNotes = existingNotes 
                      ? `${existingNotes}\n\n${noteWithHeader}` 
                      : noteWithHeader;

                    const payload = showNoteModal.type === 'commercial'
                      ? { note_commercial: updatedNotes }
                      : { note_operationnel: updatedNotes };
                      
                    await updateDemande(showNoteModal.demandeId, payload);
                    addToast('Note enregistrée avec succès', 'success');
                    setShowNoteModal(null);
                    fetchData(); // Refresh to update list
                  } catch (err) {
                    addToast('Erreur lors de la sauvegarde', 'error');
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', backgroundColor: '#0f766e', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2), 0 2px 4px -1px rgba(15, 118, 110, 0.1)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0d9488'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f766e'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Save size={18} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal / Sheet */}
      {showDetail && selectedDemande && (
        <div className="modal-overlay detail-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-content detail-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header py-4">
              <div className="form-header-compact">
                <button className="back-btn-circle" onClick={() => setShowDetail(false)}>
                  <ChevronLeft size={20} className="text-primary" />
                </button>
                <div>
                  <h2 className="text-xl fw-bold">Éditer le besoin — # {selectedDemande.id}</h2>
                  <p className="text-sm text-muted">Formulaire : {selectedDemande.service}</p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowDetail(false)}>✕</button>
            </div>
            <div className="sheet-body px-6">
              {isEditing ? (
                <form id="edit-mission-form" className="edit-form-full" onSubmit={(e) => e.preventDefault()}>
                  <div className="form-collapsible-section">
                    <div
                      className="form-section-header demande form-section-header-soft"
                      onClick={() => setIsFormExpanded(!isFormExpanded)}
                    >
                      <div className="section-title">
                        <ClipboardList size={18} />
                        <span>Formulaire de la demande</span>
                      </div>
                      {isFormExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>

                    {isFormExpanded && (
                      <fieldset disabled={user?.role === 'charge_operations'} style={{ border: 'none', padding: 0, margin: 0, width: '100%' }}>
                        <div className="form-section-content">
                        {/* ====== CONDITIONAL SERVICE SECTIONS ====== */}
                        {isAuxiliaireService ? (
                          /* Auxiliaire de vie - Service sur mesure */
                          <>
                            <div className="ws-form-block">
                              <div className="ws-section-header">Choisissez la fréquence</div>
                              <div className="p-4" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                                <div className="ws-radio-pills" style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '9999px', margin: '0 auto', maxWidth: '400px' }}>
                                  {['une fois', 'abonnement'].map(freq => {
                                    const isSelected = (editFormData.frequence === 'une fois' && freq === 'une fois') || (editFormData.frequence !== 'une fois' && editFormData.frequence !== '' && freq === 'abonnement');
                                    return (
                                      <label key={freq} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '0.75rem', borderRadius: '9999px', fontWeight: 'bold', transition: 'all 0.2s', background: isSelected ? 'var(--primary)' : 'transparent', color: isSelected ? 'white' : '#64748b' }}>
                                        <input type="radio" name="frequence_type" value={freq} style={{ display: 'none' }}
                                          checked={isSelected}
                                          onChange={() => {
                                            if (freq === 'une fois') setEditFormData({ ...editFormData, frequence: 'une fois' });
                                            else setEditFormData({ ...editFormData, frequence: '1/sem' });
                                          }} />
                                        <span>{freq === 'une fois' ? 'Une fois' : 'Abonnement'}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                {editFormData.frequence !== 'une fois' && editFormData.frequence !== '' && (
                                  <div style={{ marginTop: '1.5rem', maxWidth: '400px', margin: '1.5rem auto 0' }}>
                                    <select className="ws-select" required value={editFormData.frequence} onChange={e => setEditFormData({ ...editFormData, frequence: e.target.value })} style={{ width: '100%' }}>
                                      <option value="1/sem">1 fois par semaine</option>
                                      <option value="2/sem">2 fois par semaine</option>
                                      <option value="3/sem">3 fois par semaine</option>
                                      <option value="4/sem">4 fois par semaine</option>
                                      <option value="5/sem">5 fois par semaine</option>
                                      <option value="6/sem">6 fois par semaine</option>
                                      <option value="7/sem">7 fois par semaine</option>
                                      <option value="1/mois">1 fois par mois</option>
                                      <option value="2/mois">2 fois par mois</option>
                                      <option value="3/mois">3 fois par mois</option>
                                      <option value="4/mois">4 fois par mois</option>
                                      <option value="quotidien">Abonnement - Quotidien</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="ws-form-block">
                              <div className="ws-section-header">Nombre de personne</div>
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setEditFormData({ ...editFormData, nb_personnel: Math.max(1, (editFormData.nb_personnel || 1) - 1) })} style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>−</button>
                                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', minWidth: '40px', textAlign: 'center' }}>{editFormData.nb_personnel || 1}</span>
                                <button type="button" onClick={() => setEditFormData({ ...editFormData, nb_personnel: (editFormData.nb_personnel || 1) + 1 })} style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>+</button>
                              </div>
                            </div>

                            <div className="ws-form-block">
                              <div className="ws-section-header">Planning de la demande</div>
                              <div className="p-6" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                  <div style={{ textAlign: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.875rem', cursor: 'pointer' }}>
                                      <input type="radio" name="scheduling_type" value="fixed" checked={editFormData.scheduling_type === 'fixed'} onChange={() => setEditFormData({ ...editFormData, scheduling_type: 'fixed' })} />
                                      Je souhaite une heure fixe
                                    </label>
                                    <input type="time" disabled={editFormData.scheduling_type !== 'fixed'} value={editFormData.heure || ''} onChange={e => setEditFormData({ ...editFormData, heure: e.target.value })} style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'center', width: '120px' }} />
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.875rem', cursor: 'pointer' }}>
                                      <input type="radio" name="scheduling_type" value="flexible" checked={editFormData.scheduling_type === 'flexible'} onChange={() => setEditFormData({ ...editFormData, scheduling_type: 'flexible' })} />
                                      Je suis flexible
                                    </label>
                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                        <input type="radio" name="preference_horaire" value="matin" disabled={editFormData.scheduling_type !== 'flexible'} checked={editFormData.preference_horaire === 'matin'} onChange={() => setEditFormData({ ...editFormData, preference_horaire: 'matin' })} />
                                        Le matin
                                      </label>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                        <input type="radio" name="preference_horaire" value="apres_midi" disabled={editFormData.scheduling_type !== 'flexible'} checked={editFormData.preference_horaire === 'apres_midi'} onChange={() => setEditFormData({ ...editFormData, preference_horaire: 'apres_midi' })} />
                                        L'après midi
                                      </label>
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <label style={{ fontWeight: 'bold', color: 'var(--primary)', display: 'block', marginBottom: '1rem', fontSize: '0.875rem' }}>Date</label>
                                    <input type="date" value={editFormData.date || ''} onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', maxWidth: '200px' }} />
                                  </div>
                                </div>

                                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1.5rem', marginTop: '1.5rem', textAlign: 'center' }}>
                                  <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '1rem' }}>Nombre de jours</label>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1.5rem', background: 'white', padding: '0.5rem 1.5rem', borderRadius: '9999px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                    <button type="button" onClick={() => setEditFormData({ ...editFormData, nb_jours: Math.max(1, editFormData.nb_jours - 1) })} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>−</button>
                                    <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.875rem', textTransform: 'uppercase' }}>{editFormData.nb_jours || 1} JOUR(S)</span>
                                    <button type="button" onClick={() => setEditFormData({ ...editFormData, nb_jours: (editFormData.nb_jours || 1) + 1 })} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>+</button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="ws-form-block">
                              <div className="ws-section-header">Profil de la personne aidée</div>
                              <div className="p-6" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                  <div>
                                    <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Âge :</label>
                                    <div style={{ position: 'relative' }}>
                                      <input type="number" placeholder="Âge de la personne" required value={editFormData.age_personne || ''} onChange={e => setEditFormData({ ...editFormData, age_personne: e.target.value })} style={{ width: '100%', padding: '0.5rem 3rem 0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8' }}>ANS</span>
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Sexe :</label>
                                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                        <input type="radio" name="sexe_personne" value="femme" checked={editFormData.sexe_personne === 'femme'} onChange={() => setEditFormData({ ...editFormData, sexe_personne: 'femme' })} />
                                        Femme
                                      </label>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                        <input type="radio" name="sexe_personne" value="homme" checked={editFormData.sexe_personne === 'homme'} onChange={() => setEditFormData({ ...editFormData, sexe_personne: 'homme' })} />
                                        Homme
                                      </label>
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div>
                                    <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Mobilité et Type :</label>
                                    <div style={{ background: 'white', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {["Adulte", "Personne Agée", "Autonome", "Besoin d'aide", "Alité(e)"].map(mob => (
                                        <label key={mob} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '500', color: '#334155' }}>
                                          <input type="radio" name="mobilite" value={mob} checked={editFormData.mobilite === mob} onChange={() => setEditFormData({ ...editFormData, mobilite: mob })} />
                                          {mob}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Pathologie :</label>
                                    <textarea rows={5} placeholder="Détaillez ici la situation médicale..." required value={editFormData.situation_medicale || ''} onChange={e => setEditFormData({ ...editFormData, situation_medicale: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.875rem', resize: 'none' }}></textarea>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="ws-form-block">
                              <div className="ws-section-header">Autre précision</div>
                              <div className="p-4" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                                <textarea rows={3} placeholder="Ex: besoin d'un auxiliaire de vie homme, barrière de langue, régime particulier..." value={editFormData.notes || ''} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} style={{ width: '100%', minHeight: '80px', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.875rem', resize: 'none' }}></textarea>
                              </div>
                            </div>

                            <div className="ws-form-block">
                              <div className="ws-section-header">Lieu de la garde</div>
                              <div className="p-4" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                                <div className="grid grid-cols-3 gap-4">
                                  {['domicile', 'clinique', 'hopital'].map(loc => (
                                    <label key={loc} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', borderRadius: '0.75rem', border: editFormData.lieu_garde === loc ? '2px solid var(--primary)' : '2px solid transparent', background: editFormData.lieu_garde === loc ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                      <input type="radio" name="careLocation" value={loc} style={{ marginBottom: '0.5rem' }} checked={editFormData.lieu_garde === loc} onChange={e => setEditFormData({ ...editFormData, lieu_garde: e.target.value })} />
                                      <span style={{ fontWeight: 'bold', fontSize: '0.75rem', color: '#334155', textTransform: 'capitalize' }}>{loc === 'hopital' ? 'Hôpital' : loc}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <DynamicServiceForm
                              serviceKey={exactEditService}
                              formData={editFormData}
                              setFormData={setEditFormData}
                              minDuree={minDuree}
                              activeSegment={editFormData.segment}
                            />
                          </>
                        )}


                        {/* ====== LOCALISATION (all services) ====== */}
                        <div className="ws-form-block">
                          <div className="ws-section-header">Où aura lieu votre {isCleaningService ? 'ménage' : 'intervention'} ?</div>
                          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                            <div className="form-group">
                              <label className="label-teal">Ville *</label>
                              <select className="ws-select" required value={editFormData.ville} onChange={e => setEditFormData({ ...editFormData, ville: e.target.value, quartier: '' })}>
                                {['Casablanca', 'Rabat', 'Salé', 'Temara', 'Ain Aouda', 'El Harhoura', 'Bouskoura', 'Dar Bouazza', 'Mansouria', 'Almaz', 'Sidi Rahal', 'Benslimane', 'Mohammédia', 'Ville Verte'].map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label className="label-teal">Quartier *</label>
                              <input
                                type="text"
                                placeholder="Précisez le quartier"
                                required
                                value={editFormData.quartier}
                                onChange={e => setEditFormData({ ...editFormData, quartier: e.target.value })}
                              />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                              <label className="label-teal">Adresse / Repères</label>
                              <textarea rows={2} placeholder="Donnez-nous des repères pour faciliter l'intervention..." value={editFormData.adresse} onChange={e => setEditFormData({ ...editFormData, adresse: e.target.value })}></textarea>
                            </div>
                          </div>
                          {['Bouskoura', 'Dar Bouazza', 'Mansouria', 'Almaz', 'Sidi Rahal', 'Benslimane', 'Mohammédia', 'Ville Verte'].includes(editFormData.ville) && (
                            <div className="ws-surcharge-notice">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                              <p>Un supplément de <strong>50 MAD</strong> sera facturé pour cette zone géographique.</p>
                            </div>
                          )}
                        </div>


                        <div className="section-divider"></div>
                        <h4 className="contact-section-title">Informations contact</h4>

                        <div className="form-grid-2 gap-4 mb-4">
                          <div className="form-group">
                            <label>Nom</label>
                            <input type="text" value={editFormData.client_name} onChange={e => setEditFormData({ ...editFormData, client_name: e.target.value })} className="edit-input" />
                          </div>
                          <div className="form-group">
                            <label>Tél. direct</label>
                            <input type="text" value={editFormData.client_phone} onChange={e => setEditFormData({ ...editFormData, client_phone: e.target.value })} className="edit-input" />
                          </div>
                        </div>

                        <div className="form-grid-2 gap-4 mb-4">
                          <div className="form-group">
                            <label>Tél. WhatsApp</label>
                            <input type="text" value={editFormData.client_whatsapp} onChange={e => setEditFormData({ ...editFormData, client_whatsapp: e.target.value })} className="edit-input" />
                          </div>
                          <div className="form-group">
                            <label>Ville</label>
                            <input type="text" value={editFormData.ville} onChange={e => setEditFormData({ ...editFormData, ville: e.target.value })} className="edit-input" />
                          </div>
                        </div>

                        <div className="form-grid-2 gap-4 mb-4">
                          <div className="form-group">
                            <label>Quartier</label>
                            <input type="text" value={editFormData.quartier} onChange={e => setEditFormData({ ...editFormData, quartier: e.target.value })} className="edit-input" />
                          </div>
                          <div className="form-group">
                            <label>Adresse</label>
                            <input type="text" value={editFormData.adresse} onChange={e => setEditFormData({ ...editFormData, adresse: e.target.value })} className="edit-input" />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Notes client</label>
                          <textarea
                            value={editFormData.note_client || ''}
                            onChange={e => setEditFormData({ ...editFormData, note_client: e.target.value })}
                            className="edit-textarea"
                            rows={3}
                            placeholder="Notes du client..."
                          />
                        </div>
                      </div>
                    </fieldset>
                  )}
                  </div>

                  <div className="form-collapsible-section espace-agence-container">
                    <button type="button" className="form-section-header agence form-section-header-soft" onClick={() => setIsAgencyExpanded(!isAgencyExpanded)}>
                      <div className="section-title">
                        <Building2 size={18} />
                        <span>Espace agence</span>
                      </div>
                      {isAgencyExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>

                    {isAgencyExpanded && <div className="form-section-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                      {/* ── Besoin ── */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(3,114,101,0.08)', border: '1px solid rgba(3,114,101,0.15)', marginBottom: '12px' }}>
                          <ClipboardList size={18} style={{ color: '#037265' }} />
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#037265' }}>Besoin</span>
                        </div>
                        <div className="form-grid-3 gap-4">
                          <div className="form-group">
                            <label>Statut du besoin</label>
                            <div style={{ padding: '0 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, fontSize: '14px', height: '38px' }}>
                              {(() => {
                                const info = getStatusInfo(selectedDemande?.statut || '', selectedDemande?.cao);
                                return (
                                  <>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: info.badgeClass.includes('green') ? '#2F855A' : info.badgeClass.includes('orange') ? '#ED8936' : info.badgeClass.includes('red') ? '#E53E3E' : info.badgeClass.includes('purple') ? '#8B5CF6' : '#3B82F6' }} />
                                    <span style={{ color: '#0F766E' }}>{typeof info.label === 'string' ? info.label : 'Nouveau besoin'}</span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Segment</label>
                            <div style={{ padding: '0 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '14px', height: '38px', color: '#64748b' }}>
                              {editFormData.segment === 'entreprise' ? 'Entreprise' : 'Particulier'}
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Type de service</label>
                            <div style={{ padding: '0 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '14px', height: '38px', color: '#64748b' }}>
                              {editFormData.service || '—'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── Facturation ── */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: '12px' }}>
                          <FileText size={18} style={{ color: '#D97706' }} />
                          <span style={{ fontSize: '16px', fontWeight: 700, color: '#B45309' }}>Facturation</span>
                        </div>
                        <div className="form-grid-3 gap-4">
                          <div className="form-group">
                            <label>Montant HT (MAD)</label>
                            <div style={{ padding: '0 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', fontWeight: 500, fontSize: '14px', height: '38px', color: '#64748b' }}>
                              {editFormData.montant_ht}
                            </div>
                            {editFormData.statut_paiement_ui === 'facturation_annulee' && (
                              <p style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600, marginTop: '6px' }}>
                                « CA de cette demande : {toNumber(editFormData.ca_initial)} DH »
                              </p>
                            )}
                            {editFormData.geste_commercial && (() => {
                              const msg = getGesteMessage(editFormData.geste_commercial);
                              if (!msg) return null;
                              return (
                                <p style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, marginTop: '6px' }}>
                                  {msg}
                                </p>
                              );
                            })()}
                          </div>
                          <div className="form-group">
                            <label>TVA (20%)</label>
                            <label className="switch-inline"><label className="switch"><input type="checkbox" checked={Boolean(editFormData.tva_active)} onChange={e => {
                              updatePartsAndAgency(partsRepartition, e.target.checked);
                            }} /><span className="slider round" /></label><span>{editFormData.tva_active ? 'Oui' : 'Non'}</span></label>
                            {!editFormData.tva_active && <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600, marginTop: '4px' }}>Montant sans TVA</p>}
                          </div>
                          <div className="form-group">
                            <label>Montant TTC (MAD)</label>
                            <div style={{ padding: '0 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', height: '38px', fontSize: '14px', fontWeight: 600 }}>{montantTTC.toFixed(2)}</div>
                          </div>
                        </div>
                        <div className="form-grid-3 gap-4" style={{ marginTop: '16px' }}>
                          <div className="form-group">
                            <label>Mode de paiement</label>
                            <select value={editFormData.mode_paiement} onChange={e => setEditFormData({ ...editFormData, mode_paiement: e.target.value })} className="edit-input">
                              <option value="">Choisir...</option>
                              <option value="virement">Par virement</option>
                              <option value="cheque">Par chèque</option>
                              <option value="especes">En espèces</option>
                              <option value="carte">Par carte bancaire (solution de paiement en ligne)</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Statut de paiement</label>
                            {(() => {
                              const currentPaymentStatutUi = editFormData.statut_paiement_ui || getPaymentUiValue(editFormData.statut_paiement || 'non_paye', Boolean(editFormData.facturation_annulee));
                              const isInterventionGratuiteActive = currentPaymentStatutUi === 'intervention_gratuite';
                              const optionsToRender = PAYMENT_STATUS_OPTIONS.filter(o => {
                                if (o.value === 'intervention_gratuite') {
                                  return isInterventionGratuiteActive;
                                }
                                return true;
                              });
                                return (
                                  <>
                                    <select 
                                      value={currentPaymentStatutUi} 
                                      disabled={isInterventionGratuiteActive}
                                      onChange={e => {
                                        const v = e.target.value;
                                        const isFreeOrCancelled = v === 'facturation_annulee' || v === 'intervention_gratuite';
                                        const newMontantHT = isFreeOrCancelled ? 0 : toNumber(editFormData.ca_initial);
                                        const newTvaActive = isFreeOrCancelled ? false : Boolean(editFormData.tva_active);
                                        const currentMontantTTC = isFreeOrCancelled ? 0 : roundMoney(newTvaActive ? newMontantHT * 1.2 : newMontantHT);
                                        
                                        const parts = editFormData.parts_repartition || [];
                                        let adjustedParts = [...parts];
                                        let nextMontantProfilAnnulation = editFormData.montant_profil_annulation;
                                        let nextProfilSeraPaye = editFormData.profil_sera_paye;

                                        if (isFreeOrCancelled) {
                                          const totalParts = adjustedParts.reduce((sum, p) => sum + toNumber(p.amount), 0);
                                          nextMontantProfilAnnulation = totalParts;
                                          nextProfilSeraPaye = totalParts > 0;
                                        }

                                        const totalParts = adjustedParts.reduce((sum, p) => sum + toNumber(p.amount), 0);
                                        const nextPartAgence = isFreeOrCancelled ? 0 : roundMoney(currentMontantTTC - totalParts);

                                        const updates: any = { 
                                          ...editFormData, 
                                          statut_paiement_ui: v, 
                                          facturation_annulee: isFreeOrCancelled,
                                          montant_ht: newMontantHT,
                                          tva_active: newTvaActive,
                                          parts_repartition: adjustedParts,
                                          part_agence: nextPartAgence,
                                        };
                                        // Auto-set encaisse_par based on payment status
                                        if (v === 'agence_payee_client' || v === 'paye' || v === 'commercial_paye_client') updates.encaisse_par = 'agence';
                                        else if (v === 'profil_paye_client') updates.encaisse_par = 'profil';
                                        
                                        if (isFreeOrCancelled) {
                                          updates.profil_sera_paye = nextProfilSeraPaye;
                                          updates.montant_profil_annulation = nextMontantProfilAnnulation;
                                          updates.montant_agence_doit_profil = nextProfilSeraPaye ? nextMontantProfilAnnulation : 0;
                                          updates.montant_profil_doit_agence = 0;
                                        } else {
                                          if (updates.statut_paiement_ui === 'profil_paye_client') {
                                            updates.montant_profil_doit_agence = nextPartAgence;
                                            updates.montant_agence_doit_profil = 0;
                                          } else if (updates.statut_paiement_ui === 'agence_payee_client') {
                                            updates.montant_agence_doit_profil = totalParts;
                                            updates.montant_profil_doit_agence = 0;
                                          } else {
                                            updates.montant_profil_doit_agence = 0;
                                            updates.montant_agence_doit_profil = 0;
                                          }
                                        }
                                        
                                        setEditFormData(updates);
                                      }} 
                                      className="edit-input"
                                    >
                                      {optionsToRender.map(o => {
                                        const isPayeDisabled = o.value === 'paye' && editFormData.statut !== 'pres_terminee';
                                        return (
                                          <option 
                                            key={o.value} 
                                            value={o.value}
                                            disabled={isPayeDisabled}
                                          >
                                            {isPayeDisabled ? `${o.label} (requiert prestation terminée)` : o.label}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    {editFormData.statut !== 'pres_terminee' && (
                                      <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: 500, marginTop: '4px' }}>
                                        ⚠️ Le statut "Payé" n'est accessible que si la prestation est au statut "Prestation terminée".
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                          </div>                          <div className="form-group">
                            <label>Montant versé (MAD)</label>
                            <input type="number" value={editFormData.montant_verse} onChange={e => setEditFormData({ ...editFormData, montant_verse: e.target.value })} className="edit-input" />
                            {toNumber(montantTTC) > 0 && toNumber(editFormData.montant_verse) > 0 && (toNumber(montantTTC) - toNumber(editFormData.montant_verse)) > 0 && (
                              <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600, marginTop: '4px' }}>Reste à payer : {(toNumber(montantTTC) - toNumber(editFormData.montant_verse)).toFixed(2)} MAD</p>
                            )}
                          </div>
                        </div>

                        {currentPaymentStatutUi === 'commercial_paye_client' && (
                          <div style={{
                            marginTop: '16px',
                            padding: '16px',
                            borderRadius: '10px',
                            border: '1px solid #FDE047',
                            background: '#FEFCE8',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}>
                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#92400E' }}>
                              Confirmation du versement du commercial à l'agence
                            </h4>
                            <p style={{ margin: 0, fontSize: '13px', color: '#B45309' }}>
                              Le commercial a-t-il déposé le montant encaissé auprès de l'agence ?
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#78350F' }}>
                                Dépôt commercial effectué :
                              </span>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const v = 'agence_payee_client';
                                    const isFreeOrCancelled = false;
                                    const newMontantHT = toNumber(editFormData.ca_initial);
                                    const newTvaActive = Boolean(editFormData.tva_active);
                                    const currentMontantTTC = roundMoney(newTvaActive ? newMontantHT * 1.2 : newMontantHT);
                                    
                                    const parts = editFormData.parts_repartition || [];
                                    let adjustedParts = [...parts];
                                    
                                    const totalParts = adjustedParts.reduce((sum, p) => sum + toNumber(p.amount), 0);
                                    const nextPartAgence = roundMoney(currentMontantTTC - totalParts);

                                    const updates: any = { 
                                      ...editFormData, 
                                      statut_paiement_ui: v, 
                                      facturation_annulee: isFreeOrCancelled,
                                      montant_ht: newMontantHT,
                                      tva_active: newTvaActive,
                                      parts_repartition: adjustedParts,
                                      part_agence: nextPartAgence,
                                      encaisse_par: 'agence'
                                    };
                                    
                                    updates.montant_agence_doit_profil = totalParts;
                                    updates.montant_profil_doit_agence = 0;
                                    
                                    setEditFormData(updates);
                                    addToast("Statut de paiement modifié en 'Agence payée / Client'", "success");
                                  }}
                                  style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid #cbd5e1',
                                    background: 'white',
                                    color: '#334155',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = '#059669';
                                    e.currentTarget.style.color = '#059669';
                                    e.currentTarget.style.backgroundColor = '#ECFDF5';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                    e.currentTarget.style.color = '#334155';
                                    e.currentTarget.style.backgroundColor = 'white';
                                  }}
                                >
                                  Oui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    addToast("Dépôt non effectué. La gestion des parts reste verrouillée.", "warning");
                                  }}
                                  style={{
                                    padding: '6px 16px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: 'none',
                                    background: '#DC2626',
                                    color: 'white',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  Non
                                </button>
                              </div>
                            </div>
                            <p style={{ margin: 0, fontSize: '11px', color: '#B45309', fontWeight: 500, fontStyle: 'italic' }}>
                              ⚠️ Le module Gestion des parts reste indisponible tant que le paiement n'a pas été confirmé comme remis à l'agence.
                            </p>
                          </div>
                        )}

                        {editFormData.statut_paiement_ui === 'paye' && (() => {
                          let allProfilesPaid = false;
                          const parts = editFormData.parts_repartition || [];
                          if (Array.isArray(parts) && parts.length > 0) {
                            allProfilesPaid = parts.every((p: any) => p.part_profil_versee);
                          } else {
                            allProfilesPaid = Boolean(editFormData.part_profil_versee);
                          }

                          return (
                            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${allProfilesPaid ? '#A7F3D0' : '#FDE047'}`, background: allProfilesPaid ? '#ECFDF5' : '#FEFCE8' }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: allProfilesPaid ? '#047857' : '#A16207', margin: 0 }}>
                                {allProfilesPaid 
                                  ? '✓ Paiement complet — la demande sera retirée du tableau de bord' 
                                  : '✓ Paiement complet (Client) — la demande restera sur le tableau de bord car certains profils ne sont pas encore payés.'}
                              </p>
                            </div>
                          );
                        })()}

                        {editFormData.statut_paiement_ui !== 'facturation_annulee' && editFormData.statut_paiement_ui !== 'intervention_gratuite' && (
                          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #FDA4AF', color: '#BE123C', background: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} onClick={() => {
                              const parts = editFormData.parts_repartition || [];
                              const totalParts = parts.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0);
                              setEditFormData({
                                ...editFormData,
                                facturation_annulee: true,
                                statut_paiement_ui: 'facturation_annulee',
                                montant_ht: 0,
                                tva_active: false,
                                profil_sera_paye: totalParts > 0,
                                montant_profil_annulation: totalParts > 0 ? totalParts : 0,
                                montant_agence_doit_profil: totalParts > 0 ? totalParts : 0,
                                montant_profil_doit_agence: 0,
                                annulation_raison: ''
                              });
                            }}>
                              <XCircle size={14} /> Facturation annulée
                            </button>
                          </div>
                        )}

                        {(editFormData.statut_paiement_ui === 'facturation_annulee' || editFormData.statut_paiement_ui === 'intervention_gratuite') && (() => {
                          const isGratuit = editFormData.statut_paiement_ui === 'intervention_gratuite';
                          const themeColor = isGratuit ? '#0d9488' : '#BE123C';
                          const bgColor = isGratuit ? '#F0FDFA' : '#FFF1F2';
                          const borderColor = isGratuit ? '#CCFBF1' : '#FECDD3';
                          return (
                            <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', border: `1px solid ${borderColor}`, background: bgColor }}>
                              <h4 style={{ fontSize: '13px', fontWeight: 700, color: themeColor, display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px' }}>
                                {isGratuit ? <Gift size={14} /> : <XCircle size={14} />} {isGratuit ? 'Intervention gratuite' : 'Facturation annulée'}
                              </h4>
                              
                              <div className="form-group mb-4">
                                <label style={{ color: themeColor }}>{isGratuit ? "Raison de l'intervention gratuite" : "Raison de l'annulation"}</label>
                                <textarea 
                                  value={editFormData.annulation_raison || ''} 
                                  onChange={e => setEditFormData({ ...editFormData, annulation_raison: e.target.value })} 
                                  className="edit-input w-full" 
                                  placeholder={isGratuit ? "Indiquer la raison de l'intervention gratuite..." : "Indiquer la raison de l'annulation..."} 
                                  style={{ borderColor: borderColor }} 
                                />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                                  Le profil sera payé ?
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const parts = editFormData.parts_repartition || [];
                                      const totalParts = parts.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0);
                                      const val = totalParts > 0 ? totalParts : (toNumber(editFormData.montant_profil_annulation) || 0);
                                      const count = parts.length || 1;
                                      const amountPerProfile = roundMoney(val / count);
                                      const newParts = parts.map((p: any, i: number) => ({
                                        ...p,
                                        amount: i === count - 1 ? roundMoney(val - (amountPerProfile * (count - 1))) : amountPerProfile
                                      }));
                                      setEditFormData({
                                        ...editFormData,
                                        profil_sera_paye: true,
                                        montant_profil_annulation: val,
                                        montant_agence_doit_profil: val,
                                        parts_repartition: newParts
                                      });
                                    }}
                                    style={{
                                      padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                      background: editFormData.profil_sera_paye ? themeColor : '#ffffff',
                                      color: editFormData.profil_sera_paye ? 'white' : themeColor,
                                      border: `1px solid ${editFormData.profil_sera_paye ? themeColor : '#e2e8f0'}`,
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    Oui
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const parts = editFormData.parts_repartition || [];
                                      const newParts = parts.map((p: any) => ({ ...p, amount: 0 }));
                                      setEditFormData({
                                        ...editFormData,
                                        profil_sera_paye: false,
                                        montant_profil_annulation: 0,
                                        montant_agence_doit_profil: 0,
                                        parts_repartition: newParts
                                      });
                                    }}
                                    style={{
                                      padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                      background: !editFormData.profil_sera_paye ? themeColor : '#ffffff',
                                      color: !editFormData.profil_sera_paye ? 'white' : themeColor,
                                      border: `1px solid ${!editFormData.profil_sera_paye ? themeColor : '#e2e8f0'}`,
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    Non
                                  </button>
                                </div>
                              </div>


                            </div>
                          );
                        })()}
                      </div>

                      {/* ── Gestion des parts ── */}
                      <div>
                        <button type="button" onClick={() => setShowPartsSection(!showPartsSection)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 16px', borderRadius: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', marginBottom: '12px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><UserCheck size={18} style={{ color: '#059669' }} /><span style={{ fontSize: '16px', fontWeight: 700, color: '#047857' }}>Gestion des parts</span></div>
                          {showPartsSection ? <ChevronUp size={16} style={{ color: '#059669' }} /> : <ChevronDown size={16} style={{ color: '#059669' }} />}
                        </button>
                        
                        {showPartsSection && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {isPartsLocked && (
                              <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #FDE047', background: '#FEFCE8', color: '#B45309', fontSize: '13px', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                                  <span>🔒</span>
                                  <span>Gestion des parts indisponible.</span>
                                </div>
                                <p style={{ margin: 0 }}>
                                  Le partage des parts entre l'agence et le profil intervenant ne peut être effectué que lorsque le statut de paiement est « Agence payée par le client ». Confirmez d'abord le dépôt du commercial à l'agence.
                                </p>
                              </div>
                            )}
                            <div style={isPartsLocked ? { opacity: 0.5, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '16px' } : { display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div className="form-grid-2 gap-4">
                            <div className="form-group"><label>Montant total TTC (MAD)</label><div style={{ padding: '0 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', height: '38px', fontSize: '14px', fontWeight: 600 }}>{montantTTC.toFixed(2)}</div></div>
                            <div className="form-group">
                              <label>Part de l'agence (MAD)</label>
                              <input 
                                type="number" 
                                value={
                                  (editFormData.statut_paiement_ui === 'intervention_gratuite' || 
                                   editFormData.statut_paiement_ui === 'facturation_annulee' || 
                                   Boolean(editFormData.facturation_annulee)) 
                                    ? 0 
                                    : editFormData.frequency === 'abonnement'
                                      ? roundMoney(remainingAgencyShare)
                                      : editFormData.part_agence
                                } 
                                onChange={e => setEditFormData({ ...editFormData, part_agence: e.target.value })} 
                                className="edit-input" 
                                disabled={
                                  editFormData.statut_paiement_ui === 'intervention_gratuite' || 
                                  editFormData.statut_paiement_ui === 'facturation_annulee' || 
                                  Boolean(editFormData.facturation_annulee) ||
                                  editFormData.frequency === 'abonnement'
                                }
                                style={
                                  editFormData.frequency === 'abonnement'
                                    ? { background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed', fontWeight: 600 }
                                    : {}
                                }
                              />
                              {editFormData.frequency === 'abonnement' && (
                                <span style={{ fontSize: '11px', color: '#0d9488', marginTop: '4px', display: 'block' }}>
                                  {editFormData.parent_demande 
                                    ? "🔒 Part de l'agence restante sur cet abonnement (affichée à titre informatif, la commission réelle est enregistrée sur la demande parente)."
                                    : "🔒 Part agence calculée automatiquement sur la commission restante."}
                                </span>
                              )}
                            </div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Profils intervenants</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const defaultRateType = getDefaultRateTypeForService(editFormData.service);
                                  const defaultHours = defaultRateType !== 'taux_forfaitaire' ? Number(editFormData.nb_heures || editFormData.duree || 4) : undefined;
                                  const defaultDays = defaultRateType === 'taux_forfaitaire' ? Number(editFormData.nb_jours || 1) : undefined;
                                  const defaultRateVal = defaultRateType === 'taux_horaire_standard'
                                    ? getServiceDefaultRate(editFormData.service, defaultRateType, defaultHours).rate
                                    : undefined;
                                  const defaultAmount = defaultRateVal !== undefined
                                    ? roundMoney((defaultRateType === 'taux_forfaitaire' ? defaultDays! : defaultHours!) * defaultRateVal)
                                    : 0;

                                  const nextParts: PartRepartitionItem[] = [
                                    ...partsRepartition,
                                    {
                                      profile_id: '',
                                      rate_type: defaultRateType,
                                      hours: defaultHours,
                                      days: defaultDays,
                                      rate_value: defaultRateVal,
                                      amount: defaultAmount,
                                      is_delegate: false
                                    }
                                  ];
                                  updatePartsAndAgency(nextParts);
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                              >
                                <Plus size={14} /> Ajouter un autre profil
                              </button>
                            </div>

                            {partsRepartition.map((line, idx) => (
                              <div key={`${line.profile_id}-${idx}`} style={{ padding: '16px', border: '1px solid #E2E8F0', borderRadius: '10px', backgroundColor: '#F8FAFC', marginBottom: '16px' }}>
                                {/* First row of fields: Nom du profil, Type de taux, buttons */}
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '12px' }}>
                                  <div style={{ flex: 2 }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                      Nom du profil
                                      {line.is_delegate && partsRepartition.length > 1 && (
                                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '4px', padding: '1px 6px' }}>
                                          Délégué
                                        </span>
                                      )}
                                    </label>
                                    <select
                                      value={line.profile_id}
                                      onChange={e => {
                                        const next = [...partsRepartition];
                                        next[idx] = { ...line, profile_id: e.target.value ? parseInt(e.target.value, 10) : '' };
                                        updatePartsAndAgency(next);
                                      }}
                                      className="edit-input"
                                      style={{ width: '100%' }}
                                    >
                                      <option value="">Sélectionner un profil...</option>
                                      {allProfils
                                        .filter(p => p.id === line.profile_id || (p.statut === 'disponible' && !busyAgentIds.has(p.id) && !p.is_blacklisted))
                                        .map(p => (
                                          <option key={p.id} value={p.id}>
                                            {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Profil #${p.id}`}
                                          </option>
                                        ))}
                                    </select>
                                  </div>

                                  <div style={{ flex: 2 }}>
                                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Type de taux</label>
                                    <select
                                      value={line.rate_type || 'taux_horaire_standard'}
                                      onChange={e => {
                                        const nextType = e.target.value as any;
                                        const next = [...partsRepartition];
                                        const updatedLine = { ...line, rate_type: nextType };

                                        if (nextType === 'taux_forfaitaire') {
                                          updatedLine.days = updatedLine.days || Number(editFormData.nb_jours || 1);
                                          updatedLine.hours = undefined;
                                          updatedLine.rate_value = undefined;
                                          updatedLine.amount = 0;
                                        } else if (nextType === 'taux_horaire_standard') {
                                          updatedLine.hours = updatedLine.hours || Number(editFormData.nb_heures || editFormData.duree || 4);
                                          updatedLine.days = undefined;
                                          updatedLine.rate_value = getServiceDefaultRate(editFormData.service, nextType, updatedLine.hours).rate;
                                          updatedLine.amount = roundMoney((updatedLine.hours || 0) * updatedLine.rate_value);
                                        } else if (nextType === 'taux_horaire_exceptionnel') {
                                          updatedLine.hours = updatedLine.hours || Number(editFormData.nb_heures || editFormData.duree || 4);
                                          updatedLine.days = undefined;
                                          updatedLine.rate_value = undefined;
                                          updatedLine.amount = 0;
                                        }

                                        next[idx] = updatedLine;
                                        updatePartsAndAgency(next);
                                      }}
                                      className="edit-input"
                                      style={{ width: '100%' }}
                                    >
                                      <option value="taux_horaire_standard" disabled={!hasPermission(user, 'application_taux_horaire_standard')}>
                                        Taux horaire standard {!hasPermission(user, 'application_taux_horaire_standard') && '🔒'}
                                      </option>
                                      <option value="taux_horaire_exceptionnel" disabled={!hasPermission(user, 'taux_horaire_exceptionnel')}>
                                        Taux horaire exceptionnel {!hasPermission(user, 'taux_horaire_exceptionnel') && '🔒'}
                                      </option>
                                      <option value="taux_forfaitaire" disabled={!hasPermission(user, 'taux_forfaitaire')}>
                                        Taux forfaitaire {!hasPermission(user, 'taux_forfaitaire') && '🔒'}
                                      </option>
                                    </select>
                                  </div>

                                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    {partsRepartition.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = partsRepartition.map((p, i) => ({ ...p, is_delegate: i === idx ? !p.is_delegate : false }));
                                          updatePartsAndAgency(next);
                                        }}
                                        style={{
                                          height: '38px',
                                          padding: '0 12px',
                                          borderRadius: '8px',
                                          border: 'none',
                                          fontSize: '12px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          background: line.is_delegate ? '#F59E0B' : '#E2E8F0',
                                          color: line.is_delegate ? 'white' : '#475569',
                                          transition: 'all 0.2s'
                                        }}
                                        title="Désigner comme délégué"
                                      >
                                        <UserCheck size={16} />
                                        {line.is_delegate ? 'Délégué' : 'Désigner'}
                                      </button>
                                    )}
                                    {partsRepartition.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const f = partsRepartition.filter((_, i) => i !== idx);
                                          if (!f.some(p => p.is_delegate) && f.length > 0) f[0] = { ...f[0], is_delegate: true };
                                          updatePartsAndAgency(f);
                                        }}
                                        style={{
                                          height: '38px',
                                          width: '38px',
                                          borderRadius: '8px',
                                          border: '1px solid #FCA5A5',
                                          background: 'white',
                                          color: '#DC2626',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Second row of fields: duration, unit price, total */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'flex-end' }}>
                                  {line.rate_type === 'taux_forfaitaire' ? (
                                    <>
                                      <div>
                                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Nombre de jours</label>
                                        <input
                                          type="number"
                                          min={1}
                                          value={line.days || ''}
                                          onChange={e => {
                                            const val = Number(e.target.value);
                                            const next = [...partsRepartition];
                                            const updatedLine = { ...line, days: val };
                                            updatedLine.amount = roundMoney(val * (updatedLine.rate_value || 0));
                                            next[idx] = updatedLine;
                                            updatePartsAndAgency(next);
                                          }}
                                          className="edit-input"
                                          style={{ width: '100%' }}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Prix forfaitaire (MAD)</label>
                                        <input
                                          type="number"
                                          value={line.rate_value || ''}
                                          onChange={e => {
                                            const val = Number(e.target.value);
                                            const next = [...partsRepartition];
                                            const updatedLine = { ...line, rate_value: val };
                                            updatedLine.amount = roundMoney((updatedLine.days || 1) * val);
                                            next[idx] = updatedLine;
                                            updatePartsAndAgency(next);
                                          }}
                                          className="edit-input"
                                          style={{ width: '100%' }}
                                          required={true}
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Nombre d'heures</label>
                                        <input
                                          type="number"
                                          min={0.5}
                                          step={0.5}
                                          value={line.hours || ''}
                                          onChange={e => {
                                            const val = Number(e.target.value);
                                            const next = [...partsRepartition];
                                            const updatedLine = { ...line, hours: val };

                                            if (updatedLine.rate_type === 'taux_horaire_standard') {
                                              updatedLine.rate_value = getServiceDefaultRate(editFormData.service, 'taux_horaire_standard', val).rate;
                                            }

                                            updatedLine.amount = roundMoney(val * (updatedLine.rate_value || 0));
                                            next[idx] = updatedLine;
                                            updatePartsAndAgency(next);
                                          }}
                                          className="edit-input"
                                          style={{ width: '100%' }}
                                        />
                                      </div>
                                      <div>
                                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                                          Prix par heure (MAD) {line.rate_type === 'taux_horaire_exceptionnel' && <span style={{ color: '#dc2626' }}>*</span>}
                                        </label>
                                        <input
                                          type="number"
                                          value={line.rate_value || ''}
                                          onChange={e => {
                                            const val = Number(e.target.value);
                                            const next = [...partsRepartition];
                                            const updatedLine = { ...line, rate_value: val };
                                            updatedLine.amount = roundMoney((updatedLine.hours || 0) * val);
                                            next[idx] = updatedLine;
                                            updatePartsAndAgency(next);
                                          }}
                                          disabled={line.rate_type === 'taux_horaire_standard'}
                                          className="edit-input"
                                          style={{
                                            width: '100%',
                                            ...(line.rate_type === 'taux_horaire_standard' ? { background: '#E2E8F0', color: '#64748B', cursor: 'not-allowed' } : {})
                                          }}
                                          required={line.rate_type === 'taux_horaire_exceptionnel'}
                                        />
                                      </div>
                                    </>
                                  )}
                                  <div>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Montant total (MAD)</label>
                                    {(editFormData.statut_paiement_ui === 'intervention_gratuite' || editFormData.statut_paiement_ui === 'facturation_annulee' || Boolean(editFormData.facturation_annulee)) ? (
                                      <input
                                        type="number"
                                        value={line.amount ?? ''}
                                        disabled={!editFormData.profil_sera_paye}
                                        onChange={e => {
                                          const val = e.target.value === '' ? 0 : Number(e.target.value);
                                          const next = [...partsRepartition];
                                          next[idx] = { ...line, amount: val };
                                          updatePartsAndAgency(next);
                                        }}
                                        className="edit-input"
                                        style={{
                                          width: '100%',
                                          ...(!editFormData.profil_sera_paye ? { background: '#E2E8F0', color: '#64748B', cursor: 'not-allowed' } : {})
                                        }}
                                      />
                                    ) : (
                                      <div style={{ padding: '0 12px', background: '#F1F5F9', borderRadius: '8px', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', height: '38px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                                        {toNumber(line.amount).toFixed(2)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {line.created_at && (
                                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748B', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                                    Part ajoutée le <strong>{line.created_at}</strong> par <strong>{line.created_by_name || 'Système'}</strong>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {(() => {
                            const isFreeOrCancelled = editFormData.statut_paiement_ui === 'intervention_gratuite' || editFormData.statut_paiement_ui === 'facturation_annulee' || Boolean(editFormData.facturation_annulee);
                            const tp = partsRepartition.reduce((a, p) => a + toNumber(p.amount), 0);
                            
                            const isAbonnement = editFormData.frequency === 'abonnement';
                            if (isAbonnement) {
                              const parentId = editFormData.parent_demande || selectedDemande.parent_demande || selectedDemande.id;
                              const parentDemande = getParentDemande(parentId, selectedDemande!);
                              const parentPrice = (Number(selectedDemande.id) === Number(parentId))
                                ? montantTTC
                                : (parentDemande ? toNumber(parentDemande.prix) : 0);
                                
                              const subscriptionDemandes = getSubscriptionDemandes(parentId);
                              const otherDemandsProfilesTotal = subscriptionDemandes.filter(d => Number(d.id) !== Number(selectedDemande.id)).reduce((sum, d) => {
                                const parts = d.parts_repartition || d.formulaire_data?.facturation?.parts_repartition || [];
                                return sum + parts.reduce((s: number, p: any) => s + toNumber(p.amount), 0);
                              }, 0);
                              
                              const currentDemandProfilesTotal = tp;
                              const totalProfilesTotal = currentDemandProfilesTotal + otherDemandsProfilesTotal;
                              const remainingAgencyShare = parentPrice - totalProfilesTotal;
                              
                              const ok = remainingAgencyShare >= -0.01;
                              
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '12px', border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}`, background: ok ? '#ECFDF5' : '#FEF2F2' }}>
                                  <div style={{ fontSize: '14px', fontWeight: 700, color: ok ? '#065f46' : '#991b1b', borderBottom: `1px dashed ${ok ? '#A7F3D0' : '#FCA5A5'}`, paddingBottom: '8px', marginBottom: '4px' }}>
                                    Abonnement — Suivi de la part de l'agence
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#374151' }}>
                                    <div>Commission initiale (TTC 1ère prest.) : <strong>{parentPrice.toFixed(2)} MAD</strong></div>
                                    <div>Parts profils (autres sessions) : <strong>{otherDemandsProfilesTotal.toFixed(2)} MAD</strong></div>
                                    <div>Parts profils (cette session) : <strong>{currentDemandProfilesTotal.toFixed(2)} MAD</strong></div>
                                    <div>Part agence restante (mise à jour) : <strong style={{ color: ok ? '#059669' : '#DC2626', fontSize: '14px' }}>{remainingAgencyShare.toFixed(2)} MAD</strong></div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: ok ? '#059669' : '#DC2626' }}>
                                      {ok ? '✓ Répartition correcte' : '⚠ Répartition incorrecte : les parts des profils dépassent la commission initiale !'}
                                    </span>
                                    {!editFormData.parent_demande && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditFormData((prev: any) => ({
                                            ...prev,
                                            part_agence: roundMoney(remainingAgencyShare),
                                          }));
                                        }}
                                        style={{
                                          padding: '6px 14px',
                                          borderRadius: '8px',
                                          backgroundColor: '#059669',
                                          color: 'white',
                                          border: 'none',
                                          fontSize: '12px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          transition: 'background 0.2s',
                                        }}
                                      >
                                        Mettre à jour la part agence
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            const target = isFreeOrCancelled
                              ? (editFormData.profil_sera_paye ? toNumber(editFormData.montant_profil_annulation) : 0)
                              : toNumber(montantTTC);
                            const tr = tp + (isFreeOrCancelled ? 0 : toNumber(editFormData.part_agence));
                            const r = target - tr;
                            const ok = Math.abs(r) < 0.01;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}`, background: ok ? '#ECFDF5' : '#FEF2F2' }}>
                                <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                                  <span>Total réparti : <strong>{tr.toFixed(2)} MAD</strong></span>
                                  <span>Reste à répartir : <strong style={{ color: ok ? '#059669' : '#DC2626' }}>{r.toFixed(2)} MAD</strong></span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: ok ? '#059669' : '#DC2626' }}>
                                    {ok ? '✓ Répartition correcte' : '⚠ Répartition incorrecte'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const totalParts = partsRepartition.reduce((sum, p) => sum + toNumber(p.amount), 0);
                                      const nextPartAgence = roundMoney(montantTTC - totalParts);

                                      setEditFormData((prev: any) => {
                                        const updates: any = {
                                          ...prev,
                                          part_agence: nextPartAgence,
                                        };
                                        if (prev.statut_paiement_ui === 'profil_paye_client') {
                                          updates.montant_profil_doit_agence = nextPartAgence;
                                          updates.montant_agence_doit_profil = 0;
                                        } else if (prev.statut_paiement_ui === 'agence_payee_client') {
                                          updates.montant_agence_doit_profil = totalParts;
                                          updates.montant_profil_doit_agence = 0;
                                        } else {
                                          updates.montant_profil_doit_agence = 0;
                                          updates.montant_agence_doit_profil = 0;
                                        }
                                        return updates;
                                      });
                                    }}
                                    style={{
                                      padding: '8px 16px',
                                      borderRadius: '8px',
                                      backgroundColor: '#059669',
                                      color: 'white',
                                      border: 'none',
                                      fontSize: '13px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#047857'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#059669'}
                                  >
                                    Valider les parts
                                  </button>
                                </div>
                              </div>
                            );
                          })()}

                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Notes ── */}
                      <div className="form-grid-2 gap-4">
                        <div className="form-group">
                          <label>Note commercial</label>
                          <textarea value={editFormData.note_commercial} onChange={e => setEditFormData({ ...editFormData, note_commercial: e.target.value })} className="edit-textarea" rows={3} placeholder="Notes du commercial..." />
                          <button type="button" className="btn btn-outline btn-xs mt-2" style={{ width: 'fit-content', padding: '4px 20px', fontSize: '12px' }} onClick={async () => { try { await updateDemande(selectedDemande.id, { note_commercial: editFormData.note_commercial }); addToast('Note commerciale enregistrée', 'success'); fetchData(); } catch { addToast("Erreur lors de l'enregistrement", 'error'); } }}>Entrer</button>
                        </div>
                        <div className="form-group">
                          <label>Note opération</label>
                          <textarea value={editFormData.note_operationnel} onChange={e => setEditFormData({ ...editFormData, note_operationnel: e.target.value })} className="edit-textarea" rows={3} placeholder="Notes opérationnelles..." />
                          <button type="button" className="btn btn-outline btn-xs mt-2" style={{ width: 'fit-content', padding: '4px 20px', fontSize: '12px' }} onClick={async () => { try { await updateDemande(selectedDemande.id, { note_operationnel: editFormData.note_operationnel }); addToast('Note opérationnelle enregistrée', 'success'); fetchData(); } catch { addToast("Erreur lors de l'enregistrement", 'error'); } }}>Entrer</button>
                        </div>
                      </div>

                      {/* ── WhatsApp ── */}
                      <div className="whatsapp-toggle-card">
                        <div className="flex items-center gap-4">
                          <label className="switch"><input type="checkbox" checked={editFormData.envoyer_whatsapp} onChange={e => setEditFormData({ ...editFormData, envoyer_whatsapp: e.target.checked, regenerer_devis: e.target.checked })} /><span className="slider round" /></label>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-teal-dark fw-bold"><MessageSquare size={18} />Régénérer le devis et renvoyer au client via WhatsApp</div>
                            <p className="text-xs text-muted">Le devis sera régénéré et envoyé automatiquement au numéro WhatsApp du client.</p>
                          </div>
                        </div>
                      </div>
                    </div>}
                  </div>

                  <div className="agency-block agency-block-history">
                    <button type="button" className="agency-collapse-btn" onClick={() => setShowHistorySection(!showHistorySection)}>
                      <span>Historique des actions ({auditLogs.length})</span>
                      {showHistorySection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {showHistorySection && (
                      <div className="history-list">
                        {loadingAuditLogs ? (
                          <p className="text-sm text-muted">Chargement...</p>
                        ) : auditLogs.length === 0 ? (
                          <p className="text-sm text-muted">Aucune action enregistrée.</p>
                        ) : (
                          auditLogs.slice(0, 10).map((log) => {
                            const changedSummary = getAuditChangedFieldsSummary(log);
                            return (
                              <div key={log.id} className="history-item">
                                <div>
                                  <p className="history-title">{auditActionLabel(log.action)}</p>
                                  <div style={{ margin: '4px 0' }}>
                                    <span className={`badge ${log.user_name ? 'badge-teal' : 'badge-gray'}`} style={{ fontSize: '11px' }}>
                                      {log.user_name || 'Système'}
                                    </span>
                                  </div>
                                  {changedSummary && <p className="history-meta">Champs modifies : {changedSummary}</p>}
                                </div>
                                <span className="history-date">{new Date(log.timestamp).toLocaleString('fr-FR')}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                <>
                  <div className="detail-section">
                    <h3>Informations Client</h3>
                    <div className="detail-grid">
                      <div className="detail-item"><span>Nom:</span> {selectedDemande.client_name || selectedDemande.formulaire_data?.nom || '—'}</div>
                      <div className="detail-item">
                        <span>Téléphone:</span> {selectedDemande.client_phone || selectedDemande.formulaire_data?.whatsapp_phone || '—'}
                        {selectedDemande.source === 'backoffice' && <span className="badge badge-orange ms-1" style={{ fontSize: '9px', padding: '0px 4px' }}>BO</span>}
                      </div>
                      <div className="detail-item"><span>Email:</span> {selectedDemande.client_detail?.email || '—'}</div>
                      <div className="detail-item"><span>Ville:</span> {selectedDemande.neighborhood_city}</div>
                      <div className="detail-item"><span>Segment:</span> {selectedDemande.segment.toUpperCase()}</div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Détails Prestation</h3>
                    <div className="detail-grid">
                      <div className="detail-item"><span>Service:</span> {selectedDemande.service}</div>
                      <div className="detail-item"><span>Date:</span> {selectedDemande.date_intervention ? new Date(selectedDemande.date_intervention).toLocaleDateString('fr-FR') : (selectedDemande.formulaire_data?.date_intervention || selectedDemande.formulaire_data?.date || '—')}</div>
                      <div className="detail-item"><span>Heures:</span> {selectedDemande.nb_heures || selectedDemande.formulaire_data?.duree || selectedDemande.formulaire_data?.nb_heures || '—'}h</div>
                      <div className="detail-item"><span>Fréquence:</span> {selectedDemande.frequency_label || (selectedDemande.frequency === 'oneshot' ? 'Une fois' : 'Abonnement')}</div>
                      <div className="detail-item"><span>Avec produit:</span> {selectedDemande.service.toLowerCase().includes('bureaux') ? (selectedDemande.avec_produit ? 'Oui' : 'Non') : (selectedDemande.avec_produit ? `Oui (${selectedDemande.tarif_produit} MAD)` : 'Non')}</div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Paiement & Statut</h3>
                    <div className="detail-grid">
                      <div className="detail-item"><span>Total:</span> {selectedDemande.prix} MAD</div>
                      <div className="detail-item"><span>Mode:</span> {selectedDemande.mode_paiement_label || selectedDemande.mode_paiement}</div>
                      <div className="detail-item"><span>Statut paie:</span> {(() => {
                        const facturation = selectedDemande.formulaire_data?.facturation || {};
                        const statutUi = facturation.statut_paiement_ui || getPaymentUiValue(selectedDemande.statut_paiement || 'non_paye', Boolean(facturation.facturation_annulee));
                        const option = PAYMENT_STATUS_OPTIONS.find(o => o.value === statutUi);
                        return option ? option.label : (selectedDemande.statut_paiement_label || selectedDemande.statut_paiement || 'Non payé');
                      })()}</div>
                      <div className="detail-item"><span>CAO:</span> {selectedDemande.cao ? 'Confirmé' : 'Non confirmé'}</div>
                    </div>
                  </div>

                  {(selectedDemande.note_commercial || selectedDemande.note_operationnel) && (
                    <div className="detail-section">
                      <h4 className="detail-section-title">Notes Agence</h4>
                      {selectedDemande.note_commercial && (
                        <div className="note-item mb-4">
                          <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1 block">Note commerciale</label>
                          <p className="note-text">{selectedDemande.note_commercial}</p>
                        </div>
                      )}
                      {selectedDemande.note_operationnel && (
                        <div className="note-item">
                          <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1 block">Note opération</label>
                          <p className="note-text">{selectedDemande.note_operationnel}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="detail-section mt-6 border-t pt-6 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#6b7280', letterSpacing: '0.08em' }}>Historique des documents</h3>
                      {selectedDemande.documents && selectedDemande.documents.length > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-100 font-medium">{selectedDemande.documents.length} fichier{selectedDemande.documents.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {selectedDemande.documents && selectedDemande.documents.length > 0 ? (
                      <div className="space-y-2">
                        {selectedDemande.documents.map((doc: any) => {
                          const createdAt = doc.created_at ? new Date(doc.created_at.replace(' ', 'T')).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                          const isDevis = doc.type_document === 'devis';
                          const fileName = doc.nom || (isDevis ? 'Devis PDF' : 'Récapitulatif PNG');
                          const handleOpen = async () => {
                            if (!doc.download_url) return;
                            try {
                              addToast('Chargement du document...', 'info');
                              const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
                              setShowPreviewModal({ url: blobUrl, type: isDevis ? 'devis' : 'png', name: fileName, demandeId: selectedDemande.id });
                            } catch { addToast('Erreur lors du chargement', 'error'); }
                          };
                          const handleDownload = async () => {
                            if (!doc.download_url) return;
                            try {
                              const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = fileName;
                              a.click();
                              URL.revokeObjectURL(blobUrl);
                            } catch { addToast('Erreur lors du téléchargement', 'error'); }
                          };
                          return (
                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', gap: '12px', transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isDevis ? '#fee2e2' : '#ccfbf1' }}>
                                  {isDevis ? <FileText size={18} style={{ color: '#ef4444' }} /> : <FileText size={18} style={{ color: '#0d9488' }} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <p style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{fileName}</p>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: isDevis ? '#fee2e2' : '#ccfbf1', color: isDevis ? '#ef4444' : '#0d9488', letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>{isDevis ? 'PDF' : 'PNG'}</span>
                                  </div>
                                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0 0' }}>Généré le {createdAt}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button onClick={handleOpen} title="Aperçu"
                                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#0d9488', cursor: 'pointer', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#0d9488'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db'; }}
                                >
                                  <Eye size={15} />
                                </button>
                                <button onClick={handleDownload} title="Télécharger"
                                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#475569', cursor: 'pointer', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#94a3b8'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db'; }}
                                >
                                  <Download size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 14px', borderRadius: 8, border: '1px dashed #e5e7eb', background: '#fafafa' }}>
                        <FileText size={18} style={{ color: '#d1d5db', flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>Aucun document généré pour cette demande.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="sheet-footer flex justify-between bg-white border-t p-6">
              {selectedDemande.statut === 'en_attente' && isEditing ? (
                <div className="flex justify-between w-full items-center">
                  <button className="btn transition-all" style={{ border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#0f766e', fontWeight: 500, padding: '8px 24px', borderRadius: '4px' }} onClick={() => setIsEditing(false)}>
                    Annuler
                  </button>
                  <div className="flex gap-3">
                    <button className="btn transition-all flex items-center gap-2" style={{ backgroundColor: '#f1f5f9', color: '#0f766e', fontWeight: 500, padding: '8px 16px', borderRadius: '4px', border: 'none' }} onClick={() => handlePreviewDocument(isDevisRequired(selectedDemande) ? 'devis' : 'png')}>
                      <Eye size={16} /> Aperçu du {isDevisRequired(selectedDemande) ? 'Devis' : 'Récapitulatif'}
                    </button>
                    <button className="btn flex items-center gap-2" style={{ backgroundColor: '#0f766e', color: 'white', fontWeight: 500, padding: '8px 24px', borderRadius: '4px', border: 'none' }} onClick={handleUpdate}>
                      <Save size={16} /> Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <button className="btn btn-secondary flex items-center gap-2 border bg-white" onClick={() => handlePreviewDocument(isDevisRequired(selectedDemande) ? 'devis' : 'png')}>
                        <Eye size={18} /> Aperçu du {isDevisRequired(selectedDemande) ? 'Devis' : 'Récapitulatif'}
                      </button>
                    ) : (
                      <button className="btn btn-secondary" onClick={() => setShowDetail(false)}>Fermer</button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button className="btn btn-outline bg-white px-6" onClick={() => setIsEditing(false)}>✕ Annuler</button>
                        <button className="btn btn-primary flex items-center gap-2 px-8" onClick={handleUpdate} style={{ backgroundColor: '#175e5c' }}>
                          <Save size={18} /> Enregistrer
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Modifier</button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Unified Preview Modal */}
      {showPreviewModal && (
        <div className="modal-overlay z-[100]" onClick={() => setShowPreviewModal(null)}>
          <div className="modal-content max-w-[1200px]" onClick={e => e.stopPropagation()} style={{ width: '95%', height: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderRadius: '8px', padding: '24px' }}>
            <div className="modal-header border-b-0 pb-2 mb-4 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-teal-900">
                <Eye size={24} className="text-teal-700" /> Aperçu — {showPreviewModal.type === 'devis' ? 'Devis' : (showPreviewModal.type === 'facture' ? 'Facture' : 'Récapitulatif')}
              </h2>
              <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPreviewModal(null)}><XCircle size={20} /></button>
            </div>

            <div className="modal-body bg-slate-800 rounded-md border border-slate-700 shadow-inner" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
              {showPreviewModal.type === 'devis' || showPreviewModal.type === 'facture' ? (
                <iframe src={showPreviewModal.url} style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} title="Apercu" />
              ) : (
                <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '24px', backgroundColor: '#ffffff' }}>
                  <img src={showPreviewModal.url} alt="Recapitulatif" style={{ maxWidth: '100%', width: 'auto', height: 'auto', objectFit: 'contain', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: '8px', display: 'block' }} />
                </div>
              )}
            </div>

            <div className="modal-footer border-t-0 pt-0 mt-6 bg-white flex justify-center sm:justify-end gap-3 flex-wrap">
              <button className="btn transition-all" style={{ border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#475569', fontWeight: 500, padding: '10px 24px', borderRadius: '6px' }} onClick={() => setShowPreviewModal(null)}>
                Fermer
              </button>
              <a href={showPreviewModal.url} download={showPreviewModal.name} target="_blank" rel="noreferrer" className="btn transition-all flex items-center gap-2" style={{ backgroundColor: '#f1f5f9', color: '#0f766e', fontWeight: 500, padding: '10px 24px', borderRadius: '6px', border: 'none' }}>
                <Download size={18} /> Télécharger
              </a>
              <button
                className="btn transition-all flex items-center gap-2"
                style={{ backgroundColor: '#0f766e', color: 'white', fontWeight: 500, padding: '10px 24px', borderRadius: '6px', border: 'none', opacity: sendingWhatsApp ? 0.7 : 1 }}
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
              >
                {sendingWhatsApp ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                {sendingWhatsApp ? 'Envoi...' : 'Envoyer au client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && (
        <div className="modal-overlay z-[110]" onClick={() => setShowAssignmentModal(null)}>
          <div className="modal-content max-w-[500px]" onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Affectation</h2>
                <p className="text-slate-500 text-sm mt-1">Sélectionnez le commercial pour cette demande</p>
              </div>
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={() => setShowAssignmentModal(null)}>
                <XCircle size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {commerciaux && commerciaux.length > 0 ? (
                commerciaux.map(comm => {
                  const initials = (comm.full_name || `${comm.first_name} ${comm.last_name}`).split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                  return (
                    <button
                      key={comm.id}
                      onClick={() => handleAffecter(showAssignmentModal, comm.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-700 group-hover:text-teal-900">{comm.full_name || `${comm.first_name} ${comm.last_name}`}</div>
                        <div className="text-xs text-slate-400">Commercial Agence</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-teal-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Choisir</div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <UserPlus size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Aucun commercial trouvé</p>
                  <p className="text-slate-400 text-xs mt-1">Veuillez d'abord créer des commerciaux dans le système.</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
                onClick={() => setShowAssignmentModal(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operations Officer Assignment Modal */}
      {showOpsAssignmentModal && (
        <div className="modal-overlay z-[110]" onClick={() => setShowOpsAssignmentModal(null)}>
          <div className="modal-content max-w-[500px]" onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Affectation Opérations</h2>
                <p className="text-slate-500 text-sm mt-1">Sélectionnez le chargé d'opération pour cette demande</p>
              </div>
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={() => setShowOpsAssignmentModal(null)}>
                <XCircle size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {operationsOfficers && operationsOfficers.length > 0 ? (
                operationsOfficers.map(ops => {
                  const initials = (ops.full_name || `${ops.first_name} ${ops.last_name}`).split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                  return (
                    <button
                      key={ops.id}
                      onClick={() => handleAffecterOperations(showOpsAssignmentModal, ops.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-700 group-hover:text-teal-900">{ops.full_name || `${ops.first_name} ${ops.last_name}`}</div>
                        <div className="text-xs text-slate-400">Chargé des Opérations</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-teal-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Choisir</div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <UserPlus size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Aucun chargé d'opération trouvé</p>
                  <p className="text-slate-400 text-xs mt-1">Veuillez d'abord créer des chargés d'opérations dans le système.</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
                onClick={() => setShowOpsAssignmentModal(null)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAO Modal */}
      {showCAOModal && (
        <div
          className="modal-overlay z-[120]"
          onClick={closeCAOModal}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '440px',
              maxWidth: '95vw',
              maxHeight: '88vh',
              boxShadow: '0 8px 40px 0 rgba(0,0,0,0.18)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'visible',
            }}
          >
            {/* Header */}
            <div style={{ padding: '22px 24px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>
                Confirmation avant opération — #{showCAOModal.id}
              </h3>
              <button
                onClick={closeCAOModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px', lineHeight: 1, marginLeft: '12px', flexShrink: 0, fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 24px 20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Info card */}
              <div style={{ backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#374151' }}><span style={{ color: '#9ca3af' }}>Client : </span><strong>{showCAOModal.client_name || showCAOModal.formulaire_data?.nom || '—'}</strong></p>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#374151' }}><span style={{ color: '#9ca3af' }}>Date : </span><strong>{showCAOModal.date_intervention ? new Date(showCAOModal.date_intervention).toLocaleDateString('fr-FR') : (showCAOModal.formulaire_data?.date_intervention || '—')}</strong></p>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#374151' }}><span style={{ color: '#9ca3af' }}>Heure : </span><strong>{showCAOModal.formulaire_data?.heure || '—'}</strong></p>
                  <p style={{ margin: 0, fontSize: '13.5px', color: '#374151' }}><span style={{ color: '#9ca3af' }}>Lieu : </span><strong>{[showCAOModal.formulaire_data?.quartier || showCAOModal.client_neighborhood, showCAOModal.formulaire_data?.ville || showCAOModal.client_city].filter(Boolean).join(', ') || '—'}</strong></p>
                </div>
              </div>

              {/* Décision dropdown */}
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Décision</label>

                {/* Trigger */}
                <div
                  onClick={() => setCaoMenuOpen((prev) => !prev)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '10px',
                    cursor: 'pointer', backgroundColor: '#ffffff', userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '14px', color: caoDecision ? '#1a1a2e' : '#9ca3af', fontWeight: caoDecision ? 600 : 400 }}>
                    {caoDecision === 'confirmed' ? 'Confirmé' : caoDecision === 'postponed' ? 'Reporté' : caoDecision === 'cancelled' ? 'Annulé' : 'Choisir...'}
                  </span>
                  <ChevronDown size={18} style={{ color: '#6b7280' }} />
                </div>

                {/* Dropdown options */}
                <div
                  id="cao-decision-menu"
                  style={{
                    display: caoMenuOpen ? 'block' : 'none',
                    marginTop: '8px',
                    backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 10,
                  }}
                >
                  <button
                    onClick={() => { setCaoDecision('confirmed'); setCaoMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '12px 16px', backgroundColor: '#ffffff', border: 'none',
                      cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#065f46', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ecfdf5')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <CheckCircle size={18} style={{ color: '#059669' }} /> Confirmé
                  </button>
                  <button
                    onClick={() => { setCaoDecision('postponed'); setCaoMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '12px 16px', backgroundColor: '#ffffff', border: 'none', borderTop: '1px solid #f3f4f6',
                      cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#374151', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fff7ed')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <AlertTriangle size={18} style={{ color: '#f59e0b' }} /> Reporté
                  </button>
                  <button
                    onClick={() => { setCaoDecision('cancelled'); setCaoMenuOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '12px 16px', backgroundColor: '#ffffff', border: 'none', borderTop: '1px solid #f3f4f6',
                      cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#374151', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <XCircle size={18} style={{ color: '#ef4444' }} /> Annulé
                  </button>
                </div>
              </div>

              {caoDecision === 'postponed' && (
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                      Nouvelle date
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="date"
                        value={caoPostponedDate}
                        onChange={(e) => setCaoPostponedDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '10px',
                          fontSize: '14px',
                          color: '#1f2937',
                        }}
                      />
                      <Calendar size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                      Nouvelle heure
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="time"
                        value={caoPostponedTime}
                        onChange={(e) => setCaoPostponedTime(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '10px',
                          fontSize: '14px',
                          color: '#1f2937',
                        }}
                      />
                      <Clock size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <p style={{ gridColumn: 'span 2', margin: '4px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Le commercial sera alerté du changement de date et heure.</p>
                </div>
              )}

              {caoDecision === 'cancelled' && (
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                    Motif d'annulation *
                  </label>
                  <textarea
                    rows={4}
                    value={caoCancelReason}
                    onChange={(e) => setCaoCancelReason(e.target.value)}
                    placeholder="Saisir le motif d'annulation..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1f2937',
                      resize: 'vertical',
                      minHeight: '84px',
                    }}
                  />
                </div>
              )}

              {caoDecision === 'confirmed' && (
                <div style={{ marginTop: '16px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '12px' }}>
                  <p style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: '#065f46' }}>
                    <CheckCircle size={16} /> Opération confirmée avec le client
                  </p>

                  <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #d1d5db', padding: '10px 12px', marginBottom: '10px' }}>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Fiche candidat
                    </p>
                    <p style={{ margin: '8px 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                      {showCAOModal.profils_envoyes?.length
                        ? `${showCAOModal.profils_envoyes[showCAOModal.profils_envoyes.length - 1].full_name || `${showCAOModal.profils_envoyes[showCAOModal.profils_envoyes.length - 1].first_name} ${showCAOModal.profils_envoyes[showCAOModal.profils_envoyes.length - 1].last_name}`}`
                        : 'Aucun candidat assigné'}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      {showCAOModal.profils_envoyes?.length
                        ? `Tel: ${showCAOModal.profils_envoyes[showCAOModal.profils_envoyes.length - 1].phone || '—'}`
                        : 'Affectez un profil pour préparer la suite opérationnelle.'}
                    </p>
                  </div>

                  {(() => {
                    const links = getCaoProfileLinks(showCAOModal);

                    if (!links.length) {
                      return (
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px dashed #cbd5e1', padding: '10px 12px', marginBottom: '10px', fontSize: '13px', color: '#6b7280' }}>
                          Aucun lien profil disponible. Assignez au moins un profil à la demande.
                        </div>
                      );
                    }

                    const currentIndex = Math.min(caoPreviewIndex, links.length - 1);
                    const item = links[currentIndex];

                    return (
                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <button
                            onClick={() => setCaoPreviewIndex((prev) => Math.max(prev - 1, 0))}
                            disabled={currentIndex === 0}
                            style={{
                              border: '1px solid #d1d5db',
                              backgroundColor: currentIndex === 0 ? '#f3f4f6' : '#ffffff',
                              color: '#374151',
                              borderRadius: '8px',
                              width: '34px',
                              height: '34px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <ChevronLeft size={16} />
                          </button>

                          <span style={{ fontSize: '12px', color: '#4b5563', fontWeight: 600 }}>
                            Aperçu {currentIndex + 1}/{links.length}
                          </span>

                          <button
                            onClick={() => setCaoPreviewIndex((prev) => Math.min(prev + 1, links.length - 1))}
                            disabled={currentIndex >= links.length - 1}
                            style={{
                              border: '1px solid #d1d5db',
                              backgroundColor: currentIndex >= links.length - 1 ? '#f3f4f6' : '#ffffff',
                              color: '#374151',
                              borderRadius: '8px',
                              width: '34px',
                              height: '34px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: currentIndex >= links.length - 1 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
                          </button>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px dashed #cbd5e1', padding: '10px 12px' }}>
                          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Aperçu du message - {item.agent_name}
                          </p>
                          <div style={{ marginTop: '8px', fontSize: '13px', color: '#1f2937', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
                            {`Bonjour ${showCAOModal.client_name || showCAOModal.formulaire_data?.nom || 'Client'},\n\n`}
                            {`Dans le cadre de votre réservation de ménage, nous avons le plaisir de vous transmettre le profil de ${item.agent_name || 'la candidate'} qui assurera l'intervention chez vous. Nous vous invitons à cliquer sur le lien suivant pour consulter plus de détails.\n\n`}
                            {item.link}
                            {`\n\nCordialement,\nL'équipe Agence Ménage`}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                            <button
                              onClick={() => window.open(item.link, '_blank')}
                              style={{
                                width: '100%',
                                border: '1px solid #d1d5db',
                                backgroundColor: '#ffffff',
                                color: '#065f46',
                                borderRadius: '8px',
                                padding: '9px 10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Voir la fiche profil en ligne
                            </button>
                            <button
                              onClick={() => copyText(item.link, `Lien profil copié (${item.agent_name})`)}
                              style={{
                                width: '100%',
                                border: '1px solid #059669',
                                backgroundColor: '#059669',
                                color: '#ffffff',
                                borderRadius: '8px',
                                padding: '9px 10px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Copier le lien profil
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <button
                    disabled={sendingCaoWhatsApp || !showCAOModal.profils_envoyes?.length}
                    onClick={() => handleSendCaoWhatsApp(showCAOModal)}
                    style={{
                      width: '100%',
                      marginTop: '10px',
                      border: '1px solid #059669',
                      backgroundColor: sendingCaoWhatsApp ? '#6ee7b7' : '#059669',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontWeight: 700,
                      cursor: sendingCaoWhatsApp || !showCAOModal.profils_envoyes?.length ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {sendingCaoWhatsApp ? 'Envoi en cours...' : 'Envoyer la candidature via WhatsApp'}
                  </button>

                  <div style={{ marginTop: '12px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#166534', marginBottom: '8px' }}>
                      Note opérationnelle
                    </label>
                    <textarea
                      rows={3}
                      value={caoNote}
                      onChange={(e) => setCaoNote(e.target.value)}
                      placeholder="Ajouter une note pour le service opération..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '10px',
                        fontSize: '14px',
                        color: '#1f2937',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px 20px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f1f5f9' }}>
              <button
                onClick={closeCAOModal}
                style={{
                  padding: '9px 22px', borderRadius: '8px', border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff', color: '#374151', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                disabled={!caoDecision || (caoDecision === 'postponed' && !caoPostponedDate) || (caoDecision === 'cancelled' && !caoCancelReason.trim())}
                onClick={() => handleCAOUpdate(showCAOModal, caoDecision!)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 22px', borderRadius: '8px', border: 'none',
                  backgroundColor: (!caoDecision || (caoDecision === 'postponed' && !caoPostponedDate) || (caoDecision === 'cancelled' && !caoCancelReason.trim())) ? '#d1d5db' : '#0d9488',
                  color: '#ffffff', fontWeight: 700, fontSize: '14px',
                  cursor: (!caoDecision || (caoDecision === 'postponed' && !caoPostponedDate) || (caoDecision === 'cancelled' && !caoCancelReason.trim())) ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                }}
                onMouseEnter={e => {
                  if (caoDecision && !(caoDecision === 'postponed' && !caoPostponedDate) && !(caoDecision === 'cancelled' && !caoCancelReason.trim())) {
                    e.currentTarget.style.backgroundColor = '#0f766e';
                  }
                }}
                onMouseLeave={e => {
                  if (caoDecision && !(caoDecision === 'postponed' && !caoPostponedDate) && !(caoDecision === 'cancelled' && !caoCancelReason.trim())) {
                    e.currentTarget.style.backgroundColor = '#0d9488';
                  }
                }}
              >
                <Check size={16} /> Valider
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Annulation Modal */}
      {showAnnulationModal && (
        <div className="modal-overlay z-[110]" onClick={() => setShowAnnulationModal(null)}>
          <div
            className="modal-content max-w-[460px]"
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: 0, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: 'none' }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <XCircle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    Rejeté / Annulé — #{showAnnulationModal.demandeId}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowAnnulationModal(null)}
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                Motif du rejet / annulation <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                autoFocus
                style={{ width: '100%', border: '2px solid #0d9488', borderRadius: '10px', padding: '14px 16px', fontSize: '14px', color: '#0f172a', minHeight: '120px', resize: 'vertical', outline: 'none', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                placeholder="Saisissez la raison du rejet ou de l'annulation..."
                value={annulationReason}
                onChange={e => setAnnulationReason(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowAnnulationModal(null)}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', backgroundColor: 'white', border: '1px solid #cbd5e1', cursor: 'pointer' }}
              >
                Annuler
              </button>
              {showAnnulationModal.isSubscription ? (
                <>
                  <button
                    onClick={async () => {
                      if (!annulationReason.trim()) return;
                      try {
                        await annulerDemande(showAnnulationModal.demandeId, annulationReason.trim(), 'intervention');
                        addToast('Intervention annulée', 'success');
                        setShowAnnulationModal(null);
                        setAnnulationReason('');
                        fetchData();
                      } catch (err) {
                        addToast('Erreur lors de l\'annulation', 'error');
                      }
                    }}
                    disabled={!annulationReason.trim()}
                    style={{
                      padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white',
                      backgroundColor: annulationReason.trim() ? '#f97316' : '#fed7aa',
                      border: 'none', cursor: annulationReason.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s'
                    }}
                  >
                    Annuler l'intervention
                  </button>
                  <button
                    onClick={async () => {
                      if (!annulationReason.trim()) return;
                      try {
                        await annulerDemande(showAnnulationModal.demandeId, annulationReason.trim(), 'besoin');
                        addToast('Besoin complet annulé', 'success');
                        setShowAnnulationModal(null);
                        setAnnulationReason('');
                        fetchData();
                      } catch (err) {
                        addToast('Erreur lors de l\'annulation', 'error');
                      }
                    }}
                    disabled={!annulationReason.trim()}
                    style={{
                      padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white',
                      backgroundColor: annulationReason.trim() ? '#ef4444' : '#fca5a5',
                      border: 'none', cursor: annulationReason.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s'
                    }}
                  >
                    Annuler le besoin
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    if (!annulationReason.trim()) return;
                    try {
                      await annulerDemande(showAnnulationModal.demandeId, annulationReason.trim(), 'besoin');
                      addToast('Demande rejetée / annulée', 'success');
                      setShowAnnulationModal(null);
                      setAnnulationReason('');
                      fetchData();
                    } catch (err) {
                      addToast('Erreur lors de l\'annulation', 'error');
                    }
                  }}
                  disabled={!annulationReason.trim()}
                  style={{
                    padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white',
                    backgroundColor: annulationReason.trim() ? '#ef4444' : '#fca5a5',
                    border: 'none', cursor: annulationReason.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  Confirmer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Facturation Annulee Modal */}
      {showFacturationAnnuleeModal && (() => {
        const isGratuit = showFacturationAnnuleeModal.type === 'intervention_gratuite';
        const titleText = isGratuit
          ? `Intervention gratuite — #${showFacturationAnnuleeModal.demandeId}`
          : `Facturation annulée — #${showFacturationAnnuleeModal.demandeId}`;
        const labelText = isGratuit
          ? "Raison de l'intervention gratuite"
          : "Raison de l'annulation";
        const placeholderText = isGratuit
          ? "Indiquer la raison de l'intervention gratuite..."
          : "Indiquer la raison de l'annulation...";
        const confirmBtnText = isGratuit
          ? "Confirmer l'intervention gratuite"
          : "Confirmer l'annulation";
        
        return (
          <div className="modal-overlay z-[110]" onClick={() => setShowFacturationAnnuleeModal(null)}>
            <div
              className="modal-content max-w-[460px]"
              onClick={e => e.stopPropagation()}
              style={{ backgroundColor: '#f8fafc', borderRadius: '16px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: 'none' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f766e' }}>
                  {titleText}
                </h3>
                <button
                  onClick={() => setShowFacturationAnnuleeModal(null)}
                  style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f766e', fontSize: '18px' }}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#0f766e', marginBottom: '4px' }}>
                  {labelText}
                </label>
                <textarea
                  autoFocus
                  placeholder={placeholderText}
                  style={{ width: '100%', border: '1.5px solid #0d9488', borderRadius: '8px', padding: '12px', fontSize: '14px', color: '#334155', minHeight: '100px', resize: 'vertical', outline: 'none', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                  value={facturationAnnuleeReason}
                  onChange={e => setFacturationAnnuleeReason(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                  Le profil sera payé ?
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFacturationAnnuleeProfilPaye(true);
                    }}
                    style={{
                      padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                      background: facturationAnnuleeProfilPaye ? '#0d9488' : '#ffffff',
                      color: facturationAnnuleeProfilPaye ? 'white' : '#0f766e',
                      border: facturationAnnuleeProfilPaye ? '1px solid #0d9488' : '1px solid #e2e8f0',
                      transition: 'all 0.2s'
                    }}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFacturationAnnuleeProfilPaye(false);
                    }}
                    style={{
                      padding: '6px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                      background: !facturationAnnuleeProfilPaye ? '#0d9488' : '#ffffff',
                      color: !facturationAnnuleeProfilPaye ? 'white' : '#0f766e',
                      border: !facturationAnnuleeProfilPaye ? '1px solid #0d9488' : '1px solid #e2e8f0',
                      transition: 'all 0.2s'
                    }}
                  >
                    Non
                  </button>
                </div>
              </div>

              <hr style={{ borderTop: '1px solid #e2e8f0', borderBottom: 'none', margin: '0 0 20px 0' }} />

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  onClick={() => setShowFacturationAnnuleeModal(null)}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#0f766e', backgroundColor: 'white', border: '1px solid #e2e8f0', cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    if (!facturationAnnuleeReason.trim()) return;
                    try {
                      const d = demandes.find(x => x.id === showFacturationAnnuleeModal.demandeId);
                      if (!d) return;
                      const prevFacturation = d.formulaire_data?.facturation || {};
                      const partsRepartition = prevFacturation.parts_repartition || [];
                      const newParts = facturationAnnuleeProfilPaye 
                        ? partsRepartition 
                        : partsRepartition.map((p: any) => ({ ...p, amount: 0 }));
                      const totalParts = newParts.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0);

                      const prixValue = toNumber(d.prix);
                      const tvaActive = Boolean(prevFacturation.tva_active);
                      const currentHT = toNumber(prevFacturation.montant_ht) || (tvaActive ? roundMoney(prixValue / 1.2) : prixValue);
                      const caInitial = toNumber(prevFacturation.ca_initial) || (currentHT > 0 ? currentHT : (tvaActive ? roundMoney(prixValue / 1.2) : prixValue));
                      const nextHT = totalParts > 0 ? -totalParts : 0;

                      const updateData: any = {
                        formulaire_data: {
                          ...(d.formulaire_data || {}),
                          facturation: {
                            ...prevFacturation,
                            facturation_annulee: true,
                            statut_paiement_ui: showFacturationAnnuleeModal.type,
                            annulation_raison: facturationAnnuleeReason.trim(),
                            profil_sera_paye: facturationAnnuleeProfilPaye,
                            montant_profil_annulation: totalParts,
                            parts_repartition: newParts,
                            montant_ht: nextHT,
                            ca_initial: caInitial
                          }
                        }
                      };
                      if (showFacturationAnnuleeModal.type === 'facturation_annulee') {
                        updateData.statut = 'annule';
                      } else {
                        updateData.statut = d.statut; // Keep original demand status
                      }
                      
                      await updateDemande(d.id, updateData);
                      addToast(isGratuit ? 'Intervention gratuite appliquée' : 'Facturation annulée', 'success');
                      setShowFacturationAnnuleeModal(null);
                      setFacturationAnnuleeReason('');
                      setFacturationAnnuleeProfilPaye(false);
                      fetchData();
                    } catch (err) {
                      addToast("Erreur lors de la mise à jour de la demande", 'error');
                    }
                  }}
                  disabled={!facturationAnnuleeReason.trim()}
                  style={{
                    padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white',
                    backgroundColor: facturationAnnuleeReason.trim() ? '#0d9488' : '#99f6e4',
                    border: 'none', cursor: facturationAnnuleeReason.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  {confirmBtnText}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

