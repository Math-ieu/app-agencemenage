import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import { SURCHARGE_CITIES } from "../../../utils/pricing";
import type { QuotePrestationLine } from "./QuoteSection";

interface ChantierQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function ChantierQuote({ demande, onPrestationsChange }: ChantierQuoteProps) {
  const data = demande.formulaire_data || {};
  
  const [surface, setSurface] = useState(data.surface || data.surfaceArea || 150);
  const [grattage, setGrattage] = useState(data.grattage?.toString() || data.grattage_rate?.toString() || "15");
  const [vitres, setVitres] = useState(data.vitres?.toString() || (data.prix_vitres === 150 ? "150" : data.surface_vitres > 0 ? "25" : "0"));
  const [surfVitres, setSurfVitres] = useState(data.surface_vitres || 15);
  const [dechets, setDechets] = useState(data.dechets?.toString() || (data.poids_dechets === 100 ? "200" : data.poids_dechets === 200 ? "380" : data.poids_dechets === 400 ? "650" : data.prix_dechets === -1 ? "-1" : "0"));
  const [marbre, setMarbre] = useState(Boolean(data.marbre || data.surface_marbre > 0));
  const [surfMarbre, setSurfMarbre] = useState(data.surface_marbre || 30);
  const [terrasse, setTerrasse] = useState(Boolean(data.terrasse_incluse));
  const villeConcernee = SURCHARGE_CITIES.includes(data.ville || data.city || demande.client_city || "");
  const [zone, setZone] = useState(data.zone_eloignee !== undefined ? Boolean(data.zone_eloignee) : villeConcernee);
  const [materielMobilise, setMaterielMobilise] = useState(data.materiel_mobilise || "");

  const MIN = 1500;
  const baseRaw = surface * parseFloat(grattage);
  const base = Math.max(baseRaw, MIN);
  const vitresCost = vitres === "150" ? 150 : vitres === "25" ? surfVitres * 25 : 0;
  const dechetsCost = dechets === "-1" ? 0 : (parseFloat(dechets) || 0);
  const devisSpe = dechets === "-1";
  const marbreCost = marbre ? surfMarbre * 25 : 0;
  const zoneCost = zone ? 200 : 0;
  const [remise, setRemise] = useState<RemiseValue>(() => ({
    abonnement: false,
    etenduePct: Number(data.remise_etendue_pct || 0),
    promoCode: data.code_promo || "",
    promoPct: Number(data.code_promo_pct || 0),
  }));
  const preRemise = base + vitresCost + dechetsCost + marbreCost + zoneCost;
  const remiseMontant = Math.round(preRemise * remise.etenduePct / 100);
  const promoMontant = remise.promoCode ? Math.round((preRemise - remiseMontant) * remise.promoPct / 100) : 0;
  const total = preRemise - remiseMontant - promoMontant;

  const grattageLabel = parseFloat(grattage) <= 12 ? 'sans grattage' : parseFloat(grattage) <= 15 ? 'grattage léger' : 'rénovation totale';

  // Notify parent of prestation changes
  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Nettoyage fin de chantier — ${surface} m² (${grattageLabel})`, montant: base },
    ];
    if (terrasse) {
      prestations.push({ designation: "Terrasse et rooftop (inclus dans forfait)", montant: "Inclus" });
    }
    if (vitresCost > 0) {
      prestations.push({
        designation: vitres === "150" ? "Grattage vitres léger" : `Grattage vitres profond — ${surfVitres} m² vitrés`,
        montant: vitresCost,
      });
    }
    if (dechetsCost > 0) {
      const poidsLabel = dechets === "200" ? "< 100 kg" : dechets === "380" ? "100-300 kg" : dechets === "650" ? "300-500 kg" : "";
      prestations.push({ designation: `Ramassage et évacuation déchets — ${poidsLabel}`, montant: dechetsCost });
    }
    if (marbreCost > 0) {
      prestations.push({ designation: `Cristallisation du marbre — ${surfMarbre} m²`, montant: marbreCost });
    }
    if (zoneCost > 0) {
      prestations.push({ designation: "Zone éloignée (Bouskoura, Dar Bouazza, Mohammédia…)", montant: zoneCost });
    }
    if (remiseMontant > 0) {
      prestations.push({ designation: `Remise (–${remise.etenduePct}%)`, montant: -remiseMontant, isReduction: true });
    }
    if (promoMontant > 0) {
      prestations.push({ designation: `Code promo ${remise.promoCode} (–${remise.promoPct}%)`, montant: -promoMontant, isReduction: true });
    }
    onPrestationsChange(prestations, total, {
      surface, grattage: parseFloat(grattage), grattage_rate: parseFloat(grattage),
      surface_vitres: vitres === "25" ? surfVitres : 0,
      prix_vitres: vitresCost,
      poids_dechets: dechetsCost > 0 ? (dechets === "200" ? 100 : dechets === "380" ? 200 : dechets === "650" ? 400 : 0) : 0,
      prix_dechets: dechetsCost,
      surface_marbre: marbre ? surfMarbre : 0,
      prix_marbre: marbreCost,
      terrasse_incluse: terrasse,
      zone_eloignee: zone ? 200 : 0,
      prix_base: base,
      reduction: remiseMontant + promoMontant,
      reduction_montant: remiseMontant + promoMontant,
      reduction_pourcentage: remise.etenduePct,
      remise_etendue_pct: remise.etenduePct,
      code_promo: remise.promoCode,
      code_promo_pct: remise.promoPct,
      materiel_mobilise: materielMobilise,
    });
  }, [surface, grattage, vitres, surfVitres, dechets, marbre, surfMarbre, terrasse, zone, base, vitresCost, dechetsCost, marbreCost, zoneCost, remise, remiseMontant, promoMontant, total, materielMobilise]);

  const detail = `${surface} m² × ${grattage} DH = ${fmt(baseRaw)} DH${baseRaw < MIN ? ` (min ${fmt(MIN)})` : ""}` +
    (vitresCost ? ` + vitres` : "") +
    (dechetsCost ? ` + déchets` : "") +
    (marbreCost ? ` + marbre` : "");

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> max(Surface × taux grattage, 1 500 DH) · <B>Terrasse / rooftop :</B> inclus au même taux · <B>Minimum facturable :</B> 1 500 DH
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Surface totale (m²)">
            <input type="number" value={surface} min={20} onChange={e => setSurface(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="État général — grattage murs / sols">
            <select value={grattage} onChange={e => setGrattage(e.target.value)} style={s.input as any}>
              <option value="12">Sans grattage (12 DH/m²)</option>
              <option value="15">Grattage léger — peinture, résidus (15 DH/m²)</option>
              <option value="22">Grattage profond — béton, décappage (22 DH/m²)</option>
            </select>
          </Field>
          <Field label="Grattage vitres / marquages">
            <select value={vitres} onChange={e => setVitres(e.target.value)} style={s.input as any}>
              <option value="0">Aucun</option>
              <option value="150">Léger — stickers, traces (forfait +150 DH)</option>
              <option value="25">Profond — silicone, béton (25 DH/m² vitrage)</option>
            </select>
          </Field>
          {vitres === "25" && (
            <Field label="Surface vitrée concernée (m²)">
              <input type="number" value={surfVitres} min={1} onChange={e => setSurfVitres(+e.target.value)} style={s.input as any} />
            </Field>
          )}
        </div>
        <div>
          <Field label="Ramassage de déchets">
            <select value={dechets} onChange={e => setDechets(e.target.value)} style={s.input as any}>
              <option value="0">Pas de ramassage</option>
              <option value="200">Moins de 100 kg (+200 DH)</option>
              <option value="380">100 à 300 kg (+380 DH)</option>
              <option value="650">300 à 500 kg (+650 DH)</option>
              <option value="-1">Plus de 500 kg → devis spécifique</option>
            </select>
          </Field>
          <div style={s.optTitle}>Option premium</div>
          <OptRow label="Cristallisation marbre" note="25 DH/m² — résultat brillant garanti" price="25 DH/m²" checked={marbre} onChange={setMarbre} />
          {marbre && (
            <Field label="Surf. Marbre">
              <input type="number" value={surfMarbre} onChange={e => setSurfMarbre(+e.target.value)} style={s.input as any} />
            </Field>
          )}
          <OptRow label="Terrasse / Rooftop" price="Inclus" checked={terrasse} onChange={setTerrasse} />
          <OptRow label="Zone éloignée" note="Bouskoura, Dar Bouazza, Mohammédia…" price="+200 DH" checked={zone} onChange={setZone} />
        </div>
      </div>

      <div style={{ marginTop: 12, marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: "bold", color: "#1e293b", marginBottom: 4 }}>
          Matériel mobilisé (interne — invisible dans le PDF client)
        </label>
        <textarea
          value={materielMobilise}
          onChange={e => setMaterielMobilise(e.target.value)}
          placeholder="Aspirateur industriel, karcher, monobrosse, escabeau..."
          rows={3}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #f59e0b",
            borderRadius: 8,
            fontSize: 12,
            fontFamily: "inherit",
            resize: "vertical",
            boxSizing: "border-box",
            outline: "none",
            backgroundColor: "#fff",
            color: "inherit"
          }}
        />
        <span style={{ display: "block", fontSize: 10, color: "#64748b", marginTop: 4 }}>
          Champ obligatoire avant validation pour les missions fin de chantier
        </span>
      </div>

      <RemiseSection isAbo={false} segment={demande.segment} montantBase={preRemise} value={remise} onChange={setRemise} />
      <ResultBar detail={detail} total={`${fmt(total)}${devisSpe ? " +" : ""} DH`} label="Devis HT" />
    </div>
  );
}
