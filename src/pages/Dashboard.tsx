import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, ClipboardCheck, Building2, Clock, Search, List, Grid, MoreVertical, Edit2, Settings,
  CheckCircle, UserCheck, MessageSquare, AlertTriangle,
  Check, ChevronLeft, ChevronUp, ChevronDown, FileText, ClipboardList, UserPlus, Eye, Download, Send, Save, XCircle, Calendar, Trash2, Plus, Pencil
} from 'lucide-react';

import { Demande, User } from '../types';
import { getDemandes, updateDemande, annulerDemande, confirmerCAO, getUsers, affecterDemande, generateDocument, fetchSecureDocBlob, deleteDemande, sendWhatsApp, getAuditLogs, getAgents } from '../api/client';
import { useToastStore } from '../store/toast';
import { useAuthStore } from '../store/auth';
import { encodeId } from '../utils/obfuscation';
import { normalizeFrequence, normalizeStructure, normalizeTimePref, normalizeMobilite, normalizeSexe, normalizeQuartier } from '../utils/formNormalizers';

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
}

const PAYMENT_STATUS_OPTIONS = [
  { value: 'non_confirme', apiValue: 'non_paye', label: 'Non confirmé' },
  { value: 'paiement_en_attente', apiValue: 'acompte', label: 'Paiement en attente' },
  { value: 'agence_payee_client', apiValue: 'partiel', label: 'Agence payé / Client' },
  { value: 'profil_paye_client', apiValue: 'partiel', label: 'Profil payé / Client' },
  { value: 'paiement_partiel', apiValue: 'partiel', label: 'Paiement partiel' },
  { value: 'paye', apiValue: 'integral', label: 'Payé' },
  { value: 'facturation_annulee', apiValue: 'non_paye', label: 'Facturation annulée' },
];

const getPaymentUiValue = (statutPaiement: string, facturationAnnulee: boolean, fallback?: string): string => {
  if (fallback && PAYMENT_STATUS_OPTIONS.some((option) => option.value === fallback)) return fallback;
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
    "Nettoyage post-déménagement",
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

export default function Dashboard() {

  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ en_cours: 0, en_cours_particulier: 0, en_cours_entreprise: 0, en_cours_nouveau: 0, en_attente: 0 });
  const [clientDemandeCounts, setClientDemandeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'besoins' | 'abonnements'>('besoins');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showNoteModal, setShowNoteModal] = useState<{ demandeId: number; type: 'commercial' | 'operationnel'; note: string } | null>(null);
  const [showCAOModal, setShowCAOModal] = useState<Demande | null>(null);
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

  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string, type: 'devis' | 'png' | 'facture', name: string, demandeId: number } | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const navigate = useNavigate();
  const [blinkNouveau, setBlinkNouveau] = useState(false);

  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const [commerciaux, setCommerciaux] = useState<User[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'responsable_commercial') {
      getUsers({ role: 'commercial' }).then(res => setCommerciaux(res.data?.results || res.data)).catch(console.error);
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

  const handlePreviewDocument = async (type: 'devis' | 'png' | 'facture') => {
    if (!selectedDemande) return;
    try {
      const typeLabel = type === 'devis' ? 'devis' : (type === 'facture' ? 'de la facture' : 'du récapitulatif');
      addToast(`Génération ${typeLabel} sur le serveur...`, 'info');
      const response = await generateDocument(selectedDemande.id, type);
      const doc = response.data;

      // Utilise le download_url sécurisé — jamais le chemin physique
      const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
      setShowPreviewModal({ url: blobUrl, type, name: doc.nom, demandeId: selectedDemande.id });

      // Refresh demandes and sync selectedDemande so the history updates
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
      const results = allResults.filter(d => d.statut !== 'en_attente' && d.statut !== 'annule');
      setDemandes(results);

      const enCours = results.filter(d => d.statut === 'en_cours');
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
    if (statutUi === 'paye' || statutUi === 'integral') badgeClass = 'badge-green';
    else if (['agence_payee_client', 'profil_paye_client', 'paiement_partiel', 'paiement_en_attente'].includes(statutUi)) badgeClass = 'badge-orange';
    else if (statutUi === 'facturation_annulee') badgeClass = 'badge-red';
    
    return <span className={`badge ${badgeClass}`}>{label}</span>;
  };

  const handleCAOUpdate = async (demande: Demande, status: 'confirmed' | 'postponed' | 'cancelled') => {
    try {
      if (status === 'confirmed') {
        // Mark CAO as confirmed (cao = true)
        await confirmerCAO(demande.id);
        // Change status to "en_cours" (Confirmé intervention)
        const updateData: any = { statut: 'en_cours', cao: true, note_operationnel: caoNote || '' };
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

  const handleUpdate = async () => {
    if (!selectedDemande) return;
    try {
      const montantHT = toNumber(editFormData.montant_ht ?? editFormData.prix);
      const tvaActive = Boolean(editFormData.tva_active);
      const montantTTC = roundMoney(tvaActive ? montantHT * 1.2 : montantHT);
      const montantVerse = toNumber(editFormData.montant_verse);
      const partAgence = toNumber(editFormData.part_agence);

      const normalizedFrequence = (editFormData.frequence || '').toString().toLowerCase();
      const frequency = normalizedFrequence
        ? (normalizedFrequence === 'une fois' ? 'oneshot' : 'abonnement')
        : selectedDemande.frequency;

      const partsRepartition = asArray<PartRepartitionItem>(editFormData.parts_repartition, [])
        .map((item) => ({
          profile_id: item.profile_id,
          amount: toNumber(item.amount),
          is_delegate: Boolean(item.is_delegate),
        }))
        .filter((item) => item.profile_id !== '');

      const updateData: any = {
        service: editFormData.service,
        segment: editFormData.segment,
        statut: editFormData.statut,
        prix: montantTTC,
        nb_heures: parseInt(editFormData.duree || editFormData.nb_heures) || 0,
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
      };

      const paymentUiValue = editFormData.statut_paiement_ui || getPaymentUiValue(editFormData.statut_paiement || 'non_paye', Boolean(editFormData.facturation_annulee));

      // Logic: Status transitions
      let finalStatutPaiementUi = paymentUiValue;
      let triggerSatisfactionWhatsApp = false;

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
        whatsapp_phone: editFormData.client_whatsapp || editFormData.client_phone || previousFormData.whatsapp_phone || '',
        ville: editFormData.ville || '',
        quartier: editFormData.quartier || '',
        adresse: editFormData.adresse || '',
        preference_horaire: editFormData.preference_horaire || '',
        type_habitation: editFormData.type_habitation || '',
        frequence: editFormData.frequence || '',
        nb_intervenants: parseInt(editFormData.nb_intervenants) || 1,
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
        date: editFormData.date || editFormData.date_intervention || '',
        nb_personnel: parseInt(editFormData.nb_personnel) || 1,
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
          facturation_annulee: finalStatutPaiementUi === 'facturation_annulee',
          statut_paiement_ui: finalStatutPaiementUi,
          mode_paiement: editFormData.mode_paiement || '',
          encaisse_par: editFormData.encaisse_par || '',
          part_agence: partAgence,
          parts_repartition: partsRepartition,
          annulation_raison: editFormData.annulation_raison || '',
          profil_sera_paye: Boolean(editFormData.profil_sera_paye),
          montant_profil_annulation: toNumber(editFormData.montant_profil_annulation),
          montant_agence_doit_profil: toNumber(editFormData.montant_agence_doit_profil),
          montant_profil_doit_agence: toNumber(editFormData.montant_profil_doit_agence),
        },
        part_agence: partAgence,
        parts_repartition: partsRepartition,
        notes: editFormData.note_client || '',
      };

      updateData.avec_produit = Boolean(editFormData.produits || editFormData.avec_produit);

      const response = await updateDemande(selectedDemande.id, updateData);

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

    const paymentUiValue = getPaymentUiValue(
      d.statut_paiement,
      Boolean(facturationData.facturation_annulee),
      facturationData.statut_paiement_ui
    );

    // Pre-populate parts_repartition from profils_envoyes when no saved repartition exists
    let savedParts = asArray<PartRepartitionItem>(facturationData.parts_repartition || formData.parts_repartition, []);
    if (savedParts.length === 0 && d.profils_envoyes && d.profils_envoyes.length > 0) {
      savedParts = d.profils_envoyes.map((p: any, idx: number) => ({
        profile_id: p.id,
        amount: 0,
        is_delegate: idx === 0,
      }));
    }

    setSelectedDemande(d);
    setIsEditing(true);
    setEditFormData({
      prix: prixValue,
      montant_ht: montantHT,
      tva_active: tvaActive,
      montant_verse: toNumber(facturationData.montant_verse),
      montant_profil_doit: toNumber(facturationData.montant_profil_doit),
      facturation_annulee: Boolean(facturationData.facturation_annulee),
      part_agence: toNumber(facturationData.part_agence || formData.part_agence),
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
      frequency: d.frequency,
      frequence: normalizeFrequence(formData.frequence || d.frequency_label || (d.frequency === 'oneshot' ? 'une fois' : '1/sem')),
      client_name: d.client_name || formData.nom || '',
      client_phone: d.client_phone || formData.whatsapp_phone || '',
      client_whatsapp: d.client_whatsapp || formData.whatsapp_phone || '',
      client_email: d.client_details?.email || '',
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
      nb_personnel: formData.nb_personnel || 1,
      surface: formData.surface || formData.surfaceArea || 0,
      details_pieces: formData.details_pieces || '',
      ville: formData.ville || '',
      quartier: normalizeQuartier(formData.quartier || ''),
      adresse: formData.adresse || '',
      preference_horaire: normalizeTimePref(formData.preference_horaire || ''),
      nb_intervenants: formData.nb_intervenants || formData.numberOfPeople || ((d.nb_heures || 0) > 0 ? 1 : 0),
      rooms: formData.rooms || {
        cuisine: 1,
        suiteAvecBain: 0,
        suiteSansBain: 0,
        salleDeBain: 1,
        chambre: 1,
        salonMarocain: 0,
        salonEuropeen: 1,
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

  useEffect(() => { fetchData(); }, []);

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
      if (activeTab === 'abonnements' && d.frequency !== 'abonnement') return false;
      if (activeTab === 'besoins' && d.frequency === 'abonnement') return false;

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



  // Nouveaux flags pour le formulaire complet
  const exactEditService = (editFormData.service || selectedDemande?.service || '').toString();
  const exactEditServiceLower = exactEditService.toLowerCase();
  const isCleaningService = exactEditServiceLower.includes('ménage') || exactEditServiceLower.includes('menage') || exactEditServiceLower.includes('nettoyage') || exactEditServiceLower.includes('chantier') || exactEditServiceLower.includes('sinistre') || exactEditServiceLower.includes('déménagement');
  const isMenageStandardService = exactEditService === 'Ménage Standard';
  const isMenageAirBnBService = exactEditService === 'Ménage AirBnB';
  const isGrandMenageService = exactEditService === 'Grand Ménage';
  const isFinChantierService = exactEditService === 'Ménage fin de chantier';
  const isMenageBureauxService = exactEditService === 'Ménage Bureaux';
  const isPostDemenagementService = exactEditService === 'Ménage post-déménagement';
  const isPostSinistreService = exactEditService === 'Ménage post-sinistre';
  const isAuxiliaireService = exactEditService.includes('Auxiliaire de vie');
  const isPlacementGestionService = exactEditService === 'Placement & Gestion';
  const minDuree = (isGrandMenageService || isPostDemenagementService || isFinChantierService) ? 4 : (isMenageBureauxService || isMenageAirBnBService) ? 2 : 3;


  const montantHT = toNumber(editFormData.montant_ht ?? editFormData.prix);
  const montantTTC = roundMoney(editFormData.tva_active ? montantHT * 1.2 : montantHT);
  // const montantVerse = toNumber(editFormData.montant_verse);
  // const montantProfilDoit = toNumber(editFormData.montant_profil_doit);

  const partsRepartition: PartRepartitionItem[] = asArray<PartRepartitionItem>(editFormData.parts_repartition, []);

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
          Besoins ({demandes.filter(d => d.frequency !== 'abonnement').length})
        </button>
        <button
          className={`tab ${activeTab === 'abonnements' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('abonnements')}
        >
          Abonnements ({demandes.filter(d => d.frequency === 'abonnement').length})
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
                            <button className="menu-item" onClick={() => { openDetail(d); setActiveMenu(null); }}>
                              <Edit2 size={14} /> Éditer le besoin
                            </button>


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
                            <Link
                              to={d.client ? `/clients/${encodeId(d.client)}` : '#'}
                              className="menu-item"
                              onClick={() => setActiveMenu(null)}
                              style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                            >
                              <UserCheck size={14} /> Compte Client
                            </Link>
                          </div>
                        )}
                      </td>
                      <td>{d.commercial_name || d.assigned_to_name || '—'}</td>
                      <td>{d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : (d.formulaire_data?.date_intervention || '—')}</td>
                      <td>
                        <span className={`badge ${d.statut === 'en_cours' ? (d.cao ? 'badge-green' : 'badge-nouveau') :
                          d.statut === 'termine' ? 'badge-green' :
                            d.statut === 'pres_en_cours' ? 'badge-purple' :
                              d.statut === 'pres_terminee' ? 'badge-orange' :
                                'badge-orange'
                          }`}>
                          {d.statut === 'en_cours' ? (d.cao ? 'Confirmé' : (<><span>Nouveau</span><span>besoin</span></>)) :
                            d.statut === 'termine' ? 'Terminé' :
                              d.statut === 'pres_en_cours' ? 'Pres. en cours' :
                                d.statut === 'pres_terminee' ? 'Pres. terminée' :
                                  'Nouveau besoin'}
                        </span>
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
                        {d.avec_produit ? (
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
                            <button className="menu-item" onClick={() => { openDetail(d); setActiveMoreMenu(null); }}>
                              <Pencil size={16} /> Éditer le besoin
                            </button>

                            <button className="menu-item" onClick={() => {
                              setShowNoteModal({ demandeId: d.id, type: 'commercial', note: d.note_commercial || '' });
                              setActiveMoreMenu(null);
                            }}>
                              <MessageSquare size={16} /> Note commerciale
                            </button>
                            <button className="menu-item" onClick={() => {
                              setShowNoteModal({ demandeId: d.id, type: 'operationnel', note: d.note_operationnel || '' });
                              setActiveMoreMenu(null);
                            }}>
                              <MessageSquare size={16} /> Note opérationnelle
                            </button>

                            <div className="menu-divider" />

                            <button className="menu-item text-purple" onClick={async () => {
                              await updateDemande(d.id, { statut: 'pres_en_cours' });
                              addToast('Statut mis à jour : Prestation en cours', 'success');
                              fetchData();
                              setActiveMoreMenu(null);
                            }}>
                              <CheckCircle size={16} /> Pres. en cours
                            </button>

                            <button className="menu-item text-orange" onClick={async () => {
                              await updateDemande(d.id, { statut: 'pres_terminee' });
                              addToast('Statut mis à jour : Prestation terminée', 'success');
                              addToast('Lien de satisfaction envoyé au client via WhatsApp', 'info');
                              fetchData();
                              setActiveMoreMenu(null);
                            }}>
                              <CheckCircle size={16} /> Pres. terminée
                            </button>

                            <div className="menu-divider" />

                            <button className="menu-item text-red" onClick={async () => {
                              const reason = prompt('Motif d\'annulation :');
                              if (reason === null) return;
                              await annulerDemande(d.id, reason);
                              addToast('Demande rejetée / annulée', 'success');
                              fetchData();
                              setActiveMoreMenu(null);
                            }}>
                              <XCircle size={16} /> Rejeté / Annulé
                            </button>

                            <button className="menu-item text-orange" onClick={async () => {
                              if (confirm('Confirmer l\'annulation de la facturation ?')) {
                                await updateDemande(d.id, { statut_paiement: 'annule' });
                                addToast('Facturation annulée', 'success');
                                fetchData();
                                setActiveMoreMenu(null);
                              }
                            }}>
                              <XCircle size={16} /> Facturation annulée
                            </button>

                            <button className="menu-item text-red" onClick={async () => {
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
                            <button className="menu-item" onClick={() => { openDetail(d); setActiveMoreMenu(null); }}>
                              <Pencil size={16} /> Éditer le besoin
                            </button>

                            <button className="menu-item" onClick={() => {
                              setShowNoteModal({ demandeId: d.id, type: 'commercial', note: d.note_commercial || '' });
                              setActiveMoreMenu(null);
                            }}>
                              <MessageSquare size={16} /> Note commerciale
                            </button>
                            <button className="menu-item" onClick={() => {
                              setShowNoteModal({ demandeId: d.id, type: 'operationnel', note: d.note_operationnel || '' });
                              setActiveMoreMenu(null);
                            }}>
                              <MessageSquare size={16} /> Note opérationnelle
                            </button>

                            <div className="menu-divider" />

                            <button className="menu-item text-purple" onClick={async () => {
                              await updateDemande(d.id, { statut: 'pres_en_cours' });
                              addToast('Statut mis à jour : Prestation en cours', 'success');
                              fetchData();
                              setActiveMoreMenu(null);
                            }}>
                              <CheckCircle size={16} /> Pres. en cours
                            </button>

                            <button className="menu-item text-orange" onClick={async () => {
                              await updateDemande(d.id, { statut: 'pres_terminee' });
                              addToast('Statut mis à jour : Prestation terminée', 'success');
                              addToast('Lien de satisfaction envoyé au client via WhatsApp', 'info');
                              fetchData();
                              setActiveMoreMenu(null);
                            }}>
                              <CheckCircle size={16} /> Pres. terminée
                            </button>

                            <div className="menu-divider" />

                            <button className="menu-item text-red" onClick={async () => {
                              const reason = prompt('Motif d\'annulation :');
                              if (reason === null) return;
                              await annulerDemande(d.id, reason);
                              addToast('Demande rejetée / annulée', 'success');
                              fetchData();
                              setActiveMoreMenu(null);
                            }}>
                              <XCircle size={16} /> Rejeté / Annulé
                            </button>

                            <button className="menu-item text-red" onClick={async () => {
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
                          <button className="menu-item" onClick={() => { openDetail(d); setActiveMenu(null); }}>
                            <Pencil size={16} /> Éditer le besoin
                          </button>
                          <button className="menu-item w-full" onClick={(e) => { e.stopPropagation(); openCAOModal(d); setActiveMenu(null); }}>
                            <CheckCircle size={16} className={d.cao ? 'text-green-500' : ''} /> Confirmation CAO
                          </button>
                          <Link to={d.client ? `/clients/${encodeId(d.client)}` : '#'} className="menu-item" onClick={() => setActiveMenu(null)} style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                            <UserCheck size={16} /> Compte Client
                          </Link>
                          <div className="menu-divider" />
                          <button className="menu-item text-purple" onClick={async () => {
                            await updateDemande(d.id, { statut: 'pres_en_cours' });
                            addToast('Statut mis à jour : Prestation en cours', 'success');
                            fetchData();
                            setActiveMenu(null);
                          }}>
                            <CheckCircle size={16} /> Pres. en cours
                          </button>
                          <button className="menu-item text-orange" onClick={async () => {
                            await updateDemande(d.id, { statut: 'pres_terminee' });
                            addToast('Statut mis à jour : Prestation terminée', 'success');
                            addToast('Lien de satisfaction envoyé au client via WhatsApp', 'info');
                            fetchData();
                            setActiveMenu(null);
                          }}>
                            <CheckCircle size={16} /> Pres. terminée
                          </button>
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
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Détails de la note</label>
              <textarea
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', fontSize: '14px', color: '#0f172a', minHeight: '140px', resize: 'vertical', outline: 'none', backgroundColor: '#ffffff', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)', transition: 'all 0.2s', boxSizing: 'border-box' }}
                placeholder={`Veuillez rédiger la note ${showNoteModal.type === 'commercial' ? 'commerciale' : 'opérationnelle'}...`}
                value={showNoteModal.note}
                onChange={(e) => setShowNoteModal({ ...showNoteModal, note: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'; }}
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
                    const payload = showNoteModal.type === 'commercial'
                      ? { note_commercial: showNoteModal.note }
                      : { note_operationnel: showNoteModal.note };
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
                <div className="edit-form-full">
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
                      <div className="form-section-content">
                        {/* ====== CONDITIONAL SERVICE SECTIONS ====== */}
                        {isAuxiliaireService ? (
                          /* Auxiliaire de vie - Service sur mesure */
                          <div className="ws-form-block">
                            <div className="ws-section-header">Service sur mesure — {exactEditService}</div>

                            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                              <div style={{ gridColumn: 'span 2' }}>
                                <div className="ws-section-header" style={{ background: '#f1f5f9', color: 'var(--primary)', fontSize: '0.9rem' }}>Lieu de la garde</div>
                                <div className="ws-radio-pills">
                                  {['domicile', 'clinique', 'hopital'].map(loc => (
                                    <label key={loc} className="ws-radio-pill">
                                      <input type="radio" name="careLocation" value={loc} checked={editFormData.lieu_garde === loc} onChange={e => setEditFormData({ ...editFormData, lieu_garde: e.target.value })} />
                                      <span>{loc === 'domicile' ? 'Domicile' : loc === 'clinique' ? 'Clinique' : 'Hôpital'}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="form-group">
                                <label className="label-teal">Fréquence *</label>
                                <select className="ws-select" required value={editFormData.frequence} onChange={e => setEditFormData({ ...editFormData, frequence: e.target.value })}>
                                  <option value="">Sélectionner...</option>
                                  <option value="une fois">Une fois - Tranche 24h</option>
                                  <option value="1/sem">Abonnement - 1 fois / semaine</option>
                                  <option value="quotidien">Abonnement - Quotidien</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="label-teal">Nombre de jours *</label>
                                <div className="ws-counter">
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, nb_jours: Math.max(1, editFormData.nb_jours - 1) })} disabled={editFormData.nb_jours <= 1}>−</button>
                                  <span className="ws-counter-value">{editFormData.nb_jours}</span>
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, nb_jours: editFormData.nb_jours + 1 })}>+</button>
                                </div>
                              </div>
                            </div>

                            <div className="ws-section-header" style={{ marginTop: '1rem', background: '#f1f5f9', color: 'var(--primary)', fontSize: '0.9rem' }}>Profil de la personne aidée</div>
                            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                              <div className="form-group">
                                <label className="label-teal">Âge *</label>
                                <input type="number" placeholder="Ans" required value={editFormData.age_personne} onChange={e => setEditFormData({ ...editFormData, age_personne: e.target.value })} />
                              </div>
                              <div className="form-group">
                                <label className="label-teal">Sexe *</label>
                                <select className="ws-select" required value={editFormData.sexe_personne} onChange={e => setEditFormData({ ...editFormData, sexe_personne: e.target.value })}>
                                  <option value="">Sélectionner...</option>
                                  <option value="femme">Femme</option>
                                  <option value="homme">Homme</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="label-teal">Mobilité *</label>
                                <select className="ws-select" required value={editFormData.mobilite} onChange={e => setEditFormData({ ...editFormData, mobilite: e.target.value })}>
                                  <option value="">Sélectionner...</option>
                                  <option value="adulte">Adulte</option>
                                  <option value="agee">Personne Agée</option>
                                  <option value="autonome">Autonome</option>
                                  <option value="besoin_aide">Besoin d'aide</option>
                                  <option value="alitee">Alité(e)</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="label-teal">Pathologie / Situation médicale *</label>
                                <textarea rows={2} placeholder="Précisez la situation..." required value={editFormData.situation_medicale} onChange={e => setEditFormData({ ...editFormData, situation_medicale: e.target.value })}></textarea>
                              </div>
                            </div>
                          </div>
                        ) : isPlacementGestionService ? (
                          /* Placement & gestion - Service sur mesure */
                          <div className="ws-form-block">
                            <div className="ws-section-header">Service sur mesure — {exactEditService}</div>
                            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>Un chargé de clientèle prendra contact avec l'entreprise pour établir une offre personnalisée.</p>

                            <div className="ws-section-header" style={{ background: '#f1f5f9', color: 'var(--primary)', fontSize: '0.9rem' }}>Type de service</div>
                            <div className="ws-radio-pills">
                              {[{ v: 'flexible', l: 'Service ménage flexible' }, { v: 'premium', l: 'Service ménage Premium' }].map(o => (
                                <label key={o.v} className="ws-radio-pill">
                                  <input type="radio" name="placementServiceType" value={o.v} checked={editFormData.service_type === o.v} onChange={e => setEditFormData({ ...editFormData, service_type: e.target.value })} />
                                  <span>{o.l}</span>
                                </label>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem', marginTop: '0.75rem' }}>
                              <div className="form-group">
                                <label className="label-teal">Type de structure *</label>
                                <select className="ws-select" required value={editFormData.structure_type} onChange={e => setEditFormData({ ...editFormData, structure_type: e.target.value })}>
                                  <option value="">Sélectionner...</option>
                                  <option value="bureaux">Bureaux</option>
                                  <option value="magasin">Magasin/Boutique</option>
                                  <option value="restaurant">Restaurant/Café</option>
                                  <option value="clinique">Clinique / Hôpital</option>
                                  <option value="hotel">Hôtel / Riad</option>
                                  <option value="residence">Immeuble/Résidence/Luxe</option>
                                  <option value="entrepot">Entrepôt</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="label-teal">Fréquence *</label>
                                <select className="ws-select" required value={editFormData.frequence} onChange={e => setEditFormData({ ...editFormData, frequence: e.target.value })}>
                                  <option value="">Sélectionner...</option>
                                  <option value="une fois">Une fois</option>
                                  <option value="1/sem">1 fois / semaine</option>
                                  <option value="2/sem">2 fois / semaine</option>
                                  <option value="3/sem">3 fois / semaine</option>
                                  <option value="1/mois">1 fois / mois</option>
                                  <option value="quotidien">Quotidien</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="label-teal">Nombre de personnel *</label>
                                <div className="ws-counter">
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, nb_personnel: Math.max(1, editFormData.nb_personnel - 1) })} disabled={editFormData.nb_personnel <= 1}>−</button>
                                  <span className="ws-counter-value">{editFormData.nb_personnel}</span>
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, nb_personnel: editFormData.nb_personnel + 1 })}>+</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* ====== STANDARD MÉNAGE SERVICES ====== */
                          <>
                            {/* Type d'habitation */}
                            {isCleaningService && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">
                                  {isMenageBureauxService ? "Type de local professionnel" : "Type d'habitation"}
                                </div>
                                <div className="ws-radio-pills">
                                  {(isMenageBureauxService
                                    ? ['Bureau', 'Magasin', 'Restaurant', 'Clinique', 'Hôtel', 'Entrepôt']
                                    : ['Studio', 'Appartement', 'Duplex', 'Villa', 'Maison']
                                  ).map(type => (
                                    <label key={type} className="ws-radio-pill">
                                      <input type="radio" name="propertyType" value={type} checked={editFormData.type_habitation === type} onChange={e => setEditFormData({ ...editFormData, type_habitation: e.target.value })} />
                                      <span>{type}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Nature d'intervention (Post-sinistre) */}
                            {isPostSinistreService && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">Nature de l'intervention</div>
                                <div className="ws-nature-cards">
                                  {[
                                    { v: 'sinistre', l: '🔥 Après sinistre' },
                                    { v: 'event', l: '🎉 Post évènement' },
                                    { v: 'express', l: '⚡ Remise en état express' },
                                    { v: 'autre', l: '📋 Autre situation urgente' }
                                  ].map(n => (
                                    <div key={n.v} className={`ws-nature-card ${editFormData.intervention_nature === n.v ? 'active' : ''}`} onClick={() => setEditFormData({ ...editFormData, intervention_nature: n.v })}>
                                      {n.l}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* État du logement (Déménagement) */}
                            {isPostDemenagementService && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">État du logement</div>
                                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                                  <div className="form-group">
                                    <label className="label-teal">État du logement *</label>
                                    <select className="ws-select" required value={editFormData.accommodation_state} onChange={e => setEditFormData({ ...editFormData, accommodation_state: e.target.value })}>
                                      <option value="">Choisir...</option>
                                      <option value="vide">Vide</option>
                                      <option value="meuble">Meublé</option>
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label className="label-teal">Niveau de salissure *</label>
                                    <select className="ws-select" required value={editFormData.cleanliness_type} onChange={e => setEditFormData({ ...editFormData, cleanliness_type: e.target.value })}>
                                      <option value="">Choisir...</option>
                                      <option value="normal">Normal</option>
                                      <option value="intensif">Intensif</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Fréquence */}
                            <div className="ws-form-block">
                              <div className="ws-section-header">Choisissez la fréquence</div>
                              <div className="ws-freq-toggle">
                                <button type="button" className={editFormData.frequence === 'une fois' || !editFormData.frequence ? 'active' : ''} onClick={() => setEditFormData({ ...editFormData, frequence: 'une fois' })}>
                                  Une fois
                                </button>
                                <button type="button" className={editFormData.frequence !== 'une fois' && editFormData.frequence ? 'active' : ''} onClick={() => setEditFormData({ ...editFormData, frequence: '1/sem' })}>
                                  Abonnement
                                </button>
                              </div>
                              {editFormData.frequence && editFormData.frequence !== 'une fois' && (
                                <div style={{ maxWidth: '380px', margin: '0 auto' }}>
                                  <div className="ws-discount-badge">-10 % de réduction sur l'abonnement</div>
                                  <select className="ws-select" value={editFormData.frequence} onChange={e => setEditFormData({ ...editFormData, frequence: e.target.value })}>
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
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Détails des pièces (Ménage Standard & Grand Ménage) */}
                            {(isMenageStandardService || isGrandMenageService) && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">Merci de nous décrire votre domicile</div>
                                <p style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'right', fontWeight: 700, marginBottom: '0.5rem' }}>
                                  Cliquez sur + ou - pour décrire les pièces
                                </p>
                                <div className="ws-rooms-grid" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem' }}>
                                  {[
                                    { key: 'cuisine', label: 'Cuisine', time: '45 min' },
                                    { key: 'suiteAvecBain', label: 'Suite parentale avec salle de bain', time: '75 min' },
                                    { key: 'suiteSansBain', label: 'Suite parentale sans salle de bain', time: '45 min' },
                                    { key: 'salleDeBain', label: 'Salle de bain', time: '30 min' },
                                    { key: 'chambre', label: 'Chambre/pièce/bureau', time: '40 min' },
                                    { key: 'salonMarocain', label: 'Salon Marocain', time: '35 min' },
                                    { key: 'salonEuropeen', label: 'Salon européen', time: '35 min' },
                                    { key: 'toilettesLavabo', label: 'Toilette Lavabo', time: '25 min' },
                                    { key: 'rooftop', label: 'Rooftop', time: '30 min' },
                                    { key: 'escalier', label: 'Escalier', time: '25 min' }
                                  ].map(room => (
                                    <div key={room.key} className="ws-room-row">
                                      <div>
                                        <div className="ws-room-label">{room.label}</div>
                                        <div className="ws-room-time">{room.time}</div>
                                      </div>
                                      <div className="ws-room-counter">
                                        <button type="button" className="ws-room-btn" onClick={() => setEditFormData({ ...editFormData, rooms: { ...editFormData.rooms, [room.key]: Math.max(0, (editFormData.rooms[room.key] || 0) - 1) } })}>−</button>
                                        <span className="ws-room-count">{editFormData.rooms[room.key] || 0}</span>
                                        <button type="button" className="ws-room-btn" onClick={() => setEditFormData({ ...editFormData, rooms: { ...editFormData.rooms, [room.key]: (editFormData.rooms[room.key] || 0) + 1 } })}>+</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Surface (Grand Ménage, Fin Chantier, Déménagement) */}
                            {(isGrandMenageService || isFinChantierService || isPostDemenagementService) && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">Superficie de votre bien en m²</div>
                                <div className="ws-slider-container">
                                  <div className="ws-slider-value">{editFormData.surface} m²</div>
                                  <input type="range" className="ws-slider-input" min={0} max={300} step={10} value={editFormData.surface} onChange={e => setEditFormData({ ...editFormData, surface: parseInt(e.target.value) })} />
                                  <div className="ws-slider-labels">
                                    <span>0 m²</span>
                                    <span>150 m²</span>
                                    <span>300 m²</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Surface bureau (cards) */}
                            {isMenageBureauxService && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">Superficie de vos locaux</div>
                                <div className="ws-surface-cards">
                                  {[
                                    { v: '0-70', l: '0 - 70 m²' },
                                    { v: '71-150', l: '71 - 150 m²' },
                                    { v: '151-300', l: '151 - 300 m²' },
                                    { v: '300+', l: '300 m² et plus' }
                                  ].map(s => (
                                    <div key={s.v} className={`ws-surface-card ${String(editFormData.surface) === s.v ? 'active' : ''}`} onClick={() => setEditFormData({ ...editFormData, surface: s.v as any })}>
                                      {s.l}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Durée */}
                            {(isMenageStandardService || isGrandMenageService || isMenageAirBnBService || isMenageBureauxService) && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">Précisez le temps qui vous convient</div>
                                <p style={{ color: '#ef4444', fontSize: '0.65rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                                  La durée minimale est de {minDuree} heures
                                </p>
                                <div className="ws-counter">
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, duree: Math.max(minDuree, editFormData.duree - 1) })} disabled={editFormData.duree <= minDuree}>−</button>
                                  <span className="ws-counter-value">{editFormData.duree}</span>
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, duree: editFormData.duree + 1 })}>+</button>
                                </div>
                              </div>
                            )}

                            {/* Nombre de personnes */}
                            {(isMenageStandardService || isGrandMenageService || isMenageAirBnBService || isMenageBureauxService) && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">Nombre de personne</div>
                                <div className="ws-counter">
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, nb_intervenants: Math.max(1, editFormData.nb_intervenants - 1) })} disabled={editFormData.nb_intervenants <= 1}>−</button>
                                  <span className="ws-counter-value">{editFormData.nb_intervenants}</span>
                                  <button type="button" className="ws-counter-btn" onClick={() => setEditFormData({ ...editFormData, nb_intervenants: editFormData.nb_intervenants + 1 })}>+</button>
                                </div>
                              </div>
                            )}

                            {/* Planning */}
                            <div className="ws-form-block">
                              <div className="ws-section-header">Planning pour votre demande</div>
                              <div className="ws-planning-grid">
                                <div className="ws-planning-col">
                                  <label className="ws-planning-radio-label">
                                    <input type="radio" name="schedulingType" value="fixed" checked={editFormData.scheduling_type === 'fixed'} onChange={e => setEditFormData({ ...editFormData, scheduling_type: e.target.value })} />
                                    <span>Heure fixe</span>
                                  </label>
                                  <input type="time" value={editFormData.heure} onChange={e => setEditFormData({ ...editFormData, heure: e.target.value })} disabled={editFormData.scheduling_type !== 'fixed'} style={{ width: '120px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px' }} />
                                </div>
                                <div className="ws-planning-col">
                                  <label className="ws-planning-radio-label">
                                    <input type="radio" name="schedulingType" value="flexible" checked={editFormData.scheduling_type === 'flexible'} onChange={e => setEditFormData({ ...editFormData, scheduling_type: e.target.value })} />
                                    <span>Je suis flexible</span>
                                  </label>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                                      <input type="radio" name="timePref" value="matin" checked={editFormData.preference_horaire === 'matin'} onChange={() => setEditFormData({ ...editFormData, preference_horaire: 'matin' })} disabled={editFormData.scheduling_type !== 'flexible'} style={{ accentColor: 'var(--primary)' }} />
                                      Le matin
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                                      <input type="radio" name="timePref" value="apres_midi" checked={editFormData.preference_horaire === 'apres_midi'} onChange={() => setEditFormData({ ...editFormData, preference_horaire: 'apres_midi' })} disabled={editFormData.scheduling_type !== 'flexible'} style={{ accentColor: 'var(--primary)' }} />
                                      L'après-midi
                                    </label>
                                  </div>
                                </div>
                                <div className="ws-planning-col">
                                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>Date</div>
                                  <input type="date" required value={editFormData.date} onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} style={{ padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }} />
                                </div>
                              </div>
                            </div>

                            {/* Services optionnels */}
                            {isCleaningService && !isFinChantierService && (
                              <div className="ws-form-block">
                                <div className="ws-section-header">Services optionnels</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem' }}>
                                  <div className="optional-service-card">
                                    <div className="optional-service-info">
                                      <span className="text-2xl">🧴</span>
                                      <span>Produits de nettoyage (+90 MAD)</span>
                                    </div>
                                    <label className="toggle-switch">
                                      <input type="checkbox" checked={editFormData.produits} onChange={e => setEditFormData({ ...editFormData, produits: e.target.checked })} />
                                      <span className="toggle-slider"></span>
                                    </label>
                                  </div>
                                  <div className="optional-service-card">
                                    <div className="optional-service-info">
                                      <span className="text-2xl">🧹</span>
                                      <span>Torchons et serpillères (+40 MAD)</span>
                                    </div>
                                    <label className="toggle-switch">
                                      <input type="checkbox" checked={editFormData.torchons} onChange={e => setEditFormData({ ...editFormData, torchons: e.target.checked })} />
                                      <span className="toggle-slider"></span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* ====== LOCALISATION (all services) ====== */}
                        <div className="ws-form-block">
                          <div className="ws-section-header">Où aura lieu votre {isCleaningService ? 'ménage' : 'intervention'} ?</div>
                          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                            <div className="form-group">
                              <label className="label-teal">Ville *</label>
                              <select className="ws-select" required value={editFormData.ville} onChange={e => setEditFormData({ ...editFormData, ville: e.target.value, quartier: '' })}>
                                {['Casablanca', 'Rabat', 'Bouskoura', 'Dar Bouazza', 'Mansouria', 'Almaz', 'Sidi Rahal', 'Benslimane', 'Mohammédia', 'Ville Verte'].map(c => (
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
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: selectedDemande?.statut === 'annule' ? '#E53E3E' : selectedDemande?.statut === 'termine' ? '#2F855A' : selectedDemande?.statut === 'en_cours' ? (selectedDemande?.cao ? '#2F855A' : '#3B82F6') : selectedDemande?.statut === 'pres_en_cours' ? '#8B5CF6' : selectedDemande?.statut === 'pres_terminee' ? '#ED8936' : '#3B82F6' }} />
                              <span style={{ color: '#0F766E' }}>{selectedDemande?.statut === 'en_cours' ? (selectedDemande?.cao ? 'Confirmé' : 'Nouveau besoin') : selectedDemande?.statut === 'termine' ? 'Terminé' : selectedDemande?.statut === 'annule' ? 'Annulé' : selectedDemande?.statut === 'pres_en_cours' ? 'Pres. en cours' : selectedDemande?.statut === 'pres_terminee' ? 'Pres. terminée' : 'Nouveau besoin'}</span>
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Segment</label>
                            <select value={editFormData.segment} onChange={e => { const ns = e.target.value as keyof typeof SERVICES_LIST; const svcs = SERVICES_LIST[ns] || []; setEditFormData({ ...editFormData, segment: ns, service: svcs.includes(editFormData.service) ? editFormData.service : (svcs[0] || '') }); }} className="edit-input">
                              <option value="particulier">Particulier</option>
                              <option value="entreprise">Entreprise</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Type de service</label>
                            <select value={editFormData.service} onChange={e => setEditFormData({ ...editFormData, service: e.target.value })} className="edit-input">
                              {(SERVICES_LIST[editFormData.segment as keyof typeof SERVICES_LIST] || []).map(s => (<option key={s} value={s}>{s}</option>))}
                            </select>
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
                            <input type="number" value={editFormData.montant_ht} onChange={e => setEditFormData({ ...editFormData, montant_ht: e.target.value })} className="edit-input" />
                          </div>
                          <div className="form-group">
                            <label>TVA (20%)</label>
                            <label className="switch-inline"><label className="switch"><input type="checkbox" checked={Boolean(editFormData.tva_active)} onChange={e => setEditFormData({ ...editFormData, tva_active: e.target.checked })} /><span className="slider round" /></label><span>{editFormData.tva_active ? 'Oui' : 'Non'}</span></label>
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
                              <option value="">Choisir...</option><option value="virement">Virement</option><option value="cheque">Par chèque</option><option value="agence">À l'agence</option><option value="sur_place">Sur place</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Statut de paiement</label>
                            <select value={editFormData.statut_paiement_ui || getPaymentUiValue(editFormData.statut_paiement || 'non_paye', Boolean(editFormData.facturation_annulee))} onChange={e => {
                              const v = e.target.value;
                              const updates: any = { ...editFormData, statut_paiement_ui: v, facturation_annulee: v === 'facturation_annulee' };
                              // Auto-set encaisse_par based on payment status
                              if (v === 'agence_payee_client' || v === 'paye') updates.encaisse_par = 'agence';
                              else if (v === 'profil_paye_client') updates.encaisse_par = 'profil';
                              setEditFormData(updates);
                            }} className="edit-input">
                              {PAYMENT_STATUS_OPTIONS.map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Montant versé (MAD)</label>
                            <input type="number" value={editFormData.montant_verse} onChange={e => setEditFormData({ ...editFormData, montant_verse: e.target.value })} className="edit-input" />
                            {toNumber(montantTTC) > 0 && toNumber(editFormData.montant_verse) > 0 && (toNumber(montantTTC) - toNumber(editFormData.montant_verse)) > 0 && (
                              <p style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600, marginTop: '4px' }}>Reste à payer : {(toNumber(montantTTC) - toNumber(editFormData.montant_verse)).toFixed(2)} MAD</p>
                            )}
                          </div>
                        </div>

                        {editFormData.statut_paiement_ui === 'profil_paye_client' && (
                          <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', border: '1px solid #FECACA', background: '#FEF2F2' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#B91C1C', margin: '0 0 8px' }}>Profil doit</h4>
                            <div className="form-group mb-0" style={{ maxWidth: '280px' }}>
                              <label style={{ color: '#B91C1C' }}>Montant (MAD)</label>
                              <input type="number" value={editFormData.montant_profil_doit_agence || ''} onChange={e => {
                                const val = toNumber(e.target.value);
                                // Auto-dispatch: profil doit = part_agence, profil part = TTC - part_agence
                                const nextParts = partsRepartition.length > 0 ? partsRepartition.map((p, i) => i === 0 ? { ...p, amount: roundMoney(montantTTC - val) } : p) : partsRepartition;
                                setEditFormData({ ...editFormData, montant_profil_doit_agence: e.target.value, part_agence: val, parts_repartition: nextParts });
                              }} className="edit-input" placeholder="0" style={{ borderColor: '#FECACA', color: '#B91C1C', fontWeight: 600 }} />
                            </div>
                          </div>
                        )}

                        {editFormData.statut_paiement_ui === 'agence_payee_client' && (
                          <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', border: '1px solid #FED7AA', background: '#FFF7ED' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#C2410C', margin: '0 0 8px' }}>Agence doit</h4>
                            <div className="form-group mb-0" style={{ maxWidth: '280px' }}>
                              <label style={{ color: '#C2410C' }}>Montant (MAD)</label>
                              <input type="number" value={editFormData.montant_agence_doit_profil || ''} onChange={e => {
                                const val = toNumber(e.target.value);
                                // Auto-dispatch: agence doit = profil part, agence part = TTC - profil part
                                const nextParts = partsRepartition.length > 0 ? partsRepartition.map((p, i) => i === 0 ? { ...p, amount: val } : p) : partsRepartition;
                                setEditFormData({ ...editFormData, montant_agence_doit_profil: e.target.value, part_agence: roundMoney(montantTTC - val), parts_repartition: nextParts });
                              }} className="edit-input" placeholder="0" style={{ borderColor: '#FED7AA', color: '#C2410C', fontWeight: 600 }} />
                            </div>
                          </div>
                        )}

                        {editFormData.statut_paiement_ui === 'paye' && (
                          <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '10px', border: '1px solid #A7F3D0', background: '#ECFDF5' }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#047857', margin: 0 }}>✓ Paiement complet — la demande sera retirée du tableau de bord</p>
                          </div>
                        )}

                        {editFormData.statut_paiement_ui !== 'facturation_annulee' && (
                          <div style={{ marginTop: '16px' }}>
                            <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #FDA4AF', color: '#BE123C', background: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} onClick={() => setEditFormData({ ...editFormData, facturation_annulee: true, statut_paiement_ui: 'facturation_annulee' })}>
                              <XCircle size={14} /> Facturation annulée
                            </button>
                          </div>
                        )}

                        {editFormData.statut_paiement_ui === 'facturation_annulee' && (
                          <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', border: '1px solid #FECDD3', background: '#FFF1F2' }}>
                            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#BE123C', display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 12px' }}><XCircle size={14} /> Facturation annulée</h4>
                            <div className="form-group">
                              <label style={{ color: '#BE123C' }}>Raison de l'annulation</label>
                              <textarea value={editFormData.annulation_raison || ''} onChange={e => setEditFormData({ ...editFormData, annulation_raison: e.target.value })} className="edit-input w-full" placeholder="Indiquer la raison de l'annulation..." style={{ borderColor: '#FECDD3' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                              <label style={{ color: '#BE123C', fontWeight: 600, fontSize: '13px' }}>Le profil sera payé ?</label>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" onClick={() => setEditFormData({ ...editFormData, profil_sera_paye: true })} style={{ padding: '4px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: editFormData.profil_sera_paye ? '#059669' : '#E2E8F0', color: editFormData.profil_sera_paye ? 'white' : '#64748B' }}>Oui</button>
                                <button type="button" onClick={() => setEditFormData({ ...editFormData, profil_sera_paye: false })} style={{ padding: '4px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: !editFormData.profil_sera_paye ? '#BE123C' : '#E2E8F0', color: !editFormData.profil_sera_paye ? 'white' : '#64748B' }}>Non</button>
                              </div>
                            </div>
                            {editFormData.profil_sera_paye && (
                              <div className="form-group" style={{ marginTop: '12px', maxWidth: '280px' }}>
                                <label style={{ color: '#BE123C' }}>Montant à payer au profil (MAD)</label>
                                <input type="number" value={editFormData.montant_profil_annulation || ''} onChange={e => setEditFormData({ ...editFormData, montant_profil_annulation: e.target.value })} className="edit-input" placeholder="0" style={{ borderColor: '#FECDD3' }} />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Gestion des parts ── */}
                      <div>
                        <button type="button" onClick={() => setShowPartsSection(!showPartsSection)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 16px', borderRadius: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', marginBottom: '12px', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><UserCheck size={18} style={{ color: '#059669' }} /><span style={{ fontSize: '16px', fontWeight: 700, color: '#047857' }}>Gestion des parts</span></div>
                          {showPartsSection ? <ChevronUp size={16} style={{ color: '#059669' }} /> : <ChevronDown size={16} style={{ color: '#059669' }} />}
                        </button>
                        {showPartsSection && (<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div className="form-grid-2 gap-4">
                            <div className="form-group"><label>Montant total TTC (MAD)</label><div style={{ padding: '0 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', height: '38px', fontSize: '14px', fontWeight: 600 }}>{montantTTC.toFixed(2)}</div></div>
                            <div className="form-group"><label>Part de l'agence (MAD)</label><input type="number" value={editFormData.part_agence} onChange={e => setEditFormData({ ...editFormData, part_agence: e.target.value })} className="edit-input" /></div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Profils intervenants</span>
                              <button type="button" onClick={() => setEditFormData({ ...editFormData, parts_repartition: [...partsRepartition, { profile_id: '', amount: 0, is_delegate: false }] })} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: 'white', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}><Plus size={14} /> Ajouter un autre profil</button>
                            </div>
                            {partsRepartition.map((line, idx) => (
                              <div key={`${line.profile_id}-${idx}`} style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>Nom du profil{line.is_delegate && partsRepartition.length > 1 && <span style={{ fontSize: '10px', fontWeight: 600, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '4px', padding: '1px 6px' }}>Délégué</span>}</label>
                                    <select value={line.profile_id} onChange={e => { const next = [...partsRepartition]; next[idx] = { ...line, profile_id: e.target.value ? parseInt(e.target.value, 10) : '' }; setEditFormData({ ...editFormData, parts_repartition: next }); }} className="edit-input">
                                      <option value="">Sélectionner un profil...</option>
                                      {allProfils.map(p => (<option key={p.id} value={p.id}>{p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Profil #${p.id}`}</option>))}
                                    </select>
                                </div>
                                <div style={{ width: '120px' }}>
                                  <label style={{ fontSize: '12px' }}>Part (MAD)</label>
                                  <input type="number" value={line.amount} onChange={e => { const next = [...partsRepartition]; next[idx] = { ...line, amount: toNumber(e.target.value) }; if (editFormData.encaisse_par === 'profil') { const tp = next.reduce((a, p) => a + toNumber(p.amount), 0); setEditFormData({ ...editFormData, parts_repartition: next, part_agence: roundMoney(toNumber(montantTTC) - tp) }); } else { setEditFormData({ ...editFormData, parts_repartition: next }); } }} className="edit-input" />
                                </div>
                                {partsRepartition.length > 1 && <button type="button" onClick={() => { const next = partsRepartition.map((p, i) => ({ ...p, is_delegate: i === idx ? !p.is_delegate : false })); setEditFormData({ ...editFormData, parts_repartition: next }); }} style={{ height: '38px', padding: '0 12px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', background: line.is_delegate ? '#F59E0B' : '#F1F5F9', color: line.is_delegate ? 'white' : '#64748B' }} title="Désigner comme délégué"><UserCheck size={16} />{line.is_delegate ? 'Délégué' : 'Désigner'}</button>}
                                {partsRepartition.length > 1 && <button type="button" onClick={() => { const f = partsRepartition.filter((_, i) => i !== idx); if (!f.some(p => p.is_delegate) && f.length > 0) f[0] = { ...f[0], is_delegate: true }; setEditFormData({ ...editFormData, parts_repartition: f }); }} style={{ height: '38px', width: '38px', borderRadius: '8px', border: 'none', background: 'transparent', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={16} /></button>}
                              </div>
                            ))}
                          </div>
                          {(() => { const tp = partsRepartition.reduce((a, p) => a + toNumber(p.amount), 0); const tr = tp + toNumber(editFormData.part_agence); const r = toNumber(montantTTC) - tr; const ok = Math.abs(r) < 0.01; return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${ok ? '#A7F3D0' : '#FECACA'}`, background: ok ? '#ECFDF5' : '#FEF2F2' }}>
                              <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}><span>Total réparti : <strong>{tr.toFixed(2)} MAD</strong></span><span>Reste à répartir : <strong style={{ color: ok ? '#059669' : '#DC2626' }}>{r.toFixed(2)} MAD</strong></span></div>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: ok ? '#059669' : '#DC2626' }}>{ok ? '✓ Répartition correcte' : '⚠ Répartition incorrecte'}</span>
                            </div>); })()}
                        </div>)}
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
                                  <p className="history-meta">{log.user_name || 'Système'}</p>
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
                </div>
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
                      <div className="detail-item"><span>Email:</span> {selectedDemande.client_details?.email || '—'}</div>
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
                      <div className="detail-item"><span>Avec produit:</span> {selectedDemande.avec_produit ? `Oui (${selectedDemande.tarif_produit} MAD)` : 'Non'}</div>
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

    </div>
  );
}

