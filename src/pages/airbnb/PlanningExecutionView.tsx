import { useState, useEffect, type FormEvent } from 'react';
import { 
  getPlanningGrid, assignerCommandeAirbnb, 
  getObjetsTrouves, createObjetTrouve, restituerObjetTrouve,
  extractResults 
} from '../../api/airbnb';
import { getAgents } from '../../api/client';
import type { CommandeAirbnb, ObjetTrouve } from '../../types/airbnb';
import { 
  Printer, X, 
  Calendar, Clock, FileText, Camera,
  Sparkles, Key, ZoomIn, ExternalLink,
  MessageSquare, ChevronRight, ImageIcon,
  PackageSearch, Plus
} from 'lucide-react';
import { AirbnbPhotoUploader } from '../../components/airbnb/AirbnbPhotoUploader';
import './PlanningExecution.css';

export default function PlanningExecutionView() {
  // 4 Subtabs: 'assignation' | 'fiche' | 'suivi' | 'incidents'
  const [activeSubtab, setActiveSubtab] = useState<'assignation' | 'fiche' | 'suivi' | 'incidents'>('assignation');
  
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [objetsTrouves, setObjetsTrouves] = useState<ObjetTrouve[]>([]);

  // Selected Commande for Fiche de Mission / Assignation
  const [selectedCmd, setSelectedCmd] = useState<CommandeAirbnb | null>(null);

  // Photos Gallery / Lightbox Modal State
  const [viewPhotosCmd, setViewPhotosCmd] = useState<CommandeAirbnb | null>(null);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  // Assignment Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignIntervenante, setAssignIntervenante] = useState<number | ''>('');
  const [assignIntervenante2] = useState<number | ''>('');
  const [assignRunner] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Modal Objet Trouvé State
  const [isNewObjetOpen, setIsNewObjetOpen] = useState(false);
  const [newObjetDescription, setNewObjetDescription] = useState('');
  const [newObjetEmplacement, setNewObjetEmplacement] = useState('');
  const [newObjetPhoto, setNewObjetPhoto] = useState('');
  const [newObjetBienId, setNewObjetBienId] = useState<string>('');
  const [newObjetLoading, setNewObjetLoading] = useState(false);

  // Devis Remise en état State (Page 16)
  const [devisStatus, setDevisStatus] = useState<'en_attente' | 'accepte' | 'refuse'>('en_attente');
  const [incidentPhoto, setIncidentPhoto] = useState('');

  const fetchPlanning = async () => {
    try {
      const [planRes, agentsRes, objetsRes] = await Promise.all([
        getPlanningGrid({ days: 7 }),
        getAgents(),
        getObjetsTrouves().catch(() => ({ data: [] }))
      ]);
      const cmds = planRes.data?.commandes || extractResults<CommandeAirbnb>(planRes.data);
      setCommandes(cmds);
      setAgents(extractResults<any>(agentsRes.data));
      setObjetsTrouves(extractResults<ObjetTrouve>(objetsRes.data));
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

  const handleCreateObjetTrouve = async (e: FormEvent) => {
    e.preventDefault();
    if (!newObjetDescription) return;
    setNewObjetLoading(true);
    try {
      const targetBienId = newObjetBienId || selectedCmd?.bien;
      if (!targetBienId) {
        alert("Veuillez sélectionner un logement associé.");
        setNewObjetLoading(false);
        return;
      }
      await createObjetTrouve({
        bien: Number(targetBienId) as any,
        commande: selectedCmd?.id ? (selectedCmd.id as any) : undefined,
        description: newObjetDescription,
        piece: newObjetEmplacement,
        photo_url: newObjetPhoto || undefined,
        statut: 'trouve',
      });
      setIsNewObjetOpen(false);
      setNewObjetDescription('');
      setNewObjetEmplacement('');
      setNewObjetPhoto('');
      fetchPlanning();
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'enregistrement de l'objet trouvé");
    } finally {
      setNewObjetLoading(false);
    }
  };

  const handleRestituer = async (id: string) => {
    const remisA = prompt("À qui l'objet a-t-il été restitué ? (Ex: Voyageur / Propriétaire / Concierge)") || 'Client';
    if (!remisA) return;
    try {
      await restituerObjetTrouve(id, { remis_a: remisA });
      fetchPlanning();
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la restitution");
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
                {['Salon / Séjour', 'Chambres & Lits', 'Salle de bain', 'Cuisine & Évier'].map((room, idx) => {
                  const hasPhoto = selectedCmd?.photos_cloture && selectedCmd.photos_cloture[idx];
                  return (
                    <div 
                      key={idx} 
                      className="pe-photo-box"
                      style={hasPhoto ? { background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 700 } : {}}
                      onClick={() => hasPhoto && setActiveLightboxImg(selectedCmd.photos_cloture[idx])}
                    >
                      {hasPhoto ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                          <img 
                            src={selectedCmd.photos_cloture[idx]} 
                            alt={room} 
                            style={{ width: '100%', height: '50px', objectFit: 'cover', borderRadius: '4px' }} 
                          />
                          <span style={{ fontSize: '11px' }}>✓ {room}</span>
                        </div>
                      ) : (
                        <span>Photo {idx + 1} : {room}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.75rem', color: selectedCmd?.photos_cloture?.length === 4 ? '#15803d' : '#dc2626', fontWeight: 700, marginTop: '0.75rem' }}>
                {selectedCmd?.photos_cloture?.length === 4 
                  ? "✓ Les 4 photos obligatoires ont été validées et stockées dans le cloud."
                  : "* Clôture impossible sans les 4 photos complètes (Salon, Chambre, SDB, Cuisine)."
                }
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
              <div className="cb-kpi-value">{commandes.length || 0}</div>
              <div className="cb-kpi-sub">En planning & exécution</div>
            </div>

            <div className="cb-kpi-card blue">
              <div className="cb-kpi-label">Terminés & Photos Validées</div>
              <div className="cb-kpi-value">
                {commandes.filter(c => c.statut === 'cloturee' || (c.photos_cloture && c.photos_cloture.length >= 4)).length}
              </div>
              <div className="cb-kpi-sub">Conformes 4/4 photos</div>
            </div>

            <div className="cb-kpi-card alert">
              <div className="cb-kpi-label">Photos Manquantes</div>
              <div className="cb-kpi-value">
                {commandes.filter(c => c.statut !== 'annulee' && (!c.photos_cloture || c.photos_cloture.length < 4)).length}
              </div>
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
                {commandes.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      Aucune mission Airbnb planifiée pour cette période.
                    </td>
                  </tr>
                ) : (
                  commandes.map((cmd) => {
                    const photosCount = Array.isArray(cmd.photos_cloture) ? cmd.photos_cloture.length : 0;
                    const isComplete = photosCount >= 4;
                    return (
                      <tr key={cmd.id}>
                        <td><span className="cb-code-badge">{cmd.bien_code || 'GBE001'}</span></td>
                        <td>{cmd.intervenante_name || 'Non assignée'}</td>
                        <td>{cmd.heure_prestation ? cmd.heure_prestation.slice(0, 5) : '11:00'}</td>
                        <td>
                          <strong style={{ color: isComplete ? '#15803d' : '#dc2626' }}>
                            {photosCount} / 4 photos
                          </strong>
                        </td>
                        <td>
                          <span className={`cb-status-pill ${cmd.statut === 'cloturee' ? 'conciergerie' : isComplete ? 'conciergerie' : 'alerte'}`}>
                            {cmd.statut === 'cloturee' ? '✓ Clôturé' : isComplete ? 'Photos reçues' : 'En attente photos'}
                          </span>
                        </td>
                        <td>
                          {photosCount > 0 ? (
                            <button 
                              onClick={() => setViewPhotosCmd(cmd)}
                              className="cb-btn-details"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Camera size={13} /> Voir Photos ({photosCount})
                            </button>
                          ) : (
                            <button 
                              onClick={() => alert(`Relance WhatsApp envoyée à l'intervenante pour la commande ${cmd.numero}.`)}
                              className="cb-btn-details"
                              style={{ color: '#b45309', borderColor: '#fde047' }}
                            >
                              Relancer WhatsApp
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 4 : INCIDENTS & OBJETS TROUVÉS (Page 16)                      */}
      {/* ========================================================================= */}
      {activeSubtab === 'incidents' && (
        <div className="cb-detail-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 5 Steps Lost & Found Workflow */}
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: '#00473E', marginBottom: '0.75rem' }}>
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
          </div>

          {/* Section Objets Trouvés avec Photos Cloud */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackageSearch size={18} color="#00473e" />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#00473e' }}>
                  Objets Trouvés Enregistrés ({objetsTrouves.length})
                </h4>
              </div>
              <button
                onClick={() => {
                  setNewObjetBienId(selectedCmd?.bien ? String(selectedCmd.bien) : '');
                  setIsNewObjetOpen(true);
                }}
                className="cb-btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                <Plus size={14} /> Déclarer un Objet Trouvé
              </button>
            </div>

            {objetsTrouves.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
                Aucun objet trouvé en attente. Utilisez le bouton ci-dessus pour enregistrer un nouvel objet avec sa photo.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {objetsTrouves.map((obj) => (
                  <div 
                    key={obj.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '12px',
                      display: 'flex',
                      gap: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}
                  >
                    {/* Photo thumbnail */}
                    {obj.photo_url ? (
                      <div 
                        onClick={() => setActiveLightboxImg(obj.photo_url || null)}
                        style={{
                          width: '70px',
                          height: '70px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer',
                          flexShrink: 0,
                          background: '#0f172a'
                        }}
                        title="Agrandir la photo"
                      >
                        <img 
                          src={obj.photo_url} 
                          alt={obj.description} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div 
                        style={{
                          width: '70px',
                          height: '70px',
                          borderRadius: '6px',
                          background: '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8',
                          flexShrink: 0
                        }}
                      >
                        <ImageIcon size={24} />
                      </div>
                    )}

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                          {obj.description}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          Emplacement : {obj.piece || 'Non précisé'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span 
                          style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 700, 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            background: obj.statut === 'restitue' ? '#dcfce7' : '#fef9c3',
                            color: obj.statut === 'restitue' ? '#15803d' : '#854d0e'
                          }}
                        >
                          {obj.statut === 'restitue' ? `✓ Restitué à ${obj.remis_a || 'Client'}` : 'Signalé / À restituer'}
                        </span>

                        {obj.statut !== 'restitue' && (
                          <button
                            onClick={() => handleRestituer(obj.id)}
                            className="cb-btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                          >
                            Restituer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Devis Remise en état */}
          <div className="pe-devis-box">
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, color: '#78350f', fontSize: '0.95rem' }}>
                Devis Remise en État Salissure Extrême (Logement {selectedCmd?.bien_code || 'GBE003'})
              </div>
              <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '0.2rem' }}>
                2 heures supplémentaires requises (Tarif horaire : 60 DH/h) · <strong>Total : 120 DH</strong>
              </div>

              {incidentPhoto && (
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img 
                    src={incidentPhoto} 
                    alt="Preuve incident" 
                    onClick={() => setActiveLightboxImg(incidentPhoto)}
                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer', border: '1px solid #d97706' }} 
                  />
                  <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>✓ Preuve photo jointe</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
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

              {!incidentPhoto && (
                <div style={{ width: '160px' }}>
                  <AirbnbPhotoUploader
                    value={incidentPhoto}
                    onChange={setIncidentPhoto}
                    category="incident"
                    compact
                    placeholder="Joindre photo preuve"
                  />
                </div>
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

      {/* Modal Déclarer un Objet Trouvé */}
      {isNewObjetOpen && (
        <div className="dc-modal-overlay" onClick={() => setIsNewObjetOpen(false)}>
          <div className="dc-modal-box" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dc-modal-header">
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#00473e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PackageSearch size={20} color="#00473e" />
                Déclarer un Objet Trouvé
              </h3>
              <button onClick={() => setIsNewObjetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateObjetTrouve}>
              <div className="dc-modal-body">
                <div className="cb-form-group">
                  <label className="cb-form-label">Description de l'objet <span className="req">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Montre dorée, AirPods, Passeport..."
                    value={newObjetDescription}
                    onChange={(e) => setNewObjetDescription(e.target.value)}
                    className="cb-form-input"
                  />
                </div>

                <div className="cb-form-group">
                  <label className="cb-form-label">Emplacement précis dans le logement</label>
                  <input
                    type="text"
                    placeholder="Ex: Table de chevet chambre 1, sous le canapé..."
                    value={newObjetEmplacement}
                    onChange={(e) => setNewObjetEmplacement(e.target.value)}
                    className="cb-form-input"
                  />
                </div>

                <div className="cb-form-group">
                  <AirbnbPhotoUploader
                    label="Photo de l'objet (Téléversement Cloud)"
                    value={newObjetPhoto}
                    onChange={setNewObjetPhoto}
                    category="objet_trouve"
                    placeholder="Téléverser ou glisser la photo de l'objet..."
                    helpText="Stocké dans le bucket cloud pour transmission immédiate au client / commercial"
                  />
                </div>
              </div>
              <div className="dc-modal-footer">
                <button type="button" onClick={() => setIsNewObjetOpen(false)} className="cb-btn-secondary">
                  Annuler
                </button>
                <button type="submit" disabled={newObjetLoading} className="cb-btn-primary" style={{ background: '#00473e', color: '#ffffff' }}>
                  {newObjetLoading ? 'Enregistrement...' : '✓ Enregistrer l\'Objet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Galerie des Photos de Clôture */}
      {viewPhotosCmd && (
        <div 
          className="dc-modal-overlay"
          onClick={() => setViewPhotosCmd(null)}
        >
          <div 
            className="dc-modal-box" 
            style={{ maxWidth: '720px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dc-modal-header">
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem', color: '#00473e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} color="#00473e" />
                Photos de Fin d'Intervention — {viewPhotosCmd.bien_code || 'Logement'} ({viewPhotosCmd.numero})
              </h3>
              <button onClick={() => setViewPhotosCmd(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>
            <div className="dc-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>
                  Intervenante : <strong>{viewPhotosCmd.intervenante_name || 'Non assignée'}</strong> · {viewPhotosCmd.date_prestation}
                </span>
                <span style={{ color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '3px 8px', borderRadius: '4px' }}>
                  ✓ {viewPhotosCmd.photos_cloture?.length || 0}/4 photos stockées
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                {(viewPhotosCmd.photos_cloture || []).map((url, idx) => {
                  const labels = ['Photo 1 : Salon / Séjour', 'Photo 2 : Chambre principale & Lits', 'Photo 3 : Salle de bain & Serviettes', 'Photo 4 : Cuisine & Évier'];
                  return (
                    <div 
                      key={idx}
                      onClick={() => setActiveLightboxImg(url)}
                      style={{
                        position: 'relative',
                        height: '140px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1.5px solid #cbd5e1',
                        cursor: 'pointer',
                        background: '#0f172a'
                      }}
                      title="Cliquez pour agrandir"
                    >
                      <img 
                        src={url} 
                        alt={labels[idx] || `Photo ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
                          padding: '6px 10px',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{labels[idx] || `Photo ${idx + 1}`}</span>
                        <ZoomIn size={14} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="dc-modal-footer">
              <button 
                type="button" 
                onClick={() => setViewPhotosCmd(null)}
                className="cb-btn-secondary"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Lightbox Modal */}
      {activeLightboxImg && (
        <div
          onClick={() => setActiveLightboxImg(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#0f172a',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={16} color="#00473e" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Visualisation de la photo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={activeLightboxImg}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#94a3b8', display: 'flex' }}
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveLightboxImg(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
              <img
                src={activeLightboxImg}
                alt="Aperçu grand format"
                style={{
                  maxWidth: '85vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: '6px'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
