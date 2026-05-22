import { useState } from 'react';
import { updateClient } from '../api/client';
import { User, Save, XCircle } from 'lucide-react';
import { useToastStore } from '../store/toast';
import { Client } from '../types';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  initialClient: Client;
}

export default function ClientEditModal({ onClose, onSuccess, initialClient }: Props) {
  const [formData, setFormData] = useState({
    first_name: initialClient.first_name || '',
    last_name: initialClient.last_name || '',
    display_name: initialClient.display_name || '',
    entity_name: initialClient.entity_name || '',
    phone: initialClient.phone || '',
    whatsapp: initialClient.whatsapp || '',
    email: initialClient.email || '',
    segment: initialClient.segment || 'particulier',
    city: initialClient.city || 'Casablanca',
    neighborhood: initialClient.neighborhood || '',
    address: initialClient.address || '',
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { addToast } = useToastStore();

  const handleSave = async () => {
    // Basic validation
    const requiredFields = ['display_name', 'phone', 'email', 'city', 'neighborhood', 'address'];

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    requiredFields.forEach(field => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = true;
        hasError = true;
      }
    });

    if (hasError) {
      setErrors(newErrors);
      addToast('Veuillez remplir tous les champs obligatoires (*)', 'error');
      return;
    }

    setLoading(true);
    try {
      await updateClient(initialClient.id, formData);
      addToast('Client mis à jour avec succès !', 'success');
      onSuccess();
    } catch (err) {
      console.error('Error updating client:', err);
      addToast('Erreur lors de la mise à jour du client.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-large profile-form-modal">
        <div className="modal-header">
          <h2 className="text-xl font-bold text-slate-800">Modifier le client</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <h3 className="section-title">
              <User size={18} className="text-teal-600" />
              Informations du client
            </h3>

            <div className="form-grid grid-cols-2">
              <div className="form-group">
                <label>Segment <span className="text-red-500">*</span></label>
                <select 
                  value={formData.segment} 
                  onChange={e => {
                    const newSegment = e.target.value as 'particulier' | 'entreprise';
                    setFormData({ ...formData, segment: newSegment });
                  }} 
                  className="form-select"
                >
                  <option value="particulier">Particulier</option>
                  <option value="entreprise">Entreprise</option>
                </select>
              </div>

              <div className="form-group">
                <label>Nom complet <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.display_name} 
                  onChange={e => { 
                    setFormData({ ...formData, display_name: e.target.value }); 
                    if (errors.display_name) setErrors({ ...errors, display_name: false }); 
                  }} 
                  className={`form-input ${errors.display_name ? 'form-input-error' : ''}`} 
                  placeholder="Ex: Jermin ROY" 
                />
              </div>
            </div>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Téléphone direct <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.phone} 
                  onChange={e => { 
                    setFormData({ ...formData, phone: e.target.value }); 
                    if (errors.phone) setErrors({ ...errors, phone: false }); 
                  }} 
                  className={`form-input ${errors.phone ? 'form-input-error' : ''}`} 
                  placeholder="+212..." 
                />
              </div>
              <div className="form-group">
                <label>WhatsApp</label>
                <input 
                  type="text" 
                  value={formData.whatsapp} 
                  onChange={e => setFormData({ ...formData, whatsapp: e.target.value })} 
                  className="form-input" 
                  placeholder="+212..." 
                />
              </div>
              <div className="form-group">
                <label>Email <span className="text-red-500">*</span></label>
                <input 
                  type="email" 
                  value={formData.email} 
                  onChange={e => { 
                    setFormData({ ...formData, email: e.target.value }); 
                    if (errors.email) setErrors({ ...errors, email: false }); 
                  }} 
                  className={`form-input ${errors.email ? 'form-input-error' : ''}`} 
                  placeholder="contact@email.com" 
                />
              </div>
            </div>

            <div className="form-grid grid-cols-3">
              <div className="form-group">
                <label>Ville <span className="text-red-500">*</span></label>
                <select 
                  value={formData.city} 
                  onChange={e => { 
                    setFormData({ ...formData, city: e.target.value }); 
                    if (errors.city) setErrors({ ...errors, city: false }); 
                  }} 
                  className={`form-select ${errors.city ? 'form-input-error' : ''}`}
                >
                  <option value="Casablanca">Casablanca</option>
                  <option value="Rabat">Rabat</option>
                  <option value="Marrakech">Marrakech</option>
                </select>
              </div>
              <div className="form-group">
                <label>Quartier <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.neighborhood} 
                  onChange={e => { 
                    setFormData({ ...formData, neighborhood: e.target.value }); 
                    if (errors.neighborhood) setErrors({ ...errors, neighborhood: false }); 
                  }} 
                  className={`form-input ${errors.neighborhood ? 'form-input-error' : ''}`} 
                  placeholder="Quartier" 
                />
              </div>
            </div>

            <div className="form-group mt-2">
              <label>Adresse <span className="text-red-500">*</span></label>
              <textarea 
                value={formData.address} 
                onChange={e => { 
                  setFormData({ ...formData, address: e.target.value }); 
                  if (errors.address) setErrors({ ...errors, address: false }); 
                }} 
                className={`form-textarea ${errors.address ? 'form-input-error' : ''}`} 
                placeholder="Adresse complète..." 
                rows={3} 
              />
            </div>
          </div>
        </div>

        <div className="modal-footer flex justify-end gap-3">
          <button className="btn-premium btn-premium-outline" onClick={onClose} disabled={loading}>
            <XCircle size={16} /> Annuler
          </button>
          <button className="btn-premium btn-premium-teal" onClick={handleSave} disabled={loading}>
            <Save size={18} />
            {loading ? 'Enregistrement...' : 'Mettre à jour'}
          </button>
        </div>
      </div>
    </div>
  );
}
