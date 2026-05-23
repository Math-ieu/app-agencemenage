import { Pencil, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { User } from "@/lib/user-schema";

type Props = {
  users: User[];
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UsersTable({ users, onEdit, onDelete }: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[64px]">Photo</TableHead>
              <TableHead>Nom & prénom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Poste</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Nom d'utilisateur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucun utilisateur trouvé.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow
                  key={u.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  <TableCell>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatarUrl} alt={u.fullName} />
                      <AvatarFallback>{initials(u.fullName)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.email}
                  </TableCell>
                  <TableCell>{u.position}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.city}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    @{u.username}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.status === "actif" ? "default" : "outline"}
                      className={
                        u.status === "actif"
                          ? "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {u.status === "actif" ? "Actif" : "Désactivé"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onEdit(u)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Modifier</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => onDelete(u)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Supprimer</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {users.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
            Aucun utilisateur trouvé.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="flex gap-3 rounded-lg border bg-card p-4 shadow-sm"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={u.avatarUrl} alt={u.fullName} />
                <AvatarFallback>{initials(u.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{u.username} · {u.email}
                    </p>
                  </div>
                  <Badge
                    variant={u.status === "actif" ? "default" : "outline"}
                    className={
                      u.status === "actif"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {u.status === "actif" ? "Actif" : "Désactivé"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">{u.city}</Badge>
                  <span className="text-muted-foreground">{u.position}</span>
                </div>
                <div className="mt-3 flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(u)}
                  >
                    <Pencil className="mr-1 h-4 w-4" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onDelete(u)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </TooltipProvider>
  );
}
