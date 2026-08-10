import { useEffect } from "react";
import { FormulaBox, B, OptRow, ResultBar, fmt } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import type { QuotePrestationLine } from "./QuoteSection";

const AIRBNB_CONCIERGERIE_PRICES: Record<string, { label: string; price: number; note?: string }> = {
  '1chambre': { label: 'Studio / 1 chambre', price: 130 },
  '2chambres': { label: '2 chambres', price: 160 },
  '3chambres': { label: '3 chambres', price: 190 },
  '4chambres': { label: '4 chambres', price: 220 },
  '5chambres': { label: '5 chambres', price: 250 },
  'villa': { label: 'Villa / Riad', price: 300, note: '2 femmes de ménage' }
};

interface AirbnbQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
  formData?: any;
  setFormData?: (data: any) => void;
  onUpdateDemandeData?: (patch: Record<string, any>) => void;
}

export default function AirbnbQuote({ demande, onPrestationsChange, formData: externalFormData, setFormData: externalSetFormData, onUpdateDemandeData }: AirbnbQuoteProps) {
  const data = externalFormData || demande.formulaire_data || {};

  // Read values
  const sizeTier = (data.size_tier || data.sizeTier || '1chambre') as string;
  const isFarZone = Boolean(data.zone_eloignee || data.is_far_zone);
  const reassortType = data.reassort_type || (data.conso ? 'essentiel' : 'aucun');
  const videoApres = Boolean(data.video_apres);
  const materielFourni = Boolean(data.materiel_fourni);
  const serviceLinge = Boolean(data.service_linge || (data.linen_sets && data.linen_sets > 0));
  const linenSets = Number(data.linen_sets || (serviceLinge ? 1 : 0));

  const tierInfo = AIRBNB_CONCIERGERIE_PRICES[sizeTier] || AIRBNB_CONCIERGERIE_PRICES['1chambre'];
  const basePrice = tierInfo.price;
  const sizeLabel = tierInfo.label;

  const farZoneCost = isFarZone ? 50 : 0;
  const reassortCost = reassortType === 'essentiel' ? 49 : reassortType === 'confort' ? 79 : 0;
  const videoCost = videoApres ? 10 : 0;
  const materielCost = materielFourni ? 29 : 0;
  const linenCost = linenSets * 50;

  const preRemise = basePrice + farZoneCost + reassortCost + videoCost + materielCost + linenCost;

  // Remise
  const remise: RemiseValue = {
    abonnement: false,
    etenduePct: Number(data.remise_etendue_pct || 0),
    promoCode: data.code_promo || "",
    promoPct: Number(data.code_promo_pct || 0),
  };
  const remiseMontant = Math.round(preRemise * remise.etenduePct / 100);
  const promoMontant = remise.promoCode ? Math.round((preRemise - remiseMontant) * remise.promoPct / 100) : 0;
  const total = preRemise - remiseMontant - promoMontant;

  const update = (patch: Record<string, any>) => {
    if (externalSetFormData && externalFormData) {
      externalSetFormData({ ...externalFormData, ...patch });
    }
    if (onUpdateDemandeData) {
      onUpdateDemandeData(patch);
    }
  };
  const setRemise = (v: RemiseValue) => update({ remise_etendue_pct: v.etenduePct, code_promo: v.promoCode, code_promo_pct: v.promoPct });

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Conciergerie Airbnb — ${sizeLabel}`, montant: basePrice },
    ];
    if (isFarZone) {
      prestations.push({ designation: "Supplément zone éloignée (périphérie)", montant: 50 });
    }
    if (reassortType === 'essentiel') {
      prestations.push({ designation: "Réassort consommables Essentiel (eau, café, savon...)", montant: 49 });
    } else if (reassortType === 'confort') {
      prestations.push({ designation: "Réassort consommables Confort (shampoing, gel douche...)", montant: 79 });
    }
    if (videoApres) {
      prestations.push({ designation: "Vidéo avant / après (preuve filmée)", montant: 10 });
    }
    if (materielFourni) {
      prestations.push({ designation: "Mise à disposition du matériel & produits", montant: 29 });
    }
    if (linenSets > 0) {
      prestations.push({ designation: `Service linge — ${linenSets} set(s) (50 DH/set)`, montant: linenCost });
    }
    if (remiseMontant > 0) {
      prestations.push({ designation: `Remise (–${remise.etenduePct}%)`, montant: -remiseMontant, isReduction: true });
    }
    if (promoMontant > 0) {
      prestations.push({ designation: `Code promo ${remise.promoCode} (–${remise.promoPct}%)`, montant: -promoMontant, isReduction: true });
    }
    onPrestationsChange(prestations, total, {
      palier_label: sizeLabel,
      prix_passage: basePrice,
      prix_base: basePrice,
      zone_eloignee: isFarZone,
      reassort_type: reassortType,
      video_apres: videoApres,
      materiel_fourni: materielFourni,
      linen_sets: linenSets,
      linen_cost: linenCost,
      reduction: remiseMontant + promoMontant,
      reduction_montant: remiseMontant + promoMontant,
      reduction_pourcentage: remise.etenduePct,
      remise_etendue_pct: remise.etenduePct,
      code_promo: remise.promoCode,
      code_promo_pct: remise.promoPct,
    });
  }, [sizeTier, isFarZone, reassortType, videoApres, materielFourni, linenSets, basePrice, total, remiseMontant, promoMontant]);

  const isLinked = !!externalFormData || !!onUpdateDemandeData;

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Tarif Conciergerie Airbnb</B> — Offre réservée aux hôtes confiant 3 biens ou plus · Prix fixe par intervention
        <br /><span style={{ fontSize: 10, marginTop: 4, display: "block" }}>
          {isLinked
            ? "🔗 Synchronisé — Toute modification est enregistrée sur la demande."
            : "Tarifs officiels conciergerie Airbnb"}
        </span>
      </FormulaBox>

      {/* Size Tier Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 12 }}>
        {Object.entries(AIRBNB_CONCIERGERIE_PRICES).map(([key, item]) => {
          const selected = sizeTier === key;
          return (
            <button key={key}
              onClick={() => update({ size_tier: key, sizeTier: key })}
              disabled={!isLinked}
              style={{
                padding: "8px 6px", borderRadius: 8,
                border: `1px solid ${selected ? "#3B82F6" : "var(--c-bord)"}`,
                background: selected ? "#EFF6FF" : "transparent",
                color: selected ? "#1D4ED8" : "inherit", textAlign: "left",
                cursor: isLinked ? "pointer" : "default",
                transition: "all .15s",
              }}>
              <div style={{ fontWeight: 600, fontSize: 11 }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{item.price} DH</div>
              {item.note && <div style={{ fontSize: 9, opacity: 0.8 }}>{item.note}</div>}
            </button>
          );
        })}
      </div>

      {/* Options */}
      <OptRow
        label="Zone éloignée / Périphérie"
        price="+50 DH"
        checked={isFarZone}
        onChange={(v) => update({ zone_eloignee: v, is_far_zone: v })}
      />

      <div style={{ margin: "8px 0", padding: "8px", background: "var(--c-fond-alt, #f8fafc)", borderRadius: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Réassort consommables</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { id: 'aucun', label: 'Aucun (0 DH)' },
            { id: 'essentiel', label: 'Essentiel (+49 DH)' },
            { id: 'confort', label: 'Confort (+79 DH)' }
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              disabled={!isLinked}
              onClick={() => update({ reassort_type: opt.id, conso: opt.id !== 'aucun' })}
              style={{
                flex: 1, padding: "5px 4px", fontSize: 10, fontWeight: 600, borderRadius: 5,
                border: `1px solid ${reassortType === opt.id ? "#3B82F6" : "var(--c-bord)"}`,
                background: reassortType === opt.id ? "#EFF6FF" : "transparent",
                color: reassortType === opt.id ? "#1D4ED8" : "inherit"
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <OptRow
        label="Vidéo avant / après"
        price="+10 DH"
        checked={videoApres}
        onChange={(v) => update({ video_apres: v })}
      />

      <OptRow
        label="Mise à disposition du matériel"
        price="+29 DH"
        checked={materielFourni}
        onChange={(v) => update({ materiel_fourni: v })}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", marginBottom: 8, borderTop: "1px dashed var(--c-bord)", paddingTop: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>Sets de linge (+50 DH/set)</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button type="button" disabled={!isLinked} onClick={() => update({ linen_sets: Math.max(0, linenSets - 1), service_linge: linenSets - 1 > 0 })}
            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--c-bord)", background: "transparent", cursor: isLinked ? "pointer" : "default", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <span style={{ fontWeight: 700, fontSize: 13, minWidth: 20, textAlign: "center" }}>{linenSets}</span>
          <button type="button" disabled={!isLinked} onClick={() => update({ linen_sets: linenSets + 1, service_linge: true })}
            style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--c-bord)", background: "transparent", cursor: isLinked ? "pointer" : "default", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
      </div>

      <RemiseSection isAbo={false} segment={demande.segment} montantBase={preRemise} value={remise} onChange={setRemise} />

      <ResultBar
        detail={`${sizeLabel}${isFarZone ? " + Zone éloignée" : ""}${reassortType !== 'aucun' ? ` + Réassort ${reassortType}` : ""}${videoApres ? " + Vidéo" : ""}${materielFourni ? " + Matériel" : ""}${linenSets > 0 ? ` + ${linenSets} set(s) linge` : ""}${remiseMontant > 0 ? ` − ${fmt(remiseMontant)} remise` : ""}${promoMontant > 0 ? ` − ${fmt(promoMontant)} promo` : ""}`}
        total={`${fmt(total)} DH`}
        label="Prix par intervention"
      />
    </div>
  );
}
