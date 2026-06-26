/**
 * CreateOffreSimpleModal.tsx
 * Modal de création d'un code promo simple.
 */
import { useMemo } from 'react';
import { X, Copy, RefreshCw, Save, Rocket } from 'lucide-react';
import {
  TYPES_REDUCTION, SEGMENTS_CLIENT,
  SERVICES_PARTICULIER, SERVICES_ENTREPRISE,
} from '@/lib/marketing-constants';
import { useToastStore } from '@/store/toast';

export interface PromoFormState {
  nom: string;
  statut: string;
  code_promo: string;
  promo_type?: 'simple' | 'bd';
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
  limit_uses?: string;
  one_use_per_client: boolean;
}

interface Props {
  form: PromoFormState;
  setForm: React.Dispatch<React.SetStateAction<PromoFormState>>;
  onClose: () => void;
  onSubmit: (forcedStatus?: string) => void;
}

export function CreateOffreSimpleModal({ form, setForm, onClose, onSubmit }: Props) {
  /** Services filtrés selon le segment sélectionné */
  const servicesDisponibles = useMemo(() => {
    if (form.segment_client === 'entreprise') return [...SERVICES_ENTREPRISE];
    return [...SERVICES_PARTICULIER];
  }, [form.segment_client]);

  const { addToast } = useToastStore();

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

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, code_promo: result }));
  };

  const copyCodeToClipboard = async () => {
    if (!form.code_promo) return;
    try {
      await navigator.clipboard.writeText(form.code_promo);
      addToast(`Code "${form.code_promo}" copié !`, 'success');
    } catch {
      addToast("Erreur lors de la copie", 'error');
    }
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
      <section className="mk-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <header className="mk-modal-header">
          <h3>Créer un code promo simple</h3>
          <button type="button" className="mk-modal-close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="mk-modal-body">
          {/* Nom de l'offre */}
          <div className="mk-field">
            <span>Nom de l'offre *</span>
            <input
              placeholder="ex: Promo Nouveau Client"
              value={form.nom}
              maxLength={80}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.15rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{form.nom.length} / 80</span>
            </div>
          </div>

          {/* Code promo */}
          <div className="mk-field">
            <span>Code promo *</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                placeholder="ex: BIENVENUE10"
                value={form.code_promo}
                onChange={(e) => setForm({ ...form, code_promo: e.target.value.toUpperCase() })}
                style={{ fontFamily: 'monospace', flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={copyCodeToClipboard}
                title="Copier le code"
                style={{ padding: '0.5rem', borderRadius: '8px', minWidth: '40px', display: 'flex', justifyContent: 'center' }}
              >
                <Copy size={16} />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={generateRandomCode}
                title="Générer un code aléatoire"
                style={{ padding: '0.5rem', borderRadius: '8px', minWidth: '40px', display: 'flex', justifyContent: 'center' }}
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

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

        <div className="mk-form-actions mk-form-actions-modal" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSubmit('brouillon')}
            disabled={!isValid}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem' }}
          >
            <Save size={16} /> Enregistrer en brouillon
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isValid}
            onClick={() => onSubmit('active')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#10b981',
              borderColor: '#10b981',
              padding: '0.6rem 1.2rem',
              color: '#fff'
            }}
          >
            <Rocket size={16} /> Publier et activer
          </button>
        </div>
      </section>
    </div>
  );
}
