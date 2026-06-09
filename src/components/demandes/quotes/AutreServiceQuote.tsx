import { useEffect, useState } from "react";
import { FormulaBox, B, s, ResultBar, fmt, Field } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

interface AutreServiceQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
  formData?: any;
  setFormData?: (data: any) => void;
  onUpdateDemandeData?: (patch: Record<string, any>) => void;
}

const DEFAULT_OPTIONS = [
  { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
  { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false },
  { key: "machines", label: "Machines et équipements (aspirateur, vapeur, etc.)", price: 0, enabled: false }
];

export default function AutreServiceQuote({
  demande,
  onPrestationsChange,
  formData: externalFormData,
  setFormData: externalSetFormData,
  onUpdateDemandeData
}: AutreServiceQuoteProps) {
  const data = externalFormData || demande.formulaire_data || {};

  // Form states matching devis.nouveau.tsx
  const [quoteNumber, setQuoteNumber] = useState(data.quote_number || "");
  const [customServiceType, setCustomServiceType] = useState(data.custom_service_type || demande.service || "Service personnalisé");
  const [propertyCategory, setPropertyCategory] = useState(data.property_category || "logement");
  const [propertySubtype, setPropertySubtype] = useState(data.property_subtype || "Appartement");
  const [surface, setSurface] = useState<number | "">(data.surface !== undefined ? Number(data.surface) : "");
  const [frequence, setFrequence] = useState(data.frequence || "une fois");
  const [frequencyCustom, setFrequencyCustom] = useState(data.frequency_custom || "");
  const [duree, setDuree] = useState<number | "">(data.duree !== undefined ? Number(data.duree) : "");
  const [durationUnit, setDurationUnit] = useState(data.duration_unit || "heures");
  const [nbIntervenants, setNbIntervenants] = useState<number>(data.nb_intervenants !== undefined ? Number(data.nb_intervenants) : 1);
  const [description, setDescription] = useState(data.description || "");
  const [amountHt, setAmountHt] = useState<number>(data.amount_ht !== undefined ? Number(data.amount_ht) : (Number(demande.prix) || 0));
  const [vatRate, setVatRate] = useState<number>(data.vat_rate !== undefined ? Number(data.vat_rate) : 20);
  
  // Advance payment states
  const [advanceRequired, setAdvanceRequired] = useState<boolean>(Boolean(data.advance_required));
  const [advanceMode, setAdvanceMode] = useState<'percent' | 'fixed'>(data.advance_mode || 'percent');
  const [advancePercent, setAdvancePercent] = useState<number | "">(
    data.advance_percent !== undefined && data.advance_percent !== null && data.advance_percent !== ""
      ? Number(data.advance_percent)
      : ""
  );
  const [advanceAmount, setAdvanceAmount] = useState<number>(data.advance_amount !== undefined ? Number(data.advance_amount) : 0);

  // Options checklist
  const [options, setOptions] = useState<any[]>(data.options || DEFAULT_OPTIONS);

  const [showAddOptionModal, setShowAddOptionModal] = useState(false);
  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState(0);

  const isLinked = !!externalFormData || !!onUpdateDemandeData;

  // Sync internal state when props/demande changes
  useEffect(() => {
    const freshData = externalFormData || demande.formulaire_data || {};
    setQuoteNumber(freshData.quote_number || "");
    setCustomServiceType(freshData.custom_service_type || demande.service || "Service personnalisé");
    setPropertyCategory(freshData.property_category || "logement");
    setPropertySubtype(freshData.property_subtype || "Appartement");
    setSurface(freshData.surface !== undefined ? Number(freshData.surface) : "");
    setFrequence(freshData.frequence || "une fois");
    setFrequencyCustom(freshData.frequency_custom || "");
    setDuree(freshData.duree !== undefined ? Number(freshData.duree) : "");
    setDurationUnit(freshData.duration_unit || "heures");
    setNbIntervenants(freshData.nb_intervenants !== undefined ? Number(freshData.nb_intervenants) : 1);
    setDescription(freshData.description || "");
    setAmountHt(freshData.amount_ht !== undefined ? Number(freshData.amount_ht) : (Number(demande.prix) || 0));
    setVatRate(freshData.vat_rate !== undefined ? Number(freshData.vat_rate) : 20);
    setAdvanceRequired(Boolean(freshData.advance_required));
    setAdvanceMode(freshData.advance_mode || 'percent');
    setAdvancePercent(
      freshData.advance_percent !== undefined && freshData.advance_percent !== null && freshData.advance_percent !== ""
        ? Number(freshData.advance_percent)
        : ""
    );
    setAdvanceAmount(freshData.advance_amount !== undefined ? Number(freshData.advance_amount) : 0);
    setOptions(freshData.options || DEFAULT_OPTIONS);
  }, [demande.id, externalFormData]);

  // Helper to sync changes up
  const update = (patch: Record<string, any>) => {
    if (externalSetFormData && externalFormData) {
      externalSetFormData({ ...externalFormData, ...patch });
    }
    if (onUpdateDemandeData) {
      onUpdateDemandeData(patch);
    }
  };

  // Option checklist action
  const toggleOption = (idx: number) => {
    const nextOptions = [...options];
    nextOptions[idx] = { ...nextOptions[idx], enabled: !nextOptions[idx].enabled };
    setOptions(nextOptions);
    update({ options: nextOptions });
  };

  const setOptionPrice = (idx: number, price: number) => {
    const nextOptions = [...options];
    nextOptions[idx] = { ...nextOptions[idx], price };
    setOptions(nextOptions);
    update({ options: nextOptions });
  };

  const addCustomOption = () => {
    setShowAddOptionModal(true);
  };

  // Recalculations
  const optionsTotal = options.reduce((acc: number, opt: any) => {
    if (opt.enabled) {
      return acc + (Number(opt.price) || 0);
    }
    return acc;
  }, 0);

  const baseHt = amountHt + optionsTotal;
  const tvaAmount = baseHt * (vatRate / 100);
  const totalTtc = baseHt + tvaAmount;

  const calculatedAdvance = advanceRequired
    ? (advanceMode === 'percent' ? Math.round((totalTtc * (advancePercent === "" ? 0 : advancePercent)) / 100) : advanceAmount)
    : 0;

  const balanceDue = Math.max(0, totalTtc - calculatedAdvance);

  useEffect(() => {
    if (!onPrestationsChange) return;

    const prestations: QuotePrestationLine[] = [
      {
        designation: `${customServiceType} (${frequence === 'autre' ? frequencyCustom : frequence})`,
        montant: amountHt
      }
    ];

    options.forEach((opt: any) => {
      if (opt.enabled) {
        prestations.push({
          designation: opt.label,
          montant: opt.price
        });
      }
    });

    onPrestationsChange(prestations, baseHt, {
      quote_number: quoteNumber,
      custom_service_type: customServiceType,
      property_category: propertyCategory,
      property_subtype: propertySubtype,
      surface: surface === "" ? undefined : surface,
      frequence,
      frequency_custom: frequencyCustom,
      duree: duree === "" ? undefined : duree,
      duration_unit: durationUnit,
      nb_intervenants: nbIntervenants,
      description,
      amount_ht: amountHt,
      vat_rate: vatRate,
      tva_active: vatRate > 0,
      advance_required: advanceRequired,
      advance_mode: advanceMode,
      advance_percent: advancePercent,
      advance_amount: advanceAmount,
      avance_paiement: calculatedAdvance,
      avance_active: advanceRequired,
      avance_type: advanceMode,
      avance_pourcentage: advancePercent,
      avance_fixe: advanceAmount,
      options,
      is_autre_service: true
    });
  }, [
    quoteNumber,
    customServiceType,
    propertyCategory,
    propertySubtype,
    surface,
    frequence,
    frequencyCustom,
    duree,
    durationUnit,
    nbIntervenants,
    description,
    amountHt,
    vatRate,
    advanceRequired,
    advanceMode,
    advancePercent,
    advanceAmount,
    options,
    onPrestationsChange
  ]);

  return (
    <div className="quote-calculator" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FormulaBox>
        <B>Création de devis personnalisé (Autre service)</B> — Définissez les caractéristiques contractuelles, le tarif HT, les options et l'avance requise de cette prestation sur mesure.
        {isLinked && (
          <span style={{ fontSize: 10, marginTop: 4, display: "block", color: "#0f766e" }}>
            🔗 Synchronisé — Les modifications sont enregistrées sur la demande en temps réel.
          </span>
        )}
      </FormulaBox>

      {/* 0. Quote Number */}
      <Field label="Numéro de devis personnalisé (laisser vide pour auto)">
        <input
          type="text"
          value={quoteNumber}
          placeholder="Ex: DEV-2026-001"
          onChange={e => {
            setQuoteNumber(e.target.value);
            update({ quote_number: e.target.value });
          }}
          disabled={!isLinked}
          style={s.input as any}
        />
      </Field>

      {/* 1. Service Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Type de service personnalisé">
          <input
            type="text"
            value={customServiceType}
            onChange={e => {
              setCustomServiceType(e.target.value);
              update({ custom_service_type: e.target.value });
            }}
            disabled={!isLinked}
            style={s.input as any}
          />
        </Field>
        <Field label="Fréquence">
          <select
            value={frequence}
            onChange={e => {
              setFrequence(e.target.value);
              update({ frequence: e.target.value });
            }}
            disabled={!isLinked}
            style={s.input as any}
          >
            <option value="une fois">Une fois (ponctuel)</option>
            <option value="hebdomadaire">Hebdomadaire</option>
            <option value="mensuel">Mensuel</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
      </div>

      {frequence === "autre" && (
        <Field label="Préciser la fréquence">
          <input
            type="text"
            value={frequencyCustom}
            placeholder="Ex: 3 fois par quinzaine"
            onChange={e => {
              setFrequencyCustom(e.target.value);
              update({ frequency_custom: e.target.value });
            }}
            disabled={!isLinked}
            style={s.input as any}
          />
        </Field>
      )}

      {/* 2. Property & Time details */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <Field label="Surface (m²)">
          <input
            type="number"
            min="0"
            value={surface}
            onChange={e => {
              const val = e.target.value === "" ? "" : parseInt(e.target.value) || 0;
              setSurface(val);
              update({ surface: val });
            }}
            disabled={!isLinked}
            style={s.input as any}
          />
        </Field>
        <Field label="Durée de l'intervention">
          <input
            type="number"
            min="0"
            step="0.5"
            value={duree}
            onChange={e => {
              const val = e.target.value === "" ? "" : parseFloat(e.target.value) || 0;
              setDuree(val);
              update({ duree: val });
            }}
            disabled={!isLinked}
            style={s.input as any}
          />
        </Field>
        <Field label="Unité de durée">
          <select
            value={durationUnit}
            onChange={e => {
              setDurationUnit(e.target.value);
              update({ duration_unit: e.target.value });
            }}
            disabled={!isLinked}
            style={s.input as any}
          >
            <option value="heures">Heures</option>
            <option value="jours">Jours</option>
            <option value="semaines">Semaines</option>
            <option value="mois">Mois</option>
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Type / Catégorie de bien">
          <select
            value={propertyCategory}
            onChange={e => {
              setPropertyCategory(e.target.value);
              // reset subtype
              const nextSubtype = e.target.value === "logement" ? "Appartement" : "";
              setPropertySubtype(nextSubtype);
              update({ property_category: e.target.value, property_subtype: nextSubtype });
            }}
            disabled={!isLinked}
            style={s.input as any}
          >
            <option value="logement">Logement</option>
            <option value="bureau">Bureau</option>
            <option value="commerce">Commerce</option>
            <option value="autre">Autre</option>
          </select>
        </Field>
        <Field label={propertyCategory === "logement" ? "Sous-type de logement" : "Préciser le type de bien"}>
          {propertyCategory === "logement" ? (
            <select
              value={propertySubtype}
              onChange={e => {
                setPropertySubtype(e.target.value);
                update({ property_subtype: e.target.value });
              }}
              disabled={!isLinked}
              style={s.input as any}
            >
              <option value="Appartement">Appartement</option>
              <option value="Villa">Villa</option>
              <option value="Studio">Studio</option>
              <option value="Duplex">Duplex</option>
              <option value="Riad">Riad</option>
            </select>
          ) : (
            <input
              type="text"
              value={propertySubtype}
              onChange={e => {
                setPropertySubtype(e.target.value);
                update({ property_subtype: e.target.value });
              }}
              disabled={!isLinked}
              style={s.input as any}
            />
          )}
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <Field label="Intervenants requis">
          <input
            type="number"
            min="1"
            value={nbIntervenants}
            onChange={e => {
              const val = parseInt(e.target.value) || 1;
              setNbIntervenants(val);
              update({ nb_intervenants: val });
            }}
            disabled={!isLinked}
            style={s.input as any}
          />
        </Field>
      </div>

      {/* 2. Options complémentaires list */}
      <div style={{ marginTop: 6, borderTop: "1px dashed var(--border-color)", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.05em" }}>OPTIONS COMPLÉMENTAIRES</span>
          <button
            type="button"
            onClick={addCustomOption}
            style={{ fontSize: 10, background: "#0f766e", color: "white", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontWeight: 600 }}
          >
            + Ajouter
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((opt, idx) => (
            <div key={opt.key} style={{ display: "grid", gridTemplateColumns: "auto 1fr 100px", alignItems: "center", gap: 10, padding: 8, border: "1px solid var(--border-color)", borderRadius: 6 }}>
              <input
                type="checkbox"
                checked={!!opt.enabled}
                onChange={() => toggleOption(idx)}
                style={{ width: 14, height: 14, cursor: "pointer" }}
              />
              <span style={{ fontSize: 11, color: "#334155" }}>{opt.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  min="0"
                  value={opt.price}
                  onChange={e => setOptionPrice(idx, parseFloat(e.target.value) || 0)}
                  style={{ ...s.input, padding: "3px 6px", width: "100%" } as any}
                />
                <span style={{ fontSize: 10, color: "var(--c-muted)" }}>DH</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Consigne contractuelle */}
      <Field label="Consigne importante (Contractuelle sur le devis) *">
        <textarea
          rows={3}
          value={description}
          onChange={e => {
            setDescription(e.target.value);
            update({ description: e.target.value });
          }}
          disabled={!isLinked}
          placeholder="Décrivez précisément le périmètre de la prestation..."
          style={{
            width: "100%",
            padding: "8px 10px",
            border: "1.5px solid #0f766e",
            borderRadius: 8,
            fontSize: "12px",
            fontFamily: "inherit",
            resize: "vertical"
          }}
        />
      </Field>

      {/* 4. Financial settings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderTop: "1px dashed var(--border-color)", paddingTop: 12 }}>
        <Field label="Montant HT (MAD) *">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountHt}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              setAmountHt(val);
              update({ amount_ht: val, montant: val });
            }}
            disabled={!isLinked}
            style={s.input as any}
          />
        </Field>
        <Field label="TVA (%)">
          <input
            type="number"
            min="0"
            max="100"
            value={vatRate}
            onChange={e => {
              const val = parseFloat(e.target.value) || 0;
              setVatRate(val);
              update({ vat_rate: val });
            }}
            disabled={!isLinked}
            style={s.input as any}
          />
        </Field>
      </div>

      {/* 5. Advance settings */}
      <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.05em" }}>AVANCE REQUISE</span>
          <div style={{ display: "flex", border: "1px solid var(--border-color)", borderRadius: 6, overflow: "hidden", background: "#f8fafc" }}>
            <button
              type="button"
              onClick={() => {
                setAdvanceRequired(false);
                update({ advance_required: false, avance_active: false });
              }}
              style={{
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: !advanceRequired ? "#2563EB" : "transparent",
                color: !advanceRequired ? "white" : "#475569"
              }}
            >
              Non
            </button>
            <button
              type="button"
              onClick={() => {
                setAdvanceRequired(true);
                update({ advance_required: true, avance_active: true });
              }}
              style={{
                padding: "3px 12px",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: advanceRequired ? "#2563EB" : "transparent",
                color: advanceRequired ? "white" : "#475569"
              }}
            >
              Oui
            </button>
          </div>
        </div>

        {advanceRequired && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", border: "1px solid var(--border-color)", borderRadius: 6, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => {
                  setAdvanceMode('percent');
                  update({ advance_mode: 'percent', avance_type: 'pourcentage' });
                }}
                style={{
                  flex: 1,
                  padding: "6px",
                  fontSize: 10,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: advanceMode === 'percent' ? "#2563EB" : "#f8fafc",
                  color: advanceMode === 'percent' ? "white" : "#475569"
                }}
              >
                Pourcentage (%)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdvanceMode('fixed');
                  update({ advance_mode: 'fixed', avance_type: 'fixe' });
                }}
                style={{
                  flex: 1,
                  padding: "6px",
                  fontSize: 10,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: advanceMode === 'fixed' ? "#2563EB" : "#f8fafc",
                  color: advanceMode === 'fixed' ? "white" : "#475569"
                }}
              >
                Montant fixe (DH)
              </button>
            </div>

            {advanceMode === 'percent' ? (
              <Field label="Pourcentage du devis (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={advancePercent}
                  onChange={e => {
                    const val = e.target.value;
                    const parsed = val === "" ? "" : parseInt(val) || 0;
                    setAdvancePercent(parsed);
                    update({ advance_percent: parsed, avance_pourcentage: parsed });
                  }}
                  style={s.input as any}
                />
              </Field>
            ) : (
              <Field label="Montant de l'avance (DH)">
                <input
                  type="number"
                  min="0"
                  value={advanceAmount}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setAdvanceAmount(val);
                    update({ advance_amount: val, avance_fixe: val });
                  }}
                  style={s.input as any}
                />
              </Field>
            )}
          </div>
        )}
      </div>

      {/* Summary Box */}
      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, fontSize: 11 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Total options</span>
          <span>{fmt(optionsTotal)} DH</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Base HT</span>
          <strong>{fmt(baseHt)} DH</strong>
        </div>
        {vatRate > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#475569" }}>
            <span>Montant TVA ({vatRate}%)</span>
            <strong>{fmt(tvaAmount)} DH</strong>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 4, fontSize: 12, fontWeight: 700, color: "#0f766e" }}>
          <span>Montant Total TTC</span>
          <strong>{fmt(totalTtc)} DH</strong>
        </div>

        {advanceRequired && (
          <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309" }}>
              <span>Avance requise {advanceMode === 'percent' ? `(${advancePercent}%)` : ''}</span>
              <strong>{fmt(calculatedAdvance)} DH</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#374151" }}>
              <span>Solde restant à payer</span>
              <strong>{fmt(balanceDue)} DH</strong>
            </div>
          </div>
        )}
      </div>

      <ResultBar
        detail={`${customServiceType} — ${surface || '—'} m² — ${duree || '—'} ${durationUnit}`}
        total={`${fmt(totalTtc)} DH`}
        label="Total TTC"
      />

      {showAddOptionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#0f172a', textAlign: 'left' }}>Ajouter une option</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Nom de l'option</label>
                <input
                  type="text"
                  placeholder="Ex: Nettoyage haute pression..."
                  value={newOptionLabel}
                  onChange={e => setNewOptionLabel(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Prix (MAD)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newOptionPrice || ''}
                  onChange={e => setNewOptionPrice(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddOptionModal(false);
                  setNewOptionLabel('');
                  setNewOptionPrice(0);
                }}
                style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '6px', background: 'white', color: '#475569', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newOptionLabel.trim()) return;
                  const nextOptions = [...options, { key: `custom_${Date.now()}`, label: newOptionLabel, price: newOptionPrice, enabled: true }];
                  setOptions(nextOptions);
                  update({ options: nextOptions });
                  setShowAddOptionModal(false);
                  setNewOptionLabel('');
                  setNewOptionPrice(0);
                }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#0f766e', color: 'white', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
