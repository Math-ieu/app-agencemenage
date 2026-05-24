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

export const checkPermission = (
  user: User | null,
  action: UserAction,
  context?: { targetOwnerId?: number }
): { allowed: boolean; message?: string } => {
  if (!user) {
    return { allowed: false, message: "Vous devez être connecté pour effectuer cette action." };
  }

  const role = user.role || '';

  // 1. Admin a tous les accès
  if (role.toLowerCase() === 'admin') {
    return { allowed: true };
  }

  // Helper checking for lowercased roles or actual string values
  const isRole = (r: string) => role.toLowerCase() === r.toLowerCase();

  switch (action) {
    // Admin only actions
    case 'delete_client':
    case 'blacklist_client':
    case 'delete_profile':
      return {
        allowed: false,
        message: "Action non autorisée. Seul le compte Admin est autorisé à supprimer ou blacklister un client ou un profil."
      };

    case 'manage_users':
      // Modérateur can create user accounts
      if (isRole('moderateur') || isRole('Modérateur')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Seul le compte Admin ou Modérateur est autorisé à gérer les comptes utilisateurs."
      };

    case 'blacklist_profile':
      // Admin or Responsable des Opérations
      if (isRole('responsable des opérations') || isRole('responsable_operations')) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Seul un administrateur ou un responsable des opérations peut blacklister un profil."
      };

    case 'edit_client':
      // Commercial can edit only their own clients
      if (isRole('commercial')) {
        if (context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
          return {
            allowed: false,
            message: "Action non autorisée. Les commerciaux peuvent uniquement modifier leurs propres clients attribués."
          };
        }
        return { allowed: true };
      }
      // Chargée des opérations has read-only access to all clients
      if (isRole('chargée des opérations') || isRole('charge_operations')) {
        return {
          allowed: false,
          message: "Action non autorisée. Les chargées des opérations ont un accès en lecture seule à tous les clients."
        };
      }
      // Responsable commercial, Responsable des Opérations, Admin, Modérateur are allowed
      if (
        isRole('responsable commercial') ||
        isRole('responsable_commercial') ||
        isRole('responsable des opérations') ||
        isRole('responsable_operations') ||
        isRole('moderateur')
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée pour votre rôle."
      };

    case 'create_client':
      if (isRole('chargée des opérations') || isRole('charge_operations')) {
        return {
          allowed: false,
          message: "Action non autorisée. Les chargées des opérations ont un accès en lecture seule à tous les clients."
        };
      }
      return { allowed: true };

    case 'create_demande':
      // Responsable commercial, Commercial, Responsable des Opérations, Admin can create
      if (
        isRole('commercial') ||
        isRole('responsable commercial') ||
        isRole('responsable_commercial') ||
        isRole('responsable des opérations') ||
        isRole('responsable_operations')
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Votre rôle ne vous permet pas de créer des demandes clients."
      };

    case 'edit_demande':
      // Responsable commercial, Responsable des Opérations can edit all
      if (
        isRole('responsable commercial') ||
        isRole('responsable_commercial') ||
        isRole('responsable des opérations') ||
        isRole('responsable_operations')
      ) {
        return { allowed: true };
      }
      // Commercial can edit only their own demands
      if (isRole('commercial')) {
        if (context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
          return {
            allowed: false,
            message: "Action non autorisée. Les commerciaux peuvent uniquement modifier leurs propres demandes attribuées."
          };
        }
        return { allowed: true };
      }
      // Chargée des opérations has read-only access
      if (isRole('chargée des opérations') || isRole('charge_operations')) {
        return {
          allowed: false,
          message: "Action non autorisée. Les chargées des opérations ont un accès en lecture seule aux demandes."
        };
      }
      return {
        allowed: false,
        message: "Action non autorisée."
      };

    case 'valider_demande':
    case 'annuler_demande':
      // Responsable commercial, Responsable des Opérations can cancel/validate
      if (
        isRole('responsable commercial') ||
        isRole('responsable_commercial') ||
        isRole('responsable des opérations') ||
        isRole('responsable_operations')
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Seul un administrateur, un responsable commercial ou un responsable des opérations peut valider ou annuler des demandes."
      };

    case 'remboursement':
    case 'remise':
      // Responsable commercial, Responsable des Opérations can refund, annul billing, give discount
      if (
        isRole('responsable commercial') ||
        isRole('responsable_commercial') ||
        isRole('responsable des opérations') ||
        isRole('responsable_operations')
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Seuls les administrateurs, responsables commerciaux et responsables des opérations peuvent accorder des remises ou effectuer des remboursements."
      };

    case 'financier':
      // Full access for Responsable commercial, Commercial (for their own), Responsable des Opérations
      if (
        isRole('responsable commercial') ||
        isRole('responsable_commercial') ||
        isRole('responsable des opérations') ||
        isRole('responsable_operations') ||
        isRole('commercial')
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Vous n'avez pas l'accès à la gestion financière."
      };

    case 'affecter_commercial':
    case 'dispatch_clients':
      if (
        isRole('responsable commercial') ||
        isRole('responsable_commercial') ||
        isRole('responsable des opérations') ||
        isRole('responsable_operations')
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Seuls les administrateurs et responsables peuvent affecter ou dispatcher les dossiers clients."
      };

    case 'edit_candidat':
      // Saisir / modifier fiches candidats
      // Responsable des Opérations (edit all), Chargée des Opérations (edit all)
      if (
        isRole('responsable des opérations') ||
        isRole('responsable_operations') ||
        isRole('chargée des opérations') ||
        isRole('charge_operations') ||
        isRole('moderateur') ||
        isRole('responsable commercial') ||
        isRole('responsable_commercial')
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Vous n'avez pas le droit d'éditer les fiches candidats."
      };

    case 'consulter_feedback':
      // Responsable des Opérations can access all, Chargée des Opérations only their own
      if (
        isRole('responsable des opérations') ||
        isRole('responsable_operations') ||
        isRole('responsable commercial') ||
        isRole('responsable_commercial')
      ) {
        return { allowed: true };
      }
      if (isRole('chargée des opérations') || isRole('charge_operations')) {
        if (context && context.targetOwnerId !== undefined && context.targetOwnerId !== user.id) {
          return {
            allowed: false,
            message: "Action non autorisée. Les chargées des opérations ont accès uniquement aux retours qualité de leurs propres clients."
          };
        }
        return { allowed: true };
      }
      return {
        allowed: false,
        message: "Action non autorisée. Vous n'avez pas accès aux retours qualité."
      };

    default:
      return { allowed: true };
  }
};
