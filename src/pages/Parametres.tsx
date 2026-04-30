/**
 * Parametres.tsx
 * Page Paramètres — styles inline pour rendu garanti.
 */
import { useState, useEffect, CSSProperties } from "react";
import { getMe, updateMe, changePassword, logout } from "../api/client";
import { useToast } from "@/hooks/use-toast";

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
  radius:      "10px",
  radiusSm:    "7px",
};

/* ── Styles partagés ──────────────────────────────────────────────────────── */
const S: Record<string, CSSProperties> = {
  page: {
    maxWidth: 620,
    margin: "0 auto",
    paddingTop: 32,
    paddingBottom: 48,
    paddingLeft: 24,
    paddingRight: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    color: T.text,
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    color: T.text,
    letterSpacing: "-0.3px",
  },
  pageSubtitle: {
    fontSize: 13,
    color: T.textMuted,
    margin: "4px 0 0",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: T.tealLight,
    border: `1.5px solid ${T.teal}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 600,
    color: T.tealText,
    flexShrink: 0,
    userSelect: "none" as const,
  },
  card: {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: "24px 28px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    paddingBottom: 18,
    marginBottom: 20,
    borderBottom: `1px solid ${T.border}`,
  },
  cardIconWrap: {
    width: 34,
    height: 34,
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
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
    color: T.text,
  },
  cardDesc: {
    fontSize: 12,
    color: T.textLight,
    margin: "2px 0 0",
  },
  label: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    color: T.textMuted,
    marginBottom: 6,
  },
  input: {
    width: "100%",
    height: 40,
    padding: "0 12px",
    fontSize: 14,
    fontFamily: "inherit",
    color: T.text,
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusSm,
    outline: "none",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  inputDisabled: {
    color: T.textMuted,
    cursor: "default",
    fontFamily: "'Menlo', 'Courier New', monospace",
    fontSize: 13,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 16,
  },
  pwWrap: {
    position: "relative" as const,
  },
  pwBtn: {
    position: "absolute" as const,
    right: 10,
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
    gap: 6,
    height: 38,
    padding: "0 18px",
    fontSize: 13,
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
    gap: 6,
    height: 38,
    padding: "0 18px",
    fontSize: 13,
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
    padding: "20px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: T.redText,
    margin: 0,
  },
  dangerDesc: {
    fontSize: 12,
    color: T.redMuted,
    margin: "3px 0 0",
  },
  pwHint: {
    fontSize: 11,
    marginTop: 5,
    marginBottom: 0,
  },
};

/* ── Icônes SVG ───────────────────────────────────────────────────────────── */
const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M2 13c0-3.314 2.686-5 6-5s6 1.686 6 5" />
  </svg>
);
const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5 7V5a3 3 0 016 0v2" />
  </svg>
);
const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
    <circle cx="8" cy="8" r="2" />
  </svg>
);
const IconEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M2 2l12 12M6.5 6.6A2 2 0 0010.4 10M5.3 5a7.2 7.2 0 00-4.3 3s3 5 7 5c1.4 0 2.6-.4 3.7-1M10.7 10.9A7 7 0 0015 8s-3-5-7-5c-.5 0-1 .05-1.4.14" />
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 7l3.5 3.5L12 3" />
  </svg>
);
const IconLogout = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 2H2v10h3M9 4l3 3-3 3M12 7H5" />
  </svg>
);

/* ── Sous-composants ──────────────────────────────────────────────────────── */
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

/* ── Composant principal ──────────────────────────────────────────────────── */
const Parametres = () => {
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

  useEffect(() => { loadProfile(); }, []);

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
      
      // Auto-logout after successful password change
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
    <div style={S.page}>
      {/* En-tête */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>Paramètres</h1>
          <p style={S.pageSubtitle}>Gérez votre compte et vos préférences</p>
        </div>
        <div style={S.avatar}>{initials}</div>
      </div>

      {/* Informations personnelles */}
      <CardSection
        icon={<IconUser />}
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
            <IconCheck />
            {savingProfile ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </CardSection>

      {/* Mot de passe */}
      <CardSection
        icon={<IconLock />}
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
              {showOldPassword ? <IconEyeOff /> : <IconEye />}
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
              {showNewPassword ? <IconEyeOff /> : <IconEye />}
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
            <IconCheck />
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
          <IconLogout />
          Déconnexion
        </button>
      </div>
    </div>
  );
};

export default Parametres;