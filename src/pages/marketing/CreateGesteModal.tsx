/**
 * CreateGesteModal.tsx
 * Modal de création d'un geste commercial conforme au modèle maquette.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { X, Check, Search, Calendar } from 'lucide-react';
import { STATUTS_GESTE, CANAUX_DIFFUSION } from '@/lib/marketing-constants';
import type { Demande } from '@/types';

export interface GesteFormState {
  demande_id: string;
  client_nom: string;
  client_telephone: string;
  ville: string;
  quartier: string;
  fidelite: string;
  frequence: string;
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
  demandes: Demande[];
  form: GesteFormState;
  setForm: React.Dispatch<React.SetStateAction<GesteFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateGesteModal({ demandes, form, setForm, onClose, onSubmit }: Props) {
  // Extraction unique des clients
  const clients = useMemo(() => {
    const map = new Map<string, {
      name: string;
      city: string;
      neighborhood: string;
      phone: string;
      whatsapp: string;
      fidelite: string;
      frequence: string;
      demandesCount: number;
      demandes: Demande[];
    }>();

    demandes.forEach(d => {
      if (!d.client_name) return;
      const name = d.client_name.trim();
      const existing = map.get(name);
      
      const city = d.client_city || d.client_detail?.city || '—';
      const neighborhood = d.client_neighborhood || d.client_detail?.neighborhood || '—';
      const phone = d.client_phone || d.client_whatsapp || '—';
      const whatsapp = d.client_whatsapp || '';
      
      const demandesCount = d.client_detail?.demandes_count || 0;
      
      if (existing) {
        existing.demandes.push(d);
        existing.demandesCount = Math.max(existing.demandesCount, existing.demandes.length);
      } else {
        const isAbo = d.frequency === 'abonnement';
        const freq = isAbo ? 'Abonnement' : 'Une seule fois';
        const count = demandesCount || 1;
        
        map.set(name, {
          name,
          city,
          neighborhood,
          phone,
          whatsapp,
          fidelite: `${count} demande${count > 1 ? 's' : ''}`,
          frequence: freq,
          demandesCount: count,
          demandes: [d],
        });
      }
    });

    return Array.from(map.values());
  }, [demandes]);

  // Autocomplete recherche client
  const [searchQuery, setSearchQuery] = useState(form.client_nom || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (form.client_nom) {
      setSearchQuery(form.client_nom);
    } else {
      setSearchQuery('');
    }
  }, [form.client_nom]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(q));
  }, [clients, searchQuery]);

  const selectClient = (client: typeof clients[0]) => {
    setSearchQuery(client.name);
    setShowDropdown(false);
    
    // Sélectionner automatiquement la demande s'il n'y en a qu'une
    const firstDem = client.demandes[0];
    const firstDemId = client.demandes.length === 1 ? String(firstDem.id) : '';
    const firstDemPrix = client.demandes.length === 1 ? String(firstDem.prix || '') : '';

    setForm(prev => ({
      ...prev,
      client_nom: client.name,
      client_telephone: client.phone,
      ville: client.city,
      quartier: client.neighborhood,
      fidelite: client.fidelite,
      frequence: client.frequence,
      demande_id: firstDemId,
      montant_ht: firstDemPrix,
    }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowDropdown(true);
    if (!val.trim()) {
      setForm(prev => ({
        ...prev,
        client_nom: '',
        client_telephone: '',
        ville: '',
        quartier: '',
        fidelite: 'Nouveau client',
        frequence: 'Une seule fois',
        demande_id: '',
        montant_ht: '',
      }));
    }
  };

  // Filtrer uniquement les demandes en cours et non payées liées au client sélectionné
  const clientDemandes = useMemo(() => {
    if (!form.client_nom) return [];
    const clientObj = clients.find(c => c.name === form.client_nom);
    if (!clientObj) return [];
    return clientObj.demandes.filter(d => {
      const isPaid = d.statut_paiement === 'integral' || d.statut_paiement_ui === 'paye';
      return !isPaid;
    });
  }, [clients, form.client_nom]);

  // Types de gestes conformes à la liste spécifiée (Réduction sur tarif, intervention gratuite)
  const AVAILABLE_TYPES = [
    { value: 'reduction_tarif', label: 'Réduction sur le tarif' },
    { value: 'intervention_gratuite', label: 'Intervention gratuite' },
  ];

  // Calculs de tarification
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
          {/* 1. Recherche de Client */}
          <div className="mk-field" ref={dropdownRef}>
            <span>Nom du client *</span>
            <div className="mk-search-container">
              <div className="mk-search-input-wrapper">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un client..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setShowDropdown(true)}
                />
              </div>
              
              {showDropdown && filteredClients.length > 0 && (
                <div className="mk-autocomplete-dropdown">
                  {filteredClients.map((c) => (
                    <div
                      key={c.name}
                      className="mk-autocomplete-item"
                      onClick={() => selectClient(c)}
                    >
                      <span className="mk-autocomplete-client-name">{c.name}</span>
                      <span className="mk-autocomplete-client-info">
                        {c.city} — {c.demandesCount} demande{c.demandesCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2. Informations du Client Sélectionné (Info Box) */}
          {form.client_nom && (
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              fontSize: '0.8rem',
              color: '#334155',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem' }}>
                <span><strong>Tél :</strong> {form.client_telephone || '—'}</span>
                <span><strong>Ville :</strong> {form.ville || '—'}</span>
                <span><strong>Quartier :</strong> {form.quartier || '—'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
                <span><strong>Fidélité :</strong> {form.fidelite || '—'}</span>
                <span><strong>Fréquence :</strong> {form.frequence || '—'}</span>
              </div>
            </div>
          )}

          {/* Date du geste commercial */}
          <label className="mk-field">
            <span>Date du geste commercial</span>
            <input
              type="date"
              value={form.date_geste}
              onChange={(e) => setForm({ ...form, date_geste: e.target.value })}
            />
          </label>

          {/* 3. Sélection de la demande liée */}
          <label className="mk-field">
            <span>Demande (numéro, service, statut)</span>
            <select
              value={form.demande_id}
              onChange={(e) => {
                const dem = clientDemandes.find(d => d.id === Number(e.target.value));
                if (dem) {
                  const isAbo = dem.frequency === 'abonnement';
                  const freq = isAbo ? 'Abonnement' : 'Une seule fois';
                  setForm(prev => ({
                    ...prev,
                    demande_id: String(dem.id),
                    montant_ht: String(dem.prix || ''),
                    frequence: freq,
                  }));
                } else {
                  setForm(prev => ({
                    ...prev,
                    demande_id: '',
                  }));
                }
              }}
              disabled={!form.client_nom}
            >
              <option value="">Sélectionner une demande</option>
              {clientDemandes.map(d => (
                <option key={d.id} value={d.id}>
                  #{d.id} - {d.service_label || d.service} ({d.statut})
                </option>
              ))}
            </select>
          </label>

          {/* Statut */}
          <label className="mk-field">
            <span>Statut du geste commercial</span>
            <select value={form.statut_geste} onChange={(e) => setForm({ ...form, statut_geste: e.target.value })}>
              {STATUTS_GESTE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>

          {/* 4. Type de geste commercial */}
          <label className="mk-field">
            <span>Type de geste commercial *</span>
            <select value={form.type_geste} onChange={(e) => setForm({ ...form, type_geste: e.target.value })}>
              {AVAILABLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          {/* 5. Tarification */}
          <fieldset className="mk-fieldset">
            <legend>Tarification</legend>
            
            <label className="mk-field">
              <span>Montant HT (MAD)</span>
              <input
                type="number"
                placeholder="0"
                value={form.montant_ht}
                onChange={(e) => setForm({ ...form, montant_ht: e.target.value })}
              />
            </label>

            {/* Switch TVA */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
              <label className="switch" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={form.tva_active}
                  onChange={(e) => setForm({ ...form, tva_active: e.target.checked })}
                />
                <span className="slider round" />
              </label>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>TVA 20%</span>
              {form.tva_active && (
                <small style={{ marginLeft: '0.5rem', color: '#6b7280' }}>
                  TVA : {tvaMontant.toFixed(2)} MAD
                </small>
              )}
            </div>

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
                <input
                  type="number"
                  placeholder="0"
                  value={form.reduction_valeur}
                  onChange={(e) => setForm({ ...form, reduction_valeur: e.target.value })}
                />
              </label>
            </div>

            {reductionAmount > 0 && (
              <p className="mk-field-info" style={{ color: '#6b7280' }}>Réduction : -{reductionAmount.toFixed(2)} MAD</p>
            )}

            <p className="mk-field-total" style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.3rem', fontSize: '0.95rem', color: '#0f766e', fontWeight: 700 }}>
              Total à payer : {isAnnulation ? '0.00' : totalAPayer.toFixed(2)} MAD
              {isAnnulation && <small style={{ color: '#dc2626', marginLeft: '0.5rem' }}>(Perte agence)</small>}
            </p>
          </fieldset>

          {/* 6. Répartition du montant (uniquement si total > 0) */}
          {!isAnnulation && totalAPayer > 0 && (
            <fieldset className="mk-fieldset">
              <legend>Répartition du montant</legend>
              <div className="mk-form-row-2">
                <label className="mk-field">
                  <span>Part du profil (MAD)</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.part_profil}
                    onChange={(e) => setForm({ ...form, part_profil: e.target.value })}
                  />
                </label>
                <label className="mk-field">
                  <span>Part de l'agence (MAD)</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={form.part_agence}
                    onChange={(e) => setForm({ ...form, part_agence: e.target.value })}
                  />
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
            <textarea
              rows={2}
              placeholder="Raison du geste commercial..."
              value={form.motif}
              onChange={(e) => setForm({ ...form, motif: e.target.value })}
            />
          </label>

          {/* 8. Options Message pilule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', marginBottom: '0.35rem' }}>
            <span style={{ color: '#486272', fontSize: '0.78rem', fontWeight: 700 }}>Envoyer un message au client ?</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                style={{
                  padding: '0.35rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  backgroundColor: !form.envoyer_message ? '#0f766e' : '#ffffff',
                  color: !form.envoyer_message ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setForm({ ...form, envoyer_message: false })}
              >
                Non
              </button>
              <button
                type="button"
                style={{
                  padding: '0.35rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  border: '1px solid #cbd5e1',
                  backgroundColor: form.envoyer_message ? '#0f766e' : '#ffffff',
                  color: form.envoyer_message ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
                onClick={() => setForm({ ...form, envoyer_message: true })}
              >
                Oui
              </button>
            </div>
          </div>

          <div style={!form.envoyer_message ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
            <label className="mk-field">
              <span>Message</span>
              <textarea
                rows={3}
                placeholder="Rédigez le message à envoyer au client..."
                value={form.message_client}
                onChange={(e) => setForm({ ...form, message_client: e.target.value })}
              />
            </label>
            
            {/* Canaux diffusion alignés sur une seule ligne */}
            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {CANAUX_DIFFUSION.map((c) => (
                <label key={c.value} className="mk-form-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={form.canal_diffusion.includes(c.value)}
                    onChange={() => toggleCanal(c.value)}
                    style={{ width: '16px', height: '16px', accentColor: '#0f766e' }}
                  />
                  <span style={{ fontWeight: 500, color: '#334155' }}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 9. Créé par */}
          <label className="mk-field">
            <span>Créé par</span>
            <input
              placeholder="Nom du commercial"
              value={form.cree_par}
              onChange={(e) => setForm({ ...form, cree_par: e.target.value })}
            />
          </label>
        </div>

        {/* 10. Bouton d'action "Appliquer le geste commercial" */}
        <div style={{ padding: '0.85rem', borderTop: '1px solid #d3e1e9', background: '#f4f9fb', borderRadius: '0 0 14px 14px' }}>
          <button
            type="button"
            style={{
              width: '100%',
              backgroundColor: '#0f766e',
              color: '#ffffff',
              padding: '0.75rem',
              borderRadius: '8px',
              fontWeight: 700,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0d5c56'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f766e'}
            onClick={onSubmit}
          >
            <Check size={18} /> Appliquer le geste commercial
          </button>
        </div>
      </section>
    </div>
  );
}
