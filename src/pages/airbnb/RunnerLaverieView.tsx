import { useState, useEffect, type FormEvent } from 'react';
import { 
  getFiletsLinge, getTourneeRunner, figerMontantLinge, arbitrerEcartLinge, extractResults 
} from '../../api/airbnb';
import type { FiletLinge, CommandeAirbnb } from '../../types/airbnb';
import { 
  Shirt, Truck, AlertTriangle, RotateCw, 
  X, AlertCircle
} from 'lucide-react';
import './RunnerLaverie.css';

export default function RunnerLaverieView() {
  const [activeTab, setActiveTab] = useState<'laverie' | 'runner'>('laverie');
  
  // Laverie State
  const [filets, setFilets] = useState<FiletLinge[]>([]);
  const [loadingFilets, setLoadingFilets] = useState(true);
  const [selectedFiletForEdit, setSelectedFiletForEdit] = useState<FiletLinge | null>(null);
  const [laverieCounts, setLaverieCounts] = useState<{ [key: string]: number }>({
    housses: 2,
    draps: 2,
    taies: 4,
    serviettes: 4,
    tapis: 1,
    torchons: 2,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Arbitrage Modal State
  const [isArbitrageOpen, setIsArbitrageOpen] = useState(false);
  const [arbitrageFilet, setArbitrageFilet] = useState<FiletLinge | null>(null);
  const [arbitrageComment, setArbitrageComment] = useState('');

  // Runner Tournee State
  const [tourneeMissions, setTourneeMissions] = useState<CommandeAirbnb[]>([]);
  const [tourneeDate, setTourneeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loadingRunner, setLoadingRunner] = useState(true);


  const fetchLaverieData = async () => {
    setLoadingFilets(true);
    try {
      const res = await getFiletsLinge();
      setFilets(extractResults<FiletLinge>(res.data));
    } catch (err) {
      console.error("Erreur chargement filets linge :", err);
    } finally {
      setLoadingFilets(false);
    }
  };

  const fetchRunnerData = async () => {
    setLoadingRunner(true);
    try {
      const res = await getTourneeRunner({ date: tourneeDate });
      const list = res.data?.missions_runner || extractResults<CommandeAirbnb>(res.data);
      setTourneeMissions(list);
    } catch (err) {
      console.error("Erreur chargement tournée runner :", err);
    } finally {
      setLoadingRunner(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'laverie') {
      fetchLaverieData();
    } else {
      fetchRunnerData();
    }
  }, [activeTab, tourneeDate]);

  // Total pieces calculation
  const totalLaveriePieces = Object.values(laverieCounts).reduce((a, b) => a + (Number(b) || 0), 0);

  // Figer le montant en laverie
  const handleFigerMontant = async (filetId: string) => {
    if (!window.confirm("Êtes-vous sûr de figer le décompte et le montant de ce sac de linge ? Ce montant sera directement rattaché à la commande N-1.")) {
      return;
    }

    setActionLoading(true);
    try {
      await figerMontantLinge(filetId, {
        comptage_laverie: laverieCounts,
      });
      setSelectedFiletForEdit(null);
      fetchLaverieData();
      alert("Montant du linge figé avec succès et répercuté sur la commande.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors du figeage du montant");
    } finally {
      setActionLoading(false);
    }
  };

  // Arbitrage de l'écart
  const handleArbitrer = async (e: FormEvent) => {
    e.preventDefault();
    if (!arbitrageFilet) return;

    setActionLoading(true);
    try {
      await arbitrerEcartLinge(arbitrageFilet.id, {
        commentaire: arbitrageComment || 'Arbitrage validé par le responsable opérationnel.',
      });
      setIsArbitrageOpen(false);
      setArbitrageFilet(null);
      setArbitrageComment('');
      fetchLaverieData();
      alert("Écart arbitré et clôturé avec succès.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'arbitrage");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="rl-container">
      {/* Subtabs Strip */}
      <div className="rl-subtabs">
        <button
          onClick={() => setActiveTab('laverie')}
          className={`rl-tab-btn ${activeTab === 'laverie' ? 'active' : ''}`}
        >
          <Shirt size={16} />
          <span>Espace Blanchisserie & Laverie ({filets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('runner')}
          className={`rl-tab-btn ${activeTab === 'runner' ? 'active' : ''}`}
        >
          <Truck size={16} />
          <span>Tournée Mobile Runner & Logements</span>
        </button>
      </div>

      {activeTab === 'laverie' ? (
        /* ══════════ ESPACE LAVERIE ══════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Banner Barème Linge */}
          <div className="rl-banner-gold">
            <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontWeight: 800, color: '#78350f', display: 'block', marginBottom: '2px' }}>
                Règle Métier Blanchisserie — 8 pièces standard = 50 DH TTC
              </span>
              Tout sac reçu en laverie fait l'objet d'un comptage contradictoire. Au-delà de 8 pièces (50 DH forfait minimum), chaque pièce supplémentaire est facturée 5 DH (ou 50 DH par tranche complète de 8 pièces).
            </div>
          </div>

          {/* Table des Filets de Linge */}
          <div className="rl-table-card">
            <table className="rl-table">
              <thead>
                <tr>
                  <th>Code Filet / Sac</th>
                  <th>Logement & Client</th>
                  <th>Comptage Runner</th>
                  <th>Comptage Laverie</th>
                  <th>Écart (Pièces)</th>
                  <th>Montant Figé</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingFilets ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                      Chargement des réceptions laverie...
                    </td>
                  </tr>
                ) : filets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      <Shirt size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                      Aucun filet de linge en attente de traitement actuellement.
                    </td>
                  </tr>
                ) : (
                  filets.map((f) => {
                    const runnerTotal = f.comptage_runner ? Object.values(f.comptage_runner).reduce((a, b) => a + Number(b), 0) : 0;
                    const laverieTotal = f.comptage_laverie ? Object.values(f.comptage_laverie).reduce((a, b) => a + Number(b), 0) : 0;
                    return (
                      <tr key={f.id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f766e', background: '#f0fdfa', padding: '0.25rem 0.55rem', borderRadius: '0.375rem', border: '1px solid #ccfbf1' }}>
                            {f.code_filet}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{f.bien_code}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{f.client_name}</div>
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {runnerTotal ? `${runnerTotal} pcs` : 'Non compté'}
                        </td>
                        <td style={{ fontWeight: 700, color: '#00473E' }}>
                          {laverieTotal ? `${laverieTotal} pcs` : 'En attente'}
                        </td>
                        <td>
                          {f.ecart !== 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0.2rem 0.5rem', background: '#fef2f2', color: '#dc2626', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 800 }}>
                              <AlertCircle size={12} />
                              Écart ({f.ecart} pcs)
                            </span>
                          ) : (
                            <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.8rem' }}>✓ Conforme</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 800, color: f.montant ? '#00473E' : '#94a3b8' }}>
                          {f.montant ? `${f.montant} DH` : '—'}
                        </td>
                        <td>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, background: f.statut === 'pret' ? '#f0fdf4' : '#f1f5f9', color: f.statut === 'pret' ? '#15803d' : '#475569' }}>
                            {f.statut.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              style={{ padding: '0.35rem 0.75rem', background: '#00473E', color: '#ffffff', border: 'none', borderRadius: '0.45rem', fontSize: '0.785rem', fontWeight: 700, cursor: 'pointer' }}
                              onClick={() => {
                                setSelectedFiletForEdit(f);
                                if (f.comptage_laverie) setLaverieCounts(f.comptage_laverie);
                              }}
                            >
                              Décompte
                            </button>
                            {f.ecart !== 0 && (
                              <button
                                style={{ padding: '0.35rem 0.75rem', background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '0.45rem', fontSize: '0.785rem', fontWeight: 700, cursor: 'pointer' }}
                                onClick={() => {
                                  setArbitrageFilet(f);
                                  setIsArbitrageOpen(true);
                                }}
                              >
                                Arbitrer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ══════════ TOURNÉE RUNNER MOBILE ══════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Date Picker Strip */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Date de la Tournée :</span>
              <input
                type="date"
                value={tourneeDate}
                onChange={(e) => setTourneeDate(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700 }}
              />
            </div>
            <div style={{ fontSize: '0.825rem', color: '#64748b', fontWeight: 600 }}>
              {tourneeMissions.length} arrêt(s) et collecte(s) programmés
            </div>
          </div>

          {/* Cards Grid of Runner Tournée */}
          <div className="rl-runner-grid">
            {loadingRunner ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                Chargement de la tournée runner...
              </div>
            ) : tourneeMissions.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: '#64748b', background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                <Truck size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                Aucune mission runner planifiée à cette date.
              </div>
            ) : (
              tourneeMissions.map((m) => (
                <div key={m.id} className="rl-mission-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#00473E', background: '#f0fdfa', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #ccfbf1', fontSize: '0.75rem' }}>
                        {m.numero}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                        {m.heure_prestation.slice(0, 5)}
                      </span>
                    </div>

                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                      {m.bien_nom} ({m.bien_code})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                      {m.client_name}
                    </div>

                    <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                      <div style={{ color: '#00473E', fontWeight: 700, marginBottom: '2px' }}>
                        {m.nature_linge.replace(/_/g, ' ')}
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.75rem' }}>
                        Runner : <b>{m.runner_name || 'Non assigné'}</b>
                      </div>
                    </div>
                  </div>

                  <button
                    style={{ width: '100%', padding: '0.6rem', background: '#00473E', color: '#ffffff', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.825rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    onClick={() => {
                      alert(`Décompte de collecte ouvert pour le logement ${m.bien_nom}`);
                    }}
                  >
                    <Shirt size={15} />
                    Saisir Décompte Collecte
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ══════════ MODALE : DÉCOMPTE CONTRADICTOIRE LAVERIE ══════════ */}
      {selectedFiletForEdit && (
        <div className="cb-modal-overlay" onClick={() => setSelectedFiletForEdit(null)}>
          <div className="cb-modal-box" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cb-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shirt size={18} color="#00473E" />
                <h3>Décompte Blanchisserie — {selectedFiletForEdit.code_filet}</h3>
              </div>
              <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setSelectedFiletForEdit(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="cb-modal-body">
              <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.5rem', padding: '0.875rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0f766e', display: 'block' }}>Total Décompté</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#00473E' }}>{totalLaveriePieces} Pièces</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#0f766e', display: 'block' }}>Montant Calculé</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#00473E' }}>
                    {totalLaveriePieces <= 8 ? 50 : 50 + (totalLaveriePieces - 8) * 5} DH TTC
                  </span>
                </div>
              </div>

              {/* 6-Item Stepper Grid */}
              <div className="rl-stepper-grid">
                {[
                  { key: 'housses', label: 'Housses de Couette' },
                  { key: 'draps', label: 'Draps Plats / Housses' },
                  { key: 'taies', label: 'Taies d\'oreillers' },
                  { key: 'serviettes', label: 'Serviettes & Draps de bain' },
                  { key: 'tapis', label: 'Tapis de bain' },
                  { key: 'torchons', label: 'Torchons de cuisine' },
                ].map(({ key, label }) => (
                  <div key={key} className="rl-stepper-item">
                    <span className="rl-stepper-label">{label}</span>
                    <div className="rl-stepper-controls">
                      <button
                        type="button"
                        className="rl-stepper-btn"
                        onClick={() => setLaverieCounts({ ...laverieCounts, [key]: Math.max(0, (laverieCounts[key] || 0) - 1) })}
                      >
                        -
                      </button>
                      <span className="rl-stepper-val">{laverieCounts[key] || 0}</span>
                      <button
                        type="button"
                        className="rl-stepper-btn"
                        onClick={() => setLaverieCounts({ ...laverieCounts, [key]: (laverieCounts[key] || 0) + 1 })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="cb-modal-footer">
              <button
                type="button"
                className="cb-btn-secondary"
                onClick={() => setSelectedFiletForEdit(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={actionLoading}
                className="cb-btn-primary"
                onClick={() => handleFigerMontant(selectedFiletForEdit.id)}
              >
                {actionLoading ? 'Validation...' : 'Figer le Décompte & Montant (Commande N-1)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODALE : ARBITRAGE D'ÉCART ══════════ */}
      {isArbitrageOpen && arbitrageFilet && (
        <div className="cb-modal-overlay" onClick={() => setIsArbitrageOpen(false)}>
          <div className="cb-modal-box" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cb-modal-header">
              <h3>Arbitrage d'Écart de Linge</h3>
              <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setIsArbitrageOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleArbitrer}>
              <div className="cb-modal-body">
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.875rem', color: '#991b1b', fontSize: '0.825rem', marginBottom: '1rem' }}>
                  <b>Écart détecté sur le sac {arbitrageFilet.code_filet} :</b><br />
                  Écart constaté : {arbitrageFilet.ecart} pièces
                </div>

                <div className="cb-form-group">
                  <label className="cb-form-label">Commentaire & Justification de l'Arbitrage</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Ex: Pièce manquante identifiée comme torchon usé, décision de validation laverie."
                    value={arbitrageComment}
                    onChange={(e) => setArbitrageComment(e.target.value)}
                    className="cb-form-textarea"
                  />
                </div>
              </div>

              <div className="cb-modal-footer">
                <button type="button" className="cb-btn-secondary" onClick={() => setIsArbitrageOpen(false)}>
                  Annuler
                </button>
                <button type="submit" disabled={actionLoading} className="cb-btn-primary" style={{ background: '#dc2626' }}>
                  {actionLoading ? 'Validation...' : 'Valider la Décision d\'Arbitrage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
