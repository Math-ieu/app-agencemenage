import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, RotateCw, Check } from 'lucide-react';
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
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Demain par défaut
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
    { code: 'capsules_cafe', label: 'Pack Capsules Café & Thé Premium (10 caps)', prix: 30 },
    { code: 'kit_vip', label: 'Kit Produits d\'Accueil VIP (Shampoing, Savon, Gel)', prix: 40 },
    { code: 'papier_essuie', label: 'Pack Réassort Papier Toilette & Essuie-tout (4 rouleaux)', prix: 25 },
    { code: 'express_laverie', label: 'Supplément Traitement Express Laverie < 24h', prix: 50 },
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
      alert(err.response?.data?.error || "Erreur lors de la création de la commande");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* ══════════ TOP ALERT CUT-OFF ══════════ */}
      {cutoffStatus && (
        <div style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: !cutoffStatus.is_late ? '#f0fdf4' : '#fef2f2', border: `1px solid ${!cutoffStatus.is_late ? '#bbf7d0' : '#fecaca'}`, color: !cutoffStatus.is_late ? '#166534' : '#991b1b' }}>
          {!cutoffStatus.is_late ? <CheckCircle2 size={20} color="#16a34a" /> : <AlertTriangle size={20} color="#dc2626" />}
          <div>
            <span style={{ fontWeight: 700, display: 'block', fontSize: '0.85rem' }}>{cutoffStatus.message}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
              {!cutoffStatus.is_late 
                ? "Délai contractuel J-1 respecté. Le turnover sera automatiquement planifié et assigné." 
                : "Attention : Commande tardive saisie après l'heure de cut-off. Majoration d'urgence applicable."}
            </span>
          </div>
        </div>
      )}

      {/* ══════════ MAIN 2-COLUMN LAYOUT ══════════ */}
      <div className="nc-layout">
        {/* LEFT COLUMN: The 4 Steps */}
        <div className="nc-left-col">
          {/* STEP 1: Logement & Client */}
          <div className="nc-card">
            <div className="nc-card-header">
              <h2>1. Logement & Client</h2>
            </div>
            <div className="nc-card-body">
              <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                Sélectionner le Logement Airbnb *
              </label>
              <select
                value={selectedBienId}
                onChange={(e) => setSelectedBienId(e.target.value)}
                disabled={loadingBiens}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', background: '#ffffff', outline: 'none' }}
              >
                {biens.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.nom_bien || b.quartier} [{b.typologie.toUpperCase()}] ({b.client_name})
                  </option>
                ))}
              </select>

              {selectedBien && (
                <div className="nc-property-preview">
                  <div className="nc-prop-item">
                    <span className="nc-prop-label">Adresse & Quartier</span>
                    <span className="nc-prop-value">{selectedBien.adresse} ({selectedBien.quartier})</span>
                  </div>
                  <div className="nc-prop-item">
                    <span className="nc-prop-label">Accès Sécurisé</span>
                    <span className="nc-prop-value">{selectedBien.acces_type?.replace(/_/g, ' ') || 'Standard'}</span>
                  </div>
                  <div className="nc-prop-item">
                    <span className="nc-prop-label">Typologie & Couchages</span>
                    <span className="nc-prop-value" style={{ color: '#0d9488' }}>{selectedBien.typologie.toUpperCase()}</span>
                  </div>
                  <div className="nc-prop-item">
                    <span className="nc-prop-label">Zone Éloignée</span>
                    <span className="nc-prop-value" style={{ color: selectedBien.zone_eloignee ? '#dc2626' : '#16a34a' }}>
                      {selectedBien.zone_eloignee ? 'Oui (+50 DH)' : 'Non (Standard)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: Date & Créneau */}
          <div className="nc-card">
            <div className="nc-card-header">
              <h2>2. Date & Créneau d'Intervention</h2>
            </div>
            <div className="nc-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Date de Prestation *
                  </label>
                  <input
                    type="date"
                    required
                    value={datePrestation}
                    onChange={(e) => setDatePrestation(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Heure Souhaitée
                  </label>
                  <input
                    type="time"
                    value={heurePrestation}
                    onChange={(e) => setHeurePrestation(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', background: '#ffffff', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.5rem' }}>
                Créneau Réglementaire (Cut-Off)
              </label>
              <div className="nc-selectable-grid">
                <div
                  className={`nc-select-card ${creneau === 'matin' ? 'selected' : ''}`}
                  onClick={() => setCreneau('matin')}
                >
                  <div className="nc-card-title">
                    <span>Matin (avant 12h)</span>
                    {creneau === 'matin' && <Check size={16} color="#00473E" />}
                  </div>
                  <div className="nc-card-desc">
                    Cut-off de saisie : 21h00 la veille (J-1).
                  </div>
                </div>

                <div
                  className={`nc-select-card ${creneau === 'apres_midi' ? 'selected' : ''}`}
                  onClick={() => setCreneau('apres_midi')}
                >
                  <div className="nc-card-title">
                    <span>Après-midi (après 12h)</span>
                    {creneau === 'apres_midi' && <Check size={16} color="#00473E" />}
                  </div>
                  <div className="nc-card-desc">
                    Cut-off de saisie : 22h00 la veille (J-1).
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: Chaîne du Linge */}
          <div className="nc-card">
            <div className="nc-card-header">
              <h2>3. Chaîne du Linge</h2>
            </div>
            <div className="nc-card-body">
              <div className="nc-selectable-grid">
                <div
                  className={`nc-select-card ${natureLinge === 'depot_ramassage' ? 'selected' : ''}`}
                  onClick={() => setNatureLinge('depot_ramassage')}
                >
                  <div className="nc-card-title">
                    <span>Dépôt + Ramassage</span>
                    {natureLinge === 'depot_ramassage' && <Check size={16} color="#00473E" />}
                  </div>
                  <div className="nc-card-desc">
                    Standard complet (Linge propre mis en place + sac sale collecté).
                  </div>
                </div>

                <div
                  className={`nc-select-card ${natureLinge === 'depot_seul' ? 'selected' : ''}`}
                  onClick={() => setNatureLinge('depot_seul')}
                >
                  <div className="nc-card-title">
                    <span>Dépôt Seul</span>
                    {natureLinge === 'depot_seul' && <Check size={16} color="#00473E" />}
                  </div>
                  <div className="nc-card-desc">
                    Mise en place propre uniquement.
                  </div>
                </div>

                <div
                  className={`nc-select-card ${natureLinge === 'ramassage_seul' ? 'selected' : ''}`}
                  onClick={() => setNatureLinge('ramassage_seul')}
                >
                  <div className="nc-card-title">
                    <span>Ramassage Seul</span>
                    {natureLinge === 'ramassage_seul' && <Check size={16} color="#00473E" />}
                  </div>
                  <div className="nc-card-desc">
                    Collecte sac sale vers la blanchisserie.
                  </div>
                </div>

                <div
                  className={`nc-select-card ${natureLinge === 'sans_linge' ? 'selected' : ''}`}
                  onClick={() => setNatureLinge('sans_linge')}
                >
                  <div className="nc-card-title">
                    <span>Sans Linge</span>
                    {natureLinge === 'sans_linge' && <Check size={16} color="#00473E" />}
                  </div>
                  <div className="nc-card-desc">
                    Ménage et remise en état uniquement.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 4: Options Réassort */}
          <div className="nc-card">
            <div className="nc-card-header">
              <h2>4. Options de Réassort & Consommables</h2>
            </div>
            <div className="nc-card-body">
              <div className="nc-options-list">
                {availableOptions.map((opt) => {
                  const isChecked = selectedOptions.some(o => o.code === opt.code);
                  return (
                    <div
                      key={opt.code}
                      className={`nc-option-row ${isChecked ? 'checked' : ''}`}
                      onClick={() => toggleOption(opt)}
                    >
                      <div className="nc-option-left">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                        />
                        <span className="nc-option-name">{opt.label}</span>
                      </div>
                      <span className="nc-option-price">+{opt.prix} DH</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT STICKY COLUMN: Luxury Pricing Box */}
        <div className="nc-right-col">
          <div className="nc-pricing-card">
            <div className="nc-pricing-head">
              Récapitulatif Financier Prévisionnel
            </div>

            <div className="nc-pricing-rows">
              <div className="nc-pricing-row">
                <span>Ménage de base ({selectedBien?.typologie.toUpperCase() || 'Studio'})</span>
                <span className="val">{pricingBreakdown?.prix_menage || 130} DH</span>
              </div>

              {selectedBien?.zone_eloignee && (
                <div className="nc-pricing-row">
                  <span>Supplément Zone Éloignée</span>
                  <span className="val" style={{ color: '#fde047' }}>+50 DH</span>
                </div>
              )}

              <div className="nc-pricing-row">
                <span>Chaîne du Linge</span>
                <span className="val" style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#99f6e4' }}>
                  Facturé après pesée
                </span>
              </div>

              {selectedOptions.map(opt => (
                <div key={opt.code} className="nc-pricing-row">
                  <span style={{ fontSize: '0.785rem' }}>{opt.label.split('(')[0]}</span>
                  <span className="val">+{opt.prix} DH</span>
                </div>
              ))}
            </div>

            <div className="nc-pricing-divider" />

            <div className="nc-total-row">
              <span className="nc-total-label">Total Prévisionnel TTC</span>
              <span className="nc-total-value">
                {calculating ? '...' : `${pricingBreakdown?.total_ttc_hors_linge || pricingBreakdown?.total_ttc || 130} DH`}
              </span>
            </div>

            <div className="nc-pricing-disclaimer">
              <b>Règle de Facturation du Linge :</b><br />
              Le montant du linge (8 pièces = 50 DH) sera figé lors du comptage contradictoire en laverie et imputé sur la présente commande.
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedBienId}
              className="nc-btn-validate"
            >
              {submitting ? (
                <>
                  <RotateCw size={18} className="animate-spin" />
                  Validation en cours...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Valider la Commande
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
