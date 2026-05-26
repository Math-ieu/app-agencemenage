import { User } from '../types';

export type UserAction =
  | 'delete_client'
  | 'blacklist_client'
  | 'delete_profile'
  | 'blacklist_profile'
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

export const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  "Admin": [
    "consulter_clients", "creer_clients", "blacklister_clients",
    "consulter_demandes", "valider_demandes", "annuler_demandes",
    "voir_la_caisse", "mouvements_caisse", "consulter_agents",
    "creer_agents", "documents_agents", "rediger_blog", "parametres_globaux"
  ],
  "Moderateur":                 ["consulter_clients","creer_clients","consulter_demandes","consulter_agents","rediger_blog"],
  "Responsable commercial":     ["consulter_clients","creer_clients","consulter_demandes","valider_demandes","consulter_agents"],
  "commercial":                 ["consulter_clients","creer_clients","consulter_demandes"],
  "Responsable des Opérations": ["consulter_clients","consulter_demandes","valider_demandes","voir_la_caisse","consulter_agents","creer_agents","documents_agents"],
  "Chargée des Opérations":     ["consulter_clients","consulter_demandes","consulter_agents"],
  "Opérationnel":               ["consulter_demandes"],
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

export const hasPermission = (user: User | null, permissionKey: string): boolean => {
  if (!user) return false;
  const role = user.role || '';
  if (role.toLowerCase() === 'admin') return true;
  const permissions = getRolePermissions(role);
  return permissions.includes(permissionKey);
};

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

  const permissions = getRolePermissions(role);

  switch (action) {
    case 'delete_client':
    case 'blacklist_client':
      if (permissions.includes('blacklister_clients')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Clients : Blacklister & archiver'."
      };

    case 'delete_profile':
    case 'blacklist_profile':
    case 'edit_candidat':
      if (permissions.includes('creer_agents')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Agents : Créer & éditer'."
      };

    case 'manage_users':
      if (permissions.includes('parametres_globaux')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Config : Gérer la sécurité & les accès'."
      };

    case 'edit_client':
      if (!permissions.includes('creer_clients')) {
        return {
          allowed: false,
          message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Clients : Créer & éditer'."
        };
      }
      // Contrôles contextuels
      if (isRole('commercial')) {
        if (context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
          return {
            allowed: false,
            message: "Action non autorisée. Les commerciaux peuvent uniquement modifier leurs propres clients attribués."
          };
        }
      }
      return { allowed: true };

    case 'create_client':
      if (permissions.includes('creer_clients')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Clients : Créer & éditer'."
      };

    case 'create_demande':
      if (permissions.includes('consulter_demandes')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Demandes : Consulter le listing'."
      };

    case 'edit_demande':
      if (!permissions.includes('consulter_demandes')) {
        return {
          allowed: false,
          message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Demandes : Consulter le listing'."
        };
      }
      // Contrôles contextuels
      if (isRole('commercial')) {
        if (context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
          return {
            allowed: false,
            message: "Action non autorisée. Les commerciaux peuvent uniquement modifier leurs propres demandes attribuées."
          };
        }
      }
      return { allowed: true };

    case 'valider_demande':
      if (permissions.includes('valider_demandes')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Demandes : Valider & planifier (CAO)'."
      };

    case 'annuler_demande':
      if (permissions.includes('annuler_demandes')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Demandes : Annuler la facturation'."
      };

    case 'remboursement':
    case 'remise':
      if (permissions.includes('mouvements_caisse')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Finances : Saisir des entrées/sorties'."
      };

    case 'financier':
      if (permissions.includes('voir_la_caisse')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Finances : Consulter le solde de caisse'."
      };

    case 'affecter_commercial':
    case 'dispatch_clients':
      if (permissions.includes('valider_demandes')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Demandes : Valider & planifier (CAO)'."
      };

    case 'consulter_feedback':
      if (!permissions.includes('consulter_demandes')) {
        return {
          allowed: false,
          message: "Action non autorisée. Votre rôle ne dispose pas du droit 'Demandes : Consulter le listing'."
        };
      }
      if (isRole('chargée des opérations') || isRole('charge_operations')) {
        if (context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
          return {
            allowed: false,
            message: "Action non autorisée. Les chargées des opérations ont accès uniquement aux retours qualité de leurs propres clients."
          };
        }
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
};
