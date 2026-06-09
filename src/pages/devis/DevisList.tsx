import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/quote-types";
import { Eye, Trash2, Plus, Calculator } from "lucide-react";
import { toast } from "sonner";
import { getDemandes, deleteDemande, getDemande } from "@/api/client";
import { generateDevisPdf } from "@/lib/devis/generate-devis";

export default function DevisList() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchList = async () => {
    setIsLoading(true);
    try {
      const res = await getDemandes();
      // Filter demands to show only those where is_devis is true
      const quotes = (res.data || []).filter((d: any) => d.is_devis === true);
      setData(quotes);
    } catch (e: any) {
      toast.error("Erreur lors de la récupération des devis");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce devis ?")) return;
    try {
      await deleteDemande(id);
      toast.success("Devis supprimé");
      fetchList();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  };

  const handleViewPdf = async (id: number) => {
    try {
      toast.info("Génération du devis PDF...");
      const res = await getDemande(id);
      const { blob } = await generateDevisPdf(res.data);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error("Erreur lors de la génération de l'aperçu PDF");
      console.error(e);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des devis</h1>
          <p className="text-sm text-muted-foreground">Gérer et éditer les devis personnalisés (Autre service)</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/devis/calculateur">
              <Calculator className="h-4 w-4 mr-2" /> Calculateur
            </Link>
          </Button>
          <Button asChild>
            <Link to="/devis/nouveau">
              <Plus className="h-4 w-4 mr-2" /> Créer un devis
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mes devis personnalisés</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : !data.length ? (
            <p className="text-sm text-muted-foreground">Aucun devis personnalisé trouvé. Créez-en un nouveau.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Date prestation</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono">#{q.id}</TableCell>
                    <TableCell className="font-medium">{q.client_name}</TableCell>
                    <TableCell>{q.service}</TableCell>
                    <TableCell>{q.client_city ?? "—"}</TableCell>
                    <TableCell>
                      {q.date_intervention ? new Date(q.date_intervention).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(q.prix ?? 0)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => handleViewPdf(q.id)} title="Voir le devis PDF">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(q.id)} title="Supprimer">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
