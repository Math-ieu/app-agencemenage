/**
 * Profil.tsx
 * Page Paramètres > Mon Profil
 */
import React, { useState, useEffect, CSSProperties } from "react";
import { getMe, updateMe, changePassword, logout } from "../../api/client";
import { useToast } from "@/hooks/use-toast";

// Lucide Icons
import { User as UserIcon, Lock, LogOut, Check, Eye, EyeOff } from "lucide-react";

/* ── Tokens de design ──────────────────────────────────────────────────────── */
const T = {
  teal:        "#0d9488",
  tealDark:    "#0f766e",
  tealLight:   "#ccfbf1",
  tealText:    "#134e4a",
  red:         "#dc2626",
  redBg:       "#fef2f2",
  redBorder:   "#fecaca",
  redText:     "#991b1b",
  redMuted:    "#f87171",
  border:      "#e4e4e7",
  borderFocus: "#0d9488",
  bg:          "#ffffff",
  bgMuted:     "#f4f4f5",
  bgInput:     "#f9fafb",
  text:        "#18181b",
  textMuted:   "#71717a",
  textLight:   "#a1a1aa",
  radius:      "12px",
  radiusSm:    "10px",
};

/* ── Styles partagés ──────────────────────────────────────────────────────── */
const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 780,
    margin: "0 auto",
    paddingTop: 40,
    paddingBottom: 64,
    paddingLeft: 32,
    paddingRight: 32,
    display: "flex",
    flexDirection: "column",
    gap: 24,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    color: T.text,
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 600,
    margin: 0,
    color: T.text,
    letterSpacing: "-0.3px",
  },
  pageSubtitle: {
    fontSize: 15,
    color: T.textMuted,
    margin: "6px 0 0",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    background: T.tealLight,
    border: `1.5px solid ${T.teal}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 600,
    color: T.tealText,
    flexShrink: 0,
    userSelect: "none",
  },
  card: {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: "28px 34px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    paddingBottom: 22,
    marginBottom: 24,
    borderBottom: `1px solid ${T.border}`,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: T.radiusSm,
    background: T.bgMuted,
    border: `1px solid ${T.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: T.textMuted,
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: 600,
    margin: 0,
    color: T.text,
  },
  cardDesc: {
    fontSize: 14,
    color: T.textLight,
    margin: "2px 0 0",
  },
  label: {
    display: "block",
    fontSize: 12.5,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: T.textMuted,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    height: 48,
    padding: "0 16px",
    fontSize: 15.5,
    fontFamily: "inherit",
    color: T.text,
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  inputDisabled: {
    color: T.textMuted,
    cursor: "default",
    fontFamily: "'Menlo', 'Courier New', monospace",
    fontSize: 14,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 20,
  },
  pwWrap: {
    position: "relative",
  },
  pwBtn: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    padding: 4,
    cursor: "pointer",
    color: T.textLight,
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
  },
  actions: {
    paddingTop: 6,
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 46,
    padding: "0 24px",
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "inherit",
    color: "#fff",
    background: T.teal,
    border: "none",
    borderRadius: T.radiusSm,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  btnDanger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 46,
    padding: "0 24px",
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "inherit",
    color: T.red,
    background: "transparent",
    border: `1px solid ${T.redMuted}`,
    borderRadius: T.radiusSm,
    cursor: "pointer",
    transition: "background 0.15s",
    flexShrink: 0,
  },
  dangerCard: {
    background: T.redBg,
    border: `1px solid ${T.redBorder}`,
    borderRadius: T.radius,
    padding: "24px 34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  dangerTitle: {
    fontSize: 16.5,
    fontWeight: 600,
    color: T.redText,
    margin: 0,
  },
  dangerDesc: {
    fontSize: 14,
    color: T.redMuted,
    margin: "4px 0 0",
  },
  pwHint: {
    fontSize: 12.5,
    marginTop: 7,
    marginBottom: 0,
  },
};

interface FieldInputProps {
  id?: string;
  type?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  extraStyle?: CSSProperties;
}

const FieldInput = ({ id, type = "text", value, onChange, placeholder, disabled, extraStyle }: FieldInputProps) => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...S.input,
        ...(disabled ? S.inputDisabled : {}),
        ...(focused ? { borderColor: T.borderFocus, boxShadow: `0 0 0 3px ${T.teal}20`, background: "#fff" } : {}),
        ...extraStyle,
      }}
    />
  );
};

interface CardSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

const CardSection = ({ icon, title, description, children }: CardSectionProps) => (
  <div style={S.card}>
    <div style={S.cardHeader}>
      <div style={S.cardIconWrap}>{icon}</div>
      <div>
        <p style={S.cardTitle}>{title}</p>
        <p style={S.cardDesc}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

export default function Profil() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await getMe();
      setUser(data);
      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
    } catch {
      toast({ title: "Erreur de chargement du profil", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateMe({ first_name: firstName, last_name: lastName });
      toast({ title: "Profil mis à jour avec succès" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.response?.data?.detail || err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || newPassword.length < 8) {
      toast({ title: "Erreur", description: "Remplissez tous les champs (8 caractères minimum).", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword });
      setOldPassword(""); setNewPassword("");
      toast({ title: "Mot de passe modifié avec succès. Déconnexion..." });
      
      setTimeout(() => {
        handleLogout();
      }, 1500);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } finally { window.location.reload(); }
  };

  const initials = user
    ? `${(user.first_name || "")[0] || ""}${(user.last_name || "")[0] || ""}`.toUpperCase() || "?"
    : "?";

  const pwHint =
    newPassword.length === 0 ? null
    : newPassword.length < 8
      ? { label: `${newPassword.length}/8 caractères minimum`, color: T.red }
      : { label: "Mot de passe valide ✓", color: T.teal };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: T.textMuted, fontSize: 14 }}>
      Chargement...
    </div>
  );
  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: T.textMuted, fontSize: 14 }}>
      Utilisateur non trouvé.
    </div>
  );

  return (
    <div style={S.page} className="animate-fade-in">
      {/* En-tête */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>Mon Profil</h1>
          <p style={S.pageSubtitle}>Gérez vos informations personnelles et la sécurité de votre compte</p>
        </div>
        <div style={S.avatar}>{initials}</div>
      </div>

      {/* Informations personnelles */}
      <CardSection
        icon={<UserIcon size={20} />}
        title="Informations personnelles"
        description="Modifiez votre nom et vos coordonnées"
      >
        <div style={S.fieldGroup}>
          <label style={S.label}>Adresse email</label>
          <FieldInput value={user.email || ""} disabled />
        </div>

        <div style={S.fieldRow}>
          <div>
            <label style={S.label} htmlFor="fn">Prénom</label>
            <FieldInput id="fn" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Votre prénom" />
          </div>
          <div>
            <label style={S.label} htmlFor="ln">Nom</label>
            <FieldInput id="ln" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Votre nom" />
          </div>
        </div>

        <div style={S.actions}>
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            style={{ ...S.btnPrimary, opacity: savingProfile ? 0.65 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = T.tealDark)}
            onMouseLeave={e => (e.currentTarget.style.background = T.teal)}
          >
            <Check size={16} />
            {savingProfile ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </CardSection>

      {/* Mot de passe */}
      <CardSection
        icon={<Lock size={20} />}
        title="Mot de passe"
        description="Choisissez un nouveau mot de passe sécurisé"
      >
        <div style={S.fieldGroup}>
          <label style={S.label} htmlFor="old-pw">Mot de passe actuel</label>
          <div style={S.pwWrap}>
            <FieldInput
              id="old-pw"
              type={showOldPassword ? "text" : "password"}
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              placeholder="••••••••"
              extraStyle={{ paddingRight: 42 }}
            />
            <button style={S.pwBtn} onClick={() => setShowOldPassword(v => !v)} type="button">
              {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div style={S.fieldGroup}>
          <label style={S.label} htmlFor="new-pw">Nouveau mot de passe</label>
          <div style={S.pwWrap}>
            <FieldInput
              id="new-pw"
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              extraStyle={{ paddingRight: 42 }}
            />
            <button style={S.pwBtn} onClick={() => setShowNewPassword(v => !v)} type="button">
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {pwHint && <p style={{ ...S.pwHint, color: pwHint.color }}>{pwHint.label}</p>}
        </div>

        <div style={S.actions}>
          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !newPassword || !oldPassword}
            style={{ ...S.btnPrimary, opacity: (savingPassword || !newPassword || !oldPassword) ? 0.5 : 1 }}
            onMouseEnter={e => (e.currentTarget.style.background = T.tealDark)}
            onMouseLeave={e => (e.currentTarget.style.background = T.teal)}
          >
            <Check size={16} />
            {savingPassword ? "Modification..." : "Modifier le mot de passe"}
          </button>
        </div>
      </CardSection>

      {/* Déconnexion */}
      <div style={S.dangerCard}>
        <div>
          <p style={S.dangerTitle}>Se déconnecter</p>
          <p style={S.dangerDesc}>Vous serez redirigé vers la page de connexion</p>
        </div>
        <button
          onClick={handleLogout}
          style={S.btnDanger}
          onMouseEnter={e => (e.currentTarget.style.background = T.redBorder)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </div>
  );
}
