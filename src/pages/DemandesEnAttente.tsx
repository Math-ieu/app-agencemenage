import { useEffect, useState, useCallback } from 'react';
import { getDemandes, validerDemande, annulerDemande, nrpDemande, createDemande, updateDemande, affecterDemande, getUsers, generateDocument, fetchSecureDocBlob } from '../api/client';
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
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [prestation, setPrestation] = useState('');
  const [expandedCards, setExpandedCards] = useState<Record<number, string | null>>({});

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
    nb_jours: 1
  });

  const { user } = useAuthStore();
  const { setPendingCount } = useNotificationStore();
  const { addToast } = useToastStore();

  const [commerciaux, setCommerciaux] = useState<any[]>([]);
  const [activeAffectMenu, setActiveAffectMenu] = useState<number | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string, type: 'devis' | 'png', name: string } | null>(null);

  // Fecth Commerciaux for Assignation
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'responsable_commercial') {
      getUsers({ role: 'commercial' }).then(res => {
        setCommerciaux(Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []));
      }).catch(err => console.error('Erreur commerciaux:', err));
    }
  }, [user]);

  const handleAffecter = async (demandeId: number, commercialId: number) => {
    try {
      await affecterDemande(demandeId, commercialId);
      addToast('Demande affectée avec succès', 'success');
      setActiveAffectMenu(null);
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
      setShowPreviewModal({ url: blobUrl, type: type === 'devis' ? 'devis' : 'png', name: doc.nom });
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
      "Aide à domicile",
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
        return matchesSearch && matchesSegment && matchesService;
      });

      setDemandes(filtered);
      setPendingCount(filtered.length);
    } catch (err) {
      console.error('Erreur fetchDemandes:', err);
      addToast('Erreur lors du chargement des demandes', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, segment, prestation, setPendingCount]);

  useEffect(() => { fetchDemandes(); }, [fetchDemandes]);

  const toggleSection = (cardId: number, section: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardId]: prev[cardId] === section ? null : section
    }));
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
      mobilite: '', situation_medicale: '', nb_jours: 1
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
      nb_jours: d.formulaire_data?.nb_jours || 1
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
        }
      };

      if (editingDemande) {
        await updateDemande(editingDemande.id, payload);
        addToast('Demande mise à jour !', 'success');
      } else {
        await createDemande(payload);
        addToast('Demande créée avec succès !', 'success');
      }

      if (!editingDemande) {
        setShowCreateModal(false);
      }
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

        <div className="date-picker-placeholder btn btn-secondary">
          <Calendar size={18} /> Du — Au
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
                    <p className="text-sm fw-medium">Téléphone : <span className="text-main">{d.client_phone || d.formulaire_data?.whatsapp_phone || 'Non renseigné'}</span></p>
                    <p className="text-sm fw-medium">WhatsApp : <span className="text-main">{d.client_whatsapp || d.formulaire_data?.whatsapp_phone || d.client_phone}</span></p>
                  </div>
                </div>

                <div className="pending-card-body">
                  <div className="accordion">
                    <div className="accordion-header" onClick={() => toggleSection(d.id, 'details')}>
                      <span>Détails de la prestation</span>
                      {expandedCards[d.id] === 'details' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {expandedCards[d.id] === 'details' && (
                      <div className="accordion-content">
                        <div className="detail-item"><span className="detail-label">Service :</span> <span className="detail-value">{d.service}</span></div>
                        <div className="detail-item"><span className="detail-label">Type de bien :</span> <span className="detail-value">{d.formulaire_data?.type_habitation || d.formulaire_data?.structure_type || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Fréquence :</span> <span className="detail-value">{d.frequency_label || d.frequency || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Durée / Qte :</span> <span className="detail-value">{d.formulaire_data?.duree ? `${d.formulaire_data.duree}h` : (d.formulaire_data?.nb_jours ? `${d.formulaire_data.nb_jours} j` : '—')}</span></div>
                        <div className="detail-item"><span className="detail-label">Intervenants :</span> <span className="detail-value">{d.formulaire_data?.nb_intervenants || d.formulaire_data?.nb_personnel || '—'}</span></div>
                        {d.service.includes('Auxiliaire') ? (
                          <>
                            <div className="detail-item"><span className="detail-label">Âge / Sexe :</span> <span className="detail-value">{d.formulaire_data?.age_personne ? `${d.formulaire_data.age_personne} ans` : '—'} / {d.formulaire_data?.sexe_personne || '—'}</span></div>
                            <div className="detail-item"><span className="detail-label">Mobilité :</span> <span className="detail-value">{d.formulaire_data?.mobilite || '—'}</span></div>
                            <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Médical :</span> <span className="detail-value">{d.formulaire_data?.situation_medicale || '—'}</span></div>
                          </>
                        ) : (
                          <div className="detail-item"><span className="detail-label">Surface :</span> <span className="detail-value">{d.formulaire_data?.surface ? `${d.formulaire_data.surface} m²` : '—'}</span></div>
                        )}
                        {d.formulaire_data?.details_pieces && (
                          <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Pièces :</span> <span className="detail-value">{d.formulaire_data?.details_pieces || '—'}</span></div>
                        )}
                        <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Services opt. :</span> <span className="detail-value">
                          {[
                            d.formulaire_data?.produits && 'Produits (+90 MAD)',
                            d.formulaire_data?.torchons && 'Torchons (+40 MAD)'
                          ].filter(Boolean).join(', ') || 'Aucun'}
                        </span></div>
                      </div>
                    )}
                  </div>

                  <div className="accordion">
                    <div className="accordion-header" onClick={() => toggleSection(d.id, 'lieux')}>
                      <span>Lieux</span>
                      {expandedCards[d.id] === 'lieux' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {expandedCards[d.id] === 'lieux' && (
                      <div className="accordion-content">
                        <div className="detail-item"><span className="detail-label">Date :</span> <span className="detail-value">{d.date_intervention || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Heure :</span> <span className="detail-value">{d.heure_intervention || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Ville :</span> <span className="detail-value">{d.formulaire_data?.ville || d.client_city || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Quartier :</span> <span className="detail-value">{d.formulaire_data?.quartier || d.client_neighborhood || '—'}</span></div>
                        <div className="detail-item"><span className="detail-label">Préférence horaire :</span> <span className="detail-value">{d.formulaire_data?.preference_horaire ? (d.formulaire_data.preference_horaire === 'matin' ? 'Matin (08h–12h)' : 'Après-midi (14h–18h)') : '—'}</span></div>
                        <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Adresse :</span> <span className="detail-value">{d.formulaire_data?.adresse || '—'}</span></div>
                      </div>
                    )}
                  </div>

                  <div className="accordion">
                    <div className="accordion-header" onClick={() => toggleSection(d.id, 'notes')}>
                      <span>Notes et précision</span>
                      {expandedCards[d.id] === 'notes' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    {expandedCards[d.id] === 'notes' && (
                      <div className="accordion-content" style={{ gridTemplateColumns: '1fr' }}>
                        {d.formulaire_data?.notes
                          ? <p className="text-sm">{d.formulaire_data?.notes || '—'}</p>
                          : <p className="text-sm text-muted italic">Aucune note</p>
                        }
                      </div>
                    )}
                  </div>
                </div>

                <div className="pending-footer">
                  <p className="text-sm">
                    <span className="fw-bold">Montant : {d.is_devis ? 'Sur devis' : (d.prix ? `${d.prix} MAD` : '—')}</span>
                    <span className="text-muted ml-2">({d.is_devis ? 'Devis' : 'Réservation'})</span>
                  </p>
                  <p className="text-sm fw-medium">Mode : {d.mode_paiement || '—'}</p>
                </div>

                <div className="border-t border-slate-100 pt-3 mt-3 flex gap-2">
                  <button className="btn btn-nrp flex-1 break-words leading-tight px-1 py-2 text-sm text-center" onClick={() => handleAction(d.id, 'nrp')}>NRP</button>
                  <button className="btn btn-cancel flex-1 break-words leading-tight px-1 py-2 text-sm text-center" onClick={() => handleAction(d.id, 'annuler')}>Annulé</button>
                  <button className="btn btn-validate flex-1 break-words leading-tight px-1 py-2 text-sm text-center" onClick={() => handleAction(d.id, 'valider')}>Valider demande</button>
                  <button className="btn btn-edit flex-1 flex justify-center items-center px-1 py-2 text-sm text-center" title="Modifier" onClick={() => openEditModal(d)}>
                    Modifier
                  </button>

                  {(user?.role === 'admin' || user?.role === 'responsable_commercial') && (
                    <button className="btn transition-all flex-1 text-sm leading-tight px-1 py-2 text-center flex items-center justify-center break-words"
                      style={{ backgroundColor: '#fdf4ff', color: '#c026d3', border: '1px solid #f0abfc' }}
                      onClick={() => setActiveAffectMenu(d.id)}>
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
                    <a href={`tel:${d.client_phone || d.formulaire_data?.whatsapp_phone || ''}`} className="mobile-contact-link">📞 {d.client_phone || d.formulaire_data?.whatsapp_phone || 'Non renseigné'}</a>
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
                        onClick={() => setActiveAffectMenu(d.id)}>
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

                        <div className="form-group full-width">
                          <label>Détails des pièces (Cuisine, SDB, Salons...)</label>
                          <textarea
                            rows={2}
                            placeholder="Ex: 1 Cuisine, 2 SDB, 1 Salon..."
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
                              setShowPreviewModal({ url: blobUrl, type: isDevis ? 'devis' : 'png', name: fileName });
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
              <button className="btn transition-all flex items-center gap-2" style={{ backgroundColor: '#0f766e', color: 'white', fontWeight: 500, padding: '10px 24px', borderRadius: '6px', border: 'none' }} onClick={() => {
                const addToast = useToastStore.getState().addToast;
                addToast("Fonction d'envoi en cours de développement", "info");
              }}>
                <Send size={18} /> Envoyer au client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'affectation d'un commercial */}
      {activeAffectMenu !== null && (
        <div className="modal-overlay z-[100]" onClick={() => setActiveAffectMenu(null)}>
          <div className="modal-content max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="modal-header border-b pb-3 mb-4">
              <h2 className="text-xl font-bold text-teal-800">Assigner un commercial</h2>
              <button className="btn-close text-slate-400 hover:text-slate-600" onClick={() => setActiveAffectMenu(null)}><XCircle size={24} /></button>
            </div>
            <div className="modal-body p-2 max-h-[60vh] overflow-y-auto">
              {commerciaux.length > 0 ? (
                <div className="grid gap-2">
                  {commerciaux.map((c: any) => (
                    <button key={c.id}
                      className="flex items-center gap-3 w-full p-3 text-left border rounded-lg hover:bg-teal-50 hover:border-teal-200 transition-colors group"
                      onClick={() => handleAffecter(activeAffectMenu, c.id)}>
                      <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold group-hover:bg-teal-200 shrink-0">
                        {c.first_name?.[0] || c.full_name?.[0] || 'C'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-700 group-hover:text-teal-900">{c.first_name} {c.last_name || c.full_name}</div>
                        <div className="text-xs text-slate-500">{c.email || 'Commercial'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <UserPlus size={48} className="mx-auto text-slate-300 mb-4" />
                  <p>Aucun commercial disponible.</p>
                </div>
              )}
            </div>
            <div className="modal-footer border-t pt-4 mt-2 bg-white flex justify-end">
              <button className="btn btn-secondary" onClick={() => setActiveAffectMenu(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

