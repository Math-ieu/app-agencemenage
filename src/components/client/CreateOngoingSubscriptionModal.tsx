import React, { useState, useEffect, useMemo } from 'react';
import { 
  XCircle, Plus, CheckCircle, Percent, Tag, 
  MapPin, CreditCard, Building2, User, Sparkles
} from 'lucide-react';
import { DynamicServiceForm } from '../demandes/forms/DynamicServiceForm';
import { usePriceCalculator } from '../../hooks/usePriceCalculator';
import { useResourceEstimator } from '../../hooks/useResourceEstimator';
import { createDemande, validerDemande, confirmerClient } from '../../api/client';
import { emitFinanceSync } from '../../utils/paymentSync';
import { useToastStore } from '../../store/toast';
import { useAuthStore } from '../../store/auth';
import { getStatutPaiementFromMode } from '../../utils/paymentRules';

const PAYMENT_STATUS_OPTIONS = [
  { value: 'non_confirme', apiValue: 'non_paye', label: 'Non confirmé' },
  { value: 'paiement_en_attente', apiValue: 'acompte', label: 'Paiement en attente' },
  { value: 'paye', apiValue: 'integral', label: 'Payé' },
  { value: 'agence_payee_client', apiValue: 'partiel', label: 'Agence payée / Client' },
  { value: 'profil_paye_client', apiValue: 'partiel', label: 'Profil payé / Client' },
];

const SERVICES_CONFIG = {
  particulier: [
    "Ménage standard",
    "Grand ménage",
    "Ménage Air BnB",
    "Auxiliaire de vie",
    "Autre service"
  ],
  entreprise: [
    "Ménage bureaux",
    "Nettoyage fin de chantier",
    "Placement & gestion",
    "Autre service"
  ]
};

const VILLES_LIST = [
  'Casablanca', 'Rabat', 'Salé', 'Temara', 'Ain Aouda', 'El Harhoura',
  'Bouskoura', 'Dar Bouazza', 'Mansouria', 'Almaz', 'Sidi Rahal', 'Benslimane',
  'Mohammédia', 'Ville Verte'
];

interface CreateOngoingSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateOngoingSubscriptionModal: React.FC<CreateOngoingSubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const isAdmin = user?.role?.toLowerCase() === 'admin' || Boolean(user?.is_superuser);

  const [activeSegment, setActiveSegment] = useState<'particulier' | 'entreprise'>('particulier');
  const [selectedService, setSelectedService] = useState<string>("Ménage standard");
  const [directPhone, setDirectPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [syncWhatsApp, setSyncWhatsApp] = useState(true);
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [promoCode, setPromoCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [formData, setFormData] = useState<any>({
    nom: '',
    email: '',
    entity_name: '',
    contact_person: '',
    ville: 'Casablanca',
    quartier: '',
    adresse: '',
    date: todayIso,
    date_reservation: todayIso,
    date_demarrage: todayIso,
    date_debut: todayIso,
    heure: '09:00',
    scheduling_type: 'fixed',
    preference_horaire: '',
    type_habitation: 'Appartement',
    frequence: '1/sem',
    jours_passage: 'lundi',
    jours_intervention: ['lundi'],
    jours_intervention_detail: [{ jour: 'lundi', heure_debut: '09:00', heure_fin: '13:00' }],
    surface: 80,
    details_pieces: '',
    duree: 4,
    produits: false,
    torchons: false,
    montant: '',
    mode_paiement: 'virement_ag',
    statut_paiement_ui: 'paye',
    heard_about_us: '',
    notes: '',
    service_type: 'flexible',
    structure_type: 'Bureaux',
    nb_personnel: 1,
    nb_intervenants: 1,
    lieu_garde: 'domicile',
    age_personne: '',
    sexe_personne: 'femme',
    mobilite: 'Autonome',
    situation_medicale: '',
    nb_jours: 1,
    rooms: {
      cuisine: 1,
      suiteAvecBain: 0,
      suiteSansBain: 0,
      salleDeBain: 1,
      chambre: 2,
      salonMarocain: 1,
      salonEuropeen: 1,
      toilettesLavabo: 1,
      rooftop: 0,
      escalier: 0
    },
    formula: 'A',
    size_tier: '2chambres',
    conso: false,
    linen_sets: 0,
    custom_service_type: '',
    property_category: 'logement',
    property_subtype: 'Appartement',
    duration_unit: 'heures',
    description: '',
    amount_ht: 0,
    tva_active: false,
    quote_number: '',
    options: [
      { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
      { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false }
    ],
    taux_reduction: 10
  });

  // Switch default service when changing segment
  const handleSegmentChange = (seg: 'particulier' | 'entreprise') => {
    setActiveSegment(seg);
    if (seg === 'entreprise') {
      setSelectedService("Ménage bureaux");
    } else {
      setSelectedService("Ménage standard");
    }
  };

  const calculatedPrice = usePriceCalculator(formData, selectedService);
  const estimatedResources = useResourceEstimator(formData, selectedService);

  // Sync estimated resources dynamically whenever estimatedResources updates (like in Demandes)
  useEffect(() => {
    if (estimatedResources) {
      setFormData((prev: any) => ({
        ...prev,
        duree: estimatedResources.duration,
        duration: estimatedResources.duration,
        nb_heures: estimatedResources.duration,
        nb_intervenants: estimatedResources.people,
        nb_intervenantes: estimatedResources.people,
        nb_personnel: estimatedResources.people,
        numberOfPeople: estimatedResources.people,
      }));
    }
  }, [estimatedResources]);

  // Sync calculated price to montant automatically whenever calculatedPrice updates
  useEffect(() => {
    if (calculatedPrice && calculatedPrice !== 'Sur devis') {
      setFormData((prev: any) => ({ ...prev, montant: calculatedPrice }));
    } else if (calculatedPrice === 'Sur devis') {
      setFormData((prev: any) => ({ ...prev, montant: '' }));
    }
  }, [calculatedPrice]);

  if (!isOpen) return null;

  if (!isAdmin) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <XCircle size={48} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Accès refusé</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Seul l'administrateur est autorisé à ajouter manuellement un abonnement en cours.
          </p>
          <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    );
  }

  const formatPhone = (p: string) => {
    if (!p) return "";
    let cleaned = p.replace(/\s+/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith('+')) return `+212${cleaned}`;
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const clientDisplayName = activeSegment === 'entreprise'
      ? (formData.entity_name || formData.contact_person || formData.nom)
      : formData.nom;

    if (!clientDisplayName || !clientDisplayName.trim()) {
      addToast("Veuillez renseigner le nom du client ou de l'entreprise.", 'error');
      return;
    }

    if (!directPhone || !directPhone.trim()) {
      addToast("Veuillez renseigner le numéro de téléphone.", 'error');
      return;
    }

    const effectiveDate = formData.date_reservation || formData.date_demarrage || formData.date_debut || formData.date || todayIso;
    const finalPhone = formatPhone(directPhone);
    const finalWhatsApp = formatPhone(whatsappPhone || directPhone);

    const cleanerCount = Number(formData.nb_intervenants || formData.nb_personnel || 1);
    const finalStatutUi = formData.statut_paiement_ui || getStatutPaiementFromMode(formData.mode_paiement) || 'non_confirme';
    const paymentOption = PAYMENT_STATUS_OPTIONS.find(o => o.value === finalStatutUi);

    setIsSubmitting(true);
    try {
      const payload: Record<string, any> = {
        client_name: clientDisplayName,
        client_phone: finalPhone,
        client_whatsapp: finalWhatsApp,
        service: selectedService,
        segment: activeSegment,
        date_intervention: effectiveDate,
        heure_intervention: formData.heure || (formData.jours_intervention_detail?.[0]?.heure_debut) || '09:00',
        prix: formData.montant ? Number(formData.montant) : null,
        is_devis: false,
        mode_paiement: formData.mode_paiement || 'virement_ag',
        statut_paiement: paymentOption?.apiValue || 'non_paye',
        frequency: 'abonnement',
        frequency_label: formData.frequence || '1/sem',
        nb_heures: Number(formData.duree || 4),
        nb_intervenants: cleanerCount,
        nb_personnel: cleanerCount,
        formulaire_data: {
          ...formData,
          nom: clientDisplayName,
          fullName: clientDisplayName,
          firstName: activeSegment === 'particulier' ? clientDisplayName.split(' ')[0] : '',
          lastName: activeSegment === 'particulier' ? clientDisplayName.split(' ').slice(1).join(' ') : '',
          entity_name: formData.entity_name,
          contact_person: formData.contact_person,
          client_phone: finalPhone,
          client_whatsapp: finalWhatsApp,
          whatsapp_phone: finalWhatsApp,
          email: formData.email,
          ville: formData.ville,
          quartier: formData.quartier,
          adresse: formData.adresse,
          frequence: formData.frequence || '1/sem',
          frequency: 'abonnement',
          date_reservation: effectiveDate,
          date_demarrage: effectiveDate,
          date_debut: effectiveDate,
          date: effectiveDate,
          schedulingDate: effectiveDate,
          jours_passage: formData.jours_passage || (Array.isArray(formData.jours_intervention) ? formData.jours_intervention.join(' + ') : 'lundi'),
          jours_intervention: formData.jours_intervention || ['lundi'],
          jours_intervention_detail: formData.jours_intervention_detail || [{ jour: 'lundi', heure_debut: '09:00', heure_fin: '13:00' }],
          statut_mois_en_cours: 'Actif',
          statut_facturation: paymentOption?.label || 'Non confirmé',
          statut_mois_prochain: 'Actif',
          statut_paiement_ui: finalStatutUi,
          taux_reduction: discountPercent,
          reduction_abonnement: discountPercent,
          reduction_pourcentage: discountPercent,
          code_promo: promoCode || undefined,
          is_ongoing_subscription: true,
          created_manually_by_admin: true
        }
      };

      const res = await createDemande(payload);
      const newDemandeId = res.data?.id;

      if (newDemandeId) {
        // Valider immédiatement pour instancier SubscriptionPlanning, statut en_cours et interventions
        try {
          await validerDemande(newDemandeId, {
            mode_paiement: formData.mode_paiement || 'virement_ag',
            assigned_to: user?.id
          });
        } catch (valErr) {
          console.warn("Demande créée mais validation automatique warning:", valErr);
        }

        // Confirmer le client si applicable
        try {
          await confirmerClient(newDemandeId);
        } catch (confErr) {
          console.warn("Client association warning:", confErr);
        }
      }

      emitFinanceSync({ source: 'CreateOngoingSubscriptionModal' });
      addToast(`L'abonnement de ${clientDisplayName} a été enregistré et activé avec succès.`, 'success');

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erreur lors de la création de l'abonnement en cours:", err);
      addToast(err?.response?.data?.error || err?.message || "Impossible de créer l'abonnement.", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          maxWidth: '860px', 
          width: '95%',
          maxHeight: '92vh', 
          display: 'flex', 
          flexDirection: 'column', 
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div 
          className="modal-header" 
          style={{ 
            background: 'linear-gradient(135deg, #044b40 0%, #0d9488 100%)', 
            color: 'white', 
            padding: '1.25rem 1.5rem',
            borderBottom: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '0.5rem', borderRadius: '10px' }}>
              <Sparkles size={22} className="text-white" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'white' }}>
                Ajouter un abonnement en cours
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: '#ccfbf1', opacity: 0.9 }}>
                Enregistrement manuel d'un abonnement déjà actif (Accès Administrateur)
              </p>
            </div>
          </div>
          <button 
            className="btn-close" 
            onClick={onClose}
            style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.8 }}
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '1.5rem', background: '#f8fafc' }}>
          <form id="create-ongoing-sub-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* 1. SEGMENT & SERVICE SELECTOR */}
            <div className="ws-form-block" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
              <div className="ws-section-header" style={{ marginBottom: '1rem', color: '#ffffff', fontWeight: 700, fontSize: '1rem' }}>
                Segment et Service
              </div>

              {/* Segment Toggle */}
              <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px', marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => handleSegmentChange('particulier')}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: activeSegment === 'particulier' ? '#0d9488' : 'transparent',
                    color: activeSegment === 'particulier' ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  <User size={16} /> Particulier
                </button>
                <button
                  type="button"
                  onClick={() => handleSegmentChange('entreprise')}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: activeSegment === 'entreprise' ? '#0d9488' : 'transparent',
                    color: activeSegment === 'entreprise' ? 'white' : '#64748b',
                    transition: 'all 0.2s'
                  }}
                >
                  <Building2 size={16} /> Entreprise
                </button>
              </div>

              {/* Service Select */}
              <div>
                <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.4rem' }}>
                  Type de service *
                </label>
                <select
                  className="ws-select"
                  value={selectedService}
                  onChange={e => setSelectedService(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontWeight: 600 }}
                >
                  {SERVICES_CONFIG[activeSegment].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. DYNAMIC SERVICE CONFIGURATION (Frequency, Days, Hours, Reservation Date, Housing, etc.) */}
            <DynamicServiceForm
              serviceKey={selectedService}
              formData={formData}
              setFormData={setFormData}
              minDuree={2}
              activeSegment={activeSegment}
            />

            {/* 3. RÉDUCTION APPLIQUÉE (DISCOUNT SECTION) */}
            <div className="ws-form-block" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#044b40', fontWeight: 800, fontSize: '0.95rem' }}>
                <Percent size={18} className="text-teal-600" />
                <span>Réduction appliquée à l'abonnement</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem' }}>
                    Taux de réduction appliqué (%)
                  </label>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    {[0, 5, 10, 15, 20, 25].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setDiscountPercent(pct);
                          setFormData((prev: any) => ({ ...prev, taux_reduction: pct }));
                        }}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '8px',
                          border: discountPercent === pct ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
                          backgroundColor: discountPercent === pct ? '#0d9488' : '#f8fafc',
                          color: discountPercent === pct ? 'white' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {pct === 0 ? 'Aucune (0%)' : `${pct}%`}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Autre %"
                      value={discountPercent}
                      onChange={e => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                        setDiscountPercent(val);
                        setFormData((prev: any) => ({ ...prev, taux_reduction: val }));
                      }}
                      style={{
                        width: '100px',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>% de réduction</span>
                  </div>
                </div>

                <div>
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem' }}>
                    Code promo / motif de réduction (facultatif)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Tag size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Ex: PROMO10, CONTRAT_ANNUEL..."
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        fontWeight: 600
                      }}
                    />
                  </div>
                  {discountPercent > 0 && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#0d9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle size={14} />
                      <span>Réduction de {discountPercent}% intégrée au calcul du tarif</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 4. LOCALISATION */}
            <div className="ws-form-block" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#044b40', fontWeight: 800, fontSize: '0.95rem' }}>
                <MapPin size={18} className="text-teal-600" />
                <span>Lieu de l'intervention</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Ville *
                  </label>
                  <select
                    className="ws-select"
                    required
                    value={formData.ville}
                    onChange={e => setFormData({ ...formData, ville: e.target.value, quartier: '' })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                  >
                    {VILLES_LIST.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Quartier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Gauthier, Maârif, Agdal..."
                    value={formData.quartier}
                    onChange={e => setFormData({ ...formData, quartier: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Adresse exacte & Repères
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Numéro de rue, immeuble, étage, repères utiles..."
                    value={formData.adresse}
                    onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* 5. INFORMATIONS CLIENT */}
            <div className="ws-form-block" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#044b40', fontWeight: 800, fontSize: '0.95rem' }}>
                <User size={18} className="text-teal-600" />
                <span>Informations du client</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {activeSegment === 'entreprise' ? (
                  <>
                    <div className="form-group">
                      <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                        Nom de l'entreprise *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Société SARL"
                        value={formData.entity_name}
                        onChange={e => setFormData({ ...formData, entity_name: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                        Personne de contact *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: M. Khalid Bennani"
                        value={formData.contact_person}
                        onChange={e => setFormData({ ...formData, contact_person: e.target.value, nom: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                      Nom complet du client *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Fatima Zahra Alami"
                      value={formData.nom}
                      onChange={e => setFormData({ ...formData, nom: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Numéro de téléphone *
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                      +212
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="6 12 34 56 78"
                      value={directPhone}
                      onChange={e => {
                        const val = e.target.value;
                        setDirectPhone(val);
                        if (syncWhatsApp) setWhatsappPhone(val);
                      }}
                      style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#475569', marginTop: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={syncWhatsApp}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSyncWhatsApp(checked);
                        if (checked) setWhatsappPhone(directPhone);
                      }}
                    />
                    <span>Identique pour WhatsApp</span>
                  </label>
                </div>

                {!syncWhatsApp && (
                  <div className="form-group">
                    <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                      Numéro WhatsApp
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                        +212
                      </span>
                      <input
                        type="text"
                        placeholder="6 12 34 56 78"
                        value={whatsappPhone}
                        onChange={e => setWhatsappPhone(e.target.value)}
                        style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="client@domaine.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                  />
                </div>

                <div className="form-group">
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Comment le client a connu l'agence ?
                  </label>
                  <select
                    className="ws-select"
                    value={formData.heard_about_us}
                    onChange={e => setFormData({ ...formData, heard_about_us: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="recommandation">Bouche-à-oreille / Recommandation</option>
                    <option value="google">Recherche Google</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 6. TARIFICATION & PAIEMENT */}
            <div className="ws-form-block" style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#044b40', fontWeight: 800, fontSize: '0.95rem' }}>
                <CreditCard size={18} className="text-teal-600" />
                <span>Tarification et Modalités de paiement</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Montant total (MAD) {calculatedPrice !== 'Sur devis' && '*'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      placeholder={calculatedPrice && calculatedPrice !== 'Sur devis' ? calculatedPrice : "0.00"}
                      required={calculatedPrice !== 'Sur devis'}
                      value={formData.montant}
                      onChange={e => setFormData({ ...formData, montant: e.target.value })}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontWeight: 700, fontSize: '0.95rem', color: '#044b40' }}
                    />
                    {calculatedPrice && calculatedPrice !== 'Sur devis' && formData.montant !== calculatedPrice && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, montant: calculatedPrice })}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '11px',
                          background: '#0d9488',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                        title="Réappliquer le prix calculé"
                      >
                        Calculé: {calculatedPrice} MAD
                      </button>
                    )}
                    {calculatedPrice === 'Sur devis' && (
                      <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                        Prix sur devis
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="label-teal" style={{ fontWeight: 700, fontSize: '0.8125rem', display: 'block', marginBottom: '0.35rem' }}>
                    Mode de paiement *
                  </label>
                  <select
                    className="ws-select"
                    required
                    value={formData.mode_paiement}
                    onChange={e => {
                      const newMode = e.target.value;
                      const tot = Number(formData.montant || 0);
                      let virementVal = formData.montant_virement;
                      let especesVal = formData.montant_especes;
                      if (newMode === 'virement_especes' && (!virementVal && !especesVal) && tot > 0) {
                        virementVal = '';
                        especesVal = '';
                      }
                      const newStatutUi = getStatutPaiementFromMode(newMode);
                      setFormData({
                        ...formData,
                        mode_paiement: newMode,
                        statut_paiement_ui: newStatutUi,
                        montant_virement: virementVal,
                        montant_especes: especesVal
                      });
                    }}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}
                  >
                    <option value="">Choisir...</option>
                    <option value="virement_ag">Virement Ag</option>
                    <option value="virement_com">Virement Com</option>
                    <option value="virement_especes">Virement / Espèces</option>
                    <option value="especes">Espèces</option>
                    <option value="carte">Carte bancaire</option>
                    <option value="cheque">Par chèque</option>
                  </select>
                </div>

                {formData.mode_paiement === 'virement_especes' && (
                  <div style={{ gridColumn: '1 / -1', padding: '1rem', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: '#134e4a', borderBottom: '1px solid #ccfbf1', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                      <span>Répartition Virement / Espèces</span>
                      <span>Total : <strong>{formData.montant ? `${formData.montant} MAD` : '—'}</strong></span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Montant Virement (MAD) *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={formData.montant_virement || ''}
                          onChange={e => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            const tot = Number(formData.montant || 0);
                            const remain = (tot > 0 && val !== '') ? Math.max(0, tot - Number(val)) : formData.montant_especes;
                            setFormData({ ...formData, montant_virement: val, montant_especes: remain });
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          placeholder="Ex: 100"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>Montant Espèces (MAD) *</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={formData.montant_especes || ''}
                          onChange={e => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            const tot = Number(formData.montant || 0);
                            const remain = (tot > 0 && val !== '') ? Math.max(0, tot - Number(val)) : formData.montant_virement;
                            setFormData({ ...formData, montant_especes: val, montant_virement: remain });
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          placeholder="Ex: 140"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-end', 
                gap: '0.75rem', 
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
                style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 600, background: 'white' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '0.625rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  background: 'linear-gradient(135deg, #0d9488 0%, #044b40 100%)',
                  color: 'white',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.3)'
                }}
              >
                {isSubmitting ? (
                  <span>Enregistrement en cours...</span>
                ) : (
                  <>
                    <Plus size={18} />
                    <span>Créer et activer l'abonnement</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};
