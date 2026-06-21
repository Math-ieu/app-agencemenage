import { useEffect } from "react";
import { FormulaBox, B, OptRow, ResultBar, fmt } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import type { QuotePrestationLine } from "./QuoteSection";

const AIRBNB_PRICES = {
  A: { studio: 130, '1chambre': 165, '2chambres': 195, '2chambresDoubleSDB': 230, '3chambres': 260, '4chambres': 325, villa: 390 },
  B: { studio: 220, '1chambre': 255, '2chambres': 285, '2chambresDoubleSDB': 320, '3chambres': 350, '4chambres': 415, villa: 480 }
} as const;

const SIZE_LABELS: Record<string, string> = {
  studio: 'Studio',
  '1chambre': '1 chambre',
  '2chambres': '2 chambres',
  '2chambresDoubleSDB': '2 ch · double SDB',
  '3chambres': '3 chambres',
  '4chambres': 'Grand appart / Duplex',
  villa: 'Villa'
};

// Brief Service 01 — tarif linge par set : 1er 50 DH, 2ème 45 DH, 3ème et + 40 DH/set
const linenSetsCost = (n: number): number => {
  let c = 0;
  for (let i = 1; i <= n; i++) c += i === 1 ? 50 : i === 2 ? 45 : 40;
  return c;
};

const s = {
  seg: { display: "flex", gap: 4, marginBottom: 10 } as React.CSSProperties,
  segBtn: { flex: 1, padding: "7px 0", border: "1px solid var(--c-bord)", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, background: "transparent", color: "inherit", transition: "all .15s" } as React.CSSProperties,
  segBtnOn: { background: "#3B82F6", color: "#fff", borderColor: "#3B82F6" } as React.CSSProperties,
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

  // Read values — source: linked formData if available, else demande data
  const formula = (data.formula || 'A') as 'A' | 'B';
  const sizeTier = (data.size_tier || data.sizeTier || '1chambre') as keyof typeof AIRBNB_PRICES.A;
  const conso = !!data.conso;
  const linenSets = Number(data.linen_sets || data.linenSets || 0);
  const extraPieces = Number(data.linen_extra_pieces || 0);

  const sizeLabel = SIZE_LABELS[sizeTier] || sizeTier;
  const basePrice = AIRBNB_PRICES[formula]?.[sizeTier] ?? AIRBNB_PRICES.A['1chambre'];
  const linenCost = formula === 'B' ? linenSetsCost(linenSets) : 0;
  const extraPiecesCost = formula === 'B' ? extraPieces * 5 : 0;
  const preRemise = basePrice + (conso ? 25 : 0) + linenCost + extraPiecesCost;

  // Remise (étendue + code promo) — stockée dans le formData lié
  const remise: RemiseValue = {
    abonnement: false,
    etenduePct: Number(data.remise_etendue_pct || 0),
    promoCode: data.code_promo || "",
    promoPct: Number(data.code_promo_pct || 0),
  };
  const remiseMontant = Math.round(preRemise * remise.etenduePct / 100);
  const promoMontant = remise.promoCode ? Math.round((preRemise - remiseMontant) * remise.promoPct / 100) : 0;
  const total = preRemise - remiseMontant - promoMontant;

  // Update handler — writes to linked formData or propagates up to parent
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
      { designation: `Ménage Airbnb — Formule ${formula} — ${sizeLabel}`, montant: basePrice },
    ];
    if (conso) {
      prestations.push({ designation: "Réassort consommables (savon, papier, etc.)", montant: 25 });
    }
    if (formula === 'B' && linenSets > 0) {
      prestations.push({ designation: `Service linge — ${linenSets} set(s) (1er 50, 2e 45, 3e+ 40 DH)`, montant: linenCost });
    }
    if (formula === 'B' && extraPieces > 0) {
      prestations.push({ designation: `Articles hors set (${extraPieces} × 5 DH/pièce)`, montant: extraPiecesCost });
    }
    if (remiseMontant > 0) {
      prestations.push({ designation: `Remise (–${remise.etenduePct}%)`, montant: -remiseMontant, isReduction: true });
    }
    if (promoMontant > 0) {
      prestations.push({ designation: `Code promo ${remise.promoCode} (–${remise.promoPct}%)`, montant: -promoMontant, isReduction: true });
    }
    onPrestationsChange(prestations, total, {
      formule: formula, palier_label: sizeLabel, prix_passage: basePrice, prix_base: basePrice,
      consommables: conso ? 25 : 0, reassort: conso ? 25 : 0,
      linen_sets: linenSets, linen_cost: linenCost,
      linen_extra_pieces: extraPieces, linen_extra_cost: extraPiecesCost,
      reduction: remiseMontant + promoMontant,
      reduction_montant: remiseMontant + promoMontant,
      reduction_pourcentage: remise.etenduePct,
      remise_etendue_pct: remise.etenduePct,
      code_promo: remise.promoCode,
      code_promo_pct: remise.promoPct,
    });
  }, [formula, sizeTier, conso, linenSets, extraPieces, basePrice, total, remiseMontant, promoMontant]);

  const isLinked = !!externalFormData || !!onUpdateDemandeData;

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Formule A</B> — Ménage seul · <B>Formule B</B> — Ménage + collecte, lavage &amp; repassage du linge (sets : 50 / 45 / 40 DH)
        <br /><span style={{ fontSize: 10, marginTop: 4, display: "block" }}>
          {isLinked
            ? "🔗 Synchronisé — Toute modification est enregistrée sur la demande."
            : "Base horaire : 65 DH/h (usage interne uniquement — ne pas communiquer au client)"}
        </span>
      </FormulaBox>

      {/* Formule A / B Selector */}
      <div style={s.seg}>
        {(["A", "B"] as const).map(f => (
          <button key={f} onClick={() => update({ formula: f })}
            className={`seg-btn ${formula === f ? 'active' : ''}`}
            style={{ ...s.segBtn, ...(formula === f ? s.segBtnOn : {}), ...(!isLinked ? { cursor: 'default', opacity: 0.7 } : {}) }}
            disabled={!isLinked}
          >
            {f === "A" ? "Formule A" : "Formule B"}
          </button>
        ))}
      </div>

      {/* Size Tier Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 12 }}>
        {Object.keys(AIRBNB_PRICES.A).map((key) => {
          const selected = sizeTier === key;
          const price = AIRBNB_PRICES[formula][key as keyof typeof AIRBNB_PRICES.A];
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
              <div style={{ fontWeight: 600, fontSize: 11 }}>{SIZE_LABELS[key]}</div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{price} DH</div>
            </button>
          );
        })}
      </div>

      {/* Conso checkbox */}
      <OptRow
        label="Réassort consommables"
        price="+25 DH"
        checked={conso}
        onChange={(v) => update({ conso: v })}
      />

      {/* Linen sets (only if formula B) */}
      {formula === 'B' && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", marginBottom: 8, borderTop: "1px dashed var(--c-bord)", paddingTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>Sets de linge (1er 50 · 2e 45 · 3e+ 40 DH)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" disabled={!isLinked} onClick={() => update({ linen_sets: Math.max(0, linenSets - 1), linenSets: Math.max(0, linenSets - 1) })}
                style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--c-bord)", background: "transparent", cursor: isLinked ? "pointer" : "default", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontWeight: 700, fontSize: 13, minWidth: 20, textAlign: "center" }}>{linenSets}</span>
              <button type="button" disabled={!isLinked} onClick={() => update({ linen_sets: linenSets + 1, linenSets: linenSets + 1 })}
                style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--c-bord)", background: "transparent", cursor: isLinked ? "pointer" : "default", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>Articles hors set (+5 DH/pièce)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" disabled={!isLinked} onClick={() => update({ linen_extra_pieces: Math.max(0, extraPieces - 1) })}
                style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--c-bord)", background: "transparent", cursor: isLinked ? "pointer" : "default", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontWeight: 700, fontSize: 13, minWidth: 20, textAlign: "center" }}>{extraPieces}</span>
              <button type="button" disabled={!isLinked} onClick={() => update({ linen_extra_pieces: extraPieces + 1 })}
                style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--c-bord)", background: "transparent", cursor: isLinked ? "pointer" : "default", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
          </div>
        </>
      )}

      <RemiseSection isAbo={false} segment={demande.segment} montantBase={preRemise} value={remise} onChange={setRemise} />

      <ResultBar
        detail={`${sizeLabel} — Formule ${formula}${conso ? " + réassort" : ""}${formula === 'B' && linenSets > 0 ? ` + ${linenSets} set(s)` : ""}${formula === 'B' && extraPieces > 0 ? ` + ${extraPieces} pièce(s)` : ""}${remiseMontant > 0 ? ` − ${fmt(remiseMontant)} remise` : ""}${promoMontant > 0 ? ` − ${fmt(promoMontant)} promo` : ""}`}
        total={`${fmt(total)} DH`}
        label="Prix par passage"
      />
    </div>
  );
}
