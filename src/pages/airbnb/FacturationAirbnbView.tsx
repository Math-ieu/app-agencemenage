import { useState, useEffect } from 'react';
import { getCommandesAirbnb, getCommandeStats, extractResults } from '../../api/airbnb';
import { getClients } from '../../api/client';
import type { CommandeAirbnb, CommandeStats } from '../../types/airbnb';
import { 
  Receipt, CreditCard, ShieldAlert, 
  RotateCw, Unlock, TrendingUp
} from 'lucide-react';
import './FacturationAirbnb.css';

export default function FacturationAirbnbView() {
  const [activeTab, setActiveTab] = useState<'cycles' | 'modes' | 'suspensions'>('cycles');
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [stats, setStats] = useState<CommandeStats | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Client for Payment Mode configuration
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<'passage' | 'fin_de_mois'>('fin_de_mois');
  const [probationWeeks] = useState(6); // 6 / 8 semaines écoulées

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cmdRes, statsRes, clientsRes] = await Promise.all([
        getCommandesAirbnb(),
        getCommandeStats(),
        getClients()
      ]);
      setCommandes(extractResults<CommandeAirbnb>(cmdRes.data));
      setStats(statsRes.data);
      const cls = extractResults<any>(clientsRes.data);
      setClients(cls);
      if (cls.length > 0 && !selectedClientId) {
        setSelectedClientId(cls[0].id);
      }
    } catch (err) {
      console.error("Erreur chargement facturation :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalRevenu = commandes
    .filter(c => c.statut === 'cloturee')
    .reduce((acc, c) => acc + (Number(c.total_ttc) || 0), 0);

  return (
    <div className="fa-container">
      {/* Subtabs Segmented Control */}
      <div className="fa-subtabs">
        <button
          onClick={() => setActiveTab('cycles')}
          className={`fa-tab-btn ${activeTab === 'cycles' ? 'active' : ''}`}
        >
          <Receipt size={16} />
          <span>Cycles & Factures</span>
        </button>

        <button
          onClick={() => setActiveTab('modes')}
          className={`fa-tab-btn ${activeTab === 'modes' ? 'active' : ''}`}
        >
          <CreditCard size={16} />
          <span>Mode de Règlement & Période Probatoire</span>
        </button>

        <button
          onClick={() => setActiveTab('suspensions')}
          className={`fa-tab-btn ${activeTab === 'suspensions' ? 'active' : ''}`}
        >
          <ShieldAlert size={16} />
          <span>Comptes Suspendus & Déblocage</span>
        </button>
      </div>

      {activeTab === 'cycles' && (
        /* ══════════ CYCLES & FACTURES ══════════ */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Banner Cycle */}
          <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <TrendingUp size={20} color="#0f766e" />
              <div>
                <span style={{ fontWeight: 800, color: '#134e4a', display: 'block' }}>Facturation Consolidée de Fin de Mois</span>
                <span style={{ fontSize: '0.8rem', color: '#0f766e' }}>Émission groupée au 30/31 du mois avec détail par logement et relevé contradictoire de blanchisserie.</span>
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#00473E' }}>
              Prochain cycle : Fin du mois
            </div>
          </div>

          {/* 4 KPIs Facturation */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #00473E' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Total Clôturé (Mois)</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#00473E', marginTop: '4px' }}>
                {totalRevenu} DH
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Prestations conformes</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #d97706' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Missions ce Mois</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                {stats?.total_mois || commandes.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Missions consolidées</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #16a34a' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Règlements Reçus</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                100%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Taux de recouvrement</div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Impayés &gt; 4 jours</div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
                0
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Aucun compte bloqué</div>
            </div>
          </div>

          {/* Table Factures */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Commande</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Client</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Logement</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Date Prestation</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Montant TTC</th>
                  <th style={{ background: '#f8fafc', padding: '0.875rem 1rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Statut Clôture</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                      Chargement de la facturation...
                    </td>
                  </tr>
                ) : (
                  commandes.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f766e', background: '#f0fdfa', padding: '0.2rem 0.5rem', borderRadius: '0.375rem' }}>
                          {c.numero}
                        </span>
                      </td>
                      <td style={{ padding: '0.95rem 1rem', fontWeight: 600 }}>{c.client_name}</td>
                      <td style={{ padding: '0.95rem 1rem' }}>{c.bien_nom}</td>
                      <td style={{ padding: '0.95rem 1rem' }}>{c.date_prestation}</td>
                      <td style={{ padding: '0.95rem 1rem', fontWeight: 800, color: '#00473E' }}>{c.total_ttc} DH</td>
                      <td style={{ padding: '0.95rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, background: c.statut === 'cloturee' ? '#f0fdf4' : '#f1f5f9', color: c.statut === 'cloturee' ? '#15803d' : '#475569' }}>
                          {c.statut === 'cloturee' ? 'Prêt à facturer' : c.statut}
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

      {activeTab === 'modes' && (
        /* ══════════ MODE DE RÈGLEMENT & PÉRIODE PROBATOIRE ══════════ */
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
              Sélectionner le Client pour Paramétrage
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(Number(e.target.value))}
              style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.segment === 'entreprise' && c.entity_name ? `${c.entity_name} (${c.phone})` : `${c.first_name} ${c.last_name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Mode Selection Cards */}
          <div className="fa-mode-grid">
            <div
              className={`fa-mode-card ${paymentMode === 'passage' ? 'active' : ''}`}
              onClick={() => setPaymentMode('passage')}
              style={{ cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                Règlement au Passage
              </h3>
              <p style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: 1.45 }}>
                Règlement exigible après chaque intervention de ménage et clôture des photos de conformité.
              </p>
            </div>

            <div
              className={`fa-mode-card ${paymentMode === 'fin_de_mois' ? 'active' : ''}`}
              onClick={() => setPaymentMode('fin_de_mois')}
              style={{ cursor: 'pointer' }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                Facturation Fin de Mois
              </h3>
              <p style={{ fontSize: '0.825rem', color: '#64748b', lineHeight: 1.45 }}>
                Facture récapitulative unique émise le dernier jour du mois avec exigibilité à réception.
              </p>
            </div>
          </div>

          {/* Période Probatoire Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.875rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>Période Probatoire (2 Mois / 8 Semaines)</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#00473E' }}>{probationWeeks} / 8 semaines validées (75%)</span>
            </div>

            <div className="fa-progress-bar-bg">
              <div className="fa-progress-bar-fill" style={{ width: `${(probationWeeks / 8) * 100}%` }} />
            </div>

            <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.5rem' }}>
              Pendant les 8 premières semaines, la facturation s'effectue obligatoirement en bimensuel avant passage définitif au mode mensuel consolidé.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'suspensions' && (
        /* ══════════ COMPTES SUSPENDUS & DÉBLOCAGE ══════════ */
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1rem 1.25rem', color: '#991b1b', fontSize: '0.85rem' }}>
            <b>Règle de Suspension Automatique (&gt; 4 jours d'impayé) :</b> Dès que le délai de paiement dépasse 4 jours calendaires, toute nouvelle prise de turnover est immédiatement bloquée.
          </div>

          <div style={{ background: '#00473E', color: '#ffffff', borderRadius: '0.875rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
              <Unlock size={20} color="#fde047" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>Console de Déblocage Exceptionnel</h3>
            </div>
            <p style={{ fontSize: '0.825rem', color: '#ccfbf1', marginBottom: '1rem', lineHeight: 1.45 }}>
              Sélectionnez un compte client suspendu pour enregistrer un règlement ou lever la suspension sous autorisation de la direction générale.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <select style={{ flex: 1, padding: '0.6rem 0.85rem', borderRadius: '0.5rem', background: '#ffffff', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem' }}>
                <option>Aucun compte suspendu actuellement</option>
              </select>
              <button disabled style={{ padding: '0.6rem 1.25rem', background: '#fde047', color: '#0f172a', borderRadius: '0.5rem', fontWeight: 800, border: 'none', opacity: 0.6 }}>
                Débloquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
