import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import {
  AGENCY_CITIES,
  USER_STATUSES,
  USER_POSITIONS,
  makeUserSchema,
  type UserFormValues,
  type User,
} from "@/lib/user-schema";
import { AvatarUploader } from "./AvatarUploader";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: User | null;
  onSubmit: (values: UserFormValues) => void;
};

export function UserFormDialog({ open, onOpenChange, initial, onSubmit }: Props) {
  const isEdit = !!initial;
  const [showPwd, setShowPwd] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(makeUserSchema(isEdit)),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
      city: undefined as unknown as UserFormValues["city"],
      status: "actif",
      phone: "",
      email: "",
      position: undefined as unknown as UserFormValues["position"],
      avatarUrl: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        initial
          ? {
              fullName: initial.fullName,
              username: initial.username,
              password: "",
              city: initial.city,
              status: initial.status,
              phone: initial.phone,
              email: initial.email,
              position: initial.position,
              avatarUrl: initial.avatarUrl,
            }
          : {
              fullName: "",
              username: "",
              password: "",
              city: undefined as unknown as UserFormValues["city"],
              status: "actif",
              phone: "",
              email: "",
              position: undefined as unknown as UserFormValues["position"],
              avatarUrl: undefined,
            },
      );
      setShowPwd(false);
    }
  }, [open, initial, form]);

  const handleSubmit = form.handleSubmit(
    (values) => {
      onSubmit(values);
    },
    (errors) => {
      const first = Object.keys(errors)[0] as keyof UserFormValues | undefined;
      if (first) form.setFocus(first);
    },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
          </DialogTitle>
          <DialogDescription>
            Renseignez les informations ci-dessous. Les champs sont obligatoires.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photo de profil</FormLabel>
                  <FormControl>
                    <AvatarUploader
                      value={field.value}
                      onChange={field.onChange}
                      name={form.watch("fullName")}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom & prénom</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex. Sofia El Amrani" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom d'utilisateur</FormLabel>
                    <FormControl>
                      <Input placeholder="selamrani" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Mot de passe
                      {isEdit && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (laisser vide pour conserver)
                        </span>
                      )}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPwd ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPwd ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="nom@example.ma" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="+212 600 00 00 00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de poste</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un poste" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {USER_POSITIONS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville de l'agence</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une ville" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AGENCY_CITIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut du compte</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Statut" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {USER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === "actif" ? "Actif" : "Désactivé"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="submit">
                {isEdit ? "Enregistrer" : "Créer l'utilisateur"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
