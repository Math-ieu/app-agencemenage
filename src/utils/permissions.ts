import { User } from '../types';

/**
 * All permission keys used in the privileges matrix.
 * This is the single source of truth matching the PERMISSIONS array in Utilisateurs.tsx.
 */
export type PermissionKey =
  // Tableau de bord
  | 'consulter_dashboard'
  | 'consulter_compte_client_dashboard'
  | 'editer_besoin'
  | 'confirmation_avant_operation'
  | 'supprimer_demande_dashboard'
  | 'facturation_annulee'
  | 'annulation_demande'
  | 'note_operationnelle_dashboard'
  | 'note_commerciale_dashboard'
  | 'assigner_charge_operation'
  | 'application_taux_horaire_standard'
  | 'taux_horaire_exceptionnel'
  | 'taux_forfaitaire'
  // Demandes en attente
  | 'creer_demande'
  | 'creer_devis'
  | 'modifier_demande'
  | 'consulter_demandes'
  | 'affecter_commercial'
  | 'valider_demandes'
  | 'refuser_demande'
  // Listing profils
  | 'consulter_agents'
  | 'consulter_docs_confidentiels'
  | 'creer_agents'
  | 'modifier_agents'
  | 'desactiver_profil'
  | 'blacklister_agents'
  | 'supprimer_profil'
  // Listing clients
  | 'consulter_clients'
  | 'consulter_compte_client'
  | 'affectation_client'
  | 'note_operationnelle'
  | 'note_commerciale'
  | 'geste_commercial'
  | 'modifier_clients'
  | 'blacklister_clients'
  | 'delete_client'
  // Historique
  | 'consulter_historique_global'
  | 'filtrer_historique'
  | 'exporter_historique_csv'
  // Gestion financière — Vue globale
  | 'voir_la_caisse'
  | 'consulter_debit'
  | 'valider_paiement_debit'
  | 'filtrer_debit'
  | 'consulter_credit'
  | 'valider_paiement_credit'
  | 'filtrer_credit'
  | 'consulter_factures'
  | 'exporter_pdf_excel_facture'
  | 'editer_facture'
  | 'modifier_facture'
  | 'editer_besoin_facture'
  | 'generer_facture'
  | 'envoi_facture_client'
  | 'consulter_comptes_profil'
  // Gestion financière — La caisse
  | 'consulter_solde_caisse'
  | 'mouvements_caisse'
  | 'sorties_caisse'
  | 'cloturer_caisse_journaliere'
  // Marketing
  | 'consulter_marketing'
  | 'creer_code_promo'
  | 'creer_geste_commercial'
  | 'creer_campagne'
  // Qualité & Feedback
  | 'consulter_retours_qualite'
  | 'repondre_avis_clients'
  | 'moderer_masquer_avis'
  | 'generer_rapports_qualite'
  // SEO — Blog
  | 'rediger_blog'
  | 'modifier_articles_blog'
  | 'publier_articles_blog'
  // Paramètres — Mon profil
  | 'consulter_infos_profil'
  | 'modifier_infos_profil'
  | 'modifier_mot_de_passe'
  | 'activer_mfa'
  // Paramètres — Utilisateurs & Rôles
  | 'consulter_utilisateurs'
  | 'creer_utilisateurs'
  | 'parametres_globaux'
  | 'activer_desactiver_utilisateurs';

/**
 * Backward-compatible UserAction type — now just an alias for PermissionKey
 * plus legacy action names that are mapped below.
 */
export type UserAction =
  | PermissionKey
  | 'delete_profile'
  | 'blacklist_profile'
  | 'blacklist_client'
  | 'manage_users'
  | 'edit_client'
  | 'create_client'
  | 'create_demande'
  | 'edit_demande'
  | 'valider_demande'
  | 'annuler_demande'
  | 'financier'
  | 'remboursement'
  | 'remise'
  | 'affecter_commercial'
  | 'dispatch_clients'
  | 'edit_candidat'
  | 'consulter_feedback';

/**
 * Maps legacy action names to the actual permission key in the matrix.
 */
const LEGACY_ACTION_MAP: Record<string, PermissionKey> = {
  'delete_profile': 'supprimer_profil',
  'blacklist_profile': 'blacklister_agents',
  'blacklist_client': 'blacklister_clients',
  'manage_users': 'parametres_globaux',
  'edit_client': 'modifier_clients',
  'create_client': 'modifier_clients',
  'create_demande': 'creer_demande',
  'edit_demande': 'modifier_demande',
  'valider_demande': 'valider_demandes',
  'annuler_demande': 'refuser_demande',
  'financier': 'voir_la_caisse',
  'remboursement': 'mouvements_caisse',
  'remise': 'mouvements_caisse',
  'dispatch_clients': 'affectation_client',
  'edit_candidat': 'modifier_agents',
  'consulter_feedback': 'consulter_retours_qualite',
};

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  "Admin": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "assigner_charge_operation", "application_taux_horaire_standard", "taux_horaire_exceptionnel", "taux_forfaitaire",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "valider_demandes", "refuser_demande",
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
  "Moderateur": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "assigner_charge_operation", "application_taux_horaire_standard", "taux_horaire_exceptionnel", "taux_forfaitaire",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "valider_demandes", "refuser_demande",
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
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "application_taux_horaire_standard", "taux_horaire_exceptionnel", "taux_forfaitaire",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "valider_demandes", "refuser_demande",
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
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "valider_demandes", "refuser_demande",
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
    // Marketing
    "consulter_marketing",
    // Qualité
    "consulter_retours_qualite",
    // Paramètres - Mon profil
    "consulter_infos_profil", "modifier_infos_profil", "modifier_mot_de_passe", "activer_mfa"
  ],
  "Responsable des Opérations": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "assigner_charge_operation", "application_taux_horaire_standard",
    // Demandes en attente
    "creer_demande", "consulter_demandes", "valider_demandes",
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
    // Marketing
    "consulter_marketing",
    // Qualité
    "consulter_retours_qualite", "generer_rapports_qualite",
    // Paramètres - Mon profil
    "consulter_infos_profil", "modifier_infos_profil", "modifier_mot_de_passe", "activer_mfa"
  ],
  "Chargée des Opérations": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard",
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

export const mapRoleToStorageKey = (role: string): string => {
  const r = role.toLowerCase().trim();
  if (r === 'admin') return 'Admin';
  if (r === 'moderateur' || r === 'modérateur') return 'Moderateur';
  if (r === 'responsable commercial' || r === 'responsable_commercial') return 'Responsable commercial';
  if (r === 'commercial') return 'commercial';
  if (r === 'responsable des opérations' || r === 'responsable_operations') return 'Responsable des Opérations';
  if (r === 'chargée des opérations' || r === 'charge_operations') return 'Chargée des Opérations';
  if (r === 'opérationnel' || r === 'operationnel') return 'Opérationnel';
  
  if (role === 'Admin') return 'Admin';
  if (role === 'Moderateur') return 'Moderateur';
  if (role === 'Responsable commercial') return 'Responsable commercial';
  if (role === 'commercial') return 'commercial';
  if (role === 'Responsable des Opérations') return 'Responsable des Opérations';
  if (role === 'Chargée des Opérations') return 'Chargée des Opérations';
  if (role === 'Opérationnel') return 'Opérationnel';
  
  return 'commercial';
};

export const getRolePermissions = (role: string): string[] => {
  const key = mapRoleToStorageKey(role);
  try {
    const saved = localStorage.getItem("roles_permissions");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed[key]) {
        return parsed[key];
      }
    }
  } catch (e) {
    console.error("Failed to parse roles_permissions from localStorage", e);
  }
  return DEFAULT_PERMISSIONS[key] || [];
};

/**
 * Primary permission check — used everywhere in the app.
 * Checks whether the user's role has the given permission key.
 * Admin always returns true.
 */
export const hasPermission = (user: User | null, permissionKey: string): boolean => {
  if (!user) return false;
  const role = user.role || '';
  if (role.toLowerCase() === 'admin') return true;
  const permissions = getRolePermissions(role);
  return permissions.includes(permissionKey);
};

/**
 * Extended permission check with contextual rules and user-facing messages.
 * Resolves legacy action names via LEGACY_ACTION_MAP, then checks the matrix.
 * Keeps contextual ownership checks for commercial role.
 */
export const checkPermission = (
  user: User | null,
  action: UserAction,
  context?: { targetOwnerId?: number }
): { allowed: boolean; message?: string } => {
  if (!user) {
    return { allowed: false, message: "Vous devez être connecté pour effectuer cette action." };
  }

  const role = user.role || '';
  const isRole = (r: string) => role.toLowerCase() === r.toLowerCase();

  // Admin a tous les accès par défaut
  if (role.toLowerCase() === 'admin') {
    return { allowed: true };
  }

  // Resolve legacy action to actual permission key
  const permKey = LEGACY_ACTION_MAP[action] || action;
  const permissions = getRolePermissions(role);
  const hasPerm = permissions.includes(permKey);

  if (!hasPerm) {
    return {
      allowed: false,
      message: `Action non autorisée. Votre rôle ne dispose pas de cette permission.`
    };
  }

  // Contextual ownership checks for commercial role
  if (isRole('commercial') && context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
    // Commercial editing/modifying items not assigned to them
    if (['edit_client', 'modifier_clients', 'edit_demande', 'modifier_demande'].includes(action)) {
      return {
        allowed: false,
        message: "Action non autorisée. Les commerciaux peuvent uniquement modifier leurs propres éléments attribués."
      };
    }
  }

  // Contextual check for feedback on Chargée des Opérations
  if (action === 'consulter_feedback' || action === 'consulter_retours_qualite') {
    if (isRole('chargée des opérations') || isRole('charge_operations')) {
      if (context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
        return {
          allowed: false,
          message: "Action non autorisée. Les chargées des opérations ont accès uniquement aux retours qualité de leurs propres clients."
        };
      }
    }
  }

  return { allowed: true };
};
