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

const isDevisRequired = (d: Demande | null) => {
  if (!d) return false;
  if (d.segment === 'entreprise') return true;
  const devisParticuliers = ['Ménage Air BnB', 'Ménage post-sinistre', 'Auxiliaire de vie', 'Ménage fin chantier', 'Nettoyage fin de chantier'];
  return devisParticuliers.includes(d.service);
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

  // Nouveaux états pour le formulaire
  const [formData, setFormData] = useState({
    nom: '',
    ville: 'Casablanca',
    quartier: '',
    adresse: '',
    date: '',
    heure: '',
    preference_horaire: '',
    type_habitation: '',
    frequence: '',
    nb_intervenants: 1,
    surface: 50,
    details_pieces: '',
    duree: 4,
    produits: false,
    torchons: false,
    montant: '',
    mode_paiement: '',
    statut_paiement: 'non_paye',
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
    }
  });

  const { user } = useAuthStore();
  const { setPendingCount } = useNotificationStore();
  const { addToast } = useToastStore();

  const [commerciaux, setCommerciaux] = useState<any[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState<number | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string, type: 'devis' | 'png', name: string, demandeId: number } | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

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
        await nrpDemande(id);
        addToast('Statut NRP enregistré', 'info');
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
      nom: '', ville: 'Casablanca', quartier: '', adresse: '', date: '', heure: '',
      preference_horaire: '', type_habitation: '', frequence: '', nb_intervenants: 1,
      surface: 50, details_pieces: '', duree: 4, produits: false, torchons: false,
      montant: '', mode_paiement: '', statut_paiement: 'non_paye', notes: '',
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
      nom: d.client_name,
      ville: d.formulaire_data?.ville || d.client_city || 'Casablanca',
      quartier: d.formulaire_data?.quartier || d.client_neighborhood || '',
      adresse: d.formulaire_data?.adresse || '',
      date: d.date_intervention || '',
      heure: d.heure_intervention || '',
      preference_horaire: d.formulaire_data?.preference_horaire || '',
      type_habitation: d.formulaire_data?.type_habitation || '',
      frequence: d.frequency_label || (d.frequency === 'oneshot' ? 'ponctuel' : 'mensuel'),
      nb_intervenants: d.formulaire_data?.nb_intervenants || 1,
      surface: d.formulaire_data?.surface || 50,
      details_pieces: d.formulaire_data?.details_pieces || '',
      duree: d.formulaire_data?.duree || 4,
      produits: d.formulaire_data?.produits || false,
      torchons: d.formulaire_data?.torchons || false,
      montant: d.prix?.toString() || '',
      mode_paiement: d.mode_paiement || '',
      statut_paiement: d.statut_paiement || 'non_paye',
      notes: d.formulaire_data?.notes || '',
      service_type: d.formulaire_data?.service_type || 'flexible',
      structure_type: d.formulaire_data?.structure_type || '',
      nb_personnel: d.formulaire_data?.nb_personnel || 1,
      lieu_garde: d.formulaire_data?.lieu_garde || 'domicile',
      age_personne: d.formulaire_data?.age_personne || '',
      sexe_personne: d.formulaire_data?.sexe_personne || '',
      mobilite: d.formulaire_data?.mobilite || '',
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
      const frequencyValue = formData.frequence === 'ponctuel' ? 'oneshot' : 'abonnement';
      const payload = {
        client_name: formData.nom,
        client_phone: directPhone,
        service: selectedService,
        segment: activeSegment,
        date_intervention: formData.date || null,
        heure_intervention: formData.heure || '',
        prix: formData.montant || null,
        mode_paiement: formData.mode_paiement,
        statut_paiement: formData.statut_paiement,
        frequency: frequencyValue,
        frequency_label: formData.frequence,
        formulaire_data: {
          nom: formData.nom,
          ville: formData.ville,
          quartier: formData.quartier,
          adresse: formData.adresse,
          preference_horaire: formData.preference_horaire,
          type_habitation: formData.type_habitation,
          surface: formData.surface,
          duree: formData.duree,
          nb_intervenants: formData.nb_intervenants,
          details_pieces: formData.details_pieces,
          produits: formData.produits,
          torchons: formData.torchons,
          // Placement & gestion
          structure_type: formData.structure_type,
          service_type: formData.service_type,
          nb_personnel: formData.nb_personnel,
          // Auxiliaire de vie
          lieu_garde: formData.lieu_garde,
          age_personne: formData.age_personne,
          sexe_personne: formData.sexe_personne,
          mobilite: formData.mobilite,
          situation_medicale: formData.situation_medicale,
          nb_jours: formData.nb_jours,
          // Contact
          whatsapp_phone: whatsappPhone,
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
            <div key={d.id} className="pending-card-container">
              {/* DESKTOP VERSION */}
              <div className="pending-card desktop-card">
                <div className="pending-card-header">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                        {d.segment === 'particulier' ? 'SPP' : 'SPE'}
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
                        <div className="detail-item"><span className="detail-label">Fréquence :</span> <span className="detail-value">{d.frequency_label || d.frequency || '—'}</span></div>
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
                        <div className="detail-item"><span className="detail-label">Heure :</span> <span className="detail-value">{d.heure_intervention || d.formulaire_data?.fixedTime || (d.formulaire_data?.schedulingTime === 'morning' ? 'Le matin' : d.formulaire_data?.schedulingTime === 'afternoon' ? "L'après-midi" : d.formulaire_data?.schedulingTime) || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Ville :</span> <span className="detail-value">{d.formulaire_data?.ville || d.formulaire_data?.city || d.client_city || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Quartier :</span> <span className="detail-value">{d.formulaire_data?.quartier || d.formulaire_data?.neighborhood || d.client_neighborhood || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Préférence horaire :</span> <span className="detail-value">{d.formulaire_data?.preference_horaire ? (d.formulaire_data.preference_horaire === 'matin' ? 'Matin (08h–12h)' : 'Après-midi (14h–18h)') : '—'}</span></div>
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
                  <button className="btn btn-nrp flex-1 leading-tight px-1 py-2 text-[13px] text-center" onClick={() => handleAction(d.id, 'nrp')}>NRP</button>
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
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                        {d.segment === 'particulier' ? 'SPP' : 'SPE'}
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
                    <button className="btn btn-nrp flex-1" onClick={() => handleAction(d.id, 'nrp')}>NRP</button>
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
              <form className={`form-grid ${formSubmitted ? 'submitted' : ''}`} id="create-request-form">
                <div className="form-section full-width">
                  <h3>Informations Client</h3>
                </div>
                <div className="form-group">
                  <label className="label-teal">Nom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Jean Dupont"
                    value={formData.nom}
                    onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="label-teal">Tél. direct *</label>
                  <div className="flex gap-2">
                    <input type="text" defaultValue="+212" className="phone-prefix" required />
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
                </div>

                <div className="form-group">
                  <div className="flex justify-between items-center mb-1">
                    <label className="label-teal mb-0">Tél. WhatsApp *</label>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" defaultValue="+212" className="phone-prefix" required disabled={syncWhatsApp} />
                    <input
                      type="text"
                      className="flex-1 phone-number"
                      placeholder="6 12 00 00 00"
                      value={whatsappPhone}
                      required
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      disabled={syncWhatsApp}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label-teal">Ville *</label>
                  <input
                    type="text"
                    className="phone-number"
                    required
                    value={formData.ville}
                    onChange={e => setFormData({ ...formData, ville: e.target.value })}
                  />
                </div>

                <div className="form-group full-width" style={{ marginTop: '-5px', marginBottom: '10px' }}>
                  <label className="custom-checkbox-container">
                    <input
                      type="checkbox"
                      checked={syncWhatsApp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSyncWhatsApp(checked);
                        if (checked) setWhatsappPhone(directPhone);
                      }}
                    />
                    <span className="checkbox-checkmark"></span>
                    <span className="checkbox-label">Utilisez-vous ce numéro pour WhatsApp ?</span>
                  </label>
                </div>

                <div className="form-group">
                  <label className="label-teal">Quartier *</label>
                  <select
                    className="phone-number"
                    required
                    value={formData.quartier}
                    onChange={e => setFormData({ ...formData, quartier: e.target.value })}
                  >
                    <option value="">Sélectionner</option>
                    <option value="Maârif">Maârif</option>
                    <option value="Gauthier">Gauthier</option>
                    <option value="Racine">Racine</option>
                    <option value="Palmier">Palmier</option>
                    <option value="Bourgogne">Bourgogne</option>
                    <option value="Derb Ghallef">Derb Ghallef</option>
                    <option value="Hôpitaux">Hôpitaux</option>
                    <option value="Belvédère">Belvédère</option>
                    <option value="Roches Noires">Roches Noires</option>
                    <option value="Anfa">Anfa</option>
                    <option value="Aïn Diab">Aïn Diab</option>
                    <option value="Californie">Californie</option>
                    <option value="L'Oasis">L'Oasis</option>
                    <option value="Polo">Polo</option>
                    <option value="CIL (Hay El Hanaa)">CIL (Hay El Hanaa)</option>
                    <option value="Sidi Maârouf">Sidi Maârouf</option>
                    <option value="Casablanca Finance City (CFC)">Casablanca Finance City (CFC)</option>
                    <option value="Habous (Nouvelle Médina)">Habous (Nouvelle Médina)</option>
                    <option value="Ancienne Médina">Ancienne Médina</option>
                    <option value="Mers Sultan">Mers Sultan</option>
                    <option value="Derb Sultan">Derb Sultan</option>
                    <option value="Hay Mohammadi">Hay Mohammadi</option>
                    <option value="Al Fida">Al Fida</option>
                    <option value="Aïn Chock">Aïn Chock</option>
                    <option value="Hay Hassani">Hay Hassani</option>
                    <option value="Sbata">Sbata</option>
                    <option value="Ben M'sik">Ben M'sik</option>
                    <option value="Sidi Othmane">Sidi Othmane</option>
                    <option value="Moulay Rachid">Moulay Rachid</option>
                    <option value="Aïn Sebaâ">Aïn Sebaâ</option>
                    <option value="Sidi Bernoussi">Sidi Bernoussi</option>
                    <option value="Sidi Moumen">Sidi Moumen</option>
                    <option value="Lissasfa">Lissasfa</option>
                    <option value="Bouskoura (périphérie sud)">Bouskoura (périphérie sud)</option>
                    <option value="Dar Bouazza (périphérie côtière ouest)">Dar Bouazza (périphérie côtière ouest)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label-teal">Adresse *</label>
                  <input
                    type="text"
                    className="phone-number"
                    required
                    value={formData.adresse}
                    onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                  />
                </div>

                {/* Conditional Rendering for Custom Services */}
                {(selectedService === 'Auxiliaire de vie' || selectedService === 'Placement & gestion') ? (
                  <div className="form-section full-width mt-4">
                    <div className="custom-service-box">
                      <h3 className="custom-service-title">Service sur mesure — {selectedService}</h3>
                      <p className="custom-service-text">
                        {selectedService === 'Placement & gestion'
                          ? "Un chargé de clientèle prendra contact avec l'entreprise pour établir une offre personnalisée."
                          : "Un assistant social et garde-malade prendront contact avec le client pour valider les points essentiels."
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="form-section full-width">
                      <h3>Détails du service</h3>
                    </div>
                    <div className="form-group">
                      <label>Date d'intervention *</label>
                      <input
                        type="date"
                        required
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Heure *</label>
                      <input
                        type="time"
                        required
                        value={formData.heure}
                        onChange={e => setFormData({ ...formData, heure: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Préférence horaire *</label>
                      <select
                        required
                        value={formData.preference_horaire}
                        onChange={e => setFormData({ ...formData, preference_horaire: e.target.value })}
                      >
                        <option value="">Choisir...</option>
                        <option value="matin">Matin (08h - 12h)</option>
                        <option value="apres_midi">Après-midi (14h - 18h)</option>
                      </select>
                    </div>

                    {/* Champs dynamiques selon le service */}
                    {(selectedService.toLowerCase().includes('ménage') || selectedService.toLowerCase().includes('nettoyage')) && (
                      <>
                        <div className="form-group">
                          <label>Type d'habitation *</label>
                          <select
                            required
                            value={formData.type_habitation}
                            onChange={e => setFormData({ ...formData, type_habitation: e.target.value })}
                          >
                            <option value="">Choisir...</option>
                            <option value="Studio">Studio</option>
                            <option value="Appartement">Appartement</option>
                            <option value="Duplex">Duplex</option>
                            <option value="Villa">Villa</option>
                            <option value="Maison">Maison</option>
                            <option value="Bureau">Bureau</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Fréquence *</label>
                          <select
                            required
                            value={formData.frequence}
                            onChange={e => setFormData({ ...formData, frequence: e.target.value })}
                          >
                            <option value="">Choisir...</option>
                            <option value="ponctuel">Une fois</option>
                            <option value="1/sem">Abonnement - 1 fois / semaine</option>
                            <option value="2/sem">Abonnement - 2 fois / semaine</option>
                            <option value="3/sem">Abonnement - 3 fois / semaine</option>
                            <option value="1/mois">Abonnement - 1 fois / mois</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Nb intervenants *</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={formData.nb_intervenants}
                            onChange={e => setFormData({ ...formData, nb_intervenants: parseInt(e.target.value) || 1 })}
                          />
                        </div>

                        <div className="form-group">
                          <label>Surface (m²) *</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={formData.surface}
                            onChange={e => setFormData({ ...formData, surface: parseInt(e.target.value) || 0 })}
                          />
                        </div>

                        <div className="form-group">
                          <label>Durée (Heures) *</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={formData.duree}
                            onChange={e => setFormData({ ...formData, duree: parseInt(e.target.value) || 1 })}
                          />
                        </div>

                        {selectedService === "Ménage standard" && (
                          <div className="form-section full-width bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="text-teal-800 mb-4 flex items-center gap-2">
                              <span className="text-lg">🏠</span> Détails des pièces
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {Object.entries(formData.rooms).map(([key, value]) => (
                                <div key={key} className="flex flex-col gap-1">
                                  <label className="text-[11px] uppercase font-bold text-slate-500">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</label>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      type="button" 
                                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded hover:bg-slate-100"
                                      onClick={() => setFormData({
                                        ...formData,
                                        rooms: { ...formData.rooms, [key]: Math.max(0, (value as number) - 1) }
                                      })}
                                    >-</button>
                                    <input 
                                      type="number" 
                                      className="w-12 text-center border-none bg-transparent font-bold"
                                      value={value as number}
                                      readOnly
                                    />
                                    <button 
                                      type="button" 
                                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-300 rounded hover:bg-slate-100"
                                      onClick={() => setFormData({
                                        ...formData,
                                        rooms: { ...formData.rooms, [key]: (value as number) + 1 }
                                      })}
                                    >+</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="form-group full-width">
                          <label>Détails des pièces (Notes additionnelles)</label>
                          <textarea
                            rows={2}
                            placeholder="Ex: Précisions sur l'état des lieux, fragilités..."
                            value={formData.details_pieces}
                            onChange={e => setFormData({ ...formData, details_pieces: e.target.value })}
                          ></textarea>
                        </div>

                        <div className="form-section">
                          <h3>Services Optionnels</h3>
                          <div className="optional-service-card">
                            <div className="optional-service-info">
                              <span className="text-2xl">🧴</span>
                              <span>Produits de nettoyage (+90 MAD)</span>
                            </div>
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={formData.produits}
                                onChange={e => setFormData({ ...formData, produits: e.target.checked })}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>

                          <div className="optional-service-card">
                            <div className="optional-service-info">
                              <span className="text-2xl">🧹</span>
                              <span>Torchons et serpillères (+40 MAD)</span>
                            </div>
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={formData.torchons}
                                onChange={e => setFormData({ ...formData, torchons: e.target.checked })}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedService === "Placement & gestion" && (
                      <>
                        <div className="form-group full-width">
                          <label>Type de service</label>
                          <div className="flex gap-4 flex-wrap mt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="placementServiceType"
                                value="flexible"
                                className="w-4 h-4 text-primary"
                                checked={formData.service_type === 'flexible'}
                                onChange={e => setFormData({ ...formData, service_type: e.target.value })}
                              />
                              <span className="text-sm font-medium">Service ménage flexible</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="placementServiceType"
                                value="premium"
                                className="w-4 h-4 text-primary"
                                checked={formData.service_type === 'premium'}
                                onChange={e => setFormData({ ...formData, service_type: e.target.value })}
                              />
                              <span className="text-sm font-medium">Service ménage Premium</span>
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Type de structure *</label>
                          <select
                            required
                            value={formData.structure_type}
                            onChange={e => setFormData({ ...formData, structure_type: e.target.value })}
                          >
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
                          <label>Fréquence *</label>
                          <select
                            required
                            value={formData.frequence}
                            onChange={e => setFormData({ ...formData, frequence: e.target.value })}
                          >
                            <option value="">Sélectionner...</option>
                            <option value="ponctuel">Une fois</option>
                            <option value="1/sem">Abonnement - 1 fois / semaine</option>
                            <option value="2/sem">Abonnement - 2 fois / semaine</option>
                            <option value="3/sem">Abonnement - 3 fois / semaine</option>
                            <option value="1/mois">Abonnement - 1 fois / mois</option>
                            <option value="quotidien">Abonnement - Quotidien</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Nombre de personnel *</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={formData.nb_personnel}
                            onChange={e => setFormData({ ...formData, nb_personnel: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      </>
                    )}

                    {(selectedService.includes('Auxiliaire') || selectedService.includes('Garde malade') || selectedService.includes('Garde d\'enfant')) && (
                      <>
                        <div className="form-group full-width">
                          <label>Lieu de la garde</label>
                          <div className="flex gap-4 flex-wrap mt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="careLocation"
                                value="domicile"
                                className="w-4 h-4 text-primary"
                                checked={formData.lieu_garde === 'domicile'}
                                onChange={e => setFormData({ ...formData, lieu_garde: e.target.value })}
                              />
                              <span className="text-sm font-medium">Domicile</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="careLocation"
                                value="clinique"
                                className="w-4 h-4 text-primary"
                                checked={formData.lieu_garde === 'clinique'}
                                onChange={e => setFormData({ ...formData, lieu_garde: e.target.value })}
                              />
                              <span className="text-sm font-medium">Clinique</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="careLocation"
                                value="hopital"
                                className="w-4 h-4 text-primary"
                                checked={formData.lieu_garde === 'hopital'}
                                onChange={e => setFormData({ ...formData, lieu_garde: e.target.value })}
                              />
                              <span className="text-sm font-medium">Hôpital</span>
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Fréquence *</label>
                          <select
                            required
                            value={formData.frequence}
                            onChange={e => setFormData({ ...formData, frequence: e.target.value })}
                          >
                            <option value="">Sélectionner...</option>
                            <option value="ponctuel">Une fois - Tranche 24h</option>
                            <option value="1/sem">Abonnement - 1 fois / semaine</option>
                            <option value="quotidien">Abonnement - Quotidien</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Nombre de jours *</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={formData.nb_jours}
                            onChange={e => setFormData({ ...formData, nb_jours: parseInt(e.target.value) || 1 })}
                          />
                        </div>

                        <div className="form-section full-width">
                          <h3>Profil de la personne aidée</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="form-group">
                              <label>Âge *</label>
                              <input
                                type="number"
                                placeholder="Ans"
                                required
                                value={formData.age_personne}
                                onChange={e => setFormData({ ...formData, age_personne: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Sexe *</label>
                              <select
                                required
                                value={formData.sexe_personne}
                                onChange={e => setFormData({ ...formData, sexe_personne: e.target.value })}
                              >
                                <option value="">Sélectionner...</option>
                                <option value="femme">Femme</option>
                                <option value="homme">Homme</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Mobilité *</label>
                              <select
                                required
                                value={formData.mobilite}
                                onChange={e => setFormData({ ...formData, mobilite: e.target.value })}
                              >
                                <option value="">Sélectionner...</option>
                                <option value="adulte">Adulte</option>
                                <option value="agee">Personne Agée</option>
                                <option value="autonome">Autonome</option>
                                <option value="besoin_aide">Besoin d'aide</option>
                                <option value="alitee">Alité(e)</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Pathologie / Situation médicale *</label>
                              <textarea
                                rows={2}
                                placeholder="Précisez la situation..."
                                required
                                value={formData.situation_medicale}
                                onChange={e => setFormData({ ...formData, situation_medicale: e.target.value })}
                              ></textarea>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}


                <div className="form-section">
                  <h3 style={{ color: '#547d7c' }}>Tarification & Paiement</h3>
                </div>
                <div className="form-group">
                  <label>Montant total (MAD) *</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    required
                    value={formData.montant}
                    onChange={e => setFormData({ ...formData, montant: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Mode de paiement *</label>
                  <select
                    required
                    value={formData.mode_paiement}
                    onChange={e => setFormData({ ...formData, mode_paiement: e.target.value })}
                  >
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
                    value={formData.statut_paiement}
                    onChange={e => setFormData({ ...formData, statut_paiement: e.target.value })}
                  >
                    <option value="non_paye">Non payé</option>
                    <option value="acompte">Acompte versé</option>
                    <option value="partiel">Paiement partiel</option>
                    <option value="integral">Paiement intégral</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Notes client</label>
                  <textarea
                    rows={3}
                    placeholder="Notes ou précisions additionnelles..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  ></textarea>
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

