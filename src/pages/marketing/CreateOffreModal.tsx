/**
 * CreateOffreModal.tsx
 * Modal de création d'un code promo marketing — design vertical mk-modal.
 * Adapté de marketing/CreateOffreModal.tsx (shadcn/supabase → natif mk-modal + localStorage).
 */
import { useMemo } from 'react';
import { X } from 'lucide-react';
import {
  TYPES_REDUCTION, SEGMENTS_CLIENT, STATUTS_CLIENT, STATUTS_CODE_PROMO,
  SERVICES_PARTICULIER, SERVICES_ENTREPRISE, CANAUX_DIFFUSION,
} from '@/lib/marketing-constants';

export interface PromoFormState {
  nom: string;
  statut: string;
  code_promo: string;
  type_reduction: string;
  valeur_reduction: string;
  segment_client: string;
  statut_client: string;
  services: string[];
  canaux: string[];
  message_promotionnel: string;
  date_debut: string;
  date_fin: string;
  date_indeterminee: boolean;
}

interface Props {
  form: PromoFormState;
  setForm: React.Dispatch<React.SetStateAction<PromoFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateOffreModal({ form, setForm, onClose, onSubmit }: Props) {
  /** Services filtrés selon le segment sélectionné */
  const servicesDisponibles = useMemo(() => {
    if (form.segment_client === 'entreprise') return [...SERVICES_ENTREPRISE];
    return [...SERVICES_PARTICULIER];
  }, [form.segment_client]);

  const handleSegmentChange = (v: string) => {
    setForm((prev) => ({ ...prev, segment_client: v, services: [] }));
  };

  const toggleService = (s: string) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(s)
        ? prev.services.filter((x) => x !== s)
        : [...prev.services, s],
    }));
  };

  const toggleCanal = (val: string) => {
    setForm((prev) => ({
      ...prev,
      canaux: prev.canaux.includes(val)
        ? prev.canaux.filter((v) => v !== val)
        : [...prev.canaux, val],
    }));
  };

  const isValid = useMemo(() => {
    if (!form.nom || !form.code_promo || !form.valeur_reduction) return false;
    if (form.services.length === 0) return false;
    if (!form.date_debut) return false;
    if (!form.date_indeterminee && !form.date_fin) return false;
    if (!form.date_indeterminee && form.date_fin && form.date_fin < form.date_debut) return false;
    return true;
  }, [form]);

  return (
    <div className="mk-modal-overlay" onClick={onClose}>
      <section className="mk-modal" onClick={(e) => e.stopPropagation()}>
        <header className="mk-modal-header">
          <h3>Créer un code promo</h3>
          <button type="button" className="mk-modal-close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="mk-modal-body">
          {/* Nom de l'offre */}
          <label className="mk-field">
            <span>Nom de l'offre *</span>
            <input placeholder="ex: Promo Nouveau Client" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </label>

          {/* Statut */}
          <label className="mk-field">
            <span>Statut du code promo *</span>
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
              {STATUTS_CODE_PROMO.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          {/* Code promo */}
          <label className="mk-field">
            <span>Code promo *</span>
            <input placeholder="ex: BIENVENUE10" value={form.code_promo} onChange={(e) => setForm({ ...form, code_promo: e.target.value.toUpperCase() })} style={{ fontFamily: 'monospace' }} />
          </label>

          {/* Type + Valeur */}
          <div className="mk-form-row-2">
            <label className="mk-field">
              <span>Type de réduction *</span>
              <select value={form.type_reduction} onChange={(e) => setForm({ ...form, type_reduction: e.target.value })}>
                {TYPES_REDUCTION.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="mk-field">
              <span>Valeur *</span>
              <input type="number" placeholder={form.type_reduction === 'pourcentage' ? 'ex: 10' : 'ex: 50'} value={form.valeur_reduction} onChange={(e) => setForm({ ...form, valeur_reduction: e.target.value })} />
            </label>
          </div>

          {/* Segment */}
          <label className="mk-field">
            <span>Segment *</span>
            <select value={form.segment_client} onChange={(e) => handleSegmentChange(e.target.value)}>
              {SEGMENTS_CLIENT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          {/* Statut client */}
          <label className="mk-field">
            <span>Statut client *</span>
            <select value={form.statut_client} onChange={(e) => setForm({ ...form, statut_client: e.target.value })}>
              {STATUTS_CLIENT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          {/* Services concernés */}
          <div className="mk-field">
            <span>Services concernés *</span>
            <div className="mk-form-services-grid" style={{ marginTop: '0.35rem' }}>
              {servicesDisponibles.map((s) => (
                <label key={s} className="mk-form-checkbox">
                  <input type="checkbox" checked={form.services.includes(s)} onChange={() => toggleService(s)} />
                  {s}
                </label>
              ))}
            </div>
            {form.services.length === 0 && (
              <p className="mk-field-error">Sélectionnez au moins un service</p>
            )}
          </div>

          {/* Canal de diffusion */}
          <div className="mk-field">
            <span>Canal de diffusion</span>
            <div className="mk-form-services-grid" style={{ marginTop: '0.35rem' }}>
              {CANAUX_DIFFUSION.map((c) => (
                <label key={c.value} className="mk-form-checkbox">
                  <input type="checkbox" checked={form.canaux.includes(c.value)} onChange={() => toggleCanal(c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Message promotionnel */}
          <label className="mk-field">
            <span>Message promotionnel <small>(facultatif)</small></span>
            <textarea rows={3} placeholder="Profitez de 20% de réduction avec le code BIENVENUE20..." value={form.message_promotionnel} onChange={(e) => setForm({ ...form, message_promotionnel: e.target.value })} />
          </label>

          {/* Dates */}
          <div className="mk-field">
            <span>Promotion valable</span>
            <div className="mk-form-row-2" style={{ marginTop: '0.35rem' }}>
              <label className="mk-field">
                <small>Date début *</small>
                <input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
              </label>
              <label className="mk-field">
                <small>Date fin {form.date_indeterminee ? '' : '*'}</small>
                <input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} disabled={form.date_indeterminee} min={form.date_debut} style={form.date_indeterminee ? { opacity: 0.5 } : undefined} />
              </label>
            </div>
            <label className="mk-form-checkbox" style={{ marginTop: '0.4rem' }}>
              <input type="checkbox" checked={form.date_indeterminee} onChange={(e) => setForm({ ...form, date_indeterminee: e.target.checked, date_fin: '' })} />
              Date indéterminée
            </label>
            {!form.date_indeterminee && form.date_fin && form.date_fin < form.date_debut && (
              <p className="mk-field-error">La date de fin doit être ≥ à la date de début</p>
            )}
          </div>
        </div>

        <div className="mk-form-actions mk-form-actions-modal">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={!isValid} onClick={onSubmit}>✅ Créer le code promo</button>
        </div>
      </section>
    </div>
  );
}
