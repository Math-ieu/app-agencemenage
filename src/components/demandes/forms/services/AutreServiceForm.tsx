import React, { useState } from 'react';
import { FormBlockProps, PlanningBlock } from '../ServiceFormBlocks';

const DEFAULT_OPTIONS = [
  { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
  { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false },
  { key: "machines", label: "Machines et équipements (aspirateur, vapeur, etc.)", price: 0, enabled: false }
];

export const AutreServiceForm: React.FC<FormBlockProps> = ({ formData, setFormData }) => {
  const [showAddOptionModal, setShowAddOptionModal] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState(0);

  const options = formData.options || DEFAULT_OPTIONS;

  const toggleOption = (idx: number) => {
    const nextOptions = [...options];
    nextOptions[idx] = { ...nextOptions[idx], enabled: !nextOptions[idx].enabled };
    setFormData({ ...formData, options: nextOptions });
  };

  const setOptionPrice = (idx: number, price: number) => {
    const nextOptions = [...options];
    nextOptions[idx] = { ...nextOptions[idx], price };
    setFormData({ ...formData, options: nextOptions });
  };

  const addCustomOption = () => {
    setShowAddOptionModal(true);
  };

  const setAdvanceRequired = (val: boolean) => {
    setFormData({ ...formData, advance_required: val, avance_active: val });
  };

  return (
    <>
      {/* 0. Numéro de devis */}
      <div className="ws-form-block">
        <div className="ws-section-header">Référence du devis</div>
        <div style={{ padding: '0.5rem' }}>
          <div className="form-group">
            <label className="label-teal">Numéro de devis personnalisé (optionnel)</label>
            <input
              type="text"
              placeholder="Ex: DEV-2026-001 (Laissez vide pour génération automatique)"
              value={formData.quote_number || ''}
              onChange={e => setFormData({ ...formData, quote_number: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
          </div>
        </div>
      </div>

      {/* 1. Description du service personnalisé */}
      <div className="ws-form-block">
        <div className="ws-section-header">Description du service</div>
        <div style={{ padding: '0.5rem' }}>
          <div className="form-group">
            <label className="label-teal">Nom du service personnalisé *</label>
            <input
              type="text"
              required
              placeholder="Ex: Nettoyage industriel de sols, Dépoussiérage de riad..."
              value={formData.custom_service_type || ''}
              onChange={e => setFormData({ ...formData, custom_service_type: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
          </div>
        </div>
      </div>

      {/* 2. Informations sur le bien */}
      <div className="ws-form-block">
        <div className="ws-section-header">Informations sur le bien</div>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', padding: '0.5rem' }}>
          <div className="form-group">
            <label className="label-teal">Catégorie de bien</label>
            <select
              className="ws-select"
              value={formData.property_category || 'logement'}
              onChange={e => {
                const nextSubtype = e.target.value === 'logement' ? 'Appartement' : '';
                setFormData({ ...formData, property_category: e.target.value, property_subtype: nextSubtype });
              }}
            >
              <option value="logement">Logement</option>
              <option value="bureau">Bureau</option>
              <option value="commerce">Commerce</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="form-group">
            <label className="label-teal">
              {formData.property_category === 'logement' ? 'Sous-type de logement' : 'Préciser le type de bien'}
            </label>
            {formData.property_category === 'logement' ? (
              <select
                className="ws-select"
                value={formData.property_subtype || 'Appartement'}
                onChange={e => setFormData({ ...formData, property_subtype: e.target.value })}
              >
                <option value="Appartement">Appartement</option>
                <option value="Villa">Villa</option>
                <option value="Studio">Studio</option>
                <option value="Duplex">Duplex</option>
                <option value="Riad">Riad</option>
              </select>
            ) : (
              <input
                type="text"
                placeholder="Ex: Bureau principal, Local commercial..."
                value={formData.property_subtype || ''}
                onChange={e => setFormData({ ...formData, property_subtype: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
              />
            )}
          </div>
          <div className="form-group">
            <label className="label-teal">Surface (m²)</label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={formData.surface !== undefined && formData.surface !== null ? formData.surface : ''}
              onChange={e => setFormData({ ...formData, surface: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
          </div>
        </div>
      </div>

      {/* 3. Planification et intervenants */}
      <div className="ws-form-block">
        <div className="ws-section-header">Planification et intervenants</div>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem', padding: '0.5rem' }}>
          <div className="form-group">
            <label className="label-teal">Fréquence</label>
            <select
              className="ws-select"
              value={formData.frequency === 'subscription' || formData.frequence === 'abonnement' ? 'subscription' : 'oneshot'}
              onChange={e => {
                const isSub = e.target.value === 'subscription';
                setFormData({
                  ...formData,
                  frequency: isSub ? 'subscription' : 'oneshot',
                  frequence: isSub ? '1foisParSemaine' : 'une fois',
                  subFrequency: isSub ? '1foisParSemaine' : undefined
                });
              }}
            >
              <option value="oneshot">Une fois (ponctuel)</option>
              <option value="subscription">Abonnement</option>
            </select>
          </div>

          {(formData.frequency === 'subscription' || formData.frequence === 'abonnement') && (
            <div className="form-group">
              <label className="label-teal">Cadence d'abonnement</label>
              <select
                className="ws-select"
                value={formData.subFrequency || '1foisParSemaine'}
                onChange={e => setFormData({
                  ...formData,
                  subFrequency: e.target.value,
                  frequence: e.target.value
                })}
              >
                <option value="1foisParSemaine">1 fois par semaine</option>
                <option value="2foisParSemaine">2 fois par semaine</option>
                <option value="3foisParSemaine">3 fois par semaine</option>
                <option value="4foisParSemaine">4 fois par semaine</option>
                <option value="5foisParSemaine">5 fois par semaine</option>
                <option value="6foisParSemaine">6 fois par semaine</option>
                <option value="7foisParSemaine">7 fois par semaine</option>
                <option value="1foisParMois">1 fois par mois</option>
                <option value="2foisParMois">2 fois par mois</option>
                <option value="3foisParMois">3 fois par mois</option>
                <option value="4foisParMois">4 fois par mois</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="label-teal">Durée (heures)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              value={formData.duree !== undefined && formData.duree !== null ? formData.duree : ''}
              onChange={e => setFormData({ ...formData, duree: e.target.value === '' ? '' : (parseFloat(e.target.value) || 0), duration_unit: 'heures' })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
          </div>
          <div className="form-group">
            <label className="label-teal">Nombre d'intervenants</label>
            <input
              type="number"
              min="1"
              value={formData.nb_intervenants || 1}
              onChange={e => setFormData({ ...formData, nb_intervenants: parseInt(e.target.value) || 1 })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
          </div>
        </div>
      </div>

      {/* 4. Planning de l'intervention */}
      <PlanningBlock formData={formData} setFormData={setFormData} />

      {/* 4.5 Options complémentaires */}
      <div className="ws-form-block">
        <div className="ws-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Options complémentaires</span>
          <button
            type="button"
            onClick={addCustomOption}
            style={{ fontSize: '11px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + Ajouter option
          </button>
        </div>
        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {options.map((opt: any, idx: number) => (
            <div key={opt.key} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 120px', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem' }}>
              <input
                type="checkbox"
                checked={!!opt.enabled}
                onChange={() => toggleOption(idx)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.85rem', color: '#1e293b' }}>{opt.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="number"
                  min="0"
                  value={opt.price}
                  onChange={e => setOptionPrice(idx, parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem', fontSize: '0.8rem' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>MAD</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Consigne importante (Contractuelle pour le devis) */}
      <div className="ws-form-block">
        <div className="ws-section-header">Consigne importante *</div>
        <div style={{ padding: '0.5rem' }}>
          <textarea
            rows={5}
            required
            placeholder="Précisez clairement le périmètre du service, les consignes importantes, ainsi que ce qui est inclus ou non dans la prestation. Ce contenu sera imprimé directement sur le devis contractuel du client."
            value={formData.description || ''}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            style={{ width: '100%', padding: '0.75rem', border: '2px solid #0f766e', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none' }}
          />
        </div>
      </div>

      {/* 6. Tarification financière */}
      <div className="ws-form-block">
        <div className="ws-section-header">Informations financières</div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
          <div className="form-group">
            <label className="label-teal">Montant HT (MAD) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              value={formData.amount_ht !== undefined && formData.amount_ht !== null ? formData.amount_ht : ''}
              onChange={e => {
                const val = parseFloat(e.target.value) || 0;
                setFormData({ ...formData, amount_ht: val, montant: val.toString() });
              }}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
          </div>
          <div className="form-group">
            <label className="label-teal">TVA (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.vat_rate !== undefined ? formData.vat_rate : 20}
              onChange={e => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0, tva_active: parseFloat(e.target.value) > 0 })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
            />
          </div>
        </div>

        {/* 7. Avance requise */}
        <div style={{ padding: '0.5rem', borderTop: '1px dashed #cbd5e1', marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label className="label-teal" style={{ margin: 0 }}>Avance requise</label>
            <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setAdvanceRequired(false)}
                style={{
                  padding: '4px 16px',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  background: !formData.advance_required ? '#0f766e' : '#f8fafc',
                  color: !formData.advance_required ? 'white' : '#475569'
                }}
              >
                Non
              </button>
              <button
                type="button"
                onClick={() => setAdvanceRequired(true)}
                style={{
                  padding: '4px 16px',
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  background: formData.advance_required ? '#0f766e' : '#f8fafc',
                  color: formData.advance_required ? 'white' : '#475569'
                }}
              >
                Oui
              </button>
            </div>
          </div>

          {formData.advance_required && (
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', marginTop: '0.5rem' }}>
              <div className="form-group">
                <label className="label-teal">Mode de l'avance</label>
                <select
                  className="ws-select"
                  value={formData.advance_mode || 'percent'}
                  onChange={e => setFormData({ ...formData, advance_mode: e.target.value, avance_type: e.target.value })}
                >
                  <option value="percent">En pourcentage (%)</option>
                  <option value="fixed">Montant fixe (MAD)</option>
                </select>
              </div>
              {formData.advance_mode === 'fixed' ? (
                <div className="form-group">
                  <label className="label-teal">Montant d'avance (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.advance_amount !== undefined ? formData.advance_amount : 0}
                    onChange={e => setFormData({ ...formData, advance_amount: parseFloat(e.target.value) || 0, avance_fixe: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label className="label-teal">Pourcentage d'avance (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.advance_percent !== undefined && formData.advance_percent !== null && formData.advance_percent !== "" ? formData.advance_percent : ""}
                    onChange={e => {
                      const val = e.target.value;
                      const parsed = val === "" ? "" : parseInt(val) || 0;
                      setFormData({ ...formData, advance_percent: parsed, avance_pourcentage: parsed });
                    }}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddOptionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>Ajouter une option</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Nom de l'option</label>
                <input
                  type="text"
                  placeholder="Ex: Nettoyage haute pression..."
                  value={newOptionLabel}
                  onChange={e => setNewOptionLabel(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Prix (MAD)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newOptionPrice || ''}
                  onChange={e => setNewOptionPrice(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddOptionModal(false);
                  setNewOptionLabel('');
                  setNewOptionPrice(0);
                }}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', color: '#475569', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newOptionLabel.trim()) return;
                  const nextOptions = [...options, { key: `custom_${Date.now()}`, label: newOptionLabel, price: newOptionPrice, enabled: true }];
                  setFormData({ ...formData, options: nextOptions });
                  setShowAddOptionModal(false);
                  setNewOptionLabel('');
                  setNewOptionPrice(0);
                }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#0f766e', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
