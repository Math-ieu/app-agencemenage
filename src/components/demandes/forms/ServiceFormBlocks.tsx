import React from 'react';

export interface FormBlockProps {
    formData: any;
    setFormData: (data: any) => void;
}

export const HabitationTypeBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Type d'habitation</div>
        <div className="ws-radio-pills">
            {['Studio', 'Appartement', 'Duplex', 'Villa', 'Maison'].map(type => (
                <label key={type} className="ws-radio-pill">
                    <input type="radio" name="propertyType" value={type} checked={formData.type_habitation === type} onChange={e => setFormData({ ...formData, type_habitation: e.target.value })} />
                    <span>{type}</span>
                </label>
            ))}
        </div>
    </div>
);

export const InterventionNatureBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Nature de l'intervention</div>
        <div className="ws-nature-cards">
            {[
                { v: 'degat_des_eaux', l: 'Dégât des eaux' },
                { v: 'incendie', l: 'Incendie' },
                { v: 'inondation', l: 'Inondation' }
            ].map(n => (
                <div key={n.v} className={`ws-nature-card ${formData.intervention_nature === n.v ? 'active' : ''}`} onClick={() => setFormData({ ...formData, intervention_nature: n.v })}>
                    {n.l}
                </div>
            ))}
        </div>
        <div style={{ padding: '0 0.5rem', marginTop: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 'bold', color: '#14b8a6', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Donnez-nous plus d’informations sur votre demande
            </label>
            <textarea
                rows={4}
                placeholder="Détaillez ici votre besoin spécifique (type de sinistre, surface concernée, urgence particulière...)"
                value={formData.details_pieces || ''}
                onChange={e => setFormData({ ...formData, details_pieces: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #14b8a6', borderRadius: '0.75rem', fontSize: '0.9rem', outline: 'none' }}
            />
        </div>
    </div>
);

export const EtatLogementBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">État du logement</div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
            <div className="form-group">
                <label className="label-teal">État du logement *</label>
                <select className="ws-select" required value={formData.accommodation_state || ''} onChange={e => setFormData({ ...formData, accommodation_state: e.target.value })}>
                    <option value="">Choisir...</option>
                    <option value="vide">Vide</option>
                    <option value="meuble">Meublé</option>
                </select>
            </div>
            <div className="form-group">
                <label className="label-teal">Niveau de salissure *</label>
                <select className="ws-select" required value={formData.cleanliness_type || ''} onChange={e => setFormData({ ...formData, cleanliness_type: e.target.value })}>
                    <option value="">Choisir...</option>
                    <option value="normal">Normal</option>
                    <option value="intensif">Intensif</option>
                </select>
            </div>
        </div>
    </div>
);

export const SurfaceBureauxBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Superficie de vos locaux</div>
        <div className="ws-surface-cards">
            {[
                { v: '0-70', l: '0 - 70 m²' },
                { v: '71-150', l: '71 - 150 m²' },
                { v: '151-300', l: '151 - 300 m²' },
                { v: '300+', l: '300 m² et plus' }
            ].map(s => (
                <div key={s.v} className={`ws-surface-card ${String(formData.surface) === s.v ? 'active' : ''}`} onClick={() => setFormData({ ...formData, surface: s.v as any })}>
                    {s.l}
                </div>
            ))}
        </div>
    </div>
);

export const FrequenceBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Choisissez la fréquence</div>
        <div className="ws-freq-toggle">
            <button type="button" className={formData.frequence === 'une fois' || !formData.frequence ? 'active' : ''} onClick={() => setFormData({ ...formData, frequence: 'une fois' })}>
                Une fois
            </button>
            <button type="button" className={formData.frequence !== 'une fois' && formData.frequence ? 'active' : ''} onClick={() => setFormData({ ...formData, frequence: '1/sem' })}>
                Abonnement
            </button>
        </div>
        {formData.frequence && formData.frequence !== 'une fois' && (
            <div style={{ maxWidth: '380px', margin: '0 auto' }}>
                <div className="ws-discount-badge">-10 % de réduction sur l'abonnement</div>
                <select className="ws-select" value={formData.frequence} onChange={e => setFormData({ ...formData, frequence: e.target.value })}>
                    <option value="1/sem">1 fois par semaine</option>
                    <option value="2/sem">2 fois par semaine</option>
                    <option value="3/sem">3 fois par semaine</option>
                    <option value="4/sem">4 fois par semaine</option>
                    <option value="5/sem">5 fois par semaine</option>
                    <option value="6/sem">6 fois par semaine</option>
                    <option value="7/sem">7 fois par semaine</option>
                    <option value="1/mois">1 fois par mois</option>
                    <option value="2/mois">2 fois par mois</option>
                    <option value="3/mois">3 fois par mois</option>
                    <option value="4/mois">4 fois par mois</option>
                </select>
            </div>
        )}
    </div>
);

export const RoomsGridBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Merci de nous décrire votre domicile</div>
        <p style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'right', fontWeight: 700, marginBottom: '0.5rem' }}>
            Cliquez sur + ou - pour décrire les pièces
        </p>
        <div className="ws-rooms-grid" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem' }}>
            {[
                { key: 'cuisine', label: 'Cuisine', time: '45 min' },
                { key: 'suiteAvecBain', label: 'Suite parentale avec salle de bain', time: '75 min' },
                { key: 'suiteSansBain', label: 'Suite parentale sans salle de bain', time: '45 min' },
                { key: 'salleDeBain', label: 'Salle de bain', time: '30 min' },
                { key: 'chambre', label: 'Chambre/pièce/bureau', time: '40 min' },
                { key: 'salonMarocain', label: 'Salon Marocain', time: '35 min' },
                { key: 'salonEuropeen', label: 'Salon européen', time: '35 min' },
                { key: 'toilettesLavabo', label: 'Toilette Lavabo', time: '25 min' },
                { key: 'rooftop', label: 'Rooftop', time: '30 min' },
                { key: 'escalier', label: 'Escalier', time: '25 min' }
            ].map(room => (
                <div key={room.key} className="ws-room-row">
                    <div>
                        <div className="ws-room-label">{room.label}</div>
                        <div className="ws-room-time">{room.time}</div>
                    </div>
                    <div className="ws-room-counter">
                        <button type="button" className="ws-room-btn" onClick={() => setFormData({ ...formData, rooms: { ...formData.rooms, [room.key]: Math.max(0, (formData.rooms?.[room.key] || 0) - 1) } })}>−</button>
                        <span className="ws-room-count">{formData.rooms?.[room.key] || 0}</span>
                        <button type="button" className="ws-room-btn" onClick={() => setFormData({ ...formData, rooms: { ...formData.rooms, [room.key]: (formData.rooms?.[room.key] || 0) + 1 } })}>+</button>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const SurfaceSliderBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Superficie de votre bien en m²</div>
        <div className="ws-slider-container">
            <div className="ws-slider-value">{formData.surface || 0} m²</div>
            <input type="range" className="ws-slider-input" min={0} max={300} step={10} value={formData.surface || 0} onChange={e => setFormData({ ...formData, surface: parseInt(e.target.value) || 0 })} />
            <div className="ws-slider-labels">
                <span>0 m²</span>
                <span>150 m²</span>
                <span>300 m²</span>
            </div>
        </div>
    </div>
);

export const SurfacePostSinistreBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Indiquez la superficie de votre espace en m²</div>
        <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', border: '1px solid #14b8a6', borderRadius: '0.75rem', backgroundColor: '#ffffff' }}>
            <label htmlFor="surface-bo" style={{ fontWeight: 'bold', color: '#334155', fontSize: '1rem' }}>
                Surface (m²) :
            </label>
            <input
                id="surface-bo"
                type="number"
                min="1"
                value={formData.surface || ''}
                onChange={e => setFormData({ ...formData, surface: parseInt(e.target.value) || 0 })}
                style={{ width: '8rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.125rem', border: '1px solid #14b8a6', borderRadius: '0.375rem', height: '2.75rem' }}
            />
        </div>
    </div>
);

export interface DurationBlockProps extends FormBlockProps {
    minDuree: number;
    estimatedResources?: { duration: number; people: number } | null;
}

export const DurationBlock: React.FC<DurationBlockProps> = ({ formData, setFormData, minDuree, estimatedResources }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Précisez le temps qui vous convient</div>
        <p style={{ color: '#ef4444', fontSize: '0.65rem', textAlign: 'center', marginBottom: '0.5rem' }}>
            La durée minimale est de {minDuree} heures
        </p>
        <div className="flex items-center justify-center gap-4">
            <div className="ws-counter">
                <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, duree: Math.max(minDuree, (formData.duree || minDuree) - 1) })} disabled={(formData.duree || 0) <= minDuree}>−</button>
                <span className="ws-counter-value">{formData.duree || minDuree} h</span>
                <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, duree: (formData.duree || minDuree) + 1 })}>+</button>
            </div>
            {estimatedResources && formData.duree !== estimatedResources.duration && (
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, duree: estimatedResources.duration })}
                    className="text-[10px] bg-teal-100 text-teal-700 px-2 py-1 rounded-full border border-teal-200 hover:bg-teal-200"
                >
                    Suggéré: {estimatedResources.duration}h
                </button>
            )}
        </div>
    </div>
);

export const PeopleBlock: React.FC<DurationBlockProps> = ({ formData, setFormData, estimatedResources }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Nombre de personne</div>
        <div className="flex items-center justify-center gap-4">
            <div className="ws-counter">
                <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_intervenants: Math.max(1, (formData.nb_intervenants || 1) - 1) })} disabled={(formData.nb_intervenants || 1) <= 1}>−</button>
                <span className="ws-counter-value">{formData.nb_intervenants || 1}</span>
                <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_intervenants: (formData.nb_intervenants || 1) + 1 })}>+</button>
            </div>
            {estimatedResources && formData.nb_intervenants !== estimatedResources.people && (
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, nb_intervenants: estimatedResources.people })}
                    className="text-[10px] bg-teal-100 text-teal-700 px-2 py-1 rounded-full border border-teal-200 hover:bg-teal-200"
                >
                    Suggéré: {estimatedResources.people}
                </button>
            )}
        </div>
    </div>
);

export const PlanningBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Planning pour votre demande</div>
        <div className="ws-planning-grid">
            <div className="ws-planning-col">
                <label className="ws-planning-radio-label">
                    <input type="radio" name="schedulingType" value="fixed" checked={formData.scheduling_type === 'fixed'} onChange={e => setFormData({ ...formData, scheduling_type: e.target.value })} />
                    <span>Heure fixe</span>
                </label>
                <input type="time" value={formData.heure || ''} onChange={e => setFormData({ ...formData, heure: e.target.value })} disabled={formData.scheduling_type !== 'fixed'} style={{ width: '120px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px' }} />
            </div>
            <div className="ws-planning-col">
                <label className="ws-planning-radio-label">
                    <input type="radio" name="schedulingType" value="flexible" checked={formData.scheduling_type === 'flexible'} onChange={e => setFormData({ ...formData, scheduling_type: e.target.value })} />
                    <span>Je suis flexible</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                        <input type="radio" name="timePref" value="matin" checked={formData.preference_horaire === 'matin'} onChange={() => setFormData({ ...formData, preference_horaire: 'matin' })} disabled={formData.scheduling_type !== 'flexible'} style={{ accentColor: 'var(--primary)' }} />
                        Le matin
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                        <input type="radio" name="timePref" value="apres_midi" checked={formData.preference_horaire === 'apres_midi'} onChange={() => setFormData({ ...formData, preference_horaire: 'apres_midi' })} disabled={formData.scheduling_type !== 'flexible'} style={{ accentColor: 'var(--primary)' }} />
                        L'après-midi
                    </label>
                </div>
            </div>
            <div className="ws-planning-col">
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>Date</div>
                <input type="date" required value={formData.date || ''} onChange={e => setFormData({ ...formData, date: e.target.value })} style={{ padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }} />
            </div>
        </div>
    </div>
);

export const OptionalServicesBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Services optionnels</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem' }}>
            <div className="optional-service-card">
                <div className="optional-service-info">
                    <span className="text-2xl">🧴</span>
                    <span>Produits de nettoyage (+90 MAD)</span>
                </div>
                <label className="toggle-switch">
                    <input type="checkbox" checked={formData.produits || false} onChange={e => setFormData({ ...formData, produits: e.target.checked })} />
                    <span className="toggle-slider"></span>
                </label>
            </div>
            <div className="optional-service-card">
                <div className="optional-service-info">
                    <span className="text-2xl">🧹</span>
                    <span>Torchons et serpillères (+40 MAD)</span>
                </div>
                <label className="toggle-switch">
                    <input type="checkbox" checked={formData.torchons || false} onChange={e => setFormData({ ...formData, torchons: e.target.checked })} />
                    <span className="toggle-slider"></span>
                </label>
            </div>
        </div>
    </div>
);

/* ============================= */
/* ====  AIRBNB BLOCKS  ======= */
/* ============================= */

const AIRBNB_PRICES = {
    A: { studio: 130, '1chambre': 165, '2chambres': 195, '3chambres': 260, '4chambres': 325, villa: 390 },
    B: { studio: 220, '1chambre': 255, '2chambres': 285, '3chambres': 350, '4chambres': 415, villa: 480 }
} as const;

const SIZE_LABELS: Record<string, string> = {
    studio: 'Studio',
    '1chambre': '1 chambre',
    '2chambres': '2 chambres',
    '3chambres': '3 chambres',
    '4chambres': '4 chambres',
    villa: 'Villa'
};

export const FormulesAirbnbBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => {
    const formula = (formData.formula || 'A') as 'A' | 'B';
    const sizeTier = (formData.size_tier || formData.sizeTier || '1chambre') as keyof typeof AIRBNB_PRICES.A;

    return (
        <div className="ws-form-block">
            <div className="ws-section-header">Nos formules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
                {/* Formula Selection */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, formula: 'A' })}
                        className={`ws-nature-card ${formula === 'A' ? 'active' : ''}`}
                        style={{ padding: '1.5rem', textAlign: 'center' }}
                    >
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem', opacity: 0.7 }}>FORMULE A</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>Ménage seul</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormData({ ...formData, formula: 'B' })}
                        className={`ws-nature-card ${formula === 'B' ? 'active' : ''}`}
                        style={{ padding: '1.5rem', textAlign: 'center' }}
                    >
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem', opacity: 0.7 }}>FORMULE B</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>Ménage + set de linge</div>
                    </button>
                </div>

                {/* Size Selection Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {Object.keys(AIRBNB_PRICES.A).map((sizeKey) => {
                        const isSelected = sizeTier === sizeKey;
                        const price = AIRBNB_PRICES[formula][sizeKey as keyof typeof AIRBNB_PRICES.A];
                        return (
                            <button
                                key={sizeKey}
                                type="button"
                                onClick={() => setFormData({ ...formData, size_tier: sizeKey, sizeTier: sizeKey })}
                                className={`ws-surface-card ${isSelected ? 'active' : ''}`}
                                style={{ padding: '1rem', textAlign: 'left' }}
                            >
                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{SIZE_LABELS[sizeKey]}</div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: '0.25rem' }}>{price} DH</div>
                            </button>
                        );
                    })}
                </div>

                {/* Separator */}
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0' }} />

                {/* Réassort consommables */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={formData.conso || false}
                            onChange={(e) => setFormData({ ...formData, conso: e.target.checked })}
                            style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontWeight: 800, fontSize: '0.875rem' }}>Réassort consommables</span>
                    </label>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--primary)' }}>+25 DH</span>
                </div>

                {/* Linen Sets (only if formula B) */}
                {formula === 'B' && (
                    <div style={{ padding: '1rem', border: '2px dashed var(--primary)', borderRadius: '1rem', backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary)' }}>— Ajout de set de linge : +90 DH / set</div>
                                <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', maxWidth: '320px', lineHeight: '1.4' }}>
                                    2 grandes serviettes, 2 moyennes serviettes, 1 drap housse, 1 housse de couette, 1 drap lit, 2 tales d'oreiller
                                </p>
                            </div>
                            <div className="ws-room-counter">
                                <button type="button" className="ws-room-btn" onClick={() => setFormData({ ...formData, linen_sets: Math.max(0, (formData.linen_sets || 0) - 1) })}>−</button>
                                <span className="ws-room-count">{formData.linen_sets || 0}</span>
                                <button type="button" className="ws-room-btn" onClick={() => setFormData({ ...formData, linen_sets: (formData.linen_sets || 0) + 1 })}>+</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ============================= */
/* ==  PLACEMENT BLOCKS  ====== */
/* ============================= */

export const ServiceTypePlacementBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Type de service</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.75rem' }}>
            {[
                { v: 'flexible', l: 'Service ménage flexible' },
                { v: 'premium', l: 'Service ménage Premium' }
            ].map(opt => (
                <label
                    key={opt.v}
                    className={`ws-nature-card ${formData.service_type === opt.v ? 'active' : ''}`}
                    style={{ padding: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}
                    onClick={() => setFormData({ ...formData, service_type: opt.v })}
                >
                    <input
                        type="radio"
                        name="placementServiceType"
                        checked={formData.service_type === opt.v}
                        onChange={() => setFormData({ ...formData, service_type: opt.v })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{opt.l}</span>
                </label>
            ))}
        </div>
    </div>
);

export const StructureTypePlacementBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Type de structure</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', padding: '0.75rem' }}>
            {[
                'Bureaux', 'Magasin/Boutique', 'Restaurant/Café', 'Clinique',
                'Hôpital', 'Hôtel', 'Riad', 'Immeuble/Résidence/Luxe', 'Entrepôt'
            ].map(type => (
                <label
                    key={type}
                    className={`ws-surface-card ${formData.structure_type === type.toLowerCase() ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, structure_type: type.toLowerCase() })}
                    style={{
                        padding: '0.75rem 0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        minHeight: '70px',
                        justifyContent: 'center'
                    }}
                >
                    <input
                        type="radio"
                        name="placementStructureType"
                        checked={formData.structure_type === type.toLowerCase()}
                        onChange={() => setFormData({ ...formData, structure_type: type.toLowerCase() })}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                    />
                    <span>{type}</span>
                </label>
            ))}
        </div>
    </div>
);

export const ServiceBureauxBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Service</div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '1rem', padding: '0.5rem' }}>
            {[
                { v: false, t: 'Ménage sans produit', d: 'Vous fournissez vous-même les produits de nettoyage. Notre équipe se déplace uniquement pour réaliser la prestation.' },
                { v: true, t: 'Ménage avec produit', d: 'Notre équipe apporte les produits de ménage, torchons et serpillères nécessaires à la prestation.' }
            ].map(item => (
                <label
                    key={item.t}
                    className={`ws-nature-card ${formData.produits === item.v ? 'active' : ''}`}
                    style={{
                        padding: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        textAlign: 'left',
                        border: '2px solid transparent',
                        borderRadius: '0.75rem',
                        backgroundColor: formData.produits === item.v ? 'white' : 'rgba(255,255,255,0.5)',
                        transition: 'all 0.2s',
                        height: '100%'
                    }}
                    onClick={() => setFormData({ ...formData, produits: item.v })}
                >
                    <input
                        type="radio"
                        name="produits"
                        checked={formData.produits === item.v}
                        onChange={() => setFormData({ ...formData, produits: item.v })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>{item.t}</span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>{item.d}</span>
                    </div>
                </label>
            ))}
        </div>
    </div>
);

