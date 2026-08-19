import { useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { 
  Shirt, ShieldCheck, Printer, LogOut, AlertTriangle
} from 'lucide-react';
import './EspaceLingeApp.css';

export default function EspaceLingeApp() {
  const { user, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'reception' | 'arbitrage' | 'cycle'>('reception');

  const [filets, setFilets] = useState([
    { id: '1', code: 'SAC-GBE001-01', bien: 'GBE001 (2ch Gauthier)', runner: 'Youssef', annonce: 16, compte: 16, montant: 90, status: 'fige' },
    { id: '2', code: 'SAC-GBE002-01', bien: 'GBE002 (Studio Racine)', runner: 'Youssef', annonce: 8, compte: 8, montant: 50, status: 'en_attente' },
    { id: '3', code: 'SAC-GBE003-01', bien: 'GBE003 (3ch Racine)', runner: 'Youssef', annonce: 16, compte: 16, montant: 90, status: 'en_attente' },
    { id: '4', code: 'SAC-HBE001-01', bien: 'HBE001 (Villa Anfa)', runner: 'Youssef', annonce: 24, compte: 24, montant: 130, status: 'en_attente' },
  ]);

  const [damageFee, setDamageFee] = useState(true);
  const [damageNote, setDamageNote] = useState('1 grande serviette tachée d\'huile non récupérable');

  const handleFiger = (id: string) => {
    setFilets(filets.map(f => f.id === id ? { ...f, status: 'fige' } : f));
    alert("✓ Montant du filet figé et synchronisé avec la facturation.");
  };

  return (
    <div className="la-root">
      {/* Header Bar */}
      <header className="la-header">
        <div className="la-header-left">
          <div className="la-avatar">
            {(user?.first_name || 'A')[0]}
          </div>
          <div>
            <div className="la-role-tag">Responsable Linge / Blanchisserie</div>
            <h1 className="la-title">{user?.first_name || 'Amina'} {user?.last_name || ''}</h1>
          </div>
        </div>

        <button onClick={logout} className="la-btn-logout">
          <LogOut size={16} />
          <span>Déconnexion</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="la-main">
        {/* Subtabs Bar */}
        <div className="cb-subtabs-nav" style={{ width: 'fit-content' }}>
          <button
            onClick={() => setActiveTab('reception')}
            className={`cb-subtab-btn ${activeTab === 'reception' ? 'active' : ''}`}
          >
            <ShieldCheck size={16} />
            <span>Réception & Recomptage ({filets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('arbitrage')}
            className={`cb-subtab-btn ${activeTab === 'arbitrage' ? 'active' : ''}`}
          >
            <AlertTriangle size={16} />
            <span>Arbitrage Linge Taché / Abîmé</span>
          </button>

          <button
            onClick={() => setActiveTab('cycle')}
            className={`cb-subtab-btn ${activeTab === 'cycle' ? 'active' : ''}`}
          >
            <Shirt size={16} />
            <span>Cycle de Lavage (Kanban)</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ONGLET 1 : RÉCEPTION & RECOMPTAGE CONTRADICTOIRE                           */}
        {/* ========================================================================= */}
        {activeTab === 'reception' && (
          <div className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
                  Contrôle des Filets Reçus Aujourd'hui
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Recomptage article par article et validation définitive du montant facturable au client
                </div>
              </div>

              <button onClick={() => window.print()} className="cb-btn-secondary">
                <Printer size={16} />
                <span>Imprimer Feuille de Route</span>
              </button>
            </div>

            <div className="cb-table-card">
              <table className="cb-table">
                <thead>
                  <tr>
                    <th>Code Filet</th>
                    <th>Logement</th>
                    <th>Runner</th>
                    <th>Annoncé Runner</th>
                    <th>Recompté Laverie</th>
                    <th>Montant Figé</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filets.map(f => (
                    <tr key={f.id}>
                      <td><span className="cb-code-badge">{f.code}</span></td>
                      <td><strong>{f.bien}</strong></td>
                      <td>{f.runner}</td>
                      <td>{f.annonce} pièces</td>
                      <td><strong>{f.compte} pièces</strong></td>
                      <td><strong style={{ color: '#00473E' }}>{f.montant} DH</strong></td>
                      <td>
                        {f.status === 'fige' ? (
                          <span className="cb-status-pill conciergerie">✓ Figé</span>
                        ) : (
                          <span className="cb-status-pill alerte">À valider</span>
                        )}
                      </td>
                      <td>
                        {f.status === 'fige' ? (
                          <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 700 }}>Conforme</span>
                        ) : (
                          <button onClick={() => handleFiger(f.id)} className="cb-btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                            Figer Montant
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 2 : ARBITRAGE LINGE TACHÉ / ABÎMÉ                                  */}
        {/* ========================================================================= */}
        {activeTab === 'arbitrage' && (
          <div className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
                Signalement et Arbitrage des Pièces Détériorées
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                En cas de tache indélébile ou de déchirure, le forfait de 10 DH est imputé et transmis à la commerciale.
              </div>
            </div>

            <div className="cb-grid-2col">
              <div className="cb-section-box">
                <div className="cb-section-box-title">
                  <AlertTriangle size={16} />
                  <span>Dossier SAC-GBE001-01</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="cb-form-group">
                    <label className="cb-form-label">Nature de la détérioration</label>
                    <input
                      type="text"
                      value={damageNote}
                      onChange={(e) => setDamageNote(e.target.value)}
                      className="cb-form-input"
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fef3c7', padding: '0.75rem', borderRadius: '0.5rem' }}>
                    <input
                      type="checkbox"
                      id="feeToggle"
                      checked={damageFee}
                      onChange={(e) => setDamageFee(e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor="feeToggle" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400e' }}>
                      Appliquer la refacturation forfaitaire de 10 DH
                    </label>
                  </div>

                  <button 
                    onClick={() => alert("✓ Signalement enregistré et notification transmise à Kawtar (Commerciale).")}
                    className="cb-btn-primary"
                  >
                    Transmettre au Commercial
                  </button>
                </div>
              </div>

              <div className="cb-section-box">
                <div className="cb-section-box-title">
                  <span>Message Automatisé pour le Commercial</span>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: '#334155', lineHeight: 1.6 }}>
                  Bonjour Kawtar,
                  <br /><br />
                  Amina signale une anomalie sur le filet SAC-GBE001-01 :
                  <br />
                  • {damageNote}
                  <br />
                  • Montant linge figé : 90 DH {damageFee ? '(+10 DH détérioration)' : ''}
                  <br /><br />
                  Statut : Transmis pour notification au client Ghali Bensouda.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ONGLET 3 : CYCLE DU LINGE KANBAN                                         */}
        {/* ========================================================================= */}
        {activeTab === 'cycle' && (
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
                </div>
              </div>
            </div>

            <div className="rl-kanban-col">
              <div className="rl-kanban-col-head">
                <span>2. En Lavage (60°C)</span>
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
        )}
      </main>
    </div>
  );
}
