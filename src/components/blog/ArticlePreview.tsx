import { BlogArticle } from "@/lib/blog-data";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, User, Phone, ExternalLink, CheckCircle } from "lucide-react";

interface ArticlePreviewProps {
  article: Partial<BlogArticle>;
}

const ArticlePreview = ({ article }: ArticlePreviewProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-8">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aperçu de l'article</div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {article.tags?.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
        ))}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground leading-tight">
        {article.title || "Titre de l'article"}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {article.author && (
          <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{article.author}</span>
        )}
        {article.publishedAt && (
          <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{article.publishedAt}</span>
        )}
      </div>

      {/* Excerpt */}
      {article.excerpt && (
        <p className="text-muted-foreground italic border-l-2 border-accent pl-4">{article.excerpt}</p>
      )}

      {/* Content */}
      {article.content && (
        <div
          className="prose prose-sm max-w-none text-foreground"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      )}

      {/* Gallery */}
      {article.gallery && article.gallery.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Galerie</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {article.gallery.map((img) => (
              <div key={img.id} className="rounded-lg overflow-hidden border border-border">
                <img src={img.url} alt={img.title} className="w-full aspect-video object-cover" />
                {img.title && (
                  <p className="text-xs text-muted-foreground p-2 text-center">{img.title}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Services */}
      {article.recommendedServices && article.recommendedServices.length > 0 && (
        <div className="space-y-3 rounded-lg bg-accent/5 border border-accent/20 p-5">
          <h2 className="text-lg font-semibold text-foreground">Nos services recommandés</h2>
          <div className="flex flex-wrap gap-2">
            {article.recommendedServices.map((service) => (
              <Badge key={service} className="bg-accent text-accent-foreground text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                {service}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      {(article.ctaContactLink || article.ctaPhone) && (
        <div className="rounded-lg bg-primary text-primary-foreground p-6 text-center space-y-3">
          <h2 className="text-lg font-bold">Prêt à passer à l'action ?</h2>
          <p className="text-sm opacity-90">Réservez votre ménage dès maintenant</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {article.ctaContactLink && (
              <span className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium">
                <ExternalLink className="h-3.5 w-3.5" />
                Nous contacter
              </span>
            )}
            {article.ctaPhone && (
              <span className="inline-flex items-center gap-1.5 border border-primary-foreground/30 rounded-lg px-4 py-2 text-sm">
                <Phone className="h-3.5 w-3.5" />
                {article.ctaPhone}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Services section */}
      {article.servicesSection && article.servicesSection.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Nos services</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {article.servicesSection.map((service) => (
              <div key={service} className="rounded-lg border border-border p-3 text-center text-sm text-foreground bg-muted/30">
                {service}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticlePreview;
