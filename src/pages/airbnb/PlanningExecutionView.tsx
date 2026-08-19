import { useState, useEffect, type FormEvent } from 'react';
import { 
  getPlanningGrid, assignerCommandeAirbnb, extractResults 
} from '../../api/airbnb';
import { getAgents } from '../../api/client';
import type { CommandeAirbnb } from '../../types/airbnb';
import { 
  Printer, X, 
  Calendar, Clock, FileText, Camera,
  Sparkles, Key,
  MessageSquare, ChevronRight
} from 'lucide-react';
import './PlanningExecution.css';

export default function PlanningExecutionView() {
  // 4 Subtabs: 'assignation' | 'fiche' | 'suivi' | 'incidents'
  const [activeSubtab, setActiveSubtab] = useState<'assignation' | 'fiche' | 'suivi' | 'incidents'>('assignation');
  
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  // Selected Commande for Fiche de Mission / Assignation
  const [selectedCmd, setSelectedCmd] = useState<CommandeAirbnb | null>(null);

  // Assignment Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignIntervenante, setAssignIntervenante] = useState<number | ''>('');
  const [assignIntervenante2] = useState<number | ''>('');
  const [assignRunner] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Devis Remise en état State (Page 16)
  const [devisStatus, setDevisStatus] = useState<'en_attente' | 'accepte' | 'refuse'>('en_attente');

  const fetchPlanning = async () => {
    try {
      const [planRes, agentsRes] = await Promise.all([
        getPlanningGrid({ days: 7 }),
        getAgents()
      ]);
      const cmds = planRes.data?.commandes || extractResults<CommandeAirbnb>(planRes.data);
      setCommandes(cmds);
      setAgents(extractResults<any>(agentsRes.data));
      if (cmds.length > 0 && !selectedCmd) {
        setSelectedCmd(cmds[0]);
      }
    } catch (err) {
      console.error("Erreur chargement planning :", err);
    }
  };

  useEffect(() => {
    fetchPlanning();
  }, []);

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
      fetchPlanning();
      alert("Intervenante(s) assignée(s) avec succès.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'assignation");
    } finally {
      setAssignLoading(false);
    }
  };

  const activeMission = selectedCmd || commandes[0];

  return (
    <div className="pe-container">
      {/* Subtabs Segmented Bar */}
      <div className="pe-subtabs">
        <button
          className={`pe-tab-btn ${activeSubtab === 'assignation' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('assignation')}
        >
          <Calendar size={16} />
          <span>Assignation — J-1</span>
        </button>

        <button
          className={`pe-tab-btn ${activeSubtab === 'fiche' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('fiche')}
        >
          <FileText size={16} />
          <span>Fiche de mission (Sans prix)</span>
        </button>

        <button
          className={`pe-tab-btn ${activeSubtab === 'suivi' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('suivi')}
        >
          <Clock size={16} />
          <span>Suivi du jour (Photos 4/4)</span>
        </button>

        <button
          className={`pe-tab-btn ${activeSubtab === 'incidents' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('incidents')}
        >
          <Sparkles size={16} />
          <span>Incidents & Objets trouvés</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 1 : ASSIGNATION J-1 (Page 13)                                 */}
      {/* ========================================================================= */}
      {activeSubtab === 'assignation' && (
        <>
          {/* 5 KPIs Assignation J-1 */}
          <div className="cb-kpi-grid">
            <div className="cb-kpi-card gold">
              <div className="cb-kpi-label">Interventions Demain</div>
              <div className="cb-kpi-value">{commandes.length || 8}</div>
              <div className="cb-kpi-sub">Total missions planifiées</div>
            </div>

            <div className="cb-kpi-card">
              <div className="cb-kpi-label">Turnovers Airbnb</div>
              <div className="cb-kpi-value">{commandes.length || 6}</div>
              <div className="cb-kpi-sub">Rotations check-out</div>
            </div>

            <div className="cb-kpi-card alert">
              <div className="cb-kpi-label">Sans Intervenante</div>
              <div className="cb-kpi-value">
                {commandes.filter(c => !c.intervenante).length || 2}
              </div>
              <div className="cb-kpi-sub">À assigner avant 18h00</div>
            </div>

            <div className="cb-kpi-card blue">
              <div className="cb-kpi-label">Mobilisées</div>
              <div className="cb-kpi-value">7</div>
              <div className="cb-kpi-sub">Intervenantes disponibles</div>
            </div>

            <div className="cb-kpi-card purple">
              <div className="cb-kpi-label">Continuité Client</div>
              <div className="cb-kpi-value">78%</div>
              <div className="cb-kpi-sub">Même intervenante habituelle</div>
            </div>
          </div>

          {/* Tableau des Besoins du Lendemain */}
          <div className="cb-table-card">
            <table className="cb-table">
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Logement</th>
                  <th>Quartier</th>
                  <th>Typologie</th>
                  <th>Origine</th>
                  <th>Intervenante Assignée</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map(cmd => (
                  <tr key={cmd.id}>
                    <td><strong>{cmd.heure_prestation || '11:00'}</strong></td>
                    <td><span className="cb-code-badge">{cmd.bien_code}</span></td>
                    <td>{(cmd as any).quartier || 'Gauthier'}</td>
                    <td><span className="cb-tag-typology">{(cmd as any).typologie || '2ch'}</span></td>
                    <td><span className="cb-tag-standard">Airbnb</span></td>
                    <td>
                      {cmd.intervenante_name ? (
                        <span style={{ color: '#15803d', fontWeight: 700 }}>
                          ✓ {cmd.intervenante_name}
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>
                          Non assignée
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setSelectedCmd(cmd);
                          setIsAssignOpen(true);
                        }}
                        className="cb-btn-details"
                      >
                        Assigner
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Assistant Intelligent & Bouton Envoi WhatsApp */}
          <div className="cb-detail-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#00473E', fontSize: '1rem' }}>
                  Envoi Automatisé des Fiches de Mission à 20h00
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Les consignes d'accès sensibles et checklists photos seront transmises par WhatsApp aux intervenantes assignées.
                </div>
              </div>
              <button 
                onClick={() => alert("✓ Fiches de mission envoyées par WhatsApp aux intervenantes.")}
                className="cb-btn-primary"
              >
                <MessageSquare size={16} />
                <span>Envoyer les fiches de mission</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 2 : FICHE DE MISSION STRICTEMENT SANS PRIX (Page 14)          */}
      {/* ========================================================================= */}
      {activeSubtab === 'fiche' && (
        <div className="pe-mission-printable">
          {/* Header Fiche sans prix */}
          <div className="pe-mission-head-banner">
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ccfbf1' }}>
                Fiche de Mission Opérationnelle
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0', color: '#ffffff' }}>
                {activeMission?.bien_code || 'GBE001'} — {activeMission?.heure_prestation || '11:00'}
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#ccfbf1' }}>
                Intervenante : {activeMission?.intervenante_name || 'Fatima ZAHRA'} · Date : {activeMission?.date_prestation || 'Demain'}
              </div>
            </div>

            <button 
              onClick={() => window.print()}
              className="cb-btn-secondary"
              style={{ background: '#ffffff', color: '#00473E' }}
            >
              <Printer size={16} />
              <span>Imprimer / PDF</span>
            </button>
          </div>

          {/* Modalités d'accès complètes */}
          <div className="cb-sensitive-callout">
            <div className="cb-sensitive-callout-header">
              <Key size={16} />
              <span>Accès & Digicodes Sensibles (Strictement Confidentiel)</span>
            </div>
            <div className="cb-sensitive-callout-body">
              <div><strong>Adresse :</strong> Rue Jean Jaurès, Résidence Al Manar, Étage 3, Porte 32, Casablanca</div>
              <div style={{ marginTop: '0.35rem' }}><strong>Boîte à clés :</strong> Code 4512 à droite de la porte palière</div>
              <div style={{ marginTop: '0.35rem' }}><strong>Gardien :</strong> Hassan (06 12 34 56 78) présent de 08h à 20h</div>
            </div>
          </div>

          {/* Consignes Métier & Lits */}
          <div className="cb-grid-2col">
            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <FileText size={16} />
                <span>Tâches & Préparation des Couchages</span>
              </div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
                <li>Installer le set propre 8 pièces déposé par le runner.</li>
                <li>Faire le lit façon hôtel (oreillers debout, rabat soigné).</li>
                <li>Dresser 2 grandes serviettes pliées sur le lit et 2 petites dans la SDB.</li>
                <li>Placer le pack réassort d'accueil sur la table basse du salon.</li>
              </ul>
            </div>

            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <Camera size={16} />
                <span>Contrôle Qualité : 4 Photos Obligatoires</span>
              </div>
              <div className="pe-photos-checklist-grid">
                <div className="pe-photo-box">Photo 1 : Salon</div>
                <div className="pe-photo-box">Photo 2 : Chambres</div>
                <div className="pe-photo-box">Photo 3 : SDB</div>
                <div className="pe-photo-box">Photo 4 : Cuisine</div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '0.75rem' }}>
                * Clôture impossible sans les 4 photos complètes.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 3 : SUIVI DU JOUR & PHOTOS 4/4 (Page 15)                      */}
      {/* ========================================================================= */}
      {activeSubtab === 'suivi' && (
        <>
          <div className="cb-kpi-grid">
            <div className="cb-kpi-card gold">
              <div className="cb-kpi-label">Turnovers du Jour</div>
              <div className="cb-kpi-value">6</div>
              <div className="cb-kpi-sub">En cours d'exécution</div>
            </div>

            <div className="cb-kpi-card blue">
              <div className="cb-kpi-label">Terminés & Photos Validées</div>
              <div className="cb-kpi-value">4</div>
              <div className="cb-kpi-sub">Conformes 4/4 photos</div>
            </div>

            <div className="cb-kpi-card alert">
              <div className="cb-kpi-label">Photos Manquantes</div>
              <div className="cb-kpi-value">2</div>
              <div className="cb-kpi-sub">Relance automatique active</div>
            </div>
          </div>

          {/* Tableau de Contrôle en Direct */}
          <div className="cb-table-card">
            <table className="cb-table">
              <thead>
                <tr>
                  <th>Logement</th>
                  <th>Intervenante</th>
                  <th>Heure</th>
                  <th>Photos Reçues</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="cb-code-badge">GBE001</span></td>
                  <td>Fatima ZAHRA</td>
                  <td>11:00</td>
                  <td><strong style={{ color: '#15803d' }}>4 / 4 photos</strong></td>
                  <td><span className="cb-status-pill conciergerie">✓ Clôturé</span></td>
                  <td>
                    <button className="cb-btn-details">Voir Photos</button>
                  </td>
                </tr>
                <tr>
                  <td><span className="cb-code-badge">GBE002</span></td>
                  <td>Khadija MANSOURI</td>
                  <td>13:30</td>
                  <td><strong style={{ color: '#dc2626' }}>2 / 4 photos</strong></td>
                  <td><span className="cb-status-pill alerte">Photos manquantes</span></td>
                  <td>
                    <button 
                      onClick={() => alert("Relance WhatsApp envoyée à l'intervenante.")}
                      className="cb-btn-details"
                    >
                      Relancer WhatsApp
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 4 : INCIDENTS & OBJETS TROUVÉS (Page 16)                      */}
      {/* ========================================================================= */}
      {activeSubtab === 'incidents' && (
        <div className="cb-detail-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 5 Steps Lost & Found Workflow */}
          <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#00473E' }}>
            Circuit de Traitement des Objets Trouvés (5 Étapes)
          </div>

          <div className="pe-steps-workflow">
            <div className="pe-step-pill active">1. Signalement Intervenante</div>
            <ChevronRight size={14} />
            <div className="pe-step-pill active">2. Chargée d'opérations</div>
            <ChevronRight size={14} />
            <div className="pe-step-pill active">3. Notif. Commercial</div>
            <ChevronRight size={14} />
            <div className="pe-step-pill">4. Accord Client</div>
            <ChevronRight size={14} />
            <div className="pe-step-pill">5. Restitution / Clôture</div>
          </div>

          {/* Devis Remise en état */}
          <div className="pe-devis-box">
            <div>
              <div style={{ fontWeight: 800, color: '#78350f', fontSize: '0.95rem' }}>
                Devis Remise en État Salissure Extrême (Logement GBE003)
              </div>
              <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.2rem' }}>
                2 heures supplémentaires requises (Tarif horaire : 60 DH/h) · <strong>Total : 120 DH</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {devisStatus === 'en_attente' ? (
                <>
                  <button 
                    onClick={() => setDevisStatus('accepte')}
                    className="cb-btn-primary" 
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    ✓ Accord Reçu Client
                  </button>
                  <button 
                    onClick={() => setDevisStatus('refuse')}
                    className="cb-btn-secondary" 
                    style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    Refus Client
                  </button>
                </>
              ) : (
                <span style={{ fontWeight: 800, color: devisStatus === 'accepte' ? '#15803d' : '#dc2626', fontSize: '0.85rem' }}>
                  {devisStatus === 'accepte' ? '✓ Accord client enregistré' : 'Refus enregistré'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Assignation */}
      {isAssignOpen && (
        <div className="dc-modal-overlay">
          <div className="dc-modal-box">
            <div className="dc-modal-header">
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>
                Assigner l'Intervenante — {selectedCmd?.bien_code}
              </h3>
              <button onClick={() => setIsAssignOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="dc-modal-body">
                <div className="cb-form-group">
                  <label className="cb-form-label">Intervenante <span className="req">*</span></label>
                  <select
                    value={assignIntervenante}
                    onChange={(e) => setAssignIntervenante(Number(e.target.value))}
                    required
                    className="cb-form-select"
                  >
                    <option value="">Sélectionner une intervenante...</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.first_name} {a.last_name} ({a.zone || 'Casablanca'})
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
                  {assignLoading ? 'Assignation...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
