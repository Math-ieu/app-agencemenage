import React from "react";

export const fmt = (n: number) => Math.round(n).toLocaleString("fr-MA");

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--c-muted)", marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

export function OptRow({ label, price, checked, onChange, note }: { label: string; price: string; checked: boolean; onChange: (val: boolean) => void; note?: string }) {
  return (
    <div style={s.optRow}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11, cursor: "pointer", flex: 1 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          style={{ width: 13, height: 13, marginTop: 1, cursor: "pointer", flexShrink: 0 }} />
        <span>{label}{note && <span style={{ fontSize: 10, color: "var(--c-muted)", display: "block" }}>{note}</span>}</span>
      </label>
      <span style={{ fontSize: 10, color: "var(--c-muted)", whiteSpace: "nowrap", marginLeft: 8 }}>{price}</span>
    </div>
  );
}

export function ResultBar({ detail, total, label, warn }: { detail: string; total: string; label: string; warn?: string }) {
  return (
    <div style={s.resultBar}>
      <div style={{ fontSize: 11, color: "var(--c-muted)", flex: 1, lineHeight: 1.6 }}>{detail}</div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "var(--c-muted)" }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{total}</div>
        {warn && <span style={{ display: "inline-block", fontSize: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 4, padding: "2px 8px", marginTop: 3 }}>{warn}</span>}
      </div>
    </div>
  );
}

export function FormulaBox({ children }: { children: React.ReactNode }) {
  return <div style={s.fb}>{children}</div>;
}

export const B = ({ children }: { children: React.ReactNode }) => <strong style={{ fontWeight: 600, color: "inherit", opacity: .9 }}>{children}</strong>;

export const s: Record<string, React.CSSProperties> = {
  fb: { background: "#f1f5f9", border: "1px solid var(--border-color)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.65 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  input: { width: "100%", padding: "6px 9px", border: "1px solid var(--border-color)", borderRadius: 7, background: "#fff", color: "inherit", fontSize: 12, fontFamily: "inherit", transition: "border-color .15s, box-shadow .15s" },
  optTitle: { fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".05em", margin: "11px 0 5px" },
  optRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--border-color)", gap: 6 },
  resultBar: { marginTop: 14, background: "#f1f5f9", border: "1px solid var(--border-color)", borderRadius: 10, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  seg: { display: "flex", border: "1px solid var(--border-color)", borderRadius: 8, overflow: "hidden", marginBottom: 13 },
  segBtn: { flex: 1, padding: "7px 6px", fontSize: 11, textAlign: "center", cursor: "pointer", background: "transparent", border: "none", color: "var(--text-muted)", transition: "all .15s" },
  segBtnOn: { background: "#EFF6FF", color: "#1D4ED8", fontWeight: 600 },
  subTabs: { display: "flex", gap: 6, marginBottom: 13 },
  subTab: { fontSize: 11, padding: "5px 13px", borderRadius: 7, cursor: "pointer", border: "1px solid var(--border-color)", color: "var(--text-muted)", background: "transparent", transition: "all .15s" },
  subTabOn: { background: "#EFF6FF", color: "#1D4ED8", borderColor: "transparent", fontWeight: 600 },
};
