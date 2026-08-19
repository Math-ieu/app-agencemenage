import { useState } from 'react';
import { useAuthStore } from '../../store/auth';
import { 
  Truck, Key, Camera, LogOut, Package, ArrowLeft
} from 'lucide-react';
import './RunnerApp.css';

interface StopItem {
  id: string;
  time: string;
  code: string;
  name: string;
  address: string;
  accessCode: string;
  type: 'depot_ramassage' | 'depot_seul' | 'ramassage_seul';
  piecesAnnoncees: number;
  done: boolean;
}

export default function RunnerApp() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'tournee' | 'arret'>('tournee');
  const [selectedStopId, setSelectedStopId] = useState<string>('1');

  // Daily Tour Stops
  const [stops, setStops] = useState<StopItem[]>([
    { id: '1', time: '09:30', code: 'GBE001', name: '2 chambres Gauthier', address: 'Rue Jean Jaurès, Résidence Al Manar, Étage 3, Porte 32', accessCode: 'Code boîte à clés : 4512', type: 'depot_ramassage', piecesAnnoncees: 16, done: false },
    { id: '2', time: '11:00', code: 'GBE002', name: 'Studio Racine', address: 'Boulevard d\'Anfa, Imm. B, 2ème étage', accessCode: 'Digicode entrée : 8821B · Boîte clés : 1290', type: 'depot_ramassage', piecesAnnoncees: 8, done: false },
    { id: '3', time: '12:30', code: 'GBE003', name: '3 chambres Racine', address: 'Rue Franklin Roosevelt, Porte 14', accessCode: 'Gardien Hassan : 06 12 34 56 78', type: 'depot_ramassage', piecesAnnoncees: 16, done: false },
    { id: '4', time: '14:00', code: 'HBE001', name: 'Villa Anfa Supérieur', address: 'Avenue de Biarritz', accessCode: 'Télécommande portail dans le coffret', type: 'depot_seul', piecesAnnoncees: 24, done: false },
    { id: '5', time: '15:30', code: 'GBE004', name: 'Studio Bourgogne', address: 'Rue de Lille, Étage 1', accessCode: 'Boîte à clés : 3390', type: 'ramassage_seul', piecesAnnoncees: 8, done: false },
  ]);

  // Steppers for Linen Count at current stop
  const [counts, setCounts] = useState<{ [key: string]: number }>({
    housses: 1,
    draps: 1,
    taies: 2,
    serviettes_gdes: 2,
    serviettes_ptes: 2,
    pieces_supp: 8,
  });

  const [depositConfirmed, setDepositConfirmed] = useState(false);
  const [validating, setValidating] = useState(false);

  const activeStop = stops.find(s => s.id === selectedStopId) || stops[0];

  const totalPieces = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
  const calculatedSets = Math.floor((counts.housses + counts.draps + counts.taies + counts.serviettes_gdes + counts.serviettes_ptes) / 8);
  const calculatedAmount = (calculatedSets * 50) + (counts.pieces_supp * 5);

  const increment = (k: string) => setCounts(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 }));
  const decrement = (k: string) => setCounts(prev => ({ ...prev, [k]: Math.max(0, (prev[k] || 0) - 1) }));

  const handleValidateStop = () => {
    setValidating(true);
    setTimeout(() => {
      setStops(stops.map(s => s.id === activeStop.id ? { ...s, done: true } : s));
      setValidating(false);
      alert(`✓ Arrêt ${activeStop.code} validé avec succès ! Décompte : ${totalPieces} pièces (${calculatedAmount} DH).`);
      setActiveTab('tournee');
    }, 400);
  };

  const doneCount = stops.filter(s => s.done).length;

  return (
    <div className="rm-app-container">
      <div className="rm-mobile-viewport">
        {/* Sticky Header */}
        <header className="rm-header">
          <div className="rm-user-info">
            <div className="rm-user-avatar">
              {(user?.first_name || 'Y')[0]}
            </div>
            <div>
              <div className="rm-user-role">Runner / Chauffeur Livreur</div>
              <h1 className="rm-user-name">{user?.first_name || 'Youssef'} {user?.last_name || ''}</h1>
            </div>
          </div>

          <button onClick={logout} className="rm-btn-logout" title="Se déconnecter">
            <LogOut size={14} />
            <span>Sortir</span>
          </button>
        </header>

        {/* Tab Navigation */}
        <nav className="rm-nav-bar">
          <button
            onClick={() => setActiveTab('tournee')}
            className={`rm-nav-btn ${activeTab === 'tournee' ? 'active' : ''}`}
          >
            <Truck size={16} />
            <span>Ma Tournée ({doneCount}/{stops.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('arret')}
            className={`rm-nav-btn ${activeTab === 'arret' ? 'active' : ''}`}
          >
            <Package size={16} />
            <span>Arrêt : {activeStop?.code}</span>
          </button>
        </nav>

        {/* ========================================================================= */}
        {/* VUE 1 : MA TOURNÉE DU JOUR                                                */}
        {/* ========================================================================= */}
        {activeTab === 'tournee' && (
          <main className="rm-content">
            {/* 4 KPIs Tournée */}
            <div className="rm-kpis-grid">
              <div className="rm-kpi-card highlight">
                <div className="rm-kpi-val">{stops.length}</div>
                <div className="rm-kpi-lbl">Arrêts Prévus</div>
              </div>

              <div className="rm-kpi-card">
                <div className="rm-kpi-val">{doneCount}</div>
                <div className="rm-kpi-lbl">Déjà Effectués</div>
              </div>

              <div className="rm-kpi-card">
                <div className="rm-kpi-val">4</div>
                <div className="rm-kpi-lbl">Dépôts Propres</div>
              </div>

              <div className="rm-kpi-card">
                <div className="rm-kpi-val">5</div>
                <div className="rm-kpi-lbl">Ramassages Sales</div>
              </div>
            </div>

            {/* Retrait au Bureau */}
            <div className="rm-card-box">
              <div className="rm-card-title">
                <Package size={16} />
                <span>Retrait au Bureau (4 Filets à charger)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                  <span>✓ Filet GBE001 (16 pièces)</span>
                  <span>Chargé</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                  <span>✓ Filet GBE002 (8 pièces)</span>
                  <span>Chargé</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>• Filet GBE003 (16 pièces)</span>
                  <span>À vérifier</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>• Filet HBE001 (24 pièces)</span>
                  <span>À vérifier</span>
                </div>
              </div>
            </div>

            {/* Liste des Arrêts Chronologiques */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.6rem' }}>
                Arrêts Chronologiques de la Tournée
              </div>

              {stops.map(stop => (
                <div
                  key={stop.id}
                  className={`rm-stop-item ${stop.done ? 'done' : ''}`}
                  onClick={() => {
                    setSelectedStopId(stop.id);
                    setActiveTab('arret');
                  }}
                >
                  <div className="rm-stop-top">
                    <span className="rm-stop-code">{stop.time} — {stop.code}</span>
                    <span className={`rm-stop-badge ${stop.done ? 'done' : 'pending'}`}>
                      {stop.done ? '✓ Effectué' : 'À faire'}
                    </span>
                  </div>
                  <div className="rm-stop-details">
                    <strong>{stop.name}</strong> · {stop.address}
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* ========================================================================= */}
        {/* VUE 2 : DÉTAIL DE L'ARRÊT & COMPTAGE SUR PLACE                             */}
        {/* ========================================================================= */}
        {activeTab === 'arret' && (
          <main className="rm-content">
            <button 
              onClick={() => setActiveTab('tournee')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: '#00473E', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
            >
              <ArrowLeft size={16} />
              <span>Retour à la liste de ma tournée</span>
            </button>

            {/* Modalités d'accès sensibles */}
            <div className="rm-access-box">
              <div className="rm-access-title">
                <Key size={16} />
                <span>Accès Logement {activeStop.code}</span>
              </div>
              <div className="rm-access-code">{activeStop.accessCode}</div>
              <div style={{ fontSize: '0.8rem', color: '#7f1d1d', marginTop: '0.35rem' }}>
                Adresse : {activeStop.address}
              </div>
            </div>

            {/* Confirmation Dépôt Propre */}
            <div className="rm-card-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>
                    1. Dépôt Filet Propre
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    SAC-{activeStop.code}-01 ({activeStop.piecesAnnoncees} pcs scellées)
                  </div>
                </div>

                <button
                  onClick={() => setDepositConfirmed(!depositConfirmed)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    background: depositConfirmed ? '#15803d' : '#e2e8f0',
                    color: depositConfirmed ? '#ffffff' : '#475569'
                  }}
                >
                  {depositConfirmed ? '✓ Déposé' : 'Confirmer dépôt'}
                </button>
              </div>
            </div>

            {/* Comptage Linge Sale Ramassé */}
            <div className="rm-card-box">
              <div className="rm-card-title">
                <span>2. Comptage Linge Sale Ramassé</span>
              </div>

              <div className="rm-stepper-grid">
                {[
                  { key: 'housses', label: 'Housses couette' },
                  { key: 'draps', label: 'Draps plats' },
                  { key: 'taies', label: 'Taies oreiller' },
                  { key: 'serviettes_gdes', label: 'Gdes serviettes' },
                  { key: 'serviettes_ptes', label: 'Ptes serviettes' },
                  { key: 'pieces_supp', label: 'Pièces suppl.' },
                ].map(item => (
                  <div key={item.key} className="rm-stepper-box">
                    <span className="rm-stepper-lbl">{item.label}</span>
                    <div className="rm-stepper-actions">
                      <button type="button" onClick={() => decrement(item.key)} className="rm-btn-step">-</button>
                      <span className="rm-step-val">{counts[item.key] || 0}</span>
                      <button type="button" onClick={() => increment(item.key)} className="rm-btn-step">+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Live */}
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>Total pièces : <strong>{totalPieces}</strong></span>
                <span style={{ fontSize: '1rem', fontWeight: 900, color: '#00473E' }}>Montant : {calculatedAmount} DH</span>
              </div>
            </div>

            {/* Validation & Clôture Arrêt */}
            <button
              onClick={handleValidateStop}
              disabled={validating}
              className="rm-btn-primary"
            >
              <Camera size={18} />
              <span>{validating ? 'Validation en cours...' : 'Prendre Photo & Valider l\'Arrêt'}</span>
            </button>
          </main>
        )}
      </div>
    </div>
  );
}
