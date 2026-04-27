/**
 * CreateCampagneModal.tsx
 * Modal de création d'une campagne marketing — design vertical mk-modal.
 * Adapté de marketing/CreateCampagneModal.tsx (shadcn/supabase → natif mk-modal + localStorage).
 */
import { X } from 'lucide-react';
import {
  STATUTS_CAMPAGNE, CIBLES_CAMPAGNE, SEGMENTS_CLIENT,
  CRITERES_CLIENT, CRITERES_PROFIL, CANAUX_CAMPAGNE,
} from '@/lib/marketing-constants';

export interface CampagneFormState {
  nom: string;
  message: string;
  statut: string;
  cible: string;
  segment_cible: string;
  critere_ciblage: string;
  canal: string[];
  ville_ciblage: string;
  heure_debut: string;
  heure_fin: string;
  date_diffusion: string;
  nombre_destinataires_jour: string;
}

interface Props {
  form: CampagneFormState;
  setForm: React.Dispatch<React.SetStateAction<CampagneFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateCampagneModal({ form, setForm, onClose, onSubmit }: Props) {
  const toggleCanal = (val: string) => {
    setForm((prev) => ({
      ...prev,
      canal: prev.canal.includes(val)
        ? prev.canal.filter((v) => v !== val)
        : [...prev.canal, val],
    }));
  };

  const criteres = form.cible === 'client' ? CRITERES_CLIENT : CRITERES_PROFIL;

  return (
    <div className="mk-modal-overlay" onClick={onClose}>
      <section className="mk-modal" onClick={(e) => e.stopPropagation()}>
        <header className="mk-modal-header">
          <h3>Créer une campagne</h3>
          <button type="button" className="mk-modal-close" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="mk-modal-body">
          {/* Titre */}
          <label className="mk-field">
            <span>Titre de la campagne *</span>
            <input placeholder="ex: Relance clients inactifs" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </label>

          {/* Message */}
          <label className="mk-field">
            <span>Message de la campagne</span>
            <textarea rows={4} placeholder="Bonjour, profitez de 15% de réduction sur votre prochaine prestation..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </label>

          {/* Statut */}
          <label className="mk-field">
            <span>Statut de la campagne</span>
            <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
              {STATUTS_CAMPAGNE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          {/* Cible */}
          <label className="mk-field">
            <span>Cible *</span>
            <select value={form.cible} onChange={(e) => setForm({ ...form, cible: e.target.value, critere_ciblage: 'tous', segment_cible: 'tous' })}>
              {CIBLES_CAMPAGNE.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>

          {/* Segment (si client) */}
          {form.cible === 'client' && (
            <label className="mk-field">
              <span>Segment</span>
              <select value={form.segment_cible} onChange={(e) => setForm({ ...form, segment_cible: e.target.value })}>
                <option value="tous">Tous</option>
                {SEGMENTS_CLIENT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}

          {/* Critère de ciblage */}
          <label className="mk-field">
            <span>Critère de ciblage</span>
            <select value={form.critere_ciblage} onChange={(e) => setForm({ ...form, critere_ciblage: e.target.value })}>
              {criteres.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>

          {/* Canal de diffusion (multichoix) */}
          <div className="mk-field">
            <span>Canal de diffusion *</span>
            <div className="mk-form-services-grid" style={{ marginTop: '0.35rem' }}>
              {CANAUX_CAMPAGNE.map((c) => (
                <label key={c.value} className="mk-form-checkbox">
                  <input type="checkbox" checked={form.canal.includes(c.value)} onChange={() => toggleCanal(c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Ville */}
          <label className="mk-field">
            <span>Ville de ciblage</span>
            <input value={form.ville_ciblage} onChange={(e) => setForm({ ...form, ville_ciblage: e.target.value })} placeholder="Casablanca" />
          </label>

          {/* Heure de diffusion */}
          <div className="mk-form-row-2">
            <label className="mk-field">
              <span>Heure de début</span>
              <input type="time" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} />
            </label>
            <label className="mk-field">
              <span>Heure de fin</span>
              <input type="time" value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} />
            </label>
          </div>

          {/* Date de diffusion */}
          <label className="mk-field">
            <span>Date de diffusion</span>
            <input type="date" value={form.date_diffusion} onChange={(e) => setForm({ ...form, date_diffusion: e.target.value })} />
          </label>

          {/* Destinataires / jour */}
          <label className="mk-field">
            <span>Nombre estimé de destinataires par jour</span>
            <input type="number" placeholder="0" value={form.nombre_destinataires_jour} onChange={(e) => setForm({ ...form, nombre_destinataires_jour: e.target.value })} />
          </label>
        </div>

        <div className="mk-form-actions mk-form-actions-modal">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" disabled={!form.nom || form.canal.length === 0} onClick={onSubmit}>🚀 Créer la campagne</button>
        </div>
      </section>
    </div>
  );
}
