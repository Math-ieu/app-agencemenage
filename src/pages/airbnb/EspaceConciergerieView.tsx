import { useState, useEffect, type FormEvent } from 'react';
import { 
  getBiens, getCommandesAirbnb, syncBienIcal, createCommandeAirbnb, extractResults 
} from '../../api/airbnb';
import { getClients } from '../../api/client';
import type { Bien, CommandeAirbnb } from '../../types/airbnb';
import { 
  RefreshCw, CheckCircle2, User, Building, Calendar, PlusCircle, CreditCard, Clock
} from 'lucide-react';
import './EspaceConciergerie.css';

export default function EspaceConciergerieView() {
  const [activeTab, setActiveTab] = useState<'accueil' | 'cal' | 'cmd' | 'compte'>('accueil');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [biens, setBiens] = useState<Bien[]>([]);
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);

  // iCal Sync State
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Quick Order State inside Portal
  const [orderBienId, setOrderBienId] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [orderHeure, setOrderHeure] = useState<string>('11:00');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const fetchClientPortalData = async () => {
    try {
      const clientsRes = await getClients();
      const cls = extractResults<any>(clientsRes.data);
      setClients(cls);
      if (cls.length > 0 && !selectedClientId) {
        setSelectedClientId(cls[0].id);
      }
    } catch (err) {
      console.error("Erreur chargement clients conciergerie :", err);
    }
  };

  useEffect(() => {
    fetchClientPortalData();
  }, []);

  // Fetch client specific biens & commandes when selectedClientId changes
  useEffect(() => {
    if (!selectedClientId) return;
    Promise.all([
      getBiens({ client: selectedClientId }),
      getCommandesAirbnb({ client: selectedClientId })
    ])
      .then(([biensRes, cmdRes]) => {
        const bList = extractResults<Bien>(biensRes.data);
        const cList = extractResults<CommandeAirbnb>(cmdRes.data);
        setBiens(bList);
        setCommandes(cList);
        if (bList.length > 0 && !orderBienId) {
          setOrderBienId(bList[0].id);
        }
      })
      .catch((err) => console.error("Erreur chargement données client :", err));
  }, [selectedClientId]);

  const handleSyncIcal = async (bienId: string) => {
    setSyncingId(bienId);
    setSyncMessage(null);
    try {
      const res = await syncBienIcal(bienId);
      if (res.data.success) {
        setSyncMessage(`Synchronisation réussie : ${res.data.created_turnovers || 0} turnovers créés automatiquement.`);
      } else {
        setSyncMessage(`Résultat : ${res.data.error || 'Aucun événement'}`);
      }
      // Refresh
      const [biensRes, cmdRes] = await Promise.all([
        getBiens({ client: selectedClientId }),
        getCommandesAirbnb({ client: selectedClientId })
      ]);
      const bList = extractResults<Bien>(biensRes.data);
      const cList = extractResults<CommandeAirbnb>(cmdRes.data);
      setBiens(bList);
      setCommandes(cList);
    } catch (err: any) {
      setSyncMessage(`Erreur de connexion au calendrier : ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleQuickOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!orderBienId || !orderDate) return;

    setSubmittingOrder(true);
    try {
      await createCommandeAirbnb({
        bien: orderBienId,
        date_prestation: orderDate,
        heure_prestation: orderHeure,
        creneau: parseInt(orderHeure.split(':')[0], 10) < 12 ? 'matin' : 'apres_midi',
        nature_linge: 'depot_ramassage',
        options: [],
        remise_en_etat: 0,
      });
      alert("Votre demande de turnover a été transmise à l'équipe opérationnelle.");
      setActiveTab('accueil');
      // Refresh
      const cmdRes = await getCommandesAirbnb({ client: selectedClientId });
      setCommandes(extractResults<CommandeAirbnb>(cmdRes.data));
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la commande");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const currentClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="ec-container">
      {/* Client Switcher Selector Header Card */}
      <div className="ec-client-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div className="ec-client-avatar">
            {currentClient ? (currentClient.first_name?.[0] || 'C') : <User size={20} />}
          </div>
          <div>
            <div style={{ fontSize: '0.725rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0d9488' }}>
              Espace Client Actif
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {currentClient?.segment === 'entreprise' && currentClient?.entity_name 
                ? currentClient.entity_name 
                : `${currentClient?.first_name || ''} ${currentClient?.last_name || ''}`}
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Simuler Client :</span>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(Number(e.target.value))}
            style={{ padding: '0.45rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700, background: '#ffffff', color: '#0f172a' }}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.segment === 'entreprise' && c.entity_name ? `${c.entity_name} (${c.phone})` : `${c.first_name} ${c.last_name}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Subtabs Segmented Control */}
      <div className="ec-subtabs">
        <button
          onClick={() => setActiveTab('accueil')}
          className={`ec-tab-btn ${activeTab === 'accueil' ? 'active' : ''}`}
        >
          <Building size={16} />
          <span>Accueil & Synthèse</span>
        </button>

        <button
          onClick={() => setActiveTab('cal')}
          className={`ec-tab-btn ${activeTab === 'cal' ? 'active' : ''}`}
        >
          <Calendar size={16} />
          <span>Mes Logements & iCal ({biens.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cmd')}
          className={`ec-tab-btn ${activeTab === 'cmd' ? 'active' : ''}`}
        >
          <PlusCircle size={16} />
          <span>Commander un Turnover</span>
        </button>

        <button
          onClick={() => setActiveTab('compte')}
          className={`ec-tab-btn ${activeTab === 'compte' ? 'active' : ''}`}
        >
          <CreditCard size={16} />
          <span>Mon Compte & Factures</span>
        </button>
      </div>

      {activeTab === 'accueil' && (
        /* ══════════ ACCUEIL & SYNTHESE ══════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 4 KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #00473E' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Logements Actifs</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#00473E', marginTop: '4px' }}>{biens.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Casablanca & Régions</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Turnovers à Venir</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {commandes.filter(c => c.statut !== 'cloturee').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Planifiés et assignés</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Réalisés ce Mois</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                {commandes.filter(c => c.statut === 'cloturee').length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Avec 4 photos conformes</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Mode de Facturation</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb', marginTop: '8px' }}>
                Fin de Mois
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Exigibilité consolidée</div>
            </div>
          </div>

          {/* Table Prochains Turnovers */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
              Prochaines Prestations Planifiées
            </div>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Numéro</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Date & Heure</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Logement</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Chaîne Linge</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {commandes.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      Aucun turnover planifié pour ce compte.
                    </td>
                  </tr>
                ) : (
                  commandes.slice(0, 5).map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f766e', background: '#f0fdfa', padding: '0.2rem 0.5rem', borderRadius: '0.375rem' }}>
                          {c.numero}
                        </span>
                      </td>
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <b>{c.date_prestation}</b> à {c.heure_prestation.slice(0, 5)}
                      </td>
                      <td style={{ padding: '0.95rem 1rem' }}><b>{c.bien_code}</b> — {c.bien_nom}</td>
                      <td style={{ padding: '0.95rem 1rem' }}>{c.nature_linge.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, background: '#f0fdf4', color: '#15803d' }}>
                          {c.statut.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'cal' && (
        /* ══════════ MES LOGEMENTS & ICAL ══════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {syncMessage && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', color: '#166534', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} />
              <span>{syncMessage}</span>
            </div>
          )}

          <div className="ec-property-grid">
            {biens.map((b) => (
              <div key={b.id} className="ec-property-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#00473E', background: '#f0fdfa', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #ccfbf1', fontSize: '0.8rem' }}>
                    {b.code}
                  </span>
                  <span style={{ padding: '0.2rem 0.5rem', background: '#e0f2fe', color: '#0369a1', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {b.typologie.toUpperCase()}
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{b.nom_bien || b.quartier}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{b.adresse} ({b.quartier}, {b.ville})</div>
                </div>

                <div style={{ padding: '0.875rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Flux iCal Synchronisé</span>
                    <button
                      onClick={() => handleSyncIcal(b.id)}
                      disabled={syncingId === b.id || !b.ical_url}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0.25rem 0.6rem', background: '#00473E', color: '#ffffff', border: 'none', borderRadius: '0.375rem', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <RefreshCw size={11} className={syncingId === b.id ? 'animate-spin' : ''} />
                      {syncingId === b.id ? 'Synchro...' : 'Synchroniser'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.ical_url || "Aucun lien iCal configuré"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'cmd' && (
        /* ══════════ COMMANDER UN TURNOVER ══════════ */
        <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
              Nouvelle Demande de Turnover
            </h3>
            <form onSubmit={handleQuickOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Sélectionner le Logement *
                </label>
                <select
                  value={orderBienId}
                  onChange={(e) => setOrderBienId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {biens.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.nom_bien || b.quartier} ({b.typologie.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Date d'Intervention *
                  </label>
                  <input
                    type="date"
                    required
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Heure Souhaitée
                  </label>
                  <input
                    type="time"
                    value={orderHeure}
                    onChange={(e) => setOrderHeure(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.5rem', padding: '0.875rem', color: '#0f766e', fontSize: '0.8rem' }}>
                <Clock size={16} style={{ display: 'inline', marginRight: '4px' }} />
                <b>Rappels Cut-off :</b> Saisie avant 21h00 la veille pour prestation du matin (avant 12h) / 22h00 pour l'après-midi.
              </div>

              <button
                type="submit"
                disabled={submittingOrder || !orderBienId}
                style={{ padding: '0.75rem', background: '#00473E', color: '#ffffff', borderRadius: '0.5rem', fontWeight: 800, fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
              >
                {submittingOrder ? 'Transmission...' : 'Confirmer la Demande de Turnover'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'compte' && (
        /* ══════════ MON COMPTE & FACTURES ══════════ */
        <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1rem 0' }}>
              Situation Financière & Règlements
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.875rem 1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Mode de Facturation Actuel :</span>
                <span style={{ fontWeight: 800, color: '#00473E', fontSize: '0.85rem' }}>Fin de Mois Consolidé</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.875rem 1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Statut du Compte :</span>
                <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '0.85rem' }}>✓ En règle (Aucun impayé)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.875rem 1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Total Clôturé ce Mois :</span>
                <span style={{ fontWeight: 900, color: '#0f172a', fontSize: '1rem' }}>
                  {commandes.reduce((acc, c) => acc + (Number(c.total_ttc) || 0), 0)} DH TTC
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
