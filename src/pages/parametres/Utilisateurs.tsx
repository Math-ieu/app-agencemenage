/**
 * Utilisateurs.tsx
 * Page Paramètres > Collaborateurs & Privilèges — Design Pro
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthStore } from "../../store/auth";
import { checkPermission } from "../../utils/permissions";
import { getUsers, createUser, updateUser, deleteUser } from "../../api/client";

/* ─── Types ────────────────────────────────────────────────────────────────── */
type Status = "actif" | "desactive";

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  position: string;
  city: string;
  status: Status;
}

interface UserFormValues {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  position: string;
  city: string;
  status: Status;
  password?: string;
}

/* ─── Données & Config ─────────────────────────────────────────────────────── */
const PERMISSIONS = [
  { key: "consulter_clients",   label: "Clients : Consulter le listing",              group: "Clients" },
  { key: "creer_clients",       label: "Clients : Créer & éditer",                    group: "Clients" },
  { key: "blacklister_clients", label: "Clients : Blacklister & archiver",            group: "Clients" },
  { key: "consulter_demandes",  label: "Demandes : Consulter le listing",             group: "Demandes" },
  { key: "valider_demandes",    label: "Demandes : Valider & planifier (CAO)",        group: "Demandes" },
  { key: "annuler_demandes",    label: "Demandes : Annuler la facturation",           group: "Demandes" },
  { key: "voir_la_caisse",      label: "Finances : Consulter le solde de caisse",    group: "Finances" },
  { key: "mouvements_caisse",   label: "Finances : Saisir des entrées/sorties",      group: "Finances" },
  { key: "consulter_agents",    label: "Agents : Consulter les fiches",              group: "Agents" },
  { key: "creer_agents",        label: "Agents : Créer & éditer",                    group: "Agents" },
  { key: "documents_agents",    label: "Agents : Télécharger les pièces jointes",    group: "Agents" },
  { key: "rediger_blog",        label: "SEO & Blog : Rédiger & modifier les articles", group: "SEO & Blog" },
  { key: "parametres_globaux",  label: "Config : Gérer la sécurité & les accès",    group: "Configuration" },
];

const ROLES = [
  { key: "Admin",                      label: "Admin" },
  { key: "Moderateur",                 label: "Modérateur" },
  { key: "Responsable commercial",     label: "Resp. Commercial" },
  { key: "commercial",                 label: "Commercial" },
  { key: "Responsable des Opérations", label: "Resp. Opérations" },
  { key: "Chargée des Opérations",     label: "Chargée Opérations" },
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  "Admin":                      PERMISSIONS.map((p) => p.key),
  "Moderateur":                 ["consulter_clients","creer_clients","consulter_demandes","consulter_agents","rediger_blog"],
  "Responsable commercial":     ["consulter_clients","creer_clients","consulter_demandes","valider_demandes","consulter_agents"],
  "commercial":                 ["consulter_clients","creer_clients","consulter_demandes"],
  "Responsable des Opérations": ["consulter_clients","consulter_demandes","valider_demandes","voir_la_caisse","consulter_agents","creer_agents","documents_agents"],
  "Chargée des Opérations":     ["consulter_clients","consulter_demandes","consulter_agents"],
};



const CITIES = ["Casablanca","Rabat","Marrakech","Fès","Tanger","Agadir","Meknès","Oujda","Kénitra","Tétouan"];

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string): { bg: string; color: string } {
  const palette = [
    { bg: "#E1F5EE", color: "#085041" },
    { bg: "#E6F1FB", color: "#0C447C" },
    { bg: "#EEEDFE", color: "#3C3489" },
    { bg: "#FAEEDA", color: "#633806" },
    { bg: "#FBEAF0", color: "#72243E" },
    { bg: "#EAF3DE", color: "#27500A" },
  ];
  let h = 0;
  for (const c of name) h += c.charCodeAt(0);
  return palette[h % palette.length];
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", bottom: 32, right: 32, zIndex: 9999,
      background: "#0F6E56", color: "#9FE1CB",
      padding: "12px 20px", borderRadius: 10, fontSize: 15, fontWeight: 500,
      display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
      animation: "slideUp 0.2s ease",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      {message}
    </div>
  );
}

/* ─── Avatar ───────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const { bg, color } = getAvatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 500,
    }}>
      {getInitials(name)}
    </div>
  );
}

/* ─── Toggle Switch ────────────────────────────────────────────────────────── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
      <div style={{
        width: 44, height: 24, borderRadius: 24,
        background: checked ? "#0F6E56" : "#d1d5db",
        transition: "background 0.2s", position: "relative",
      }}>
        <div style={{
          position: "absolute", top: 3,
          left: checked ? 23 : 3,
          width: 18, height: 18, borderRadius: "50%",
          background: "#fff", transition: "left 0.2s",
        }} />
      </div>
    </label>
  );
}

/* ─── Status Badge ──────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: Status }) {
  const isActif = status === "actif";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
      background: isActif ? "#E1F5EE" : "#f4f4f5",
      color: isActif ? "#085041" : "#71717a",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: isActif ? "#0F6E56" : "#a1a1aa",
        display: "inline-block",
      }} />
      {isActif ? "Actif" : "Désactivé"}
    </span>
  );
}

/* ─── Role Badge ────────────────────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 20,
      fontSize: 12, fontWeight: 500,
      background: "#E6F1FB", color: "#0C447C",
    }}>
      {role}
    </span>
  );
}

/* ─── Card Section ──────────────────────────────────────────────────────────── */
function CardSection({ icon, title, description, children }: {
  icon: React.ReactNode; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#fff", border: "0.5px solid #e4e4e7",
      borderRadius: 12, overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "22px 30px 20px", borderBottom: "0.5px solid #f0f0f0",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "#f4f4f5", border: "0.5px solid #e4e4e7",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#71717a", flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#18181b" }}>{title}</p>
          <p style={{ fontSize: 14, color: "#a1a1aa", margin: "2px 0 0" }}>{description}</p>
        </div>
      </div>
      <div style={{ padding: "26px 30px" }}>{children}</div>
    </div>
  );
}

/* ─── Icon Button ──────────────────────────────────────────────────────────── */
function IconButton({ onClick, danger, title, children }: {
  onClick: () => void; danger?: boolean; title?: string; children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 36, height: 36, borderRadius: 8, cursor: "pointer",
        border: `0.5px solid ${hovered && danger ? "#F5C4B3" : "#e4e4e7"}`,
        background: hovered ? (danger ? "#FAECE7" : "#f4f4f5") : "transparent",
        color: hovered ? (danger ? "#993C1D" : "#18181b") : "#71717a",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

/* ─── Role Mapping Utilities ────────────────────────────────────────────────── */
const mapPositionToRole = (position: string): string => {
  const p = position.toLowerCase();
  if (p === 'admin') return 'admin';
  if (p === 'moderateur' || p === 'modérateur') return 'moderateur';
  if (p === 'responsable commercial' || p === 'responsable_commercial') return 'responsable_commercial';
  if (p === 'commercial') return 'commercial';
  if (p === 'responsable des opérations' || p === 'responsable_operations') return 'responsable_operations';
  if (p === 'chargée des opérations' || p === 'charge_operations') return 'charge_operations';
  return 'commercial';
};

const mapRoleToPosition = (role: string): string => {
  const r = role.toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'moderateur') return 'Moderateur';
  if (r === 'responsable_commercial') return 'Responsable commercial';
  if (r === 'commercial') return 'commercial';
  if (r === 'responsable_operations') return 'Responsable des Opérations';
  if (r === 'charge_operations') return 'Chargée des Opérations';
  return 'commercial';
};

const mapApiToLocalUser = (apiUser: any): User => {
  return {
    id: String(apiUser.id),
    fullName: apiUser.full_name || `${apiUser.first_name || ''} ${apiUser.last_name || ''}`.trim(),
    username: apiUser.email.split('@')[0],
    email: apiUser.email,
    phone: apiUser.phone || '',
    position: mapRoleToPosition(apiUser.role),
    city: apiUser.city || 'Casablanca',
    status: apiUser.is_active ? 'actif' : 'desactive',
  };
};

/* ─── User Form Dialog ──────────────────────────────────────────────────────── */
function UserFormDialog({ open, onClose, initial, onSubmit }: {
  open: boolean;
  onClose: () => void;
  initial: User | null;
  onSubmit: (values: UserFormValues) => void;
}) {
  const isEdit = !!initial;
  const blank: UserFormValues = { fullName: "", username: "", email: "", phone: "", position: ROLES[0].key, city: CITIES[0], status: "actif", password: "" };
  const [values, setValues] = useState<UserFormValues>(blank);
  const [errors, setErrors] = useState<Partial<UserFormValues>>({});

  useEffect(() => {
    if (open) {
      setValues(initial ? { fullName: initial.fullName, username: initial.username, email: initial.email, phone: initial.phone, position: initial.position, city: initial.city, status: initial.status, password: "" } : blank);
      setErrors({});
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (key: keyof UserFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const validate = () => {
    const e: Partial<UserFormValues> = {};
    if (!values.fullName.trim()) e.fullName = "Requis";
    if (!values.username.trim()) e.username = "Requis";
    if (!values.email.trim() || !values.email.includes("@")) e.email = "Email invalide";
    if (!values.phone.trim()) e.phone = "Requis";
    if (!isEdit && (!values.password || values.password.length < 8)) {
      e.password = "Le mot de passe doit contenir au moins 8 caractères";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onSubmit(values);
  };

  const inputStyle = (err?: string): React.CSSProperties => ({
    width: "100%", padding: "11px 13px", fontSize: 14.5,
    border: `0.5px solid ${err ? "#E24B4A" : "#e4e4e7"}`,
    borderRadius: 10, background: "#f9f9f9", color: "#18181b",
    outline: "none", fontFamily: "inherit",
  });

  const labelStyle: React.CSSProperties = { fontSize: 13.5, fontWeight: 500, color: "#71717a", marginBottom: 6, display: "block" };
  const errStyle: React.CSSProperties = { fontSize: 12, color: "#A32D2D", marginTop: 4 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 32,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16,
        border: "0.5px solid #e4e4e7", width: "100%", maxWidth: 620,
        overflow: "hidden",
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 28px 18px", borderBottom: "0.5px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {isEdit && initial && <Avatar name={initial.fullName} size={44} />}
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#18181b" }}>
                {isEdit ? `Modifier — ${initial?.fullName}` : "Ajouter un collaborateur"}
              </p>
              <p style={{ fontSize: 14, color: "#a1a1aa", margin: "2px 0 0" }}>
                {isEdit ? "Modifiez les informations du compte" : "Renseignez les informations du nouveau compte"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: "0.5px solid #e4e4e7", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Nom complet <span style={{ color: "#E24B4A" }}>*</span></label>
              <input style={inputStyle(errors.fullName)} value={values.fullName} onChange={set("fullName")} placeholder="Ex: Sofia El Amrani" />
              {errors.fullName && <p style={errStyle}>{errors.fullName}</p>}
            </div>
            <div>
              <label style={labelStyle}>Nom d'utilisateur <span style={{ color: "#E24B4A" }}>*</span></label>
              <input style={inputStyle(errors.username)} value={values.username} onChange={set("username")} placeholder="Ex: selamrani" />
              {errors.username && <p style={errStyle}>{errors.username}</p>}
            </div>
            <div>
              <label style={labelStyle}>Adresse e-mail <span style={{ color: "#E24B4A" }}>*</span></label>
              <input style={inputStyle(errors.email)} type="email" value={values.email} onChange={set("email")} placeholder="sofia@example.ma" />
              {errors.email && <p style={errStyle}>{errors.email}</p>}
            </div>
            <div>
              <label style={labelStyle}>Téléphone <span style={{ color: "#E24B4A" }}>*</span></label>
              <input style={inputStyle(errors.phone)} value={values.phone} onChange={set("phone")} placeholder="+212 6XX XX XX XX" />
              {errors.phone && <p style={errStyle}>{errors.phone}</p>}
            </div>
            <div>
              <label style={labelStyle}>Rôle</label>
              <select style={inputStyle()} value={values.position} onChange={set("position")}>
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ville</label>
              <select style={inputStyle()} value={values.city} onChange={set("city")}>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {!isEdit && (
              <div>
                <label style={labelStyle}>Mot de passe <span style={{ color: "#E24B4A" }}>*</span></label>
                <input
                  type="password"
                  style={inputStyle(errors.password)}
                  value={values.password || ""}
                  onChange={set("password")}
                  placeholder="Min. 8 caractères"
                />
                {errors.password && <p style={errStyle}>{errors.password}</p>}
              </div>
            )}
          </div>

          {/* Status toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "#f9f9f9", borderRadius: 10, border: "0.5px solid #e4e4e7" }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 500, margin: 0, color: "#18181b" }}>Compte actif</p>
              <p style={{ fontSize: 12.5, color: "#a1a1aa", margin: "2px 0 0" }}>Le collaborateur peut se connecter au backoffice</p>
            </div>
            <Toggle checked={values.status === "actif"} onChange={() => setValues((v) => ({ ...v, status: v.status === "actif" ? "desactive" : "actif" }))} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "18px 28px", borderTop: "0.5px solid #f0f0f0" }}>
          <button onClick={onClose} style={{ padding: "11px 22px", fontSize: 15, borderRadius: 10, border: "0.5px solid #e4e4e7", background: "transparent", color: "#71717a", cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={handleSubmit} style={{ padding: "11px 24px", fontSize: 15, fontWeight: 500, borderRadius: 10, border: "none", background: "#0F6E56", color: "#9FE1CB", cursor: "pointer" }}>
            {isEdit ? "Enregistrer les modifications" : "Créer le compte"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Delete Dialog ─────────────────────────────────────────────────────────── */
function DeleteDialog({ user, onClose, onConfirm }: { user: User | null; onClose: () => void; onConfirm: () => void }) {
  if (!user) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, border: "0.5px solid #e4e4e7", width: "100%", maxWidth: 460, padding: 32 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "#FCEBEB", border: "0.5px solid #F7C1C1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, color: "#A32D2D" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <p style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: "#18181b" }}>Supprimer ce collaborateur ?</p>
        <p style={{ fontSize: 14.5, color: "#71717a", margin: "0 0 24px", lineHeight: 1.6 }}>
          Le compte de <strong style={{ color: "#18181b" }}>{user.fullName}</strong> sera définitivement supprimé. Cette action est irréversible.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "11px 22px", fontSize: 15, borderRadius: 10, border: "0.5px solid #e4e4e7", background: "transparent", color: "#71717a", cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={onConfirm} style={{ padding: "11px 22px", fontSize: 15, fontWeight: 500, borderRadius: 10, border: "none", background: "#E24B4A", color: "#fff", cursor: "pointer" }}>
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Pagination ────────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, total, start, end, onChange }: {
  page: number; totalPages: number; total: number; start: number; end: number; onChange: (n: number) => void;
}) {
  const btnBase: React.CSSProperties = { width: 36, height: 36, borderRadius: 8, border: "0.5px solid #e4e4e7", background: "transparent", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 18, borderTop: "0.5px solid #f0f0f0", marginTop: 8 }}>
      <p style={{ fontSize: 14, color: "#71717a" }}>
        <strong style={{ color: "#18181b" }}>{start}</strong>–<strong style={{ color: "#18181b" }}>{end}</strong> sur{" "}
        <strong style={{ color: "#18181b" }}>{total}</strong> collaborateurs
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        <button style={{ ...btnBase, color: page <= 1 ? "#d1d5db" : "#71717a" }} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onChange(n)} style={{ ...btnBase, background: n === page ? "#0F6E56" : "transparent", color: n === page ? "#9FE1CB" : "#71717a", borderColor: n === page ? "#0F6E56" : "#e4e4e7", fontWeight: n === page ? 500 : 400 }}>
            {n}
          </button>
        ))}
        <button style={{ ...btnBase, color: page >= totalPages ? "#d1d5db" : "#71717a" }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function Utilisateurs() {
  const { user } = useAuthStore();
  const [users, setUsers]         = useState<User[]>([]);
  const [privileges, setPrivileges] = useState<Record<string, string[]>>({});
  const [search, setSearch]       = useState("");
  const [pageSize, setPageSize]   = useState(10);
  const [page, setPage]           = useState(1);
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<User | null>(null);
  const [toDelete, setToDelete]   = useState<User | null>(null);
  const [toast, setToast]         = useState<string | null>(null);

  const showToast = (msg: string) => setToast(msg);

  const fetchUsers = async () => {
    try {
      const response = await getUsers();
      const apiUsersList = response.data.results || response.data || [];
      const mapped = apiUsersList.map((apiUser: any) => mapApiToLocalUser(apiUser));
      setUsers(mapped);
    } catch (err) {
      console.error("Error fetching backend users:", err);
      showToast("Erreur lors de la récupération des collaborateurs.");
    }
  };

  useEffect(() => {
    fetchUsers();

    const savedPriv = localStorage.getItem("roles_permissions");
    setPrivileges(savedPriv ? JSON.parse(savedPriv) : DEFAULT_PERMISSIONS);
    if (!savedPriv) localStorage.setItem("roles_permissions", JSON.stringify(DEFAULT_PERMISSIONS));
  }, []);

  const handleAdd = async (values: UserFormValues) => {
    try {
      const parts = values.fullName.trim().split(' ');
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ') || '.';
      const apiPayload = {
        email: values.email,
        first_name,
        last_name,
        role: mapPositionToRole(values.position),
        password: values.password || '12345678',
      };
      
      await createUser(apiPayload);
      showToast("Collaborateur créé avec succès");
      setFormOpen(false);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.email?.[0] || err.response?.data?.detail || "Erreur lors de la création du compte";
      showToast(errMsg);
    }
  };

  const handleUpdate = async (values: UserFormValues) => {
    if (!editing) return;
    try {
      const parts = values.fullName.trim().split(' ');
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ') || '.';
      const apiPayload = {
        email: values.email,
        first_name,
        last_name,
        role: mapPositionToRole(values.position),
        is_active: values.status === 'actif',
      };
      
      await updateUser(editing.id, apiPayload);
      showToast("Collaborateur mis à jour avec succès");
      setFormOpen(false);
      setEditing(null);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || "Erreur lors de la mise à jour";
      showToast(errMsg);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteUser(toDelete.id);
      showToast("Collaborateur supprimé");
      setToDelete(null);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || "Erreur lors de la suppression";
      showToast(errMsg);
    }
  };

  const togglePermission = useCallback((roleKey: string, permKey: string) => {
    const isUserAdmin = user?.role?.toLowerCase() === 'admin';
    if (!isUserAdmin) {
      showToast("Action non autorisée. Seul le compte Admin est autorisé à modifier les privilèges.");
      return;
    }
    const perms = privileges[roleKey] || [];
    const updated = {
      ...privileges,
      [roleKey]: perms.includes(permKey) ? perms.filter((p) => p !== permKey) : [...perms, permKey],
    };
    setPrivileges(updated);
    localStorage.setItem("roles_permissions", JSON.stringify(updated));
    showToast("Privilèges mis à jour");
  }, [privileges, user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? users.filter((u) => [u.fullName, u.email, u.username, u.position, u.city].join(" ").toLowerCase().includes(q)) : users;
  }, [users, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const curPage     = Math.min(page, totalPages);
  const paged       = filtered.slice((curPage - 1) * pageSize, curPage * pageSize);
  const start       = filtered.length === 0 ? 0 : (curPage - 1) * pageSize + 1;
  const end         = Math.min(curPage * pageSize, filtered.length);

  // Group permissions by group
  const groupedPermissions = useMemo(() => {
    const groups: { group: string; perms: typeof PERMISSIONS }[] = [];
    let last = "";
    for (const p of PERMISSIONS) {
      if (p.group !== last) { groups.push({ group: p.group, perms: [] }); last = p.group; }
      groups[groups.length - 1].perms.push(p);
    }
    return groups;
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px 64px", display: "flex", flexDirection: "column", gap: 28, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: "#18181b" }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "-0.3px" }}>Collaborateurs & Privilèges</h1>
        <p style={{ fontSize: 15, color: "#71717a", margin: "6px 0 0" }}>Gérez les comptes d'utilisateurs et leurs droits d'accès au backoffice</p>
      </div>

      {/* ── Section Collaborateurs ── */}
      <CardSection
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
        title="Gestion des collaborateurs"
        description="Créez, modifiez, désactivez ou supprimez les comptes de l'agence"
      >
        {/* Toolbar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#a1a1aa", pointerEvents: "none" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher un collaborateur…"
              style={{ width: "100%", padding: "11px 12px 11px 40px", fontSize: 15, border: "0.5px solid #e4e4e7", borderRadius: 8, background: "#f9f9f9", color: "#18181b", outline: "none", fontFamily: "inherit" }}
            />
          </div>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            style={{ padding: "11px 14px", fontSize: 15, border: "0.5px solid #e4e4e7", borderRadius: 8, background: "#f9f9f9", color: "#18181b", outline: "none", cursor: "pointer" }}
          >
            {[5, 10, 20].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button
            onClick={() => {
              const perm = checkPermission(user, 'manage_users');
              if (!perm.allowed) {
                showToast(perm.message || 'Action non autorisée');
                return;
              }
              setEditing(null);
              setFormOpen(true);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", fontSize: 15, fontWeight: 500, background: "#0F6E56", color: "#9FE1CB", border: "none", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter
          </button>
        </div>

        {/* Table */}
        <div style={{ border: "0.5px solid #f0f0f0", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                {["Collaborateur", "Rôle", "Ville", "Statut", ""].map((h, i) => (
                  <th key={i} style={{ padding: "14px 18px", textAlign: i === 4 ? "right" : "left", fontSize: 13, fontWeight: 500, color: "#71717a", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#a1a1aa", fontSize: 15 }}>Aucun collaborateur trouvé</td></tr>
              ) : paged.map((u) => (
                <tr key={u.id} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                  <td style={{ padding: "15px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={u.fullName} />
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 15, color: "#18181b" }}>{u.fullName}</div>
                        <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 1 }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "15px 18px" }}><RoleBadge role={u.position} /></td>
                  <td style={{ padding: "15px 18px", fontSize: 14, color: "#71717a" }}>{u.city}</td>
                  <td style={{ padding: "15px 18px" }}><StatusBadge status={u.status} /></td>
                  <td style={{ padding: "15px 18px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <IconButton title="Modifier" onClick={() => {
                        const perm = checkPermission(user, 'manage_users');
                        const isUserAdmin = user?.role?.toLowerCase() === 'admin';
                        if (!perm.allowed || !isUserAdmin) {
                          showToast("Action non autorisée. Seul le compte Admin est autorisé à modifier les comptes utilisateurs.");
                          return;
                        }
                        setEditing(u);
                        setFormOpen(true);
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </IconButton>
                      <IconButton title="Supprimer" danger onClick={() => {
                        const perm = checkPermission(user, 'manage_users');
                        const isUserAdmin = user?.role?.toLowerCase() === 'admin';
                        if (!perm.allowed || !isUserAdmin) {
                          showToast("Action non autorisée. Seul le compte Admin est autorisé à supprimer les comptes utilisateurs.");
                          return;
                        }
                        setToDelete(u);
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={curPage} totalPages={totalPages} total={filtered.length} start={start} end={end} onChange={setPage} />
      </CardSection>

      {/* ── Section Privilèges ── */}
      <CardSection
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
        title="Droits d'accès & Privilèges par rôle"
        description="Configurez les autorisations pour chaque rôle de l'agence"
      >
        <div style={{ overflowX: "auto", border: "0.5px solid #f0f0f0", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "0.5px solid #f0f0f0" }}>
                <th style={{ padding: "14px 18px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#71717a", minWidth: 260 }}>Module & autorisation</th>
                {ROLES.map((r) => (
                  <th key={r.key} style={{ padding: "14px 16px", textAlign: "center", fontSize: 13, fontWeight: 500, color: "#18181b", minWidth: 120, whiteSpace: "nowrap" }}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedPermissions.map(({ group, perms }) => (
                <React.Fragment key={group}>
                  <tr style={{ background: "#fafafa" }}>
                    <td colSpan={ROLES.length + 1} style={{ padding: "11px 18px", fontSize: 13, fontWeight: 500, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "0.5px solid #f0f0f0", borderTop: "0.5px solid #f0f0f0" }}>
                      {group}
                    </td>
                  </tr>
                  {perms.map((p) => (
                    <tr key={p.key} style={{ borderBottom: "0.5px solid #f5f5f5" }}>
                      <td style={{ padding: "14px 18px", fontSize: 14, color: "#334155" }}>{p.label}</td>
                      {ROLES.map((r) => (
                        <td key={r.key} style={{ padding: "14px 16px", textAlign: "center" }}>
                          <Toggle checked={(privileges[r.key] || []).includes(p.key)} onChange={() => togglePermission(r.key, p.key)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Info banner */}
        <div style={{ marginTop: 20, padding: "14px 18px", background: "#E1F5EE", borderLeft: "3px solid #0F6E56", borderRadius: "0 8px 8px 0", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "#085041" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span><strong>Sécurité :</strong> Les modifications sont enregistrées immédiatement et de manière persistante. Les administrateurs disposent de l'ensemble des privilèges par défaut.</span>
        </div>
      </CardSection>

      {/* Dialogs */}
      <UserFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} initial={editing} onSubmit={editing ? handleUpdate : handleAdd} />
      <DeleteDialog user={toDelete} onClose={() => setToDelete(null)} onConfirm={handleDelete} />

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}