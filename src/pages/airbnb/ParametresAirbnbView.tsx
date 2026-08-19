import { useState, useEffect, type FormEvent } from 'react';
import { getAirbnbConfig, updateAirbnbConfig } from '../../api/airbnb';
import type { AirbnbConfig } from '../../types/airbnb';
import { 
  CheckCircle2, Plus, X, DollarSign, Shirt, Clock, Save, RotateCw, Sparkles,
  Lock, BedDouble
} from 'lucide-react';
import './ParametresAirbnb.css';

export default function ParametresAirbnbView() {
  // 4 Subtabs: 'tarifs' | 'options' | 'linge' | 'regles'
  const [activeTab, setActiveTab] = useState<'tarifs' | 'options' | 'linge' | 'regles'>('tarifs');
  
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
      {/* Subtabs Segmented Bar */}
      <div className="pa-subtabs">
        <button
          onClick={() => setActiveTab('tarifs')}
          className={`pa-tab-btn ${activeTab === 'tarifs' ? 'active' : ''}`}
        >
          <DollarSign size={16} />
          <span>Grille & Zones</span>
        </button>

        <button
          onClick={() => setActiveTab('options')}
          className={`pa-tab-btn ${activeTab === 'options' ? 'active' : ''}`}
        >
          <Sparkles size={16} />
          <span>Options & Photos</span>
        </button>

        <button
          onClick={() => setActiveTab('linge')}
          className={`pa-tab-btn ${activeTab === 'linge' ? 'active' : ''}`}
        >
          <Shirt size={16} />
          <span>Linge</span>
        </button>

        <button
          onClick={() => setActiveTab('regles')}
          className={`pa-tab-btn ${activeTab === 'regles' ? 'active' : ''}`}
        >
          <Clock size={16} />
          <span>Règles Métier</span>
        </button>
      </div>

      {savedMessage && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1.25rem', background: '#dcfce7', color: '#15803d', borderRadius: '0.75rem', fontWeight: 800, fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} /> Modifications enregistrées avec succès en base de données !
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 1 : GRILLE TARIFAIRE & ZONES (Page 25)                         */}
      {/* ========================================================================= */}
      {activeTab === 'tarifs' && (
        <form onSubmit={handleSave} className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
              Grille Tarifaire Ménage Turnover par Typologie
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Tarifs contractuels de base (MAD TTC) appliqués automatiquement aux devis et factures
            </div>
          </div>

          <div className="cb-grid-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div className="cb-form-group">
              <label className="cb-form-label">Studio / 1 Chambre</label>
              <input
                type="number"
                value={config.prix_studio}
                onChange={(e) => setConfig({ ...config, prix_studio: parseFloat(e.target.value) || 0 })}
                className="cb-form-input"
              />
            </div>

            <div className="cb-form-group">
              <label className="cb-form-label">2 Chambres</label>
              <input
                type="number"
                value={config.prix_2ch}
                onChange={(e) => setConfig({ ...config, prix_2ch: parseFloat(e.target.value) || 0 })}
                className="cb-form-input"
              />
            </div>

            <div className="cb-form-group">
              <label className="cb-form-label">3 Chambres</label>
              <input
                type="number"
                value={config.prix_3ch}
                onChange={(e) => setConfig({ ...config, prix_3ch: parseFloat(e.target.value) || 0 })}
                className="cb-form-input"
              />
            </div>

            <div className="cb-form-group">
              <label className="cb-form-label">4 Chambres</label>
              <input
                type="number"
                value={config.prix_4ch}
                onChange={(e) => setConfig({ ...config, prix_4ch: parseFloat(e.target.value) || 0 })}
                className="cb-form-input"
              />
            </div>

            <div className="cb-form-group">
              <label className="cb-form-label">5 Chambres</label>
              <input
                type="number"
                value={config.prix_5ch}
                onChange={(e) => setConfig({ ...config, prix_5ch: parseFloat(e.target.value) || 0 })}
                className="cb-form-input"
              />
            </div>

            <div className="cb-form-group">
              <label className="cb-form-label">Villa / Riad (2 intervenantes)</label>
              <input
                type="number"
                value={config.prix_villa_riad}
                onChange={(e) => setConfig({ ...config, prix_villa_riad: parseFloat(e.target.value) || 0 })}
                className="cb-form-input"
              />
            </div>
          </div>

          {/* Zones Éloignées Liste Fermée */}
          <div className="cb-section-box">
            <div className="cb-section-box-title">
              <span>Zones Éloignées (+50 DH Automatique)</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
              Tout logement situé dans l'un de ces quartiers verra le supplément de {config.supplement_zone_eloignee} DH automatiquement facturé.
            </p>

            <div className="pa-zones-list">
              {(config.zones_eloignees_list || ['Bouskoura', 'Dar Bouazza', 'Mohammedia', 'Ville Verte', 'Mansouria', 'Sidi Rahal', 'Almaz']).map(z => (
                <span key={z} className="pa-zone-tag">
                  {z}
                  <button type="button" onClick={() => removeZone(z)} className="pa-zone-remove">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', maxWidth: '400px' }}>
              <input
                type="text"
                placeholder="Ajouter une zone (ex: Nouaceur)..."
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                className="cb-form-input"
              />
              <button type="button" onClick={addZone} className="cb-btn-secondary">
                <Plus size={16} /> Ajouter
              </button>
            </div>
          </div>

          <button type="submit" disabled={saving} className="cb-btn-primary" style={{ width: 'fit-content' }}>
            <Save size={16} />
            <span>{saving ? 'Enregistrement...' : 'Enregistrer la Grille'}</span>
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 2 : OPTIONS & PHOTOS (Page 26)                                */}
      {/* ========================================================================= */}
      {activeTab === 'options' && (
        <div className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
              Options Complémentaires & Checklist Qualité Photos
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Barème des packs réassort et conditions strictes de clôture
            </div>
          </div>

          <div className="cb-section-box">
            <div className="cb-section-box-title">
              <span>Catalogue des Packs Réassort</span>
            </div>
            <table className="cb-table">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Description</th>
                  <th>Prix Public</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Réassort Essentiel</strong></td>
                  <td>Gel douche, shampoing, savon, papier toilette</td>
                  <td><strong style={{ color: '#00473E' }}>49 DH</strong></td>
                </tr>
                <tr>
                  <td><strong>Réassort Confort</strong></td>
                  <td>Pack Essentiel + café 6 capsules, thé, sucre, éponge neuve</td>
                  <td><strong style={{ color: '#00473E' }}>79 DH</strong></td>
                </tr>
                <tr>
                  <td><strong>Vidéo avant / après</strong></td>
                  <td>Vidéo panoramique horodatée de l'état des lieux</td>
                  <td><strong style={{ color: '#00473E' }}>10 DH</strong></td>
                </tr>
                <tr>
                  <td><strong>Matériel fourni par l'agence</strong></td>
                  <td>Aspirateur + serpillière pro transportés par l'intervenante</td>
                  <td><strong style={{ color: '#00473E' }}>29 DH</strong></td>
                </tr>
                <tr>
                  <td><strong>Tarif horaire remise en état</strong></td>
                  <td>Salissure extrême nécessitant des heures supplémentaires</td>
                  <td><strong style={{ color: '#00473E' }}>60 DH / heure</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="cb-section-box">
            <div className="cb-section-box-title">
              <span>Checklist des 4 Photos Attendues pour la Clôture</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', textAlign: 'center' }}>
                <strong>1. Salon / Séjour</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Coussins et tables en ordre</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', textAlign: 'center' }}>
                <strong>2. Chambres & Lits</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Lits faits façon hôtelière</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', textAlign: 'center' }}>
                <strong>3. Salles de bain</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Serviettes pliées et propreté</div>
              </div>
              <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', textAlign: 'center' }}>
                <strong>4. Cuisine & Évier</strong>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Plans propres et vaisselle rangée</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 3 : LINGE (Page 27)                                           */}
      {/* ========================================================================= */}
      {activeTab === 'linge' && (
        <form onSubmit={handleSave} className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
              Composition Standard & Règles de Rotation Linge
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Base de calcul des sets (8 pièces = 50 DH) et exigences de roulement
            </div>
          </div>

          <div className="cb-grid-2col">
            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <BedDouble size={16} />
                <span>Composition Standard du Set (8 pièces)</span>
              </div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#334155', lineHeight: 1.8 }}>
                <li><strong>1</strong> Housse de couette</li>
                <li><strong>1</strong> Drap plat</li>
                <li><strong>2</strong> Taies d'oreiller</li>
                <li><strong>2</strong> Grandes serviettes de bain</li>
                <li><strong>2</strong> Petites serviettes de toilette</li>
              </ul>
            </div>

            <div className="cb-pricing-box">
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#ccfbf1', fontWeight: 800 }}>
                Tarification Chaîne du Linge
              </div>
              <div className="cb-pricing-row">
                <span>Prix 1 set standard (8 pcs) :</span>
                <strong>{config.prix_set_linge_standard} DH</strong>
              </div>
              <div className="cb-pricing-row">
                <span>Prix par pièce supplémentaire :</span>
                <strong>{config.prix_piece_supp_linge} DH / pièce</strong>
              </div>
              <div className="cb-pricing-row">
                <span>Forfait minimum de ramassage :</span>
                <strong>{config.forfait_min_linge} DH</strong>
              </div>
              <div className="cb-pricing-row">
                <span>Délai de traitement lavage :</span>
                <strong>48 heures</strong>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="cb-btn-primary" style={{ width: 'fit-content' }}>
            <Save size={16} />
            <span>{saving ? 'Enregistrement...' : 'Enregistrer les Tarifs Linge'}</span>
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* SOUS-ONGLET 4 : RÈGLES MÉTIER & JOURNAL D'AUDIT (Page 28)                  */}
      {/* ========================================================================= */}
      {activeTab === 'regles' && (
        <div className="cb-detail-card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
              Règles Métier Immuables & Journal des Modifications
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Ces règles garantissent l'intégrité opérationnelle et financière du module
            </div>
          </div>

          <div className="cb-grid-2col">
            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <Lock size={16} />
                <span>Règles du Moteur (Non Modifiables)</span>
              </div>
              <ul style={{ paddingLeft: '1.25rem', fontSize: '0.825rem', color: '#334155', lineHeight: 1.6 }}>
                <li>Le linge est facturé sur la commande du <strong>ramassage</strong>, jamais du dépôt.</li>
                <li>Le montant du linge est figé au recomptage laverie, une seule fois.</li>
                <li>Une commande n'est facturable qu'après 4 photos validées et arbitrage.</li>
                <li>La suspension d'un compte annule automatiquement les commandes planifiées.</li>
                <li>Un départ détecté par iCal crée une proposition, jamais une commande ferme.</li>
              </ul>
            </div>

            <div className="cb-section-box">
              <div className="cb-section-box-title">
                <Clock size={16} />
                <span>Journal des Dernières Modifications</span>
              </div>
              <table className="cb-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Paramètre</th>
                    <th>Changement</th>
                    <th>Auteur</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>28/07</td>
                    <td>Zone éloignée</td>
                    <td>Ajout de Sidi Rahal</td>
                    <td>Mehdi H.</td>
                  </tr>
                  <tr>
                    <td>12/07</td>
                    <td>Sets de rechange</td>
                    <td>2 → 3 sets</td>
                    <td>Mehdi H.</td>
                  </tr>
                  <tr>
                    <td>01/06</td>
                    <td>Grille tarifaire</td>
                    <td>Nouvelle version v2</td>
                    <td>Mehdi H.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
