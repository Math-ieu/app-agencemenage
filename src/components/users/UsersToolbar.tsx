import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  search: string;
  onSearch: (v: string) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  onAdd: () => void;
};

const SIZES = [10, 25, 50, 100];

export function UsersToolbar({
  search,
  onSearch,
  pageSize,
  onPageSize,
  onAdd,
}: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <Button onClick={onAdd} className="md:order-3">
        <UserPlus className="mr-2 h-4 w-4" />
        Ajouter un utilisateur
      </Button>

      <div className="relative flex-1 md:max-w-sm md:order-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Rechercher par nom, email, pseudo…"
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground md:order-2">
        <span>Afficher</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => onPageSize(Number(v))}
        >
          <SelectTrigger className="w-[88px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>entrées</span>
      </div>
    </div>
  );
}
