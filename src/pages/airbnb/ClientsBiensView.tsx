import { useState, useEffect, type FormEvent } from 'react';
import { 
  AlertTriangle, Key, Search, Plus, X,
  RotateCw, Building, User, BedDouble, ShieldAlert,
  MessageSquare, CheckCircle2, ArrowRight, ArrowLeft,
  Calendar, Receipt, Info
} from 'lucide-react';
import { getBiens, createBien, syncBienIcal, getBienStats, extractResults, getCommandesAirbnb } from '../../api/airbnb';
import { getClients, createClient } from '../../api/client';
import type { Bien, AirbnbStats, CommandeAirbnb } from '../../types/airbnb';
import './ClientsBiens.css';

export default function ClientsBiensView() {
  // Navigation subtabs: 'listing' | 'client' | 'bien' | 'create'
  const [activeSubtab, setActiveSubtab] = useState<'listing' | 'client' | 'bien' | 'create'>('listing');

  const [biens, setBiens] = useState<Bien[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [stats, setStats] = useState<AirbnbStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search for Listing
  const [search, setSearch] = useState('');
  const [typologyFilter, setTypologyFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

  // Selected entities for 360° inspection
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedBienId, setSelectedBienId] = useState<string | null>(null);
  
  // Sync state
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Wizard 4 Steps State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizClientId, setWizClientId] = useState<number | ''>('');
  const [wizCode, setWizCode] = useState('');
  const [wizNomBien, setWizNomBien] = useState('');
  const [wizAdresse, setWizAdresse] = useState('');
  const [wizQuartier, setWizQuartier] = useState('');
  const [wizVille] = useState('Casablanca');
  const [wizTypologie, setWizTypologie] = useState<'studio' | '2ch' | '3ch' | '4ch' | '5ch' | 'villa_riad'>('studio');
  const [wizAccesType, setWizAccesType] = useState('boite_cle');
  const [wizConsignesSecurite, setWizConsignesSecurite] = useState('');
  const [wizSetsRechange, setWizSetsRechange] = useState<number>(3);
  const [wizZoneEloignee, setWizZoneEloignee] = useState(false);
  const [wizIcalUrl, setWizIcalUrl] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // New Client Modal State
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [newClientFirstName, setNewClientFirstName] = useState('');
  const [newClientLastName, setNewClientLastName] = useState('');
  const [newClientEntity, setNewClientEntity] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientLoading, setNewClientLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [biensRes, clientsRes, statsRes, cmdsRes] = await Promise.all([
        getBiens(),
        getClients(),
        getBienStats(),
        getCommandesAirbnb().catch(() => ({ data: [] }))
      ]);
      const loadedBiens = extractResults<Bien>(biensRes.data);
      const loadedClients = extractResults<any>(clientsRes.data);
      const loadedCmds = extractResults<CommandeAirbnb>(cmdsRes.data);
      setBiens(loadedBiens);
      setClients(loadedClients);
      setCommandes(loadedCmds);
      setStats(statsRes.data);

      if (loadedClients.length > 0 && !selectedClientId) {
        setSelectedClientId(loadedClients[0].id);
      }
      if (loadedBiens.length > 0 && !selectedBienId) {
        setSelectedBienId(loadedBiens[0].id);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des données Airbnb :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Trigramme & Code for Wizard
  useEffect(() => {
    if (wizClientId) {
      const clientObj = clients.find(c => c.id === Number(wizClientId));
      const clientBiens = biens.filter(b => b.client === Number(wizClientId));
      const nextIdx = (clientBiens.length + 1).toString().padStart(3, '0');
      const rawName = clientObj?.last_name || clientObj?.entity_name || 'CLI';
      const trigramme = rawName.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase() || 'BNB';
      setWizCode(`${trigramme}${nextIdx}`);
    } else {
      setWizCode('');
    }
  }, [wizClientId, clients, biens]);

  const handleSyncIcal = async (bienId: string) => {
    setSyncingId(bienId);
    try {
      const res = await syncBienIcal(bienId);
      if (res.data.success) {
        alert(`✓ ${res.data.created_turnovers || 0} turnovers synchronisés`);
      } else {
        alert(`Attention : ${res.data.error || 'Aucun événement'}`);
      }
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleCreateBienSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!wizClientId) return;

    setCreateLoading(true);
    try {
      await createBien({
        client: Number(wizClientId),
        code: wizCode,
        nom_bien: wizNomBien,
        adresse: wizAdresse,
        quartier: wizQuartier,
        ville: wizVille,
        typologie: wizTypologie,
        acces_type: wizAccesType as any,
        acces_detail: wizConsignesSecurite,
        consignes: wizConsignesSecurite ? [wizConsignesSecurite] : [],
        zone_eloignee: wizZoneEloignee,
        ical_url: wizIcalUrl || undefined,
        sets_rechange_client: wizSetsRechange || 3,
        chambres: wizTypologie === 'studio' ? 1 : (parseInt(wizTypologie) || 1),
        salles_de_bain: 1,
        couchages: [],
        is_active: true,
      });

      // Reset & redirect to listing
      setWizNomBien('');
      setWizAdresse('');
      setWizQuartier('');
      setWizConsignesSecurite('');
      setWizIcalUrl('');
      setWizardStep(1);
      setActiveSubtab('listing');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la création du logement.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateClientSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClientLastName && !newClientEntity) {
      alert("Le nom ou la raison sociale est obligatoire.");
      return;
    }

    setNewClientLoading(true);
    try {
      const res = await createClient({
        first_name: newClientFirstName,
        last_name: newClientLastName || newClientEntity,
        entity_name: newClientEntity,
        phone: newClientPhone,
        email: newClientEmail,
        ville: 'Casablanca',
        client_type: 'professionnel',
      });
      alert("✓ Nouveau client conciergerie créé avec succès !");
      setIsNewClientModalOpen(false);
      setNewClientFirstName('');
      setNewClientLastName('');
      setNewClientEntity('');
      setNewClientPhone('');
      setNewClientEmail('');
      await fetchData();
      if (res.data?.id) {
        setWizClientId(res.data.id);
        setActiveSubtab('create');
        setWizardStep(2);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.detail || "Erreur lors de la création du client.");
    } finally {
      setNewClientLoading(false);
    }
  };

  // Filtered Biens
  const filteredBiens = biens.filter((b) => {
    const matchSearch = 
      (b.code && b.code.toLowerCase().includes(search.toLowerCase())) ||
      (b.nom_bien && b.nom_bien.toLowerCase().includes(search.toLowerCase())) ||
      (b.client_name && b.client_name.toLowerCase().includes(search.toLowerCase())) ||
      (b.quartier && b.quartier.toLowerCase().includes(search.toLowerCase()));
    
    const matchTypo = typologyFilter ? b.typologie === typologyFilter : true;
    const matchZone = zoneFilter ? (zoneFilter === 'eloignee' ? b.zone_eloignee : !b.zone_eloignee) : true;

    return matchSearch && matchTypo && matchZone;
  });

  const underThresholdCount = stats?.clients_sous_seuil_alerte || 0;

  // Selected client & property for 360 views
  const currentClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const clientProperties = biens.filter(b => b.client === currentClient?.id);
  const currentBien = biens.find(b => b.id === selectedBienId) || biens[0];
  const currentBienCmds = commandes.filter(c => c.bien === currentBien?.id);

  return (
    <div className="cb-container">
      {/* Top Breadcrumb & Action Header Bar — Fidèle à la maquette */}
      <div className="cb-page-header-row">
        <div className="cb-breadcrumb">
          <span className="cb-breadcrumb-parent">Airbnb / Conciergerie</span>
          <span className="cb-breadcrumb-sep">›</span>
          <span className="cb-breadcrumb-current">Clients & Biens</span>
        </div>

        <div className="cb-header-buttons">
          <button 
            type="button"
            onClick={() => {
              setWizardStep(1);
              setActiveSubtab('create');
            }} 
            className="cb-btn-secondary"
            style={{ fontWeight: 700, padding: '0.45rem 1rem' }}
          >
            <Plus size={15} />
            <span>Nouveau bien</span>
          </button>

          <button 
            type="button"
            onClick={() => setIsNewClientModalOpen(true)} 
            className="cb-btn-primary"
            style={{ fontWeight: 700, padding: '0.45rem 1rem' }}
          >
            <Plus size={15} />
            <span>Nouveau client</span>
          </button>
        </div>
      </div>

      {/* Subtabs Bar — Fidèle aux maquettes Pages 01 à 04 */}
      <div className="cb-subtabs-nav">
        <button 
          className={`cb-subtab-btn ${activeSubtab === 'listing' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('listing')}
        >
          <Building size={16} />
          <span>Clients & Biens</span>
          <span className="cb-subtab-badge">{biens.length}</span>
        </button>

        <button 
          className={`cb-subtab-btn ${activeSubtab === 'client' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('client')}
        >
          <User size={16} />
          <span>Fiche client</span>
        </button>

        <button 
          className={`cb-subtab-btn ${activeSubtab === 'bien' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('bien')}
        >
          <Key size={16} />
          <span>Fiche bien</span>
        </button>

        <button 
          className={`cb-subtab-btn ${activeSubtab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('create')}
        >
          <Plus size={16} />
          <span>+ Créer</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 1 : LISTING CLIENTS & BIENS (Page 01)                         */}
      {/* ========================================================================= */}
      {activeSubtab === 'listing' && (
        <>
          {/* Alerte seuil conciergerie < 3 biens */}
          {underThresholdCount > 0 && (
            <div className="cb-banner-warning">
              <AlertTriangle size={20} />
              <div>
                <span className="cb-banner-title">{underThresholdCount} client(s) sous le seuil contractuel des 3 biens</span>
                Ils bénéficient du tarif conciergerie négocié mais gèrent moins de 3 logements actifs. Contrôle à M+1 requis avec possibilité de reclassement au tarif standard après préavis écrit de 15 jours.
              </div>
            </div>
          )}

          {/* 5 KPI Cards Grid (Maquette Page 01) */}
          <div className="cb-kpi-grid">
            <div className="cb-kpi-card gold">
              <div className="cb-kpi-label">Biens en Gestion</div>
              <div className="cb-kpi-value">{biens.length}</div>
              <div className="cb-kpi-sub">Total logements répertoriés</div>
            </div>

            <div className="cb-kpi-card">
              <div className="cb-kpi-label">Clients Conciergerie</div>
              <div className="cb-kpi-value">{clients.length}</div>
              <div className="cb-kpi-sub">Comptes actifs avec contrat</div>
            </div>

            <div className="cb-kpi-card blue">
              <div className="cb-kpi-label">Contrat Conciergerie</div>
              <div className="cb-kpi-value">
                {clients.length > 0 ? Math.round(((clients.length - underThresholdCount) / clients.length) * 100) : 100}%
              </div>
              <div className="cb-kpi-sub">&ge; 3 biens gérés</div>
            </div>

            <div className="cb-kpi-card purple">
              <div className="cb-kpi-label">En Zone Éloignée</div>
              <div className="cb-kpi-value">{biens.filter(b => b.zone_eloignee).length}</div>
              <div className="cb-kpi-sub">Supplément +50 DH automatique</div>
            </div>

            <div className="cb-kpi-card alert">
              <div className="cb-kpi-label">Sous le Seuil</div>
              <div className="cb-kpi-value">{underThresholdCount}</div>
              <div className="cb-kpi-sub">&lt; 3 biens — à surveiller</div>
            </div>
          </div>

          {/* Toolbar & Filters */}
          <div className="cb-toolbar">
            <div className="cb-toolbar-left">
              <div className="cb-search-wrapper">
                <Search size={16} className="cb-search-icon" />
                <input
                  type="text"
                  placeholder="Rechercher par code (ex: GBE001), client, quartier..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="cb-search-input"
                />
              </div>

              <select
                value={typologyFilter}
                onChange={(e) => setTypologyFilter(e.target.value)}
                className="cb-filter-select"
              >
                <option value="">Toutes typologies</option>
                <option value="studio">Studio / 1 Chambre</option>
                <option value="2ch">2 Chambres</option>
                <option value="3ch">3 Chambres</option>
                <option value="4ch">4 Chambres</option>
                <option value="5ch">5 Chambres</option>
                <option value="villa_riad">Villa / Riad</option>
              </select>

              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="cb-filter-select"
              >
                <option value="">Toutes zones</option>
                <option value="standard">Casablanca Centre</option>
                <option value="eloignee">Zone Éloignée (+50 DH)</option>
              </select>
            </div>

            <button 
              onClick={() => setActiveSubtab('create')}
              className="cb-btn-primary"
            >
              <Plus size={16} />
              <span>Nouveau Logement</span>
            </button>
          </div>

          {/* Table Card */}
          <div className="cb-table-card">
            <table className="cb-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Client</th>
                  <th>Nom / Quartier</th>
                  <th>Typologie</th>
                  <th>Rechange Linge</th>
                  <th>Zone</th>
                  <th>Contrat</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                      Chargement des logements...
                    </td>
                  </tr>
                ) : filteredBiens.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Aucun bien trouvé pour ces critères.
                    </td>
                  </tr>
                ) : (
                  filteredBiens.map((bien) => (
                    <tr 
                      key={bien.id}
                      onClick={() => {
                        setSelectedBienId(bien.id);
                        if (bien.client) setSelectedClientId(bien.client);
                        setActiveSubtab('bien');
                      }}
                    >
                      <td>
                        <span className="cb-code-badge">{bien.code}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {bien.client_name || 'Client Inconnu'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {bien.nom_bien || bien.quartier}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {bien.adresse?.substring(0, 32)}...
                        </div>
                      </td>
                      <td>
                        <span className="cb-tag-typology">
                          {bien.typologie}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: '#00473E' }}>
                          {bien.sets_rechange_client || 3} jeux
                        </span>
                      </td>
                      <td>
                        {bien.zone_eloignee ? (
                          <span className="cb-tag-zone">+50 DH</span>
                        ) : (
                          <span className="cb-tag-standard">Standard</span>
                        )}
                      </td>
                      <td>
                        <span className="cb-status-pill conciergerie">
                          ✓ Conciergerie
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedBienId(bien.id);
                              setActiveSubtab('bien');
                            }}
                            className="cb-btn-details"
                          >
                            Fiche Bien
                          </button>
                          <button
                            onClick={() => {
                              if (bien.client) {
                                setSelectedClientId(bien.client);
                                setActiveSubtab('client');
                              }
                            }}
                            className="cb-btn-details"
                          >
                            Client
                          </button>
                          {bien.ical_url && (
                            <button
                              onClick={() => handleSyncIcal(bien.id)}
                              disabled={syncingId === bien.id}
                              className="cb-btn-details"
                              title="Synchroniser le calendrier iCal"
                            >
                              <RotateCw size={12} className={syncingId === bien.id ? 'animate-spin' : ''} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 2 : FICHE CLIENT 360° (Page 02)                              */}
      {/* ========================================================================= */}
      {activeSubtab === 'client' && currentClient && (
        <div className="cb-detail-card">
          {/* Header Banner Client */}
          <div className="cb-banner-header">
            <div className="cb-banner-left">
              <div className="cb-trigramme-circle">
                {(currentClient.last_name || currentClient.entity_name || 'CLI').substring(0, 3).toUpperCase()}
              </div>
              <div>
                <h2 className="cb-banner-title-text">
                  {currentClient.first_name} {currentClient.last_name} {currentClient.entity_name ? `(${currentClient.entity_name})` : ''}
                </h2>
                <p className="cb-banner-subtitle-text">
                  Client Conciergerie · {clientProperties.length} bien(s) actif(s) · {currentClient.city || 'Casablanca'}
                </p>
              </div>
            </div>

            <div className="cb-banner-actions">
              <select 
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(Number(e.target.value))}
                className="cb-filter-select"
                style={{ background: '#ffffff', color: '#00473E', fontWeight: 700 }}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} {c.entity_name ? `(${c.entity_name})` : ''}
                  </option>
                ))}
              </select>

              {currentClient.phone && (
                <a 
                  href={`https://wa.me/${currentClient.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank" 
                  rel="noreferrer"
                  className="cb-btn-whatsapp"
                >
                  <MessageSquare size={16} />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          <div className="cb-detail-body">
            {/* 3 KPIs Client */}
            <div className="cb-kpi-grid">
              <div className="cb-kpi-card gold">
                <div className="cb-kpi-label">Biens Confiés</div>
                <div className="cb-kpi-value">{clientProperties.length}</div>
                <div className="cb-kpi-sub">Logements sous contrat</div>
              </div>

              <div className="cb-kpi-card">
                <div className="cb-kpi-label">Volume Mensuel Estimé</div>
                <div className="cb-kpi-value">{clientProperties.length * 160 * 3} DH</div>
                <div className="cb-kpi-sub">Base moyenne de rotations</div>
              </div>

              <div className="cb-kpi-card blue">
                <div className="cb-kpi-label">Statut Contrat</div>
                <div className="cb-kpi-value">
                  {clientProperties.length >= 3 ? 'Éligible' : 'Sous Seuil'}
                </div>
                <div className="cb-kpi-sub">
                  {clientProperties.length >= 3 ? 'Tarif conciergerie actif' : 'Reclassement possible à M+1'}
                </div>
              </div>
            </div>

            {/* Éligibilité Seuil Conciergerie */}
            <div className={clientProperties.length >= 3 ? 'cb-banner-info' : 'cb-banner-warning'}>
              {clientProperties.length >= 3 ? (
                <>
                  <CheckCircle2 size={20} />
                  <div>
                    <span style={{ fontWeight: 800 }}>Éligible au tarif conciergerie</span>
                    <br />
                    Ce compte dispose de {clientProperties.length} biens actifs (seuil contractuel minimum de 3 biens respecté). Facturation mensuelle groupée le 26 de chaque mois.
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={20} />
                  <div>
                    <span style={{ fontWeight: 800 }}>Attention : Seuil des 3 biens non atteint</span>
                    <br />
                    Ce client ne confie actuellement que {clientProperties.length} bien(s). Un contrôle de reclassement s'applique après une période de préavis de 15 jours.
                  </div>
                </>
              )}
            </div>

            {/* Liste des Biens du Client */}
            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <Building size={16} />
                <span>Logements gérés pour ce client ({clientProperties.length})</span>
              </div>

              <table className="cb-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Nom du bien</th>
                    <th>Quartier</th>
                    <th>Typologie</th>
                    <th>Jeux de rechange</th>
                    <th>Zone</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProperties.map(p => (
                    <tr key={p.id}>
                      <td><span className="cb-code-badge">{p.code}</span></td>
                      <td style={{ fontWeight: 700 }}>{p.nom_bien || p.quartier}</td>
                      <td>{p.quartier}</td>
                      <td><span className="cb-tag-typology">{p.typologie}</span></td>
                      <td style={{ fontWeight: 700, color: '#00473E' }}>{p.sets_rechange_client || 3} sets</td>
                      <td>{p.zone_eloignee ? <span className="cb-tag-zone">+50 DH</span> : 'Standard'}</td>
                      <td>
                        <button 
                          onClick={() => {
                            setSelectedBienId(p.id);
                            setActiveSubtab('bien');
                          }}
                          className="cb-btn-details"
                        >
                          Voir la fiche
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mode de règlement & Coordonnées */}
            <div className="cb-grid-2col">
              <div className="cb-section-box">
                <div className="cb-section-box-title">
                  <Receipt size={16} />
                  <span>Modalités de Facturation</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Cycle de facturation :</span>
                    <strong>Mensuel groupé (26 au 25)</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Délai de règlement :</span>
                    <strong>4 jours après émission</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Suspension automatique :</span>
                    <strong style={{ color: '#dc2626' }}>À J+4 après échéance</strong>
                  </div>
                </div>
              </div>

              <div className="cb-section-box">
                <div className="cb-section-box-title">
                  <User size={16} />
                  <span>Contact & Communication</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Téléphone :</span>
                    <strong>{currentClient.phone || 'Non renseigné'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Email :</span>
                    <strong>{currentClient.email || 'Non renseigné'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Chargée de clientèle :</span>
                    <strong>Kawtar EL IDRISSI</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 3 : FICHE BIEN 360° (Page 03)                                */}
      {/* ========================================================================= */}
      {activeSubtab === 'bien' && currentBien && (
        <div className="cb-detail-card">
          {/* Header Banner Bien */}
          <div className="cb-banner-header">
            <div className="cb-banner-left">
              <div className="cb-trigramme-circle">
                {currentBien.code}
              </div>
              <div>
                <h2 className="cb-banner-title-text">
                  {currentBien.code} — {currentBien.nom_bien || 'Logement'}
                </h2>
                <p className="cb-banner-subtitle-text">
                  Propriétaire : {currentBien.client_name || 'Client'} · {currentBien.quartier}, {currentBien.ville}
                </p>
              </div>
            </div>

            <div className="cb-banner-actions">
              <select 
                value={selectedBienId || ''}
                onChange={(e) => setSelectedBienId(e.target.value)}
                className="cb-filter-select"
                style={{ background: '#ffffff', color: '#00473E', fontWeight: 700 }}
              >
                {biens.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.nom_bien || b.quartier}
                  </option>
                ))}
              </select>

              {currentBien.ical_url && (
                <button
                  onClick={() => handleSyncIcal(currentBien.id)}
                  disabled={syncingId === currentBien.id}
                  className="cb-btn-secondary"
                  style={{ background: '#ffffff', color: '#00473E' }}
                >
                  <RotateCw size={14} className={syncingId === currentBien.id ? 'animate-spin' : ''} />
                  <span>Synchro iCal</span>
                </button>
              )}
            </div>
          </div>

          <div className="cb-detail-body">
            {/* 3 KPIs Bien */}
            <div className="cb-kpi-grid">
              <div className="cb-kpi-card gold">
                <div className="cb-kpi-label">Tarif Turnover</div>
                <div className="cb-kpi-value">
                  {currentBien.typologie === 'studio' ? '130' : currentBien.typologie === '2ch' ? '160' : currentBien.typologie === '3ch' ? '190' : '220'} DH
                </div>
                <div className="cb-kpi-sub">Ménage remise en état hôtelière</div>
              </div>

              <div className="cb-kpi-card">
                <div className="cb-kpi-label">Jeux de Rechange Linge</div>
                <div className="cb-kpi-value">{currentBien.sets_rechange_client || 3} Sets</div>
                <div className="cb-kpi-sub">8 pièces / set · Stock client dédié</div>
              </div>

              <div className="cb-kpi-card blue">
                <div className="cb-kpi-label">Zone Géographique</div>
                <div className="cb-kpi-value">
                  {currentBien.zone_eloignee ? '+50 DH' : 'Standard'}
                </div>
                <div className="cb-kpi-sub">
                  {currentBien.zone_eloignee ? `${currentBien.quartier} (Zone éloignée)` : 'Casablanca Intra-muros'}
                </div>
              </div>
            </div>

            {/* Modalités d'accès sensibles (Digicodes) */}
            <div className="cb-sensitive-callout">
              <div className="cb-sensitive-callout-header">
                <ShieldAlert size={18} />
                <span>Modalités d'Accès Sensibles & Digicodes (Confidentiel Opérations)</span>
              </div>
              <div className="cb-sensitive-callout-body">
                <div><strong>Adresse exacte :</strong> {currentBien.adresse || 'Rue standard, Casablanca'}</div>
                <div style={{ marginTop: '0.4rem' }}>
                  <strong>Type d'accès :</strong> {currentBien.acces_type === 'boite_cle' ? 'Boîte à clés' : 'Gardien / Digicode'}
                </div>
                <div style={{ marginTop: '0.4rem' }}>
                  <strong>Codes & Instructions d'entrée :</strong> {currentBien.acces_detail || 'Boîte à clés à droite de la porte — Code 4512 — Gardien Hassan'}
                </div>
              </div>
            </div>

            {/* Composition du set standard 8 pièces */}
            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <BedDouble size={16} />
                <span>Composition Standard du Set de Linge (8 Pièces / Set)</span>
              </div>

              <div className="cb-linen-composition-grid">
                <div className="cb-linen-pill">
                  <span className="cb-linen-pill-qty">1</span>
                  <span className="cb-linen-pill-name">Housse de couette</span>
                </div>
                <div className="cb-linen-pill">
                  <span className="cb-linen-pill-qty">1</span>
                  <span className="cb-linen-pill-name">Drap plat</span>
                </div>
                <div className="cb-linen-pill">
                  <span className="cb-linen-pill-qty">2</span>
                  <span className="cb-linen-pill-name">Taies d'oreiller</span>
                </div>
                <div className="cb-linen-pill">
                  <span className="cb-linen-pill-qty">2</span>
                  <span className="cb-linen-pill-name">Grandes serviettes</span>
                </div>
                <div className="cb-linen-pill">
                  <span className="cb-linen-pill-qty">2</span>
                  <span className="cb-linen-pill-name">Petites serviettes</span>
                </div>
              </div>
            </div>

            {/* Consignes particulières & Pricing box */}
            <div className="cb-grid-2col">
              <div className="cb-section-box">
                <div className="cb-section-box-title">
                  <Info size={16} />
                  <span>Consignes Spécifiques du Logement</span>
                </div>
                <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
                  <li>Lit fait façon hôtelière avec oreillers debout.</li>
                  <li>Ne pas toucher au placard fermé de la chambre 2.</li>
                  <li>Chat présent : veiller à laisser les baies vitrées fermées.</li>
                  <li>Produits de ménage de recharge stockés sous l'évier.</li>
                </ul>
              </div>

              <div className="cb-pricing-box">
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ccfbf1' }}>
                  Tarification par Prestation
                </span>
                <div className="cb-pricing-row">
                  <span>Ménage turnover ({currentBien.typologie}) :</span>
                  <strong>{currentBien.typologie === 'studio' ? '130' : '160'} DH</strong>
                </div>
                <div className="cb-pricing-row">
                  <span>Linge (1 set standard 8 pcs) :</span>
                  <strong>50 DH</strong>
                </div>
                {currentBien.zone_eloignee && (
                  <div className="cb-pricing-row">
                    <span>Supplément zone éloignée :</span>
                    <strong>50 DH</strong>
                  </div>
                )}
                <div className="cb-pricing-total">
                  <span>Total Indicatif Turnover :</span>
                  <span>{currentBien.zone_eloignee ? '260' : '210'} DH</span>
                </div>
              </div>
            </div>

            {/* Historique des Derniers Turnovers */}
            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <Calendar size={16} />
                <span>Derniers Turnovers Réalisés sur ce Logement</span>
              </div>

              {currentBienCmds.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#64748b', padding: '0.5rem 0' }}>
                  Aucun turnover enregistré récemment pour ce bien.
                </div>
              ) : (
                <table className="cb-table">
                  <thead>
                    <tr>
                      <th>Numéro Commande</th>
                      <th>Date Prestation</th>
                      <th>Créneau</th>
                      <th>Intervenante</th>
                      <th>Total TTC</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBienCmds.slice(0, 5).map(cmd => (
                      <tr key={cmd.id}>
                        <td><span className="cb-code-badge">{cmd.numero}</span></td>
                        <td>{cmd.date_prestation}</td>
                        <td>{cmd.heure_prestation}</td>
                        <td>{cmd.intervenante_name || 'Non assignée'}</td>
                        <td style={{ fontWeight: 800, color: '#00473E' }}>{cmd.total_ttc} DH</td>
                        <td><span className="cb-tag-standard">{cmd.statut}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 4 : WIZARD 4 ÉTAPES CRÉER UN BIEN (Page 04)                   */}
      {/* ========================================================================= */}
      {activeSubtab === 'create' && (
        <div className="cb-wizard-card">
          {/* Stepper Navigation */}
          <div className="cb-wizard-stepper">
            <div className={`cb-wizard-step ${wizardStep === 1 ? 'active' : wizardStep > 1 ? 'done' : ''}`}>
              <span className="cb-wizard-step-num">1</span>
              <span>Client</span>
            </div>
            <div className={`cb-wizard-step ${wizardStep === 2 ? 'active' : wizardStep > 2 ? 'done' : ''}`}>
              <span className="cb-wizard-step-num">2</span>
              <span>Bien et code</span>
            </div>
            <div className={`cb-wizard-step ${wizardStep === 3 ? 'active' : wizardStep > 3 ? 'done' : ''}`}>
              <span className="cb-wizard-step-num">3</span>
              <span>Accès et linge</span>
            </div>
            <div className={`cb-wizard-step ${wizardStep === 4 ? 'active' : ''}`}>
              <span className="cb-wizard-step-num">4</span>
              <span>Récapitulatif</span>
            </div>
          </div>

          <form onSubmit={handleCreateBienSubmit}>
            <div className="cb-wizard-body">
              {/* ÉTAPE 1 : CLIENT */}
              {wizardStep === 1 && (
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                    Étape 1 : Rattachement Client ou Conciergerie
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                    Sélectionnez le client propriétaire du bien. Le trigramme unique sera dérivé de son identité.
                  </p>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Client Propriétaire <span className="req">*</span></label>
                    <select
                      value={wizClientId}
                      onChange={(e) => setWizClientId(Number(e.target.value))}
                      required
                      className="cb-form-select"
                    >
                      <option value="">Sélectionnez un client...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.first_name} {c.last_name} {c.entity_name ? `(${c.entity_name})` : ''} — {c.phone || c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ÉTAPE 2 : BIEN ET CODE */}
              {wizardStep === 2 && (
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                    Étape 2 : Caractéristiques & Codification Unique
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
                    Génération automatique du code bien selon la règle des 3 lettres + 3 chiffres séquentiels.
                  </p>

                  {/* Dynamic Code Preview Box */}
                  <div className="cb-code-preview-card">
                    <div>
                      <div className="cb-code-preview-label">Code Trigramme Attribué</div>
                      <div style={{ fontSize: '0.8rem', color: '#ccfbf1' }}>Non réassignable après création</div>
                    </div>
                    <div className="cb-code-preview-val">{wizCode || 'GBE001'}</div>
                  </div>

                  <div className="cb-form-grid-2">
                    <div className="cb-form-group">
                      <label className="cb-form-label">Nom usuel du bien <span className="req">*</span></label>
                      <input
                        type="text"
                        placeholder="Ex: Studio Gauthier, 2ch Racine..."
                        value={wizNomBien}
                        onChange={(e) => setWizNomBien(e.target.value)}
                        required
                        className="cb-form-input"
                      />
                    </div>

                    <div className="cb-form-group">
                      <label className="cb-form-label">Typologie <span className="req">*</span></label>
                      <select
                        value={wizTypologie}
                        onChange={(e) => setWizTypologie(e.target.value as any)}
                        className="cb-form-select"
                      >
                        <option value="studio">Studio / 1 Chambre (130 DH)</option>
                        <option value="2ch">2 Chambres (160 DH)</option>
                        <option value="3ch">3 Chambres (190 DH)</option>
                        <option value="4ch">4 Chambres (220 DH)</option>
                        <option value="5ch">5 Chambres (250 DH)</option>
                        <option value="villa_riad">Villa / Riad (300 DH)</option>
                      </select>
                    </div>
                  </div>

                  <div className="cb-form-grid-2">
                    <div className="cb-form-group">
                      <label className="cb-form-label">Quartier <span className="req">*</span></label>
                      <input
                        type="text"
                        placeholder="Ex: Gauthier, Maârif, Bouskoura..."
                        value={wizQuartier}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWizQuartier(val);
                          // Auto-detect zone éloignée
                          const remote = ['bouskoura', 'dar bouazza', 'mohammedia', 'ville verte', 'mansouria', 'sidi rahal', 'almaz'];
                          setWizZoneEloignee(remote.some(z => val.toLowerCase().includes(z)));
                        }}
                        required
                        className="cb-form-input"
                      />
                    </div>

                    <div className="cb-form-group">
                      <label className="cb-form-label">Zone Éloignée (+50 DH)</label>
                      <div style={{ display: 'flex', alignItems: 'center', height: '42px', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          id="wizZone"
                          checked={wizZoneEloignee}
                          onChange={(e) => setWizZoneEloignee(e.target.checked)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <label htmlFor="wizZone" style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                          Appliquer le supplément +50 DH
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Adresse Complète <span className="req">*</span></label>
                    <textarea
                      placeholder="Rue, numéro, étage, numéro d'appartement..."
                      value={wizAdresse}
                      onChange={(e) => setWizAdresse(e.target.value)}
                      required
                      rows={2}
                      className="cb-form-textarea"
                    />
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : ACCÈS ET LINGE */}
              {wizardStep === 3 && (
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                    Étape 3 : Modalités d'Accès & Stock de Linge
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                    Renseignez les digicodes protégés et le nombre de sets de rechange exigés (3 recommandés).
                  </p>

                  <div className="cb-form-grid-2">
                    <div className="cb-form-group">
                      <label className="cb-form-label">Type d'accès <span className="req">*</span></label>
                      <select
                        value={wizAccesType}
                        onChange={(e) => setWizAccesType(e.target.value)}
                        className="cb-form-select"
                      >
                        <option value="boite_cle">Boîte à clés sécurisée</option>
                        <option value="gardien">Gardien d'immeuble</option>
                        <option value="serrure_connectee">Serrure connectée</option>
                        <option value="physique">Remise physique de clés</option>
                      </select>
                    </div>

                    <div className="cb-form-group">
                      <label className="cb-form-label">Sets de Rechange Client</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={wizSetsRechange}
                        onChange={(e) => setWizSetsRechange(parseInt(e.target.value) || 3)}
                        className="cb-form-input"
                      />
                    </div>
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Digicodes & Consignes Sensibles d'Accès</label>
                    <textarea
                      placeholder="Ex: Boîte à clés à droite de la porte code 4512 — Gardien Hassan 7h-20h..."
                      value={wizConsignesSecurite}
                      onChange={(e) => setWizConsignesSecurite(e.target.value)}
                      rows={3}
                      className="cb-form-textarea"
                    />
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">URL du flux iCal Airbnb (Optionnel)</label>
                    <input
                      type="url"
                      placeholder="https://www.airbnb.fr/calendar/ical/..."
                      value={wizIcalUrl}
                      onChange={(e) => setWizIcalUrl(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>
                </div>
              )}

              {/* ÉTAPE 4 : RÉCAPITULATIF */}
              {wizardStep === 4 && (
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                    Étape 4 : Récapitulatif & Enregistrement
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                    Vérifiez l'ensemble des éléments avant l'attribution définitive du code logement.
                  </p>

                  <div className="cb-pricing-box" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#ccfbf1' }}>Code Logement Définitif :</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 900, color: '#C9A84C' }}>
                        {wizCode}
                      </span>
                    </div>
                    <div className="cb-pricing-row">
                      <span>Nom du bien :</span>
                      <strong>{wizNomBien}</strong>
                    </div>
                    <div className="cb-pricing-row">
                      <span>Typologie :</span>
                      <strong>{wizTypologie}</strong>
                    </div>
                    <div className="cb-pricing-row">
                      <span>Quartier :</span>
                      <strong>{wizQuartier} ({wizZoneEloignee ? 'Zone éloignée +50 DH' : 'Standard'})</strong>
                    </div>
                    <div className="cb-pricing-row">
                      <span>Accès :</span>
                      <strong>{wizAccesType}</strong>
                    </div>
                    <div className="cb-pricing-row">
                      <span>Stock Linge Rechange :</span>
                      <strong>{wizSetsRechange} sets</strong>
                    </div>
                  </div>

                  <div className="cb-banner-info">
                    <CheckCircle2 size={20} />
                    <div>
                      <strong>Prêt pour la gestion opérationnelle</strong>
                      <br />
                      Dès l'enregistrement, ce bien sera disponible pour la planification des turnovers, la génération des tournées runner et le suivi du cycle du linge.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wizard Navigation Footer */}
            <div className="cb-wizard-footer">
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                  className="cb-btn-secondary"
                >
                  <ArrowLeft size={16} />
                  <span>Précédent</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSubtab('listing')}
                  className="cb-btn-secondary"
                >
                  Annuler
                </button>
              )}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  disabled={wizardStep === 1 && !wizClientId}
                  onClick={() => setWizardStep((prev) => (prev + 1) as any)}
                  className="cb-btn-primary"
                >
                  <span>Suivant</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={createLoading}
                  className="cb-btn-primary"
                  style={{ background: '#00473E', color: '#ffffff' }}
                >
                  {createLoading ? 'Création en cours...' : '✓ Valider et Créer le Logement'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Modal : Nouveau Client Conciergerie */}
      {isNewClientModalOpen && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-box">
            <div className="dc-modal-header">
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: '#00473E' }}>
                + Nouveau Client Conciergerie
              </h3>
              <button 
                type="button" 
                onClick={() => setIsNewClientModalOpen(false)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateClientSubmit}>
              <div className="dc-modal-body">
                <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                  Créez le compte client ou conciergerie. Un trigramme unique (ex: <strong>GBE</strong>) sera automatiquement calculé pour la codification de ses logements.
                </p>

                <div className="cb-form-grid-2">
                  <div className="cb-form-group">
                    <label className="cb-form-label">Prénom du Responsable</label>
                    <input
                      type="text"
                      placeholder="Ex: Ghali"
                      value={newClientFirstName}
                      onChange={(e) => setNewClientFirstName(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Nom de Famille <span className="req">*</span></label>
                    <input
                      type="text"
                      placeholder="Ex: Bensouda"
                      value={newClientLastName}
                      onChange={(e) => setNewClientLastName(e.target.value)}
                      required
                      className="cb-form-input"
                    />
                  </div>
                </div>

                <div className="cb-form-group" style={{ marginTop: '0.75rem' }}>
                  <label className="cb-form-label">Raison Sociale / Entité Conciergerie (Optionnel)</label>
                  <input
                    type="text"
                    placeholder="Ex: Casablanca Suites & Conciergerie SARL"
                    value={newClientEntity}
                    onChange={(e) => setNewClientEntity(e.target.value)}
                    className="cb-form-input"
                  />
                </div>

                <div className="cb-form-grid-2" style={{ marginTop: '0.75rem' }}>
                  <div className="cb-form-group">
                    <label className="cb-form-label">Téléphone / WhatsApp <span className="req">*</span></label>
                    <input
                      type="tel"
                      placeholder="06 61 XX XX XX"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      required
                      className="cb-form-input"
                    />
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Email</label>
                    <input
                      type="email"
                      placeholder="contact@conciergerie.ma"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="dc-modal-footer">
                <button 
                  type="button" 
                  onClick={() => setIsNewClientModalOpen(false)} 
                  className="cb-btn-secondary"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={newClientLoading} 
                  className="cb-btn-primary"
                >
                  {newClientLoading ? 'Création...' : '✓ Enregistrer le Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
