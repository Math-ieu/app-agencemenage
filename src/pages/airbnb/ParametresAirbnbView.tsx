import { useState, useEffect, type FormEvent } from 'react';
import { getAirbnbConfig, updateAirbnbConfig } from '../../api/airbnb';
import type { AirbnbConfig } from '../../types/airbnb';
import { 
  CheckCircle2, Plus, X, Settings, DollarSign, Shirt, Clock, Save, RotateCw
} from 'lucide-react';
import './ParametresAirbnb.css';

export default function ParametresAirbnbView() {
  const [activeTab, setActiveTab] = useState<'tarifs' | 'linge' | 'regles'>('tarifs');
  const [config, setConfig] = useState<AirbnbConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  // New Zone Input
  const [newZone, setNewZone] = useState('');

  useEffect(() => {
    getAirbnbConfig()
      .then((res) => setConfig(res.data))
      .catch((err) => console.error("Erreur chargement paramètres :", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;

    setSaving(true);
    setSavedMessage(false);
    try {
      await updateAirbnbConfig(config.id, config);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3500);
    } catch (err) {
      console.error("Erreur mise à jour configuration :", err);
      alert("Erreur lors de l'enregistrement des paramètres.");
    } finally {
      setSaving(false);
    }
  };

  const addZone = () => {
    if (!newZone.trim() || !config) return;
    const currentList = config.zones_eloignees_list || [];
    if (!currentList.includes(newZone.trim())) {
      setConfig({
        ...config,
        zones_eloignees_list: [...currentList, newZone.trim()]
      });
    }
    setNewZone('');
  };

  const removeZone = (zone: string) => {
    if (!config) return;
    setConfig({
      ...config,
      zones_eloignees_list: (config.zones_eloignees_list || []).filter(z => z !== zone)
    });
  };

  if (loading || !config) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
        <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
        Chargement des paramètres du module Airbnb...
      </div>
    );
  }

  return (
    <div className="pa-container">
      {/* Top Banner */}
      <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={20} color="#0f766e" />
          <div>
            <span style={{ fontWeight: 800, color: '#134e4a', display: 'block' }}>Paramètres Métier Airbnb & Conciergerie</span>
            <span style={{ fontSize: '0.8rem', color: '#0f766e' }}>Tous les forfaits, barèmes linge et heures de cut-off sont administrables en direct.</span>
          </div>
        </div>
        {savedMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', background: '#dcfce7', color: '#15803d', borderRadius: '0.5rem', fontWeight: 800, fontSize: '0.8rem' }}>
            <CheckCircle2 size={16} /> Modifié avec succès !
          </div>
        )}
      </div>

      {/* Subtabs Segmented Control */}
      <div className="pa-subtabs">
        <button
          onClick={() => setActiveTab('tarifs')}
          className={`pa-tab-btn ${activeTab === 'tarifs' ? 'active' : ''}`}
        >
          <DollarSign size={16} />
          <span>Grille Tarifaire & Zones</span>
        </button>

        <button
          onClick={() => setActiveTab('linge')}
          className={`pa-tab-btn ${activeTab === 'linge' ? 'active' : ''}`}
        >
          <Shirt size={16} />
          <span>Chaîne du Linge (8 pcs = 50 DH)</span>
        </button>

        <button
          onClick={() => setActiveTab('regles')}
          className={`pa-tab-btn ${activeTab === 'regles' ? 'active' : ''}`}
        >
          <Clock size={16} />
          <span>Règles Métier & Cut-off</span>
        </button>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {activeTab === 'tarifs' && (
          /* ══════════ GRILLE TARIFAIRE & ZONES ══════════ */
          <>
            <div className="pa-card">
              <div className="pa-card-header">
                Grille Tarifaire par Typologie (Ménage Standard)
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ background: '#f8fafc', padding: '0.875rem 1.25rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Typologie</th>
                      <th style={{ background: '#f8fafc', padding: '0.875rem 1.25rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Effectif Intervenantes</th>
                      <th style={{ background: '#f8fafc', padding: '0.875rem 1.25rem', fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Prix Forfaitaire (DH TTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Studio / 1 Chambre</td>
                      <td style={{ padding: '0.875rem 1.25rem', color: '#64748b' }}>1 intervenante</td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <input
                          type="number"
                          value={config.prix_studio}
                          onChange={(e) => setConfig({ ...config, prix_studio: Number(e.target.value) })}
                          style={{ width: '120px', padding: '0.45rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '0.9rem' }}
                        />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>2 Chambres</td>
                      <td style={{ padding: '0.875rem 1.25rem', color: '#64748b' }}>1 intervenante</td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <input
                          type="number"
                          value={config.prix_2ch}
                          onChange={(e) => setConfig({ ...config, prix_2ch: Number(e.target.value) })}
                          style={{ width: '120px', padding: '0.45rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '0.9rem' }}
                        />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>3 Chambres</td>
                      <td style={{ padding: '0.875rem 1.25rem', color: '#64748b' }}>1 intervenante</td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <input
                          type="number"
                          value={config.prix_3ch}
                          onChange={(e) => setConfig({ ...config, prix_3ch: Number(e.target.value) })}
                          style={{ width: '120px', padding: '0.45rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '0.9rem' }}
                        />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>4 Chambres</td>
                      <td style={{ padding: '0.875rem 1.25rem', color: '#64748b' }}>1 intervenante</td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <input
                          type="number"
                          value={config.prix_4ch}
                          onChange={(e) => setConfig({ ...config, prix_4ch: Number(e.target.value) })}
                          style={{ width: '120px', padding: '0.45rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '0.9rem' }}
                        />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>5 Chambres</td>
                      <td style={{ padding: '0.875rem 1.25rem', color: '#64748b' }}>1 intervenante</td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <input
                          type="number"
                          value={config.prix_5ch}
                          onChange={(e) => setConfig({ ...config, prix_5ch: Number(e.target.value) })}
                          style={{ width: '120px', padding: '0.45rem 0.65rem', borderRadius: '0.375rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '0.9rem' }}
                        />
                      </td>
                    </tr>
                    <tr style={{ background: '#fffbeb' }}>
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700 }}>Villa / Riad</td>
                      <td style={{ padding: '0.875rem 1.25rem', fontWeight: 800, color: '#dc2626' }}>2 intervenantes (Obligatoire)</td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <input
                          type="number"
                          value={config.prix_villa_riad}
                          onChange={(e) => setConfig({ ...config, prix_villa_riad: Number(e.target.value) })}
                          style={{ width: '120px', padding: '0.45rem 0.65rem', borderRadius: '0.375rem', border: '1.5px solid #f59e0b', fontWeight: 800, color: '#00473E', fontSize: '0.9rem', background: '#ffffff' }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Zones Éloignées Card */}
            <div className="pa-card">
              <div className="pa-card-header">
                Zones Éloignées & Suppléments
              </div>
              <div className="pa-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Montant du supplément par intervention (DH)
                  </label>
                  <input
                    type="number"
                    value={config.supplement_zone_eloignee}
                    onChange={(e) => setConfig({ ...config, supplement_zone_eloignee: Number(e.target.value) })}
                    style={{ width: '140px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '0.95rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>
                    Liste des Quartiers & Villes Classés Zone Éloignée
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {(config.zones_eloignees_list || []).map((zone) => (
                      <span key={zone} className="pa-tag-chip">
                        {zone}
                        <X 
                          size={13} 
                          className="pa-tag-remove" 
                          onClick={() => removeZone(zone)}
                        />
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '380px' }}>
                    <input
                      type="text"
                      placeholder="Ajouter une zone (ex: Bouskoura Ville)..."
                      value={newZone}
                      onChange={(e) => setNewZone(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addZone(); } }}
                      style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      onClick={addZone}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', background: '#00473E', color: '#ffffff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'linge' && (
          /* ══════════ CHAÎNE DU LINGE ══════════ */
          <div className="pa-card">
            <div className="pa-card-header">
              Barème de Blanchisserie & Traitement du Linge
            </div>
            <div className="pa-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Prix Forfait Standard (1 à 8 Pièces)
                </label>
                <input
                  type="number"
                  value={config.prix_set_linge_standard}
                  onChange={(e) => setConfig({ ...config, prix_set_linge_standard: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '1rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Tarif plancher : 50 DH</span>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Prix Pièce Supplémentaire
                </label>
                <input
                  type="number"
                  value={config.prix_piece_supp_linge}
                  onChange={(e) => setConfig({ ...config, prix_piece_supp_linge: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '1rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Au-delà de 8 pièces (5 DH/pièce)</span>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Forfait Minimum Garanti
                </label>
                <input
                  type="number"
                  value={config.forfait_min_linge}
                  onChange={(e) => setConfig({ ...config, forfait_min_linge: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#00473E', fontSize: '1rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Montant garanti par sac</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'regles' && (
          /* ══════════ RÈGLES MÉTIER & CUT-OFF ══════════ */
          <div className="pa-card">
            <div className="pa-card-header">
              Délais Réglementaires de Cut-Off (J-1)
            </div>
            <div className="pa-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Cut-Off Prestation Matin (J-1)
                </label>
                <input
                  type="text"
                  value={config.cutoff_matin}
                  onChange={(e) => setConfig({ ...config, cutoff_matin: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '1rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Heure limite de saisie la veille (21:00)</span>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                  Cut-Off Prestation Après-Midi (J-1)
                </label>
                <input
                  type="text"
                  value={config.cutoff_apres_midi}
                  onChange={(e) => setConfig({ ...config, cutoff_apres_midi: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '1rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginTop: '4px' }}>Heure limite de saisie la veille (22:00)</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="submit"
            disabled={saving}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', background: '#00473E', color: '#ffffff', borderRadius: '0.625rem', fontWeight: 800, fontSize: '0.9rem', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0, 71, 62, 0.25)' }}
          >
            <Save size={16} />
            {saving ? 'Enregistrement en cours...' : 'Enregistrer les Modifications'}
          </button>
        </div>
      </form>
    </div>
  );
}
