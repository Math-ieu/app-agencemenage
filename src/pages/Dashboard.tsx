import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RefreshCw, ClipboardCheck, Building2, Clock, Search, List, Grid, MoreVertical, Edit2, Settings,
  CheckCircle, UserCheck, MessageSquare, AlertTriangle,
  Check, ChevronLeft, ChevronUp, ChevronDown, FileText, ClipboardList, UserPlus, Eye, Download, Send, Save, XCircle, Calendar, Trash2, Plus, Pencil
} from 'lucide-react';

import { Demande, User } from '../types';
import { getDemandes, updateDemande, annulerDemande, confirmerCAO, getUsers, affecterDemande, generateDocument, fetchSecureDocBlob, deleteDemande, sendWhatsApp, getAuditLogs } from '../api/client';
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
  const [stats, setStats] = useState<DashboardStats>({ en_cours: 0, en_cours_particulier: 0, en_cours_entreprise: 0, en_attente: 0 });
  const [clientDemandeCounts, setClientDemandeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'besoins' | 'abonnements'>('besoins');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showNoteModal, setShowNoteModal] = useState<{ demandeId: number; type: 'commercial' | 'operationnel'; note: string } | null>(null);
  const [showCAOModal, setShowCAOModal] = useState<Demande | null>(null);
  const [caoDecision, setCaoDecision] = useState<'confirmed' | 'postponed' | 'cancelled' | null>(null);
  const [caoCancelReason, setCaoCancelReason] = useState('');
  const [caoPostponedDate, setCaoPostponedDate] = useState('');
  const [caoNote, setCaoNote] = useState('');
  const [caoMenuOpen, setCaoMenuOpen] = useState(false);
  const [sendingCaoWhatsApp, setSendingCaoWhatsApp] = useState(false);
  const [caoPreviewIndex, setCaoPreviewIndex] = useState(0);

  // Filtres
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('tous');
  const [prestationFilter, setPrestationFilter] = useState('toutes');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});

  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string, type: 'devis' | 'png', name: string, demandeId: number } | null>(null);
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

  const handlePreviewDocument = async (type: 'devis' | 'png') => {
    if (!selectedDemande) return;
    try {
      addToast(`Génération du ${type === 'devis' ? 'devis' : 'récapitulatif'} sur le serveur...`, 'info');
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
  const [isAgencyExpanded, setIsAgencyExpanded] = useState(true);
  const [showPartsSection, setShowPartsSection] = useState(true);
  const [showHistorySection, setShowHistorySection] = useState(true);
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
      const response = await getDemandes();
      const data = response.data;
      const allResults: Demande[] = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);

      const enAttenteList = allResults.filter(d => d.statut === 'en_attente');
      const results = allResults.filter(d => d.statut !== 'en_attente' && d.statut !== 'annule');
      setDemandes(results);

      const enCours = results.filter(d => d.statut === 'en_cours');
      const enCoursParticulier = enCours.filter(d => d.segment === 'particulier').length;
      const enCoursEntreprise = enCours.filter(d => d.segment === 'entreprise').length;

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
    setCaoDecision(null);
    setCaoCancelReason('');
    setCaoPostponedDate((demande.date_intervention || '').slice(0, 10));
    setCaoNote(demande.note_operationnel || '');
    setCaoMenuOpen(false);
    setCaoPreviewIndex(0);
  };

  const closeCAOModal = () => {
    setShowCAOModal(null);
    setCaoDecision(null);
    setCaoCancelReason('');
    setCaoPostponedDate('');
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
        date_intervention: editFormData.date_intervention || null,
        heure_intervention: editFormData.heure_intervention || '',
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
        produits: Boolean(editFormData.avec_produit),
        torchons: Boolean(editFormData.avec_torchons),
        rooms: editFormData.rooms || previousFormData.rooms || {},
        service_type: editFormData.service_type || '',
        structure_type: editFormData.structure_type || '',
        nb_personnel: parseInt(editFormData.nb_personnel) || 1,
        lieu_garde: editFormData.lieu_garde || 'domicile',
        age_personne: editFormData.age_personne || '',
        sexe_personne: editFormData.sexe_personne || '',
        mobilite: editFormData.mobilite || '',
        situation_medicale: editFormData.situation_medicale || '',
        nb_jours: parseInt(editFormData.nb_jours) || 1,
        additionalServices: {
          ...previousAdditional,
          produitsEtOutils: Boolean(editFormData.avec_produit),
          torchonsEtSerpierres: Boolean(editFormData.avec_torchons),
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
          part_agence: partAgence,
          parts_repartition: partsRepartition,
          // New fields
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

      updateData.avec_produit = Boolean(editFormData.avec_produit);

      const response = await updateDemande(selectedDemande.id, updateData);

      // Automated Action: Satisfaction WhatsApp
      if (triggerSatisfactionWhatsApp) {
        try {
          const clientPhone = editFormData.client_whatsapp || editFormData.client_phone || previousFormData.whatsapp_phone;
          if (clientPhone) {
            await sendWhatsApp(selectedDemande.id, 'feedback'); 
            addToast('Lien de satisfaction envoyé au client via WhatsApp', 'success');
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
      parts_repartition: asArray<PartRepartitionItem>(facturationData.parts_repartition || formData.parts_repartition, []),
      mode_paiement: d.mode_paiement,
      statut_paiement: d.statut_paiement,
      statut_paiement_ui: paymentUiValue,
      nb_heures: d.nb_heures || d.formulaire_data?.duree || d.formulaire_data?.nb_heures || '',
      duree: formData.duree || d.nb_heures || formData.duration || '',
      date_intervention: d.date_intervention,
      heure_intervention: d.heure_intervention || '',
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
      avec_produit: d.avec_produit || false,
      avec_torchons: formData.torchons || false,
      lieu_garde: formData.lieu_garde || 'domicile',
      age_personne: formData.age_personne || '',
      sexe_personne: normalizeSexe(formData.sexe_personne || ''),
      mobilite: normalizeMobilite(formData.mobilite || ''),
      situation_medicale: formData.situation_medicale || '',
      nb_jours: formData.nb_jours || 1,
      regenerer_devis: false,
      envoyer_whatsapp: false
    });
    setIsFormExpanded(true);
    setIsAgencyExpanded(true);
    setShowPartsSection(true);
    setShowHistorySection(true);
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

  const normalizedEditService = (editFormData.service || selectedDemande?.service || '').toString().toLowerCase();
  const isMenageService = normalizedEditService.includes('menage') || normalizedEditService.includes('ménage') || normalizedEditService.includes('nettoyage');
  const isStandardService = normalizedEditService.includes('ménage standard') || normalizedEditService.includes('menage standard');
  const isPlacementService = normalizedEditService.includes('placement');
  const isCareService = normalizedEditService.includes('auxiliaire') || normalizedEditService.includes('garde');

  const montantHT = toNumber(editFormData.montant_ht ?? editFormData.prix);
  const montantTTC = roundMoney(editFormData.tva_active ? montantHT * 1.2 : montantHT);
// const montantVerse = toNumber(editFormData.montant_verse);
  const montantProfilDoit = toNumber(editFormData.montant_profil_doit);

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
            setTimeout(() => setBlinkNouveau(false), 3000);
          }}
        >
          <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><ClipboardCheck size={22} /></div>
          <div>
            <p className="stat-value">{stats.en_cours}</p>
            <p className="stat-label">Demandes en cours</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {stats.en_cours_particulier} particulier(s) - {stats.en_cours_entreprise} entreprise(s)
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
                        <span className={`badge ${
                          d.statut === 'en_cours' ? (d.cao ? 'badge-green' : 'badge-nouveau') : 
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
                        <span className={`badge ${['paye', 'integral'].includes(d.statut_paiement) ? 'badge-green' : d.statut_paiement === 'partiel' ? 'badge-orange' : 'badge-red'}`}>
                          {d.statut_paiement_label || d.statut_paiement || 'Non payé'}
                        </span>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>
                        {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                      </span>
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
                    <span className={`badge ${
                      d.statut === 'en_cours' ? 'badge-nouveau' : 
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
                        <div className="form-grid-2 gap-4 mb-4">
                          <div className="form-group">
                            <label>Date d'intervention</label>
                            <input type="date" value={editFormData.date_intervention} onChange={e => setEditFormData({ ...editFormData, date_intervention: e.target.value })} className="edit-input" />
                          </div>
                          <div className="form-group">
                            <label>Heure</label>
                            <input type="time" value={editFormData.heure_intervention} onChange={e => setEditFormData({ ...editFormData, heure_intervention: e.target.value })} className="edit-input" />
                          </div>
                        </div>

                        <div className="form-grid-3 gap-4 mb-4">
                          <div className="form-group">
                            <label>Préférence horaire</label>
                            <select
                              value={editFormData.preference_horaire}
                              onChange={e => setEditFormData({ ...editFormData, preference_horaire: e.target.value })}
                              className="edit-input"
                            >
                              <option value="">Choisir...</option>
                              <option value="matin">Matin (08h - 12h)</option>
                              <option value="apres_midi">Après-midi (14h - 18h)</option>
                              <option value="soir">Soir (après 18h)</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Fréquence</label>
                            <select
                              value={editFormData.frequence}
                              onChange={e => setEditFormData({ ...editFormData, frequence: e.target.value })}
                              className="edit-input"
                            >
                              <option value="une fois">Une fois</option>
                              <option value="1/sem">Abonnement - 1 fois / semaine</option>
                              <option value="2/sem">Abonnement - 2 fois / semaine</option>
                              <option value="3/sem">Abonnement - 3 fois / semaine</option>
                              <option value="1/mois">Abonnement - 1 fois / mois</option>
                              <option value="quotidien">Abonnement - Quotidien</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Durée (heures)</label>
                            <input
                              type="number"
                              min={1}
                              value={editFormData.duree}
                              onChange={e => setEditFormData({ ...editFormData, duree: parseInt(e.target.value) || 0 })}
                              className="edit-input"
                            />
                          </div>
                        </div>

                        {isMenageService && (
                          <>
                            <div className="form-grid-3 gap-4 mb-4">
                              <div className="form-group">
                                <label>Type d'habitation</label>
                                <select
                                  value={editFormData.type_habitation}
                                  onChange={e => setEditFormData({ ...editFormData, type_habitation: e.target.value })}
                                  className="edit-input"
                                >
                                  <option value="">Choisir...</option>
                                  <option value="Studio">Studio</option>
                                  <option value="Appartement">Appartement</option>
                                  <option value="Duplex">Duplex</option>
                                  <option value="Villa">Villa</option>
                                  <option value="Maison">Maison</option>
                                  <option value="Bureau">Bureau</option>
                                  <option value="Magasin">Magasin</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Nb intervenants</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={editFormData.nb_intervenants}
                                  onChange={e => setEditFormData({ ...editFormData, nb_intervenants: parseInt(e.target.value) || 1 })}
                                  className="edit-input"
                                />
                              </div>
                              <div className="form-group">
                                <label>Surface (m²)</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={editFormData.surface}
                                  onChange={e => setEditFormData({ ...editFormData, surface: parseInt(e.target.value) || 0 })}
                                  className="edit-input"
                                />
                              </div>
                            </div>

                            {isStandardService && (
                              <div className="form-group mb-4">
                                <label>Détails des pièces</label>
                                <div className="rooms-grid">
                                  {Object.entries(editFormData.rooms || {}).map(([roomKey, roomValue]) => (
                                    <div key={roomKey} className="room-counter-item">
                                      <span>{roomKey.replace(/([A-Z])/g, ' $1')}</span>
                                      <div className="room-counter-actions">
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => setEditFormData({
                                            ...editFormData,
                                            rooms: {
                                              ...editFormData.rooms,
                                              [roomKey]: Math.max(0, toNumber(roomValue) - 1),
                                            },
                                          })}
                                        >
                                          -
                                        </button>
                                        <span>{toNumber(roomValue)}</span>
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
                                          onClick={() => setEditFormData({
                                            ...editFormData,
                                            rooms: {
                                              ...editFormData.rooms,
                                              [roomKey]: toNumber(roomValue) + 1,
                                            },
                                          })}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="form-group mb-4">
                              <label>Détails additionnels</label>
                              <textarea
                                value={editFormData.details_pieces || ''}
                                onChange={e => setEditFormData({ ...editFormData, details_pieces: e.target.value })}
                                className="edit-textarea"
                                rows={3}
                                placeholder="Précisions sur l'état des lieux, accès, fragilités..."
                              />
                            </div>

                            <div className="optional-services-panel mb-4">
                              <label className="switch-row optional-service-row">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editFormData.avec_produit)}
                                  onChange={e => setEditFormData({ ...editFormData, avec_produit: e.target.checked })}
                                />
                                <span>Produits (+90 MAD)</span>
                              </label>
                              <label className="switch-row optional-service-row">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editFormData.avec_torchons)}
                                  onChange={e => setEditFormData({ ...editFormData, avec_torchons: e.target.checked })}
                                />
                                <span>Torchons (+40 MAD)</span>
                              </label>
                            </div>
                          </>
                        )}

                        {isPlacementService && (
                          <div className="form-grid-3 gap-4 mb-4">
                            <div className="form-group">
                              <label>Type de service</label>
                              <select value={editFormData.service_type} onChange={e => setEditFormData({ ...editFormData, service_type: e.target.value })} className="edit-input">
                                <option value="flexible">Service ménage flexible</option>
                                <option value="premium">Service ménage premium</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Type de structure</label>
                              <input value={editFormData.structure_type} onChange={e => setEditFormData({ ...editFormData, structure_type: e.target.value })} className="edit-input" />
                            </div>
                            <div className="form-group">
                              <label>Nombre de personnel</label>
                              <input type="number" min={1} value={editFormData.nb_personnel} onChange={e => setEditFormData({ ...editFormData, nb_personnel: parseInt(e.target.value) || 1 })} className="edit-input" />
                            </div>
                          </div>
                        )}

                        {isCareService && (
                          <>
                            <div className="form-grid-3 gap-4 mb-4">
                              <div className="form-group">
                                <label>Lieu de la garde</label>
                                <select value={editFormData.lieu_garde} onChange={e => setEditFormData({ ...editFormData, lieu_garde: e.target.value })} className="edit-input">
                                  <option value="domicile">Domicile</option>
                                  <option value="clinique">Clinique</option>
                                  <option value="hopital">Hôpital</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Nombre de jours</label>
                                <input type="number" min={1} value={editFormData.nb_jours} onChange={e => setEditFormData({ ...editFormData, nb_jours: parseInt(e.target.value) || 1 })} className="edit-input" />
                              </div>
                              <div className="form-group">
                                <label>Âge de la personne</label>
                                <input value={editFormData.age_personne} onChange={e => setEditFormData({ ...editFormData, age_personne: e.target.value })} className="edit-input" />
                              </div>
                            </div>

                            <div className="form-grid-2 gap-4 mb-4">
                              <div className="form-group">
                                <label>Sexe</label>
                                <select value={editFormData.sexe_personne} onChange={e => setEditFormData({ ...editFormData, sexe_personne: e.target.value })} className="edit-input">
                                  <option value="">Choisir...</option>
                                  <option value="femme">Femme</option>
                                  <option value="homme">Homme</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Mobilité</label>
                                <select value={editFormData.mobilite} onChange={e => setEditFormData({ ...editFormData, mobilite: e.target.value })} className="edit-input">
                                  <option value="">Choisir...</option>
                                  <option value="autonome">Autonome</option>
                                  <option value="besoin_aide">Besoin d'aide</option>
                                  <option value="alitee">Alité(e)</option>
                                </select>
                              </div>
                            </div>

                            <div className="form-group mb-4">
                              <label>Situation médicale</label>
                              <textarea
                                value={editFormData.situation_medicale || ''}
                                onChange={e => setEditFormData({ ...editFormData, situation_medicale: e.target.value })}
                                className="edit-textarea"
                                rows={3}
                              />
                            </div>
                          </>
                        )}

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

                    {isAgencyExpanded && <div className="form-section-content">
                      <div className="agency-block agency-block-besoin">
                        <h4>Besoin</h4>
                        <div className="form-grid-3 gap-4">
                          <div className="form-group">
                            <label>Statut du besoin</label>
                            <select value={editFormData.statut} onChange={e => setEditFormData({ ...editFormData, statut: e.target.value })} className="edit-input">
                              <option value="en_attente">Nouveau besoin</option>
                              <option value="en_cours">Nouveau besoin</option>
                              <option value="termine">Terminé</option>
                              <option value="annule">Annulé</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Segment</label>
                            <select
                              value={editFormData.segment}
                              onChange={e => {
                                const newSegment = e.target.value as keyof typeof SERVICES_LIST;
                                const services = SERVICES_LIST[newSegment] || [];
                                setEditFormData({
                                  ...editFormData,
                                  segment: newSegment,
                                  service: services.includes(editFormData.service) ? editFormData.service : (services[0] || ''),
                                });
                              }}
                              className="edit-input"
                            >
                              <option value="particulier">Particulier</option>
                              <option value="entreprise">Entreprise</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Type de service</label>
                            <select value={editFormData.service} onChange={e => setEditFormData({ ...editFormData, service: e.target.value })} className="edit-input">
                              {(SERVICES_LIST[editFormData.segment as keyof typeof SERVICES_LIST] || []).map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="agency-block agency-block-facturation">
                        <h4>Facturation</h4>
                        <div className="form-grid-3 gap-4">
                          <div className="form-group">
                            <label>Montant HT (MAD)</label>
                            <input type="number" value={editFormData.montant_ht} onChange={e => setEditFormData({ ...editFormData, montant_ht: e.target.value })} className="edit-input" />
                          </div>
                          <div className="form-group">
                            <label>TVA (20%)</label>
                            <label className="switch-inline">
                              <label className="switch">
                                <input type="checkbox" checked={Boolean(editFormData.tva_active)} onChange={e => setEditFormData({ ...editFormData, tva_active: e.target.checked })} />
                                <span className="slider round"></span>
                              </label>
                              <span>{editFormData.tva_active ? 'Oui' : 'Non'}</span>
                            </label>
                          </div>
                          <div className="form-group">
                            <label>Montant TTC (MAD)</label>
                            <input type="text" readOnly value={montantTTC.toFixed(2)} className="edit-input" />
                          </div>
                        </div>

                        <div className="form-grid-3 gap-4">
                          <div className="form-group">
                            <label>Mode de paiement</label>
                            <select value={editFormData.mode_paiement} onChange={e => setEditFormData({ ...editFormData, mode_paiement: e.target.value })} className="edit-input">
                              <option value="">Choisir...</option>
                              <option value="virement">Virement</option>
                              <option value="cheque">Par chèque</option>
                              <option value="agence">À l'agence</option>
                              <option value="sur_place">Sur place</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Statut de paiement</label>
                            <select
                              value={editFormData.statut_paiement_ui || getPaymentUiValue(editFormData.statut_paiement || 'non_paye', Boolean(editFormData.facturation_annulee))}
                              onChange={e => {
                                const value = e.target.value;
                                setEditFormData({
                                  ...editFormData,
                                  statut_paiement_ui: value,
                                  facturation_annulee: value === 'facturation_annulee',
                                });
                              }}
                              className="edit-input"
                            >
                              {PAYMENT_STATUS_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Montant versé (MAD)</label>
                            <input type="number" value={editFormData.montant_verse} onChange={e => setEditFormData({ ...editFormData, montant_verse: e.target.value })} className="edit-input" />
                          </div>
                        </div>

                        {(editFormData.statut_paiement_ui === 'paiement_partiel' || (toNumber(montantTTC) - toNumber(editFormData.montant_verse)) > 0) && (
                          <div className="payment-alert-info">
                            <label>Reste à payer : </label>
                            <span className="text-red-500 font-bold ml-2">{(toNumber(montantTTC) - toNumber(editFormData.montant_verse)).toFixed(2)} MAD</span>
                          </div>
                        )}

                        {editFormData.statut_paiement_ui === 'facturation_annulee' && (
                          <div className="cancellation-block p-4 bg-red-50 rounded-xl border border-red-100 my-4">
                            <div className="form-group">
                              <label className="text-red-700">Raison de l'annulation</label>
                              <textarea 
                                value={editFormData.annulation_raison || ''} 
                                onChange={e => setEditFormData({ ...editFormData, annulation_raison: e.target.value })}
                                className="edit-input w-full"
                                placeholder="Indiquez la raison..."
                              />
                            </div>
                            <div className="flex items-center gap-4 mt-4">
                              <label className="text-red-700">Le profil sera payé ?</label>
                              <label className="switch">
                                <input 
                                  type="checkbox" 
                                  checked={Boolean(editFormData.profil_sera_paye)} 
                                  onChange={e => setEditFormData({ ...editFormData, profil_sera_paye: e.target.checked })} 
                                />
                                <span className="slider round"></span>
                              </label>
                              <span>{editFormData.profil_sera_paye ? 'Oui' : 'Non'}</span>
                            </div>
                            {editFormData.profil_sera_paye && (
                              <div className="form-group mt-4">
                                <label className="text-red-700">Montant à payer au profil (MAD)</label>
                                <input 
                                  type="number" 
                                  value={editFormData.montant_profil_annulation} 
                                  onChange={e => setEditFormData({ ...editFormData, montant_profil_annulation: e.target.value })} 
                                  className="edit-input"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {editFormData.statut_paiement_ui === 'agence_payee_client' && (
                          <div className="agency-alert-card bg-teal-50 border-teal-100 my-4">
                            <p className="text-teal-800 font-semibold mb-2">L'agence doit au profil</p>
                            <div className="form-group mb-0">
                              <label>Montant (MAD)</label>
                              <input 
                                type="number" 
                                value={editFormData.montant_agence_doit_profil} 
                                onChange={e => setEditFormData({ ...editFormData, montant_agence_doit_profil: e.target.value })} 
                                className="edit-input"
                                placeholder="Part du profil à reverser..."
                              />
                            </div>
                          </div>
                        )}

                        {editFormData.statut_paiement_ui === 'profil_paye_client' && (
                          <div className="agency-alert-card bg-orange-50 border-orange-100 my-4">
                            <p className="text-orange-800 font-semibold mb-2">Le profil doit à l'agence</p>
                            <div className="form-group mb-0">
                              <label>Montant (MAD)</label>
                              <input 
                                type="number" 
                                value={editFormData.montant_profil_doit_agence} 
                                onChange={e => setEditFormData({ ...editFormData, montant_profil_doit_agence: e.target.value })} 
                                className="edit-input"
                                placeholder="Part de l'agence à récupérer..."
                              />
                            </div>
                          </div>
                        )}

                        <div className="agency-alert-card">
                          <p>Profil doit (Général)</p>
                          <div className="form-group mb-0">
                            <label>Montant (MAD)</label>
                            <input type="number" value={montantProfilDoit} onChange={e => setEditFormData({ ...editFormData, montant_profil_doit: e.target.value })} className="edit-input" />
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`btn btn-secondary ${editFormData.facturation_annulee ? 'facturation-annulee-active' : ''}`}
                          onClick={() => setEditFormData({ 
                            ...editFormData, 
                            facturation_annulee: !editFormData.facturation_annulee,
                            statut_paiement_ui: !editFormData.facturation_annulee ? 'facturation_annulee' : 'non_confirme'
                          })}
                        >
                          <XCircle size={14} /> Facturation annulée
                        </button>
                      </div>

                      <div className="agency-block agency-block-parts">
                        <button type="button" className="agency-collapse-btn" onClick={() => setShowPartsSection(!showPartsSection)}>
                          <span>Gestion des parts</span>
                          {showPartsSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showPartsSection && (
                          <>
                            <div className="encaissement-selector flex gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                              <label className="text-sm font-medium">Qui a encaissé le client ?</label>
                              <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="encaisse_par" 
                                    checked={editFormData.encaisse_par === 'agence' || !editFormData.encaisse_par} 
                                    onChange={() => setEditFormData({ ...editFormData, encaisse_par: 'agence' })}
                                  />
                                  <span>L'Agence</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    name="encaisse_par" 
                                    checked={editFormData.encaisse_par === 'profil'} 
                                    onChange={() => setEditFormData({ ...editFormData, encaisse_par: 'profil' })}
                                  />
                                  <span>Le Profil</span>
                                </label>
                              </div>
                            </div>

                            <div className="form-grid-2 gap-4 mb-4">
                              <div className="form-group">
                                <label>Montant total TTC (MAD)</label>
                                <input type="text" readOnly value={montantTTC.toFixed(2)} className="edit-input" />
                              </div>
                              <div className="form-group">
                                <label>{editFormData.encaisse_par === 'profil' ? "Part de l'agence (Calculée)" : "Part de l'agence (MAD)"}</label>
                                <input 
                                  type="number" 
                                  value={editFormData.part_agence} 
                                  onChange={e => setEditFormData({ ...editFormData, part_agence: e.target.value })} 
                                  readOnly={editFormData.encaisse_par === 'profil'}
                                  className={`edit-input ${editFormData.encaisse_par === 'profil' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                />
                              </div>
                            </div>

                            <div className="parts-lines">
                              {partsRepartition.map((line, idx) => (
                                <div key={`${line.profile_id}-${idx}`} className="form-grid-4 gap-4 mb-3 items-end">
                                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label>Nom du profil</label>
                                    <select
                                      value={line.profile_id}
                                      onChange={e => {
                                        const next = [...partsRepartition];
                                        next[idx] = { ...line, profile_id: e.target.value ? parseInt(e.target.value, 10) : '' };
                                        setEditFormData({ ...editFormData, parts_repartition: next });
                                      }}
                                      className="edit-input"
                                    >
                                      <option value="">Sélectionner un profil...</option>
                                      {(selectedDemande?.profils_envoyes || []).map(profile => (
                                        <option key={profile.id} value={profile.id}>{profile.full_name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label>Part (MAD)</label>
                                    <input
                                      type="number"
                                      value={line.amount}
                                      onChange={e => {
                                        const next = [...partsRepartition];
                                        next[idx] = { ...line, amount: toNumber(e.target.value) };
                                        
                                        // Case 1 logic: if profile collected, agency part is TTC - sum(profile parts)
                                        if (editFormData.encaisse_par === 'profil') {
                                          const totalProfils = next.reduce((acc, p) => acc + toNumber(p.amount), 0);
                                          setEditFormData({ 
                                            ...editFormData, 
                                            parts_repartition: next,
                                            part_agence: roundMoney(toNumber(montantTTC) - totalProfils)
                                          });
                                        } else {
                                          setEditFormData({ ...editFormData, parts_repartition: next });
                                        }
                                      }}
                                      className="edit-input"
                                    />
                                  </div>
                                  <div className="form-group pb-2 flex flex-col items-center">
                                    <label className="text-[10px] uppercase text-gray-400 mb-1">Délégué</label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = partsRepartition.map((p, i) => ({
                                          ...p,
                                          is_delegate: i === idx ? !p.is_delegate : false
                                        }));
                                        setEditFormData({ ...editFormData, parts_repartition: next });
                                      }}
                                      className={`p-1 rounded-full transition-colors ${line.is_delegate ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}
                                      title="Désigner comme délégué"
                                    >
                                      <UserCheck size={18} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              className="btn btn-outline btn-sm w-full mb-4"
                              onClick={() => setEditFormData({
                                ...editFormData,
                                parts_repartition: [...partsRepartition, { profile_id: '', amount: 0, is_delegate: false }]
                              })}
                            >
                              <Plus size={14} /> Ajouter un profil
                            </button>

                            <div className="parts-summary p-3 bg-white rounded-lg border border-gray-100">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-medium">Somme des parts profils :</span>
                                <span className="text-sm font-bold text-gray-700">
                                  {partsRepartition.reduce((acc, p) => acc + toNumber(p.amount), 0).toFixed(2)} MAD
                                </span>
                              </div>
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-sm font-medium">Part de l'agence :</span>
                                <span className="text-sm font-bold text-gray-700">{toNumber(editFormData.part_agence).toFixed(2)} MAD</span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-sm font-bold">Total réparti :</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-black p-1 px-3 rounded-full ${
                                    Math.abs((partsRepartition.reduce((acc, p) => acc + toNumber(p.amount), 0) + toNumber(editFormData.part_agence)) - toNumber(montantTTC)) < 0.01
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {(partsRepartition.reduce((acc, p) => acc + toNumber(p.amount), 0) + toNumber(editFormData.part_agence)).toFixed(2)} MAD
                                  </span>
                                  {Math.abs((partsRepartition.reduce((acc, p) => acc + toNumber(p.amount), 0) + toNumber(editFormData.part_agence)) - toNumber(montantTTC)) < 0.01 
                                    ? <CheckCircle size={16} className="text-green-500" /> 
                                    : <XCircle size={16} className="text-red-500" />
                                  }
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="form-grid-2 gap-4 mb-4">
                        <div className="form-group">
                          <label>Note commercial</label>
                          <textarea value={editFormData.note_commercial} onChange={e => setEditFormData({ ...editFormData, note_commercial: e.target.value })} className="edit-textarea" rows={3} placeholder="Notes du commercial..." />
                        </div>
                        <div className="form-group">
                          <label>Note opération</label>
                          <textarea value={editFormData.note_operationnel} onChange={e => setEditFormData({ ...editFormData, note_operationnel: e.target.value })} className="edit-textarea" rows={3} placeholder="Notes opérationnelles..." />
                        </div>
                      </div>

                      <div className="whatsapp-toggle-card">
                        <div className="flex items-center gap-4">
                          <label className="switch">
                            <input type="checkbox" checked={editFormData.envoyer_whatsapp} onChange={e => setEditFormData({ ...editFormData, envoyer_whatsapp: e.target.checked, regenerer_devis: e.target.checked })} />
                            <span className="slider round"></span>
                          </label>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-teal-dark fw-bold">
                              <MessageSquare size={18} />
                              Régénérer le devis et renvoyer au client via WhatsApp
                            </div>
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
                      <div className="detail-item"><span>Statut:</span> {selectedDemande.statut_paiement_label || selectedDemande.statut_paiement}</div>
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
                <Eye size={24} className="text-teal-700" /> Aperçu — {showPreviewModal.type === 'devis' ? 'Devis' : 'Récapitulatif'}
              </h2>
              <button className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPreviewModal(null)}><XCircle size={20} /></button>
            </div>

            <div className="modal-body bg-slate-800 rounded-md border border-slate-700 shadow-inner" style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>
              {showPreviewModal.type === 'devis' ? (
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
              overflow: 'hidden',
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
                    display: caoMenuOpen ? 'block' : 'none', position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)',
                    backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', zIndex: 9999,
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
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                    Nouvelle date proposée
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
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280' }}>Le commercial sera alerté du changement de date.</p>
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

