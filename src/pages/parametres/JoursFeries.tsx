/**
 * JoursFeries.tsx
 * Page Paramètres > Jours fériés (fêtes religieuses et jours fériés civils)
 * UX/UI Améliorée avec cartes interactives, aperçu dynamique des périodes de suspension,
 * sélecteur d'année sous forme de segment et messages de confirmation en direct.
 */
import { useState, useEffect } from "react";
import {
  getFetesReligieuses,
  createFeteReligieuse,
  updateFeteReligieuse,
  deleteFeteReligieuse,
} from "../../api/client";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays,
  Save,
  Trash2,
  Moon,
  Sun,
  Sparkles,
  Plus,
  Info,
  Calendar,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const TYPES = [
  {
    value: "aid_kebir",
    label: "Aïd el Kébir",
    subtitle: "Fête du Sacrifice",
    icon: Moon,
    color: "#d97706",
    bg: "#fffbeb",
    borderColor: "#fef08a",
  },
  {
    value: "aid_fitr",
    label: "Aïd el Fitr",
    subtitle: "Fin du Ramadan",
    icon: Sun,
    color: "#0284c7",
    bg: "#f0f9ff",
    borderColor: "#bae6fd",
  },
  {
    value: "mawlid",
    label: "Mawlid Ennabawi",
    subtitle: "Naissance du Prophète",
    icon: Sparkles,
    color: "#7c3aed",
    bg: "#faf5ff",
    borderColor: "#e9d5ff",
  },
];

interface Fete {
  id?: number;
  _tempId?: string;
  type: string;
  date: string;
  annee: number;
  jours_avant: number;
  jours_apres: number;
  actif: boolean;
  debut_suspension?: string;
  fin_suspension?: string;
}

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};

const shiftDate = (iso: string, days: number) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function JoursFeries() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState<number>(currentYear);
  const [rows, setRows] = useState<Record<string, Fete>>({});
  const [customRows, setCustomRows] = useState<Fete[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Status feedback inline text state
  const [statusFeedback, setStatusFeedback] = useState<{
    key: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const blankRow = (type: string, year: number): Fete => ({
    type,
    date: "",
    annee: year,
    jours_avant: 1,
    jours_apres: 2,
    actif: true,
  });

  const load = async (year: number) => {
    setLoading(true);
    setStatusFeedback(null);
    try {
      const res = await getFetesReligieuses({ annee: year });
      const list: Fete[] = Array.isArray(res.data)
        ? res.data
        : res.data?.results || [];
      const map: Record<string, Fete> = {};
      TYPES.forEach((t) => {
        map[t.value] =
          list.find((f) => f.type === t.value) || blankRow(t.value, year);
      });
      setRows(map);

      const customList = list.filter(
        (f) => !TYPES.some((t) => t.value === f.type)
      );
      setCustomRows(customList);
    } catch (err) {
      console.error("Failed to load fetes religieuses:", err);
      toast({
        title: "Erreur de chargement des jours fériés",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(annee);
  }, [annee]);

  const setField = (type: string, patch: Partial<Fete>) =>
    setRows((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const saveRow = async (type: string) => {
    const f = rows[type];
    const typeLabel = TYPES.find((t) => t.value === type)?.label || type;
    if (!f.date) {
      const msg = `Date manquante pour ${typeLabel}. Veuillez sélectionner une date.`;
      setStatusFeedback({ key: type, type: "error", message: msg });
      toast({
        title: "Date manquante",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    setSavingKey(type);
    try {
      const payload = {
        type: f.type,
        date: f.date,
        annee,
        jours_avant: f.jours_avant,
        jours_apres: f.jours_apres,
        actif: f.actif,
      };
      const res = f.id
        ? await updateFeteReligieuse(f.id, payload)
        : await createFeteReligieuse(payload);
      setField(type, res.data);
      const succMsg = `L'enregistrement de ${typeLabel} (${annee}) s'est effectué avec succès.`;
      setStatusFeedback({ key: type, type: "success", message: succMsg });
      toast({
        title: "Enregistrement réussi",
        description: succMsg,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || "Erreur réseau";
      setStatusFeedback({
        key: type,
        type: "error",
        message: `L'enregistrement a échoué : ${errMsg}`,
      });
      toast({
        title: "Erreur lors de l'enregistrement",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const removeRow = async (type: string) => {
    const f = rows[type];
    const typeLabel = TYPES.find((t) => t.value === type)?.label || type;
    if (!f.id) {
      setField(type, blankRow(type, annee));
      setStatusFeedback({
        key: type,
        type: "success",
        message: `Champs réinitialisés pour ${typeLabel}.`,
      });
      return;
    }
    setSavingKey(type);
    try {
      await deleteFeteReligieuse(f.id);
      setField(type, blankRow(type, annee));
      setStatusFeedback({
        key: type,
        type: "success",
        message: `Suppression réussie pour ${typeLabel}.`,
      });
      toast({ title: "Date réinitialisée" });
    } catch (err: any) {
      const errMsg = err.message || "Erreur lors de la suppression";
      setStatusFeedback({
        key: type,
        type: "error",
        message: `La suppression a échoué : ${errMsg}`,
      });
      toast({
        title: "Erreur",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const addCustomRow = () => {
    const newRow: Fete = {
      _tempId: Math.random().toString(36).substring(2, 9),
      type: "",
      date: "",
      annee,
      jours_avant: 1,
      jours_apres: 2,
      actif: true,
    };
    setCustomRows((prev) => [...prev, newRow]);
  };

  const setCustomField = (index: number, patch: Partial<Fete>) => {
    setCustomRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const saveCustomRow = async (index: number) => {
    const f = customRows[index];
    const key = f.id ? f.id.toString() : f._tempId || index.toString();
    if (!f.type.trim()) {
      const msg = "Nom du jour férié manquant. Veuillez renseigner le nom.";
      setStatusFeedback({ key, type: "error", message: msg });
      toast({
        title: "Nom manquant",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    if (!f.date) {
      const msg = "Date manquante. Veuillez sélectionner une date.";
      setStatusFeedback({ key, type: "error", message: msg });
      toast({
        title: "Date manquante",
        description: msg,
        variant: "destructive",
      });
      return;
    }
    setSavingKey(key);
    try {
      const payload = {
        type: f.type,
        date: f.date,
        annee,
        jours_avant: f.jours_avant,
        jours_apres: f.jours_apres,
        actif: f.actif,
      };
      const res = f.id
        ? await updateFeteReligieuse(f.id, payload)
        : await createFeteReligieuse(payload);

      setCustomRows((prev) => {
        const copy = [...prev];
        copy[index] = res.data;
        return copy;
      });
      const succMsg = `L'enregistrement de « ${f.type} » s'est effectué avec succès pour ${annee}.`;
      const resKey = res.data.id?.toString() || key;
      setStatusFeedback({ key: resKey, type: "success", message: succMsg });
      toast({
        title: "Jour férié enregistré",
        description: succMsg,
      });
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || "Erreur système";
      setStatusFeedback({
        key,
        type: "error",
        message: `L'enregistrement a échoué : ${errMsg}`,
      });
      toast({
        title: "Erreur lors de l'enregistrement",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const removeCustomRow = async (index: number) => {
    const f = customRows[index];
    const key = f.id ? f.id.toString() : f._tempId || index.toString();
    if (!f.id) {
      setCustomRows((prev) => prev.filter((_, idx) => idx !== index));
      return;
    }
    setSavingKey(key);
    try {
      await deleteFeteReligieuse(f.id);
      setCustomRows((prev) => prev.filter((_, idx) => idx !== index));
      setStatusFeedback({
        key: "global",
        type: "success",
        message: `Jour férié supprimé avec succès.`,
      });
      toast({ title: "Jour férié supprimé" });
    } catch (err: any) {
      const errMsg = err.message || "Erreur de suppression";
      setStatusFeedback({
        key,
        type: "error",
        message: `La suppression a échoué : ${errMsg}`,
      });
      toast({
        title: "Erreur",
        description: errMsg,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const years = [
    currentYear - 1,
    currentYear,
    currentYear + 1,
    currentYear + 2,
  ];

  const totalConfigured =
    Object.values(rows).filter((r) => r.date && r.actif).length +
    customRows.filter((r) => r.date && r.actif).length;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(1.25rem, 3vw, 2rem) clamp(0.75rem, 3vw, 1.25rem) 4rem" }}>
      {/* Page Title & Year Selector Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.4rem",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "#0d9488",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(13, 148, 136, 0.25)",
              }}
            >
              <CalendarDays size={22} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 800,
                  color: "#0f172a",
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                Jours Fériés & Fêtes Religieuses
              </h1>
              <span
                style={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}
              >
                Gestion des périodes de suspension et automatismes d'envoi aux commerciaux
              </span>
            </div>
          </div>
        </div>

        {/* Year Segmented Selector Buttons */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "10px",
            padding: "0.25rem",
            display: "flex",
            gap: "0.25rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          {years.map((y) => {
            const isSelected = annee === y;
            return (
              <button
                key={y}
                onClick={() => setAnnee(y)}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: "8px",
                  border: "none",
                  background: isSelected ? "#0d9488" : "transparent",
                  color: isSelected ? "#ffffff" : "#475569",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected
                    ? "0 2px 6px rgba(13, 148, 136, 0.3)"
                    : "none",
                }}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#fffbeb",
              border: "1px solid #fef08a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#d97706",
            }}
          >
            <Moon size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>
              Fêtes Religieuses
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
              3 Événements Majeurs
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#16a34a",
            }}
          >
            <Calendar size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>
              Actifs en {annee}
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a" }}>
              {totalConfigured} Jours Fériés Configurés
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "1.1rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#f0f9ff",
              border: "1px solid #bae6fd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0284c7",
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>
              Règle de suspension
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0f172a" }}>
              −1j Avant / +2j Après
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner Box */}
      <div
        style={{
          background: "#f0fdfa",
          border: "1px solid #99f6e4",
          borderRadius: "12px",
          padding: "1rem 1.25rem",
          marginBottom: "2rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.85rem",
        }}
      >
        <Info size={20} color="#0d9488" style={{ marginTop: "0.1rem", flexShrink: 0 }} />
        <div style={{ fontSize: "0.875rem", color: "#115e59", lineHeight: 1.5 }}>
          <strong>Transmission des notifications :</strong> Lorsqu'une fête est enregistrée, les alertes sont envoyées <strong>exclusivement aux commerciaux par e-mail et WhatsApp</strong> 1 semaine avant. Chaque commercial se charge ensuite d'informer ses clients concernés et de leur transmettre la proposition de report.
        </div>
      </div>

      {/* Section 1: Fêtes Religieuses Islamiques */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <h2
            style={{
              fontSize: "1.2rem",
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
            }}
          >
            Fêtes Religieuses Islamiques ({annee})
          </h2>
          <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>
            3 événements principaux
          </span>
        </div>

        {loading ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "3rem",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem" }} />
            Chargement des dates {annee}...
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {TYPES.map((t) => {
              const f = rows[t.value] || blankRow(t.value, annee);
              const IconComp = t.icon;
              const isSaving = savingKey === t.value;

              const debutDateIso = f.date ? (f.debut_suspension || shiftDate(f.date, -f.jours_avant)) : "";
              const finDateIso = f.date ? (f.fin_suspension || shiftDate(f.date, f.jours_apres)) : "";
              const noticeDateIso = f.date ? shiftDate(debutDateIso, -7) : "";

              const feedback = statusFeedback && statusFeedback.key === t.value ? statusFeedback : null;

              return (
                <div
                  key={t.value}
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${f.date ? t.borderColor : "#e2e8f0"}`,
                    borderRadius: "14px",
                    padding: "1.35rem 1.5rem",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Card Top Bar */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.75rem",
                      marginBottom: "1.1rem",
                      paddingBottom: "0.85rem",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "10px",
                          background: t.bg,
                          border: `1px solid ${t.borderColor}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: t.color,
                        }}
                      >
                        <IconComp size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                          {t.label}
                        </div>
                        <div style={{ fontSize: "0.775rem", color: "#64748b" }}>
                          {t.subtitle}
                        </div>
                      </div>
                    </div>

                    {/* Active Toggle & Status Badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          fontSize: "0.825rem",
                          fontWeight: 600,
                          color: f.actif ? "#15803d" : "#94a3b8",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={f.actif}
                          onChange={(e) => setField(t.value, { actif: e.target.checked })}
                          style={{
                            width: "16px",
                            height: "16px",
                            accentColor: "#0d9488",
                            cursor: "pointer",
                          }}
                        />
                        {f.actif ? "Actif" : "Inactif"}
                      </label>

                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "0.25rem 0.6rem",
                          borderRadius: "20px",
                          background: f.actif ? "#dcfce7" : "#f1f5f9",
                          color: f.actif ? "#166534" : "#64748b",
                        }}
                      >
                        {f.actif ? "● Activé" : "○ Désactivé"}
                      </span>
                    </div>
                  </div>

                  {/* Input Fields Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "1.25rem",
                      alignItems: "end",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "0.35rem",
                        }}
                      >
                        Date de la fête ({annee})
                      </label>
                      <input
                        type="date"
                        value={f.date || ""}
                        onChange={(e) => setField(t.value, { date: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          fontSize: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "0.35rem",
                        }}
                      >
                        Jours avant (suspension)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={7}
                        value={f.jours_avant}
                        onChange={(e) =>
                          setField(t.value, { jours_avant: Math.max(0, +e.target.value) })
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          fontSize: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "0.35rem",
                        }}
                      >
                        Jours après (suspension)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={7}
                        value={f.jours_apres}
                        onChange={(e) =>
                          setField(t.value, { jours_apres: Math.max(0, +e.target.value) })
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          fontSize: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => saveRow(t.value)}
                        disabled={isSaving}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          background: "#0d9488",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.55rem 1.1rem",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                          boxShadow: "0 2px 4px rgba(13, 148, 136, 0.2)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#0f766e")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#0d9488")
                        }
                      >
                        {isSaving ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : (
                          <Save size={15} />
                        )}
                        Enregistrer
                      </button>

                      <button
                        onClick={() => removeRow(t.value)}
                        disabled={isSaving}
                        title="Réinitialiser"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "0.55rem 0.75rem",
                          cursor: "pointer",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#fee2e2")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#fef2f2")
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Save / Error Feedback Alert Box */}
                  {feedback ? (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "8px",
                        background: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
                        border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                        color: feedback.type === "success" ? "#15803d" : "#991b1b",
                        fontSize: "0.825rem",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {feedback.type === "success" ? (
                        <CheckCircle2 size={16} color="#16a34a" />
                      ) : (
                        <AlertCircle size={16} color="#dc2626" />
                      )}
                      <span>{feedback.message}</span>
                    </div>
                  ) : null}

                  {/* Calculated Suspension Summary Pill Banner */}
                  {f.date ? (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.75rem 1rem",
                        borderRadius: "10px",
                        background: "#fffdf5",
                        border: "1px solid #fef08a",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.825rem",
                        color: "#854d0e",
                      }}
                    >
                      <div>
                        <span>Période de suspension calculée :</span>{" "}
                        <strong style={{ color: "#92400e" }}>
                          {fmtDate(debutDateIso)}
                        </strong>{" "}
                        ➜{" "}
                        <strong style={{ color: "#92400e" }}>
                          {fmtDate(finDateIso)}
                        </strong>
                      </div>

                      <div style={{ fontSize: "0.775rem", color: "#a16207" }}>
                        Notification auto aux commerciaux le{" "}
                        <strong>{fmtDate(noticeDateIso)}</strong> (1 semaine avant)
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Autres Jours Fériés */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                color: "#0f172a",
                margin: 0,
              }}
            >
              Autres Jours Fériés ({annee})
            </h2>
            <span
              style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}
            >
              Fêtes nationales, jours fériés civils ou événements exceptionnels
            </span>
          </div>

          <button
            onClick={addCustomRow}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "#ffffff",
              color: "#0d9488",
              border: "1px solid #0d9488",
              borderRadius: "8px",
              padding: "0.5rem 0.95rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f0fdfa";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#ffffff";
            }}
          >
            <Plus size={16} /> Ajouter un jour férié
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {customRows.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                border: "2px dashed #e2e8f0",
                borderRadius: "14px",
                padding: "2.5rem 1.5rem",
                textAlign: "center",
              }}
            >
              <Calendar
                size={32}
                color="#cbd5e1"
                style={{ margin: "0 auto 0.75rem" }}
              />
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "0.25rem",
                }}
              >
                Aucun autre jour férié configuré pour {annee}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                  marginBottom: "1rem",
                }}
              >
                Ajoutez des jours fériés civils (Fête du Trône, Nouvel An Hégire...) si nécessaire.
              </div>
              <button
                onClick={addCustomRow}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  background: "#0d9488",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0.5rem 1rem",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={15} /> Ajouter maintenant
              </button>
            </div>
          ) : (
            customRows.map((f, idx) => {
              const key = f.id ? f.id.toString() : f._tempId || idx.toString();
              const isSaving = savingKey === key;

              const debutDateIso = f.date ? (f.debut_suspension || shiftDate(f.date, -f.jours_avant)) : "";
              const finDateIso = f.date ? (f.fin_suspension || shiftDate(f.date, f.jours_apres)) : "";
              const feedback = statusFeedback && statusFeedback.key === key ? statusFeedback : null;

              return (
                <div
                  key={key}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "1.25rem 1.5rem",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: "1rem",
                      alignItems: "end",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "0.35rem",
                        }}
                      >
                        Nom du jour férié
                      </label>
                      <input
                        type="text"
                        placeholder="ex: Fête du Trône"
                        value={f.type}
                        onChange={(e) =>
                          setCustomField(idx, { type: e.target.value })
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          fontSize: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "0.35rem",
                        }}
                      >
                        Date
                      </label>
                      <input
                        type="date"
                        value={f.date || ""}
                        onChange={(e) =>
                          setCustomField(idx, { date: e.target.value })
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          fontSize: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "0.35rem",
                        }}
                      >
                        Jours avant
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={7}
                        value={f.jours_avant}
                        onChange={(e) =>
                          setCustomField(idx, {
                            jours_avant: Math.max(0, +e.target.value),
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          fontSize: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.775rem",
                          fontWeight: 600,
                          color: "#475569",
                          marginBottom: "0.35rem",
                        }}
                      >
                        Jours après
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={7}
                        value={f.jours_apres}
                        onChange={(e) =>
                          setCustomField(idx, {
                            jours_apres: Math.max(0, +e.target.value),
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "0.55rem 0.75rem",
                          fontSize: "0.875rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        onClick={() => saveCustomRow(idx)}
                        disabled={isSaving}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          background: "#0d9488",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.55rem 0.95rem",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isSaving ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : (
                          <Save size={15} />
                        )}
                        Enregistrer
                      </button>

                      <button
                        onClick={() => removeCustomRow(idx)}
                        disabled={isSaving}
                        title="Supprimer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "0.55rem 0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Save / Error Feedback Alert Box */}
                  {feedback ? (
                    <div
                      style={{
                        marginTop: "1rem",
                        padding: "0.6rem 0.85rem",
                        borderRadius: "8px",
                        background: feedback.type === "success" ? "#f0fdf4" : "#fef2f2",
                        border: `1px solid ${feedback.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                        color: feedback.type === "success" ? "#15803d" : "#991b1b",
                        fontSize: "0.825rem",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      {feedback.type === "success" ? (
                        <CheckCircle2 size={16} color="#16a34a" />
                      ) : (
                        <AlertCircle size={16} color="#dc2626" />
                      )}
                      <span>{feedback.message}</span>
                    </div>
                  ) : null}

                  {f.date ? (
                    <div
                      style={{
                        marginTop: "0.85rem",
                        fontSize: "0.8rem",
                        color: "#64748b",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                      }}
                    >
                      <span>
                        Période suspendue : <strong>{fmtDate(debutDateIso)}</strong> ➜ <strong>{fmtDate(finDateIso)}</strong>
                      </span>
                      <label
                        style={{
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          fontWeight: 600,
                          color: f.actif ? "#15803d" : "#94a3b8",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={f.actif}
                          onChange={(e) =>
                            setCustomField(idx, { actif: e.target.checked })
                          }
                        />
                        Actif
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
