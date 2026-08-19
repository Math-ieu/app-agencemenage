import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getFiletsLinge, figerMontantLinge, extractResults 
} from '../../api/airbnb';
import type { FiletLinge } from '../../types/airbnb';
import { 
  Shirt, RotateCw, 
  Truck, ShieldCheck, Printer, ExternalLink
} from 'lucide-react';
import './RunnerLaverie.css';

export default function RunnerLaverieView() {
  const navigate = useNavigate();
  // 3 Subtabs: 'supervision' | 'laverie' | 'cycle'
  const [activeSubtab, setActiveSubtab] = useState<'supervision' | 'laverie' | 'cycle'>('supervision');

  // Filets Data
  const [filets, setFilets] = useState<FiletLinge[]>([]);

  // Steppers for counting (Laverie)
  const [counts] = useState<{ [key: string]: number }>({
    housses: 1,
    draps: 1,
    taies: 2,
    serviettes_gdes: 2,
    serviettes_ptes: 2,
    pieces_supp: 8,
  });

  const fetchData = async () => {
    try {
      const filRes = await getFiletsLinge().catch(() => ({ data: [] }));
      setFilets(extractResults<FiletLinge>(filRes.data));
    } catch (err) {
      console.error("Erreur chargement données linge :", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFigerMontant = async (filetId: string) => {
    try {
      await figerMontantLinge(filetId, {
        comptage_laverie: counts,
      });
      alert("✓ Montant du filet figé avec succès.");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors du figeage du montant");
    }
  };

  return (
    <div className="rl-container">
      {/* Subtabs Segmented Bar */}
      <div className="rl-subtabs">
        <button
          className={`rl-tab-btn ${activeSubtab === 'supervision' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('supervision')}
        >
          <Truck size={16} />
          <span>Supervision des Tournées Runner</span>
        </button>

        <button
          className={`rl-tab-btn ${activeSubtab === 'laverie' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('laverie')}
        >
          <ShieldCheck size={16} />
          <span>Responsable Linge (Espace Linge)</span>
        </button>

        <button
          className={`rl-tab-btn ${activeSubtab === 'cycle' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('cycle')}
        >
          <Shirt size={16} />
          <span>Cycle du Linge (Kanban 5 Étapes)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 1 : SUPERVISION DES TOURNÉES RUNNER (Admin / Back-Office)     */}
      {/* ========================================================================= */}
      {activeSubtab === 'supervision' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Action Banner */}
          <div className="cb-banner-header">
            <div>
              <h2 className="cb-banner-title-text">
                Supervision des Tournées & Chauffeurs-Livreurs
              </h2>
              <p className="cb-banner-subtitle-text">
                Suivi en temps réel des livraisons de linge propre et ramassages des sacs sales.
              </p>
            </div>

            <button
              onClick={() => navigate('/runner')}
              className="cb-btn-primary"
              style={{ background: '#ffffff', color: '#00473E', fontWeight: 800 }}
            >
              <ExternalLink size={16} />
              <span>Ouvrir l'App Mobile Runner (/runner)</span>
            </button>
          </div>

          {/* 4 KPIs Supervision */}
          <div className="cb-kpi-grid">
            <div className="cb-kpi-card gold">
              <div className="cb-kpi-label">Runners Mobilisés</div>
              <div className="cb-kpi-value">2</div>
              <div className="cb-kpi-sub">Youssef (Centre) · Karim (Anfa)</div>
            </div>

            <div className="cb-kpi-card">
              <div className="cb-kpi-label">Arrêts du Jour</div>
              <div className="cb-kpi-value">9</div>
              <div className="cb-kpi-sub">5 dépôts · 6 ramassages</div>
            </div>

            <div className="cb-kpi-card blue">
              <div className="cb-kpi-label">Arrêts Complétés</div>
              <div className="cb-kpi-value">4 / 9</div>
              <div className="cb-kpi-sub">Photos et décomptes reçus</div>
            </div>

            <div className="cb-kpi-card purple">
              <div className="cb-kpi-label">Délai Moyen / Arrêt</div>
              <div className="cb-kpi-value">18 min</div>
              <div className="cb-kpi-sub">Ponctualité conforme 100%</div>
            </div>
          </div>

          {/* Tableau des Tournées en Direct */}
          <div className="cb-table-card">
            <table className="cb-table">
              <thead>
                <tr>
                  <th>Runner</th>
                  <th>Secteur / Quartiers</th>
                  <th>Arrêts</th>
                  <th>Progression</th>
                  <th>Dernier Arrêt Validé</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Youssef EL AMRANI</strong></td>
                  <td>Gauthier · Racine · Bourgogne</td>
                  <td>5 arrêts</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, background: '#e2e8f0', height: '8px', borderRadius: '4px', overflow: 'hidden', minWidth: '80px' }}>
                        <div style={{ width: '60%', background: '#00473E', height: '100%' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>3 / 5</span>
                    </div>
                  </td>
                  <td><span className="cb-code-badge">GBE002</span> (11:15)</td>
                  <td><span className="cb-status-pill conciergerie">En tournée</span></td>
                  <td>
                    <button onClick={() => navigate('/runner')} className="cb-btn-details">
                      Voir tournée
                    </button>
                  </td>
                </tr>
                <tr>
                  <td><strong>Karim BENKIRANE</strong></td>
                  <td>Anfa · Ain Diab · Maarif</td>
                  <td>4 arrêts</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, background: '#e2e8f0', height: '8px', borderRadius: '4px', overflow: 'hidden', minWidth: '80px' }}>
                        <div style={{ width: '25%', background: '#00473E', height: '100%' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>1 / 4</span>
                    </div>
                  </td>
                  <td><span className="cb-code-badge">HBE001</span> (10:40)</td>
                  <td><span className="cb-status-pill conciergerie">En tournée</span></td>
                  <td>
                    <button onClick={() => navigate('/runner')} className="cb-btn-details">
                      Voir tournée
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 2 : RESPONSABLE LINGE (ESPACE LINGE TABLETTE) (Page 12)        */}
      {/* ========================================================================= */}
      {activeSubtab === 'laverie' && (
        <div className="cb-detail-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
                Espace Linge & Réception Laverie — Amina
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Contrôle contradictoire des arrivées et gestion des cycles de lavage
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => navigate('/laverie')} className="cb-btn-primary">
                <ExternalLink size={16} />
                <span>Ouvrir l'Espace Laverie Plein Écran</span>
              </button>
              <button className="cb-btn-secondary" onClick={() => window.print()}>
                <Printer size={16} />
                <span>Imprimer Feuille de Route</span>
              </button>
            </div>
          </div>

          {/* Tableau Filets à Contrôler */}
          <div className="cb-table-card">
            <table className="cb-table">
              <thead>
                <tr>
                  <th>Code Filet</th>
                  <th>Bien Rattaché</th>
                  <th>Annoncé Runner</th>
                  <th>Recompté Laverie</th>
                  <th>Écart</th>
                  <th>Montant</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filets.length === 0 ? (
                  <tr>
                    <td><span className="cb-code-badge">SAC-GBE001-01</span></td>
                    <td>GBE001 (2 chambres Gauthier)</td>
                    <td>16 pièces</td>
                    <td>16 pièces</td>
                    <td><span style={{ color: '#15803d', fontWeight: 700 }}>0 (Conforme)</span></td>
                    <td><strong style={{ color: '#00473E' }}>90 DH</strong></td>
                    <td>
                      <button 
                        onClick={() => handleFigerMontant('dummy-id')}
                        className="cb-btn-details"
                      >
                        Figer Montant
                      </button>
                    </td>
                  </tr>
                ) : (
                  filets.map(f => (
                    <tr key={f.id}>
                      <td><span className="cb-code-badge">{f.code_filet || 'SAC-001'}</span></td>
                      <td>{f.bien_code || 'Bien'}</td>
                      <td>{f.total_pieces || 16} pcs</td>
                      <td>{f.total_pieces || 16} pcs</td>
                      <td><span style={{ color: '#15803d', fontWeight: 700 }}>0</span></td>
                      <td><strong>{f.montant || 90} DH</strong></td>
                      <td>
                        <button 
                          onClick={() => handleFigerMontant(f.id)}
                          className="cb-btn-details"
                        >
                          Figer Montant
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 3 : CYCLE DU LINGE KANBAN 5 ÉTAPES (Page 06)                   */}
      {/* ========================================================================= */}
      {activeSubtab === 'cycle' && (
        <>
          {/* Alerte Tournée de Demain */}
          <div className="rl-banner-gold">
            <RotateCw size={20} color="#d97706" />
            <div>
              <span style={{ fontWeight: 800, color: '#78350f', display: 'block' }}>
                4 Filets Attendus pour la Tournée de Demain 09h00
              </span>
              Les filets GBE001, GBE002, GBE003 et HBE001 doivent être passés au statut « Prêt au départ » avant ce soir 19h00.
            </div>
          </div>

          {/* Kanban 5 Colonnes */}
          <div className="rl-kanban-grid">
            <div className="rl-kanban-col">
              <div className="rl-kanban-col-head">
                <span>1. Reçu & Compté</span>
                <span className="rl-kanban-badge">2</span>
              </div>
              <div className="rl-kanban-col-body">
                <div className="rl-kanban-card">
                  <div className="rl-kanban-card-code">SAC-GBE004-01</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Studio Bourgogne · 8 pcs</div>
                  <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700 }}>Recompté 50 DH</div>
                </div>
                <div className="rl-kanban-card">
                  <div className="rl-kanban-card-code">SAC-HBE002-01</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Villa Anfa · 24 pcs</div>
                  <div style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 700 }}>Recompté 150 DH</div>
                </div>
              </div>
            </div>

            <div className="rl-kanban-col">
              <div className="rl-kanban-col-head">
                <span>2. En Lavage</span>
                <span className="rl-kanban-badge">3</span>
              </div>
              <div className="rl-kanban-col-body">
                <div className="rl-kanban-card">
                  <div className="rl-kanban-card-code">SAC-GBE001-02</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>2ch Gauthier · Cycle 60°C</div>
                </div>
              </div>
            </div>

            <div className="rl-kanban-col">
              <div className="rl-kanban-col-head">
                <span>3. Séchage & Rep.</span>
                <span className="rl-kanban-badge">1</span>
              </div>
              <div className="rl-kanban-col-body">
                <div className="rl-kanban-card">
                  <div className="rl-kanban-card-code">SAC-GBE002-01</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Studio Racine · Repassage</div>
                </div>
              </div>
            </div>

            <div className="rl-kanban-col">
              <div className="rl-kanban-col-head">
                <span>4. Prêt au départ</span>
                <span className="rl-kanban-badge">4</span>
              </div>
              <div className="rl-kanban-col-body">
                <div className="rl-kanban-card" style={{ borderLeft: '4px solid #10b981' }}>
                  <div className="rl-kanban-card-code">SAC-GBE001-01</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Scellé sous film · 16 pcs</div>
                </div>
              </div>
            </div>

            <div className="rl-kanban-col">
              <div className="rl-kanban-col-head">
                <span>5. En Livraison</span>
                <span className="rl-kanban-badge">2</span>
              </div>
              <div className="rl-kanban-col-body">
                <div className="rl-kanban-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                  <div className="rl-kanban-card-code">SAC-GBE003-01</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Dans le van de Youssef</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
