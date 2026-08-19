import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Sparkles, Shirt, Check, PlusCircle, ArrowRight } from 'lucide-react';
import { getBiens, calculateCommandePrice, createCommandeAirbnb, extractResults } from '../../api/airbnb';
import type { Bien, NatureLinge, CreneauCommande } from '../../types/airbnb';
import './NouvelleCommande.css';

export default function NouvelleCommandeView() {
  const navigate = useNavigate();
  const [biens, setBiens] = useState<Bien[]>([]);
  const [loadingBiens, setLoadingBiens] = useState(true);

  // Form State
  const [selectedBienId, setSelectedBienId] = useState<string>('');
  const [datePrestation, setDatePrestation] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [heurePrestation, setHeurePrestation] = useState<string>('11:00');
  const [creneau, setCreneau] = useState<CreneauCommande>('matin');
  const [natureLinge, setNatureLinge] = useState<NatureLinge>('depot_ramassage');
  
  // Selected Options
  const [selectedOptions, setSelectedOptions] = useState<Array<{ code: string; label: string; prix: number }>>([]);
  const [remiseEnEtat] = useState<number>(0);

  // Price & Cutoff Calculation State
  const [calculating, setCalculating] = useState(false);
  const [pricingBreakdown, setPricingBreakdown] = useState<any>(null);
  const [cutoffStatus, setCutoffStatus] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Available options catalog
  const availableOptions = [
    { code: 'reassort_essentiel', label: 'Réassort Essentiel (Gel douche, shampoing, savon, papier toilette)', prix: 49 },
    { code: 'reassort_confort', label: 'Réassort Confort (Pack Essentiel + café 6 capsules, thé, sucre, éponge)', prix: 79 },
    { code: 'video_etat_lieux', label: 'Vidéo avant / après (Vidéo panoramique horodatée de l\'état des lieux)', prix: 10 },
    { code: 'materiel_agence', label: 'Matériel fourni par l\'agence (Aspirateur + serpillière pro transportés)', prix: 29 },
  ];

  // Fetch Biens on Mount
  useEffect(() => {
    getBiens()
      .then((res) => {
        const list = extractResults<Bien>(res.data);
        setBiens(list);
        if (list.length > 0) {
          setSelectedBienId(list[0].id);
        }
      })
      .catch((err) => console.error("Erreur chargement biens :", err))
      .finally(() => setLoadingBiens(false));
  }, []);

  // Recalculate Price & Cutoff when params change
  useEffect(() => {
    if (!selectedBienId || !datePrestation) return;

    setCalculating(true);
    calculateCommandePrice({
      bien_id: selectedBienId,
      date_prestation: datePrestation,
      heure_prestation: heurePrestation,
      creneau,
      options: selectedOptions,
      remise_en_etat: Number(remiseEnEtat) || 0,
    })
      .then((res) => {
        setPricingBreakdown(res.data?.pricing || res.data);
        setCutoffStatus(res.data?.cutoff || null);
      })
      .catch((err) => console.error("Erreur calcul prix :", err))
      .finally(() => setCalculating(false));
  }, [selectedBienId, datePrestation, heurePrestation, creneau, natureLinge, selectedOptions, remiseEnEtat]);

  const selectedBien = biens.find((b) => b.id === selectedBienId);

  const toggleOption = (opt: { code: string; label: string; prix: number }) => {
    if (selectedOptions.some(o => o.code === opt.code)) {
      setSelectedOptions(selectedOptions.filter(o => o.code !== opt.code));
    } else {
      setSelectedOptions([...selectedOptions, opt]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBienId || !datePrestation) return;

    setSubmitting(true);
    try {
      await createCommandeAirbnb({
        bien: selectedBienId,
        date_prestation: datePrestation,
        heure_prestation: heurePrestation,
        creneau,
        nature_linge: natureLinge,
        options: selectedOptions,
        remise_en_etat: Number(remiseEnEtat) || 0,
        statut: 'saisie',
        photos_cloture: [],
      });
      navigate('/airbnb/commandes');
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'enregistrement du turnover.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="nc-container">
      {/* Alerte Délais de Cut-off */}
      <div className="nc-banner-presentation">
        <Clock size={20} />
        <div>
          <span className="nc-banner-presentation-title">Règle de Présentation & Délais Cut-off</span>
          Intervention avant 11h00 : commande impérative avant 21h00 la veille. Intervention à partir de 12h00 : saisie possible jusqu'à 22h00 la veille.
        </div>
      </div>

      <div className="nc-layout-grid">
        {/* Colonne Formulaire Principal */}
        <form onSubmit={handleSubmit} className="nc-form-col">
          {/* Bloc 1 : Logement & Planning */}
          <div className="nc-card">
            <div className="nc-card-header">
              <Sparkles size={18} />
              <h3>1. Choix du Logement & Date d'Intervention</h3>
            </div>
            <div className="nc-card-body">
              <div className="nc-form-group">
                <label className="nc-form-label">Logement Airbnb <span className="req">*</span></label>
                {loadingBiens ? (
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Chargement des logements...</div>
                ) : (
                  <select
                    value={selectedBienId}
                    onChange={(e) => setSelectedBienId(e.target.value)}
                    required
                    className="nc-form-select"
                  >
                    {biens.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} — {b.nom_bien || b.quartier} ({b.typologie} {b.zone_eloignee ? '· Zone éloignée' : ''})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="nc-form-grid-3">
                <div className="nc-form-group">
                  <label className="nc-form-label">Date du Check-out <span className="req">*</span></label>
                  <input
                    type="date"
                    value={datePrestation}
                    onChange={(e) => setDatePrestation(e.target.value)}
                    required
                    className="nc-form-input"
                  />
                </div>

                <div className="nc-form-group">
                  <label className="nc-form-label">Heure Souhaitée <span className="req">*</span></label>
                  <input
                    type="time"
                    value={heurePrestation}
                    onChange={(e) => {
                      const time = e.target.value;
                      setHeurePrestation(time);
                      const hour = parseInt(time.split(':')[0], 10);
                      setCreneau(hour < 12 ? 'matin' : 'apres_midi');
                    }}
                    required
                    className="nc-form-input"
                  />
                </div>

                <div className="nc-form-group">
                  <label className="nc-form-label">Créneau Opérationnel</label>
                  <div className="nc-creneau-badge">
                    {creneau === 'matin' ? 'Matin (avant 12h)' : 'Après-midi (après 12h)'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bloc 2 : Chaîne du Linge */}
          <div className="nc-card">
            <div className="nc-card-header">
              <Shirt size={18} />
              <h3>2. Gestion de la Chaîne du Linge</h3>
            </div>
            <div className="nc-card-body">
              <label className="nc-form-label">Nature de l'opération linge</label>
              <div className="nc-nature-grid">
                {[
                  { value: 'sans_linge', title: 'Aucun (sans linge)', desc: 'Ménage uniquement' },
                  { value: 'depot_seul', title: 'Dépôt seul', desc: 'Livraison linge propre' },
                  { value: 'ramassage_seul', title: 'Ramassage seul', desc: 'Collecte linge sale' },
                  { value: 'depot_ramassage', title: 'Dépôt + Ramassage', desc: 'Cycle standard complet' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setNatureLinge(item.value as NatureLinge)}
                    className={`nc-nature-card ${natureLinge === item.value ? 'selected' : ''}`}
                  >
                    <div className="nc-nature-title">{item.title}</div>
                    <div className="nc-nature-desc">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bloc 3 : Options & Réassort */}
          <div className="nc-card">
            <div className="nc-card-header">
              <PlusCircle size={18} />
              <h3>3. Packs Réassort & Options Complémentaires</h3>
            </div>
            <div className="nc-card-body">
              <div className="nc-options-list">
                {availableOptions.map((opt) => {
                  const isChecked = selectedOptions.some((o) => o.code === opt.code);
                  return (
                    <div
                      key={opt.code}
                      onClick={() => toggleOption(opt)}
                      className={`nc-option-row ${isChecked ? 'selected' : ''}`}
                    >
                      <div className="nc-checkbox-custom">
                        {isChecked && <Check size={14} />}
                      </div>
                      <div className="nc-option-info">
                        <div className="nc-option-label">{opt.label}</div>
                      </div>
                      <div className="nc-option-price">+{opt.prix} DH</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bouton de Validation */}
          <button
            type="submit"
            disabled={submitting || (cutoffStatus && !cutoffStatus.is_valid)}
            className="nc-btn-submit"
          >
            {submitting ? (
              'Enregistrement de la commande...'
            ) : (
              <>
                <span>Confirmer et Enregistrer la Commande</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Colonne Sticky : Tarification & Décomposition Financière */}
        <div className="nc-pricing-col">
          <div className="nc-pricing-box">
            <h4 className="nc-pricing-box-title">Synthèse Financière</h4>

            {calculating ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#ccfbf1', fontSize: '0.85rem' }}>
                Calcul du tarif en direct...
              </div>
            ) : (
              <>
                <div className="nc-pricing-rows">
                  <div className="nc-p-row">
                    <span>Ménage Turnover ({selectedBien?.typologie || 'studio'}) :</span>
                    <strong>{pricingBreakdown?.prix_menage || (selectedBien?.typologie === 'studio' ? 130 : 160)} DH</strong>
                  </div>

                  {pricingBreakdown?.supplement_zone > 0 && (
                    <div className="nc-p-row alert-row">
                      <span>Zone Éloignée ({selectedBien?.quartier}) :</span>
                      <strong>+{pricingBreakdown.supplement_zone} DH</strong>
                    </div>
                  )}

                  {selectedOptions.length > 0 && (
                    <div className="nc-p-row">
                      <span>Options Réassort ({selectedOptions.length}) :</span>
                      <strong>+{pricingBreakdown?.prix_options || selectedOptions.reduce((a, b) => a + b.prix, 0)} DH</strong>
                    </div>
                  )}

                  {/* Mention réglementaire linge */}
                  <div className="nc-p-row linen-row">
                    <span>Linge ramassé :</span>
                    <span style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>Chiffré au ramassage (50 DH/set)</span>
                  </div>
                </div>

                <div className="nc-pricing-total-box">
                  <div className="nc-p-total-lbl">Sous-total Immédiat</div>
                  <div className="nc-p-total-val">
                    {pricingBreakdown?.total_ttc_hors_linge || 
                      ((selectedBien?.typologie === 'studio' ? 130 : 160) + 
                       (selectedBien?.zone_eloignee ? 50 : 0) + 
                       selectedOptions.reduce((a, b) => a + b.prix, 0))} DH
                  </div>
                  <div className="nc-p-total-sub">+ Linge comptabilisé après passage runner</div>
                </div>
              </>
            )}

            {/* Règles de facturation */}
            <div className="nc-pricing-notes">
              <CheckCircle2 size={16} />
              <div>
                Facturation groupée le 26 du mois sous réserve des 4 photos validées et du décompte linge contradictoire.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
