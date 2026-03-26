import React, { useEffect, useState } from 'react';
import { getAgents, createAgent } from '../api/client';
import { Search, Plus, RotateCw, Calendar, ChevronDown, User, Save } from 'lucide-react';

interface Agent {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  whatsapp: string;
  poste: string;
  statut: string;
  city: string;
  neighborhood: string;
  experience: string;
  languages: string[];
  nationality: string;
  cin: string;
  situation: string;
  photo: string | null;
  created_at: string;
}

const TABS = [
  { id: 'tout', label: 'Tout' },
  { id: 'grand_menage', label: 'Grand ménage' },
  { id: 'menage_chantier', label: 'Ménage chantier' },
  { id: 'nettoyage_vitres', label: 'Nettoyage de vitres' }
];

export default function Profils() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('tout');
  const [commercialFilter, setCommercialFilter] = useState('Tout');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (activeTab !== 'tout') params.poste = activeTab;
      if (commercialFilter !== 'Tout') params.commercial = commercialFilter;
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin) params.date_fin = dateFin;

      const { data } = await getAgents(params);
      setAgents(data.results || data);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, activeTab]);

  const getInitials = (agent: Agent) => {
    return `${agent.first_name?.[0] || ''}${agent.last_name?.[0] || ''}`.toUpperCase();
  };

  return (
    <div className="page" style={{ backgroundColor: 'white' }}>
      <div className="page-header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Listing Profils</h1>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RotateCw size={18} />
            Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            Ajouter Profil
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddProfileModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchData();
          }}
        />
      )}

      <div className="client-tabs">
        {TABS.map(tab => (
          <div
            key={tab.id}
            className={`client-tab ${activeTab === tab.id ? 'client-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div className="client-toolbar">
        <div className="search-box" style={{ flex: '0 0 600px' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro, ville, quartier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="client-toolbar-filters">
          <div className="toolbar-dropdown">
            <select value={commercialFilter} onChange={e => setCommercialFilter(e.target.value)} className="toolbar-select">
              <option>Tous</option>
              <option>Kaoutar</option>
              <option>Amine</option>
              <option>Yassine</option>
            </select>
            <ChevronDown size={16} className="dropdown-icon" />
          </div>

          <div className="toolbar-date-picker">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Du"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="date-input"
            />
          </div>
          <div className="toolbar-date-picker">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Au"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="date-input"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Téléphone</th>
                <th>WhatsApp</th>
                <th>Situation</th>
                <th>Nationalité</th>
                <th>CIN</th>
                <th>Quartier / Ville</th>
                <th>Disponibilité</th>
                <th>Langue</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    {agent.photo ? (
                      <img src={agent.photo} alt="" className="table-avatar-img" />
                    ) : (
                      <div className="table-avatar-placeholder">
                        {getInitials(agent)}
                      </div>
                    )}
                  </td>
                  <td className="font-bold text-slate-700">{agent.last_name || '—'}</td>
                  <td className="font-bold text-slate-700">{agent.first_name || '—'}</td>
                  <td className="text-slate-600 font-medium">{agent.phone || '—'}</td>
                  <td className="text-slate-600 font-medium">{agent.whatsapp || '—'}</td>
                  <td className="text-slate-600">{agent.situation || '—'}</td>
                  <td className="text-slate-600">{agent.nationality || '—'}</td>
                  <td className="text-xs font-mono text-slate-500 uppercase">{agent.cin || '—'}</td>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-bold text-teal-800 text-sm">{agent.neighborhood || ''}</span>
                      <span className="text-xs text-slate-500 uppercase">{agent.city || ''}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${agent.statut === 'disponible' ? 'badge-lime' : 'badge-status-annule'}`}>
                      {agent.statut === 'disponible' ? 'Disponible' : 'Non disponible'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-status-attente">
                      {agent.languages?.[0] || 'Français'}
                    </span>
                  </td>
                  <td>
                    <button className="actions-cell-btn py-1.5 px-3">
                      <User size={14} className="mr-2" />
                      Compte Profil
                    </button>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty-row text-center py-12 text-slate-400">Aucun profil trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddProfileModal({ onClose, onSuccess }: ModalProps) {
  const [formData, setFormData] = useState({
    last_name: '',
    first_name: '',
    neighborhood: '',
    city: 'Casablanca',
    cin: '',
    birth_date: '',
    gender: '',
    phone: '',
    whatsapp: '',
    situation: '',
    has_children: false,
    nationality: 'Marocaine',
    languages: [] as string[],
    education_level: '',
    experience_years: 0,
    experience_months: 0,
    statut: 'disponible',
    type_profil: '',
    training_details: '',
    can_read_write: false,
    health_issues: '',
    physical_appearance: '',
    corpulence: '',
    avail_emergencies: false,
    avail_7_7: false,
    avail_day: false,
    avail_holidays: false,
    avail_evening: false,
    operator_notes: '',
  });

  const [experiences, setExperiences] = useState<any[]>([]);
  const [showExpForm, setShowExpForm] = useState(false);
  const [currentExp, setCurrentExp] = useState({
    position: '',
    duration_text: '',
    work_locations: [] as string[],
    tasks: [] as string[],
    has_allergies: false
  });

  const [files, setFiles] = useState<{
    photo: File | null;
    cin_file: File | null;
    attestation_file: File | null;
  }>({
    photo: null,
    cin_file: null,
    attestation_file: null,
  });

  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const cinInputRef = React.useRef<HTMLInputElement>(null);
  const attestationInputRef = React.useRef<HTMLInputElement>(null);

  const toggleLanguage = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  const handleFileChange = (field: keyof typeof files, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFiles(prev => ({ ...prev, [field]: e.target.files![0] }));
    }
  };

  const handleSave = async () => {
    try {
      const data = new FormData();

      // Append all text/boolean fields
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'languages') {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, String(value));
        }
      });

      // Append experiences as JSON string
      data.append('experiences_json', JSON.stringify(experiences));

      // Append files
      if (files.photo) data.append('photo', files.photo);
      if (files.cin_file) data.append('cin_file', files.cin_file);
      if (files.attestation_file) data.append('attestation_file', files.attestation_file);

      await createAgent(data as any);
      onSuccess();
    } catch (err) {
      console.error('Error saving agent:', err);
      alert('Erreur lors de l\'enregistrement du profil.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-slate-800">Ajouter un profil</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {/* Hidden File Inputs */}
          <input type="file" ref={photoInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('photo', e)} />
          <input type="file" ref={cinInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('cin_file', e)} />
          <input type="file" ref={attestationInputRef} style={{ display: 'none' }} onChange={e => handleFileChange('attestation_file', e)} />

          {/* ── Informations personnelles ── */}
          <div className="form-section">
            <h3 className="section-title">
              <User size={18} className="text-teal-600" />
              Informations personnelles
            </h3>

            {/* Row 1 : Nom / Prénom / Quartier */}
            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Nom <span className="text-red-500">*</span></label>
                <input type="text" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} className="form-input" placeholder="Bernat" />
              </div>
              <div className="form-group">
                <label>Prénom <span className="text-red-500">*</span></label>
                <input type="text" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} className="form-input" placeholder="Jean" />
              </div>
              <div className="form-group">
                <label>Quartier</label>
                <input type="text" value={formData.neighborhood} onChange={e => setFormData({ ...formData, neighborhood: e.target.value })} placeholder="Saisir le quartier" className="form-input" />
              </div>
            </div>

            {/* Row 2 : Ville / Numéro CIN / Date de naissance */}
            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Ville</label>
                <select value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="form-select">
                  <option>Casablanca</option>
                  <option>Rabat</option>
                  <option>Marrakech</option>
                </select>
              </div>
              <div className="form-group">
                <label>Numéro CIN</label>
                <input type="text" value={formData.cin} onChange={e => setFormData({ ...formData, cin: e.target.value })} className="form-input" placeholder="Z123456" />
              </div>
              <div className="form-group">
                <label>Date de naissance</label>
                <input type="date" value={formData.birth_date} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} className="form-input" />
              </div>
            </div>

            {/* Row 3 : Sexe / Téléphone / WhatsApp */}
            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Sexe</label>
                <select value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className="form-select">
                  <option value="">Choisir</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                </select>
              </div>
              <div className="form-group">
                <label>Téléphone</label>
                <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="form-input" placeholder="06.." />
              </div>
              <div className="form-group">
                <label>WhatsApp</label>
                <input type="text" value={formData.whatsapp} onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} className="form-input" placeholder="06.." />
              </div>
            </div>

            {/* Row 4 : Situation matrimoniale / A des enfants / Nationalité */}
            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Situation matrimoniale</label>
                <select value={formData.situation} onChange={e => setFormData({ ...formData, situation: e.target.value })} className="form-select">
                  <option value="">Choisir</option>
                  <option>Célibataire</option>
                  <option>Marié(e)</option>
                  <option>Divorcé(e)</option>
                  <option>Veuf/Veuve</option>
                </select>
              </div>
              <div className="form-group flex items-center pt-6">
                <label className="checkbox-container">
                  <input type="checkbox" checked={formData.has_children} onChange={e => setFormData({ ...formData, has_children: e.target.checked })} />
                  <span className="checkbox-label">A des enfants</span>
                </label>
              </div>
              <div className="form-group">
                <label>Nationalité</label>
                <select value={formData.nationality} onChange={e => setFormData({ ...formData, nationality: e.target.value })} className="form-select">
                  <option>Marocaine</option>
                  <option>Ivoirienne</option>
                  <option>Sénégalaise</option>
                  <option>Autre</option>
                </select>
              </div>
            </div>

            {/* Langues */}
            <div className="form-group mt-2">
              <label>Langues</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['Arabe', 'Français', 'Anglais', 'Espagnol', 'Amazigh', 'Autre'].map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`lang-btn ${formData.languages.includes(lang) ? 'lang-btn-active' : ''}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 5 : Niveau d'étude / Expérience années / Expérience mois */}
            <div className="form-grid grid-cols-3 mt-2">
              <div className="form-group">
                <label>Niveau d'étude</label>
                <select value={formData.education_level} onChange={e => setFormData({ ...formData, education_level: e.target.value })} className="form-select">
                  <option value="">Choisir</option>
                  <option>Sans diplôme</option>
                  <option>Primaire</option>
                  <option>Collège</option>
                  <option>Lycée</option>
                  <option>Bac</option>
                  <option>Bac+2</option>
                  <option>Bac+3</option>
                  <option>Bac+5</option>
                  <option>Autre</option>
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

            {/* Row 6 : Statut profil / Type de profil */}
            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Statut profil</label>
                <select value={formData.statut} onChange={e => setFormData({ ...formData, statut: e.target.value })} className="form-select">
                  <option value="disponible">Disponible</option>
                  <option value="non_disponible">Non disponible</option>
                </select>
              </div>
              <div className="form-group">
                <label>Type de profil</label>
                <select value={formData.type_profil} onChange={e => setFormData({ ...formData, type_profil: e.target.value })} className="form-select">
                  <option value="">Choisir</option>
                  <option>Femme de ménage</option>
                  <option>Garde malade</option>
                  <option>Auxiliaire de vie</option>
                  <option>Nounou</option>
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
              <label>Formation requise</label>
              <textarea
                value={formData.training_details}
                onChange={e => setFormData({ ...formData, training_details: e.target.value })}
                placeholder="Détails de la formation..."
                className="form-textarea"
                rows={3}
              />
            </div>

            {/* Row : Sait lire et écrire / Maladie-Handicap / Présentation physique */}
            <div className="form-grid grid-cols-3 mt-4">
              <div className="form-group flex items-center pt-6">
                <label className="checkbox-container">
                  <input type="checkbox" checked={formData.can_read_write} onChange={e => setFormData({ ...formData, can_read_write: e.target.checked })} />
                  <span className="checkbox-label">Sait lire et écrire</span>
                </label>
              </div>
              <div className="form-group">
                <label>Maladie / Handicap</label>
                <input type="text" value={formData.health_issues} onChange={e => setFormData({ ...formData, health_issues: e.target.value })} placeholder="Aucun" className="form-input" />
              </div>
              <div className="form-group">
                <label>Présentation physique</label>
                <select value={formData.physical_appearance} onChange={e => setFormData({ ...formData, physical_appearance: e.target.value })} className="form-select">
                  <option value="">Choisir</option>
                  <option>Correcte</option>
                  <option>Moyenne</option>
                  <option>Excellente</option>
                </select>
              </div>
            </div>

            {/* Corpulence alone */}
            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Corpulence</label>
                <select value={formData.corpulence} onChange={e => setFormData({ ...formData, corpulence: e.target.value })} className="form-select">
                  <option value="">Choisir</option>
                  <option>Mince</option>
                  <option>Moyenne</option>
                  <option>Forte</option>
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
                  <input
                    type="checkbox"
                    checked={formData[key as keyof typeof formData] as boolean}
                    onChange={e => setFormData({ ...formData, [key]: e.target.checked })}
                  />
                  <span className="checkbox-label">{label}</span>
                </label>
              ))}
            </div>

            <div className="form-group mt-6">
              <label>Note de l'opérateur</label>
              <textarea
                value={formData.operator_notes}
                onChange={e => setFormData({ ...formData, operator_notes: e.target.value })}
                placeholder="Remarques..."
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>



          {/* ── Média ── */}
          <div className="form-section">
            <h3 className="section-title">
              <Save size={18} className="text-teal-600" />
              Média
            </h3>
            <div className="form-grid grid-cols-3">
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
                  <Plus size={16} />
                  <span className="text-xs">{files.attestation_file ? files.attestation_file.name : 'Choisir'}</span>
                </button>
              </div>
            </div>
          </div>



          {/* ── Les expériences ── */}
          <div className="form-section">
            <div className="flex justify-between items-center mb-4">
              <h3 className="section-title mb-0">
                <RotateCw size={18} className="text-teal-600" />
                Les expériences
              </h3>
              <button
                className="btn-premium btn-premium-outline btn-premium-sm"
                onClick={() => { if (!showExpForm) setShowExpForm(true); }}
              >
                <Plus size={16} />
                Ajouter un poste
              </button>
            </div>

            {showExpForm && (
              <div className="experience-form-container mb-4">
                {/* Row 1 : Poste / Depuis combien de temps ? / Allergies */}
                <div className="form-grid grid-cols-3 mb-4">
                  <div className="form-group">
                    <label>Poste</label>
                    <select value={currentExp.position} onChange={e => setCurrentExp({ ...currentExp, position: e.target.value })} className="form-select">
                      <option value="">Choisir le poste</option>
                      <option>Femme de ménage</option>
                      <option>Garde malade</option>
                      <option>Auxiliaire de vie</option>
                      <option>Nounou</option>
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
                    {/* Lieux de travail - Keep separate as it has many tags */}
                    <div className="form-group mb-4">
                      <label>Lieux de travail</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {['Hôtel', 'Riad', 'Entreprise', 'Villa', 'Appartement', 'Duplex'].map(loc => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => {
                              const locations = currentExp.work_locations.includes(loc)
                                ? currentExp.work_locations.filter(l => l !== loc)
                                : [...currentExp.work_locations, loc];
                              setCurrentExp({ ...currentExp, work_locations: locations });
                            }}
                            className={`tag-btn ${currentExp.work_locations.includes(loc) ? 'tag-btn-active' : ''}`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Allergies */}
                    <div className="form-group mb-4">
                      <label className="checkbox-container">
                        <input type="checkbox" checked={currentExp.has_allergies} onChange={e => setCurrentExp({ ...currentExp, has_allergies: e.target.checked })} className="mr-3 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                        <span className="checkbox-label">Allergies produits ménagers</span>
                      </label>
                    </div>

                    {/* Tâches */}
                    <div className="form-group mb-4">
                      <label className="mb-3 block">Tâches</label>
                      <div className="task-grid">
                        {[
                          'Faire le lit', "Passer l'aspirateur",
                          'Laver le sol', 'Dépoussiérer les meubles',
                          'Nettoyer les vitres et miroirs', "Nettoyer le plan de travail et l'évier",
                          'Nettoyer le réfrigérateur et les appareils électroménagers', 'Nettoyage douche',
                          'Nettoyage terrasse et balcon', 'Repasser et plier les vêtements',
                          'Ranger les placards', 'Grand ménage'
                        ].map(task => (
                          <label key={task} className="checkbox-container">
                            <input
                              type="checkbox"
                              checked={currentExp.tasks.includes(task)}
                              onChange={() => {
                                const tasks = currentExp.tasks.includes(task)
                                  ? currentExp.tasks.filter(t => t !== task)
                                  : [...currentExp.tasks, task];
                                setCurrentExp({ ...currentExp, tasks });
                              }}
                            />
                            <span className="checkbox-label" style={{ textTransform: 'none' }}>{task}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Experience form actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className="btn-premium btn-premium-outline btn-premium-sm border-none shadow-none text-slate-500 hover:text-slate-800"
                    onClick={() => setShowExpForm(false)}
                  >
                    Annuler
                  </button>
                  <button
                    className="btn-premium btn-premium-teal btn-premium-sm"
                    onClick={() => {
                      if (currentExp.position) {
                        setExperiences([...experiences, currentExp]);
                        setCurrentExp({ position: '', duration_text: '', work_locations: [], tasks: [], has_allergies: false });
                        setShowExpForm(false);
                      }
                    }}
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            )}

            {/* Experience list */}
            <div className="space-y-3">
              {experiences.map((exp, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-teal-100 bg-teal-50/40">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{exp.position}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{exp.duration_text}{exp.work_locations.length > 0 ? ` · ${exp.work_locations.join(', ')}` : ''}</p>
                  </div>
                  <button className="text-red-400 hover:text-red-600 text-lg leading-none px-2" onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))}>
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer flex justify-end gap-3">
          <button
            className="btn-premium btn-premium-outline"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            className="btn-premium btn-premium-teal"
            onClick={handleSave}
          >
            <Save size={18} />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
