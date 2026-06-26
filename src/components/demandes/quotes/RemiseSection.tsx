import { useEffect, useState } from "react";
import { s, fmt } from "./QuoteShared";
import { getPromoCodes } from "../../../api/client";

export interface RemiseValue {
  abonnement: boolean;   // remise abonnement −10% appliquée
  etenduePct: number;    // remise étendue (0 → 20%) — validation responsable commercial
  promoCode: string;     // code promo 1er mois
  promoPct: number;      // % du code promo
}

export const emptyRemise: RemiseValue = { abonnement: false, etenduePct: 0, promoCode: "", promoPct: 0 };

interface PromoOption { code: string; pct: number; label: string; }

interface RemiseSectionProps {
  isAbo: boolean;
  segment?: string;
  montantBase: number;      // base mensuelle (HT) avant remise, pour afficher l'économie
  value: RemiseValue;
  onChange: (v: RemiseValue) => void;
}

const chip = (label: string, onRemove: () => void) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#f1f5f9", border: "1px solid var(--border-color)", borderRadius: 8, padding: "8px 10px", fontSize: 12, marginTop: 8 }}>
    <span>{label}</span>
    <button type="button" onClick={onRemove}
      style={{ fontSize: 11, fontWeight: 600, background: "#FDE8D4", color: "#92400E", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
      Retirer
    </button>
  </div>
);

export default function RemiseSection({ isAbo, segment, montantBase, value, onChange }: RemiseSectionProps) {
  const [promos, setPromos] = useState<PromoOption[]>([]);

  useEffect(() => {
    let active = true;
    getPromoCodes({ status: "active" })
      .then((res: any) => {
        if (!active) return;
        const raw = Array.isArray(res?.data) ? res.data : (res?.data?.results || []);
        const opts: PromoOption[] = raw
          .filter((p: any) => p.status === "active" && !p.archived)
          .map((p: any) => {
            const isPct = p.reduction_type === "pourcentage";
            const val = Number(p.reduction) || 0;
            return {
              code: p.code,
              pct: isPct ? val : 0,
              label: `${p.code} (${isPct ? `−${val}%` : `−${fmt(val)} DH`})`,
            };
          });
        setPromos(opts);
      })
      .catch(() => { /* pas de codes promo disponibles */ });
    return () => { active = false; };
  }, [segment]);

  const set = (patch: Partial<RemiseValue>) => onChange({ ...value, ...patch });

  const economie10 = Math.round(montantBase * 0.10);
  const economieEtendue = Math.round(montantBase * (value.etenduePct / 100));

  const displayedPromos = [...promos];
  if (value.promoCode && !displayedPromos.some(p => p.code === value.promoCode)) {
    displayedPromos.push({
      code: value.promoCode,
      pct: value.promoPct || 0,
      label: `${value.promoCode} (${value.promoPct ? `−${value.promoPct}%` : 'Réduction'})`,
    });
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px dashed var(--border-color)", paddingTop: 14 }}>
      <div style={s.optTitle}>Remise</div>

      {/* Remise abonnement −10% (automatique pour les abonnements) */}
      {isAbo && (
        <div style={{ marginBottom: 10 }}>
          {value.abonnement ? (
            chip(`Remise abonnement — −10%${economie10 > 0 ? ` (soit −${fmt(economie10)} DH / mois)` : ""}`, () => set({ abonnement: false }))
          ) : (
            <button type="button" onClick={() => set({ abonnement: true })}
              style={{ fontSize: 12, fontWeight: 600, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 8, padding: "7px 12px", cursor: "pointer" }}>
              Appliquer −10% abonnement
            </button>
          )}
          <div style={{ fontSize: 10, color: "var(--c-muted)", marginTop: 4 }}>Automatique pour les abonnements</div>
        </div>
      )}

      <div style={s.grid2}>
        {/* Remise étendue (validation responsable commercial) */}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--c-muted)", marginBottom: 3 }}>Remise étendue (jusqu'à −20%)</label>
          <input
            type="number"
            min={0}
            max={20}
            value={value.etenduePct || ""}
            placeholder="0 — validation responsable"
            onChange={e => set({ etenduePct: Math.min(20, Math.max(0, +e.target.value)) })}
            style={s.input as any}
          />
          {value.etenduePct > 0 && (
            <div style={{ fontSize: 10, color: "#92400E", marginTop: 3 }}>
              −{value.etenduePct}%{economieEtendue > 0 ? ` (−${fmt(economieEtendue)} DH)` : ""} · soumis à validation responsable commercial
            </div>
          )}
        </div>

        {/* Code promo 1er mois */}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--c-muted)", marginBottom: 3 }}>Code promo 1er mois</label>
          <select
            value={value.promoCode}
            onChange={e => {
              const opt = displayedPromos.find(p => p.code === e.target.value);
              set({ promoCode: opt?.code || "", promoPct: opt?.pct || 0 });
            }}
            style={s.input as any}
          >
            <option value="">Aucun</option>
            {displayedPromos.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {value.promoCode && (
        chip(`Code promo 1er mois (${value.promoCode}) — −${value.promoPct}%`, () => set({ promoCode: "", promoPct: 0 }))
      )}
    </div>
  );
}
