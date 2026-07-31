/**
 * ProfilEditModal — Shared modal for creating AND editing a profile.
 * Used in:
 *   - Profils.tsx   (create mode, no initialAgent)
 *   - ProfilDetails.tsx (edit mode, initialAgent pre-fills all fields)
 */
import React, { useState } from 'react';
import { createAgent, updateAgent } from '../api/client';
import { Search, Plus, RotateCw, Calendar, User, Save, XCircle, FileText } from 'lucide-react';
import { useToastStore } from '../store/toast';
import { Agent } from '../types';
import {
  SITUATIONS_MATRIMONIALES,
  NATIONALITES,
  PRESENTATIONS_PHYSIQUES,
  CORPULENCES,
  TYPES_PROFIL,
  TYPES_POSTE_EXPERIENCE,
  LIEUX_TRAVAIL,
  TACHES_MENAGE,
  STATUT_PROFIL_OPTIONS,
} from '../lib/profil-form-constants';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialAgent?: Agent;
}

const normalizePhysicalAppearance = (value: string): string => {
  if (!value) return '';
  const v = value.toLowerCase();
  if (v === 'correcte' || v === 'presentable') return 'presentable';
  if (v === 'moyenne' || v === 'passable') return 'passable';
  if (v === 'excellente' || v === 'tres_presentable' || v === 'très présentable') return 'tres_presentable';
  return value;
};

const normalizeCorpulence = (value: string): string => {
  if (!value) return '';
  return value.toUpperCase();
};

export default function AddProfileModal({ onClose, onSuccess, initialAgent }: Props) {
  const isEditing = Boolean(initialAgent);
  const [formData, setFormData] = useState({
    last_name: initialAgent?.last_name || '',
    first_name: initialAgent?.first_name || '',
    neighborhood: initialAgent?.neighborhood || '',
    city: initialAgent?.city || 'Casablanca',
    cin: initialAgent?.cin || '',
    birth_date: initialAgent?.birth_date || '',
    gender: initialAgent?.gender || '',
    phone: initialAgent?.phone || '',
    whatsapp: initialAgent?.whatsapp || '',
    situation: initialAgent?.situation || '',
    has_children: initialAgent?.has_children ?? false,
    nationality: initialAgent?.nationality || 'Marocaine',
    languages: initialAgent?.languages || [] as string[],
    education_level: initialAgent?.education_level || '',
    experience_years: initialAgent?.experience_years ?? 0,
    experience_months: initialAgent?.experience_months ?? 0,
    statut: initialAgent?.statut || 'nouveau',
    disponibilite_intervention: initialAgent?.disponibilite_intervention || 'disponible',
    type_profil: initialAgent?.type_profil || '',
    can_read_write: initialAgent?.can_read_write ?? false,
    health_issues: initialAgent?.health_issues || 'Non',
    physical_appearance: normalizePhysicalAppearance(initialAgent?.physical_appearance || ''),
    corpulence: normalizeCorpulence(initialAgent?.corpulence || ''),
    allergy_animals: initialAgent?.allergy_animals ?? false,
    shoe_size: initialAgent?.shoe_size || '36',
    is_smoking: initialAgent?.is_smoking ?? false,
    availability_calendar: initialAgent?.availability_calendar || {
      lundi: { active: true, start: '08:00', end: '18:00' },
      mardi: { active: true, start: '08:00', end: '18:00' },
      mercredi: { active: true, start: '08:00', end: '18:00' },
      jeudi: { active: true, start: '08:00', end: '18:00' },
      vendredi: { active: true, start: '08:00', end: '18:00' },
      samedi: { active: true, start: '08:00', end: '18:00' },
      dimanche: { active: false, start: '08:00', end: '18:00' }
    },
    avail_emergencies: initialAgent?.avail_emergencies ?? false,
    avail_7_7: initialAgent?.avail_7_7 ?? false,
    avail_day: initialAgent?.avail_day ?? false,
    avail_holidays: initialAgent?.avail_holidays ?? false,
    avail_evening: initialAgent?.avail_evening ?? false,
    recruiter_notes: initialAgent?.recruiter_notes || '',
    registration_date: initialAgent?.registration_date || new Date().toISOString().split('T')[0],
    standby_days: initialAgent?.standby_days || 0,
    standby_until: initialAgent?.standby_until || '',
    leave_start: initialAgent?.leave_start || '',
    leave_end: initialAgent?.leave_end || '',
  });

  const [sameAsPhone, setSameAsPhone] = useState(() =>
    Boolean(initialAgent?.phone && initialAgent?.whatsapp && initialAgent.phone === initialAgent.whatsapp)
  );

  const handlePhoneChange = (val: string) => {
    setFormData(prev => ({
      ...prev,
      phone: val,
      ...(sameAsPhone ? { whatsapp: val } : {}),
    }));
    if (errors.phone) setErrors(prev => ({ ...prev, phone: false }));
    if (sameAsPhone && errors.whatsapp) setErrors(prev => ({ ...prev, whatsapp: false }));
  };

  const handleWhatsappChange = (val: string) => {
    setFormData(prev => ({ ...prev, whatsapp: val }));
    if (sameAsPhone && val !== formData.phone) {
      setSameAsPhone(false);
    }
    if (errors.whatsapp) setErrors(prev => ({ ...prev, whatsapp: false }));
  };

  const handleSameAsPhoneToggle = (checked: boolean) => {
    setSameAsPhone(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, whatsapp: prev.phone }));
      if (errors.whatsapp) setErrors(prev => ({ ...prev, whatsapp: false }));
    }
  };

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const { addToast } = useToastStore();
  const [experiences, setExperiences] = useState<any[]>([]);
  const [showExpForm, setShowExpForm] = useState(false);
  const [currentExp, setCurrentExp] = useState({
    position: '',
    duration_text: '',
    work_locations: [] as string[],
    tasks: [] as string[],
    has_allergies: false,
  });
  const [files, setFiles] = useState<{ photo: File | null; photo2: File | null; cin_file: File | null; cin_verso_file: File | null; attestation_file: File | null; fiche_antropometrique: File | null }>({
    photo: null, photo2: null, cin_file: null, cin_verso_file: null, attestation_file: null, fiche_antropometrique: null,
  });
  const [clearedFiles, setClearedFiles] = useState<Record<string, boolean>>({});
  const [activePhoto, setActivePhoto] = useState<string>(initialAgent?.active_photo || 'photo');

  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const photo2InputRef = React.useRef<HTMLInputElement>(null);
  const cinVersoInputRef = React.useRef<HTMLInputElement>(null);
  const cinInputRef = React.useRef<HTMLInputElement>(null);
  const attestationInputRef = React.useRef<HTMLInputElement>(null);
  const antropometriqueInputRef = React.useRef<HTMLInputElement>(null);

  const toggleLanguage = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  const handleFileChange = (field: keyof typeof files, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFiles(prev => ({ ...prev, [field]: e.target.files![0] }));
  };

  const handleSave = async () => {
    const requiredFields = [
      'last_name', 'first_name', 'neighborhood', 'city', 'cin', 'birth_date',
      'gender', 'phone', 'whatsapp', 'situation', 'nationality',
      'type_profil',
      'health_issues', 'physical_appearance', 'corpulence',
    ];
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    requiredFields.forEach(field => {
      if (!formData[field as keyof typeof formData]) { newErrors[field] = true; hasError = true; }
    });

    if (formData.statut === 'stand_by' && !formData.standby_days) {
      newErrors.standby_days = true;
      hasError = true;
    }
    if (formData.statut === 'en_conge' && (!formData.leave_start || !formData.leave_end)) {
      newErrors.leave_start = !formData.leave_start;
      newErrors.leave_end = !formData.leave_end;
      hasError = true;
    }

    if (formData.languages.length === 0) { newErrors.languages = true; hasError = true; }

    const hasActiveDay = Object.values(formData.availability_calendar).some(day => day.active);
    if (!hasActiveDay) {
      newErrors.availability_calendar = true;
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      if (newErrors.availability_calendar) {
        addToast('Au moins un jour requis pour le calendrier de disponibilité.', 'error');
      } else {
        addToast('Veuillez remplir tous les champs obligatoires (*)', 'error');
      }
      return;
    }
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, ['languages', 'availability_calendar'].includes(key) ? JSON.stringify(value) : String(value));
      });
      data.append('experiences_json', JSON.stringify(experiences));
      data.append('active_photo', activePhoto);

      // Append new files
      if (files.photo) data.append('photo', files.photo);
      if (files.photo2) data.append('photo2', files.photo2);
      if (files.cin_file) data.append('cin_file', files.cin_file);
      if (files.cin_verso_file) data.append('cin_verso_file', files.cin_verso_file);
      if (files.attestation_file) data.append('attestation_file', files.attestation_file);
      if (files.fiche_antropometrique) data.append('fiche_antropometrique', files.fiche_antropometrique);

      // Handle cleared files by sending empty strings
      Object.entries(clearedFiles).forEach(([key, isCleared]) => {
        if (isCleared && !files[key as keyof typeof files]) {
          data.append(key, '');
        }
      });

      if (isEditing && initialAgent) {
        await updateAgent(initialAgent.id, data as any);
        addToast('Profil mis à jour avec succès !', 'success');
      } else {
        await createAgent(data as any);
        addToast('Profil ajouté avec succès !', 'success');
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving agent:', err);
      addToast("Erreur lors de l'enregistrement du profil.", 'error');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large profile-form-modal">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-slate-800">{isEditing ? 'Modifier le profil' : 'Ajouter un profil'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Hidden file inputs */}
          <input type="file" ref={photoInputRef} accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange('photo', e)} />
          <input type="file" ref={photo2InputRef} accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange('photo2', e)} />
          <input type="file" ref={cinVersoInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('cin_verso_file', e)} />
          <input type="file" ref={cinInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('cin_file', e)} />
          <input type="file" ref={attestationInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('attestation_file', e)} />
          <input type="file" ref={antropometriqueInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('fiche_antropometrique', e)} />

          {/* ── Informations personnelles ── */}
          <div className="form-section">
            <h3 className="section-title">
              <User size={18} className="text-slate-500" />
              Informations personnelles
            </h3>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Date d'enregistrement</label>
                <input type="text" value={formData.registration_date ? new Date(formData.registration_date).toLocaleDateString('fr-FR') : ''} disabled className="form-input bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>
              <div className="form-group">
                <label>Type de profil <span className="text-red-500">*</span></label>
                <select value={formData.type_profil} onChange={e => { setFormData({ ...formData, type_profil: e.target.value }); if (errors.type_profil) setErrors({ ...errors, type_profil: false }); }} className={`form-select ${errors.type_profil ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {TYPES_PROFIL.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Nom <span className="text-red-500">*</span></label>
                <input type="text" value={formData.last_name} onChange={e => { setFormData({ ...formData, last_name: e.target.value }); if (errors.last_name) setErrors({ ...errors, last_name: false }); }} className={`form-input ${errors.last_name ? 'form-input-error' : ''}`} placeholder="Bernat" />
              </div>
              <div className="form-group">
                <label>Prénom <span className="text-red-500">*</span></label>
                <input type="text" value={formData.first_name} onChange={e => { setFormData({ ...formData, first_name: e.target.value }); if (errors.first_name) setErrors({ ...errors, first_name: false }); }} className={`form-input ${errors.first_name ? 'form-input-error' : ''}`} placeholder="Jean" />
              </div>
              <div className="form-group">
                <label>Quartier <span className="text-red-500">*</span></label>
                <input type="text" value={formData.neighborhood} onChange={e => { setFormData({ ...formData, neighborhood: e.target.value }); if (errors.neighborhood) setErrors({ ...errors, neighborhood: false }); }} placeholder="Saisir le quartier" className={`form-input ${errors.neighborhood ? 'form-input-error' : ''}`} />
              </div>
            </div>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Ville <span className="text-red-500">*</span></label>
                <select value={formData.city} onChange={e => { setFormData({ ...formData, city: e.target.value }); if (errors.city) setErrors({ ...errors, city: false }); }} className={`form-select ${errors.city ? 'form-input-error' : ''}`}>
                  <option>Casablanca</option>
                  <option>Rabat</option>
                  <option>Salé</option>
                  <option>Temara</option>
                  <option>Ain Aouda</option>
                  <option>El Harhoura</option>
                  <option>Marrakech</option>
                </select>
              </div>
              <div className="form-group">
                <label>Numéro CIN <span className="text-red-500">*</span></label>
                <input type="text" value={formData.cin} onChange={e => { setFormData({ ...formData, cin: e.target.value }); if (errors.cin) setErrors({ ...errors, cin: false }); }} className={`form-input ${errors.cin ? 'form-input-error' : ''}`} placeholder="Z123456" />
              </div>
              <div className="form-group">
                <label>Date de naissance <span className="text-red-500">*</span></label>
                <input type="date" value={formData.birth_date} onChange={e => { setFormData({ ...formData, birth_date: e.target.value }); if (errors.birth_date) setErrors({ ...errors, birth_date: false }); }} className={`form-input ${errors.birth_date ? 'form-input-error' : ''}`} />
              </div>
            </div>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Sexe <span className="text-red-500">*</span></label>
                <select value={formData.gender} onChange={e => { setFormData({ ...formData, gender: e.target.value }); if (errors.gender) setErrors({ ...errors, gender: false }); }} className={`form-select ${errors.gender ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                </select>
              </div>
              <div className="form-group">
                <label>Téléphone <span className="text-red-500">*</span></label>
                <input type="text" value={formData.phone} onChange={e => handlePhoneChange(e.target.value)} className={`form-input ${errors.phone ? 'form-input-error' : ''}`} placeholder="06.." />
              </div>
              <div className="form-group">
                <div className="flex items-center justify-between">
                  <label>WhatsApp <span className="text-red-500">*</span></label>
                  <label className="checkbox-container text-xs text-slate-600 flex items-center gap-1 cursor-pointer font-normal mb-1">
                    <input type="checkbox" checked={sameAsPhone} onChange={e => handleSameAsPhoneToggle(e.target.checked)} />
                    <span className="checkbox-label" style={{ fontSize: '11px', textTransform: 'none' }}>Identique au tél</span>
                  </label>
                </div>
                <input type="text" value={formData.whatsapp} onChange={e => handleWhatsappChange(e.target.value)} className={`form-input ${errors.whatsapp ? 'form-input-error' : ''}`} placeholder="06.." />
              </div>
            </div>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Situation matrimoniale <span className="text-red-500">*</span></label>
                <select value={formData.situation} onChange={e => { setFormData({ ...formData, situation: e.target.value }); if (errors.situation) setErrors({ ...errors, situation: false }); }} className={`form-select ${errors.situation ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {SITUATIONS_MATRIMONIALES.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-group flex items-center pt-6">
                <label className="checkbox-container">
                  <input type="checkbox" checked={formData.has_children} onChange={e => setFormData({ ...formData, has_children: e.target.checked })} />
                  <span className="checkbox-label">A des enfants</span>
                </label>
              </div>
              <div className="form-group">
                <label>Nationalité <span className="text-red-500">*</span></label>
                <select value={formData.nationality} onChange={e => { setFormData({ ...formData, nationality: e.target.value }); if (errors.nationality) setErrors({ ...errors, nationality: false }); }} className={`form-select ${errors.nationality ? 'form-input-error' : ''}`}>
                  {NATIONALITES.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group mt-2">
              <label>Langues <span className="text-red-500">*</span></label>
              <div className={`flex flex-wrap gap-2 mt-1 p-2 rounded-lg ${errors.languages ? 'border border-red-500 bg-red-50' : ''}`}>
                {['Arabe', 'Français', 'Anglais', 'Espagnol', 'Amazigh', 'Autre'].map(lang => (
                  <button key={lang} type="button" onClick={() => { toggleLanguage(lang); if (errors.languages) setErrors({ ...errors, languages: false }); }} className={`lang-btn ${formData.languages.includes(lang) ? 'lang-btn-active' : ''}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid grid-cols-2 mt-2">
              <div className="form-group">
                <label>Expérience (années)</label>
                <input type="number" min="0" value={formData.experience_years} onChange={e => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })} className="form-input" />
              </div>
              <div className="form-group">
                <label>Expérience (mois)</label>
                <input type="number" min="0" max="11" value={formData.experience_months} onChange={e => setFormData({ ...formData, experience_months: parseInt(e.target.value) || 0 })} className="form-input" />
              </div>
            </div>

            <div className="form-grid grid-cols-2">
              <div className="form-group">
                <label>Statut du profil</label>
                <select value={formData.statut} onChange={e => setFormData({ ...formData, statut: e.target.value })} className="form-select">
                  {STATUT_PROFIL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Disponibilité d'intervention</label>
                <select value={formData.disponibilite_intervention} disabled className="form-select bg-slate-50 text-slate-500 cursor-not-allowed">
                  <option value="disponible">Disponible</option>
                  <option value="non_disponible">Non disponible</option>
                  <option value="occupee">Occupée (en mission)</option>
                </select>
              </div>
            </div>

            {formData.statut === 'stand_by' && (
              <div className="form-grid grid-cols-3 mt-2">
                <div className="form-group">
                  <label>Nombre de jours en standby <span className="text-red-500">*</span></label>
                  <input type="number" min="1" value={formData.standby_days || ''} onChange={e => setFormData({ ...formData, standby_days: parseInt(e.target.value) || 0 })} className={`form-input ${errors.standby_days ? 'form-input-error' : ''}`} placeholder="Ex: 5" />
                </div>
              </div>
            )}

            {formData.statut === 'en_conge' && (
              <div className="form-grid grid-cols-2 mt-2">
                <div className="form-group">
                  <label>Congé du <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.leave_start || ''} onChange={e => setFormData({ ...formData, leave_start: e.target.value })} className={`form-input ${errors.leave_start ? 'form-input-error' : ''}`} />
                </div>
                <div className="form-group">
                  <label>au <span className="text-red-500">*</span></label>
                  <input type="date" value={formData.leave_end || ''} onChange={e => setFormData({ ...formData, leave_end: e.target.value })} className={`form-input ${errors.leave_end ? 'form-input-error' : ''}`} />
                </div>
              </div>
            )}
          </div>

          {/* ── Caractéristiques ── */}
          <div className="form-section">
            <h3 className="section-title">
              <Plus size={18} className="text-teal-600" />
              Caractéristiques
            </h3>
            <div className="form-grid grid-cols-3">
              <div className="form-group flex items-center pt-6">
                <label className="checkbox-container">
                  <input type="checkbox" checked={formData.can_read_write} onChange={e => setFormData({ ...formData, can_read_write: e.target.checked })} />
                  <span className="checkbox-label">Sait lire et écrire</span>
                </label>
              </div>
              <div className="form-group">
                <label>Maladie / Handicap <span className="text-red-500">*</span></label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => { setFormData({ ...formData, health_issues: 'Oui' }); if (errors.health_issues) setErrors({ ...errors, health_issues: false }); }}
                    className={`segmented-btn ${formData.health_issues === 'Oui' ? 'active' : ''}`}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormData({ ...formData, health_issues: 'Non' }); if (errors.health_issues) setErrors({ ...errors, health_issues: false }); }}
                    className={`segmented-btn ${formData.health_issues !== 'Oui' ? 'active' : ''}`}
                  >
                    Non
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Présentation physique <span className="text-red-500">*</span></label>
                <select value={formData.physical_appearance} onChange={e => { setFormData({ ...formData, physical_appearance: e.target.value }); if (errors.physical_appearance) setErrors({ ...errors, physical_appearance: false }); }} className={`form-select ${errors.physical_appearance ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {PRESENTATIONS_PHYSIQUES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid grid-cols-3 mt-4">
              <div className="form-group">
                <label>Corpulence <span className="text-red-500">*</span></label>
                <select value={formData.corpulence} onChange={e => { setFormData({ ...formData, corpulence: e.target.value }); if (errors.corpulence) setErrors({ ...errors, corpulence: false }); }} className={`form-select ${errors.corpulence ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {CORPULENCES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Pointure de chaussures</label>
                <select value={formData.shoe_size || '36'} onChange={e => setFormData({ ...formData, shoe_size: e.target.value })} className="form-select">
                  {Array.from({ length: 16 }, (_, i) => 30 + i).map(size => (
                    <option key={size} value={String(size)}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Allergie aux animaux</label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, allergy_animals: true })}
                    className={`segmented-btn ${formData.allergy_animals ? 'active' : ''}`}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, allergy_animals: false })}
                    className={`segmented-btn ${!formData.allergy_animals ? 'active' : ''}`}
                  >
                    Non
                  </button>
                </div>
              </div>
            </div>
            <div className="form-grid grid-cols-3 mt-4">
              <div className="form-group">
                <label>Fume</label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_smoking: true })}
                    className={`segmented-btn ${formData.is_smoking ? 'active' : ''}`}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_smoking: false })}
                    className={`segmented-btn ${!formData.is_smoking ? 'active' : ''}`}
                  >
                    Non
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Disponibilité ── */}
          <div className="form-section">
            <h3 className="section-title">
              <Calendar size={18} className="text-slate-500" />
              Calendrier de disponibilité
            </h3>

            <div className="form-group mb-6">
              <div className={`border border-slate-200 rounded-lg overflow-hidden ${errors.availability_calendar ? 'border-red-500 bg-red-50/20' : ''}`}>
                {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((day) => {
                  const dayCal = formData.availability_calendar[day as keyof typeof formData.availability_calendar] || { active: false, start: '08:00', end: '18:00' };
                  return (
                    <div key={day} className={`scheduler-row ${dayCal.active ? 'active' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => {
                            const updatedCal = {
                              ...formData.availability_calendar,
                              [day]: { ...dayCal, active: !dayCal.active }
                            };
                            setFormData({ ...formData, availability_calendar: updatedCal });
                            if (errors.availability_calendar) setErrors({ ...errors, availability_calendar: false });
                          }}
                          className={`switch-wrapper ${dayCal.active ? 'active' : ''}`}
                        >
                          <div className="switch-knob" />
                        </div>
                        <span className={`text-sm font-semibold capitalize w-24 transition-colors ${dayCal.active ? 'text-teal-800' : 'text-slate-400'}`}>
                          {day}
                        </span>
                      </div>
                      {dayCal.active ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayCal.start}
                            onChange={(e) => {
                              const updatedCal = {
                                ...formData.availability_calendar,
                                [day]: { ...dayCal, start: e.target.value }
                              };
                              setFormData({ ...formData, availability_calendar: updatedCal });
                            }}
                            className="form-input py-1 px-2 text-xs w-24 text-center"
                            style={{ height: '34px', borderRadius: '6px' }}
                          />
                          <span className="text-xs text-slate-500">à</span>
                          <input
                            type="time"
                            value={dayCal.end}
                            onChange={(e) => {
                              const updatedCal = {
                                ...formData.availability_calendar,
                                [day]: { ...dayCal, end: e.target.value }
                              };
                              setFormData({ ...formData, availability_calendar: updatedCal });
                            }}
                            className="form-input py-1 px-2 text-xs w-24 text-center"
                            style={{ height: '34px', borderRadius: '6px' }}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium italic">Indisponible</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {errors.availability_calendar && (
                <span className="text-xs text-red-500 mt-1 block">Au moins un jour requis.</span>
              )}
            </div>

            <div className="form-group mt-5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Disponibilités additionnelles</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'avail_emergencies', label: 'Disponible pour les urgences' },
                  { key: 'avail_holidays', label: 'Jours fériés' },
                  { key: 'avail_evening', label: 'Soirée (après 18h)' },
                ].map(({ key, label }) => {
                  const isActive = Boolean(formData[key as keyof typeof formData]);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, [key]: !isActive })}
                      className={`tag-btn ${isActive ? 'tag-btn-active' : ''}`}
                      style={{ borderRadius: '8px' }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Remarque du recruteur ── */}
          <div className="form-section">
            <h3 className="section-title">
              <FileText size={18} className="text-slate-500" />
              Remarque du recruteur
            </h3>
            <div className="form-group">
              <textarea
                value={formData.recruiter_notes}
                onChange={e => setFormData({ ...formData, recruiter_notes: e.target.value })}
                placeholder="Visible uniquement sur le profil interne et non sur la fiche envoyée au client..."
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>

          {/* ── Média ── */}
          <div className="form-section">
            <h3 className="section-title">
              <Save size={18} className="text-slate-500" />
              Média (Documents et Photos)
            </h3>

            <div className="form-grid grid-cols-3 mb-6">
              {[
                { field: 'photo', label: 'Photo 1', isImage: true, icon: User, ref: photoInputRef },
                { field: 'photo2', label: 'Photo 2', isImage: true, icon: User, ref: photo2InputRef },
                { field: 'cin_file', label: 'CIN Recto', isImage: false, icon: Search, ref: cinInputRef },
                { field: 'cin_verso_file', label: 'CIN Verso', isImage: false, icon: Search, ref: cinVersoInputRef },
                { field: 'attestation_file', label: 'Attestation', isImage: false, icon: RotateCw, ref: attestationInputRef },
                { field: 'fiche_antropometrique', label: 'Fiche antropométrique', isImage: false, icon: FileText, ref: antropometriqueInputRef },
              ].map(({ field, label, isImage, icon: Icon, ref }) => {
                const hasNewFile = Boolean(files[field as keyof typeof files]);
                const existingFileUrl = initialAgent ? (initialAgent as any)[field] : null;
                const isCleared = clearedFiles[field];
                const hasFile = hasNewFile || (existingFileUrl && !isCleared);

                return (
                  <div key={field} className="form-group flex flex-col mb-4">
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                      {label} {hasFile && <span className="text-teal-500">✓</span>}
                    </label>
                    {hasFile ? (
                      <div className="flex items-center justify-between p-3 border border-teal-200 bg-teal-50 rounded-lg">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Icon size={16} className="text-teal-600 flex-shrink-0" />
                          <span className="text-xs text-slate-700 truncate">
                            {hasNewFile ? files[field as keyof typeof files]!.name : (isImage ? 'Image existante' : 'Document existant')}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-600 p-1"
                          onClick={() => {
                            if (hasNewFile) {
                              setFiles(prev => ({ ...prev, [field]: null }));
                            } else if (existingFileUrl) {
                              setClearedFiles(prev => ({ ...prev, [field]: true }));
                              if (activePhoto === field) setActivePhoto('photo');
                            }
                          }}
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="upload-box w-full py-3" onClick={() => ref.current?.click()}>
                        <Icon size={16} />
                        <span className="text-xs">{isImage ? "Choisir l'image" : "Choisir un fichier"}</span>
                      </button>
                    )}
                    {isImage && hasFile && (
                      <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-slate-600">
                        <input
                          type="radio"
                          name="active_photo"
                          checked={activePhoto === field}
                          onChange={() => setActivePhoto(field)}
                          className="accent-teal-600"
                        />
                        Photo principale
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Expériences ── */}
          <div className="form-section">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title mb-0">
                <RotateCw size={18} className="text-slate-500" />
                Les expériences
              </h3>
              <button className="btn-premium btn-premium-outline btn-premium-sm" onClick={() => { if (!showExpForm) setShowExpForm(true); }}>
                <Plus size={16} />
                Ajouter une expérience
              </button>
            </div>

            {showExpForm && (
              <div className="experience-form-container mb-4">
                <div className="form-grid grid-cols-3 mb-4">
                  <div className="form-group">
                    <label>Poste</label>
                    <select value={currentExp.position} onChange={e => setCurrentExp({ ...currentExp, position: e.target.value })} className="form-select">
                      <option value="">Choisir le poste</option>
                      {TYPES_POSTE_EXPERIENCE.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </div>
                  {currentExp.position && (
                    <>
                      <div className="form-group">
                        <label>Depuis combien de temps ?</label>
                        <input type="text" value={currentExp.duration_text} onChange={e => setCurrentExp({ ...currentExp, duration_text: e.target.value })} placeholder="Ex: 3 ans" className="form-input" />
                      </div>
                      <div className="form-group flex items-center pt-6">
                        <label className="checkbox-container">
                          <input type="checkbox" checked={currentExp.has_allergies} onChange={e => setCurrentExp({ ...currentExp, has_allergies: e.target.checked })} />
                          <span className="checkbox-label text-slate-700">Allergies produits ménagers</span>
                        </label>
                      </div>
                    </>
                  )}
                </div>

                {currentExp.position && (
                  <>
                    <div className="form-group mb-4">
                      <label>Lieux de travail</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {LIEUX_TRAVAIL.map(loc => (
                          <button key={loc} type="button" onClick={() => {
                            const locations = currentExp.work_locations.includes(loc)
                              ? currentExp.work_locations.filter(l => l !== loc)
                              : [...currentExp.work_locations, loc];
                            setCurrentExp({ ...currentExp, work_locations: locations });
                          }} className={`tag-btn ${currentExp.work_locations.includes(loc) ? 'tag-btn-active' : ''}`}>
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group mb-4">
                      <label className="mb-3 block">Tâches</label>
                      <div className="task-grid">
                        {TACHES_MENAGE.map(task => (
                          <label key={task} className="checkbox-container">
                            <input type="checkbox" checked={currentExp.tasks.includes(task)} onChange={() => {
                              const tasks = currentExp.tasks.includes(task)
                                ? currentExp.tasks.filter(t => t !== task)
                                : [...currentExp.tasks, task];
                              setCurrentExp({ ...currentExp, tasks });
                            }} />
                            <span className="checkbox-label" style={{ textTransform: 'none' }}>{task}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button className="btn-premium btn-premium-outline btn-premium-sm border-none shadow-none text-slate-500 hover:text-slate-800" onClick={() => setShowExpForm(false)}>Annuler</button>
                  <button className="btn-premium btn-premium-teal btn-premium-sm" onClick={() => {
                    if (currentExp.position) {
                      setExperiences([...experiences, currentExp]);
                      setCurrentExp({ position: '', duration_text: '', work_locations: [], tasks: [], has_allergies: false });
                      setShowExpForm(false);
                    }
                  }}>Ajouter</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {experiences.map((exp, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-teal-100 bg-teal-50/40">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{exp.position}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{exp.duration_text}{exp.work_locations.length > 0 ? ` · ${exp.work_locations.join(', ')}` : ''}</p>
                  </div>
                  <button className="text-red-400 hover:text-red-600 text-lg leading-none px-2" onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))}>&times;</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer flex justify-end gap-3">
          <button className="btn-premium btn-premium-outline" onClick={onClose}>
            <XCircle size={16} /> Annuler
          </button>
          <button className="btn-premium btn-premium-teal" onClick={handleSave}>
            <Save size={18} />
            {isEditing ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
