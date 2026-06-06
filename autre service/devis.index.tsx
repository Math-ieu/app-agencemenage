import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listQuotes, deleteQuote } from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/quote-types";
import { Eye, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/devis/")({
  head: () => ({ meta: [{ title: "Mes devis" }] }),
  component: ListPage,
});

function ListPage() {
  const fetchList = useServerFn(listQuotes);
  const del = useServerFn(deleteQuote);
  const router = useRouter();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => fetchList(),
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce devis ?")) return;
    try {
      await del({ data: { id } });
      toast.success("Devis supprimé");
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mes devis</CardTitle>
        <Button asChild size="sm"><Link to="/devis/nouveau"><Plus className="h-4 w-4 mr-1" />Créer un autre service/devis</Link></Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !data?.quotes.length ? (
          <p className="text-sm text-muted-foreground">Aucun devis. Créez-en un.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Date prestation</TableHead>
                <TableHead className="text-right">TTC</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.quotes.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono">{q.quote_number}</TableCell>
                  <TableCell>{q.client_name}</TableCell>
                  <TableCell>{q.client_city ?? "—"}</TableCell>
                  <TableCell>{q.service_date ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(q.amount_ttc)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button asChild size="icon" variant="ghost">
                      <Link to="/devis/$id" params={{ id: q.id }}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
