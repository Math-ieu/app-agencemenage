import { useState, useEffect } from 'react';
import { getCommandesAirbnb, extractResults } from '../../api/airbnb';
import { getClients } from '../../api/client';
import type { CommandeAirbnb } from '../../types/airbnb';
import { 
  Receipt, CreditCard, ShieldAlert, 
  Lock, Sparkles,
  ShieldCheck
} from 'lucide-react';
import './FacturationAirbnb.css';

export default function FacturationAirbnbView() {
  // 4 Subtabs: 'cycles' | 'modes' | 'suspensions' | 'leviers'
  const [activeTab, setActiveTab] = useState<'cycles' | 'modes' | 'suspensions' | 'leviers'>('cycles');
  
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Selected Client for Payment Mode configuration
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<'passage' | 'mensuel'>('mensuel');

  // Admin Lever Modal / Form State
  const [leverType, setLeverType] = useState<'annuler' | 'geste' | 'reduction'>('geste');
  const [leverMotif, setLeverMotif] = useState('');
  const [leverAmount, setLeverAmount] = useState('50');

  const fetchData = async () => {
    try {
      const [cmdRes, clientsRes] = await Promise.all([
        getCommandesAirbnb(),
        getClients({ is_airbnb: 1 })
      ]);
      const loadedCmds = extractResults<CommandeAirbnb>(cmdRes.data);
      const allClients = extractResults<any>(clientsRes.data);
      const airbnbClients = allClients.filter((c: any) =>
        c.is_airbnb ||
        loadedCmds.some((cmd: any) => Number(cmd.client) === Number(c.id)) ||
        (c.latest_demande?.service && (
          c.latest_demande.service.toLowerCase().includes('airbnb') ||
          c.latest_demande.service.toLowerCase().includes('air bnb') ||
          c.latest_demande.service.toLowerCase().includes('conciergerie')
        ))
      );

      setCommandes(loadedCmds);
      setClients(airbnbClients);
      if (airbnbClients.length > 0 && (!selectedClientId || !airbnbClients.some((c: any) => c.id === selectedClientId))) {
        setSelectedClientId(airbnbClients[0].id);
      }
    } catch (err) {
      console.error("Erreur chargement facturation :", err);
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
      {/* Subtabs Segmented Bar */}
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
          <span>Mode de Paiement & Probatoire</span>
        </button>

        <button
          onClick={() => setActiveTab('suspensions')}
          className={`fa-tab-btn ${activeTab === 'suspensions' ? 'active' : ''}`}
        >
          <ShieldAlert size={16} />
          <span>Compte Suspendu</span>
        </button>

        <button
          onClick={() => setActiveTab('leviers')}
          className={`fa-tab-btn ${activeTab === 'leviers' ? 'active' : ''}`}
        >
          <Sparkles size={16} />
          <span>Leviers Admin</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 1 : CYCLES & FACTURES (Page 17)                               */}
      {/* ========================================================================= */}
      {activeTab === 'cycles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 5 KPIs Facturation */}
          <div className="cb-kpi-grid">
            <div className="cb-kpi-card gold">
              <div className="cb-kpi-label">CA Clôturé Ce Mois</div>
              <div className="cb-kpi-value">{totalRevenu || 14200} DH</div>
              <div className="cb-kpi-sub">Total prestations facturables</div>
            </div>

            <div className="cb-kpi-card">
              <div className="cb-kpi-label">Factures Émises</div>
              <div className="cb-kpi-value">9</div>
              <div className="cb-kpi-sub">Cycle du 26 juillet</div>
            </div>

            <div className="cb-kpi-card blue">
              <div className="cb-kpi-label">En Attente de Règlement</div>
              <div className="cb-kpi-value">4 180 DH</div>
              <div className="cb-kpi-sub">Délai 4 jours en cours</div>
            </div>

            <div className="cb-kpi-card purple">
              <div className="cb-kpi-label">Échéance Aujourd'hui</div>
              <div className="cb-kpi-value">1</div>
              <div className="cb-kpi-sub">Relance WhatsApp automatique</div>
            </div>

            <div className="cb-kpi-card alert">
              <div className="cb-kpi-label">Comptes Suspendus</div>
              <div className="cb-kpi-value">1</div>
              <div className="cb-kpi-sub">Retard &gt; 4 jours</div>
            </div>
          </div>

          {/* Visualiseur de Cycles (Mensuel vs Quinzaine) */}
          <div className="fa-timeline-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
                  Frise Chronologique des Cycles de Facturation
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Cycle mensuel consolidé : prestations du 26 au 25 du mois suivant · Émission le 26 · Paiement à 4 jours
                </div>
              </div>
            </div>

            <div className="fa-timeline-bar">
              <div className="fa-timeline-segment cycle">
                Cycle de Prestations (26 juin au 25 juillet)
              </div>
              <div className="fa-timeline-segment delay">
                Délai Règlement (4 jours)
              </div>
              <div className="fa-timeline-segment lock">
                Blocage si impayé (J+4)
              </div>
            </div>
          </div>

          {/* Tableau des Factures */}
          <div className="cb-table-card">
            <table className="cb-table">
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Client</th>
                  <th>Biens Rattachés</th>
                  <th>Période</th>
                  <th>Total TTC</th>
                  <th>Échéance</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="cb-code-badge">FAC-2026-0726-GBE</span></td>
                  <td><strong>Ghali BENSOUDA</strong></td>
                  <td>3 biens (GBE001, GBE002, GBE003)</td>
                  <td>26 juin → 25 juillet</td>
                  <td><strong style={{ color: '#00473E' }}>4 180 DH</strong></td>
                  <td>30 juillet (J+4)</td>
                  <td><span className="cb-status-pill conciergerie">Payée</span></td>
                  <td><button className="cb-btn-details">Télécharger PDF</button></td>
                </tr>
                <tr>
                  <td><span className="cb-code-badge">FAC-2026-0726-HBE</span></td>
                  <td><strong>Hassan BENJELLOUN</strong></td>
                  <td>1 bien (HBE001)</td>
                  <td>26 juin → 25 juillet</td>
                  <td><strong style={{ color: '#00473E' }}>1 620 DH</strong></td>
                  <td>Hier (Retard)</td>
                  <td><span className="cb-status-pill alerte">Suspendu</span></td>
                  <td><button className="cb-btn-details">Voir Dossier</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 2 : MODE DE PAIEMENT & PÉRIODE PROBATOIRE (Page 18)          */}
      {/* ========================================================================= */}
      {activeTab === 'modes' && (
        <div className="cb-detail-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
                Paramétrage du Mode de Règlement Client
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Sélectionnez le client pour configurer ses modalités contractuelles
              </div>
            </div>

            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(Number(e.target.value))}
              className="cb-filter-select"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} {c.entity_name ? `(${c.entity_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Choix Mode */}
          <div className="cb-grid-2col">
            <div 
              onClick={() => setPaymentMode('passage')}
              className={`cb-section-box ${paymentMode === 'passage' ? 'active' : ''}`}
              style={{ cursor: 'pointer', borderColor: paymentMode === 'passage' ? '#00473E' : '#e2e8f0', borderWidth: '2px' }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
                1. Règlement Après Chaque Passage
              </div>
              <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                Paiement immédiat requis pour chaque turnover avant intervention suivante. Idéal pour particuliers ou nouveaux clients sans historique.
              </div>
            </div>

            <div 
              onClick={() => setPaymentMode('mensuel')}
              className={`cb-section-box ${paymentMode === 'mensuel' ? 'active' : ''}`}
              style={{ cursor: 'pointer', borderColor: paymentMode === 'mensuel' ? '#00473E' : '#e2e8f0', borderWidth: '2px' }}
            >
              <div style={{ fontWeight: 800, color: '#00473E', marginBottom: '0.4rem' }}>
                2. Facturation Mensuelle Groupée (Standard Conciergerie)
              </div>
              <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                Période probatoire de 2 mois par quinzaine, puis bascule automatique en facturation mensuelle le 26 de chaque mois.
              </div>
            </div>
          </div>

          {/* Calendrier Probatoire 2 Mois */}
          <div className="cb-section-box">
            <div className="cb-section-box-title">
              <CreditCard size={16} />
              <span>Générateur de Calendrier Probatoire (5 Échéances)</span>
            </div>

            <table className="cb-table">
              <thead>
                <tr>
                  <th>Échéance</th>
                  <th>Période Couverte</th>
                  <th>Nature</th>
                  <th>Date d'Émission</th>
                  <th>Délai de Paiement</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Quinzaine 1</strong></td>
                  <td>28 juillet → 10 août</td>
                  <td>Prorata initial</td>
                  <td>11 août</td>
                  <td>4 jours (15 août)</td>
                </tr>
                <tr>
                  <td><strong>Quinzaine 2</strong></td>
                  <td>11 août → 25 août</td>
                  <td>Quinzaine normale</td>
                  <td>26 août</td>
                  <td>4 jours (30 août)</td>
                </tr>
                <tr>
                  <td><strong>Quinzaine 3</strong></td>
                  <td>26 août → 10 septembre</td>
                  <td>Quinzaine normale</td>
                  <td>11 septembre</td>
                  <td>4 jours (15 septembre)</td>
                </tr>
                <tr>
                  <td><strong>Quinzaine 4</strong></td>
                  <td>11 septembre → 25 septembre</td>
                  <td>Fin période probatoire</td>
                  <td>26 septembre</td>
                  <td>4 jours (30 septembre)</td>
                </tr>
                <tr style={{ background: '#f0fdfa' }}>
                  <td><strong style={{ color: '#00473E' }}>Bascule Mensuelle</strong></td>
                  <td><strong>26 septembre → 25 octobre</strong></td>
                  <td><strong>1er Cycle Mensuel Plein</strong></td>
                  <td><strong>26 octobre</strong></td>
                  <td><strong>4 jours (30 octobre)</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 3 : COMPTE SUSPENDU (Page 19)                                 */}
      {/* ========================================================================= */}
      {activeTab === 'suspensions' && (
        <div className="fa-locked-card">
          <div className="fa-locked-header">
            <Lock size={28} />
            <div>
              <h2 className="fa-locked-title">Compte Conciergerie Suspendu pour Impayé</h2>
              <div style={{ fontSize: '0.85rem', color: '#7f1d1d' }}>
                Client : Hassan BENJELLOUN · Facture FAC-2026-0726-HBE en retard de 6 jours (Échéance 30 juillet)
              </div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem', color: '#334155' }}>
            <div style={{ fontWeight: 800, color: '#991b1b' }}>
              Impacts Opérationnels Automatiques en Cours :
            </div>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.6 }}>
              <li><strong>Blocage des commandes :</strong> Les 2 turnovers prévus cette semaine sont automatiquement annulés.</li>
              <li><strong>Arrêt des tournées runner :</strong> Aucune livraison ni ramassage de linge n'est planifié.</li>
              <li><strong>Maintien en blanchisserie :</strong> Le linge propre reste consigné à l'agence jusqu'à régularisation.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#7f1d1d', fontWeight: 600 }}>
              Montant exigible : <strong>1 620 DH TTC</strong>
            </span>
            <button 
              onClick={() => alert("Demande de levée de suspension transmise à la direction.")}
              className="cb-btn-primary" 
              style={{ background: '#991b1b' }}
            >
              <span>Régulariser & Lever la Suspension</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 4 : LEVIERS ADMIN & AUDIT (Page 20)                           */}
      {/* ========================================================================= */}
      {activeTab === 'leviers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Les 3 Leviers Admin Cards */}
          <div className="fa-levers-grid">
            <div className="fa-lever-card">
              <div>
                <span className="cb-code-badge" style={{ color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}>
                  Levier 1
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0' }}>
                  Annuler une Facture
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Annulation complète avec émission d'un avoir formel et traçabilité de l'administrateur.
                </p>
              </div>
              <button 
                onClick={() => {
                  setLeverType('annuler');
                  alert("Formulaire d'annulation sélectionné.");
                }}
                className="cb-btn-secondary"
              >
                Sélectionner
              </button>
            </div>

            <div className="fa-lever-card">
              <div>
                <span className="cb-code-badge" style={{ color: '#00473E', background: '#f0fdfa', borderColor: '#ccfbf1' }}>
                  Levier 2
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0' }}>
                  Geste Commercial
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Remise accordée pour retard runner ou insatisfaction avec saisie obligatoire du motif.
                </p>
              </div>
              <button 
                onClick={() => {
                  setLeverType('geste');
                  alert("Formulaire de geste commercial sélectionné.");
                }}
                className="cb-btn-primary"
              >
                Sélectionner
              </button>
            </div>

            <div className="fa-lever-card">
              <div>
                <span className="cb-code-badge" style={{ color: '#2563eb', background: '#eff6ff', borderColor: '#dbeafe' }}>
                  Levier 3
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0' }}>
                  Réduction Partielle
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Ajustement à la ligne (ex: déduction d'un set de linge ou d'une option non exécutée).
                </p>
              </div>
              <button 
                onClick={() => {
                  setLeverType('reduction');
                  alert("Formulaire de réduction partielle sélectionné.");
                }}
                className="cb-btn-secondary"
              >
                Sélectionner
              </button>
            </div>
          </div>

          {/* Formulaire d'Application du Levier */}
          <div className="cb-detail-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#00473E', marginBottom: '1rem' }}>
              Appliquer un Levier Exceptionnel : {leverType.toUpperCase()}
            </h3>

            <div className="cb-form-grid-2">
              <div className="cb-form-group">
                <label className="cb-form-label">Montant de l'ajustement (DH) <span className="req">*</span></label>
                <input
                  type="number"
                  value={leverAmount}
                  onChange={(e) => setLeverAmount(e.target.value)}
                  className="cb-form-input"
                />
              </div>

              <div className="cb-form-group">
                <label className="cb-form-label">Motif Obligatoire pour l'Audit <span className="req">*</span></label>
                <input
                  type="text"
                  placeholder="Ex: Retard runner de 45 min justifié sur GBE001..."
                  value={leverMotif}
                  onChange={(e) => setLeverMotif(e.target.value)}
                  className="cb-form-input"
                />
              </div>
            </div>

            <button 
              onClick={() => {
                if (!leverMotif) {
                  alert("Le motif est strictement obligatoire pour l'audit.");
                  return;
                }
                alert(`✓ Action enregistrée dans le journal d'audit par Mehdi H. (Admin).`);
                setLeverMotif('');
              }}
              className="cb-btn-primary"
            >
              <ShieldCheck size={16} />
              <span>Enregistrer dans le Journal d'Audit</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
