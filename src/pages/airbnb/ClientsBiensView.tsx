import { useState, useEffect, type FormEvent } from 'react';
import { 
  AlertTriangle, Key, Search, Plus, 
  RotateCw, X, ShieldAlert, Sparkles, Building
} from 'lucide-react';
import { getBiens, createBien, syncBienIcal, getBienStats, extractResults } from '../../api/airbnb';
import { getClients } from '../../api/client';
import type { Bien, AirbnbStats } from '../../types/airbnb';
import './ClientsBiens.css';

export default function ClientsBiensView() {
  const [biens, setBiens] = useState<Bien[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [stats, setStats] = useState<AirbnbStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typologyFilter, setTypologyFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

  // Modals state
  const [selectedBien, setSelectedBien] = useState<Bien | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ id: string; msg: string } | null>(null);

  // Create Bien Form state
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [nomBien, setNomBien] = useState('');
  const [adresse, setAdresse] = useState('');
  const [quartier, setQuartier] = useState('');
  const [ville] = useState('Casablanca');
  const [typologie, setTypologie] = useState<'studio' | '2ch' | '3ch' | '4ch' | '5ch' | 'villa_riad'>('studio');
  const [accesSecurise, setAccesSecurise] = useState('boite_cle');
  const [consignesSecurite, setConsignesSecurite] = useState('');
  const [zoneEloignee, setZoneEloignee] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [biensRes, clientsRes, statsRes] = await Promise.all([
        getBiens(),
        getClients(),
        getBienStats()
      ]);
      setBiens(extractResults<Bien>(biensRes.data));
      setClients(extractResults<any>(clientsRes.data));
      setStats(statsRes.data);
    } catch (err) {
      console.error("Erreur lors du chargement des données Airbnb :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Next Bien Code when selectedClientId changes
  useEffect(() => {
    if (selectedClientId) {
      getBiens({ client: selectedClientId })
        .then((res) => {
          const list = extractResults<Bien>(res.data);
          const nextIdx = (list.length + 1).toString().padStart(3, '0');
          const clientObj = clients.find(c => c.id === Number(selectedClientId));
          const trigramme = (clientObj?.last_name || 'CLI').substring(0, 3).toUpperCase();
          setGeneratedCode(`${trigramme}${nextIdx}`);
        })
        .catch(() => setGeneratedCode('BNB001'));
    } else {
      setGeneratedCode('');
    }
  }, [selectedClientId, clients]);

  const handleCreateBien = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    setCreateLoading(true);
    try {
      await createBien({
        client: Number(selectedClientId),
        code: generatedCode,
        nom_bien: nomBien,
        adresse,
        quartier,
        ville,
        typologie,
        acces_type: accesSecurise as any,
        acces_detail: consignesSecurite,
        consignes: consignesSecurite ? [consignesSecurite] : [],
        zone_eloignee: zoneEloignee,
        ical_url: icalUrl || undefined,
        sets_rechange_client: 2,
        chambres: typologie === 'studio' ? 1 : (parseInt(typologie) || 1),
        salles_de_bain: 1,
        couchages: [],
        is_active: true,
      });
      setIsCreateOpen(false);
      // Reset form
      setNomBien('');
      setAdresse('');
      setQuartier('');
      setConsignesSecurite('');
      setIcalUrl('');
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la création du logement.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSyncIcal = async (bienId: string) => {
    setSyncingId(bienId);
    setSyncResult(null);
    try {
      const res = await syncBienIcal(bienId);
      if (res.data.success) {
        setSyncResult({ id: bienId, msg: `✓ ${res.data.created_turnovers || 0} turnovers synchronisés` });
      } else {
        setSyncResult({ id: bienId, msg: `Attention : ${res.data.error || 'Aucun événement'}` });
      }
    } catch (err: any) {
      setSyncResult({ id: bienId, msg: `Erreur : ${err.message}` });
    } finally {
      setSyncingId(null);
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

  return (
    <div className="cb-container">
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

      {/* KPI Cards Grid */}
      <div className="cb-kpi-grid">
        <div className="cb-kpi-card gold">
          <div className="cb-kpi-label">Biens Actifs</div>
          <div className="cb-kpi-value">{biens.length}</div>
          <div className="cb-kpi-sub">Sur {biens.length} logements répertoriés</div>
        </div>

        <div className="cb-kpi-card">
          <div className="cb-kpi-label">Clients Conciergerie</div>
          <div className="cb-kpi-value">{clients.length}</div>
          <div className="cb-kpi-sub">Comptes propriétaires & concierges</div>
        </div>

        <div className="cb-kpi-card alert">
          <div className="cb-kpi-label">Sous le Seuil</div>
          <div className="cb-kpi-value">{underThresholdCount}</div>
          <div className="cb-kpi-sub">&lt; 3 biens — à reclasser</div>
        </div>

        <div className="cb-kpi-card blue">
          <div className="cb-kpi-label">En Zone Éloignée</div>
          <div className="cb-kpi-value">{biens.filter(b => b.zone_eloignee).length}</div>
          <div className="cb-kpi-sub">Supplément +50 DH automatique</div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="cb-toolbar">
        <div className="cb-toolbar-left">
          <div className="cb-search-wrapper">
            <Search size={16} className="cb-search-icon" />
            <input
              type="text"
              placeholder="Rechercher par code (ex: GBE001), nom, client, quartier..."
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
            <option value="standard">Casablanca Standard</option>
            <option value="eloignee">Zone Éloignée (+50 DH)</option>
          </select>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="cb-btn-primary"
        >
          <Plus size={16} />
          Nouveau Logement
        </button>
      </div>

      {/* Main Table Card */}
      <div className="cb-table-card">
        <table className="cb-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Logement</th>
              <th>Client / Propriétaire</th>
              <th>Quartier & Ville</th>
              <th>Typologie</th>
              <th>Accès</th>
              <th>Stock Linge</th>
              <th>Statut</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  Chargement des logements...
                </td>
              </tr>
            ) : filteredBiens.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <Building size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  Aucun logement trouvé correspondant aux critères.
                </td>
              </tr>
            ) : (
              filteredBiens.map((b) => (
                <tr key={b.id} onClick={() => { setSelectedBien(b); setIsDetailOpen(true); }}>
                  <td>
                    <span className="cb-code-badge">{b.code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{b.nom_bien || 'Sans nom'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.adresse}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{b.client_name || 'Client N/A'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.client_phone || '—'}</div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{b.quartier}</span>, {b.ville}
                    {b.zone_eloignee && <span className="cb-tag-zone">+50 DH</span>}
                  </td>
                  <td>
                    <span className="cb-tag-typology">{b.typologie.toUpperCase()}</span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#475569' }}>
                      <Key size={13} color="#d97706" />
                      {b.acces_type?.replace(/_/g, ' ') || 'Standard'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#334155' }}>
                    {b.sets_rechange_client} jeux
                  </td>
                  <td>
                    <span className={`cb-status-dot ${b.is_active ? 'active' : 'inactive'}`}>
                      {b.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="cb-btn-details"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBien(b);
                        setIsDetailOpen(true);
                      }}
                    >
                      Détails
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════ MODALE : FICHE BIEN DÉTAILLÉE ══════════ */}
      {isDetailOpen && selectedBien && (
        <div className="cb-modal-overlay" onClick={() => setIsDetailOpen(false)}>
          <div className="cb-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cb-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="cb-code-badge">{selectedBien.code}</span>
                <h3>Fiche du Logement</h3>
              </div>
              <button className="cb-modal-close" onClick={() => setIsDetailOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="cb-modal-body">
              {/* Detail Banner */}
              <div className="cb-detail-banner">
                <div>
                  <span className="cb-detail-meta">LOGEMENT AIRBNB & CONCIERGERIE</span>
                  <h2>{selectedBien.nom_bien || selectedBien.quartier}</h2>
                  <div className="cb-detail-meta">{selectedBien.adresse} ({selectedBien.quartier}, {selectedBien.ville})</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="cb-tag-typology" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                    {selectedBien.typologie.toUpperCase()}
                  </span>
                  {selectedBien.zone_eloignee && (
                    <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#fef08a', fontWeight: 700 }}>
                      Zone Éloignée (+50 DH)
                    </div>
                  )}
                </div>
              </div>

              {/* Box Accès Sensibles & Digicodes */}
              <div className="cb-sensitive-box">
                <div className="cb-sensitive-header">
                  <ShieldAlert size={16} />
                  Consignes d'Accès Sécurisé (Strictement Confidentiel)
                </div>
                <div className="cb-sensitive-content">
                  Type d'accès : {selectedBien.acces_type?.replace(/_/g, ' ') || 'Boîte à clés'}<br />
                  Code / Instructions : {selectedBien.acces_detail || (selectedBien.consignes?.[0]) || 'Aucun code renseigné'}
                </div>
              </div>

              {/* Grid 2 colonnes métadonnées */}
              <div className="cb-form-grid-2">
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div className="cb-form-label">Client Associé</div>
                  <div style={{ fontWeight: 700, marginTop: '4px' }}>{selectedBien.client_name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedBien.client_phone || 'Pas de numéro'}</div>
                </div>

                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div className="cb-form-label">Gestion du Linge</div>
                  <div style={{ fontWeight: 700, marginTop: '4px' }}>{selectedBien.sets_rechange_client} jeux de rechange</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Stock client sur site</div>
                </div>
              </div>

              {/* Flux iCal Card */}
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="cb-form-label">Flux Calendrier iCal (Airbnb / Booking)</span>
                  <button
                    className="cb-btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    onClick={() => handleSyncIcal(selectedBien.id)}
                    disabled={syncingId === selectedBien.id || !selectedBien.ical_url}
                  >
                    <RotateCw size={12} className={syncingId === selectedBien.id ? 'animate-spin' : ''} />
                    {syncingId === selectedBien.id ? 'Synchronisation...' : 'Tester Synchro'}
                  </button>
                </div>
                <div style={{ fontSize: '0.775rem', fontFamily: 'monospace', color: '#475569', wordBreak: 'break-all', background: '#ffffff', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1' }}>
                  {selectedBien.ical_url || "Aucun flux iCal configuré pour ce logement."}
                </div>
                {syncResult && syncResult.id === selectedBien.id && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', fontWeight: 600, color: syncResult.msg.startsWith('✓') ? '#15803d' : '#b45309' }}>
                    {syncResult.msg}
                  </div>
                )}
              </div>
            </div>

            <div className="cb-modal-footer">
              <button className="cb-btn-secondary" onClick={() => setIsDetailOpen(false)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODALE : CRÉATION NOUVEAU BIEN ══════════ */}
      {isCreateOpen && (
        <div className="cb-modal-overlay" onClick={() => setIsCreateOpen(false)}>
          <div className="cb-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cb-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="#0d9488" />
                <h3>Ajouter un Nouveau Logement</h3>
              </div>
              <button className="cb-modal-close" onClick={() => setIsCreateOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBien}>
              <div className="cb-modal-body">
                {/* Choix du Client */}
                <div className="cb-form-group">
                  <label className="cb-form-label">Client / Conciergerie Propriétaire <span className="req">*</span></label>
                  <select
                    required
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(Number(e.target.value))}
                    className="cb-form-select"
                  >
                    <option value="">Sélectionner un client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.segment === 'entreprise' && c.entity_name 
                          ? `${c.entity_name} (${c.first_name} ${c.last_name})` 
                          : `${c.first_name} ${c.last_name} (${c.phone})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Code généré automatiquement */}
                {generatedCode && (
                  <div style={{ padding: '0.75rem 1rem', background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: '#0f766e', fontWeight: 600 }}>Code Logement Généré :</span>
                    <span className="cb-code-badge" style={{ fontSize: '0.9rem' }}>{generatedCode}</span>
                  </div>
                )}

                {/* Nom & Typologie */}
                <div className="cb-form-grid-2">
                  <div className="cb-form-group">
                    <label className="cb-form-label">Nom du Logement / Repère</label>
                    <input
                      type="text"
                      placeholder="Ex: Marina Bay Luxury"
                      value={nomBien}
                      onChange={(e) => setNomBien(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Typologie <span className="req">*</span></label>
                    <select
                      value={typologie}
                      onChange={(e: any) => setTypologie(e.target.value)}
                      className="cb-form-select"
                    >
                      <option value="studio">Studio / 1 Chambre</option>
                      <option value="2ch">2 Chambres</option>
                      <option value="3ch">3 Chambres</option>
                      <option value="4ch">4 Chambres</option>
                      <option value="5ch">5 Chambres</option>
                      <option value="villa_riad">Villa / Riad (2 intervenantes)</option>
                    </select>
                  </div>
                </div>

                {/* Adresse & Quartier */}
                <div className="cb-form-grid-3">
                  <div className="cb-form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="cb-form-label">Adresse Complète <span className="req">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 14 Bd d'Anfa, Imm. B, Apt 12"
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Quartier <span className="req">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Gauthier"
                      value={quartier}
                      onChange={(e) => setQuartier(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>
                </div>

                {/* Zone Éloignée Checkbox */}
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="cb_zone_eloignee"
                    checked={zoneEloignee}
                    onChange={(e) => setZoneEloignee(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#00473E' }}
                  />
                  <label htmlFor="cb_zone_eloignee" style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                    Logement en Zone Éloignée (Dar Bouazza, Bouskoura, Tamaris, etc. — Supplément +50 DH)
                  </label>
                </div>

                {/* Accès & Digicodes */}
                <div className="cb-form-grid-2">
                  <div className="cb-form-group">
                    <label className="cb-form-label">Type d'accès</label>
                    <select
                      value={accesSecurise}
                      onChange={(e) => setAccesSecurise(e.target.value)}
                      className="cb-form-select"
                    >
                      <option value="boite_cle">Boîte à clés (Lockbox)</option>
                      <option value="serrure_connectee">Serrure Connectée</option>
                      <option value="gardien">Remise par Gardien</option>
                      <option value="physique">Présence Propriétaire</option>
                    </select>
                  </div>

                  <div className="cb-form-group">
                    <label className="cb-form-label">Consignes / Code Boîte</label>
                    <input
                      type="text"
                      placeholder="Ex: Code 4821 - Boîte noire sous l'escalier"
                      value={consignesSecurite}
                      onChange={(e) => setConsignesSecurite(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>
                </div>

                {/* URL iCal */}
                <div className="cb-form-group">
                  <label className="cb-form-label">Lien Calendrier iCal (Airbnb / Booking / Guesty)</label>
                  <input
                    type="url"
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    value={icalUrl}
                    onChange={(e) => setIcalUrl(e.target.value)}
                    className="cb-form-input"
                  />
                </div>
              </div>

              <div className="cb-modal-footer">
                <button
                  type="button"
                  className="cb-btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !selectedClientId}
                  className="cb-btn-primary"
                >
                  {createLoading ? 'Création en cours...' : 'Enregistrer le Logement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
