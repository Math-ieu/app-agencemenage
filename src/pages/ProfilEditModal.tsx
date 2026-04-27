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
  NIVEAUX_ETUDE,
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
  const v = value.toLowerCase();
  if (v === 'moyenne' || v === 'normale') return 'normale';
  if (v === 'forte') return 'forte';
  if (v === 'mince' || v === 'petite') return 'petite';
  return value;
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
    statut: initialAgent?.statut || 'disponible',
    type_profil: initialAgent?.type_profil || '',
    training_details: initialAgent?.training_details || '',
    can_read_write: initialAgent?.can_read_write ?? false,
    health_issues: initialAgent?.health_issues || '',
    physical_appearance: normalizePhysicalAppearance(initialAgent?.physical_appearance || ''),
    corpulence: normalizeCorpulence(initialAgent?.corpulence || ''),
    avail_emergencies: initialAgent?.avail_emergencies ?? false,
    avail_7_7: initialAgent?.avail_7_7 ?? false,
    avail_day: initialAgent?.avail_day ?? false,
    avail_holidays: initialAgent?.avail_holidays ?? false,
    avail_evening: initialAgent?.avail_evening ?? false,
    operator_notes: initialAgent?.operator_notes || '',
  });

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
  const [files, setFiles] = useState<{ photo: File | null; cin_file: File | null; attestation_file: File | null; fiche_antropometrique: File | null }>({
    photo: null, cin_file: null, attestation_file: null, fiche_antropometrique: null,
  });

  const photoInputRef = React.useRef<HTMLInputElement>(null);
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
      'education_level', 'type_profil', 'training_details',
      'health_issues', 'physical_appearance', 'corpulence', 'operator_notes',
    ];
    const newErrors: Record<string, boolean> = {};
    let hasError = false;
    requiredFields.forEach(field => {
      if (!formData[field as keyof typeof formData]) { newErrors[field] = true; hasError = true; }
    });
    if (formData.languages.length === 0) { newErrors.languages = true; hasError = true; }
    if (hasError) {
      setErrors(newErrors);
      addToast('Veuillez remplir tous les champs obligatoires (*)', 'error');
      return;
    }
    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, key === 'languages' ? JSON.stringify(value) : String(value));
      });
      data.append('experiences_json', JSON.stringify(experiences));
      if (files.photo) data.append('photo', files.photo);
      if (files.cin_file) data.append('cin_file', files.cin_file);
      if (files.attestation_file) data.append('attestation_file', files.attestation_file);
      if (files.fiche_antropometrique) data.append('fiche_antropometrique', files.fiche_antropometrique);
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
          <input type="file" ref={photoInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('photo', e)} />
          <input type="file" ref={cinInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('cin_file', e)} />
          <input type="file" ref={attestationInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('attestation_file', e)} />
          <input type="file" ref={antropometriqueInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('fiche_antropometrique', e)} />

          {/* ── Informations personnelles ── */}
          <div className="form-section">
            <h3 className="section-title">
              <User size={18} className="text-teal-600" />
              Informations personnelles
            </h3>

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
                <input type="text" value={formData.phone} onChange={e => { setFormData({ ...formData, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: false }); }} className={`form-input ${errors.phone ? 'form-input-error' : ''}`} placeholder="06.." />
              </div>
              <div className="form-group">
                <label>WhatsApp <span className="text-red-500">*</span></label>
                <input type="text" value={formData.whatsapp} onChange={e => { setFormData({ ...formData, whatsapp: e.target.value }); if (errors.whatsapp) setErrors({ ...errors, whatsapp: false }); }} className={`form-input ${errors.whatsapp ? 'form-input-error' : ''}`} placeholder="06.." />
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

            <div className="form-grid grid-cols-3 mt-2">
              <div className="form-group">
                <label>Niveau d'étude <span className="text-red-500">*</span></label>
                <select value={formData.education_level} onChange={e => { setFormData({ ...formData, education_level: e.target.value }); if (errors.education_level) setErrors({ ...errors, education_level: false }); }} className={`form-select ${errors.education_level ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {NIVEAUX_ETUDE.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Expérience (années)</label>
                <input type="number" min="0" value={formData.experience_years} onChange={e => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })} className="form-input" />
              </div>
              <div className="form-group">
                <label>Expérience (mois)</label>
                <input type="number" min="0" max="11" value={formData.experience_months} onChange={e => setFormData({ ...formData, experience_months: parseInt(e.target.value) || 0 })} className="form-input" />
              </div>
            </div>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Statut profil</label>
                <select value={formData.statut} onChange={e => setFormData({ ...formData, statut: e.target.value })} className="form-select">
                  {STATUT_PROFIL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Type de profil <span className="text-red-500">*</span></label>
                <select value={formData.type_profil} onChange={e => { setFormData({ ...formData, type_profil: e.target.value }); if (errors.type_profil) setErrors({ ...errors, type_profil: false }); }} className={`form-select ${errors.type_profil ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {TYPES_PROFIL.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Caractéristiques ── */}
          <div className="form-section">
            <h3 className="section-title">
              <Plus size={18} className="text-teal-600" />
              Caractéristiques
            </h3>
            <div className="form-group">
              <label>Formation requise <span className="text-red-500">*</span></label>
              <textarea value={formData.training_details} onChange={e => { setFormData({ ...formData, training_details: e.target.value }); if (errors.training_details) setErrors({ ...errors, training_details: false }); }} placeholder="Détails de la formation..." className={`form-textarea ${errors.training_details ? 'form-input-error' : ''}`} rows={3} />
            </div>
            <div className="form-grid grid-cols-3 mt-4">
              <div className="form-group flex items-center pt-6">
                <label className="checkbox-container">
                  <input type="checkbox" checked={formData.can_read_write} onChange={e => setFormData({ ...formData, can_read_write: e.target.checked })} />
                  <span className="checkbox-label">Sait lire et écrire</span>
                </label>
              </div>
              <div className="form-group">
                <label>Maladie / Handicap <span className="text-red-500">*</span></label>
                <input type="text" value={formData.health_issues} onChange={e => { setFormData({ ...formData, health_issues: e.target.value }); if (errors.health_issues) setErrors({ ...errors, health_issues: false }); }} placeholder="Saisir 'Aucun' si néant" className={`form-input ${errors.health_issues ? 'form-input-error' : ''}`} />
              </div>
              <div className="form-group">
                <label>Présentation physique <span className="text-red-500">*</span></label>
                <select value={formData.physical_appearance} onChange={e => { setFormData({ ...formData, physical_appearance: e.target.value }); if (errors.physical_appearance) setErrors({ ...errors, physical_appearance: false }); }} className={`form-select ${errors.physical_appearance ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {PRESENTATIONS_PHYSIQUES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Corpulence <span className="text-red-500">*</span></label>
                <select value={formData.corpulence} onChange={e => { setFormData({ ...formData, corpulence: e.target.value }); if (errors.corpulence) setErrors({ ...errors, corpulence: false }); }} className={`form-select ${errors.corpulence ? 'form-input-error' : ''}`}>
                  <option value="">Choisir</option>
                  {CORPULENCES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Disponibilité ── */}
          <div className="form-section">
            <h3 className="section-title">
              <Calendar size={18} className="text-teal-600" />
              Disponibilité
            </h3>
            <div className="form-grid grid-cols-3">
              {[
                { key: 'avail_emergencies', label: 'Disponible pour les urgences' },
                { key: 'avail_day', label: 'Journée (7h–18h)' },
                { key: 'avail_evening', label: 'Soirée (après 18h)' },
                { key: 'avail_7_7', label: '7 jours / 7' },
                { key: 'avail_holidays', label: 'Jours fériés' },
              ].map(({ key, label }) => (
                <label key={key} className="checkbox-container">
                  <input type="checkbox" checked={formData[key as keyof typeof formData] as boolean} onChange={e => setFormData({ ...formData, [key]: e.target.checked })} />
                  <span className="checkbox-label">{label}</span>
                </label>
              ))}
            </div>
            <div className="form-group mt-6">
              <label>Note de l'opérateur <span className="text-red-500">*</span></label>
              <textarea value={formData.operator_notes} onChange={e => { setFormData({ ...formData, operator_notes: e.target.value }); if (errors.operator_notes) setErrors({ ...errors, operator_notes: false }); }} placeholder="Remarques..." className={`form-textarea ${errors.operator_notes ? 'form-input-error' : ''}`} rows={3} />
            </div>
          </div>

          {/* ── Média ── */}
          <div className="form-section">
            <h3 className="section-title">
              <Save size={18} className="text-teal-600" />
              Média
            </h3>
            <div className="form-grid grid-cols-2">
              <div className="form-group">
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Photo de profil {files.photo && <span className="text-teal-500">✓</span>}</label>
                <button className="upload-box w-full" onClick={() => photoInputRef.current?.click()}>
                  <User size={16} />
                  <span className="text-xs">{files.photo ? files.photo.name : 'Choisir'}</span>
                </button>
              </div>
              <div className="form-group">
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">CIN {files.cin_file && <span className="text-teal-500">✓</span>}</label>
                <button className="upload-box w-full" onClick={() => cinInputRef.current?.click()}>
                  <Search size={16} />
                  <span className="text-xs">{files.cin_file ? files.cin_file.name : 'Choisir'}</span>
                </button>
              </div>
              <div className="form-group">
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Attestation {files.attestation_file && <span className="text-teal-500">✓</span>}</label>
                <button className="upload-box w-full" onClick={() => attestationInputRef.current?.click()}>
                  <RotateCw size={16} />
                  <span className="text-xs">{files.attestation_file ? files.attestation_file.name : 'Choisir'}</span>
                </button>
              </div>
              <div className="form-group">
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Fiche antropométrique {files.fiche_antropometrique && <span className="text-teal-500">✓</span>}</label>
                <button className="upload-box w-full" onClick={() => antropometriqueInputRef.current?.click()}>
                  <FileText size={16} />
                  <span className="text-xs">{files.fiche_antropometrique ? files.fiche_antropometrique.name : 'Choisir'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Expériences ── */}
          <div className="form-section">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title mb-0">
                <RotateCw size={18} className="text-teal-600" />
                Les expériences
              </h3>
              <button className="btn-premium btn-premium-outline btn-premium-sm" onClick={() => { if (!showExpForm) setShowExpForm(true); }}>
                <Plus size={16} />
                Ajouter un poste
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
