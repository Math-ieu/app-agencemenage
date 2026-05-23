import { z } from "zod";

export const AGENCY_CITIES = ["Casablanca", "Rabat", "Marrakech"] as const;
export type AgencyCity = (typeof AGENCY_CITIES)[number];

export const USER_STATUSES = ["actif", "desactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_POSITIONS = [
  "Admin",
  "Moderateur",
  "Responsable commercial",
  "commercial",
  "Responsable des Opérations",
  "Chargée des Opérations",
] as const;
export type UserPosition = (typeof USER_POSITIONS)[number];

export type User = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  position: UserPosition;
  city: AgencyCity;
  status: UserStatus;
  avatarUrl?: string;
  password?: string;
};

export const makeUserSchema = (isEdit: boolean) =>
  z.object({
    fullName: z
      .string()
      .trim()
      .min(2, "Le nom & prénom est requis")
      .max(100, "100 caractères maximum"),
    username: z
      .string()
      .trim()
      .min(3, "Au moins 3 caractères")
      .max(40, "40 caractères maximum")
      .regex(/^[a-zA-Z0-9._-]+$/, "Lettres, chiffres, . _ - uniquement"),
    password: isEdit
      ? z
          .string()
          .max(100)
          .optional()
          .refine((v) => !v || v.length >= 8, "Au moins 8 caractères")
      : z.string().min(8, "Au moins 8 caractères").max(100),
    city: z.enum(AGENCY_CITIES, { message: "Sélectionnez une ville" }),
    status: z.enum(USER_STATUSES, { message: "Sélectionnez un statut" }),
    phone: z
      .string()
      .trim()
      .min(6, "Numéro invalide")
      .max(20, "Numéro invalide")
      .regex(/^[0-9+\s().-]+$/, "Numéro invalide"),
    email: z.string().trim().email("Email invalide").max(255),
    position: z.enum(USER_POSITIONS, {
      message: "Sélectionnez un poste",
    }),
    avatarUrl: z.string().optional(),
  });

export type UserFormValues = z.infer<ReturnType<typeof makeUserSchema>>;
