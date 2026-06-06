import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  quoteSchema,
  type QuoteInput,
  propertyCategories,
  logementSubtypes,
  frequencies,
  durationUnits,
  defaultOptions,
  computeTotals,
  formatCurrency,
} from "@/lib/quote-types";
import { createQuote } from "@/lib/quotes.functions";
import { company } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/devis/nouveau")({
  head: () => ({ meta: [{ title: "Nouveau devis" }] }),
  component: NewQuotePage,
});

function NewQuotePage() {
  const navigate = useNavigate();
  const save = useServerFn(createQuote);

  const form = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema) as any,
    defaultValues: {
      quote_number: "",
      service_type: "",
      property_category: "logement",
      property_subtype: "Appartement",
      surface: undefined,
      frequency: "unique",
      frequency_custom: "",
      duration_value: undefined,
      duration_unit: "heures",
      staff_count: 1,
      service_date: "",
      service_time: "",
      description: "",
      options: defaultOptions,
      client_name: "",
      client_phone: "",
      client_address: "",
      client_city: "",
      amount_ht: 0,
      vat_rate: 20,
      advance_required: false,
      advance_mode: "percent",
      advance_percent: 30,
      advance_amount: 0,
    },
  });

  const values = form.watch();
  const totals = useMemo(
    () =>
      computeTotals({
        amount_ht: Number(values.amount_ht) || 0,
        vat_rate: Number(values.vat_rate) || 0,
        options: values.options ?? [],
        advance_required: !!values.advance_required,
        advance_mode: values.advance_mode,
        advance_percent: Number(values.advance_percent) || 0,
        advance_amount: Number(values.advance_amount) || 0,
      }),
    [values],
  );

  const onSubmit = async (data: QuoteInput) => {
    try {
      const res = await save({ data });
      toast.success("Devis créé");
      navigate({ to: "/devis/$id", params: { id: res.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader><CardTitle>Numéro de devis</CardTitle></CardHeader>
        <CardContent>
          <Label htmlFor="quote_number">Numéro</Label>
          <Input id="quote_number" placeholder="ex: DEV-2026-001" {...form.register("quote_number")} />
          {form.formState.errors.quote_number && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.quote_number.message}</p>
          )}
        </CardContent>
      </Card>

      {/* 1. Service */}
      <Card>
        <CardHeader><CardTitle>1. Informations sur le service</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Type de service</Label>
            <Input placeholder="Ex: Nettoyage de fin de chantier" {...form.register("service_type")} />
          </div>

          <div>
            <Label>Type de bien</Label>
            <Controller
              control={form.control}
              name="property_category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => {
                  field.onChange(v);
                  // Reset subtype quand on change de catégorie
                  if (v === "logement") form.setValue("property_subtype", "Appartement");
                  else form.setValue("property_subtype", "");
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {propertyCategories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {values.property_category === "logement" && (
            <div>
              <Label>Sous-type de logement</Label>
              <Controller
                control={form.control}
                name="property_subtype"
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {logementSubtypes.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {values.property_category === "autre" && (
            <div>
              <Label>Préciser le type de bien</Label>
              <Input {...form.register("property_subtype")} />
            </div>
          )}

          <div>
            <Label>Surface (m²)</Label>
            <Input type="number" min="0" step="0.01" {...form.register("surface")} />
          </div>

          <div>
            <Label>Fréquence</Label>
            <Controller
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencies.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {values.frequency === "autre" && (
            <div>
              <Label>Préciser la fréquence</Label>
              <Input {...form.register("frequency_custom")} />
            </div>
          )}

          <div>
            <Label>Durée</Label>
            <div className="flex gap-2">
              <Input type="number" min="0" step="0.5" {...form.register("duration_value")} />
              <Controller
                control={form.control}
                name="duration_unit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {durationUnits.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div>
            <Label>Nombre d'intervenantes</Label>
            <Input type="number" min="0" step="1" {...form.register("staff_count")} />
          </div>

          <div>
            <Label>Date de prestation</Label>
            <Input type="date" {...form.register("service_date")} />
          </div>

          <div>
            <Label>Heure</Label>
            <Input type="time" {...form.register("service_time")} />
          </div>
        </CardContent>
      </Card>

      {/* 2. Besoin */}
      <Card>
        <CardHeader><CardTitle>2. Consigne importante</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={5} placeholder="Les consignes importantes, ainsi que ce qui est inclus ou non dans la prestation." {...form.register("description")} />
        </CardContent>
      </Card>

      {/* 3. Options */}
      <Card>
        <CardHeader><CardTitle>3. Options complémentaires</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(values.options ?? []).map((opt, idx) => (
            <div key={opt.key} className="grid grid-cols-[auto_1fr_180px] items-center gap-3 border rounded-md p-3">
              <Controller
                control={form.control}
                name={`options.${idx}.enabled` as const}
                render={({ field }) => (
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                )}
              />
              <span className="text-sm">{opt.label}</span>
              <div className="flex items-center gap-2">
                <Input type="number" min="0" step="0.01" placeholder="Prix"
                  {...form.register(`options.${idx}.price` as const)} />
                <span className="text-xs text-muted-foreground">{company.currency}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 4. Client */}
      <Card>
        <CardHeader><CardTitle>4. Informations du client</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Nom et prénom *</Label>
            <Input {...form.register("client_name")} />
            {form.formState.errors.client_name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.client_name.message}</p>
            )}
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input type="tel" {...form.register("client_phone")} />
          </div>
          <div className="md:col-span-2">
            <Label>Adresse</Label>
            <Input {...form.register("client_address")} />
          </div>
          <div>
            <Label>Ville</Label>
            <Input {...form.register("client_city")} />
          </div>
        </CardContent>
      </Card>

      {/* 5. Financier */}
      <Card>
        <CardHeader><CardTitle>5. Informations financières</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Montant HT ({company.currency})</Label>
            <Input type="number" min="0" step="0.01" {...form.register("amount_ht")} />
          </div>
          <div>
            <Label>TVA (%)</Label>
            <Input type="number" min="0" max="100" step="0.01" {...form.register("vat_rate")} />
          </div>

          <div className="md:col-span-2 rounded-md bg-muted/40 p-4 space-y-1 text-sm">
            <div className="flex justify-between"><span>Total options activées</span><span>{formatCurrency(totals.optionsTotal, company.currency)}</span></div>
            <div className="flex justify-between"><span>Base HT</span><span>{formatCurrency(totals.baseHt, company.currency)}</span></div>
            <div className="flex justify-between"><span>Montant TVA</span><span>{formatCurrency(totals.amount_vat, company.currency)}</span></div>
            <div className="flex justify-between font-semibold text-base pt-1 border-t"><span>Montant TTC</span><span>{formatCurrency(totals.amount_ttc, company.currency)}</span></div>
          </div>

          <div className="md:col-span-2 rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Avance requise</p>
              <Controller
                control={form.control}
                name="advance_required"
                render={({ field }) => (
                  <div className="inline-flex rounded-md border p-0.5 bg-muted">
                    <button
                      type="button"
                      onClick={() => field.onChange(false)}
                      className={`px-4 py-1.5 text-sm rounded-[5px] transition-colors ${!field.value ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >Non</button>
                    <button
                      type="button"
                      onClick={() => field.onChange(true)}
                      className={`px-4 py-1.5 text-sm rounded-[5px] transition-colors ${field.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
                    >Oui</button>
                  </div>
                )}
              />
            </div>

            {values.advance_required && (
              <>
                <Controller
                  control={form.control}
                  name="advance_mode"
                  render={({ field }) => (
                    <div className="grid grid-cols-2 rounded-md border p-1 bg-muted">
                      <button
                        type="button"
                        onClick={() => field.onChange("percent")}
                        className={`py-2 text-sm font-medium rounded-[5px] transition-colors ${field.value === "percent" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
                      >En pourcentage (%)</button>
                      <button
                        type="button"
                        onClick={() => field.onChange("fixed")}
                        className={`py-2 text-sm font-medium rounded-[5px] transition-colors ${field.value === "fixed" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
                      >Montant fixe ({company.currency})</button>
                    </div>
                  )}
                />

                {values.advance_mode === "percent" ? (
                  <div>
                    <Label>Pourcentage du devis (%)</Label>
                    <Input type="number" min="0" max="100" step="1" {...form.register("advance_percent")} />
                  </div>
                ) : (
                  <div>
                    <Label>Montant de l'avance ({company.currency})</Label>
                    <Input type="number" min="0" step="0.01" {...form.register("advance_amount")} />
                  </div>
                )}

                <div className="rounded-md bg-primary text-primary-foreground p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Montant total du devis</span><span className="font-semibold">{formatCurrency(totals.amount_ttc, company.currency)}</span></div>
                  <div className="flex justify-between border-t border-primary-foreground/20 pt-2">
                    <span>Avance requise{values.advance_mode === "percent" ? ` (${Number(values.advance_percent) || 0}%)` : ""}</span>
                    <span className="font-semibold">{formatCurrency(totals.advance, company.currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-primary-foreground/20 pt-2">
                    <span>Solde restant à payer</span><span className="font-semibold">{formatCurrency(totals.balance_due, company.currency)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/devis" })}>Annuler</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enregistrement…" : "Créer le devis"}
        </Button>
      </div>
    </form>
  );
}
