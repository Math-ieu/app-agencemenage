import { LayoutDashboard } from "lucide-react";

const Blog = () => {
  return (
    <div className="min-h-screen bg-background blog-literal flex items-center justify-center p-8">
      <div className="max-w-md w-full premium-card p-12 text-center space-y-6">
        <div className="h-20 w-20 rounded-3xl bg-accent/10 text-accent flex items-center justify-center mx-auto shadow-lg shadow-accent/5">
          <LayoutDashboard className="h-10 w-10 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Gestion du Blog</h1>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Cette page est actuellement <span className="text-accent font-semibold">en cours de développement</span>.
          </p>
        </div>
        <div className="pt-4">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent animate-progress-buffer w-1/3 rounded-full" />
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-4 font-bold opacity-60">Merci de votre patience</p>
        </div>
      </div>
    </div>
  );
};

export default Blog;
