import React from 'react';
import { extractJoursPassage } from '../../../utils/pricing';

export interface FormBlockProps {
    formData: any;
    setFormData: (data: any) => void;
    activeSegment?: 'particulier' | 'entreprise' | null;
}

export const isStructureTypeMatching = (val?: string, option?: string) => {
    if (!val || !option) return false;
    const v = val.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const o = option.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (v === o) return true;
    
    const stripPlural = (s: string) => s.endsWith('s') ? s.slice(0, -1) : s;
    const vClean = stripPlural(v);
    const oClean = stripPlural(o);
    
    if (vClean === oClean) return true;
    if (o.includes(v) || v.includes(o)) return true;
    if (oClean.includes(vClean) || vClean.includes(oClean)) return true;

    if (v.includes('entrepot') && o.includes('entrepot')) return true;
    if (v.includes('magasin') && o.includes('magasin')) return true;
    if (v.includes('boutique') && o.includes('boutique')) return true;
    if (v.includes('bureau') && o.includes('bureau')) return true;
    if (v.includes('restaurant') && o.includes('restaurant')) return true;
    if (v.includes('cafe') && o.includes('cafe')) return true;
    if (v.includes('hotel') && o.includes('hotel')) return true;
    if (v.includes('riad') && o.includes('riad')) return true;
    if (v.includes('clinique') && o.includes('clinique')) return true;
    if (v.includes('hopital') && o.includes('hopital')) return true;
    if (v.includes('sante') && o.includes('sante')) return true;
    if (v.includes('enseignement') && o.includes('enseignement')) return true;
    if (v.includes('usine') && o.includes('usine')) return true;
    if (v.includes('laboratoire') && o.includes('laboratoire')) return true;
    if (v.includes('agence') && o.includes('agence')) return true;
    if (v.includes('duplex') && o.includes('duplex')) return true;
    if (v.includes('studio') && o.includes('studio')) return true;
    if (v.includes('villa') && o.includes('villa')) return true;
    if (v.includes('maison') && o.includes('maison')) return true;
    if (v.includes('appartement') && o.includes('appartement')) return true;
    
    return false;
};

export const HabitationTypeBlock: React.FC<FormBlockProps> = ({ formData, setFormData, activeSegment }) => {
    const isEntreprise = activeSegment === 'entreprise';
    const options = isEntreprise
        ? [
            "Bureaux",
            "Usines",
            "Entrepôts : stockage de marchandises et logistique.",
            "Magasins / Boutiques/showrooms",
            "Établissements de santé",
            "Établissements d'enseignement",
            "Restaurants",
            "Hôtels / Hébergements",
            "Laboratoires",
            "Agences : banques, immobilières..."
          ]
        : ['Studio', 'Appartement', 'Duplex', 'Villa', 'Maison'];

    return (
        <div className="ws-form-block">
            <div className="ws-section-header">
                {isEntreprise ? "Type de locaux" : "Type d'habitation"}
            </div>
            <div className="ws-radio-pills" style={isEntreprise ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } : undefined}>
                {options.map(type => (
                    <label key={type} className="ws-radio-pill" style={isEntreprise ? { justifyContent: 'flex-start', padding: '0.75rem' } : undefined}>
                        <input 
                            type="radio" 
                            name="propertyType" 
                            value={type} 
                            checked={isStructureTypeMatching(formData.type_habitation, type)} 
                            onChange={e => setFormData({ ...formData, type_habitation: e.target.value })} 
                        />
                        <span style={isEntreprise ? { textAlign: 'left', fontSize: '0.8rem' } : undefined}>{type}</span>
                    </label>
                ))}
            </div>
        </div>
    );
};

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

const ALL_DAYS = [
    { key: 'lundi', label: 'Lundi' },
    { key: 'mardi', label: 'Mardi' },
    { key: 'mercredi', label: 'Mercredi' },
    { key: 'jeudi', label: 'Jeudi' },
    { key: 'vendredi', label: 'Vendredi' },
    { key: 'samedi', label: 'Samedi' },
    { key: 'dimanche', label: 'Dimanche' }
];

const addHoursToTime = (timeStr: string, durationHours: number): string => {
    if (!timeStr) return '13:00';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h)) h = 9;
    if (isNaN(m)) m = 0;

    const totalMinutes = h * 60 + m + Math.round((durationHours || 4) * 60);
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;

    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

export const FrequenceBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => {
    const isAbo = formData.frequence && formData.frequence !== 'une fois';
    const dureeHours = Number(formData.duree || formData.nb_heures || 4);

    const getTargetCount = (freq: string): number => {
        if (!freq || freq === 'une fois') return 1;
        const match = freq.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
    };

    const targetCount = getTargetCount(formData.frequence || '1/sem');

    const existingDetailMap = new Map<string, { heure_debut: string; heure_fin: string }>();
    if (Array.isArray(formData.jours_intervention_detail)) {
        formData.jours_intervention_detail.forEach((item: any) => {
            if (item && item.jour) {
                existingDetailMap.set(item.jour.toLowerCase(), {
                    heure_debut: item.heure_debut || formData.heure || '09:00',
                    heure_fin: item.heure_fin || addHoursToTime(item.heure_debut || formData.heure || '09:00', dureeHours)
                });
            }
        });
    }

    // Try each source separately — empty arrays are truthy in JS, so || chaining fails
    let extractedDays: string[] = [];
    const daySources = [
        formData.jours_intervention_detail,
        formData.jours_intervention,
        formData.jours_passage,
        formData.planning?.jours_intervention
    ];
    for (const src of daySources) {
        if (src !== undefined && src !== null && src !== '') {
            const parsed = extractJoursPassage(src);
            if (parsed.length > 0) {
                extractedDays = parsed;
                break;
            }
        }
    }

    // Frequency-based fallback aligned with SubscriptionManagementView
    const getFrequencyDefaultDays = (count: number): string[] => {
        if (count === 1) return ['samedi'];
        if (count === 2) return ['lundi', 'jeudi'];
        if (count === 3) return ['lundi', 'mercredi', 'vendredi'];
        if (count === 4) return ['lundi', 'mardi', 'mercredi', 'jeudi'];
        if (count === 5) return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
        if (count === 6) return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        if (count === 7) return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        return ALL_DAYS.slice(0, count).map(d => d.key);
    };

    const effectiveDays = extractedDays.length > 0
        ? extractedDays
        : getFrequencyDefaultDays(targetCount);

    const currentDetail: Array<{ jour: string; heure_debut: string; heure_fin: string }> = effectiveDays.map(jKey => {
        const keyLower = jKey.toLowerCase();
        const existing = existingDetailMap.get(keyLower);
        const start = existing?.heure_debut || formData.heure || '09:00';
        const end = existing?.heure_fin || addHoursToTime(start, dureeHours);
        return { jour: keyLower, heure_debut: start, heure_fin: end };
    });

    const selectedKeys = currentDetail.map(d => d.jour.toLowerCase());

    const updateDaysAndFreq = (newDetail: Array<{ jour: string; heure_debut: string; heure_fin: string }>, newFreq?: string) => {
        const daysList = newDetail.map(d => d.jour.toLowerCase());
        const daysFormattedStr = newDetail.map(d => {
            const match = ALL_DAYS.find(ad => ad.key === d.jour.toLowerCase());
            return match ? match.label : d.jour;
        }).join(' + ');

        const freqToSet = newFreq || (daysList.length > 0 ? `${daysList.length}/sem` : formData.frequence);

        setFormData({
            ...formData,
            frequence: freqToSet,
            jours_intervention_detail: newDetail,
            jours_intervention: daysList,
            jours_passage: daysFormattedStr,
            jours_par_semaine: daysList.length
        });
    };

    const handleToggleDay = (dayKey: string) => {
        let nextDetail = [...currentDetail];
        const existingIdx = nextDetail.findIndex(d => d.jour.toLowerCase() === dayKey.toLowerCase());
        if (existingIdx >= 0) {
            if (nextDetail.length > 1) {
                nextDetail.splice(existingIdx, 1);
            }
        } else {
            const defaultStart = formData.heure || '09:00';
            const defaultEnd = addHoursToTime(defaultStart, dureeHours);
            nextDetail.push({ jour: dayKey.toLowerCase(), heure_debut: defaultStart, heure_fin: defaultEnd });
        }
        updateDaysAndFreq(nextDetail);
    };

    const handleTimeChange = (dayKey: string, field: 'heure_debut' | 'heure_fin', val: string) => {
        const nextDetail = currentDetail.map(d => {
            if (d.jour.toLowerCase() === dayKey.toLowerCase()) {
                if (field === 'heure_debut') {
                    const computedEnd = addHoursToTime(val, dureeHours);
                    return { ...d, heure_debut: val, heure_fin: computedEnd };
                }
                return { ...d, [field]: val };
            }
            return d;
        });
        updateDaysAndFreq(nextDetail, formData.frequence);
    };

    const handleFreqSelectChange = (newFreq: string) => {
        const newTarget = getTargetCount(newFreq);
        let nextDetail = [...currentDetail];
        if (nextDetail.length < newTarget) {
            const unselected = ALL_DAYS.filter(d => !nextDetail.some(nd => nd.jour.toLowerCase() === d.key));
            for (let i = 0; i < newTarget - nextDetail.length && i < unselected.length; i++) {
                const defaultStart = formData.heure || '09:00';
                nextDetail.push({ jour: unselected[i].key, heure_debut: defaultStart, heure_fin: addHoursToTime(defaultStart, dureeHours) });
            }
        } else if (nextDetail.length > newTarget) {
            nextDetail = nextDetail.slice(0, newTarget);
        }
        updateDaysAndFreq(nextDetail, newFreq);
    };

    return (
        <div className="ws-form-block">
            <div className="ws-section-header">Choisissez la fréquence</div>
            <div className="ws-freq-toggle">
                <button
                    type="button"
                    className={!isAbo ? 'active' : ''}
                    onClick={() => setFormData({ ...formData, frequence: 'une fois' })}
                >
                    Une fois
                </button>
                <button
                    type="button"
                    className={isAbo ? 'active' : ''}
                    onClick={() => {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        const defaultStart = formData.heure || '09:00';
                        const fallbackDetail = ALL_DAYS.slice(0, 1).map(d => ({ jour: d.key, heure_debut: defaultStart, heure_fin: addHoursToTime(defaultStart, dureeHours) }));
                        const detailToUse = currentDetail.length > 0 ? currentDetail : fallbackDetail;
                        const startDate = formData.date_demarrage || formData.date_debut || formData.date || todayStr;
                        const targetFreq = formData.frequence && formData.frequence !== 'une fois' ? formData.frequence : `${detailToUse.length}/sem`;
                        setFormData({
                            ...formData,
                            date_demarrage: startDate,
                            date_debut: startDate,
                            date: startDate
                        });
                        updateDaysAndFreq(detailToUse, targetFreq);
                    }}
                >
                    Abonnement
                </button>
            </div>

            {isAbo && (
                <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ maxWidth: '380px', margin: '0 auto 1.5rem' }}>
                        <div className="ws-discount-badge">-10 % de réduction sur l'abonnement</div>
                        <select
                            className="ws-select"
                            value={formData.frequence || '1/sem'}
                            onChange={e => handleFreqSelectChange(e.target.value)}
                        >
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

                    {/* JOURS D'INTERVENTION SECTION matching UI screenshots */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#034a3e', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                JOURS D'INTERVENTION *
                            </span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f766e' }}>
                                {selectedKeys.length}/{targetCount} jour(s) sélectionné(s)
                            </span>
                        </div>

                        {/* Days buttons grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                            {ALL_DAYS.map(day => {
                                const isSelected = selectedKeys.includes(day.key);
                                return (
                                    <button
                                        key={day.key}
                                        type="button"
                                        onClick={() => handleToggleDay(day.key)}
                                        style={{
                                            padding: '0.625rem 0.25rem',
                                            borderRadius: '10px',
                                            border: isSelected ? '1px solid #006654' : '1px solid #e2e8f0',
                                            backgroundColor: isSelected ? '#006654' : '#ffffff',
                                            color: isSelected ? '#ffffff' : '#475569',
                                            fontWeight: isSelected ? 700 : 500,
                                            fontSize: '0.8125rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            textAlign: 'center'
                                        }}
                                    >
                                        {day.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Horaires par jour */}
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#475569', marginBottom: '0.75rem' }}>
                            Horaires par jour (début / fin)
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                            {currentDetail.map(detail => {
                                const dayObj = ALL_DAYS.find(ad => ad.key === detail.jour.toLowerCase());
                                const dayLabel = dayObj ? dayObj.label : detail.jour;
                                return (
                                    <div
                                        key={detail.jour}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            padding: '0.625rem 0.875rem'
                                        }}
                                    >
                                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a', width: '90px' }}>
                                            {dayLabel}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="time"
                                                value={detail.heure_debut || '09:00'}
                                                onChange={e => handleTimeChange(detail.jour, 'heure_debut', e.target.value)}
                                                style={{
                                                    padding: '0.375rem 0.5rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600,
                                                    color: '#1e293b',
                                                    backgroundColor: '#f8fafc',
                                                    outline: 'none'
                                                }}
                                            />
                                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>→</span>
                                            <input
                                                type="time"
                                                value={detail.heure_fin || '13:00'}
                                                onChange={e => handleTimeChange(detail.jour, 'heure_fin', e.target.value)}
                                                style={{
                                                    padding: '0.375rem 0.5rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '0.875rem',
                                                    fontWeight: 600,
                                                    color: '#1e293b',
                                                    backgroundColor: '#f8fafc',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Date de démarrage de l'abonnement */}
                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div>
                                <label style={{ fontWeight: 800, fontSize: '0.8125rem', color: '#034a3e', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                                    DATE DE DÉBUT DE L'ABONNEMENT *
                                </label>
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
                                    Date de la première intervention / démarrage du contrat
                                </span>
                            </div>
                            <input
                                type="date"
                                required
                                value={formData.date_demarrage || formData.date_debut || formData.date || new Date().toISOString().slice(0, 10)}
                                onChange={e => {
                                    const val = e.target.value || new Date().toISOString().slice(0, 10);
                                    setFormData({
                                        ...formData,
                                        date_demarrage: val,
                                        date_debut: val,
                                        date: val
                                    });
                                }}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '10px',
                                    border: '1.5px solid #0f766e',
                                    backgroundColor: '#ffffff',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

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

export const DurationBlock: React.FC<DurationBlockProps> = ({ formData, setFormData, minDuree }) => (
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
        </div>
    </div>
);

export const PeopleBlock: React.FC<DurationBlockProps> = ({ formData, setFormData }) => (
    <div className="ws-form-block">
        <div className="ws-section-header">Nombre de personne</div>
        <div className="flex items-center justify-center gap-4">
            <div className="ws-counter">
                <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_intervenants: Math.max(1, (formData.nb_intervenants || 1) - 1) })} disabled={(formData.nb_intervenants || 1) <= 1}>−</button>
                <span className="ws-counter-value">{formData.nb_intervenants || 1}</span>
                <button type="button" className="ws-counter-btn" onClick={() => setFormData({ ...formData, nb_intervenants: (formData.nb_intervenants || 1) + 1 })}>+</button>
            </div>
        
        </div>
    </div>
);

export const PlanningBlock: React.FC<FormBlockProps> = ({ formData, setFormData }) => {
    const isAbo = Boolean(formData.frequence && formData.frequence !== 'une fois');

    return (
        <div
            className="ws-form-block"
            style={isAbo ? { opacity: 0.55, pointerEvents: 'none', filter: 'grayscale(0.4)' } : {}}
        >
            <div className="ws-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Planning pour votre demande</span>
                {isAbo && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', fontStyle: 'italic' }}>
                        (Information définie dans l'abonnement ci-dessus)
                    </span>
                )}
            </div>
            <div className="ws-planning-grid">
                <div className="ws-planning-col">
                    <label className="ws-planning-radio-label">
                        <input
                            type="radio"
                            name="schedulingType"
                            value="fixed"
                            checked={formData.scheduling_type === 'fixed'}
                            onChange={e => setFormData({ ...formData, scheduling_type: e.target.value })}
                            disabled={isAbo}
                        />
                        <span>Heure fixe</span>
                    </label>
                    <input
                        type="time"
                        value={formData.heure || ''}
                        onChange={e => setFormData({ ...formData, heure: e.target.value })}
                        disabled={isAbo || formData.scheduling_type !== 'fixed'}
                        style={{ width: '120px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px' }}
                    />
                </div>
                <div className="ws-planning-col">
                    <label className="ws-planning-radio-label">
                        <input
                            type="radio"
                            name="schedulingType"
                            value="flexible"
                            checked={formData.scheduling_type === 'flexible'}
                            onChange={e => setFormData({ ...formData, scheduling_type: e.target.value })}
                            disabled={isAbo}
                        />
                        <span>Je suis flexible</span>
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                            <input
                                type="radio"
                                name="timePref"
                                value="matin"
                                checked={formData.preference_horaire === 'matin'}
                                onChange={() => setFormData({ ...formData, preference_horaire: 'matin' })}
                                disabled={isAbo || formData.scheduling_type !== 'flexible'}
                                style={{ accentColor: 'var(--primary)' }}
                            />
                            Le matin
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}>
                            <input
                                type="radio"
                                name="timePref"
                                value="apres_midi"
                                checked={formData.preference_horaire === 'apres_midi'}
                                onChange={() => setFormData({ ...formData, preference_horaire: 'apres_midi' })}
                                disabled={isAbo || formData.scheduling_type !== 'flexible'}
                                style={{ accentColor: 'var(--primary)' }}
                            />
                            L'après-midi
                        </label>
                    </div>
                </div>
                <div className="ws-planning-col">
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>Date</div>
                    <input
                        type="date"
                        required={!isAbo}
                        value={formData.date || ''}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        disabled={isAbo}
                        style={{ padding: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem' }}
                    />
                </div>
            </div>
        </div>
    );
};

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
            ].map(type => {
                const isSelected = isStructureTypeMatching(formData.structure_type, type);
                return (
                    <label
                        key={type}
                        className={`ws-surface-card ${isSelected ? 'active' : ''}`}
                        onClick={() => setFormData({ ...formData, structure_type: type })}
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
                            checked={isSelected}
                            onChange={() => setFormData({ ...formData, structure_type: type })}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                        />
                        <span>{type}</span>
                    </label>
                );
            })}
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

