import { z } from "zod";

export const optionSchema = z.object({
  key: z.string(),
  label: z.string(),
  price: z.union([z.number(), z.string()]),
  enabled: z.boolean(),
});

export const quoteSchema = z.object({
  quote_number: z.string().optional(),
  service_type: z.string().min(1, "Le type de service est requis"),
  property_category: z.string().default("logement"),
  property_subtype: z.string().optional().default(""),
  surface: z.preprocess((val) => (val === "" || val === undefined ? undefined : Number(val)), z.number().optional()),
  frequency: z.string().default("oneshot"),
  sub_frequency: z.string().optional().default("1foisParSemaine"),
  frequency_custom: z.string().optional().default(""),
  duration_value: z.preprocess((val) => (val === "" || val === undefined ? undefined : Number(val)), z.number().optional()),
  duration_unit: z.string().default("heures"),
  staff_count: z.preprocess((val) => (val === "" || val === undefined ? 1 : Number(val)), z.number().default(1)),
  service_date: z.string().optional().default(""),
  service_time: z.string().optional().default(""),
  description: z.string().optional().default(""),
  options: z.array(optionSchema).default([]),
  client_name: z.string().min(1, "Le nom du client est requis"),
  client_phone: z.string().optional().default(""),
  client_address: z.string().optional().default(""),
  client_city: z.string().optional().default(""),
  amount_ht: z.preprocess((val) => (val === "" || val === undefined ? 0 : Number(val)), z.number().default(0)),
  vat_rate: z.preprocess((val) => (val === "" || val === undefined ? 20 : Number(val)), z.number().default(20)),
  advance_required: z.boolean().default(false),
  advance_mode: z.enum(["percent", "fixed"]).default("percent"),
  advance_percent: z.preprocess((val) => (val === "" || val === undefined || val === null ? "" : Number(val)), z.union([z.number(), z.string()]).default("")),
  advance_amount: z.preprocess((val) => (val === "" || val === undefined ? 0 : Number(val)), z.number().default(0)),
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export const propertyCategories = [
  { value: "logement", label: "Logement" },
  { value: "bureau", label: "Bureau" },
  { value: "commerce", label: "Commerce" },
  { value: "autre", label: "Autre" },
];

export const logementSubtypes = ["Appartement", "Villa", "Studio", "Duplex", "Riad"];

export const frequencies = [
  { value: "oneshot", label: "Une fois (ponctuel)" },
  { value: "subscription", label: "Abonnement" },
];

export const subFrequencies = [
  { value: "1foisParSemaine", label: "1 fois par semaine" },
  { value: "2foisParSemaine", label: "2 fois par semaine" },
  { value: "3foisParSemaine", label: "3 fois par semaine" },
  { value: "4foisParSemaine", label: "4 fois par semaine" },
  { value: "5foisParSemaine", label: "5 fois par semaine" },
  { value: "6foisParSemaine", label: "6 fois par semaine" },
  { value: "7foisParSemaine", label: "7 fois par semaine" },
  { value: "1foisParMois", label: "1 fois par mois" },
  { value: "2foisParMois", label: "2 fois par mois" },
  { value: "3foisParMois", label: "3 fois par mois" },
  { value: "4foisParMois", label: "4 fois par mois" },
];

export const defaultOptions = [
  { key: "produits", label: "Produits de nettoyage", price: 0, enabled: false },
  { key: "torchons", label: "Torchons et serpillières", price: 0, enabled: false },
  { key: "machines", label: "Machines et équipements (aspirateur, vapeur, etc.)", price: 0, enabled: false }
];

interface ComputeTotalsInput {
  amount_ht: number;
  vat_rate: number;
  options: Array<{ enabled: boolean; price: number | string }>;
  advance_required: boolean;
  advance_mode: 'percent' | 'fixed';
  advance_percent: number;
  advance_amount: number;
}

export function computeTotals(input: ComputeTotalsInput) {
  const optionsTotal = input.options.reduce((acc: number, opt) => {
    if (opt.enabled) {
      return acc + (Number(opt.price) || 0);
    }
    return acc;
  }, 0);

  const baseHt = (Number(input.amount_ht) || 0) + optionsTotal;
  const amount_vat = baseHt * ((Number(input.vat_rate) || 0) / 100);
  const amount_ttc = baseHt + amount_vat;

  const advance = input.advance_required
    ? (input.advance_mode === 'percent' ? Math.round((amount_ttc * (Number(input.advance_percent) || 0)) / 100) : (Number(input.advance_amount) || 0))
    : 0;

  const balance_due = Math.max(0, amount_ttc - advance);

  return {
    optionsTotal,
    baseHt,
    amount_vat,
    amount_ttc,
    advance,
    balance_due
  };
}

export function formatCurrency(amount: number, currency: string = "MAD") {
  return `${Math.round(amount).toLocaleString("fr-MA")} ${currency}`;
}
