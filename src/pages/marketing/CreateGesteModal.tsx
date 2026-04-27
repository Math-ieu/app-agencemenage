/**
 * CreateGesteModal.tsx
 * Modal de création d'un geste commercial — design vertical mk-modal.
 * Adapté de marketing/CreateGesteModal.tsx (shadcn/supabase → natif mk-modal + localStorage).
 */
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { TYPES_GESTE, STATUTS_GESTE, CANAUX_DIFFUSION } from '@/lib/marketing-constants';

export interface GesteFormState {
  client_nom: string;
  client_telephone: string;
  ville: string;
  quartier: string;
  date_geste: string;
  statut_geste: string;
  type_geste: string;
  montant_ht: string;
  tva_active: boolean;
  reduction_type: string;
  reduction_valeur: string;
  part_profil: string;
  part_agence: string;
  motif: string;
  envoyer_message: boolean;
  message_client: string;
  canal_diffusion: string[];
  cree_par: string;
}

interface Props {
  form: GesteFormState;
  setForm: React.Dispatch<React.SetStateAction<GesteFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateGesteModal({ form, setForm, onClose, onSubmit }: Props) {
  // Calculs tarification
  const montantHT = Number(form.montant_ht) || 0;
  const tvaMontant = form.tva_active ? montantHT * 0.2 : 0;
  const montantTTC = montantHT + tvaMontant;
  const reductionAmount = form.reduction_type === 'pourcentage'
    ? montantTTC * (Number(form.reduction_valeur) || 0) / 100
    : Number(form.reduction_valeur) || 0;
  const isAnnulation = form.type_geste === 'facturation_annulee' || form.type_geste === 'intervention_gratuite';
  const totalAPayer = isAnnulation ? 0 : Math.max(0, montantTTC - reductionAmount);

  const repartitionValid = useMemo(() => {
    if (isAnnulation) return true;
    if (totalAPayer === 0) return true;
    return (Number(form.part_profil || 0) + Number(form.part_agence || 0)) === totalAPayer;
  }, [isAnnulation, totalAPayer, form.part_profil, form.part_agence]);

  const toggleCanal = (val: string) => {
    setForm((prev) => ({
      ...prev,
      canal_diffusion: prev.canal_diffusion.includes(val)
        ? prev.canal_diffusion.filter((v) => v !== val)
        : [...prev.canal_diffusion, val],
    }));
  };

  return (
    <div className="mk-modal-overlay" onClick={onClose}>
      <section className="mk-modal" onClick={(e) => e.stopPropagation()}>
        <header className="mk-modal-header">
          <h3>Créer un geste commercial</h3>
          <button type="button" className="mk-modal-close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="mk-modal-body">
          {/* 1. Client */}
          <label className="mk-field">
            <span>Nom du client *</span>
            <input placeholder="Nom du client" value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} />
          </label>
          <label className="mk-field">
            <span>Téléphone client</span>
            <input placeholder="06..." value={form.client_telephone} onChange={(e) => setForm({ ...form, client_telephone: e.target.value })} />
          </label>

          <div className="mk-form-row-2">
            <label className="mk-field">
              <span>Ville</span>
              <input placeholder="Casablanca" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            </label>
            <label className="mk-field">
              <span>Quartier</span>
              <input placeholder="Maârif" value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} />
            </label>
          </div>

          {/* 2. Date */}
          <label className="mk-field">
            <span>Date du geste commercial</span>
            <input type="date" value={form.date_geste} onChange={(e) => setForm({ ...form, date_geste: e.target.value })} />
          </label>

          {/* 3. Statut */}
          <label className="mk-field">
            <span>Statut du geste commercial</span>
            <select value={form.statut_geste} onChange={(e) => setForm({ ...form, statut_geste: e.target.value })}>
              {STATUTS_GESTE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          {/* 4. Type */}
          <label className="mk-field">
            <span>Type de geste commercial *</span>
            <select value={form.type_geste} onChange={(e) => setForm({ ...form, type_geste: e.target.value })}>
              {TYPES_GESTE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          {/* 5. Tarification */}
          <fieldset className="mk-fieldset">
            <legend>Tarification</legend>
            <label className="mk-field">
              <span>Montant HT (MAD)</span>
              <input type="number" placeholder="0" value={form.montant_ht} onChange={(e) => setForm({ ...form, montant_ht: e.target.value })} />
            </label>
            <label className="mk-form-checkbox" style={{ marginTop: '0.3rem' }}>
              <input type="checkbox" checked={form.tva_active} onChange={(e) => setForm({ ...form, tva_active: e.target.checked })} />
              TVA 20%
              {form.tva_active && <small style={{ marginLeft: '0.5rem', color: '#6b7280' }}>TVA : {tvaMontant.toFixed(2)} MAD</small>}
            </label>
            {form.tva_active && (
              <p className="mk-field-info"><strong>Montant TTC :</strong> {montantTTC.toFixed(2)} MAD</p>
            )}
            <div className="mk-form-row-2">
              <label className="mk-field">
                <span>Type de réduction</span>
                <select value={form.reduction_type} onChange={(e) => setForm({ ...form, reduction_type: e.target.value })}>
                  <option value="montant">Montant (MAD)</option>
                  <option value="pourcentage">Pourcentage (%)</option>
                </select>
              </label>
              <label className="mk-field">
                <span>Valeur de la réduction</span>
                <input type="number" placeholder="0" value={form.reduction_valeur} onChange={(e) => setForm({ ...form, reduction_valeur: e.target.value })} />
              </label>
            </div>
            {reductionAmount > 0 && (
              <p className="mk-field-info" style={{ color: '#6b7280' }}>Réduction : -{reductionAmount.toFixed(2)} MAD</p>
            )}
            <p className="mk-field-total">
              Total à payer : {isAnnulation ? '0.00' : totalAPayer.toFixed(2)} MAD
              {isAnnulation && <small style={{ color: '#dc2626', marginLeft: '0.5rem' }}>(Perte agence)</small>}
            </p>
          </fieldset>

          {/* 6. Répartition */}
          {!isAnnulation && totalAPayer > 0 && (
            <fieldset className="mk-fieldset">
              <legend>Répartition du montant</legend>
              <div className="mk-form-row-2">
                <label className="mk-field">
                  <span>Part du profil (MAD)</span>
                  <input type="number" placeholder="0" value={form.part_profil} onChange={(e) => setForm({ ...form, part_profil: e.target.value })} />
                </label>
                <label className="mk-field">
                  <span>Part de l'agence (MAD)</span>
                  <input type="number" placeholder="0" value={form.part_agence} onChange={(e) => setForm({ ...form, part_agence: e.target.value })} />
                </label>
              </div>
              {!repartitionValid && (
                <p className="mk-field-error">
                  Part profil ({form.part_profil || 0}) + Part agence ({form.part_agence || 0}) doit être = {totalAPayer.toFixed(2)} MAD
                </p>
              )}
            </fieldset>
          )}

          {isAnnulation && (
            <div className="mk-field-warn">
              ⚠️ Facturation annulée / Intervention gratuite : l'agence doit le montant au profil. Ce montant sera comptabilisé en perte.
            </div>
          )}

          {/* 7. Motif */}
          <label className="mk-field">
            <span>Motif du geste *</span>
            <textarea rows={2} placeholder="Raison du geste commercial..." value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} />
          </label>

          {/* 8. Message */}
          <div className="mk-field">
            <span>Envoyer un message au client ?</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
              <button type="button" className={`btn btn-sm ${!form.envoyer_message ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setForm({ ...form, envoyer_message: false })}>Non</button>
              <button type="button" className={`btn btn-sm ${form.envoyer_message ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setForm({ ...form, envoyer_message: true })}>Oui</button>
            </div>
          </div>
          <div style={!form.envoyer_message ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <label className="mk-field">
              <span>Message</span>
              <textarea rows={3} placeholder="Rédigez le message à envoyer au client..." value={form.message_client} onChange={(e) => setForm({ ...form, message_client: e.target.value })} />
            </label>
            <div className="mk-field" style={{ marginTop: '0.4rem' }}>
              <div className="mk-form-services-grid">
                {CANAUX_DIFFUSION.map((c) => (
                  <label key={c.value} className="mk-form-checkbox">
                    <input type="checkbox" checked={form.canal_diffusion.includes(c.value)} onChange={() => toggleCanal(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 9. Créé par */}
          <label className="mk-field">
            <span>Créé par</span>
            <input placeholder="Nom du commercial" value={form.cree_par} onChange={(e) => setForm({ ...form, cree_par: e.target.value })} />
          </label>
        </div>

        <div className="mk-form-actions mk-form-actions-modal">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>✅ Enregistrer le geste commercial</button>
        </div>
      </section>
    </div>
  );
}
