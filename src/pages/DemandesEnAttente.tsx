import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDemandes, getDemande, validerDemande, annulerDemande, nrpDemande, createDemande, updateDemande, affecterDemande, getUsers, generateDocument, fetchSecureDocBlob, sendWhatsApp, confirmerClient, nouveauClient, uploadDocument } from '../api/client';
import { decodeId } from '../utils/obfuscation';
import { useNotificationStore, useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { checkPermission, hasPermission, isExemptFromOwnership } from '../utils/permissions';
import { generateDevisPdf } from '../lib/devis/generate-devis';
import {
  RefreshCw, Search, XCircle,
  Calendar,
  FileText, Save, Download, Eye, Plus, ChevronDown, ChevronUp, CheckCircle, Edit, UserPlus, Send,
  AlertTriangle, UserCheck
} from 'lucide-react';
import { Demande } from '../types';
import { normalizeFrequence, normalizePayment, normalizeStructure, normalizeTimePref, normalizeMobilite, normalizeSexe, normalizeQuartier } from '../utils/formNormalizers';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { useResourceEstimator } from '../hooks/useResourceEstimator';
import QuoteSection from '../components/demandes/quotes/QuoteSection';
import { DynamicServiceForm } from '../components/demandes/forms/DynamicServiceForm';

const isDevisRequired = (d: Demande | null) => {
  if (!d) return false;
  if (d.segment === 'entreprise') return true;
  if (d.formulaire_data?.is_autre_service) return true;
  const s = (d.service || '').toLowerCase();
  return s.includes('air bnb') || s.includes('airbnb') || 
         s.includes('sinistre') || s.includes('auxiliaire') || 
         s.includes('chantier') || s.includes('placement') || s.includes('gestion') ||
         s.includes('autre service') || s.includes('autre_service');
};

const normalizeServiceLabel = (value: string) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

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

// Workflow des statuts de devis (brief). Champ backend dédié Demande.devis_statut,
// indépendant du statut métier de la demande (Demande.statut reste inchangé).
const DEVIS_STATUTS: { value: string; label: string; cls: string }[] = [
  { value: 'brouillon', label: 'Brouillon', cls: 'bg-gray-100 text-gray-700 border border-gray-200' },
  { value: 'en_attente_validation', label: 'En attente validation', cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { value: 'valide', label: 'Validé', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  { value: 'envoye', label: 'Envoyé', cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  { value: 'accepte', label: 'Accepté', cls: 'bg-green-50 text-green-700 border border-green-200' },
  { value: 'refuse', label: 'Refusé / Expiré', cls: 'bg-red-50 text-red-700 border border-red-200' },
];
const getDevisStatutMeta = (value?: string) =>
  DEVIS_STATUTS.find(s => s.value === value) || DEVIS_STATUTS[0];
// Numéro de devis aligné sur le PDF (buildDevisNumber) : DEV-{année}-{id sur 4 chiffres}
const formatDevisNumber = (id: number) => `DEV-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`;

const isMobilityMatching = (value: string, option: string) => {
  if (!value || !option) return false;
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const v = clean(value);
  const o = clean(option);
  if (v === o) return true;
  if (v.includes('aide') && o.includes('aide')) return true;
  if ((v.includes('alite') || v.includes('alite(e)')) && (o.includes('alite') || o.includes('alite(e)'))) return true;
  if ((v.includes('age') || v.includes('personneage')) && (o.includes('age') || o.includes('personneage'))) return true;
  return false;
};

const strip212 = (p: string) => {
  if (!p) return '';
  let cleaned = p.trim().replace(/\s+/g, '');
  if (cleaned.startsWith('+212')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('212') && cleaned.length > 9) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
};

const canValidateDemande = (user: any, d: Demande) => {
  if (!user) return false;
  if (isExemptFromOwnership(user)) {
    return hasPermission(user, 'traiter_demandes_affectees') || hasPermission(user, 'creer_valider_demande');
  }
  if (d.created_by === user.id) {
    return hasPermission(user, 'creer_valider_demande');
  }
  if (d.assigned_to === user.id || d.assigned_to_operations === user.id) {
    return hasPermission(user, 'traiter_demandes_affectees');
  }
  return false;
};

const canModifyDemande = (user: any, d: Demande) => {
  if (!user) return false;
  if (isExemptFromOwnership(user)) {
    return hasPermission(user, 'modifier_demande') || hasPermission(user, 'editer_besoin');
  }
  const hasPerm = hasPermission(user, 'modifier_demande') || hasPermission(user, 'editer_besoin');
  const isConcerned = d.created_by === user.id || d.assigned_to === user.id || d.assigned_to_operations === user.id;
  return hasPerm && isConcerned;
};

const canRefuseDemande = (user: any, d: Demande) => {
  if (!user) return false;
  if (isExemptFromOwnership(user)) {
    return hasPermission(user, 'refuser_demande') || hasPermission(user, 'annulation_demande');
  }
  const hasPerm = hasPermission(user, 'refuser_demande') || hasPermission(user, 'annulation_demande');
  const isConcerned = d.created_by === user.id || d.assigned_to === user.id || d.assigned_to_operations === user.id;
  return hasPerm && isConcerned;
};


export default function DemandesEnAttente() {
  const location = useLocation();
  const navigate = useNavigate();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [prestation, setPrestation] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<number, Record<string, boolean>>>({});

  const [showNewMenu, setShowNewMenu] = useState(false);
  const [activeSegment, setActiveSegment] = useState<'particulier' | 'entreprise' | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [directPhone, setDirectPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [syncWhatsApp, setSyncWhatsApp] = useState(true);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [editingDemande, setEditingDemande] = useState<Demande | null>(null);
  const editingDemandeRef = useRef<Demande | null>(null);
  useEffect(() => {
    editingDemandeRef.current = editingDemande;
  }, [editingDemande]);
  const [isRenewal, setIsRenewal] = useState(false);
  const [showAnnulationModal, setShowAnnulationModal] = useState<{ demandeId: number; isSubscription?: boolean } | null>(null);
  const [annulationReason, setAnnulationReason] = useState('');

  // Nouveaux états pour le formulaire
  const [formData, setFormData] = useState({
    nom: '',
    email: '',
    entity_name: '',
    contact_person: '',
    ville: 'Casablanca',
    quartier: '',
    adresse: '',
    date: '',
    heure: '',
    scheduling_type: 'fixed',
    preference_horaire: '',
    type_habitation: '',
    frequence: '',
    intervention_nature: 'sinistre',
    accommodation_state: '',
    cleanliness_type: '',
    nb_intervenants: 1,
    surface: 50,
    details_pieces: '',
    duree: 4,
    produits: false,
    torchons: false,
    montant: '',
    mode_paiement: 'virement',
    statut_paiement_ui: 'non_confirme',
    heard_about_us: '',
    notes: '',
    // Champs spécifiques Grand Ménage
    // Champs spécifiques Placement & Gestion
    service_type: 'flexible',
    structure_type: '',
    nb_personnel: 1,
    // Champs spécifiques Auxiliaire de vie
    lieu_garde: 'domicile',
    age_personne: '',
    sexe_personne: '',
    mobilite: '',
    situation_medicale: '',
    nb_jours: 1,
    // Detailed rooms for Ménage Standard
    rooms: {
      cuisine: 0,
      suiteAvecBain: 0,
      suiteSansBain: 0,
      salleDeBain: 0,
      chambre: 0,
      salonMarocain: 0,
      salonEuropeen: 0,
      toilettesLavabo: 0,
      rooftop: 0,
      escalier: 0
    } as Record<string, number>,
    // AirBnB
    formula: 'A' as 'A' | 'B',
    size_tier: '1chambre',
    conso: false,
    linen_sets: 0,
    // Autre service
    custom_service_type: '',
    property_category: 'logement',
    property_subtype: 'Appartement',
    duration_unit: 'heures',
    description: '',
    amount_ht: 0,
    tva_active: true,
    quote_number: '',
    frequency_custom: '',
    options: [
      { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
      { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false },
      { key: "machines", label: "Machines et équipements (aspirateur, vapeur, etc.)", price: 0, enabled: false }
    ] as any[],
    vat_rate: 20,
    advance_required: false,
    advance_mode: 'percent',
    advance_percent: "" as number | "",
    advance_amount: 0,
    avance_paiement: 0,
    avance_active: false,
    avance_type: 'percent',
    avance_pourcentage: "" as number | "",
    avance_fixe: 0
  });

  const { user } = useAuthStore();
  const { setPendingCount } = useNotificationStore();
  const { addToast } = useToastStore();

  const [commerciaux, setCommerciaux] = useState<any[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState<number | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string, type: 'devis' | 'png', name: string, demandeId: number, mediaUrl?: string } | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const selectedServiceKey = normalizeServiceLabel(selectedService);
  const isAuxiliaireService = selectedServiceKey.includes('auxiliaire de vie');
  // @ts-ignore
  const isPlacementGestionService = selectedServiceKey.includes('placement & gestion') || selectedServiceKey.includes('placement et gestion');
  const isCleaningService = selectedServiceKey.includes('menage') || selectedServiceKey.includes('nettoyage');
  const isMenageBureauxService = selectedServiceKey.includes('menage bureaux');
  // @ts-ignore
  const isPostSinistreService = selectedServiceKey.includes('post-sinistre') || selectedServiceKey.includes('post sinistre');
  // @ts-ignore
  const isPostDemenagementService = selectedServiceKey.includes('post-demenagement') || selectedServiceKey.includes('post demenagement');
  // @ts-ignore
  const isMenageStandardService = selectedServiceKey.includes('menage standard');
  const isGrandMenageService = selectedServiceKey.includes('grand menage');
  // @ts-ignore
  const isMenageAirBnBService = selectedServiceKey.includes('air bnb') || selectedServiceKey.includes('airbnb');
  // @ts-ignore
  const isFinChantierService = selectedServiceKey.includes('fin de chantier') || selectedServiceKey.includes('fin chantier');
  // @ts-ignore
  const isAutreService = selectedServiceKey.includes('autre service') || selectedServiceKey.includes('autre_service');
  const minDuree = isGrandMenageService ? 6 : isMenageBureauxService ? (formData.frequence === 'une fois' ? 4 : 2) : 4;

  const calculatedPrice = usePriceCalculator(formData, selectedService);
  const estimatedResources = useResourceEstimator(formData, selectedService);

  // Sync estimated resources (only for new creations, not for edits or renewals)
  useEffect(() => {
    if (!editingDemande && !isRenewal && estimatedResources) {
      setFormData(prev => ({
        ...prev,
        duree: estimatedResources.duration,
        nb_intervenants: estimatedResources.people
      }));
    }
  }, [estimatedResources, editingDemande, isRenewal]);

  // Sync calculated price to montant (only for new creations)
  useEffect(() => {
    if (!editingDemande && !isRenewal) {
      if (calculatedPrice && calculatedPrice !== 'Sur devis') {
        setFormData(prev => ({ ...prev, montant: calculatedPrice }));
      } else if (calculatedPrice === 'Sur devis') {
        setFormData(prev => ({ ...prev, montant: '' }));
      }
    }
  }, [calculatedPrice, editingDemande, isRenewal]);

  // Enforce minDuree for duration
  useEffect(() => {
    if (formData.duree < minDuree) {
      setFormData(prev => ({ ...prev, duree: minDuree }));
    }
  }, [minDuree, formData.duree]);

  // Fecth Commerciaux for Assignation
  useEffect(() => {
    if (checkPermission(user, 'affecter_commercial').allowed) {
      getUsers({ role: 'commercial' }).then(res => {
        setCommerciaux(Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []));
      }).catch(err => console.error('Erreur commerciaux:', err));
    }
  }, [user]);

  // Handle external edit request (from Clients list)
  useEffect(() => {
    const state = location.state as { editDemandeId?: number } | null;
    // Ensure we trigger the effect even if `demandes` is empty (it might be the first load or an empty list)
    if (state?.editDemandeId && !editingDemande) {
      const target = demandes.find(d => d.id === state.editDemandeId);
      if (target) {
        openEditModal(target);
        // Clear state to prevent reopening
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        // Fetch it dynamically if not in the current list
        getDemande(state.editDemandeId).then(res => {
          openEditModal(res.data);
          navigate(location.pathname, { replace: true, state: {} });
        }).catch(() => {
          addToast("La demande n'est plus en attente ou est introuvable.", 'info');
          navigate(location.pathname, { replace: true, state: {} });
        });
      }
    }
  }, [location.state, demandes, editingDemande, navigate, location.pathname]);

  // Handle external renew/duplication request (from ClientDetails)
  useEffect(() => {
    const state = location.state as { renewDemandeId?: number; returnToClient?: string } | null;
    if (state?.renewDemandeId) {
      const target = demandes.find(d => d.id === state.renewDemandeId);
      if (target) {
        openRenewModal(target);
        navigate(location.pathname, { replace: true, state: { returnToClient: state.returnToClient } });
      } else {
        getDemande(state.renewDemandeId).then(res => {
          openRenewModal(res.data);
          navigate(location.pathname, { replace: true, state: { returnToClient: state.returnToClient } });
        }).catch(() => {
          addToast("La demande d'origine est introuvable.", 'error');
          navigate(location.pathname, { replace: true, state: {} });
        });
      }
    }
  }, [location.state, demandes, navigate, location.pathname]);

  const getRowClass = (d: Demande) => {
    if (d.statut_paiement === 'integral') return 'row-status-paye';
    if (d.statut_paiement === 'partiel') return 'row-status-partielle';
    if (d.statut === 'annule') return 'row-status-annulee';
    // For pending view, almost everything is 'en_attente' so we use Blue row status
    return 'row-status-encours';
  };

  const handleAffecter = async (demandeId: number, commercialId: number) => {
    const perm = checkPermission(user, 'affecter_commercial');
    if (!perm.allowed) {
      addToast(perm.message || 'Action non autorisée', 'error');
      return;
    }
    try {
      await affecterDemande(demandeId, commercialId);
      addToast('Demande affectée avec succès', 'success');
      setShowAssignmentModal(null);
      fetchDemandes();
    } catch (err) {
      addToast('Erreur lors de l\'affectation', 'error');
    }
  };

  const handlePreviewDocument = async (demande: Demande, type: 'devis' | 'png') => {
    try {
      // 1. Sauvegarder explicitement les données actuelles (dont le devis enrichi) avant génération et rafraîchissement
      const payload: any = {
        formulaire_data: demande.formulaire_data
      };
      if (demande.prix !== undefined) payload.prix = demande.prix;
      if (demande.nb_heures !== undefined) payload.nb_heures = demande.nb_heures;
      if (demande.nb_intervenants !== undefined) payload.nb_intervenants = demande.nb_intervenants;
      await updateDemande(demande.id, payload);

      if (type === 'devis') {
        addToast('Génération du devis côté frontend...', 'info');
        const { blob, name } = await generateDevisPdf(demande);
        const uploadResponse = await uploadDocument(demande.id, blob, 'devis', name);
        const doc = uploadResponse.data;
        const mediaUrl = doc?.public_media_url || undefined;

        let blobUrl = URL.createObjectURL(blob);
        if (doc?.download_url) {
          const secure = await fetchSecureDocBlob(doc.download_url);
          blobUrl = secure.blobUrl;
        }

        setShowPreviewModal({ 
          url: blobUrl, 
          type: 'devis', 
          name: doc?.nom || name, 
          demandeId: demande.id,
          mediaUrl 
        });
      } else {
        addToast('Génération du récapitulatif sur le serveur...', 'info');
        const response = await generateDocument(demande.id, type);
        const doc = response.data;
        const mediaUrl = doc?.public_media_url || undefined;
        const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
        setShowPreviewModal({ 
          url: blobUrl, 
          type: 'png', 
          name: doc.nom, 
          demandeId: demande.id,
          mediaUrl 
        });
      }

      fetchDemandes();
      addToast('Aperçu prêt', 'success');
    } catch (error) {
      console.error(error);
      addToast('Erreur lors de la génération', 'error');
    }
  };

  const SERVICES = {
    particulier: [
      "Ménage standard",
      "Grand ménage",
      "Ménage Air BnB",
      "Ménage fin de chantier",
      "Auxiliaire de vie",
      "Ménage post-sinistre",
      "Autre service"
    ],
    entreprise: [
      "Ménage bureaux",
      "Nettoyage fin de chantier",
      "Placement & gestion",
      "Ménage post-sinistre",
      "Autre service"
    ]
  };

  const fetchDemandes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDemandes({ statut: 'en_attente', no_page: 'true' });
      const data = response.data;
      const results = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);

      const filtered = results.filter((d: any) => {
        const clientName = d.client_name || d.formulaire_data?.nom || '';
        const clientPhone = d.client_phone || d.formulaire_data?.whatsapp_phone || '';
        const matchesSearch = !search || clientName.toLowerCase().includes(search.toLowerCase()) || clientPhone.includes(search);
        const matchesSegment = !segment || d.segment === segment;
        const matchesService = !prestation || d.service === prestation;
        let matchesDate = true;
        if (dateDebut || dateFin) {
          const demandeDate = new Date(d.created_at);
          if (dateDebut) {
            matchesDate = matchesDate && demandeDate >= new Date(dateDebut);
          }
          if (dateFin) {
            const dateFinObj = new Date(dateFin);
            dateFinObj.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && demandeDate <= dateFinObj;
          }
        }
        return matchesSearch && matchesSegment && matchesService && matchesDate;
      });

      setDemandes(filtered);
      setPendingCount(filtered.length);

      if (editingDemandeRef.current) {
        const currentEditing = editingDemandeRef.current;
        const fresh = results.find((d: any) => d.id === currentEditing.id);
        if (fresh) {
          const docLenChanged = (fresh.documents?.length || 0) !== (currentEditing.documents?.length || 0);
          const prixChanged = fresh.prix !== currentEditing.prix;
          const statusChanged = fresh.statut !== currentEditing.statut;
          if (docLenChanged || prixChanged || statusChanged) {
            setEditingDemande(fresh);
          }
        }
      }
    } catch (err) {
      console.error('Erreur fetchDemandes:', err);
      addToast('Erreur lors du chargement des demandes', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, segment, prestation, dateDebut, dateFin, setPendingCount]);

  useEffect(() => { fetchDemandes(); }, [fetchDemandes]);

  const toggleSection = (cardId: number, section: string) => {
    setExpandedCards(prev => {
      const cardState = prev[cardId] || { details: true, lieux: true, notes: true };
      return {
        ...prev,
        [cardId]: {
          ...cardState,
          [section]: !cardState[section]
        }
      };
    });
  };

  const isExpanded = (cardId: number, section: string) => {
    const cardState = expandedCards[cardId];
    if (section === 'devis') {
      if (cardState === undefined) return false;
      return cardState[section] === true;
    }
    if (cardState === undefined) return true; // Default open
    return cardState[section] !== false;
  };

  const handleDirectSendWhatsApp = async (demande: Demande, type: 'devis' | 'png') => {
    try {
      // 1. Sauvegarder explicitement les données actuelles (dont le devis enrichi) avant génération et rafraîchissement
      const payload: any = {
        formulaire_data: demande.formulaire_data
      };
      if (demande.prix !== undefined) payload.prix = demande.prix;
      if (demande.nb_heures !== undefined) payload.nb_heures = demande.nb_heures;
      if (demande.nb_intervenants !== undefined) payload.nb_intervenants = demande.nb_intervenants;
      await updateDemande(demande.id, payload);

      let mediaUrl: string | undefined = undefined;
      if (type === 'devis') {
        addToast('Préparation du document...', 'info');
        const { blob, name } = await generateDevisPdf(demande);
        const res = await uploadDocument(demande.id, blob, 'devis', name);
        mediaUrl = res.data?.public_media_url || undefined;
      }

      addToast(`Envoi du ${type === 'devis' ? 'devis' : 'récapitulatif'} via WhatsApp...`, 'info');
      await sendWhatsApp(demande.id, type, undefined, mediaUrl);
      addToast('Document envoyé avec succès !', 'success');
      fetchDemandes();
    } catch (error) {
      console.error(error);
      addToast("Erreur lors de l'envoi WhatsApp.", 'error');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!showPreviewModal) return;
    setSendingWhatsApp(true);
    try {
      await sendWhatsApp(
        showPreviewModal.demandeId, 
        showPreviewModal.type, 
        undefined, 
        showPreviewModal.mediaUrl
      );
      addToast('Document envoyé via WhatsApp avec succès !', 'success');
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'envoi WhatsApp.", 'error');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleAction = async (id: number, action: 'valider' | 'nrp' | 'annuler') => {
    if (action === 'valider') {
      const d = demandes.find(x => x.id === id);
      if (!d || !canValidateDemande(user, d)) {
        addToast("Action non autorisée. Vous n'êtes ni le créateur de cette demande ni son commercial assigné.", 'error');
        return;
      }
      const serviceName = (d.service || "").toLowerCase();
      if (serviceName.includes("chantier")) {
        const materiel = d.formulaire_data?.materiel_mobilise || "";
        if (!materiel.trim()) {
          addToast("Le matériel mobilisé est obligatoire avant de valider une mission fin de chantier.", 'error');
          return;
        }
      }
    } else if (action === 'annuler') {
      const perm = checkPermission(user, 'annuler_demande');
      if (!perm.allowed) {
        addToast(perm.message || 'Action non autorisée', 'error');
        return;
      }
    }
    try {
      if (action === 'valider') {
        const d = demandes.find(x => x.id === id);
        if (d && d.formulaire_data) {
          const payload: any = {};
          if (d.formulaire_data.montant !== undefined) payload.prix = d.formulaire_data.montant;
          else if (d.formulaire_data.prix !== undefined) payload.prix = d.formulaire_data.prix;

          if (d.formulaire_data.duree !== undefined) payload.nb_heures = d.formulaire_data.duree;
          else if (d.formulaire_data.nb_heures !== undefined) payload.nb_heures = d.formulaire_data.nb_heures;

          if (d.formulaire_data.nb_intervenants !== undefined) payload.nb_intervenants = d.formulaire_data.nb_intervenants;

          if (Object.keys(payload).length > 0) {
            await updateDemande(id, payload);
          }
        }
        await validerDemande(id);
        addToast('Demande validée !', 'success');
      }
      else if (action === 'nrp') {
        const response = await nrpDemande(id);
        const serverCount = Number(response?.data?.nrp_count);
        setDemandes(prev => prev.map(d => {
          if (d.id !== id) return d;
          const fallbackCount = (d.nrp_count ?? 0) + 1;
          return {
            ...d,
            nrp_count: (Number.isFinite(serverCount) && serverCount > (d.nrp_count ?? 0)) ? serverCount : fallbackCount,
          };
        }));
        addToast('NRP incrémenté', 'info');
        return;
      }
      else if (action === 'annuler') {
        const d = demandes.find(x => x.id === id);
        const isSubscription = d ? (d.frequency === 'abonnement' || !!d.parent_demande) : false;
        setShowAnnulationModal({ demandeId: id, isSubscription });
        return;
      }
      await fetchDemandes();
    } catch (err) {
      console.error(err);
      addToast('Une erreur est survenue lors de l\'action.', 'error');
    }
  };

  const openCreateModal = (service: string) => {
    setIsRenewal(false);
    setSelectedService(service);
    setEditingDemande(null);
    setDirectPhone('');
    setWhatsappPhone('');
    setFormData({
      nom: '', email: '', entity_name: '', contact_person: '', ville: 'Casablanca', quartier: '', adresse: '', date: '', heure: '',
      scheduling_type: 'fixed', preference_horaire: '', type_habitation: '', frequence: 'une fois', intervention_nature: 'sinistre', accommodation_state: '', cleanliness_type: '', nb_intervenants: 1,
      surface: 50, details_pieces: '', duree: 4, produits: false, torchons: false,
      montant: '', mode_paiement: 'virement', statut_paiement_ui: 'non_confirme', heard_about_us: '', notes: '',
      service_type: 'flexible', structure_type: '', nb_personnel: 1,
      lieu_garde: 'domicile', age_personne: '', sexe_personne: '',
      mobilite: '', situation_medicale: '', nb_jours: 1,
      rooms: {
        cuisine: 0, suiteAvecBain: 0, suiteSansBain: 0, salleDeBain: 0, chambre: 0,
        salonMarocain: 0, salonEuropeen: 0, toilettesLavabo: 0, rooftop: 0, escalier: 0
      },
      formula: 'A', size_tier: '1chambre', conso: false, linen_sets: 0,
      custom_service_type: '', property_category: 'logement', property_subtype: 'Appartement', duration_unit: 'heures', description: '', amount_ht: 0, tva_active: true,
      quote_number: '', frequency_custom: '', 
      options: [
        { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
        { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false },
        { key: "machines", label: "Machines et équipements (aspirateur, vapeur, etc.)", price: 0, enabled: false }
      ],
      vat_rate: 20, advance_required: false, advance_mode: 'percent', advance_percent: "", advance_amount: 0,
      avance_paiement: 0, avance_active: false, avance_type: 'percent', avance_pourcentage: "", avance_fixe: 0
    });
    setShowCreateModal(true);
    setShowNewMenu(false);
  };

  const openEditModal = (d: Demande) => {
    setIsRenewal(false);
    setEditingDemande(d);
    const isAutre = d.formulaire_data?.is_autre_service === true;
    setSelectedService(isAutre ? 'Autre service' : d.service);
    setActiveSegment(d.segment);

    const rawPhone = d.client_phone || d.client_detail?.phone || d.formulaire_data?.phone || d.formulaire_data?.telephone || d.formulaire_data?.whatsapp_phone || '';
    const rawWhatsApp = d.client_whatsapp || d.formulaire_data?.whatsapp_phone || d.client_detail?.whatsapp || d.formulaire_data?.whatsapp || rawPhone;

    const cleanPhone = strip212(rawPhone);
    const cleanWhatsApp = strip212(rawWhatsApp);

    setDirectPhone(cleanPhone);
    setWhatsappPhone(cleanWhatsApp);
    setSyncWhatsApp(!rawWhatsApp || cleanWhatsApp === cleanPhone);

    setFormData({
      nom: d.client_name || d.formulaire_data?.nom || d.formulaire_data?.fullName || '',
      email: d.client_email || d.formulaire_data?.email || d.client_detail?.email || '',
      entity_name: d.client_entity || d.formulaire_data?.entityName || d.formulaire_data?.entity_name || '',
      contact_person: d.client_contact || d.formulaire_data?.contactPerson || d.formulaire_data?.contact_person || '',
      ville: d.client_city || d.formulaire_data?.ville || 'Casablanca',
      quartier: normalizeQuartier(d.client_neighborhood || d.formulaire_data?.quartier || ''),
      adresse: d.client_address || d.formulaire_data?.adresse || '',
      date: d.date_intervention || d.formulaire_data?.date || d.formulaire_data?.scheduledDate || '',
      heure: d.heure_intervention || d.formulaire_data?.heure || d.formulaire_data?.fixedTime || '',
      scheduling_type: d.heure_intervention || d.formulaire_data?.heure || d.formulaire_data?.fixedTime ? 'fixed' : 'flexible',
      preference_horaire: normalizeTimePref(d.preference_horaire || d.formulaire_data?.preference_horaire || (d.formulaire_data?.schedulingTime === 'morning' ? 'matin' : d.formulaire_data?.schedulingTime === 'afternoon' ? 'apres_midi' : '')),
      type_habitation: normalizeStructure(d.formulaire_data?.type_habitation || ''),
      frequence: normalizeFrequence(d.frequency_label || d.formulaire_data?.frequence || (d.frequency === 'oneshot' ? 'une fois' : 'mensuel')),
      intervention_nature: d.formulaire_data?.interventionNature || d.formulaire_data?.intervention_nature || 'sinistre',
      accommodation_state: (d.formulaire_data?.accommodationState || d.formulaire_data?.accommodation_state || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      cleanliness_type: (d.formulaire_data?.cleanlinessType || d.formulaire_data?.cleanliness_type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      nb_intervenants: d.formulaire_data?.nb_intervenants || d.formulaire_data?.nb_personnel || d.formulaire_data?.numberOfPeople || d.nb_intervenants || 1,
      surface: d.formulaire_data?.surface || 50,
      details_pieces: d.formulaire_data?.details_pieces || '',
      duree: d.formulaire_data?.duree || d.formulaire_data?.nb_heures || d.nb_heures || 4,
      produits: d.formulaire_data?.produits || d.formulaire_data?.produitsEtOutils || false,
      torchons: d.formulaire_data?.torchons || d.formulaire_data?.torchonsEtSerpierres || false,
      montant: d.prix?.toString() || d.formulaire_data?.montant || '',
      mode_paiement: normalizePayment(d.mode_paiement || d.formulaire_data?.mode_paiement || ''),
      statut_paiement_ui: d.formulaire_data?.facturation?.statut_paiement_ui || d.formulaire_data?.statut_paiement_ui || d.statut_paiement_ui || (d.statut_paiement === 'integral' ? 'paye' : d.statut_paiement === 'acompte' ? 'paiement_en_attente' : d.statut_paiement === 'partiel' ? 'paiement_partiel' : 'non_confirme'),
      heard_about_us: d.formulaire_data?.heard_about_us || d.formulaire_data?.comment_connu || d.formulaire_data?.lead_source || '',
      notes: d.formulaire_data?.notes || '',
      service_type: d.formulaire_data?.service_type || 'flexible',
      structure_type: normalizeStructure(d.formulaire_data?.structure_type || ''),
      nb_personnel: d.formulaire_data?.nb_intervenants || d.formulaire_data?.nb_personnel || d.formulaire_data?.numberOfPeople || d.nb_intervenants || 1,
      lieu_garde: d.formulaire_data?.lieu_garde || 'domicile',
      age_personne: d.formulaire_data?.age_personne || '',
      sexe_personne: normalizeSexe(d.formulaire_data?.sexe_personne || ''),
      mobilite: normalizeMobilite(d.formulaire_data?.mobilite || ''),
      situation_medicale: d.formulaire_data?.situation_medicale || '',
      nb_jours: d.formulaire_data?.nb_jours || 1,
      rooms: d.formulaire_data?.rooms || {
        cuisine: 0, suiteAvecBain: 0, suiteSansBain: 0, salleDeBain: 0, chambre: 0,
        salonMarocain: 0, salonEuropeen: 0, toilettesLavabo: 0, rooftop: 0, escalier: 0
      },
      formula: d.formulaire_data?.formula || 'A',
      size_tier: d.formulaire_data?.size_tier || d.formulaire_data?.sizeTier || '1chambre',
      conso: d.formulaire_data?.conso || false,
      linen_sets: d.formulaire_data?.linen_sets || d.formulaire_data?.linenSets || 0,
      custom_service_type: d.formulaire_data?.custom_service_type || d.service || '',
      property_category: d.formulaire_data?.property_category || 'logement',
      property_subtype: d.formulaire_data?.property_subtype || 'Appartement',
      duration_unit: d.formulaire_data?.duration_unit || 'heures',
      description: d.formulaire_data?.description || '',
      amount_ht: d.formulaire_data?.amount_ht || d.prix || 0,
      tva_active: d.formulaire_data?.tva_active !== false,
      quote_number: d.formulaire_data?.quote_number || '',
      frequency_custom: d.formulaire_data?.frequency_custom || '',
      options: d.formulaire_data?.options || [
        { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
        { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false },
        { key: "machines", label: "Machines et équipements (aspirateur, vapeur, etc.)", price: 0, enabled: false }
      ],
      vat_rate: d.formulaire_data?.vat_rate !== undefined ? Number(d.formulaire_data?.vat_rate) : 20,
      advance_required: d.formulaire_data?.advance_required || d.formulaire_data?.avance_active || false,
      advance_mode: d.formulaire_data?.advance_mode || d.formulaire_data?.avance_type || 'percent',
      advance_percent: d.formulaire_data?.advance_percent !== undefined && d.formulaire_data?.advance_percent !== null && d.formulaire_data?.advance_percent !== "" ? Number(d.formulaire_data?.advance_percent) : (d.formulaire_data?.avance_pourcentage !== undefined && d.formulaire_data?.avance_pourcentage !== null && d.formulaire_data?.avance_pourcentage !== "" ? Number(d.formulaire_data?.avance_pourcentage) : ""),
      advance_amount: d.formulaire_data?.advance_amount || d.formulaire_data?.avance_fixe || 0,
      avance_paiement: d.formulaire_data?.avance_paiement || 0,
      avance_active: d.formulaire_data?.avance_active || d.formulaire_data?.advance_required || false,
      avance_type: d.formulaire_data?.avance_type || d.formulaire_data?.advance_mode || 'percent',
      avance_pourcentage: d.formulaire_data?.avance_pourcentage !== undefined && d.formulaire_data?.avance_pourcentage !== null && d.formulaire_data?.avance_pourcentage !== "" ? Number(d.formulaire_data?.avance_pourcentage) : (d.formulaire_data?.advance_percent !== undefined && d.formulaire_data?.advance_percent !== null && d.formulaire_data?.advance_percent !== "" ? Number(d.formulaire_data?.advance_percent) : ""),
      avance_fixe: d.formulaire_data?.avance_fixe || d.formulaire_data?.advance_amount || 0
    });
    setShowCreateModal(true);
  };

  const openRenewModal = (d: Demande) => {
    setIsRenewal(true);
    setEditingDemande(null);
    const isAutre = d.formulaire_data?.is_autre_service === true;
    setSelectedService(isAutre ? 'Autre service' : d.service);
    setActiveSegment(d.segment);

    const rawPhone = d.client_phone || d.client_detail?.phone || d.formulaire_data?.phone || d.formulaire_data?.telephone || d.formulaire_data?.whatsapp_phone || '';
    const rawWhatsApp = d.client_whatsapp || d.formulaire_data?.whatsapp_phone || d.client_detail?.whatsapp || d.formulaire_data?.whatsapp || rawPhone;

    const cleanPhone = strip212(rawPhone);
    const cleanWhatsApp = strip212(rawWhatsApp);

    setDirectPhone(cleanPhone);
    setWhatsappPhone(cleanWhatsApp);
    setSyncWhatsApp(!rawWhatsApp || cleanWhatsApp === cleanPhone);

    setFormData({
      nom: d.client_name || d.formulaire_data?.nom || d.formulaire_data?.fullName || '',
      email: d.client_email || d.formulaire_data?.email || d.client_detail?.email || '',
      entity_name: d.client_entity || d.formulaire_data?.entityName || d.formulaire_data?.entity_name || '',
      contact_person: d.client_contact || d.formulaire_data?.contactPerson || d.formulaire_data?.contact_person || '',
      ville: d.client_city || d.formulaire_data?.ville || 'Casablanca',
      quartier: normalizeQuartier(d.client_neighborhood || d.formulaire_data?.quartier || ''),
      adresse: d.client_address || d.formulaire_data?.adresse || '',
      date: d.date_intervention || d.formulaire_data?.date || d.formulaire_data?.scheduledDate || '',
      heure: d.heure_intervention || d.formulaire_data?.heure || d.formulaire_data?.fixedTime || '',
      scheduling_type: d.heure_intervention || d.formulaire_data?.heure || d.formulaire_data?.fixedTime ? 'fixed' : 'flexible',
      preference_horaire: normalizeTimePref(d.preference_horaire || d.formulaire_data?.preference_horaire || (d.formulaire_data?.schedulingTime === 'morning' ? 'matin' : d.formulaire_data?.schedulingTime === 'afternoon' ? 'apres_midi' : '')),
      type_habitation: normalizeStructure(d.formulaire_data?.type_habitation || ''),
      frequence: normalizeFrequence(d.frequency_label || d.formulaire_data?.frequence || (d.frequency === 'oneshot' ? 'une fois' : 'mensuel')),
      intervention_nature: d.formulaire_data?.interventionNature || d.formulaire_data?.intervention_nature || 'sinistre',
      accommodation_state: (d.formulaire_data?.accommodationState || d.formulaire_data?.accommodation_state || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      cleanliness_type: (d.formulaire_data?.cleanlinessType || d.formulaire_data?.cleanliness_type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
      nb_intervenants: d.formulaire_data?.nb_intervenants || d.formulaire_data?.nb_personnel || d.formulaire_data?.numberOfPeople || d.nb_intervenants || 1,
      surface: d.formulaire_data?.surface || 50,
      details_pieces: d.formulaire_data?.details_pieces || '',
      duree: d.formulaire_data?.duree || d.formulaire_data?.nb_heures || d.nb_heures || 4,
      produits: d.formulaire_data?.produits || d.formulaire_data?.produitsEtOutils || false,
      torchons: d.formulaire_data?.torchons || d.formulaire_data?.torchonsEtSerpierres || false,
      montant: d.prix?.toString() || d.formulaire_data?.montant || '',
      mode_paiement: normalizePayment(d.mode_paiement || d.formulaire_data?.mode_paiement || ''),
      statut_paiement_ui: 'non_confirme',
      heard_about_us: d.formulaire_data?.heard_about_us || d.formulaire_data?.comment_connu || d.formulaire_data?.lead_source || '',
      notes: d.formulaire_data?.notes || '',
      service_type: d.formulaire_data?.service_type || 'flexible',
      structure_type: normalizeStructure(d.formulaire_data?.structure_type || ''),
      nb_personnel: d.formulaire_data?.nb_intervenants || d.formulaire_data?.nb_personnel || d.formulaire_data?.numberOfPeople || d.nb_intervenants || 1,
      lieu_garde: d.formulaire_data?.lieu_garde || 'domicile',
      age_personne: d.formulaire_data?.age_personne || '',
      sexe_personne: normalizeSexe(d.formulaire_data?.sexe_personne || ''),
      mobilite: normalizeMobilite(d.formulaire_data?.mobilite || ''),
      situation_medicale: d.formulaire_data?.situation_medicale || '',
      nb_jours: d.formulaire_data?.nb_jours || 1,
      rooms: d.formulaire_data?.rooms || {
        cuisine: 0, suiteAvecBain: 0, suiteSansBain: 0, salleDeBain: 0, chambre: 0,
        salonMarocain: 0, salonEuropeen: 0, toilettesLavabo: 0, rooftop: 0, escalier: 0
      },
      formula: d.formulaire_data?.formula || 'A',
      size_tier: d.formulaire_data?.size_tier || d.formulaire_data?.sizeTier || '1chambre',
      conso: d.formulaire_data?.conso || false,
      linen_sets: d.formulaire_data?.linen_sets || d.formulaire_data?.linenSets || 0,
      custom_service_type: d.formulaire_data?.custom_service_type || d.service || '',
      property_category: d.formulaire_data?.property_category || 'logement',
      property_subtype: d.formulaire_data?.property_subtype || 'Appartement',
      duration_unit: d.formulaire_data?.duration_unit || 'heures',
      description: d.formulaire_data?.description || '',
      amount_ht: d.formulaire_data?.amount_ht || d.prix || 0,
      tva_active: d.formulaire_data?.tva_active !== false,
      quote_number: d.formulaire_data?.quote_number || '',
      frequency_custom: d.formulaire_data?.frequency_custom || '',
      options: d.formulaire_data?.options || [
        { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
        { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false },
        { key: "machines", label: "Machines et équipements (aspirateur, vapeur, etc.)", price: 0, enabled: false }
      ],
      vat_rate: d.formulaire_data?.vat_rate !== undefined ? Number(d.formulaire_data?.vat_rate) : 20,
      advance_required: d.formulaire_data?.advance_required || d.formulaire_data?.avance_active || false,
      advance_mode: d.formulaire_data?.advance_mode || d.formulaire_data?.avance_type || 'percent',
      advance_percent: d.formulaire_data?.advance_percent !== undefined && d.formulaire_data?.advance_percent !== null && d.formulaire_data?.advance_percent !== "" ? Number(d.formulaire_data?.advance_percent) : (d.formulaire_data?.avance_pourcentage !== undefined && d.formulaire_data?.avance_pourcentage !== null && d.formulaire_data?.avance_pourcentage !== "" ? Number(d.formulaire_data?.avance_pourcentage) : ""),
      advance_amount: d.formulaire_data?.advance_amount || d.formulaire_data?.avance_fixe || 0,
      avance_paiement: d.formulaire_data?.avance_paiement || 0,
      avance_active: d.formulaire_data?.avance_active || d.formulaire_data?.advance_required || false,
      avance_type: d.formulaire_data?.avance_type || d.formulaire_data?.advance_mode || 'percent',
      avance_pourcentage: d.formulaire_data?.avance_pourcentage !== undefined && d.formulaire_data?.avance_pourcentage !== null && d.formulaire_data?.avance_pourcentage !== "" ? Number(d.formulaire_data?.avance_pourcentage) : (d.formulaire_data?.advance_percent !== undefined && d.formulaire_data?.advance_percent !== null && d.formulaire_data?.advance_percent !== "" ? Number(d.formulaire_data?.advance_percent) : ""),
      avance_fixe: d.formulaire_data?.avance_fixe || d.formulaire_data?.advance_amount || 0
    });
    setShowCreateModal(true);
  };

  const getUpdatedDemandeFromForm = (baseDemande: Demande | null): Demande => {
    const frequencyValue = formData.frequence === 'une fois' ? 'oneshot' : 'abonnement';
    const isFixedSchedule = formData.scheduling_type === 'fixed';
    const clientDisplayName = activeSegment === 'entreprise'
      ? (formData.entity_name || formData.contact_person || formData.nom)
      : formData.nom;

    const formatPhone = (p: string) => {
      if (!p) return "";
      let cleaned = p.replace(/\s+/g, '');
      if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
      if (!cleaned.startsWith('+')) return `+212${cleaned}`;
      return cleaned;
    };

    const finalPhone = formatPhone(directPhone);
    const finalWhatsApp = formatPhone(whatsappPhone);

    const additionalServices = {
      produitsEtOutils: Boolean(formData.produits),
      torchonsEtSerpierres: Boolean(formData.torchons),
    };

    const paymentOption = PAYMENT_STATUS_OPTIONS.find(o => o.value === formData.statut_paiement_ui);

    const finalService = selectedService === 'Autre service'
      ? (formData.custom_service_type || 'Autre service')
      : selectedService;

    const isAuxiliaire = selectedServiceKey.includes('auxiliaire de vie') || selectedService.toLowerCase().includes('auxiliaire');
    const cleanerCount = isAuxiliaire ? (formData.nb_personnel || 1) : (formData.nb_intervenants || 1);

    const formulaire_data = {
      ...(baseDemande?.formulaire_data || {}),
      facturation: {
        ...(baseDemande?.formulaire_data?.facturation || {}),
        statut_paiement_ui: formData.statut_paiement_ui,
      },
      statut_paiement_ui: formData.statut_paiement_ui,
      nom: clientDisplayName,
      firstName: activeSegment === 'particulier' ? (formData.nom.split(' ').slice(0, -1).join(' ') || formData.nom) : '',
      lastName: activeSegment === 'particulier' ? (formData.nom.split(' ').slice(-1).join(' ') || formData.nom) : '',
      email: formData.email,
      entityName: formData.entity_name,
      contactPerson: formData.contact_person,
      ville: formData.ville,
      city: formData.ville,
      quartier: formData.quartier,
      neighborhood: formData.quartier,
      adresse: formData.adresse,
      preference_horaire: isFixedSchedule ? '' : formData.preference_horaire,
      schedulingType: formData.scheduling_type,
      schedulingDate: formData.date || null,
      fixedTime: isFixedSchedule ? (formData.heure || '') : '',
      schedulingTime: isFixedSchedule ? '' : (formData.preference_horaire === 'matin' ? 'morning' : formData.preference_horaire === 'apres_midi' ? 'afternoon' : ''),
      type_habitation: selectedService === 'Autre service'
        ? (formData.property_category === 'logement' ? formData.property_subtype : formData.property_category)
        : formData.type_habitation,
      propertyType: selectedService === 'Autre service'
        ? (formData.property_category === 'logement' ? (formData.property_subtype || '').toLowerCase() : (formData.property_category || '').toLowerCase())
        : (formData.type_habitation ? formData.type_habitation.toLowerCase() : ''),
      surface: formData.surface,
      surfaceArea: formData.surface,
      duree: formData.duree,
      duration: formData.duree,
      nb_intervenants: cleanerCount,
      numberOfPeople: cleanerCount,
      nb_intervenantes: cleanerCount,
      details_pieces: formData.details_pieces,
      produits: formData.produits,
      torchons: formData.torchons,
      additionalServices,
      heard_about_us: formData.heard_about_us,
      comment_connu: formData.heard_about_us,
      lead_source: formData.heard_about_us,
      structure_type: formData.structure_type,
      structureType: formData.structure_type,
      service_type: formData.service_type,
      serviceType: formData.service_type,
      nb_personnel: cleanerCount,
      lieu_garde: formData.lieu_garde,
      careLocation: formData.lieu_garde,
      age_personne: formData.age_personne,
      patientAge: formData.age_personne,
      sexe_personne: formData.sexe_personne,
      patientGender: formData.sexe_personne,
      mobilite: formData.mobilite,
      situation_medicale: formData.situation_medicale,
      healthIssues: formData.situation_medicale,
      nb_jours: formData.nb_jours,
      numberOfDays: formData.nb_jours,
      interventionNature: formData.intervention_nature,
      accommodationState: formData.accommodation_state,
      cleanlinessType: formData.cleanliness_type,
      whatsapp_phone: finalWhatsApp,
      whatsappNumber: finalWhatsApp,
      notes: formData.notes,
      rooms: formData.rooms,
      formula: formData.formula,
      size_tier: formData.size_tier,
      sizeTier: formData.size_tier,
      conso: formData.conso,
      linen_sets: formData.linen_sets,
      linenSets: formData.linen_sets,
      is_autre_service: selectedService === 'Autre service' || baseDemande?.formulaire_data?.is_autre_service || false,
      custom_service_type: formData.custom_service_type,
      property_category: formData.property_category,
      property_subtype: formData.property_subtype,
      duration_unit: formData.duration_unit,
      description: formData.description,
      amount_ht: formData.amount_ht,
      tva_active: formData.tva_active,
      quote_number: formData.quote_number,
      frequency_custom: formData.frequency_custom,
      options: formData.options,
      vat_rate: formData.vat_rate,
      advance_required: formData.advance_required,
      advance_mode: formData.advance_mode,
      advance_percent: formData.advance_percent,
      advance_amount: formData.advance_amount,
      avance_paiement: formData.avance_paiement,
      avance_active: formData.avance_active,
      avance_type: formData.avance_type,
      avance_pourcentage: formData.avance_pourcentage,
      avance_fixe: formData.avance_fixe,
      frequence: formData.frequence
    };

    return {
      ...(baseDemande || {}),
      client_name: clientDisplayName,
      client_phone: finalPhone,
      client_whatsapp: finalWhatsApp,
      service: finalService,
      segment: activeSegment,
      date_intervention: formData.date || null,
      heure_intervention: isFixedSchedule ? (formData.heure || '') : '',
      prix: formData.montant || null,
      is_devis: selectedService === 'Autre service' || isDevisRequired({ service: selectedService, segment: activeSegment, formulaire_data: formData } as any),
      mode_paiement: formData.mode_paiement,
      statut_paiement: paymentOption?.apiValue || 'non_paye',
      frequency: frequencyValue,
      frequency_label: formData.frequence,
      nb_heures: formData.duree || 4,
      nb_intervenants: cleanerCount,
      formulaire_data
    } as Demande;
  };

  const handleCreateDemande = async () => {
    const perm = checkPermission(
      user, 
      editingDemande ? 'edit_demande' : 'create_demande',
      editingDemande ? { targetOwnerId: editingDemande.assigned_to_id } : undefined
    );
    if (!perm.allowed) {
      addToast(perm.message || 'Action non autorisée', 'error');
      return;
    }
    setFormSubmitted(true);
    const form = document.getElementById('create-request-form') as HTMLFormElement;
    if (!form?.checkValidity()) {
      const firstInvalid = form?.querySelector(':invalid') as HTMLElement;
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
        addToast("Veuillez remplir tous les champs obligatoires", "error");
      }
      return;
    }

    try {
      const frequencyValue = formData.frequence === 'une fois' ? 'oneshot' : 'abonnement';
      const isFixedSchedule = formData.scheduling_type === 'fixed';
      const clientDisplayName = activeSegment === 'entreprise'
        ? (formData.entity_name || formData.contact_person || formData.nom)
        : formData.nom;

      // Fix phone indicator: Add +212 if not present
      const formatPhone = (p: string) => {
        if (!p) return "";
        let cleaned = p.replace(/\s+/g, '');
        if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
        if (!cleaned.startsWith('+')) return `+212${cleaned}`;
        return cleaned;
      };

      const finalPhone = formatPhone(directPhone);
      const finalWhatsApp = formatPhone(whatsappPhone);

      const additionalServices = {
        produitsEtOutils: Boolean(formData.produits),
        torchonsEtSerpierres: Boolean(formData.torchons),
      };

      const paymentOption = PAYMENT_STATUS_OPTIONS.find(o => o.value === formData.statut_paiement_ui);

      let decodedClientId: number | null = null;
      if (isRenewal && (location.state as any)?.returnToClient) {
        const decoded = decodeId((location.state as any).returnToClient);
        if (decoded) {
          decodedClientId = decoded;
        }
      }

      const finalService = selectedService === 'Autre service'
        ? (formData.custom_service_type || 'Autre service')
        : selectedService;

      const isAuxiliaire = selectedServiceKey.includes('auxiliaire de vie') || selectedService.toLowerCase().includes('auxiliaire');
      const cleanerCount = isAuxiliaire ? (formData.nb_personnel || 1) : (formData.nb_intervenants || 1);

      const payload = {
        client_name: clientDisplayName,
        client_phone: finalPhone,
        client_whatsapp: finalWhatsApp,
        service: finalService,
        segment: activeSegment,
        date_intervention: formData.date || null,
        heure_intervention: isFixedSchedule ? (formData.heure || '') : '',
        prix: formData.montant || null,
        is_devis: selectedService === 'Autre service' || isDevisRequired({ service: selectedService, segment: activeSegment, formulaire_data: formData } as any),
        mode_paiement: formData.mode_paiement,
        statut_paiement: paymentOption?.apiValue || 'non_paye',
        frequency: frequencyValue,
        frequency_label: formData.frequence,
        nb_heures: formData.duree || 4,
        nb_intervenants: cleanerCount,
        ...(isRenewal ? { statut: 'en_attente', cao: false, profils_envoyes: [], documents: [] } : {}),
        ...(decodedClientId ? { client: decodedClientId } : {}),
        formulaire_data: {
          facturation: {
            ...(editingDemande?.formulaire_data?.facturation || {}),
            statut_paiement_ui: formData.statut_paiement_ui,
          },
          statut_paiement_ui: formData.statut_paiement_ui,
          nom: clientDisplayName,
          firstName: activeSegment === 'particulier' ? (formData.nom.split(' ').slice(0, -1).join(' ') || formData.nom) : '',
          lastName: activeSegment === 'particulier' ? (formData.nom.split(' ').slice(-1).join(' ') || formData.nom) : '',
          email: formData.email,
          entityName: formData.entity_name,
          contactPerson: formData.contact_person,
          ville: formData.ville,
          city: formData.ville,
          quartier: formData.quartier,
          neighborhood: formData.quartier,
          adresse: formData.adresse,
          preference_horaire: isFixedSchedule ? '' : formData.preference_horaire,
          schedulingType: formData.scheduling_type,
          schedulingDate: formData.date || null,
          fixedTime: isFixedSchedule ? (formData.heure || '') : '',
          schedulingTime: isFixedSchedule ? '' : (formData.preference_horaire === 'matin' ? 'morning' : formData.preference_horaire === 'apres_midi' ? 'afternoon' : ''),
          type_habitation: selectedService === 'Autre service'
            ? (formData.property_category === 'logement' ? formData.property_subtype : formData.property_category)
            : formData.type_habitation,
          propertyType: selectedService === 'Autre service'
            ? (formData.property_category === 'logement' ? (formData.property_subtype || '').toLowerCase() : (formData.property_category || '').toLowerCase())
            : (formData.type_habitation ? formData.type_habitation.toLowerCase() : ''),
          surface: formData.surface,
          surfaceArea: formData.surface,
          duree: formData.duree,
          duration: formData.duree,
          nb_intervenants: cleanerCount,
          numberOfPeople: cleanerCount,
          nb_intervenantes: cleanerCount,
          details_pieces: formData.details_pieces,
          produits: formData.produits,
          torchons: formData.torchons,
          additionalServices,
          heard_about_us: formData.heard_about_us,
          comment_connu: formData.heard_about_us,
          lead_source: formData.heard_about_us,
          // Placement & gestion
          structure_type: formData.structure_type,
          structureType: formData.structure_type,
          service_type: formData.service_type,
          serviceType: formData.service_type,
          nb_personnel: cleanerCount,
          // Auxiliaire de vie
          lieu_garde: formData.lieu_garde,
          careLocation: formData.lieu_garde,
          age_personne: formData.age_personne,
          patientAge: formData.age_personne,
          sexe_personne: formData.sexe_personne,
          patientGender: formData.sexe_personne,
          mobilite: formData.mobilite,
          situation_medicale: formData.situation_medicale,
          healthIssues: formData.situation_medicale,
          nb_jours: formData.nb_jours,
          numberOfDays: formData.nb_jours,
          // Post-sinistre / post-demenagement
          interventionNature: formData.intervention_nature,
          accommodationState: formData.accommodation_state,
          cleanlinessType: formData.cleanliness_type,
          // Contact
          whatsapp_phone: finalWhatsApp,
          whatsappNumber: finalWhatsApp,
          notes: formData.notes,
          // Detailed rooms
          rooms: formData.rooms,
          // AirBnB
          formula: formData.formula,
          size_tier: formData.size_tier,
          sizeTier: formData.size_tier,
          conso: formData.conso,
          linen_sets: formData.linen_sets,
          linenSets: formData.linen_sets,
          // Autre service
          is_autre_service: selectedService === 'Autre service' || editingDemande?.formulaire_data?.is_autre_service || false,
          custom_service_type: formData.custom_service_type,
          property_category: formData.property_category,
          property_subtype: formData.property_subtype,
          duration_unit: formData.duration_unit,
          description: formData.description,
          amount_ht: formData.amount_ht,
          tva_active: formData.tva_active,
          quote_number: formData.quote_number,
          frequency_custom: formData.frequency_custom,
          options: formData.options,
          vat_rate: formData.vat_rate,
          advance_required: formData.advance_required,
          advance_mode: formData.advance_mode,
          advance_percent: formData.advance_percent,
          advance_amount: formData.advance_amount,
          avance_paiement: formData.avance_paiement,
          avance_active: formData.avance_active,
          avance_type: formData.avance_type,
          avance_pourcentage: formData.avance_pourcentage,
          avance_fixe: formData.avance_fixe,
          frequence: formData.frequence
        }
      };

      if (editingDemande) {
        await updateDemande(editingDemande.id, payload);
        addToast('Demande mise à jour !', 'success');
      } else {
        const res = await createDemande(payload);
        const newDemandeId = res.data?.id;

        if (isRenewal && newDemandeId) {
          try {
            await confirmerClient(newDemandeId);
          } catch (confirmErr) {
            console.error('Error confirming client association automatically:', confirmErr);
          }
        }

        if (isRenewal && (location.state as any)?.returnToClient) {
          addToast('Demande renouvelée avec succès !', 'success');
          setShowCreateModal(false);
          setFormSubmitted(false);
          const returnToClient = (location.state as any).returnToClient;
          navigate(`/clients/${returnToClient}`);
          return;
        } else {
          addToast('Demande créée avec succès !', 'success');
        }
      }

      setShowCreateModal(false);
      setFormSubmitted(false);

      // S'assurer que le refresh est immédiat
      await fetchDemandes();
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de l\'enregistrement.', 'error');
    }
  };

  const handleDevisStatutChange = async (demandeId: number, value: string) => {
    setDemandes(prev => prev.map(d => d.id === demandeId ? { ...d, devis_statut: value as any } : d));
    try {
      await updateDemande(demandeId, { devis_statut: value } as any);
    } catch (e) {
      console.error('Erreur lors de la mise à jour du statut du devis', e);
      addToast('Erreur lors de la mise à jour du statut du devis.', 'error');
    }
  };

  const handleQuoteUpdate = async (demandeId: number, patch: Record<string, any>) => {
    // Synchroniser le patch de manière bidirectionnelle
    const updatedPatch = { ...patch };
    const val = patch.nb_intervenants !== undefined ? patch.nb_intervenants : (patch.nb_personnel !== undefined ? patch.nb_personnel : (patch.nb_intervenantes !== undefined ? patch.nb_intervenantes : (patch.numberOfPeople !== undefined ? patch.numberOfPeople : undefined)));
    if (val !== undefined) {
      updatedPatch.nb_intervenants = val;
      updatedPatch.nb_personnel = val;
      updatedPatch.nb_intervenantes = val;
      updatedPatch.numberOfPeople = val;
    }

    const durVal = patch.duree !== undefined ? patch.duree : (patch.nb_heures !== undefined ? patch.nb_heures : (patch.duration !== undefined ? patch.duration : undefined));
    if (durVal !== undefined) {
      updatedPatch.duree = durVal;
      updatedPatch.nb_heures = durVal;
      updatedPatch.duration = durVal;
    }

    // 1. Local optimistic update so UI is immediately responsive
    setDemandes(prev => prev.map(d => {
      if (d.id === demandeId) {
        return {
          ...d,
          prix: patch.montant !== undefined ? patch.montant : patch.prix !== undefined ? patch.prix : d.prix,
          nb_heures: durVal !== undefined ? durVal : d.nb_heures,
          nb_intervenants: val !== undefined ? val : d.nb_intervenants,
          avance_paiement: patch.avance_paiement !== undefined ? patch.avance_paiement : d.avance_paiement,
          frequency: patch.frequency !== undefined 
            ? ((patch.frequency === 'subscription' || patch.frequency === 'abonnement') ? 'abonnement' : 'oneshot') 
            : d.frequency,
          frequency_label: patch.frequence !== undefined ? patch.frequence : d.frequency_label,
          formulaire_data: {
            ...(d.formulaire_data || {}),
            ...updatedPatch
          }
        };
      }
      return d;
    }));

    // 2. Background API update
    try {
      const targetDemande = demandes.find(d => d.id === demandeId);
      if (!targetDemande) return;

      const payload: any = {
        formulaire_data: {
          ...(targetDemande.formulaire_data || {}),
          ...updatedPatch
        }
      };

      if (patch.montant !== undefined) payload.prix = patch.montant;
      else if (patch.prix !== undefined) payload.prix = patch.prix;

      if (durVal !== undefined) payload.nb_heures = durVal;
      if (val !== undefined) payload.nb_intervenants = val;
      
      if (patch.avance_paiement !== undefined) payload.avance_paiement = patch.avance_paiement;

      if (patch.frequency !== undefined) {
        payload.frequency = (patch.frequency === 'subscription' || patch.frequency === 'abonnement') 
          ? 'abonnement' 
          : 'oneshot';
      }
      if (patch.frequence !== undefined) payload.frequency_label = patch.frequence;

      await updateDemande(demandeId, payload);
    } catch (e) {
      console.error('Erreur lors de la synchro du devis', e);
      addToast('Erreur lors de la synchronisation du devis.', 'error');
    }
  };

  return (
    <div className="page" onClick={() => setShowNewMenu(false)}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Les demandes en attente</h1>
          <p className="page-subtitle">{demandes.length} demande(s) en attente de traitement</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={fetchDemandes} title="Rafraîchir">
            <RefreshCw size={18} />
          </button>

          {(hasPermission(user, 'creer_demande') || hasPermission(user, 'creer_valider_demande')) && (
            <div className="dropdown-container" onClick={e => e.stopPropagation()}>
              <button className="btn btn-primary" onClick={() => setShowNewMenu(!showNewMenu)}>
                <Plus size={18} /> Nouveau
              </button>

              {showNewMenu && (
                <div className="nested-menu">
                  <div
                    className="menu-group"
                    onMouseEnter={() => setActiveSegment('particulier')}
                  >
                    <div className={`menu-group-item ${activeSegment === 'particulier' ? 'active' : ''}`}>
                      <span>Particulier</span>
                      <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
                    </div>
                    {activeSegment === 'particulier' && (
                      <div className="submenu">
                        {SERVICES.particulier.map(s => (
                          <button key={s} className="submenu-item" onClick={() => openCreateModal(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    className="menu-group"
                    onMouseEnter={() => setActiveSegment('entreprise')}
                  >
                    <div className={`menu-group-item ${activeSegment === 'entreprise' ? 'active' : ''}`}>
                      <span>Entreprise</span>
                      <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
                    </div>
                    {activeSegment === 'entreprise' && (
                      <div className="submenu">
                        {SERVICES.entreprise.map(s => (
                          <button key={s} className="submenu-item" onClick={() => openCreateModal(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="filter-select" value={segment} onChange={(e) => setSegment(e.target.value)}>
          <option value="">Tous les segments</option>
          <option value="particulier">Particulier</option>
          <option value="entreprise">Entreprise</option>
        </select>

        <select className="filter-select" value={prestation} onChange={(e) => setPrestation(e.target.value)}>
          <option value="">Toutes les prestations</option>
          {Array.from(new Set([...SERVICES.particulier, ...SERVICES.entreprise])).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <div className="pro-date-picker">
            <Calendar size={18} className="calendar-icon" />
            <input
              type="text"
              placeholder="Du"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
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
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="pro-date-input"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="pending-grid">
          {demandes.map((d) => (
            <div key={d.id} className={`pending-card-container ${getRowClass(d)}`}>
              {/* DESKTOP VERSION */}
              <div className="pending-card desktop-card">
                <div className="pending-card-header">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>
                        {d.segment === 'particulier' ? 'PARTICULIER' : 'ENTREPRISE'}
                      </span>
                      {d.assigned_to_name ? (
                        <span className="badge bg-purple-50 text-purple-700 border border-purple-200 font-medium text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                          👤 {d.assigned_to_name}
                        </span>
                      ) : (
                        <span className={`badge ${d.source === 'site' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'} border font-medium text-[10px] px-2 py-0.5 rounded-full`}>
                          {d.source === 'site' ? "En attente d'affectation" : "Non affecté"}
                        </span>
                      )}
                      {d.identification_statut === 'nouvelle' && <span className="badge badge-green" style={{ fontSize: '10px' }}>Nouvelle</span>}
                      {d.identification_statut === 'existant_valide' && <span className="badge badge-teal" style={{ fontSize: '10px' }}>Client existe déjà</span>}
                      {d.identification_statut === 'verification_requise' && <span className="badge badge-orange" style={{ fontSize: '10px' }}>Vérification requise</span>}
                      {d.is_devis && (
                        <span className={`badge ${getDevisStatutMeta(d.devis_statut).cls} font-medium text-[10px] px-2 py-0.5 rounded-full`}>
                          {getDevisStatutMeta(d.devis_statut).label}
                        </span>
                      )}
                      <span className="text-muted text-xs"># {d.id}</span>
                    </div>
                    {d.is_devis && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-600 font-mono">{formatDevisNumber(d.id)}</span>
                        <select
                          className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700"
                          value={d.devis_statut || 'brouillon'}
                          onChange={(e) => handleDevisStatutChange(d.id, e.target.value)}
                          title="Statut du devis"
                        >
                          {DEVIS_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    )}
                    <h3 className="fw-bold">Nom : <span className="text-main">{d.client_name || d.formulaire_data?.nom || 'Non renseigné'}</span></h3>
                  </div>
                  <div className="text-right">
                    {d.created_at && (
                      <p className="text-xs text-slate-500 mb-2 font-mono tracking-widest">
                        {new Date(d.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' à', '')}
                      </p>
                    )}
                    <p className="text-sm fw-medium">
                      Téléphone : <span className="text-main">{d.client_phone || d.formulaire_data?.whatsapp_phone || 'Non renseigné'}</span>
                      {d.source === 'backoffice' && <span className="badge badge-orange ms-1" style={{ fontSize: '10px', padding: '1px 6px', verticalAlign: 'middle' }}>BO</span>}
                    </p>
                    <p className="text-sm fw-medium">WhatsApp : <span className="text-main">{d.client_whatsapp || d.formulaire_data?.whatsapp_phone || d.client_phone}</span></p>
                  </div>
                </div>

                <div className="pending-card-body">
                  <div className="accordion">
                    <div className="accordion-header" onClick={() => toggleSection(d.id, 'details')}>
                      <span>Détails de la prestation</span>
                      {isExpanded(d.id, 'details') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {isExpanded(d.id, 'details') && (
                      <div className="accordion-content">
                        <div className="detail-item"><span className="detail-label">Service :</span> <span className="detail-value text-main-teal fw-bold">{d.service}</span></div>
                        {!(d.service || '').includes('Auxiliaire') && (
                          <div className="detail-item"><span className="detail-label">Type de bien :</span> <span className="detail-value">{d.formulaire_data?.type_habitation || d.formulaire_data?.structure_type || '—'}</span></div>
                        )}
                        <div className="detail-item"><span className="detail-label">Fréquence :</span> <span className="detail-value">{d.frequency_label || (d.frequency === 'oneshot' ? 'Une fois' : 'Abonnement')}</span></div>
                        <div className="detail-item"><span className="detail-label">Durée / Qte :</span> <span className="detail-value">{d.formulaire_data?.duree ? `${d.formulaire_data.duree}h` : (d.formulaire_data?.duration ? `${d.formulaire_data.duration}h` : (d.formulaire_data?.nb_jours ? `${d.formulaire_data.nb_jours} j` : '—'))}</span></div>
                        <div className="detail-item"><span className="detail-label">Intervenants :</span> <span className="detail-value">{d.formulaire_data?.nb_intervenants || d.formulaire_data?.numberOfPeople || d.formulaire_data?.nb_personnel || '—'}</span></div>
                        {(d.service || '').includes('Auxiliaire') ? (
                          <>
                            <div className="detail-item"><span className="detail-label">Âge / Sexe :</span> <span className="detail-value">{d.formulaire_data?.age_personne ? `${d.formulaire_data.age_personne} ans` : '—'} / {d.formulaire_data?.sexe_personne || '—'}</span></div>
                            <div className="detail-item"><span className="detail-label">Mobilité :</span> <span className="detail-value">{d.formulaire_data?.mobilite || '—'}</span></div>
                            <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                              <span className="detail-label">Médical :</span>
                              <span className="detail-value">{d.formulaire_data?.situation_medicale || '—'}</span>
                            </div>
                          </>
                        ) : (
                          !(d.service || '').toLowerCase().includes('standard') && !(d.service || '').toLowerCase().includes('air bnb') && !(d.service || '').toLowerCase().includes('airbnb') && (
                            <div className="detail-item">
                              <span className="detail-label">Surface :</span>
                              <span className="detail-value">{d.formulaire_data?.surface ? `${d.formulaire_data.surface} m²` : (d.formulaire_data?.officeSurface ? `${d.formulaire_data.officeSurface} m²` : (d.formulaire_data?.surfaceArea ? `${d.formulaire_data.surfaceArea} m²` : '—'))}</span>
                            </div>
                          )
                        )}
                        {d.formulaire_data?.details_pieces && (
                          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Pièces :</span> <span className="detail-value">{d.formulaire_data?.details_pieces || '—'}</span></div>
                        )}
                        <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Services opt. :</span> <span className="detail-value">
                          {[
                            (d.formulaire_data?.produits || d.formulaire_data?.additionalServices?.produitsEtOutils) && 'Produits (+90 MAD)',
                            (d.formulaire_data?.torchons || d.formulaire_data?.additionalServices?.torchonsEtSerpierres) && 'Torchons (+40 MAD)',
                            d.formulaire_data?.additionalServices?.nettoyageTerrasse && 'Terrasse (+500 MAD)',
                            d.formulaire_data?.additionalServices?.baiesVitrees && 'Baies Vitrées',
                          ].filter(Boolean).join(', ') || 'Aucun'}
                        </span></div>
                      </div>
                    )}
                  </div>

                  <div className="accordion">
                    <div className="accordion-header" onClick={() => toggleSection(d.id, 'lieux')}>
                      <span>Lieux</span>
                      {isExpanded(d.id, 'lieux') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {isExpanded(d.id, 'lieux') && (
                      <div className="accordion-content">
                        <div className="detail-item"><span className="detail-label">Date :</span> <span className="detail-value">{d.date_intervention || d.formulaire_data?.schedulingDate || '—'}</span></div>
                        {(() => {
                          const hasSchedulingType = !!d.formulaire_data?.schedulingType;
                          const isFixed = hasSchedulingType
                            ? d.formulaire_data?.schedulingType === 'fixed'
                            : !!(d.heure_intervention && d.heure_intervention !== '—') || !!(d.formulaire_data?.fixedTime && d.formulaire_data?.fixedTime !== '');

                          const fixedTime = d.heure_intervention || d.formulaire_data?.fixedTime;
                          const pref = d.preference_horaire || d.formulaire_data?.preference_horaire || d.formulaire_data?.schedulingTime;

                          if (isFixed && fixedTime && fixedTime !== '—') {
                            return <div className="detail-item"><span className="detail-label">Heure :</span> <span className="detail-value">{fixedTime}</span></div>;
                          } else if (!isFixed && pref && pref !== '—') {
                            let prefText = pref;
                            if (pref.toLowerCase() === 'matin' || pref.toLowerCase() === 'morning') prefText = 'Matin (08h–12h)';
                            else if (pref.toLowerCase() === 'aprem' || pref.toLowerCase().includes('apr') || pref.toLowerCase() === 'afternoon') prefText = 'Après-midi (14h–18h)';
                            return <div className="detail-item"><span className="detail-label">Préférence horaire :</span> <span className="detail-value">{prefText}</span></div>;
                          } else if (isFixed) {
                            return <div className="detail-item"><span className="detail-label">Heure :</span> <span className="detail-value">—</span></div>;
                          } else {
                            return <div className="detail-item"><span className="detail-label">Préférence horaire :</span> <span className="detail-value">—</span></div>;
                          }
                        })()}
                        <div className="detail-item"><span className="detail-label">Ville :</span> <span className="detail-value">{d.formulaire_data?.ville || d.formulaire_data?.city || d.client_city || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Quartier :</span> <span className="detail-value">{d.formulaire_data?.quartier || d.formulaire_data?.neighborhood || d.client_neighborhood || '—'}</span></div>
                        <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Adresse :</span> <span className="detail-value">{d.formulaire_data?.adresse || '—'}</span></div>
                      </div>
                    )}
                  </div>

                  <div className="accordion">
                    <div className="accordion-header" onClick={() => toggleSection(d.id, 'notes')}>
                      <span>Notes et précision</span>
                      {isExpanded(d.id, 'notes') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {isExpanded(d.id, 'notes') && (
                      <div className="accordion-content" style={{ gridTemplateColumns: '1fr' }}>
                        {(d.formulaire_data?.notes || d.formulaire_data?.changeRepereNotes || d.formulaire_data?.additionalNotes)
                          ? <p className="text-sm">{[d.formulaire_data?.notes, d.formulaire_data?.changeRepereNotes, d.formulaire_data?.additionalNotes].filter(Boolean).join(' — ')}</p>
                          : <p className="text-sm text-muted italic">Aucune note</p>
                        }
                      </div>
                    )}
                  </div>

                  {/* Duplicate verification block */}
                  {d.identification_statut === 'verification_requise' && d.potential_duplicate_detail && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle size={18} className="text-orange-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-orange-800">Numéro déjà utilisé (vérification requise)</p>
                          <p className="text-xs text-orange-700">Ce numéro est associé à : <span className="font-bold">{d.potential_duplicate_detail.full_name || d.potential_duplicate_detail.first_name + ' ' + d.potential_duplicate_detail.last_name}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button className="btn btn-teal text-xs py-1 px-3" onClick={async () => {
                          try {
                            await confirmerClient(d.id);
                            addToast('Client rattaché avec succès', 'success');
                            fetchDemandes();
                          } catch (e) { addToast('Erreur lors du rattachement', 'error'); }
                        }}>C'est le même client</button>
                        <button className="btn bg-white border border-orange-200 text-orange-700 text-xs py-1 px-3" onClick={async () => {
                          try {
                            await nouveauClient(d.id);
                            addToast('Nouveau client créé (numéro réattribué)', 'success');
                            fetchDemandes();
                          } catch (e) { addToast('Erreur', 'error'); }
                        }}>Nouveau client (réattribué)</button>
                      </div>
                    </div>
                  )}

                  {/* Ownership Alert */}
                  {d.identification_statut === 'existant_valide' && d.client_detail?.assigned_commercial && (
                    <div className="mt-4 p-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2">
                      <UserCheck size={16} className="text-blue-500" />
                      <p className="text-xs text-blue-700 font-medium">Ce client est déjà suivi par l'agence.</p>
                    </div>
                  )}

                  {hasPermission(user, 'creer_devis') && (
                    <div className="accordion mt-3">
                      <div className="accordion-header" onClick={() => toggleSection(d.id, 'devis')}>
                        <span>Préparer le devis</span>
                        {isExpanded(d.id, 'devis') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                      {isExpanded(d.id, 'devis') && (
                        <div className="accordion-content" style={{ display: 'block' }}>
                          <QuoteSection 
                            demande={d} 
                            onPreview={handlePreviewDocument}
                            onSend={handleDirectSendWhatsApp}
                            onUpdateDemandeData={handleQuoteUpdate}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pending-footer" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className="detail-item">
                        <span className="detail-label">Montant :</span>
                        <span className="detail-value text-main-teal fw-bold" style={{ fontSize: '0.9rem' }}>
                          {d.is_devis ? (d.prix ? `${d.prix} MAD` : 'Sur devis') : (d.prix ? `${d.prix} MAD` : '—')}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Mode :</span>
                        <span className="detail-value">{d.mode_paiement || '—'}</span>
                      </div>
                    </div>
                    <div className="self-end" style={{ paddingBottom: '2px' }}>
                      <span className="text-[13px] font-bold text-slate-800">
                        {d.assigned_to_name ? `Affecté à commercial(${d.assigned_to_name})` : (d.source === 'site' ? "En attente d'affectation" : "Non affecté")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-1 flex gap-2">
                  <button className="btn btn-nrp flex-1 leading-tight px-1 py-2 text-[13px] text-center" onClick={() => handleAction(d.id, 'nrp')}>
                    NRP ({d.nrp_count ?? 0})
                  </button>
                  {canRefuseDemande(user, d) && (
                    <button className="btn btn-cancel flex-1 leading-tight px-1 py-2 text-[13px] text-center" onClick={() => handleAction(d.id, 'annuler')}>Annulé</button>
                  )}
                  {canValidateDemande(user, d) && (
                    <button className="btn btn-validate flex-[1.5] leading-tight px-1 py-2 text-[13px] text-center" onClick={() => handleAction(d.id, 'valider')}>Valider demande</button>
                  )}
                  {canModifyDemande(user, d) && (
                    <button className="btn btn-edit flex-1 flex justify-center items-center px-1 py-2 text-[13px] text-center" title="Modifier" onClick={() => openEditModal(d)}>
                      Modifier
                    </button>
                  )}

                  {checkPermission(user, 'affecter_commercial').allowed && (
                    <button className="btn transition-all flex-1 text-[13px] leading-tight px-1 py-2 text-center flex items-center justify-center"
                      style={{ backgroundColor: '#fdf4ff', color: '#c026d3', border: '1px solid #f0abfc' }}
                      onClick={() => setShowAssignmentModal(d.id)}>
                      Affecter
                    </button>
                  )}
                </div>
              </div>

              {/* MOBILE VERSION */}
              <div className="pending-card mobile-card">
                <div className="mobile-card-header">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>
                        {d.segment === 'particulier' ? 'PARTICULIER' : 'ENTREPRISE'}
                      </span>
                      {d.assigned_to_name ? (
                        <span className="badge bg-purple-50 text-purple-700 border border-purple-200 font-medium text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1">
                          👤 {d.assigned_to_name}
                        </span>
                      ) : (
                        <span className={`badge ${d.source === 'site' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200'} border font-medium text-[9px] px-2 py-0.5 rounded-full`}>
                          {d.source === 'site' ? "En attente d'affectation" : "Non affecté"}
                        </span>
                      )}
                      {d.is_devis && (
                        <span className={`badge ${getDevisStatutMeta(d.devis_statut).cls} font-medium text-[9px] px-2 py-0.5 rounded-full`}>
                          {getDevisStatutMeta(d.devis_statut).label}
                        </span>
                      )}
                      <span className="text-muted text-xs">#{d.id}</span>
                    </div>
                    {d.created_at && (
                      <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                        {new Date(d.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' à', '')}
                      </span>
                    )}
                  </div>
                  {d.is_devis && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-slate-600 font-mono">{formatDevisNumber(d.id)}</span>
                      <select
                        className="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700"
                        value={d.devis_statut || 'brouillon'}
                        onChange={(e) => handleDevisStatutChange(d.id, e.target.value)}
                        title="Statut du devis"
                      >
                        {DEVIS_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  )}
                  <h3 className="mobile-client-name">{d.client_name || d.formulaire_data?.nom || 'Nom inconnu'}</h3>
                  <div className="mobile-contact-info">
                    <a href={`tel:${d.client_phone || d.formulaire_data?.whatsapp_phone || ''}`} className="mobile-contact-link">
                      📞 {d.client_phone || d.formulaire_data?.whatsapp_phone || 'Non renseigné'}
                      {d.source === 'backoffice' && <span className="badge badge-orange ms-1" style={{ fontSize: '9px', padding: '0px 4px' }}>BO</span>}
                    </a>
                    <a href={`https://wa.me/${(d.client_whatsapp || d.formulaire_data?.whatsapp_phone || d.client_phone || '').replace(/\+/g, '')}`} target="_blank" rel="noreferrer" className="mobile-contact-link mobile-wa-link">📱 WhatsApp</a>
                  </div>
                </div>

                <div className="mobile-card-body">
                  <div className="mobile-detail-row">
                    <span className="mobile-detail-label">Service</span>
                    <span className="mobile-detail-value fw-bold text-primary">{d.service}</span>
                  </div>
                  {d.formulaire_data?.surface && !(d.service || '').toLowerCase().includes('standard') && !(d.service || '').toLowerCase().includes('air bnb') && !(d.service || '').toLowerCase().includes('airbnb') && (
                    <div className="mobile-detail-row">
                      <span className="mobile-detail-label">Surface</span>
                      <span className="mobile-detail-value">{d.formulaire_data?.surface || '—'} m²</span>
                    </div>
                  )}

                  {d.formulaire_data?.structure_type && !(d.service || '').includes('Auxiliaire') && (
                    <div className="mobile-detail-row">
                      <span className="mobile-detail-label">Structure</span>
                      <span className="mobile-detail-value">{d.formulaire_data?.structure_type || '—'}</span>
                    </div>
                  )}
                  {d.service.includes('Auxiliaire') && (
                    <div className="mobile-detail-row">
                      <span className="mobile-detail-label">Profil</span>
                      <span className="mobile-detail-value">{d.formulaire_data?.age_personne} ans ({d.formulaire_data?.sexe_personne})</span>
                    </div>
                  )}
                  <div className="mobile-detail-row">
                    <span className="mobile-detail-label">Date</span>
                    <span className="mobile-detail-value">{d.date_intervention} {d.heure_intervention}</span>
                  </div>
                  <div className="mobile-detail-row">
                    <span className="mobile-detail-label">Lieu</span>
                    <span className="mobile-detail-value">
                      {[d.formulaire_data?.quartier || d.client_neighborhood, d.formulaire_data?.ville || d.client_city].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                  <div className="mobile-detail-row mobile-price-row">
                    <span className="mobile-detail-label">Montant</span>
                    <span className="mobile-detail-value fw-bold">
                      {d.is_devis ? (d.prix ? `${d.prix} MAD` : 'Sur devis') : (d.prix ? `${d.prix} MAD` : '—')}
                      {!d.is_devis && d.mode_paiement && <span className="text-xs text-muted fw-normal"> ({d.mode_paiement})</span>}
                    </span>
                  </div>
                  {hasPermission(user, 'creer_devis') && (
                    <div className="accordion mt-3">
                      <div className="accordion-header" onClick={() => toggleSection(d.id, 'devis')}>
                        <span>Préparer le devis</span>
                        {isExpanded(d.id, 'devis') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                      {isExpanded(d.id, 'devis') && (
                        <div className="accordion-content" style={{ display: 'block' }}>
                          <QuoteSection 
                            demande={d} 
                            onPreview={handlePreviewDocument}
                            onSend={handleDirectSendWhatsApp}
                            onUpdateDemandeData={handleQuoteUpdate}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mobile-card-actions">
                  {canValidateDemande(user, d) && (
                    <button className="btn btn-validate btn-full mb-2" onClick={() => handleAction(d.id, 'valider')}>
                      <CheckCircle size={18} /> Valider
                    </button>
                  )}
                  <div className="flex gap-2">
                    <button className="btn btn-nrp flex-1" onClick={() => handleAction(d.id, 'nrp')}>
                      NRP ({d.nrp_count ?? 0})
                    </button>
                    {canRefuseDemande(user, d) && (
                      <button className="btn btn-cancel flex-1" onClick={() => handleAction(d.id, 'annuler')}>Annuler</button>
                    )}
                    {canModifyDemande(user, d) && (
                      <button className="btn btn-edit flex-none px-3" title="Modifier" onClick={() => openEditModal(d)}>
                        <Edit size={16} />
                      </button>
                    )}

                    {checkPermission(user, 'affecter_commercial').allowed && (
                      <button className="btn transition-all flex items-center justify-center p-2"
                        style={{ backgroundColor: '#fdf4ff', color: '#c026d3', border: '1px solid #f0abfc', borderRadius: '4px' }}
                        onClick={() => setShowAssignmentModal(d.id)}>
                        <UserPlus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {demandes.length === 0 && !loading && (
        <div className="empty-state">
          <CheckCircle size={48} className="text-green" />
          <h3>Toutes les demandes ont été traitées</h3>
          <p>Aucune demande en attente pour le moment.</p>
        </div>
      )}

      {/* Modal de Création */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl fw-bold">{isRenewal ? 'Renouveler' : editingDemande ? 'Modifier' : 'Nouvelle'} demande : {selectedService}</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}><XCircle size={24} /></button>
            </div>
            <div className="modal-body">
              <form className={`${formSubmitted ? 'submitted' : ''}`} id="create-request-form" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* ====== CONDITIONAL SERVICE SECTIONS ====== */}
                {isAuxiliaireService ? (
                  /* Auxiliaire de vie - Service sur mesure */
                  <>
                    <div className="ws-form-block">
                      <div className="ws-section-header">Choisissez la fréquence</div>
                      <div className="p-4" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                        <div className="ws-radio-pills" style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '9999px', margin: '0 auto', maxWidth: '400px' }}>
                          {['une fois', 'abonnement'].map(freq => {
                            const isSelected = (formData.frequence === 'une fois' && freq === 'une fois') || (formData.frequence !== 'une fois' && formData.frequence !== '' && freq === 'abonnement');
                            return (
                              <label key={freq} style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '0.75rem', borderRadius: '9999px', fontWeight: 'bold', transition: 'all 0.2s', background: isSelected ? 'var(--primary)' : 'transparent', color: isSelected ? 'white' : '#64748b' }}>
                                <input type="radio" name="frequence_type" value={freq} style={{ display: 'none' }}
                                  checked={isSelected}
                                  onChange={() => {
                                    if (freq === 'une fois') setFormData({ ...formData, frequence: 'une fois' });
                                    else setFormData({ ...formData, frequence: '1/sem' });
                                  }} />
                                <span>{freq === 'une fois' ? 'Une fois' : 'Abonnement'}</span>
                              </label>
                            );
                          })}
                        </div>
                        {formData.frequence !== 'une fois' && formData.frequence !== '' && (
                          <div style={{ marginTop: '1.5rem', maxWidth: '400px', margin: '1.5rem auto 0' }}>
                            <select className="ws-select" required value={formData.frequence} onChange={e => setFormData({ ...formData, frequence: e.target.value })} style={{ width: '100%' }}>
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
                        <button type="button" onClick={() => setFormData({ ...formData, nb_personnel: Math.max(1, (formData.nb_personnel || 1) - 1) })} style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>−</button>
                        <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)', minWidth: '40px', textAlign: 'center' }}>{formData.nb_personnel || 1}</span>
                        <button type="button" onClick={() => setFormData({ ...formData, nb_personnel: (formData.nb_personnel || 1) + 1 })} style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>

                    <div className="ws-form-block">
                      <div className="ws-section-header">Planning de la demande</div>
                      <div className="p-6" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div style={{ textAlign: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.875rem', cursor: 'pointer' }}>
                              <input type="radio" name="scheduling_type" value="fixed" checked={formData.scheduling_type === 'fixed'} onChange={() => setFormData({ ...formData, scheduling_type: 'fixed' })} />
                              Je souhaite une heure fixe
                            </label>
                            <input type="time" disabled={formData.scheduling_type !== 'fixed'} value={formData.heure || ''} onChange={e => setFormData({ ...formData, heure: e.target.value })} style={{ marginTop: '1rem', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'center', width: '120px' }} />
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.875rem', cursor: 'pointer' }}>
                              <input type="radio" name="scheduling_type" value="flexible" checked={formData.scheduling_type === 'flexible'} onChange={() => setFormData({ ...formData, scheduling_type: 'flexible' })} />
                              Je suis flexible
                            </label>
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                <input type="radio" name="preference_horaire" value="matin" disabled={formData.scheduling_type !== 'flexible'} checked={formData.preference_horaire === 'matin'} onChange={() => setFormData({ ...formData, preference_horaire: 'matin' })} />
                                Le matin
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                <input type="radio" name="preference_horaire" value="apres_midi" disabled={formData.scheduling_type !== 'flexible'} checked={formData.preference_horaire === 'apres_midi'} onChange={() => setFormData({ ...formData, preference_horaire: 'apres_midi' })} />
                                L'après midi
                              </label>
                            </div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <label style={{ fontWeight: 'bold', color: 'var(--primary)', display: 'block', marginBottom: '1rem', fontSize: '0.875rem' }}>Date</label>
                            <input type="date" value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', width: '100%', maxWidth: '200px' }} />
                          </div>
                        </div>

                        <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '1.5rem', marginTop: '1.5rem', textAlign: 'center' }}>
                          <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '1rem' }}>Nombre de jours</label>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '1.5rem', background: 'white', padding: '0.5rem 1.5rem', borderRadius: '9999px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <button type="button" onClick={() => setFormData({ ...formData, nb_jours: Math.max(1, formData.nb_jours - 1) })} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>−</button>
                            <span style={{ fontWeight: 'bold', color: '#334155', fontSize: '0.875rem', textTransform: 'uppercase' }}>{formData.nb_jours || 1} JOUR(S)</span>
                            <button type="button" onClick={() => setFormData({ ...formData, nb_jours: (formData.nb_jours || 1) + 1 })} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>+</button>
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
                              <input type="number" placeholder="Âge de la personne" required value={formData.age_personne || ''} onChange={e => setFormData({ ...formData, age_personne: e.target.value })} style={{ width: '100%', padding: '0.5rem 3rem 0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', fontWeight: 'bold', color: '#94a3b8' }}>ANS</span>
                            </div>
                          </div>
                          <div>
                            <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Sexe :</label>
                            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                <input type="radio" name="sexe_personne" value="femme" checked={formData.sexe_personne === 'femme'} onChange={() => setFormData({ ...formData, sexe_personne: 'femme' })} />
                                Femme
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500' }}>
                                <input type="radio" name="sexe_personne" value="homme" checked={formData.sexe_personne === 'homme'} onChange={() => setFormData({ ...formData, sexe_personne: 'homme' })} />
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
                                  <input type="radio" name="mobilite" value={mob} checked={isMobilityMatching(formData.mobilite, mob)} onChange={() => setFormData({ ...formData, mobilite: mob })} />
                                  {mob}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Pathologie :</label>
                            <textarea rows={5} placeholder="Détaillez ici la situation médicale..." required value={formData.situation_medicale || ''} onChange={e => setFormData({ ...formData, situation_medicale: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.875rem', resize: 'none' }}></textarea>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ws-form-block">
                      <div className="ws-section-header">Autre précision</div>
                      <div className="p-4" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                        <textarea rows={3} placeholder="Ex: besoin d'un auxiliaire de vie homme, barrière de langue, régime particulier..." value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ width: '100%', minHeight: '80px', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem', fontSize: '0.875rem', resize: 'none' }}></textarea>
                      </div>
                    </div>

                    <div className="ws-form-block">
                      <div className="ws-section-header">Lieu de la garde</div>
                      <div className="p-4" style={{ backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #f1f5f9', marginTop: '1rem' }}>
                        <div className="grid grid-cols-3 gap-4">
                          {['domicile', 'clinique', 'hopital'].map(loc => (
                            <label key={loc} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.75rem', borderRadius: '0.75rem', border: formData.lieu_garde === loc ? '2px solid var(--primary)' : '2px solid transparent', background: formData.lieu_garde === loc ? 'white' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.2s' }}>
                              <input type="radio" name="careLocation" value={loc} style={{ marginBottom: '0.5rem' }} checked={formData.lieu_garde === loc} onChange={e => setFormData({ ...formData, lieu_garde: e.target.value })} />
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
                      serviceKey={selectedServiceKey}
                      formData={formData}
                      setFormData={setFormData}
                      minDuree={minDuree}
                      estimatedResources={estimatedResources}
                      activeSegment={activeSegment}
                    />
                  </>
                )}


                {/* ====== LOCALISATION (all services) ====== */}
                <div className="ws-form-block">
                  <div className="ws-section-header">Où aura lieu votre {isCleaningService ? 'ménage' : 'intervention'} ?</div>
                  <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                    <div className="form-group">
                      <label className="label-teal">Ville *</label>
                      <select className="ws-select" required value={formData.ville} onChange={e => setFormData({ ...formData, ville: e.target.value, quartier: '' })}>
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
                        value={formData.quartier}
                        onChange={e => setFormData({ ...formData, quartier: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="label-teal">Adresse / Repères</label>
                      <textarea rows={2} placeholder="Donnez-nous des repères pour faciliter l'intervention..." value={formData.adresse} onChange={e => setFormData({ ...formData, adresse: e.target.value })}></textarea>
                    </div>
                  </div>
                  {['Bouskoura', 'Dar Bouazza', 'Mansouria', 'Almaz', 'Sidi Rahal', 'Benslimane', 'Mohammédia', 'Ville Verte'].includes(formData.ville) && (
                    <div className="ws-surcharge-notice">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      <p>Un supplément de <strong>50 MAD</strong> sera facturé pour cette zone géographique.</p>
                    </div>
                  )}
                </div>

                {/* ====== INFORMATIONS CLIENT ====== */}
                <div className="ws-form-block">
                  <div className="ws-section-header">Mes informations</div>
                  <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                    {activeSegment === 'entreprise' && (
                      <>
                        <div className="form-group">
                          <label className="label-teal">Nom entreprise *</label>
                          <input type="text" required placeholder="Nom de l'entreprise" value={formData.entity_name} onChange={e => setFormData({ ...formData, entity_name: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="label-teal">Personne de contact *</label>
                          <input type="text" required placeholder="Nom du contact" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value, nom: e.target.value })} />
                        </div>
                      </>
                    )}
                    {activeSegment === 'particulier' && (
                      <div className="form-group">
                        <label className="label-teal">Nom complet *</label>
                        <input type="text" required placeholder="Ex: Jean Dupont" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} />
                      </div>
                    )}
                    <div className="form-group">
                      <label className="label-teal">Numéro de téléphone *</label>
                      <div className="flex gap-2">
                        <input type="text" defaultValue="+212" className="phone-prefix" style={{ width: '80px' }} required />
                        <input
                          type="text"
                          className="flex-1 phone-number"
                          placeholder="6 12 00 00 00"
                          value={directPhone}
                          required
                          onChange={(e) => {
                            const val = e.target.value;
                            setDirectPhone(val);
                            if (syncWhatsApp) setWhatsappPhone(val);
                          }}
                        />
                      </div>
                      <label className="custom-checkbox-container" style={{ marginTop: '4px' }}>
                        <input type="checkbox" checked={syncWhatsApp} onChange={(e) => { const checked = e.target.checked; setSyncWhatsApp(checked); if (checked) setWhatsappPhone(directPhone); }} />
                        <span className="checkbox-checkmark"></span>
                        <span className="checkbox-label">Utilisez-vous ce numéro pour WhatsApp ?</span>
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="label-teal">Numéro WhatsApp</label>
                      <div className="flex gap-2">
                        <input type="text" defaultValue="+212" className="phone-prefix" style={{ width: '80px' }} disabled={syncWhatsApp} />
                        <input type="text" className="flex-1 phone-number" placeholder="6 12 00 00 00" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} disabled={syncWhatsApp} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="label-teal">Email</label>
                      <input type="email" placeholder="nom@domaine.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label-teal">Comment le client a connu l'agence ?</label>
                      <select className="ws-select" value={formData.heard_about_us} onChange={e => setFormData({ ...formData, heard_about_us: e.target.value })}>
                        <option value="">Choisir...</option>
                        <option value="google">Recherche Google</option>
                        <option value="facebook">Facebook</option>
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="recommandation">Bouche-à-oreille / Recommandation</option>
                        <option value="partenariat">Partenariat</option>
                        <option value="passage">Passage devant l'agence</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ====== TARIFICATION & PAIEMENT ====== */}
                <div className="ws-form-block">
                  <div className="ws-section-header" style={{ background: '#547d7c' }}>Tarification & Paiement</div>
                  <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                    <div className="form-group">
                      <label className="label-teal">Montant total (MAD) {calculatedPrice !== 'Sur devis' && '*'}</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          placeholder={calculatedPrice && calculatedPrice !== 'Sur devis' ? calculatedPrice : "0.00"} 
                          required={calculatedPrice !== 'Sur devis'} 
                          value={formData.montant} 
                          onChange={e => setFormData({ ...formData, montant: e.target.value })} 
                        />
                        {calculatedPrice && calculatedPrice !== 'Sur devis' && formData.montant !== calculatedPrice && (
                          <button 
                            type="button"
                            onClick={() => setFormData({ ...formData, montant: calculatedPrice })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded hover:bg-teal-700 transition-colors"
                            title="Réappliquer le prix calculé"
                          >
                            Calculé: {calculatedPrice}
                          </button>
                        )}
                        {calculatedPrice === 'Sur devis' && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 italic">
                            Prix sur devis
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="label-teal">Mode de paiement *</label>
                      <select className="ws-select" required value={formData.mode_paiement} onChange={e => setFormData({ ...formData, mode_paiement: e.target.value })}>
                        <option value="">Choisir...</option>
                        <option value="virement">Par virement</option>
                        <option value="cheque">Par chèque</option>
                        <option value="especes">En espèces</option>
                        <option value="carte">Par carte bancaire (solution de paiement en ligne)</option>
                      </select>
                    </div>

                  </div>
                </div>

                {/* ====== NOTES ====== */}
                <div className="ws-form-block">
                  <div className="ws-section-header" style={{ background: '#64748b' }}>Notes</div>
                  <textarea rows={3} placeholder="Notes ou précisions additionnelles..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ width: '100%', padding: '0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '0.9rem' }}></textarea>
                </div>

                {editingDemande && (
                  <div className="form-section full-width mt-8 pt-4 mb-2">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Historique des documents</h3>
                      {editingDemande.documents && editingDemande.documents.length > 0 && (
                        <span style={{ fontSize: 11, padding: '2px 10px', background: '#f0fdf4', color: '#0d9488', borderRadius: 999, border: '1px solid #ccfbf1', fontWeight: 600 }}>{editingDemande.documents.length} fichier{editingDemande.documents.length > 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {editingDemande.documents && editingDemande.documents.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {editingDemande.documents.map(doc => {
                          const createdAt = doc.created_at ? new Date(doc.created_at.replace(' ', 'T')).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                          const isDevis = doc.type_document === 'devis';
                          const fileName = doc.nom || (isDevis ? 'Devis PDF' : 'Récapitulatif PNG');
                          const handleOpen = async (e: React.MouseEvent) => {
                            e.preventDefault();
                            if (!doc.download_url) { addToast('Fichier non disponible', 'error'); return; }
                            try {
                              addToast('Chargement du document...', 'info');
                              const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
                              setShowPreviewModal({ url: blobUrl, type: isDevis ? 'devis' : 'png', name: fileName, demandeId: editingDemande.id });
                            } catch (e) { console.error(e); addToast('Erreur lors du chargement', 'error'); }
                          };
                          const handleDownload = async (e: React.MouseEvent) => {
                            e.preventDefault();
                            if (!doc.download_url) { addToast('Fichier non disponible', 'error'); return; }
                            try {
                              const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
                              const a = document.createElement('a');
                              a.href = blobUrl;
                              a.download = fileName;
                              a.click();
                              URL.revokeObjectURL(blobUrl);
                            } catch (e) { console.error(e); addToast('Erreur lors du téléchargement', 'error'); }
                          };
                          return (
                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', gap: 12, transition: 'background 0.15s' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isDevis ? '#fee2e2' : '#ccfbf1' }}>
                                  <FileText size={18} style={{ color: isDevis ? '#ef4444' : '#0d9488' }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <p style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{fileName}</p>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: isDevis ? '#fee2e2' : '#ccfbf1', color: isDevis ? '#ef4444' : '#0d9488', letterSpacing: '0.05em', textTransform: 'uppercase' as const, flexShrink: 0 }}>{isDevis ? 'PDF' : 'PNG'}</span>
                                  </div>
                                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0 0' }}>Généré le {createdAt}</p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <button type="button" onClick={handleOpen} title="Aperçu"
                                  style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#0d9488', cursor: 'pointer', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f0fdf4'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#0d9488'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db'; }}
                                >
                                  <Eye size={15} />
                                </button>
                                <button type="button" onClick={handleDownload} title="Télécharger"
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
                )}
              </form>
            </div>

            <div className={`modal-footer ${editingDemande ? 'border-t pt-6 bg-white' : ''}`}>
              {editingDemande ? (
                <div className="flex gap-3 w-full justify-end">
                  <button className="btn transition-all flex items-center" style={{ border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#0f766e', fontWeight: 500, padding: '8px 24px', borderRadius: '4px' }} type="button" onClick={() => setShowCreateModal(false)}>
                    Annuler
                  </button>
                  <button className="btn transition-all flex items-center gap-2" style={{ backgroundColor: '#f1f5f9', color: '#0f766e', fontWeight: 500, padding: '8px 16px', borderRadius: '4px', border: 'none' }} type="button" onClick={() => {
                    if (editingDemande) {
                      const updated = getUpdatedDemandeFromForm(editingDemande);
                      handlePreviewDocument(updated, isDevisRequired(updated) ? 'devis' : 'png');
                    }
                  }}>
                    <Eye size={16} /> Aperçu du {isDevisRequired(editingDemande) ? 'Devis' : 'Récapitulatif'}
                  </button>
                  <button className="btn flex items-center gap-2" style={{ backgroundColor: '#0f766e', color: 'white', fontWeight: 500, padding: '8px 24px', borderRadius: '4px', border: 'none' }} type="button" onClick={handleCreateDemande}>
                    <Save size={16} /> Enregistrer
                  </button>
                </div>
              ) : (
                <>
                  <button className="btn btn-secondary" type="button" onClick={() => setShowCreateModal(false)}>Annuler</button>
                  <button className="btn btn-primary" type="button" onClick={handleCreateDemande} style={{ backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }}>
                    Ajouter la demande
                  </button>
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
                  const initials = (comm.full_name || `${comm.first_name} ${comm.last_name}`).split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
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
                        fetchDemandes();
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
                        fetchDemandes();
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
                      fetchDemandes();
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
    </div>
  );
}

