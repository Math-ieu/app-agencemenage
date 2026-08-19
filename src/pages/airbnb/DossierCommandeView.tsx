import { useState, useEffect, type FormEvent } from 'react';
import { 
  getCommandesAirbnb, assignerCommandeAirbnb, cloturerCommandeAirbnb, 
  extractResults 
} from '../../api/airbnb';
import { getAgents } from '../../api/client';
import type { CommandeAirbnb } from '../../types/airbnb';
import { 
  X, UserCheck, 
  Camera, PackageSearch, Shirt,
  CheckCircle2, Clock, Truck, ShieldCheck
} from 'lucide-react';
import './DossierCommande.css';

export default function DossierCommandeView() {
  // Navigation subtabs: 'dossier' | 'moments' | 'laverie'
  const [activeSubtab, setActiveSubtab] = useState<'dossier' | 'moments' | 'laverie'>('dossier');

  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [search] = useState('');
  const [statusFilter] = useState('');
  
  // Selected Commande for Detail Inspection
  const [selectedCmd, setSelectedCmd] = useState<CommandeAirbnb | null>(null);

  // Intervenantes for Assignment
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignIntervenante, setAssignIntervenante] = useState<number | ''>('');
  const [assignIntervenante2, setAssignIntervenante2] = useState<number | ''>('');
  const [assignRunner] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Cloture Modal State
  const [isClotureOpen, setIsClotureOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);
  const [clotureLoading, setClotureLoading] = useState(false);

  // Responsable Linge Arbitrage State (Page 09)
  const [damagedFeeApplied, setDamagedFeeApplied] = useState(true);
  const [damagedNote, setDamagedNote] = useState('1 grande serviette tachée d\'huile solaire non récupérable');

  const fetchCommandes = async () => {
    try {
      const [cmdRes, agRes] = await Promise.all([
        getCommandesAirbnb({ search, statut: statusFilter }),
        getAgents()
      ]);
      const loadedCmds = extractResults<CommandeAirbnb>(cmdRes.data);
      setCommandes(loadedCmds);
      setAgentsList(extractResults<any>(agRes.data));

      if (loadedCmds.length > 0 && !selectedCmd) {
        setSelectedCmd(loadedCmds[0]);
      }
    } catch (err) {
      console.error("Erreur chargement commandes :", err);
    }
  };

  useEffect(() => {
    fetchCommandes();
  }, [search, statusFilter]);

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCmd || !assignIntervenante) return;

    setAssignLoading(true);
    try {
      await assignerCommandeAirbnb(selectedCmd.id, {
        intervenante_id: Number(assignIntervenante),
        intervenante_2_id: assignIntervenante2 ? Number(assignIntervenante2) : undefined,
        runner_id: assignRunner ? Number(assignRunner) : undefined,
      });
      setIsAssignOpen(false);
      fetchCommandes();
      setSelectedCmd({
        ...selectedCmd,
        statut: 'assignee',
        intervenante: Number(assignIntervenante),
        intervenante_2: assignIntervenante2 ? Number(assignIntervenante2) : undefined,
      });
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'assignation");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleCloture = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCmd) return;

    const validPhotos = photos.filter(p => p.trim() !== '');
    if (validPhotos.length < 4) {
      alert("4 photos sont obligatoires pour valider la clôture (Salon, Chambre, SDB, Cuisine).");
      return;
    }

    setClotureLoading(true);
    try {
      await cloturerCommandeAirbnb(selectedCmd.id, { photos: validPhotos });
      setIsClotureOpen(false);
      fetchCommandes();
      setSelectedCmd({
        ...selectedCmd,
        statut: 'cloturee',
        photos_cloture: validPhotos,
      });
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la clôture");
    } finally {
      setClotureLoading(false);
    }
  };

  const activeCmd = selectedCmd || commandes[0];

  return (
    <div className="dc-container">
      {/* Subtabs Bar */}
      <div className="dc-subtabs-nav">
        <button 
          className={`dc-subtab-btn ${activeSubtab === 'dossier' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('dossier')}
        >
          <PackageSearch size={16} />
          <span>Dossier Commande (6 Blocs)</span>
        </button>

        <button 
          className={`dc-subtab-btn ${activeSubtab === 'moments' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('moments')}
        >
          <Truck size={16} />
          <span>Les 2 moments du runner</span>
        </button>

        <button 
          className={`dc-subtab-btn ${activeSubtab === 'laverie' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('laverie')}
        >
          <Shirt size={16} />
          <span>Écran responsable linge</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 1 : DOSSIER COMMANDE 6 BLOCS CONSOLE (Page 07)                */}
      {/* ========================================================================= */}
      {activeSubtab === 'dossier' && (
        <div className="dc-dossier-layout">
          {/* Colonne Gauche : Sélecteur Commande + 6 Blocs */}
          <div className="dc-dossier-card">
            {/* Header Commande Active */}
            <div className="dc-dossier-header">
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ccfbf1' }}>
                  Dossier Turnover Unique
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.2rem 0', color: '#ffffff' }}>
                  {activeCmd ? `${activeCmd.numero} · ${activeCmd.bien_code || 'GBE001'}` : 'Aucune commande'}
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#ccfbf1' }}>
                  Date : {activeCmd?.date_prestation} · Créneau : {activeCmd?.heure_prestation} ({activeCmd?.creneau})
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <select
                  value={activeCmd?.id || ''}
                  onChange={(e) => {
                    const found = commandes.find(c => c.id === e.target.value);
                    if (found) setSelectedCmd(found);
                  }}
                  className="dc-filter-select"
                  style={{ background: '#ffffff', color: '#00473E', fontWeight: 700 }}
                >
                  {commandes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.numero} — {c.bien_code} ({c.date_prestation})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Corps : Les 6 Blocs Chronologiques */}
            <div className="dc-dossier-body">
              {/* BLOC 1 : Commande Créée */}
              <div className="dc-bloc-item done">
                <div className="dc-bloc-head">
                  <div className="dc-bloc-title">
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>1. Commande créée</span>
                  </div>
                  <span className="dc-bloc-actor">Commercial · Kawtar</span>
                </div>
                <div className="dc-bloc-desc">
                  Saisie via le portail conciergerie ou backoffice. Logement <strong>{activeCmd?.bien_code}</strong>. 
                  Options réassort : {activeCmd?.options?.length || 0} pack(s).
                </div>
              </div>

              {/* BLOC 2 : Dépôt Filet Propre */}
              <div className="dc-bloc-item done">
                <div className="dc-bloc-head">
                  <div className="dc-bloc-title">
                    <CheckCircle2 size={16} color="#10b981" />
                    <span>2. Dépôt du filet propre</span>
                  </div>
                  <span className="dc-bloc-actor">Runner · Youssef</span>
                </div>
                <div className="dc-bloc-desc">
                  Filet propre <strong>SAC-{activeCmd?.bien_code || 'GBE001'}-01</strong> déposé sur place. 
                  <em>(Non facturé sur cette commande — rattaché à la commande d'origine).</em>
                </div>
              </div>

              {/* BLOC 3 : Comptage Linge Sale */}
              <div className={`dc-bloc-item ${activeCmd?.statut === 'saisie' ? 'current' : 'done'}`}>
                <div className="dc-bloc-head">
                  <div className="dc-bloc-title">
                    <Shirt size={16} color="#00473E" />
                    <span>3. Comptage du linge sale ramassé</span>
                  </div>
                  <span className="dc-bloc-actor">Runner · Youssef</span>
                </div>
                <div className="dc-bloc-desc">
                  16 pièces ramassées (1 set 8 pcs + 8 pièces supplémentaires). Facturable sur ce dossier.
                </div>
              </div>

              {/* BLOC 4 : Recomptage et Observations Laverie */}
              <div className={`dc-bloc-item ${activeCmd?.statut === 'en_cours' || activeCmd?.statut === 'cloturee' ? 'done' : 'pending'}`}>
                <div className="dc-bloc-head">
                  <div className="dc-bloc-title">
                    <ShieldCheck size={16} color="#0d9488" />
                    <span>4. Recomptage & figeage du montant</span>
                  </div>
                  <span className="dc-bloc-actor">Resp. Linge · Amina</span>
                </div>
                <div className="dc-bloc-desc">
                  Contrôle contradictoire : 16 pièces confirmées (écart 0). Montant du linge <strong>{activeCmd?.montant_linge || 90} DH</strong> figé.
                </div>
              </div>

              {/* BLOC 5 : Notification au Commercial */}
              <div className={`dc-bloc-item ${activeCmd?.statut === 'cloturee' ? 'done' : 'pending'}`}>
                <div className="dc-bloc-head">
                  <div className="dc-bloc-title">
                    <Clock size={16} color="#64748b" />
                    <span>5. Notification au commercial</span>
                  </div>
                  <span className="dc-bloc-actor">Système Automatisé</span>
                </div>
                <div className="dc-bloc-desc">
                  Compte-rendu envoyé à la chargée de clientèle. Signalement linge taché validé avec proposition de refacturation.
                </div>
              </div>

              {/* BLOC 6 : Commande Facturable */}
              <div className={`dc-bloc-item ${activeCmd?.statut === 'cloturee' ? 'done' : 'pending'}`}>
                <div className="dc-bloc-head">
                  <div className="dc-bloc-title">
                    <CheckCircle2 size={16} color={activeCmd?.statut === 'cloturee' ? '#10b981' : '#cbd5e1'} />
                    <span>6. Commande Facturable</span>
                  </div>
                  <span className="dc-bloc-actor">Système Facturation</span>
                </div>
                <div className="dc-bloc-desc">
                  {activeCmd?.statut === 'cloturee' ? (
                    <span style={{ color: '#15803d', fontWeight: 700 }}>
                      ✓ Facturable — Intégrée au cycle du 26 du mois (Total : {activeCmd?.total_ttc} DH).
                    </span>
                  ) : (
                    <span style={{ color: '#64748b' }}>
                      En attente de la validation des 4 photos obligatoires et du décompte contradictoire.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Bar Footer */}
            <div style={{ display: 'flex', gap: '0.75rem', padding: '1.25rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button 
                onClick={() => setIsAssignOpen(true)}
                className="cb-btn-secondary"
              >
                <UserCheck size={16} />
                <span>Assigner Intervenante</span>
              </button>

              <button 
                onClick={() => setIsClotureOpen(true)}
                className="cb-btn-primary"
              >
                <Camera size={16} />
                <span>Valider Clôture Photos (4/4)</span>
              </button>
            </div>
          </div>

          {/* Colonne Droite : Décomposition Financière & Rotation Linge */}
          <div className="dc-sidebar-col">
            <div className="dc-price-card">
              <div className="dc-price-card-title">Décomposition Financière</div>
              <div className="dc-price-row">
                <span>Ménage remise en état :</span>
                <strong>{activeCmd?.prix_menage || 160} DH</strong>
              </div>
              {Number(activeCmd?.supplement_zone) > 0 && (
                <div className="dc-price-row">
                  <span>Zone éloignée (+50 DH) :</span>
                  <strong>+{activeCmd?.supplement_zone} DH</strong>
                </div>
              )}
              {Number(activeCmd?.prix_options) > 0 && (
                <div className="dc-price-row">
                  <span>Options souscrites :</span>
                  <strong>+{activeCmd?.prix_options} DH</strong>
                </div>
              )}
              <div className="dc-price-row">
                <span>Linge ramassé (16 pcs) :</span>
                <strong>+{activeCmd?.montant_linge || 90} DH</strong>
              </div>
              <div className="dc-price-total">
                <span>Total TTC :</span>
                <span>{activeCmd?.total_ttc || 250} DH</span>
              </div>
            </div>

            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <Shirt size={16} />
                <span>Prochain Dépôt & Rotation Linge</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div><strong>Délai de lavage :</strong> 48 heures contractuelles</div>
                <div><strong>Disponibilité au départ :</strong> Après-demain 09h00</div>
                <div><strong>Stock logement :</strong> 3 sets complets dédiés</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 2 : LES 2 MOMENTS DU RUNNER (Page 08)                         */}
      {/* ========================================================================= */}
      {activeSubtab === 'moments' && (
        <div className="dc-moments-grid">
          {/* Moment 1 : Retrait au Bureau */}
          <div className="dc-moment-card">
            <div className="dc-moment-header">
              <span className="dc-moment-badge">Moment 1</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Retrait au Bureau (Avant le départ)
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Contrôle contradictoire rapide</div>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
              Le runner vérifie la plaque nominative et le nombre de pièces sous film plastique scellé.
            </div>

            <div className="cb-pricing-box" style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#00473E' }}>
                Filet GBE001 — 16 pièces annoncées
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                1 housse, 1 drap, 2 taies, 2 grdes serv., 2 ptes serv., 8 pièces supp.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              <button className="cb-btn-primary" style={{ flex: 1 }}>
                ✓ Confirmer le retrait
              </button>
              <button className="cb-btn-secondary">
                Contester
              </button>
            </div>
          </div>

          {/* Moment 2 : Ramassage Linge Sale */}
          <div className="dc-moment-card">
            <div className="dc-moment-header">
              <span className="dc-moment-badge">Moment 2</span>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Ramassage Linge Sale (Sur place)
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Comptage article par article</div>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
              Le runner compte les pièces réelles laissées par les voyageurs et saisit le décompte avec les 6 steppers.
            </div>

            <div className="cb-section-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span>Total Pièces Constatées :</span>
                <strong>16 pièces</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <span>Décomposition Moteur :</span>
                <strong>1 set (8 pcs) + 8 suppl.</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#00473E', fontWeight: 800 }}>
                <span>Montant Facturable :</span>
                <span>90 DH</span>
              </div>
            </div>

            <button className="cb-btn-primary" style={{ marginTop: 'auto' }}>
              Valider le décompte & la photo
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 3 : ÉCRAN RESPONSABLE LINGE (Page 09)                         */}
      {/* ========================================================================= */}
      {activeSubtab === 'laverie' && (
        <div className="dc-laverie-card">
          <div className="dc-laverie-header">
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
                Contrôle & Arbitrage Laverie — Amina
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Filet GBE001 · Recomptage réception & signalement des anomalies
              </div>
            </div>
            <span className="cb-code-badge" style={{ fontSize: '0.85rem' }}>
              SAC-GBE001-01
            </span>
          </div>

          <div className="cb-grid-2col">
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '0.75rem' }}>
                Recomptage Laverie Contradictoire
              </h4>
              <div className="cb-section-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span>Annoncé par Runner Youssef :</span>
                  <strong>16 pièces</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  <span>Recompté par Laverie Amina :</span>
                  <strong>16 pièces</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#15803d', fontWeight: 800 }}>
                  <span>Écart constaté :</span>
                  <span>0 pièce (Conforme)</span>
                </div>
              </div>

              {/* Encadré d'Arbitrage Linge Abîmé */}
              <div className="dc-arbitrage-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: '#c2410c', fontSize: '0.85rem' }}>
                    Signalement Linge Abîmé / Taché
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input 
                      type="checkbox" 
                      id="damageToggle" 
                      checked={damagedFeeApplied}
                      onChange={(e) => setDamagedFeeApplied(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <label htmlFor="damageToggle" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#9a3412' }}>
                      Facturer 10 DH
                    </label>
                  </div>
                </div>

                <input 
                  type="text" 
                  value={damagedNote}
                  onChange={(e) => setDamagedNote(e.target.value)}
                  className="cb-form-input"
                  style={{ marginTop: '0.6rem' }}
                />
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '0.75rem' }}>
                Message Pré-rédigé pour Kawtar (WhatsApp)
              </h4>
              <div className="dc-message-preview">
{`Bonjour Kawtar,

Lors du contrôle du filet GBE001 (Commande ${activeCmd?.numero || 'CMD-2026-0418'}), Amina signale :
• ${damagedNote}
• Montant linge figé : 90 DH

Action recommandée : informer le client Ghali Bensouda.`}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="cb-btn-primary" style={{ flex: 1 }}>
                  ✓ Figer le montant (90 DH)
                </button>
                <button className="cb-btn-secondary">
                  Joindre photo preuve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Assignation Intervenante */}
      {isAssignOpen && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-box">
            <div className="dc-modal-header">
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>
                Assigner l'Intervenante — {selectedCmd?.numero}
              </h3>
              <button onClick={() => setIsAssignOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="dc-modal-body">
                <div className="cb-form-group">
                  <label className="cb-form-label">Intervenante Principale <span className="req">*</span></label>
                  <select
                    value={assignIntervenante}
                    onChange={(e) => setAssignIntervenante(Number(e.target.value))}
                    required
                    className="cb-form-select"
                  >
                    <option value="">Sélectionner une intervenante...</option>
                    {agentsList.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.first_name} {a.last_name} — {a.zone || 'Casablanca'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="cb-form-group">
                  <label className="cb-form-label">Intervenante Secondaire (Optionnelle)</label>
                  <select
                    value={assignIntervenante2}
                    onChange={(e) => setAssignIntervenante2(e.target.value ? Number(e.target.value) : '')}
                    className="cb-form-select"
                  >
                    <option value="">Aucune</option>
                    {agentsList.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.first_name} {a.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="dc-modal-footer">
                <button type="button" onClick={() => setIsAssignOpen(false)} className="cb-btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={assignLoading} className="cb-btn-primary">
                  {assignLoading ? 'Assignation...' : 'Valider l\'assignation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Clôture Photos */}
      {isClotureOpen && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-box">
            <div className="dc-modal-header">
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>
                Clôture avec 4 Photos Obligatoires
              </h3>
              <button onClick={() => setIsClotureOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCloture}>
              <div className="dc-modal-body">
                <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1rem' }}>
                  Conformément au cahier des charges, 4 photos horodatées sont requises : Salon, Chambre(s), SDB, et Cuisine.
                </p>
                {['Photo 1 : Salon / Séjour', 'Photo 2 : Chambre principale & Lits', 'Photo 3 : Salle de bain & Serviettes', 'Photo 4 : Cuisine & Évier'].map((label, idx) => (
                  <div key={idx} className="cb-form-group">
                    <label className="cb-form-label">{label} <span className="req">*</span></label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={photos[idx] || ''}
                      onChange={(e) => {
                        const newP = [...photos];
                        newP[idx] = e.target.value;
                        setPhotos(newP);
                      }}
                      required
                      className="cb-form-input"
                    />
                  </div>
                ))}
              </div>
              <div className="dc-modal-footer">
                <button type="button" onClick={() => setIsClotureOpen(false)} className="cb-btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={clotureLoading} className="cb-btn-primary">
                  {clotureLoading ? 'Validation...' : 'Valider et Clôturer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
