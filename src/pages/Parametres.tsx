/**
 * Parametres.tsx
 * Page Paramètres — Premium Multi-tabs with User Accounts and Roles & Privileges grid.
 */
import React, { useState, useEffect, useMemo, CSSProperties } from "react";
import { getMe, updateMe, changePassword, logout } from "../api/client";
import { useToast } from "@/hooks/use-toast";

// Lucide Icons
import { 
  User as UserIcon, Lock, LogOut, Check, Eye, EyeOff, ShieldCheck, 
  Users, KeyRound, ChevronLeft, ChevronRight, Info
} from "lucide-react";

// User management components
import { UsersToolbar } from "@/components/users/UsersToolbar";
import { UsersTable } from "@/components/users/UsersTable";
import { UserFormDialog } from "@/components/users/UserFormDialog";
import { DeleteUserDialog } from "@/components/users/DeleteUserDialog";
import type { User, UserFormValues } from "@/lib/user-schema";

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
    maxWidth: 960,
    margin: "0 auto",
    paddingTop: 32,
    paddingBottom: 48,
    paddingLeft: 24,
    paddingRight: 24,
    display: "flex",
    flexDirection: "column",
    gap: 20,
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
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: T.text,
    letterSpacing: "-0.4px",
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
    userSelect: "none",
  },
  card: {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: T.radius,
    padding: "24px 28px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    marginBottom: 20,
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
    textTransform: "uppercase",
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
    boxSizing: "border-box",
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
    position: "relative",
  },
  pwBtn: {
    position: "absolute",
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
  tabsContainer: {
    display: "flex",
    borderBottom: `2px solid ${T.border}`,
    gap: 24,
    marginBottom: 12,
  },
  tabButton: {
    background: "none",
    border: "none",
    paddingBottom: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    color: T.textMuted,
    position: "relative",
    transition: "color 0.15s",
  },
  tabButtonActive: {
    color: T.teal,
  },
  tabIndicator: {
    position: "absolute",
    bottom: -2,
    left: 0,
    right: 0,
    height: 2,
    background: T.teal,
    borderRadius: 1,
  }
};

/* ── Données et Configuration initiales des Rôles & Privilèges ────────────────── */
const PERMISSIONS = [
  { key: "consulter_clients", label: "Clients : Consulter le listing" },
  { key: "creer_clients", label: "Clients : Créer & éditer" },
  { key: "blacklister_clients", label: "Clients : Blacklister & archiver" },
  { key: "consulter_demandes", label: "Demandes : Consulter le listing" },
  { key: "valider_demandes", label: "Demandes : Valider & planifier (CAO)" },
  { key: "annuler_demandes", label: "Demandes : Annuler la facturation" },
  { key: "voir_la_caisse", label: "Finances : Consulter le solde de caisse" },
  { key: "mouvements_caisse", label: "Finances : Saisir des entrées/sorties" },
  { key: "consulter_agents", label: "Agents : Consulter les fiches" },
  { key: "creer_agents", label: "Agents : Créer & éditer" },
  { key: "documents_agents", label: "Agents : Télécharger les pièces jointes (CIN, etc.)" },
  { key: "rediger_blog", label: "SEO & Blog : Rédiger & modifier les articles" },
  { key: "parametres_globaux", label: "Configuration : Gérer la sécurité & les accès" },
];

const ROLES = [
  { key: "Admin", label: "Admin" },
  { key: "Moderateur", label: "Modérateur" },
  { key: "Responsable commercial", label: "Responsable Commercial" },
  { key: "commercial", label: "Commercial" },
  { key: "Responsable des Opérations", label: "Responsable Opérations" },
  { key: "Chargée des Opérations", label: "Chargée Opérations" },
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  "Admin": PERMISSIONS.map(p => p.key),
  "Moderateur": ["consulter_clients", "creer_clients", "consulter_demandes", "consulter_agents", "rediger_blog"],
  "Responsable commercial": ["consulter_clients", "creer_clients", "consulter_demandes", "valider_demandes", "consulter_agents"],
  "commercial": ["consulter_clients", "creer_clients", "consulter_demandes"],
  "Responsable des Opérations": ["consulter_clients", "consulter_demandes", "valider_demandes", "voir_la_caisse", "consulter_agents", "creer_agents", "documents_agents"],
  "Chargée des Opérations": ["consulter_clients", "consulter_demandes", "consulter_agents"],
};

const INITIAL_USERS: User[] = [
  { id: "u1", fullName: "Sofia El Amrani", username: "selamrani", email: "sofia.elamrani@example.ma", phone: "+212 661 22 33 44", position: "Responsable commercial", city: "Casablanca", status: "actif", avatarUrl: "https://i.pravatar.cc/150?img=47" },
  { id: "u2", fullName: "Youssef Benali", username: "ybenali", email: "youssef.benali@example.ma", phone: "+212 662 11 22 33", position: "commercial", city: "Rabat", status: "actif", avatarUrl: "https://i.pravatar.cc/150?img=12" },
  { id: "u3", fullName: "Imane Tazi", username: "itazi", email: "imane.tazi@example.ma", phone: "+212 663 44 55 66", position: "Chargée des Opérations", city: "Marrakech", status: "desactive", avatarUrl: "https://i.pravatar.cc/150?img=32" },
  { id: "u4", fullName: "Mehdi Cherkaoui", username: "mcherkaoui", email: "mehdi.cherkaoui@example.ma", phone: "+212 664 77 88 99", position: "Responsable des Opérations", city: "Casablanca", status: "actif", avatarUrl: "https://i.pravatar.cc/150?img=15" },
];

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

/* ── Composant principal ──────────────────────────────────────────────────── */
const Parametres = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'users'>('profile');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile forms
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const { toast } = useToast();

  // Users CRUD state
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  // Roles Privileges state
  const [privileges, setPrivileges] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadProfile();
    loadUsers();
    loadPrivileges();
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

  const loadUsers = () => {
    const saved = localStorage.getItem("backoffice_users");
    if (saved) {
      try {
        setUsers(JSON.parse(saved));
        return;
      } catch (e) {
        console.error("Error parsing local users", e);
      }
    }
    setUsers(INITIAL_USERS);
    localStorage.setItem("backoffice_users", JSON.stringify(INITIAL_USERS));
  };

  const loadPrivileges = () => {
    const saved = localStorage.getItem("roles_permissions");
    if (saved) {
      try {
        setPrivileges(JSON.parse(saved));
        return;
      } catch (e) {
        console.error("Error parsing local privileges", e);
      }
    }
    setPrivileges(DEFAULT_PERMISSIONS);
    localStorage.setItem("roles_permissions", JSON.stringify(DEFAULT_PERMISSIONS));
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

  // User CRUD functions
  const handleAddUser = (values: UserFormValues) => {
    const newUser: User = {
      id: crypto.randomUUID(),
      fullName: values.fullName,
      username: values.username,
      email: values.email,
      phone: values.phone,
      position: values.position,
      city: values.city,
      status: values.status,
      avatarUrl: values.avatarUrl,
    };
    const updated = [newUser, ...users];
    setUsers(updated);
    localStorage.setItem("backoffice_users", JSON.stringify(updated));
    toast({ title: "Utilisateur créé avec succès" });
    setFormOpen(false);
  };

  const handleUpdateUser = (values: UserFormValues) => {
    if (!editing) return;
    const updated = users.map((u) =>
      u.id === editing.id
        ? {
            ...u,
            fullName: values.fullName,
            username: values.username,
            email: values.email,
            phone: values.phone,
            position: values.position,
            city: values.city,
            status: values.status,
            avatarUrl: values.avatarUrl,
          }
        : u
    );
    setUsers(updated);
    localStorage.setItem("backoffice_users", JSON.stringify(updated));
    toast({ title: "Utilisateur mis à jour avec succès" });
    setFormOpen(false);
    setEditing(null);
  };

  const handleDeleteUser = () => {
    if (!toDelete) return;
    const updated = users.filter((u) => u.id !== toDelete.id);
    setUsers(updated);
    localStorage.setItem("backoffice_users", JSON.stringify(updated));
    toast({ title: "Utilisateur supprimé avec succès" });
    setToDelete(null);
  };

  // Privileges functions
  const togglePermission = (roleKey: string, permKey: string) => {
    const rolePermissions = privileges[roleKey] || [];
    let updatedPermissions: string[];
    if (rolePermissions.includes(permKey)) {
      updatedPermissions = rolePermissions.filter((p) => p !== permKey);
    } else {
      updatedPermissions = [...rolePermissions, permKey];
    }
    const updated = {
      ...privileges,
      [roleKey]: updatedPermissions,
    };
    setPrivileges(updated);
    localStorage.setItem("roles_permissions", JSON.stringify(updated));
    toast({ title: "Privilèges du rôle mis à jour !" });
  };

  // Users sorting/filtering
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.fullName, u.email, u.username, u.position, u.city]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = useMemo(
    () => filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredUsers, currentPage, pageSize]
  );

  const start = filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, filteredUsers.length);

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
      {/* En-tête de la page */}
      <div style={S.pageHeader}>
        <div>
          <h1 style={S.pageTitle}>Paramètres</h1>
          <p style={S.pageSubtitle}>Gérez votre compte, vos collaborateurs et les privilèges d'accès</p>
        </div>
        <div style={S.avatar}>{initials}</div>
      </div>

      {/* Système d'onglets premium */}
      <div style={S.tabsContainer}>
        <button 
          onClick={() => setActiveTab('profile')} 
          style={{ ...S.tabButton, ...(activeTab === 'profile' ? S.tabButtonActive : {}) }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserIcon size={16} />
            Mon Compte & Sécurité
          </div>
          {activeTab === 'profile' && <div style={S.tabIndicator} />}
        </button>
        <button 
          onClick={() => setActiveTab('users')} 
          style={{ ...S.tabButton, ...(activeTab === 'users' ? S.tabButtonActive : {}) }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={16} />
            Collaborateurs & Droits d'Accès
          </div>
          {activeTab === 'users' && <div style={S.tabIndicator} />}
        </button>
      </div>

      {/* Contenu de l'onglet 1 : Profil & Sécurité */}
      {activeTab === 'profile' && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
          {/* Informations personnelles */}
          <CardSection
            icon={<UserIcon size={16} />}
            title="Informations personnelles"
            description="Modifiez votre nom et vos coordonnées de profil"
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
                <Check size={14} />
                {savingProfile ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </CardSection>

          {/* Mot de passe */}
          <CardSection
            icon={<Lock size={16} />}
            title="Mot de passe"
            description="Choisissez un nouveau mot de passe sécurisé pour votre compte"
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
                  {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                <Check size={14} />
                {savingPassword ? "Modification..." : "Modifier le mot de passe"}
              </button>
            </div>
          </CardSection>

          {/* Déconnexion */}
          <div style={S.dangerCard}>
            <div>
              <p style={S.dangerTitle}>Se déconnecter de la session</p>
              <p style={S.dangerDesc}>Vous serez immédiatement déconnecté et redirigé vers la page de connexion</p>
            </div>
            <button
              onClick={handleLogout}
              style={S.btnDanger}
              onMouseEnter={e => (e.currentTarget.style.background = T.redBorder)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <LogOut size={16} />
              Déconnexion
            </button>
          </div>
        </div>
      )}

      {/* Contenu de l'onglet 2 : Collaborateurs & Privilèges */}
      {activeTab === 'users' && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }} className="animate-fade-in">
          {/* Section Gestion Collaborateurs */}
          <CardSection
            icon={<Users size={16} />}
            title="Gestion des Collaborateurs"
            description="Créez, modifiez, désactivez ou supprimez les comptes des collaborateurs de l'agence."
          >
            {/* Toolbar */}
            <div style={{ marginBottom: 16 }}>
              <UsersToolbar
                search={search}
                onSearch={(v) => { setSearch(v); setPage(1); }}
                pageSize={pageSize}
                onPageSize={(n) => { setPageSize(n); setPage(1); }}
                onAdd={() => { setEditing(null); setFormOpen(true); }}
              />
            </div>

            {/* Table */}
            <UsersTable 
              users={pagedUsers} 
              onEdit={(u) => { setEditing(u); setFormOpen(true); }} 
              onDelete={setToDelete} 
            />

            {/* Pagination */}
            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row border-t border-slate-100 pt-4">
              <p className="text-sm text-slate-500">
                Affichage de <span className="font-medium text-slate-800">{start}</span>{" "}
                à <span className="font-medium text-slate-800">{end}</span> sur{" "}
                <span className="font-medium text-slate-800">{filteredUsers.length}</span>{" "}
                collaborateurs
              </p>
              <div className="flex items-center gap-1">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <ChevronLeft size={14} />
                  Précédent
                </button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const isCurrent = n === currentPage;
                  return (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ minWidth: 32 }}
                    >
                      {n}
                    </button>
                  );
                })}
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Suivant
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </CardSection>

          {/* Section Grille des Droits & Privilèges */}
          <CardSection
            icon={<KeyRound size={16} />}
            title="Droits d'Accès & Privilèges par Rôle"
            description="Configurez de manière interactive et granulaire les autorisations pour chaque rôle d'utilisateur de l'agence."
          >
            <div style={{ overflowX: "auto" }} className="rounded-lg border border-slate-100">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: "#475569" }}>Autorisations & Modules</th>
                    {ROLES.map((r) => (
                      <th 
                        key={r.key} 
                        style={{ 
                          padding: "14px 16px", 
                          textAlign: "center", 
                          fontWeight: 600, 
                          color: "#1e293b",
                          minWidth: 100 
                        }}
                      >
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((p) => (
                    <tr 
                      key={p.key} 
                      className="border-b border-slate-100 hover:bg-slate-50/30 transition-colors"
                    >
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#334155" }}>
                        {p.label}
                      </td>
                      {ROLES.map((r) => {
                        const hasPerm = (privileges[r.key] || []).includes(p.key);
                        return (
                          <td key={r.key} style={{ padding: "12px 16px", textAlign: "center" }}>
                            <label className="relative inline-flex items-center cursor-pointer" style={{ userSelect: "none" }}>
                              <input 
                                type="checkbox"
                                checked={hasPerm}
                                onChange={() => togglePermission(r.key, p.key)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div 
              style={{ 
                marginTop: 16, 
                padding: 12, 
                backgroundColor: "#f0fdfa", 
                border: "1px solid #ccfbf1", 
                borderRadius: 8,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                fontSize: 12,
                color: "#115e59"
              }}
            >
              <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <span className="font-semibold">Note sur la sécurité : </span>
                Les modifications apportées aux rôles ci-dessus sont immédiatement propagées en local et enregistrées de manière persistante. 
                Les administrateurs possèdent par défaut l'ensemble des privilèges backoffice.
              </div>
            </div>
          </CardSection>

          {/* Dialogs */}
          <UserFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            initial={editing}
            onSubmit={editing ? handleUpdateUser : handleAddUser}
          />
          <DeleteUserDialog
            user={toDelete}
            onOpenChange={(o) => !o && setToDelete(null)}
            onConfirm={handleDeleteUser}
          />
        </div>
      )}
    </div>
  );
};

export default Parametres;