import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getDemandes, validerDemande, annulerDemande, nrpDemande, createDemande, updateDemande, affecterDemande, getUsers, generateDocument, fetchSecureDocBlob, sendWhatsApp } from '../api/client';
import { useNotificationStore, useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import {
  RefreshCw, Search, XCircle,
  Calendar,
  FileText, Save, Download, Eye, Plus, ChevronDown, ChevronUp, CheckCircle, Edit, UserPlus, Send
} from 'lucide-react';
import { Demande } from '../types';
import { normalizeFrequence, normalizePayment, normalizeStructure, normalizeTimePref, normalizeMobilite, normalizeSexe, normalizeQuartier } from '../utils/formNormalizers';

const isDevisRequired = (d: Demande | null) => {
  if (!d) return false;
  if (d.segment === 'entreprise') return true;
  const devisParticuliers = ['Ménage Air BnB', 'Ménage post-sinistre', 'Auxiliaire de vie', 'Ménage fin chantier', 'Nettoyage fin de chantier'];
  return devisParticuliers.includes(d.service);
};

const normalizeServiceLabel = (value: string) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();


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
    mode_paiement: '',
    statut_paiement: 'non_paye',
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
      cuisine: 1,
      suiteAvecBain: 0,
      suiteSansBain: 0,
      salleDeBain: 1,
      chambre: 1,
      salonMarocain: 0,
      salonEuropeen: 1,
      toilettesLavabo: 0,
      rooftop: 0,
      escalier: 0
    } as Record<string, number>
  });

  const { user } = useAuthStore();
  const { setPendingCount } = useNotificationStore();
  const { addToast } = useToastStore();

  const [commerciaux, setCommerciaux] = useState<any[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState<number | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string, type: 'devis' | 'png', name: string, demandeId: number } | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const selectedServiceKey = normalizeServiceLabel(selectedService);
  const isAuxiliaireService = selectedServiceKey.includes('auxiliaire de vie');
  const isPlacementGestionService = selectedServiceKey.includes('placement & gestion') || selectedServiceKey.includes('placement et gestion');
  const isCleaningService = selectedServiceKey.includes('menage') || selectedServiceKey.includes('nettoyage');
  const isMenageBureauxService = selectedServiceKey.includes('menage bureaux');
  const isPostSinistreService = selectedServiceKey.includes('post-sinistre') || selectedServiceKey.includes('post sinistre');
  const isPostDemenagementService = selectedServiceKey.includes('post-demenagement') || selectedServiceKey.includes('post demenagement');
  const isMenageStandardService = selectedServiceKey.includes('menage standard');
  const isGrandMenageService = selectedServiceKey.includes('grand menage');
  const isMenageAirBnBService = selectedServiceKey.includes('air bnb') || selectedServiceKey.includes('airbnb');
  const isFinChantierService = selectedServiceKey.includes('fin de chantier') || selectedServiceKey.includes('fin chantier');
  const minDuree = isGrandMenageService ? 6 : isMenageBureauxService ? 2 : 4;

  // Fecth Commerciaux for Assignation
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'responsable_commercial') {
      getUsers({ role: 'commercial' }).then(res => {
        setCommerciaux(Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []));
      }).catch(err => console.error('Erreur commerciaux:', err));
    }
  }, [user]);

  // Handle external edit request (from Clients list)
  useEffect(() => {
    const state = location.state as { editDemandeId?: number } | null;
    if (state?.editDemandeId && demandes.length > 0 && !editingDemande) {
      const target = demandes.find(d => d.id === state.editDemandeId);
      if (target) {
        openEditModal(target);
        // Clear state to prevent reopening
        navigate(location.pathname, { replace: true, state: {} });
      } else {
        // Optionnel: si non trouvé dans la liste courante (ex: déjà validée)
        addToast("La demande n'est plus en attente ou est introuvable.", 'info');
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, demandes, editingDemande, navigate, location.pathname]);

  const getRowClass = (d: Demande) => {
    if (d.statut_paiement === 'integral') return 'row-status-paye';
    if (d.statut_paiement === 'partiel') return 'row-status-partielle';
    if (d.statut === 'annule') return 'row-status-annulee';
    // For pending view, almost everything is 'en_attente' so we use Blue row status
    return 'row-status-encours';
  };

  const handleAffecter = async (demandeId: number, commercialId: number) => {
    try {
      await affecterDemande(demandeId, commercialId);
      addToast('Demande affectée avec succès', 'success');
      setShowAssignmentModal(null);
      fetchDemandes();
    } catch (err) {
      addToast('Erreur lors de l\'affectation', 'error');
    }
  };

  const handlePreviewDocument = async (demandeId: number, type: 'devis' | 'png') => {
    try {
      addToast(`Génération du ${type === 'devis' ? 'devis' : 'récapitulatif'} sur le serveur...`, 'info');
      const response = await generateDocument(demandeId, type);
      const doc = response.data;

      // Utilise le download_url sécurisé — jamais le chemin physique
      const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
      setShowPreviewModal({ url: blobUrl, type: type === 'devis' ? 'devis' : 'png', name: doc.nom, demandeId });
      fetchDemandes(); // Refresh list to show generated file in history
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

  const fetchDemandes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDemandes({ statut: 'en_attente' });
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
    if (cardState === undefined) return true; // Default open
    return cardState[section] !== false;
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

  const handleAction = async (id: number, action: 'valider' | 'nrp' | 'annuler') => {
    try {
      if (action === 'valider') {
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
            nrp_count: Number.isFinite(serverCount) ? serverCount : fallbackCount,
          };
        }));
        addToast('NRP incrémenté', 'info');
        return;
      }
      else if (action === 'annuler') {
        const reason = prompt('Motif d\'annulation :');
        if (reason === null) return;
        await annulerDemande(id, reason);
        addToast('Demande annulée', 'error');
      }
      await fetchDemandes();
    } catch (err) {
      console.error(err);
      addToast('Une erreur est survenue lors de l\'action.', 'error');
    }
  };

  const openCreateModal = (service: string) => {
    setSelectedService(service);
    setEditingDemande(null);
    setDirectPhone('');
    setWhatsappPhone('');
    setFormData({
      nom: '', email: '', entity_name: '', contact_person: '', ville: 'Casablanca', quartier: '', adresse: '', date: '', heure: '',
      scheduling_type: 'fixed', preference_horaire: '', type_habitation: '', frequence: '', intervention_nature: 'sinistre', accommodation_state: '', cleanliness_type: '', nb_intervenants: 1,
      surface: 50, details_pieces: '', duree: 4, produits: false, torchons: false,
      montant: '', mode_paiement: '', statut_paiement: 'non_paye', heard_about_us: '', notes: '',
      service_type: 'flexible', structure_type: '', nb_personnel: 1,
      lieu_garde: 'domicile', age_personne: '', sexe_personne: '',
      mobilite: '', situation_medicale: '', nb_jours: 1,
      rooms: {
        cuisine: 1, suiteAvecBain: 0, suiteSansBain: 0, salleDeBain: 1, chambre: 1,
        salonMarocain: 0, salonEuropeen: 1, toilettesLavabo: 0, rooftop: 0, escalier: 0
      }
    });
    setShowCreateModal(true);
    setShowNewMenu(false);
  };

  const openEditModal = (d: Demande) => {
    setEditingDemande(d);
    setSelectedService(d.service);
    setActiveSegment(d.segment);
    setDirectPhone(d.client_phone);
    setWhatsappPhone(d.formulaire_data?.whatsapp_phone || d.client_phone);
    setSyncWhatsApp(!d.formulaire_data?.whatsapp_phone || d.formulaire_data?.whatsapp_phone === d.client_phone);

    setFormData({
      nom: d.client_name || d.formulaire_data?.nom || d.formulaire_data?.fullName || '',
      email: d.formulaire_data?.email || d.client_details?.email || '',
      entity_name: d.formulaire_data?.entityName || d.formulaire_data?.entity_name || '',
      contact_person: d.formulaire_data?.contactPerson || d.formulaire_data?.contact_person || '',
      ville: d.formulaire_data?.ville || d.client_city || 'Casablanca',
      quartier: normalizeQuartier(d.formulaire_data?.quartier || d.client_neighborhood || ''),
      adresse: d.formulaire_data?.adresse || '',
      date: d.date_intervention || d.formulaire_data?.date || d.formulaire_data?.scheduledDate || '',
      heure: d.heure_intervention || d.formulaire_data?.heure || d.formulaire_data?.fixedTime || '',
      scheduling_type: d.heure_intervention || d.formulaire_data?.heure || d.formulaire_data?.fixedTime ? 'fixed' : 'flexible',
      preference_horaire: normalizeTimePref(d.preference_horaire || d.formulaire_data?.preference_horaire || (d.formulaire_data?.schedulingTime === 'morning' ? 'matin' : d.formulaire_data?.schedulingTime === 'afternoon' ? 'apres_midi' : '')),
      type_habitation: normalizeStructure(d.formulaire_data?.type_habitation || ''),
      frequence: normalizeFrequence(d.frequency_label || d.formulaire_data?.frequence || (d.frequency === 'oneshot' ? 'une fois' : 'mensuel')),
      intervention_nature: d.formulaire_data?.interventionNature || d.formulaire_data?.intervention_nature || 'sinistre',
      accommodation_state: d.formulaire_data?.accommodationState || d.formulaire_data?.accommodation_state || '',
      cleanliness_type: d.formulaire_data?.cleanlinessType || d.formulaire_data?.cleanliness_type || '',
      nb_intervenants: d.formulaire_data?.nb_intervenants || d.formulaire_data?.nb_personnel || 1,
      surface: d.formulaire_data?.surface || 50,
      details_pieces: d.formulaire_data?.details_pieces || '',
      duree: d.formulaire_data?.duree || d.formulaire_data?.nb_heures || 4,
      produits: d.formulaire_data?.produits || d.formulaire_data?.produitsEtOutils || false,
      torchons: d.formulaire_data?.torchons || d.formulaire_data?.torchonsEtSerpierres || false,
      montant: d.prix?.toString() || d.formulaire_data?.montant || '',
      mode_paiement: normalizePayment(d.mode_paiement || d.formulaire_data?.mode_paiement || ''),
      statut_paiement: normalizePayment(d.statut_paiement || d.formulaire_data?.statut_paiement || 'non_paye'),
      heard_about_us: d.formulaire_data?.heard_about_us || d.formulaire_data?.comment_connu || d.formulaire_data?.lead_source || '',
      notes: d.formulaire_data?.notes || '',
      service_type: d.formulaire_data?.service_type || 'flexible',
      structure_type: normalizeStructure(d.formulaire_data?.structure_type || ''),
      nb_personnel: d.formulaire_data?.nb_personnel || 1,
      lieu_garde: d.formulaire_data?.lieu_garde || 'domicile',
      age_personne: d.formulaire_data?.age_personne || '',
      sexe_personne: normalizeSexe(d.formulaire_data?.sexe_personne || ''),
      mobilite: normalizeMobilite(d.formulaire_data?.mobilite || ''),
      situation_medicale: d.formulaire_data?.situation_medicale || '',
      nb_jours: d.formulaire_data?.nb_jours || 1,
      rooms: d.formulaire_data?.rooms || {
        cuisine: 1, suiteAvecBain: 0, suiteSansBain: 0, salleDeBain: 1, chambre: 1,
        salonMarocain: 0, salonEuropeen: 1, toilettesLavabo: 0, rooftop: 0, escalier: 0
      }
    });
    setShowCreateModal(true);
  };

  const handleCreateDemande = async () => {
    setFormSubmitted(true);
    const form = document.getElementById('create-request-form') as HTMLFormElement;
    if (!form?.checkValidity()) return;

    try {
      const frequencyValue = formData.frequence === 'une fois' ? 'oneshot' : 'abonnement';
      const isFixedSchedule = formData.scheduling_type === 'fixed';
      const clientDisplayName = activeSegment === 'entreprise'
        ? (formData.contact_person || formData.entity_name || formData.nom)
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

      const payload = {
        client_name: clientDisplayName,
        client_phone: finalPhone,
        client_whatsapp: finalWhatsApp,
        service: selectedService,
        segment: activeSegment,
        date_intervention: formData.date || null,
        heure_intervention: isFixedSchedule ? (formData.heure || '') : '',
        prix: formData.montant || null,
        mode_paiement: formData.mode_paiement,
        statut_paiement: formData.statut_paiement,
        frequency: frequencyValue,
        frequency_label: formData.frequence,
        formulaire_data: {
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
          type_habitation: formData.type_habitation,
          propertyType: formData.type_habitation ? formData.type_habitation.toLowerCase() : '',
          surface: formData.surface,
          surfaceArea: formData.surface,
          duree: formData.duree,
          duration: formData.duree,
          nb_intervenants: formData.nb_intervenants,
          numberOfPeople: formData.nb_intervenants,
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
          nb_personnel: formData.nb_personnel,
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
          rooms: formData.rooms
        }
      };

      if (editingDemande) {
        await updateDemande(editingDemande.id, payload);
        addToast('Demande mise à jour !', 'success');
      } else {
        await createDemande(payload);
        addToast('Demande créée avec succès !', 'success');
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
                      <span className="text-muted text-xs"># {d.id}</span>
                    </div>
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
                        <div className="detail-item"><span className="detail-label">Type de bien :</span> <span className="detail-value">{d.formulaire_data?.type_habitation || d.formulaire_data?.structure_type || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Fréquence :</span> <span className="detail-value">{d.frequency_label || (d.frequency === 'oneshot' ? 'Une fois' : 'Abonnement')}</span></div>
                        <div className="detail-item"><span className="detail-label">Durée / Qte :</span> <span className="detail-value">{d.formulaire_data?.duree ? `${d.formulaire_data.duree}h` : (d.formulaire_data?.duration ? `${d.formulaire_data.duration}h` : (d.formulaire_data?.nb_jours ? `${d.formulaire_data.nb_jours} j` : '—'))}</span></div>
                        <div className="detail-item"><span className="detail-label">Intervenants :</span> <span className="detail-value">{d.formulaire_data?.nb_intervenants || d.formulaire_data?.numberOfPeople || d.formulaire_data?.nb_personnel || '—'}</span></div>
                        {d.service.includes('Auxiliaire') ? (
                          <>
                            <div className="detail-item"><span className="detail-label">Âge / Sexe :</span> <span className="detail-value">{d.formulaire_data?.age_personne ? `${d.formulaire_data.age_personne} ans` : '—'} / {d.formulaire_data?.sexe_personne || '—'}</span></div>
                            <div className="detail-item"><span className="detail-label">Mobilité :</span> <span className="detail-value">{d.formulaire_data?.mobilite || '—'}</span></div>
                            <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                              <span className="detail-label">Médical :</span> 
                              <span className="detail-value">{d.formulaire_data?.situation_medicale || '—'}</span>
                            </div>
                          </>
                        ) : (
                          <div className="detail-item">
                            <span className="detail-label">Surface :</span> 
                            <span className="detail-value">{d.formulaire_data?.surface ? `${d.formulaire_data.surface} m²` : (d.formulaire_data?.officeSurface ? `${d.formulaire_data.officeSurface} m²` : (d.formulaire_data?.surfaceArea ? `${d.formulaire_data.surfaceArea} m²` : '—'))}</span>
                          </div>
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

                  <div className="pending-footer">
                    <div className="detail-item">
                      <span className="detail-label">Montant :</span>
                      <span className="detail-value text-main-teal fw-bold" style={{ fontSize: '0.9rem' }}>
                        {d.is_devis ? 'Sur devis' : (d.prix ? `${d.prix} MAD (Réservation)` : '— (Réservation)')}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Mode :</span>
                      <span className="detail-value">{d.mode_paiement || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-1 flex gap-2">
                  <button className="btn btn-nrp flex-1 leading-tight px-1 py-2 text-[13px] text-center" onClick={() => handleAction(d.id, 'nrp')}>
                    NRP ({d.nrp_count ?? 0})
                  </button>
                  <button className="btn btn-cancel flex-1 leading-tight px-1 py-2 text-[13px] text-center" onClick={() => handleAction(d.id, 'annuler')}>Annulé</button>
                  <button className="btn btn-validate flex-[1.5] leading-tight px-1 py-2 text-[13px] text-center" onClick={() => handleAction(d.id, 'valider')}>Valider demande</button>
                  <button className="btn btn-edit flex-1 flex justify-center items-center px-1 py-2 text-[13px] text-center" title="Modifier" onClick={() => openEditModal(d)}>
                    Modifier
                  </button>

                  {(user?.role === 'admin' || user?.role === 'responsable_commercial') && (
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
                    <div className="flex items-center gap-2">
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>
                        {d.segment === 'particulier' ? 'PARTICULIER' : 'ENTREPRISE'}
                      </span>
                      <span className="text-muted text-xs">#{d.id}</span>
                    </div>
                    {d.created_at && (
                      <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                        {new Date(d.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' à', '')}
                      </span>
                    )}
                  </div>
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
                  {d.formulaire_data?.surface && (
                    <div className="mobile-detail-row">
                      <span className="mobile-detail-label">Surface</span>
                      <span className="mobile-detail-value">{d.formulaire_data?.surface || '—'} m²</span>
                    </div>
                  )}

                  {d.formulaire_data?.structure_type && (
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
                      {d.is_devis ? 'Sur devis' : (d.prix ? `${d.prix} MAD` : '—')}
                      {!d.is_devis && d.mode_paiement && <span className="text-xs text-muted fw-normal"> ({d.mode_paiement})</span>}
                    </span>
                  </div>
                </div>

                <div className="mobile-card-actions">
                  <button className="btn btn-validate btn-full mb-2" onClick={() => handleAction(d.id, 'valider')}>
                    <CheckCircle size={18} /> Valider
                  </button>
                  <div className="flex gap-2">
                    <button className="btn btn-nrp flex-1" onClick={() => handleAction(d.id, 'nrp')}>
                      NRP ({d.nrp_count ?? 0})
                    </button>
                    <button className="btn btn-cancel flex-1" onClick={() => handleAction(d.id, 'annuler')}>Annuler</button>
                    <button className="btn btn-edit flex-none px-3" title="Modifier" onClick={() => openEditModal(d)}>
                      <Edit size={16} />
                    </button>

                    {(user?.role === 'admin' || user?.role === 'responsable_commercial') && (
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
              <h2 className="text-xl fw-bold">{editingDemande ? 'Modifier' : 'Nouvelle'} demande : {selectedService}</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}><XCircle size={24} /></button>
            </div>
            <div className="modal-body">
              <form className={`${formSubmitted ? 'submitted' : ''}`} id="create-request-form" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* ====== CONDITIONAL SERVICE SECTIONS ====== */}
                {isAuxiliaireService ? (
                  /* Auxiliaire de vie - Service sur mesure */
                  <div className="ws-form-block">
                    <div className="ws-section-header">Service sur mesure — {selectedService}</div>

                    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <div className="ws-section-header" style={{ background: '#f1f5f9', color: 'var(--primary)', fontSize: '0.9rem' }}>Lieu de la garde</div>
                        <div className="ws-radio-pills">
                          {['domicile', 'clinique', 'hopital'].map(loc => (
                            <label key={loc} className="ws-radio-pill">
                              <input type="radio" name="careLocation" value={loc} checked={formData.lieu_garde === loc} onChange={e => setFormData({ ...formData, lieu_garde: e.target.value })} />
                              <span>{loc === 'domicile' ? 'Domicile' : loc === 'clinique' ? 'Clinique' : 'Hôpital'}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="label-teal">Fréquence *</label>
                        <select className="ws-select" required value={formData.frequence} onChange={e => setFormData({ ...formData, frequence: e.target.value })}>
                          <option value="">Sélectionner...</option>
                          <option value="une fois">Une fois - Tranche 24h</option>
                          <option value="1/sem">Abonnement - 1 fois / semaine</option>
                          <option value="quotidien">Abonnement - Quotidien</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="label-teal">Nombre de jours *</label>
                        <div className="ws-counter">
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_jours: Math.max(1, formData.nb_jours - 1) })} disabled={formData.nb_jours <= 1}>−</button>
                          <span className="ws-counter-value">{formData.nb_jours}</span>
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_jours: formData.nb_jours + 1 })}>+</button>
                        </div>
                      </div>
                    </div>

                    <div className="ws-section-header" style={{ marginTop: '1rem', background: '#f1f5f9', color: 'var(--primary)', fontSize: '0.9rem' }}>Profil de la personne aidée</div>
                    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
                      <div className="form-group">
                        <label className="label-teal">Âge *</label>
                        <input type="number" placeholder="Ans" required value={formData.age_personne} onChange={e => setFormData({ ...formData, age_personne: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="label-teal">Sexe *</label>
                        <select className="ws-select" required value={formData.sexe_personne} onChange={e => setFormData({ ...formData, sexe_personne: e.target.value })}>
                          <option value="">Sélectionner...</option>
                          <option value="femme">Femme</option>
                          <option value="homme">Homme</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="label-teal">Mobilité *</label>
                        <select className="ws-select" required value={formData.mobilite} onChange={e => setFormData({ ...formData, mobilite: e.target.value })}>
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
                        <textarea rows={2} placeholder="Précisez la situation..." required value={formData.situation_medicale} onChange={e => setFormData({ ...formData, situation_medicale: e.target.value })}></textarea>
                      </div>
                    </div>
                  </div>
                ) : isPlacementGestionService ? (
                  /* Placement & gestion - Service sur mesure */
                  <div className="ws-form-block">
                    <div className="ws-section-header">Service sur mesure — {selectedService}</div>
                    <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>Un chargé de clientèle prendra contact avec l'entreprise pour établir une offre personnalisée.</p>

                    <div className="ws-section-header" style={{ background: '#f1f5f9', color: 'var(--primary)', fontSize: '0.9rem' }}>Type de service</div>
                    <div className="ws-radio-pills">
                      {[{ v: 'flexible', l: 'Service ménage flexible' }, { v: 'premium', l: 'Service ménage Premium' }].map(o => (
                        <label key={o.v} className="ws-radio-pill">
                          <input type="radio" name="placementServiceType" value={o.v} checked={formData.service_type === o.v} onChange={e => setFormData({ ...formData, service_type: e.target.value })} />
                          <span>{o.l}</span>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem', marginTop: '0.75rem' }}>
                      <div className="form-group">
                        <label className="label-teal">Type de structure *</label>
                        <select className="ws-select" required value={formData.structure_type} onChange={e => setFormData({ ...formData, structure_type: e.target.value })}>
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
                        <select className="ws-select" required value={formData.frequence} onChange={e => setFormData({ ...formData, frequence: e.target.value })}>
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
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_personnel: Math.max(1, formData.nb_personnel - 1) })} disabled={formData.nb_personnel <= 1}>−</button>
                          <span className="ws-counter-value">{formData.nb_personnel}</span>
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_personnel: formData.nb_personnel + 1 })}>+</button>
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
                              <input type="radio" name="propertyType" value={type} checked={formData.type_habitation === type} onChange={e => setFormData({ ...formData, type_habitation: e.target.value })} />
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
                            <div key={n.v} className={`ws-nature-card ${formData.intervention_nature === n.v ? 'active' : ''}`} onClick={() => setFormData({ ...formData, intervention_nature: n.v })}>
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
                            <select className="ws-select" required value={formData.accommodation_state} onChange={e => setFormData({ ...formData, accommodation_state: e.target.value })}>
                              <option value="">Choisir...</option>
                              <option value="vide">Vide</option>
                              <option value="meuble">Meublé</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="label-teal">Niveau de salissure *</label>
                            <select className="ws-select" required value={formData.cleanliness_type} onChange={e => setFormData({ ...formData, cleanliness_type: e.target.value })}>
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
                        <button type="button" className={formData.frequence === 'une fois' || !formData.frequence ? 'active' : ''} onClick={() => setFormData({ ...formData, frequence: 'une fois' })}>
                          Une fois
                        </button>
                        <button type="button" className={formData.frequence !== 'une fois' && formData.frequence ? 'active' : ''} onClick={() => setFormData({ ...formData, frequence: '1/sem' })}>
                          Abonnement
                        </button>
                      </div>
                      {formData.frequence && formData.frequence !== 'une fois' && (
                        <div style={{ maxWidth: '380px', margin: '0 auto' }}>
                          <div className="ws-discount-badge">-10 % de réduction sur l'abonnement</div>
                          <select className="ws-select" value={formData.frequence} onChange={e => setFormData({ ...formData, frequence: e.target.value })}>
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

                    {/* Détails des pièces (Ménage Standard uniquement) */}
                    {isMenageStandardService && (
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
                                <button type="button" className="ws-room-btn" onClick={() => setFormData({ ...formData, rooms: { ...formData.rooms, [room.key]: Math.max(0, (formData.rooms[room.key] || 0) - 1) } })}>−</button>
                                <span className="ws-room-count">{formData.rooms[room.key] || 0}</span>
                                <button type="button" className="ws-room-btn" onClick={() => setFormData({ ...formData, rooms: { ...formData.rooms, [room.key]: (formData.rooms[room.key] || 0) + 1 } })}>+</button>
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
                          <div className="ws-slider-value">{formData.surface} m²</div>
                          <input type="range" className="ws-slider-input" min={0} max={300} step={10} value={formData.surface} onChange={e => setFormData({ ...formData, surface: parseInt(e.target.value) })} />
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
                            <div key={s.v} className={`ws-surface-card ${String(formData.surface) === s.v ? 'active' : ''}`} onClick={() => setFormData({ ...formData, surface: s.v as any })}>
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
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, duree: Math.max(minDuree, formData.duree - 1) })} disabled={formData.duree <= minDuree}>−</button>
                          <span className="ws-counter-value">{formData.duree}</span>
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, duree: formData.duree + 1 })}>+</button>
                        </div>
                      </div>
                    )}

                    {/* Nombre de personnes */}
                    {(isMenageStandardService || isGrandMenageService || isMenageAirBnBService || isMenageBureauxService) && (
                      <div className="ws-form-block">
                        <div className="ws-section-header">Nombre de personne</div>
                        <div className="ws-counter">
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_intervenants: Math.max(1, formData.nb_intervenants - 1) })} disabled={formData.nb_intervenants <= 1}>−</button>
                          <span className="ws-counter-value">{formData.nb_intervenants}</span>
                          <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_intervenants: formData.nb_intervenants + 1 })}>+</button>
                        </div>
                      </div>
                    )}

                    {/* Planning */}
                    <div className="ws-form-block">
                      <div className="ws-section-header">Planning pour votre demande</div>
                      <div className="ws-planning-grid">
                        <div className="ws-planning-col">
                          <label className="ws-planning-radio-label">
                            <input type="radio" name="schedulingType" value="fixed" checked={formData.scheduling_type === 'fixed'} onChange={e => setFormData({ ...formData, scheduling_type: e.target.value })} />
                            <span>Heure fixe</span>
                          </label>
                          <input type="time" value={formData.heure} onChange={e => setFormData({ ...formData, heure: e.target.value })} disabled={formData.scheduling_type !== 'fixed'} style={{ width: '120px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px' }} />
                        </div>
                        <div className="ws-planning-col">
                          <label className="ws-planning-radio-label">
                            <input type="radio" name="schedulingType" value="flexible" checked={formData.scheduling_type === 'flexible'} onChange={e => setFormData({ ...formData, scheduling_type: e.target.value })} />
                            <span>Je suis flexible</span>
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                              <input type="radio" name="timePref" value="matin" checked={formData.preference_horaire === 'matin'} onChange={() => setFormData({ ...formData, preference_horaire: 'matin' })} disabled={formData.scheduling_type !== 'flexible'} style={{ accentColor: 'var(--primary)' }} />
                              Le matin
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                              <input type="radio" name="timePref" value="apres_midi" checked={formData.preference_horaire === 'apres_midi'} onChange={() => setFormData({ ...formData, preference_horaire: 'apres_midi' })} disabled={formData.scheduling_type !== 'flexible'} style={{ accentColor: 'var(--primary)' }} />
                              L'après-midi
                            </label>
                          </div>
                        </div>
                        <div className="ws-planning-col">
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>Date</div>
                          <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={{ padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }} />
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
                              <input type="checkbox" checked={formData.produits} onChange={e => setFormData({ ...formData, produits: e.target.checked })} />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                          <div className="optional-service-card">
                            <div className="optional-service-info">
                              <span className="text-2xl">🧹</span>
                              <span>Torchons et serpillères (+40 MAD)</span>
                            </div>
                            <label className="toggle-switch">
                              <input type="checkbox" checked={formData.torchons} onChange={e => setFormData({ ...formData, torchons: e.target.checked })} />
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
                      <select className="ws-select" required value={formData.ville} onChange={e => setFormData({ ...formData, ville: e.target.value, quartier: '' })}>
                        {['Casablanca', 'Rabat', 'Bouskoura', 'Dar Bouazza', 'Mansouria', 'Almaz', 'Sidi Rahal', 'Benslimane', 'Mohammédia', 'Ville Verte'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label-teal">Quartier *</label>
                      <select className="ws-select" required value={formData.quartier} onChange={e => setFormData({ ...formData, quartier: e.target.value })}>
                        <option value="">Sélectionner un quartier</option>
                        {(({
                          Casablanca: ['Maârif','Gauthier','Racine','Palmier','Bourgogne','Derb Ghallef','Hôpitaux','Belvédère','Roches Noires','Anfa','Aïn Diab','Californie',"L'Oasis",'Polo','CIL (Hay El Hanaa)','Sidi Maârouf','Casablanca Finance City (CFC)','Habous (Nouvelle Médina)','Ancienne Médina','Mers Sultan','Derb Sultan','Hay Mohammadi','Al Fida','Aïn Chock','Hay Hassani','Sbata',"Ben M'sik",'Sidi Othmane','Moulay Rachid','Aïn Sebaâ','Sidi Bernoussi','Sidi Moumen','Lissasfa','Bouskoura (périphérie sud)','Dar Bouazza (périphérie côtière ouest)'],
                          Rabat: ['Agdal','Hassan','Hay Riad','Souissi',"L'Océan",'Les Orangers','Quartier des Ministères','Yacoub El Mansour','Médina','Akkari','Diour Jamaa'],
                          Bouskoura: ['Ville Verte','Victoria','CGI','Golf','Centre-ville','Quartier Industriel'],
                          'Dar Bouazza': ['Tamaris','Oued Merzeg','Jack Beach','Centre-ville','Dar Bouazza Plage'],
                          Mansouria: ['Centre','Plage','Résidences Côtières'],
                          Almaz: ['Almaz','Centre'],
                          'Sidi Rahal': ['Sidi Rahal Chatai','Centre','Plage'],
                          Benslimane: ['Centre-ville','Quartier Administratif','Quartier Industriel','Oasis'],
                          Mohammédia: ['Parc','Alia','Rachidia','Mannesmann','Plage','Centre-ville','Yasmina','Wafaa'],
                          'Ville Verte': ['Ville Verte (Bouskoura)','Centre']
                        } as Record<string, string[]>)[formData.ville] || ['Autre']).map(q => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="label-teal">Adresse / Repères</label>
                      <textarea rows={2} placeholder="Donnez-nous des repères pour faciliter l'intervention..." value={formData.adresse} onChange={e => setFormData({ ...formData, adresse: e.target.value })}></textarea>
                    </div>
                  </div>
                  {['Bouskoura', 'Dar Bouazza', 'Mansouria', 'Almaz', 'Sidi Rahal', 'Benslimane', 'Mohammédia', 'Ville Verte'].includes(formData.ville) && (
                    <div className="ws-surcharge-notice">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
                      <label className="label-teal">Montant total (MAD) *</label>
                      <input type="number" placeholder="0.00" required value={formData.montant} onChange={e => setFormData({ ...formData, montant: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label-teal">Mode de paiement *</label>
                      <select className="ws-select" required value={formData.mode_paiement} onChange={e => setFormData({ ...formData, mode_paiement: e.target.value })}>
                        <option value="">Choisir...</option>
                        <option value="virement">Virement</option>
                        <option value="cheque">Par chèque</option>
                        <option value="agence">À l'agence</option>
                        <option value="sur_place">Sur place</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="label-teal">Statut de paiement</label>
                      <select className="ws-select" value={formData.statut_paiement} onChange={e => setFormData({ ...formData, statut_paiement: e.target.value })}>
                        <option value="non_paye">Non payé</option>
                        <option value="acompte">Acompte versé</option>
                        <option value="partiel">Paiement partiel</option>
                        <option value="integral">Payé</option>
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
                    const isDevis = isDevisRequired(editingDemande);
                    handlePreviewDocument(editingDemande.id, isDevis ? 'devis' : 'png');
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
                  <button className="btn btn-primary" type="button" onClick={handleCreateDemande}>
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
    </div>
  );
}

