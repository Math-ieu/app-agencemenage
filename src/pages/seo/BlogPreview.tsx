import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye } from "lucide-react";

const BlogPreview = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background blog-literal flex items-center justify-center p-8">
      <div className="max-w-md w-full premium-card p-12 text-center space-y-6">
        <div className="h-20 w-20 rounded-3xl bg-accent/10 text-accent flex items-center justify-center mx-auto shadow-lg shadow-accent/5">
          <Eye className="h-10 w-10 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Aperçu de l'article</h1>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Le mode prévisualisation est <span className="text-accent font-semibold">en cours de développement</span>.
          </p>
        </div>
        <div className="pt-4">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent animate-progress-buffer w-1/5 rounded-full" />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-4 font-bold opacity-60">Merci de votre patience</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/seo/blog")} className="mt-4 rounded-xl border-border bg-card">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour au blog
        </Button>
      </div>
    </div>
  );
};

export default BlogPreview;
