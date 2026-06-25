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
  | 'editer_besoin_agence'
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
  | 'traiter_demandes_affectees'
  | 'creer_valider_demande'
  | 'refuser_demande'
  // Listing profils
  | 'consulter_agents'
  | 'consulter_docs_confidentiels'
  | 'creer_agents'
  | 'modifier_agents'
  | 'desactiver_profil'
  | 'blacklister_agents'
  | 'supprimer_profil'
  | 'postuler_demande'
  | 'assigner_charge_profil'
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
  // Gestion financière — Suivis (Nouveaux)
  | 'consulter_dus_agences_profils'
  | 'validation_paiements_dus'
  | 'consulter_suivi_commerciaux'
  | 'filtrer_suivi_commerciaux'
  // Gestion financière — Trésorerie & Caisse (Nouveaux)
  | 'consulter_tresorerie'
  | 'creer_mouvements_tresorerie'
  | 'filtrer_tresorerie'
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
  'valider_demande': 'traiter_demandes_affectees',
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
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "editer_besoin_agence", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "assigner_charge_operation", "application_taux_horaire_standard", "taux_horaire_exceptionnel", "taux_forfaitaire",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "traiter_demandes_affectees", "creer_valider_demande", "refuser_demande",
    // Listing profils
    "consulter_agents", "consulter_docs_confidentiels", "creer_agents", "modifier_agents", "desactiver_profil", "blacklister_agents", "supprimer_profil", "postuler_demande", "assigner_charge_profil",
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
  "Moderateur": [
    // Tableau de bord
    "consulter_dashboard", "consulter_compte_client_dashboard", "editer_besoin", "editer_besoin_agence", "confirmation_avant_operation", "supprimer_demande_dashboard", "facturation_annulee", "annulation_demande", "note_operationnelle_dashboard", "note_commerciale_dashboard", "assigner_charge_operation", "application_taux_horaire_standard", "taux_horaire_exceptionnel", "taux_forfaitaire",
    // Demandes en attente
    "creer_demande", "creer_devis", "modifier_demande", "consulter_demandes", "affecter_commercial", "traiter_demandes_affectees", "creer_valider_demande", "refuser_demande",
    // Listing profils
    "consulter_agents", "consulter_docs_confidentiels", "creer_agents", "modifier_agents", "desactiver_profil", "blacklister_agents", "supprimer_profil", "postuler_demande", "assigner_charge_profil",
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
    "consulter_agents", "postuler_demande",
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
    "consulter_agents", "consulter_docs_confidentiels", "creer_agents", "modifier_agents", "desactiver_profil", "blacklister_agents", "supprimer_profil", "postuler_demande",
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
    "consulter_agents", "consulter_docs_confidentiels", "creer_agents", "modifier_agents", "desactiver_profil", "blacklister_agents", "postuler_demande", "assigner_charge_profil",
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
    "consulter_agents", "consulter_docs_confidentiels", "postuler_demande",
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
  _context?: { targetOwnerId?: number }
): { allowed: boolean; message?: string } => {
  if (!user) {
    return { allowed: false, message: "Vous devez être connecté pour effectuer cette action." };
  }

  const role = user.role || '';

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

  return { allowed: true };
};

export const isExemptFromOwnership = (user: User | null): boolean => {
  if (!user) return false;
  const role = (user.role || '').toLowerCase().trim();
  return [
    'admin',
    'moderateur',
    'modérateur',
    'responsable commercial',
    'responsable_commercial',
    'responsable des opérations',
    'responsable_operations'
  ].includes(role);
};

export const hasPermissionWithContext = (
  user: User | null,
  permissionKey: string,
  contextObj?: any
): boolean => {
  if (!user) return false;
  if (!hasPermission(user, permissionKey)) return false;
  if (isExemptFromOwnership(user)) return true;
  if (!contextObj) return true;

  // Check if contextObj is a Demand
  const isDemand = 'created_by' in contextObj || 'assigned_to' in contextObj || 'assigned_to_operations' in contextObj;
  if (isDemand) {
    const createdBy = typeof contextObj.created_by === 'object' && contextObj.created_by !== null ? contextObj.created_by.id : contextObj.created_by;
    const assignedTo = typeof contextObj.assigned_to === 'object' && contextObj.assigned_to !== null ? contextObj.assigned_to.id : contextObj.assigned_to;
    const assignedToOps = typeof contextObj.assigned_to_operations === 'object' && contextObj.assigned_to_operations !== null ? contextObj.assigned_to_operations.id : contextObj.assigned_to_operations;

    return createdBy === user.id || assignedTo === user.id || assignedToOps === user.id;
  }

  // Check if contextObj is a Client
  const isClient = 'assigned_commercial' in contextObj || 'demandes_count' in contextObj;
  if (isClient) {
    const assignedCommercial = typeof contextObj.assigned_commercial === 'object' && contextObj.assigned_commercial !== null
      ? contextObj.assigned_commercial.id
      : (typeof contextObj.assigned_commercial === 'string'
          ? parseInt(contextObj.assigned_commercial, 10)
          : contextObj.assigned_commercial);
    return assignedCommercial === user.id;
  }

  // Check if contextObj is a Feedback
  const isFeedback = 'note_agence' in contextObj || 'note_intervenant' in contextObj || 'commentaire' in contextObj;
  if (isFeedback) {
    const demand = contextObj.demande || (contextObj.mission ? contextObj.mission.demande : null);
    if (demand) {
      const createdBy = typeof demand.created_by === 'object' && demand.created_by !== null ? demand.created_by.id : demand.created_by;
      const assignedTo = typeof demand.assigned_to === 'object' && demand.assigned_to !== null ? demand.assigned_to.id : demand.assigned_to;
      const assignedToOps = typeof demand.assigned_to_operations === 'object' && demand.assigned_to_operations !== null ? demand.assigned_to_operations.id : demand.assigned_to_operations;
      return createdBy === user.id || assignedTo === user.id || assignedToOps === user.id;
    }
  }

  // Check if contextObj is a FacturationRow/Invoice
  const isInvoice = 'numero' in contextObj || ('missionNo' in contextObj && 'originalDemande' in contextObj);
  if (isInvoice) {
    const demand = contextObj.originalDemande || contextObj.demande;
    if (demand) {
      const createdBy = typeof demand.created_by === 'object' && demand.created_by !== null ? demand.created_by.id : demand.created_by;
      const assignedTo = typeof demand.assigned_to === 'object' && demand.assigned_to !== null ? demand.assigned_to.id : demand.assigned_to;
      const assignedToOps = typeof demand.assigned_to_operations === 'object' && demand.assigned_to_operations !== null ? demand.assigned_to_operations.id : demand.assigned_to_operations;
      return createdBy === user.id || assignedTo === user.id || assignedToOps === user.id;
    }
  }

  return true;
};

export const hasPermissionWithClientContext = (
  user: User | null,
  client: any,
  _demandes?: any[]
): boolean => {
  if (!user) return false;
  if (!hasPermission(user, 'modifier_clients')) return false;
  if (isExemptFromOwnership(user)) return true;
  if (!client) return false;

  // Check if assigned commercial matches
  const assignedCommercial = typeof client.assigned_commercial === 'object' && client.assigned_commercial !== null
    ? client.assigned_commercial.id
    : (typeof client.assigned_commercial === 'string'
        ? parseInt(client.assigned_commercial, 10)
        : client.assigned_commercial);
  return assignedCommercial === user.id;
};
