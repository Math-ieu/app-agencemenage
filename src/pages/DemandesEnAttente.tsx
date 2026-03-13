import { useEffect, useState, useCallback } from 'react';
import { getDemandes, validerDemande, annulerDemande, nrpDemande } from '../api/client';
import { useNotificationStore } from '../store/auth';
import {
  Search, Plus, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle, Edit, XCircle,
  Calendar
} from 'lucide-react';
import { Demande } from '../types';

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

  const { setPendingCount } = useNotificationStore();

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
      const { data } = await getDemandes({ statut: 'en_attente' });
      const results: Demande[] = data.results || data;
      
      const filtered = results.filter(d => {
        const matchesSearch = !search || d.client_name.toLowerCase().includes(search.toLowerCase()) || d.client_phone.includes(search);
        const matchesSegment = !segment || d.segment === segment;
        const matchesService = !prestation || d.service === prestation;
        return matchesSearch && matchesSegment && matchesService;
      });

      setDemandes(filtered);
      setPendingCount(filtered.length);
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
      if (action === 'valider') await validerDemande(id);
      else if (action === 'nrp') await nrpDemande(id);
      else if (action === 'annuler') {
        const reason = prompt('Motif d\'annulation :');
        if (reason === null) return;
        await annulerDemande(id, reason);
      }
      fetchDemandes();
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateModal = (service: string) => {
    setSelectedService(service);
    setShowCreateModal(true);
    setShowNewMenu(false);
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
          {SERVICES.particulier.concat(SERVICES.entreprise).map(s => (
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
            <div key={d.id} className="pending-card">
              <div className="pending-card-header">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge ${d.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                      {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                    </span>
                    <span className="text-muted text-xs"># {d.id}</span>
                  </div>
                  <h3 className="fw-bold">Nom : <span className="text-main">{d.client_name}</span></h3>
                </div>
                <div className="text-right">
                  <p className="text-sm fw-medium">Téléphone : <span className="text-main">{d.client_phone}</span></p>
                  <p className="text-sm fw-medium">WhatsApp : <span className="text-main">{d.client_phone}</span></p>
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
                      <div className="detail-item"><span className="detail-label">Type de bien :</span> <span className="detail-value">—</span></div>
                      <div className="detail-item"><span className="detail-label">Fréquence :</span> <span className="detail-value">{d.frequency}</span></div>
                      <div className="detail-item"><span className="detail-label">Durée :</span> <span className="detail-value">{d.nb_heures}h</span></div>
                      <div className="detail-item"><span className="detail-label">Intervenants :</span> <span className="detail-value">1</span></div>
                      <div className="detail-item"><span className="detail-label">Services opt. :</span> <span className="detail-value">—</span></div>
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
                      <div className="detail-item"><span className="detail-label">Date :</span> <span className="detail-value">{d.date_intervention}</span></div>
                      <div className="detail-item"><span className="detail-label">Heure :</span> <span className="detail-value">—</span></div>
                      <div className="detail-item"><span className="detail-label">Ville :</span> <span className="detail-value">Casablanca</span></div>
                      <div className="detail-item"><span className="detail-label">Quartier :</span> <span className="detail-value">{d.neighborhood_city || '—'}</span></div>
                      <div className="detail-item" style={{ gridColumn: 'span 2' }}><span className="detail-label">Adresse :</span> <span className="detail-value">—</span></div>
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
                      <p className="text-sm text-muted italic">Aucune note</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pending-footer">
                <p className="text-sm">
                  <span className="fw-bold">Montant : {d.prix} MAD</span> 
                  <span className="text-muted ml-2">({d.is_devis ? 'Devis' : 'Réservation'})</span>
                </p>
                <p className="text-sm fw-medium">Mode : {d.mode_paiement}</p>
              </div>

              <div className="pending-actions">
                <button className="btn btn-nrp" onClick={() => handleAction(d.id, 'nrp')}>NRP</button>
                <button className="btn btn-cancel" onClick={() => handleAction(d.id, 'annuler')}>Annulé</button>
                <button className="btn btn-validate" onClick={() => handleAction(d.id, 'valider')}>Valider demande</button>
                <button className="btn btn-edit" title="Modifier">
                  <Edit size={16} />
                </button>
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
              <h2 className="text-xl fw-bold">Nouvelle demande : {selectedService}</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}><XCircle size={24} /></button>
            </div>
            <div className="modal-body">
              <form className={`form-grid ${formSubmitted ? 'submitted' : ''}`} id="create-request-form">
                <div className="form-section full-width">
                  <h3>Informations Client</h3>
                </div>
                <div className="form-group">
                  <label className="label-teal">Nom *</label>
                  <input type="text" required placeholder="Ex: Jean Dupont" />
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
                  <input type="text" defaultValue="Casablanca" className="phone-number" required />
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
                  <select className="phone-number" required>
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
                  <input type="text" className="phone-number" required />
                </div>
                
                <div className="form-section full-width">
                  <h3>Détails du service</h3>
                </div>
                <div className="form-group">
                  <label>Date d'intervention *</label>
                  <input type="date" required />
                </div>
                <div className="form-group">
                  <label>Heure *</label>
                  <input type="time" required />
                </div>
                <div className="form-group">
                  <label>Préférence horaire *</label>
                  <select required>
                    <option value="">Choisir...</option>
                    <option value="matin">Matin (08h - 12h)</option>
                    <option value="apres_midi">Après-midi (14h - 18h)</option>
                  </select>
                </div>
                
                {/* Champs dynamiques selon le service */}
                {(selectedService.includes('Ménage') || selectedService.includes('Nettoyage')) && (
                  <>
                    <div className="form-group">
                      <label>Type d'habitation *</label>
                      <select required>
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
                      <select required>
                        <option value="">Choisir...</option>
                        <option value="ponctuel">Une fois</option>
                        <option value="1/sem">Abonnement - 1 fois / semaine</option>
                        <option value="2/sem">Abonnement - 2 fois / semaine</option>
                        <option value="3/sem">Abonnement - 3 fois / semaine</option>
                        <option value="1/mois">Abonnement - 1 fois / mois</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Nb intervenants</label>
                      <input type="number" defaultValue={1} min={1} />
                    </div>

                    {(selectedService.includes('Grand') || selectedService.includes('chantier') || selectedService.includes('sinistre') || selectedService.includes('déménagement') || selectedService.includes('bureau')) && (
                      <div className="form-group">
                        <label>Surface (m²)</label>
                        <input type="number" defaultValue={50} min={10} />
                      </div>
                    )}
                    
                    <div className="form-group full-width">
                      <label>Détails des pièces (Cuisine, SDB, Salons...)</label>
                      <textarea rows={2} placeholder="Ex: 1 Cuisine, 2 SDB, 1 Salon..."></textarea>
                    </div>

                    <div className="form-group">
                      <label>Durée recommandée (Heures)</label>
                      <input type="number" defaultValue={4} min={4} />
                    </div>

                    <div className="form-section">
                      <h3>Services Optionnels</h3>
                      <div className="optional-service-card">
                        <div className="optional-service-info">
                          <span className="text-2xl">🧴</span>
                          <span>Produits de nettoyage (+90 MAD)</span>
                        </div>
                        <label className="toggle-switch">
                          <input type="checkbox" />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                      
                      <div className="optional-service-card">
                        <div className="optional-service-info">
                          <span className="text-2xl">🧹</span>
                          <span>Torchons et serpillères (+40 MAD)</span>
                        </div>
                        <label className="toggle-switch">
                          <input type="checkbox" />
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
                          <input type="radio" name="placementServiceType" value="flexible" className="w-4 h-4 text-primary" defaultChecked />
                          <span className="text-sm font-medium">Service ménage flexible</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="placementServiceType" value="premium" className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Service ménage Premium</span>
                        </label>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Type de structure *</label>
                      <select required>
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
                      <select required>
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
                      <input type="number" defaultValue={1} min={1} required />
                    </div>
                  </>
                )}

                {(selectedService.includes('Auxiliaire') || selectedService.includes('Garde malade') || selectedService.includes('Garde d\'enfant')) && (
                  <>
                    <div className="form-group full-width">
                      <label>Lieu de la garde</label>
                      <div className="flex gap-4 flex-wrap mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="careLocation" value="domicile" className="w-4 h-4 text-primary" defaultChecked />
                          <span className="text-sm font-medium">Domicile</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="careLocation" value="clinique" className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Clinique</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="careLocation" value="hopital" className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Hôpital</span>
                        </label>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Fréquence *</label>
                      <select required>
                        <option value="">Sélectionner...</option>
                        <option value="ponctuel">Une fois - Tranche 24h</option>
                        <option value="1/sem">Abonnement - 1 fois / semaine</option>
                        <option value="quotidien">Abonnement - Quotidien</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Nombre de jours *</label>
                      <input type="number" defaultValue={1} min={1} required />
                    </div>

                    <div className="form-section full-width">
                      <h3>Profil de la personne aidée</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="form-group">
                          <label>Âge *</label>
                          <input type="number" placeholder="Ans" required />
                        </div>
                        <div className="form-group">
                          <label>Sexe *</label>
                          <select required>
                            <option value="">Sélectionner...</option>
                            <option value="femme">Femme</option>
                            <option value="homme">Homme</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Mobilité *</label>
                          <select required>
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
                          <textarea rows={2} placeholder="Précisez la situation..." required></textarea>
                        </div>
                      </div>
                    </div>
                  </>
                )}



                <div className="form-section">
                  <h3 style={{ color: '#547d7c' }}>Tarification & Paiement</h3>
                </div>
                <div className="form-group">
                  <label>Montant total (MAD) *</label>
                  <input type="number" placeholder="0.00" required />
                </div>
                <div className="form-group">
                  <label>Mode de paiement *</label>
                  <select required>
                    <option value="">Choisir...</option>
                    <option value="especes">Espèces sur place</option>
                    <option value="virement">Virement bancaire</option>
                    <option value="tpe">Paiement par TPE</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Statut de paiement</label>
                  <select defaultValue="non_paye">
                    <option value="non_paye">Non payé</option>
                    <option value="paye">Paiement total</option>
                    <option value="acompte">Acompte versé</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Notes client</label>
                  <textarea rows={3} placeholder="Notes ou précisions additionnelles..."></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={() => { 
                const form = document.getElementById('create-request-form') as HTMLFormElement;
                setFormSubmitted(true);
                if (form?.checkValidity()) {
                  alert('Demande créée !'); 
                  setShowCreateModal(false);
                  setFormSubmitted(false);
                } else {
                  // The CSS will show red borders
                }
              }}>
                Ajouter la demande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

