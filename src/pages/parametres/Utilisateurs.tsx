/**
 * Utilisateurs.tsx
 * Page Paramètres > Collaborateurs & Privilèges — Design Pro
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthStore } from "../../store/auth";
import { checkPermission } from "../../utils/permissions";
import { getUsers, createUser, updateUser, deleteUser, getRolesPermissions, updateRolesPermissions } from "../../api/client";
import { Eye, EyeOff, Search, ChevronDown, ChevronRight, Check, Plus, Copy, Lock } from "lucide-react";

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
  // Tableau de bord
  { key: "consulter_dashboard", label: "Accéder / consulter au tableau de bord", group: "Tableau de bord" },
  { key: "consulter_compte_client_dashboard", label: "Consulter le compte client", group: "Tableau de bord" },
  { key: "editer_besoin", label: "Éditer le besoin (formulaire de la demande)", group: "Tableau de bord" },
  { key: "editer_besoin_agence", label: "Éditer le besoin (espace agence)", group: "Tableau de bord" },
  { key: "confirmation_avant_operation", label: "Confirmation avant opération", group: "Tableau de bord" },
  { key: "supprimer_demande_dashboard", label: "Supprimer une demande", group: "Tableau de bord" },
  { key: "facturation_annulee", label: "Facturation annulée", group: "Tableau de bord" },
  { key: "annulation_demande", label: "Annulation de la demande", group: "Tableau de bord" },
  { key: "note_operationnelle_dashboard", label: "Note opérationnelle", group: "Tableau de bord" },
  { key: "note_commerciale_dashboard", label: "Note commercial", group: "Tableau de bord" },
  { key: "assigner_charge_operation", label: "Assigner à un chargé opération", group: "Tableau de bord" },
  { key: "application_taux_horaire_standard", label: "Application de taux horaire standard", group: "Tableau de bord" },
  { key: "taux_horaire_exceptionnel", label: "Taux horaire exceptionnel", group: "Tableau de bord" },
  { key: "taux_forfaitaire", label: "Taux forfaitaire", group: "Tableau de bord" },

  // Demandes en attente
  { key: "creer_demande", label: "Créer une nouvelle demande", group: "Demandes en attente" },
  { key: "creer_devis", label: "Créer un devis", group: "Demandes en attente" },
  { key: "modifier_demande", label: "Modifier une demande", group: "Demandes en attente" },
  { key: "consulter_demandes", label: "Consulter les demandes en attente", group: "Demandes en attente" },
  { key: "affecter_commercial", label: "Assigner à un commercial", group: "Demandes en attente" },
  { key: "traiter_demandes_affectees", label: "Traiter les demandes affectées", group: "Demandes en attente" },
  { key: "creer_valider_demande", label: "Créer et valider une demande", group: "Demandes en attente" },
  { key: "refuser_demande", label: "Refuser / annuler une demande", group: "Demandes en attente" },

  // Listing profils
  { key: "consulter_agents", label: "Consulter le listing des profils (agents)", group: "Listing profils" },
  { key: "consulter_docs_confidentiels", label: "Ouvrir la fiche profil & pièces jointes", group: "Listing profils" },
  { key: "creer_agents", label: "Créer un nouveau profil", group: "Listing profils" },
  { key: "modifier_agents", label: "Modifier / mettre à jour un profil", group: "Listing profils" },
  { key: "desactiver_profil", label: "Désactiver / archiver un profil", group: "Listing profils" },
  { key: "blacklister_agents", label: "Blacklister un profil", group: "Listing profils" },
  { key: "supprimer_profil", label: "Supprimer un profil", group: "Listing profils" },

  // Listing clients
  { key: "consulter_clients", label: "Consulter le listing clients", group: "Listing clients" },
  { key: "consulter_compte_client", label: "Consulter compte client", group: "Listing clients" },
  { key: "affectation_client", label: "Affectation client", group: "Listing clients" },
  { key: "note_operationnelle", label: "Note opérationnel", group: "Listing clients" },
  { key: "note_commerciale", label: "Note commercial", group: "Listing clients" },
  { key: "geste_commercial", label: "Geste commercial", group: "Listing clients" },
  { key: "modifier_clients", label: "Editer compte client", group: "Listing clients" },
  { key: "blacklister_clients", label: "Blacklister / archiver un client", group: "Listing clients" },
  { key: "delete_client", label: "Supprimer définitivement", group: "Listing clients" },

  // Historique
  { key: "consulter_historique_global", label: "Consulter l'historique des interventions", group: "Historique" },
  { key: "filtrer_historique", label: "Filtrer & rechercher dans l'historique", group: "Historique" },
  { key: "exporter_historique_csv", label: "Exporter l'historique", group: "Historique" },

  // Vue globale
  { key: "voir_la_caisse", label: "Consulter la vue financière globale", group: "Gestion financière — Vue globale", subgroup: "VUE GLOBALE" },
  { key: "consulter_debit", label: "Consulter (profil doit à l'agence)", group: "Gestion financière — Vue globale", subgroup: "DÉBIT" },
  { key: "valider_paiement_debit", label: "Valider le paiement", group: "Gestion financière — Vue globale", subgroup: "DÉBIT" },
  { key: "filtrer_debit", label: "Filtrer", group: "Gestion financière — Vue globale", subgroup: "DÉBIT" },
  { key: "consulter_credit", label: "Consulter (agence doit au profil)", group: "Gestion financière — Vue globale", subgroup: "CRÉDIT" },
  { key: "valider_paiement_credit", label: "Valider le paiement", group: "Gestion financière — Vue globale", subgroup: "CRÉDIT" },
  { key: "filtrer_credit", label: "Filtrer", group: "Gestion financière — Vue globale", subgroup: "CRÉDIT" },
  { key: "consulter_factures", label: "Consulter les factures", group: "Gestion financière — Vue globale", subgroup: "SUIVI FACTURATION" },
  { key: "exporter_pdf_excel_facture", label: "Exporter en PDF ou Excel", group: "Gestion financière — Vue globale", subgroup: "SUIVI FACTURATION" },
  { key: "editer_facture", label: "Éditer facture", group: "Gestion financière — Vue globale", subgroup: "SUIVI FACTURATION" },
  { key: "modifier_facture", label: "Modifier", group: "Gestion financière — Vue globale", subgroup: "SUIVI FACTURATION" },
  { key: "editer_besoin_facture", label: "Éditer le besoin", group: "Gestion financière — Vue globale", subgroup: "SUIVI FACTURATION" },
  { key: "generer_facture", label: "Générer facture", group: "Gestion financière — Vue globale", subgroup: "SUIVI FACTURATION" },
  { key: "envoi_facture_client", label: "Envoi de facture au client", group: "Gestion financière — Vue globale", subgroup: "SUIVI FACTURATION" },
  { key: "consulter_comptes_profil", label: "Consulter les comptes profil", group: "Gestion financière — Vue globale", subgroup: "COMPTE PROFIL" },

  // La caisse
  { key: "consulter_solde_caisse", label: "Consulter le solde de caisse", group: "Gestion financière — La caisse" },
  { key: "mouvements_caisse", label: "Encaisser un paiement client", group: "Gestion financière — La caisse" },
  { key: "sorties_caisse", label: "Saisir une sortie / dépense", group: "Gestion financière — La caisse" },
  { key: "cloturer_caisse_journaliere", label: "Clôturer la caisse journalière", group: "Gestion financière — La caisse" },

  // Gestion financière — Suivis (Nouveaux)
  { key: "consulter_dus_agences_profils", label: "Consultation (Suivi des dus agences / profils)", group: "Gestion financière — Suivis", subgroup: "Suivi des dus agences / profils" },
  { key: "validation_paiements_dus", label: "Validation des paiements", group: "Gestion financière — Suivis", subgroup: "Suivi des dus agences / profils" },
  { key: "consulter_suivi_commerciaux", label: "Consultation (Suivi des commerciaux)", group: "Gestion financière — Suivis", subgroup: "Suivi des commerciaux" },
  { key: "filtrer_suivi_commerciaux", label: "Filtrer", group: "Gestion financière — Suivis", subgroup: "Suivi des commerciaux" },

  // Gestion financière — Trésorerie & Caisse (Nouveaux)
  { key: "consulter_tresorerie", label: "Consultation (Trésorerie)", group: "Gestion financière — Trésorerie & Caisse", subgroup: "Trésorerie" },
  { key: "creer_mouvements_tresorerie", label: "Création des mouvements", group: "Gestion financière — Trésorerie & Caisse", subgroup: "Trésorerie" },
  { key: "filtrer_tresorerie", label: "Filtrer", group: "Gestion financière — Trésorerie & Caisse", subgroup: "Trésorerie" },

  // Marketing
  { key: "consulter_marketing", label: "Consulter toutes les pages", group: "Marketing" },
  { key: "creer_code_promo", label: "Créer un code promo", group: "Marketing" },
  { key: "creer_geste_commercial", label: "Créer un geste commercial", group: "Marketing" },
  { key: "creer_campagne", label: "Créer une campagne", group: "Marketing" },

  // Qualité
  { key: "consulter_retours_qualite", label: "Consulter les avis & feedbacks clients", group: "Qualité & Feedback" },
  { key: "repondre_avis_clients", label: "Répondre aux avis clients", group: "Qualité & Feedback" },
  { key: "moderer_masquer_avis", label: "Modérer / masquer un avis", group: "Qualité & Feedback" },
  { key: "generer_rapports_qualite", label: "Générer les rapports qualité", group: "Qualité & Feedback" },

  // SEO - Blog
  { key: "rediger_blog", label: "Consulter les articles du blog", group: "SEO — Blog" },
  { key: "modifier_articles_blog", label: "Rédiger & modifier les articles", group: "SEO — Blog" },
  { key: "publier_articles_blog", label: "Publier / dépublier un article", group: "SEO — Blog" },

  // Paramètres - Mon profil
  { key: "consulter_infos_profil", label: "Consulter mon profil", group: "Paramètres — Mon profil" },
  { key: "modifier_infos_profil", label: "Modifier mes informations", group: "Paramètres — Mon profil" },
  { key: "modifier_mot_de_passe", label: "Changer mon mot de passe", group: "Paramètres — Mon profil" },
  { key: "activer_mfa", label: "Activer la double authentification", group: "Paramètres — Mon profil" },

  // Paramètres - Utilisateurs & Rôles
  { key: "consulter_utilisateurs", label: "Consulter les utilisateurs back-office", group: "Paramètres — Utilisateurs & Rôles" },
  { key: "creer_utilisateurs", label: "Inviter / créer un utilisateur", group: "Paramètres — Utilisateurs & Rôles" },
  { key: "parametres_globaux", label: "Gérer les rôles & permissions", group: "Paramètres — Utilisateurs & Rôles" },
  { key: "activer_desactiver_utilisateurs", label: "Désactiver / réinitialiser un compte", group: "Paramètres — Utilisateurs & Rôles" }
];

const ROLES = [
  { key: "Admin", label: "Admin" },
  { key: "Moderateur", label: "Modérateur" },
  { key: "Responsable commercial", label: "Resp. Commercial" },
  { key: "commercial", label: "Commercial" },
  { key: "Responsable des Opérations", label: "Resp. Opérations" },
  { key: "Chargée des Opérations", label: "Chargée Opérations" },
  { key: "Opérationnel", label: "Opérationnel" },
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  "Admin": PERMISSIONS.map((p) => p.key),
  "Moderateur": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "editer_besoin_agence", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "assigner_charge_operation", "application_taux_horaire_standard", "taux_horaire_exceptionnel", "taux_forfaitaire",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "traiter_demandes_affectees", "creer_valider_demande", "refuser_demande",
    // Listing profils
    "consulter_agents", "consulter_docs_confidentiels", "creer_agents", "modifier_agents", "desactiver_profil", "blacklister_agents", "supprimer_profil",
    // Listing clients
    "consulter_clients", "consulter_compte_client", "affectation_client", "note_operationnelle", "note_commerciale", "geste_commercial", "modifier_clients", "blacklister_clients", "delete_client",
    // Historique
    "consulter_historique_global", "filtrer_historique", "exporter_historique_csv",
    // Vue globale
    "voir_la_caisse", "consulter_debit", "valider_paiement_debit", "filtrer_debit", "consulter_credit", "valider_paiement_credit", "filtrer_credit", "consulter_factures", "exporter_pdf_excel_facture", "editer_facture", "modifier_facture", "editer_besoin_facture", "generer_facture", "envoi_facture_client", "consulter_comptes_profil",
    // La caisse
    "consulter_solde_caisse", "mouvements_caisse", "sorties_caisse", "cloturer_caisse_journaliere",
    // Gestion financière — Suivis (Nouveaux)
    "consulter_dus_agences_profils", "validation_paiements_dus", "consulter_suivi_commerciaux", "filtrer_suivi_commerciaux",
    // Gestion financière — Trésorerie & Caisse (Nouveaux)
    "consulter_tresorerie", "creer_mouvements_tresorerie", "filtrer_tresorerie",
    // Marketing
    "consulter_marketing", "creer_code_promo", "creer_geste_commercial", "creer_campagne",
    // Qualité
    "consulter_retours_qualite", "repondre_avis_clients", "moderer_masquer_avis", "generer_rapports_qualite",
    // SEO - Blog
    "rediger_blog", "modifier_articles_blog", "publier_articles_blog",
    // Paramètres - Mon profil
    "consulter_infos_profil", "modifier_infos_profil", "modifier_mot_de_passe", "activer_mfa",
    // Paramètres - Utilisateurs & Rôles
    "consulter_utilisateurs", "creer_utilisateurs", "parametres_globaux", "activer_desactiver_utilisateurs"
  ],
  "Responsable commercial": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "editer_besoin_agence", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "application_taux_horaire_standard", "taux_horaire_exceptionnel", "taux_forfaitaire",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "traiter_demandes_affectees", "creer_valider_demande", "refuser_demande",
    // Listing profils
    "consulter_agents",
    // Listing clients
    "consulter_clients", "consulter_compte_client", "affectation_client", "note_operationnelle", "note_commerciale", "geste_commercial", "modifier_clients", "blacklister_clients",
    // Historique
    "consulter_historique_global", "filtrer_historique", "exporter_historique_csv",
    // Vue globale
    "voir_la_caisse", "consulter_debit", "valider_paiement_debit", "filtrer_debit", "consulter_credit", "valider_paiement_credit", "filtrer_credit", "consulter_factures", "exporter_pdf_excel_facture", "editer_facture", "modifier_facture", "editer_besoin_facture", "generer_facture", "envoi_facture_client", "consulter_comptes_profil",
    // La caisse
    "consulter_solde_caisse", "mouvements_caisse", "sorties_caisse", "cloturer_caisse_journaliere",
    // Gestion financière — Suivis (Nouveaux)
    "consulter_dus_agences_profils", "validation_paiements_dus", "consulter_suivi_commerciaux", "filtrer_suivi_commerciaux",
    // Gestion financière — Trésorerie & Caisse (Nouveaux)
    "consulter_tresorerie", "creer_mouvements_tresorerie", "filtrer_tresorerie",
    // Marketing
    "consulter_marketing", "creer_code_promo", "creer_geste_commercial", "creer_campagne",
    // Qualité
    "consulter_retours_qualite", "repondre_avis_clients",
    // SEO
    "rediger_blog",
    // Paramètres - Mon profil
    "consulter_infos_profil", "modifier_infos_profil", "modifier_mot_de_passe", "activer_mfa"
  ],
  "commercial": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "editer_besoin_agence", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "traiter_demandes_affectees", "creer_valider_demande", "refuser_demande",
    // Listing profils
    "consulter_agents", "consulter_docs_confidentiels", "creer_agents", "modifier_agents", "desactiver_profil", "blacklister_agents", "supprimer_profil",
    // Listing clients
    "consulter_clients", "consulter_compte_client", "affectation_client", "note_operationnelle", "note_commerciale", "geste_commercial", "modifier_clients", "blacklister_clients", "delete_client",
    // Historique
    "consulter_historique_global", "filtrer_historique", "exporter_historique_csv",
    // Vue globale
    "consulter_factures", "editer_besoin_facture",
    // La caisse
    "mouvements_caisse",
    // Gestion financière — Trésorerie & Caisse (Nouveaux)
    "creer_mouvements_tresorerie",
    // Marketing
    "consulter_marketing",
    // Qualité
    "consulter_retours_qualite",
    // Paramètres - Mon profil
    "consulter_infos_profil", "modifier_infos_profil", "modifier_mot_de_passe", "activer_mfa"
  ],
  "Responsable des Opérations": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "editer_besoin_agence", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "assigner_charge_operation", "application_taux_horaire_standard",
    // Demandes en attente
    "creer_demande", "consulter_demandes", "traiter_demandes_affectees", "creer_valider_demande",
    // Listing profils
    "consulter_agents", "consulter_docs_confidentiels", "creer_agents", "modifier_agents", "desactiver_profil", "blacklister_agents",
    // Listing clients
    "consulter_clients", "consulter_compte_client", "note_operationnelle",
    // Historique
    "consulter_historique_global", "filtrer_historique", "exporter_historique_csv",
    // Vue globale
    "voir_la_caisse", "consulter_debit", "filtrer_debit", "consulter_credit", "valider_paiement_credit", "filtrer_credit", "consulter_factures", "consulter_comptes_profil",
    // La caisse
    "consulter_solde_caisse", "sorties_caisse",
    // Gestion financière — Suivis (Nouveaux)
    "consulter_dus_agences_profils", "validation_paiements_dus", "consulter_suivi_commerciaux", "filtrer_suivi_commerciaux",
    // Gestion financière — Trésorerie & Caisse (Nouveaux)
    "consulter_tresorerie", "creer_mouvements_tresorerie", "filtrer_tresorerie",
    // Marketing
    "consulter_marketing",
    // Qualité
    "consulter_retours_qualite", "generer_rapports_qualite",
    // Paramètres - Mon profil
    "consulter_infos_profil", "modifier_infos_profil", "modifier_mot_de_passe", "activer_mfa"
  ],
  "Chargée des Opérations": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "editer_besoin_agence", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard",
    // Demandes en attente
    "creer_demande", "consulter_demandes",
    // Listing profils
    "consulter_agents", "consulter_docs_confidentiels",
    // Listing clients
    "consulter_clients", "consulter_compte_client", "note_operationnelle",
    // Historique
    "consulter_historique_global", "filtrer_historique",
    // Vue globale
    "consulter_comptes_profil",
    // Marketing
    "consulter_marketing",
    // Qualité
    "consulter_retours_qualite",
    // Paramètres - Mon profil
    "consulter_infos_profil", "modifier_infos_profil", "modifier_mot_de_passe", "activer_mfa"
  ],
  "Opérationnel": [
    "consulter_dashboard",
    "consulter_demandes"
  ]
};



const CITIES = ["Casablanca", "Rabat", "Salé", "Temara", "Ain Aouda", "El Harhoura", "Marrakech", "Fès", "Tanger", "Agadir", "Meknès", "Oujda", "Kénitra", "Tétouan"];

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
        <polyline points="20 6 9 17 4 12" />
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

function Toggle({ checked, onChange, tooltip }: { checked: boolean; onChange: () => void; tooltip?: string }) {
  return (
    <label className="toggle-container" style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
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
      {tooltip && (
        <div className="toggle-tooltip" style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%) translateY(4px)",
          background: "#0F6E56",
          color: "#ffffff",
          padding: "5px 10px",
          borderRadius: "6px",
          fontSize: "11.5px",
          fontWeight: 600,
          whiteSpace: "nowrap",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 0.12s ease, transform 0.12s ease",
          zIndex: 100,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}>
          {tooltip}
          <div style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid #0F6E56",
          }} />
        </div>
      )}
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
  if (p === 'opérationnel' || p === 'operationnel') return 'operationnel';
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
  if (r === 'operationnel') return 'Opérationnel';
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
const generateUsernameFromEmail = (email: string): string => {
  const base = email.split('@')[0] || "";
  return base.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
};

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
  const [showPassword, setShowPassword] = useState(false);
  const [eyeHovered, setEyeHovered] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(initial ? { fullName: initial.fullName, username: initial.username, email: initial.email, phone: initial.phone, position: initial.position, city: initial.city, status: initial.status, password: "" } : blank);
      setErrors({});
      setShowPassword(false);
      setEyeHovered(false);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (key: keyof UserFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setValues((v) => {
      const username = isEdit ? v.username : generateUsernameFromEmail(email);
      return { ...v, email, username };
    });
    if (errors.email || errors.username) {
      setErrors((prev) => ({ ...prev, email: undefined, username: undefined }));
    }
  };

  const validate = () => {
    const e: Partial<UserFormValues> = {};
    if (!values.fullName.trim()) {
      e.fullName = "Le nom complet est requis";
    }

    if (!values.username.trim()) {
      e.username = "Le nom d'utilisateur est requis";
    }

    const emailTrimmed = values.email.trim();
    if (!emailTrimmed) {
      e.email = "L'adresse e-mail est requise";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      e.email = "L'adresse e-mail n'est pas valide (ex: nom@domaine.ma)";
    }

    const phoneTrimmed = values.phone.trim();
    if (!phoneTrimmed) {
      e.phone = "Le numéro de téléphone est requis";
    } else if (!/^\+?[0-9\s\-()]{8,20}$/.test(phoneTrimmed)) {
      e.phone = "Le numéro de téléphone n'est pas valide (ex: +212 6XXXXXXXX)";
    }

    if (!isEdit) {
      const pwd = values.password || "";
      const hasMinLength = pwd.length >= 8;
      const hasNumber = /[0-9]/.test(pwd);
      const hasUppercase = /[A-Z]/.test(pwd);

      if (!pwd) {
        e.password = "Le mot de passe est requis";
      } else if (!hasMinLength || !hasNumber || !hasUppercase) {
        e.password = "Le mot de passe doit contenir au moins 8 caractères, incluant au moins un chiffre et une lettre majuscule.";
      }
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
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        style={{
          background: "#fff", borderRadius: 16,
          border: "0.5px solid #e4e4e7", width: "100%", maxWidth: 620,
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >

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
          <button type="button" onClick={onClose} style={{ width: 34, height: 34, borderRadius: 8, border: "0.5px solid #e4e4e7", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Nom complet <span style={{ color: "#E24B4A" }}>*</span></label>
              <input
                autoComplete="name"
                style={inputStyle(errors.fullName)}
                value={values.fullName}
                onChange={set("fullName")}
                placeholder="Ex: Sofia El Amrani"
              />
              {errors.fullName && <p style={errStyle}>{errors.fullName}</p>}
            </div>
            <div>
              <label style={labelStyle}>Nom d'utilisateur <span style={{ color: "#E24B4A" }}>*</span></label>
              <input
                autoComplete="username"
                style={{ ...inputStyle(errors.username), opacity: 0.65, cursor: "not-allowed" }}
                value={values.username}
                disabled={true}
                placeholder="Généré automatiquement"
              />
              {errors.username && <p style={errStyle}>{errors.username}</p>}
            </div>
            <div>
              <label style={labelStyle}>Adresse e-mail <span style={{ color: "#E24B4A" }}>*</span></label>
              <input
                type="email"
                autoComplete="email"
                style={inputStyle(errors.email)}
                value={values.email}
                onChange={handleEmailChange}
                placeholder="sofia@example.ma"
              />
              {errors.email && <p style={errStyle}>{errors.email}</p>}
            </div>
            <div>
              <label style={labelStyle}>Téléphone <span style={{ color: "#E24B4A" }}>*</span></label>
              <input
                type="tel"
                autoComplete="tel"
                style={inputStyle(errors.phone)}
                value={values.phone}
                onChange={set("phone")}
                placeholder="+212 6XX XX XX XX"
              />
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
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    style={{ ...inputStyle(errors.password), paddingRight: 40 }}
                    value={values.password || ""}
                    onChange={set("password")}
                    placeholder="Min. 8 caractères"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseEnter={() => setEyeHovered(true)}
                    onMouseLeave={() => setEyeHovered(false)}
                    style={{
                      position: "absolute",
                      right: 12,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: eyeHovered ? "#18181b" : "#71717a",
                      transition: "color 0.15s ease",
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
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
          <button type="button" onClick={onClose} style={{ padding: "11px 22px", fontSize: 15, borderRadius: 10, border: "0.5px solid #e4e4e7", background: "transparent", color: "#71717a", cursor: "pointer" }}>
            Annuler
          </button>
          <button type="submit" style={{ padding: "11px 24px", fontSize: 15, fontWeight: 500, borderRadius: 10, border: "none", background: "#0F6E56", color: "#9FE1CB", cursor: "pointer" }}>
            {isEdit ? "Enregistrer les modifications" : "Créer le compte"}
          </button>
        </div>
      </form>
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
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button key={n} onClick={() => onChange(n)} style={{ ...btnBase, background: n === page ? "#0F6E56" : "transparent", color: n === page ? "#9FE1CB" : "#71717a", borderColor: n === page ? "#0F6E56" : "#e4e4e7", fontWeight: n === page ? 500 : 400 }}>
            {n}
          </button>
        ))}
        <button style={{ ...btnBase, color: page >= totalPages ? "#d1d5db" : "#71717a" }} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function Utilisateurs() {
  const { user } = useAuthStore();
  const isSystemAdmin = user?.role?.toLowerCase() === 'admin' || checkPermission(user, 'manage_users').allowed;
  const [activeTab, setActiveTab] = useState<'users' | 'rights'>('users');

  // Collaborateurs (Users) State
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toDelete, setToDelete] = useState<User | null>(null);

  // Droits d'accès (Permissions) State
  const [privileges, setPrivileges] = useState<Record<string, string[]>>({});
  const [draftPrivileges, setDraftPrivileges] = useState<Record<string, string[]>>({});
  const [privilegeSearch, setPrivilegeSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Popover State
  const [activeRolePopover, setActiveRolePopover] = useState<string | null>(null);
  const [activeRowPopover, setActiveRowPopover] = useState<string | null>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (activeRolePopover && !target.closest('.role-popover-wrapper')) {
        setActiveRolePopover(null);
      }
      if (activeRowPopover && !target.closest('.row-popover-wrapper')) {
        setActiveRowPopover(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeRolePopover, activeRowPopover]);

  const [toast, setToast] = useState<string | null>(null);
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

    getRolesPermissions()
      .then((res) => {
        const matrix = res.data;
        if (matrix && Object.keys(matrix).length > 0) {
          setPrivileges(matrix);
          setDraftPrivileges(JSON.parse(JSON.stringify(matrix)));
          localStorage.setItem("roles_permissions", JSON.stringify(matrix));
        } else {
          const savedPriv = localStorage.getItem("roles_permissions");
          const fallback = savedPriv ? JSON.parse(savedPriv) : DEFAULT_PERMISSIONS;
          setPrivileges(fallback);
          setDraftPrivileges(JSON.parse(JSON.stringify(fallback)));
        }
      })
      .catch((err) => {
        console.error("Failed to fetch roles permissions from API:", err);
        const savedPriv = localStorage.getItem("roles_permissions");
        const fallback = savedPriv ? JSON.parse(savedPriv) : DEFAULT_PERMISSIONS;
        setPrivileges(fallback);
        setDraftPrivileges(JSON.parse(JSON.stringify(fallback)));
      });
  }, []);

  const handleAdd = async (values: UserFormValues) => {
    try {
      const parts = values.fullName.trim().split(' ');
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ') || '';
      const apiPayload = {
        email: values.email,
        first_name,
        last_name,
        role: mapPositionToRole(values.position),
        password: values.password || '12345678',
        phone: values.phone || '',
        city: values.city || 'Casablanca',
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
      const last_name = parts.slice(1).join(' ') || '';
      const apiPayload = {
        email: values.email,
        first_name,
        last_name,
        role: mapPositionToRole(values.position),
        is_active: values.status === 'actif',
        phone: values.phone || '',
        city: values.city || 'Casablanca',
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

  // Toggle single permission check in the draft state
  const handleTogglePermission = useCallback((roleKey: string, permKey: string) => {
    const isUserAdmin = user?.role?.toLowerCase() === 'admin';
    if (!isUserAdmin) {
      showToast("Action non autorisée. Seul le compte Admin est autorisé à modifier les privilèges.");
      return;
    }
    setDraftPrivileges((prev) => {
      const rolePerms = prev[roleKey] || [];
      const updated = rolePerms.includes(permKey)
        ? rolePerms.filter((k) => k !== permKey)
        : [...rolePerms, permKey];
      return { ...prev, [roleKey]: updated };
    });
  }, [user]);

  // Bulk column activations
  const handleBulkActivateRole = useCallback((roleKey: string) => {
    setDraftPrivileges((prev) => ({
      ...prev,
      [roleKey]: PERMISSIONS.map((p) => p.key),
    }));
    setActiveRolePopover(null);
    showToast(`Toutes les autorisations activées pour le rôle ${roleKey}`);
  }, []);

  const handleBulkDeactivateRole = useCallback((roleKey: string) => {
    setDraftPrivileges((prev) => ({
      ...prev,
      [roleKey]: [],
    }));
    setActiveRolePopover(null);
    showToast(`Toutes les autorisations désactivées pour le rôle ${roleKey}`);
  }, []);

  const handleCopyRolePermissions = useCallback((sourceRoleKey: string, targetRoleKey: string) => {
    setDraftPrivileges((prev) => ({
      ...prev,
      [targetRoleKey]: [...(prev[sourceRoleKey] || [])],
    }));
    setActiveRolePopover(null);
    showToast(`Autorisations copiées de ${sourceRoleKey} vers ${targetRoleKey}`);
  }, []);

  // Bulk row activations
  const handleBulkActivatePermission = useCallback((permKey: string) => {
    setDraftPrivileges((prev) => {
      const next = { ...prev };
      CONFIGURABLE_ROLES.forEach((r) => {
        const perms = next[r.key] || [];
        if (!perms.includes(permKey)) {
          next[r.key] = [...perms, permKey];
        }
      });
      return next;
    });
    setActiveRowPopover(null);
    showToast("Autorisation activée pour tous les rôles");
  }, []);

  const handleBulkDeactivatePermission = useCallback((permKey: string) => {
    setDraftPrivileges((prev) => {
      const next = { ...prev };
      CONFIGURABLE_ROLES.forEach((r) => {
        const perms = next[r.key] || [];
        next[r.key] = perms.filter((k) => k !== permKey);
      });
      return next;
    });
    setActiveRowPopover(null);
    showToast("Autorisation désactivée pour tous les rôles");
  }, []);

  // Save changes to backend
  const handleSaveChanges = async () => {
    const isUserAdmin = user?.role?.toLowerCase() === 'admin';
    if (!isUserAdmin) {
      showToast("Action non autorisée. Seul le compte Admin est autorisé à modifier les privilèges.");
      return;
    }
    try {
      await updateRolesPermissions(draftPrivileges);
      setPrivileges(JSON.parse(JSON.stringify(draftPrivileges)));
      localStorage.setItem("roles_permissions", JSON.stringify(draftPrivileges));
      showToast("Les modifications ont été enregistrées avec succès.");
    } catch (err) {
      console.error(err);
      showToast("Erreur lors de l'enregistrement des modifications.");
    }
  };

  // Discard changes
  const handleResetChanges = () => {
    setDraftPrivileges(JSON.parse(JSON.stringify(privileges)));
    showToast("Modifications annulées.");
  };

  // Group names array
  const moduleGroups = useMemo(() => {
    const uniq: string[] = [];
    PERMISSIONS.forEach((p) => {
      if (!uniq.includes(p.group)) uniq.push(p.group);
    });
    return uniq;
  }, []);

  // Filtered permission structure
  const filteredModules = useMemo(() => {
    const q = privilegeSearch.trim().toLowerCase();
    const list: { group: string; perms: typeof PERMISSIONS }[] = [];

    moduleGroups.forEach((group) => {
      if (selectedModule !== "all" && group !== selectedModule) return;

      const matched = PERMISSIONS.filter(
        (p) => p.group === group && (!q || p.label.toLowerCase().includes(q))
      );

      if (matched.length > 0) {
        list.push({ group, perms: matched });
      }
    });

    return list;
  }, [privilegeSearch, selectedModule, moduleGroups]);

  // Compute effective expanded modules
  const effectiveExpanded = useMemo(() => {
    const q = privilegeSearch.trim();
    if (q || selectedModule !== "all") {
      return filteredModules.map((m) => m.group);
    }
    return expandedGroups;
  }, [expandedGroups, privilegeSearch, selectedModule, filteredModules]);

  const toggleGroupExpand = (group: string) => {
    setExpandedGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  // Users sorting & filtering
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? users.filter((u) => [u.fullName, u.email, u.username, u.position, u.city].join(" ").toLowerCase().includes(q)) : users;
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const paged = filteredUsers.slice((curPage - 1) * pageSize, curPage * pageSize);
  const start = filteredUsers.length === 0 ? 0 : (curPage - 1) * pageSize + 1;
  const end = Math.min(curPage * pageSize, filteredUsers.length);

  // Colors for accordion headers
  const getAccordionColor = (index: number) => {
    const colors = [
      { bg: "#064e43", text: "#ffffff" },
      { bg: "#0d5e50", text: "#ffffff" },
      { bg: "#0f6d5c", text: "#ffffff" },
      { bg: "#127d6a", text: "#ffffff" },
      { bg: "#148c77", text: "#ffffff" },
      { bg: "#17a68c", text: "#ffffff" },
      { bg: "#29ccaf", text: "#04332c" },
      { bg: "#85ebd5", text: "#04332c" },
    ];
    return colors[index % colors.length];
  };

  const popoverItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "8px 16px",
    fontSize: "13.5px",
    background: "transparent",
    border: "none",
    color: "#18181b",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    transition: "background 0.15s",
  };

  const tabItemStyle = (active: boolean): React.CSSProperties => ({
    padding: "10px 24px",
    fontSize: "14.5px",
    fontWeight: 500,
    borderRadius: "10px",
    cursor: "pointer",
    border: "none",
    background: active ? "#0F6E56" : "transparent",
    color: active ? "#ffffff" : "#71717a",
    transition: "all 0.15s ease",
  });

  return (
    <div style={{ position: "relative", width: "90%", margin: "0 auto", padding: "40px 16px 64px", display: "flex", flexDirection: "column", gap: 28, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: "#18181b" }}>
      <style>{`
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .popover-item:hover { background-color: #f4f4f5 !important; }
        .row-hover:hover { background-color: #fafafa; }
        .toggle-container:hover .toggle-tooltip {
          opacity: 1 !important;
          transform: translateX(-50%) translateY(-6px) !important;
        }
      `}</style>

      {/* Admin Access Restriction Overlay */}
      {!isSystemAdmin && (
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "120px 24px",
          background: "rgba(255, 255, 255, 0.45)",
          backdropFilter: "blur(5px)",
          borderRadius: 16,
        }}>
          <div style={{
            background: "#fff",
            border: "0.5px solid #e4e4e7",
            borderRadius: 16,
            padding: "36px 40px",
            maxWidth: 480,
            textAlign: "center",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            animation: "slideUp 0.3s ease-out",
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#FEE2E2",
              border: "0.5px solid #FCA5A5",
              color: "#EF4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 8px", color: "#18181b" }}>Accès Requis</h2>
            <p style={{ fontSize: 14.5, color: "#71717a", margin: 0, lineHeight: 1.6 }}>
              Vous n'etes pas autorisé à accéder à cette page.
            </p>
          </div>
        </div>
      )}

      <div style={!isSystemAdmin ? { filter: "grayscale(100%)", opacity: 0.45, pointerEvents: "none" } : undefined}>

        {/* Dynamic Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {activeTab === 'rights' && (
                <div style={{ width: 44, height: 44, borderRadius: 10, background: "#f4f4f5", border: "0.5px solid #e4e4e7", display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a" }}>
                  <Lock size={20} />
                </div>
              )}
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: "-0.3px" }}>
                  {activeTab === 'users' ? "Gestion des collaborateurs" : "Droits d'accès & Privilèges par rôle"}
                </h1>
                <p style={{ fontSize: 14.5, color: "#71717a", margin: "4px 0 0" }}>
                  {activeTab === 'users'
                    ? "Gérez les comptes d'utilisateurs et leurs droits d'accès au backoffice"
                    : "Configurez les autorisations pour chaque rôle de l'agence."}
                </p>
              </div>
            </div>
          </div>

          {activeTab === 'rights' && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleResetChanges}
                style={{ padding: "10px 20px", fontSize: 14.5, borderRadius: 10, border: "0.5px solid #e4e4e7", background: "#ffffff", color: "#3f3f46", cursor: "pointer", fontWeight: 500 }}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveChanges}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 22px", fontSize: 14.5, fontWeight: 500, borderRadius: 10, border: "none", background: "#0F6E56", color: "#ffffff", cursor: "pointer" }}
              >
                <Check size={16} />
                Enregistrer
              </button>
            </div>
          )}
        </div>

        {/* Tab Controls Bar */}
        <div style={{ display: "flex", gap: 8, background: "#f4f4f5", padding: 6, borderRadius: 12, width: "fit-content", marginBottom: 28 }}>
          <button onClick={() => setActiveTab('users')} style={tabItemStyle(activeTab === 'users')}>
            Collaborateurs
          </button>
          <button onClick={() => setActiveTab('rights')} style={tabItemStyle(activeTab === 'rights')}>
            Droits d'accès & Privilèges
          </button>
        </div>

        {/* ── Tab Content: Collaborateurs (Users CRUD) ── */}
        {activeTab === 'users' && (
          <CardSection
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>}
            title="Gestion des collaborateurs"
            description="Créez, modifiez, désactivez ou supprimez les comptes de l'agence"
          >
            {/* Toolbar */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#a1a1aa", pointerEvents: "none" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
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
                <Plus size={16} strokeWidth={2.5} />
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
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
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={curPage} totalPages={totalPages} total={filteredUsers.length} start={start} end={end} onChange={setPage} />
          </CardSection>
        )}

        {/* ── Tab Content: Droits d'accès & Privilèges par rôle ── */}
        {activeTab === 'rights' && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Horizontal Cards Row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {CONFIGURABLE_ROLES.map((role) => {
                const checkedCount = PERMISSIONS.filter(p => (draftPrivileges[role.key] || []).includes(p.key)).length;
                const percentage = Math.round((checkedCount / PERMISSIONS.length) * 100);
                return (
                  <div key={role.key} style={{ background: "#ffffff", border: "0.5px solid #e4e4e7", borderRadius: 12, padding: "16px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: 105, boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#18181b" }}>{role.label}</span>
                      <span style={{ fontSize: 11.5, color: "#71717a", background: "#f4f4f5", padding: "2px 8px", borderRadius: 6, fontWeight: 650 }}>
                        {checkedCount}/{PERMISSIONS.length}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "#a1a1aa", marginTop: 2 }}>{role.description}</div>

                    {/* Progress Bar */}
                    <div style={{ width: "100%", height: 5, background: "#f4f4f5", borderRadius: 10, overflow: "hidden", marginTop: 12 }}>
                      <div style={{ width: `${percentage}%`, height: "100%", background: "#0F6E56", borderRadius: 10, transition: "width 0.2s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Toolbar: Search and Module Category Selector */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#a1a1aa", pointerEvents: "none" }} size={18} />
                <input
                  value={privilegeSearch}
                  onChange={(e) => setPrivilegeSearch(e.target.value)}
                  placeholder="Rechercher une autorisation..."
                  style={{ width: "100%", padding: "12px 14px 12px 42px", fontSize: 15, border: "0.5px solid #e4e4e7", borderRadius: 10, background: "#ffffff", color: "#18181b", outline: "none", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                />
              </div>

              {/* Module Selector Dropdown */}
              <div style={{ position: "relative" }}>
                <select
                  value={selectedModule}
                  onChange={(e) => setSelectedModule(e.target.value)}
                  style={{ padding: "12px 40px 12px 16px", fontSize: 15, border: "0.5px solid #e4e4e7", borderRadius: 10, background: "#ffffff", color: "#18181b", outline: "none", cursor: "pointer", minWidth: 200, appearance: "none", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}
                >
                  <option value="all">Tous les modules</option>
                  {moduleGroups.map((group) => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
                <ChevronDown size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#71717a", pointerEvents: "none" }} />
              </div>
            </div>

            {/* Access Rights Grid Card */}
            <div style={{ background: "#ffffff", border: "0.5px solid #e4e4e7", borderRadius: 12, overflow: "visible", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ overflow: "visible" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 15 }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "#ffffff", borderBottom: "1px solid #f0f0f0" }}>
                      <th style={{ padding: "16px 20px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#71717a", width: "40%", borderBottom: "1px solid #f0f0f0", background: "#ffffff" }}>
                        Module & autorisation
                      </th>
                      {CONFIGURABLE_ROLES.map((role) => (
                        <th key={role.key} className="role-popover-wrapper" style={{ position: "relative", padding: "16px 10px", width: "11%", textAlign: "center", borderBottom: "1px solid #f0f0f0", verticalAlign: "top", overflow: "visible", background: "#ffffff" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ fontSize: 13.5, fontWeight: 650, color: "#18181b" }}>{role.label}</span>
                            <button
                              onClick={() => setActiveRolePopover(activeRolePopover === role.key ? null : role.key)}
                              style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", fontSize: 18, fontWeight: "bold", padding: "2px 8px", marginTop: 2, outline: "none" }}
                            >
                              ...
                            </button>
                          </div>

                          {/* Column Bulk Actions Popover */}
                          {activeRolePopover === role.key && (
                            <div style={{ position: "absolute", top: "85%", left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: "#ffffff", border: "0.5px solid #e4e4e7", borderRadius: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.08)", minWidth: 170, padding: "8px 0", textAlign: "left", animation: "slideUp 0.15s ease-out" }}>

                              <div style={{ padding: "6px 16px 4px", fontSize: 11.5, fontWeight: 650, color: "#71717a", textTransform: "uppercase" }}>
                                {role.label}
                              </div>
                              <button onClick={() => handleBulkActivateRole(role.key)} className="popover-item" style={popoverItemStyle}>
                                Tout activer
                              </button>
                              <button onClick={() => handleBulkDeactivateRole(role.key)} className="popover-item" style={popoverItemStyle}>
                                Tout désactiver
                              </button>

                              <div style={{ height: 0.5, background: "#e4e4e7", margin: "6px 0" }} />

                              <div style={{ padding: "4px 16px 4px", fontSize: 11.5, fontWeight: 600, color: "#a1a1aa" }}>
                                Copier depuis...
                              </div>
                              {CONFIGURABLE_ROLES.filter(o => o.key !== role.key).map(o => (
                                <button key={o.key} onClick={() => handleCopyRolePermissions(o.key, role.key)} className="popover-item" style={{ ...popoverItemStyle, paddingLeft: 12 }}>
                                  <Copy size={12.5} style={{ marginRight: 8, color: "#71717a" }} />
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </th>
                      ))}
                      <th style={{ width: "5%", borderBottom: "1px solid #f0f0f0", background: "#ffffff" }}></th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredModules.map(({ group, perms }, idx) => {
                      const isExpanded = effectiveExpanded.includes(group);
                      const headerColors = getAccordionColor(idx);
                      return (
                        <React.Fragment key={group}>

                          {/* Collapsible Section Header (Accordion) */}
                          <tr
                            onClick={() => toggleGroupExpand(group)}
                            style={{ background: headerColors.bg, color: headerColors.text, cursor: "pointer", userSelect: "none" }}
                          >
                            <td colSpan={7} style={{ padding: "14px 20px", fontSize: "14px", fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>
                                  <ChevronRight size={16} strokeWidth={2.5} />
                                </span>
                                {group}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Child Rows */}
                          {isExpanded && perms.map((p, pIdx) => {
                            // Compute count of active roles for this permission
                            const enabledRolesCount = CONFIGURABLE_ROLES.filter(r => (draftPrivileges[r.key] || []).includes(p.key)).length;
                            const showSubgroup = p.subgroup && (pIdx === 0 || perms[pIdx - 1].subgroup !== p.subgroup);
                            return (
                              <React.Fragment key={p.key}>
                                {showSubgroup && (
                                  <tr style={{ background: "#fcfdfc" }}>
                                    <td colSpan={CONFIGURABLE_ROLES.length + 2} style={{ padding: "10px 20px", fontSize: "11px", fontWeight: 700, color: "#0F6E56", letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "0.5px solid #e4e4e7" }}>
                                      {p.subgroup}
                                    </td>
                                  </tr>
                                )}
                                <tr className="row-hover" style={{ borderBottom: "0.5px solid #e4e4e7" }}>
                                  <td style={{ padding: "14px 20px", borderBottom: "0.5px solid #e4e4e7" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                      <span style={{ fontSize: "14px", color: "#3f3f46", fontWeight: 500 }}>{p.label}</span>
                                      <span style={{ fontSize: "11px", color: "#71717a", background: "#f4f4f5", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                                        {enabledRolesCount}/5
                                      </span>
                                    </div>
                                  </td>

                                  {CONFIGURABLE_ROLES.map((role) => (
                                    <td key={role.key} style={{ padding: "10px", textAlign: "center", borderBottom: "0.5px solid #e4e4e7" }}>
                                      <Toggle
                                        checked={(draftPrivileges[role.key] || []).includes(p.key)}
                                        onChange={() => handleTogglePermission(role.key, p.key)}
                                        tooltip={role.label}
                                      />
                                    </td>
                                  ))}

                                  {/* Row bulk actions (...) */}
                                  <td className="row-popover-wrapper" style={{ position: "relative", padding: "14px 18px", textAlign: "right", borderBottom: "0.5px solid #e4e4e7", overflow: "visible" }}>
                                    <button
                                      onClick={() => setActiveRowPopover(activeRowPopover === p.key ? null : p.key)}
                                      style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", fontSize: 18, padding: "2px 8px", outline: "none" }}
                                    >
                                      ...
                                    </button>

                                    {activeRowPopover === p.key && (
                                      <div style={{ position: "absolute", top: "85%", right: 18, zIndex: 1000, background: "#ffffff", border: "0.5px solid #e4e4e7", borderRadius: 12, boxShadow: "0 10px 25px rgba(0,0,0,0.08)", minWidth: 160, padding: "8px 0", textAlign: "left", animation: "slideUp 0.15s ease-out" }}>

                                        <button onClick={() => handleBulkActivatePermission(p.key)} className="popover-item" style={popoverItemStyle}>
                                          Activer pour tous
                                        </button>
                                        <button onClick={() => handleBulkDeactivatePermission(p.key)} className="popover-item" style={popoverItemStyle}>
                                          Désactiver pour tous
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Banner */}
            <div style={{ padding: "14px 18px", background: "#E1F5EE", borderLeft: "4px solid #0F6E56", borderRadius: "0 8px 8px 0", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: "#085041", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span><strong>Sécurité :</strong> Seul le bouton <strong>Enregistrer</strong> applique les modifications de manière permanente sur le serveur. Les administrateurs conservent automatiquement tous les privilèges.</span>
            </div>

          </div>
        )}

      </div>

      {/* Dialogs */}
      <UserFormDialog open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} initial={editing} onSubmit={editing ? handleUpdate : handleAdd} />
      <DeleteDialog user={toDelete} onClose={() => setToDelete(null)} onConfirm={handleDelete} />

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// Configuration helper structure for visual matching
const CONFIGURABLE_ROLES = [
  { key: "Moderateur", label: "Modérateur", description: "Supervision globale" },
  { key: "Responsable commercial", label: "Resp. Commercial", description: "Pilotage commercial" },
  { key: "commercial", label: "Commercial", description: "Terrain commercial" },
  { key: "Responsable des Opérations", label: "Resp. Opérations", description: "Pilotage opérations" },
  { key: "Chargée des Opérations", label: "Chargée Opérations", description: "Suivi opérations" },
];