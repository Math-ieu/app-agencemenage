// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getBlogPost, createBlogPost, updateBlogPost, getBlogCategories } from "@/api/client";
import { toast } from "sonner";
import { generateId } from "@/lib/blog-data";
import {
  ArrowLeft, Eye, EyeOff, Save, Send, Phone, Link,
  Bold, Italic, List, ListOrdered, Quote, Undo, Redo,
  Image as ImageIcon, X
} from "lucide-react";

const generateSlug = (title) =>
  title.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

const SERVICES = [
  "Menage standard", "Grand Menage", "Menage Airbnb",
  "Nettoyage post-demenagement", "Menage fin de chantier",
  "Auxiliaire de vie / Garde malade", "Menage Post-sinistre",
  "Menages bureaux", "Placement & Gestion",
  "Nettoyage Fin de chantier (Entreprise)", "Menage Post-sinistre (Entreprise)",
];

const CATEGORIES = ["Particuliers", "Entreprises", "Airbnb", "Post-demenagement"];

const st = {
  header: {
    position: "sticky", top: 0, zIndex: 10,
    background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
    borderBottom: "1px solid #e2e8f0",
  },
  headerInner: {
    maxWidth: 1280, margin: "0 auto", padding: "10px 24px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  backBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 14, color: "#374151", padding: "6px 8px", borderRadius: 6,
  },
  card: {
    background: "white", border: "1px solid #e2e8f0",
    borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  sectionTitle: {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 14px",
  },
  stepBadge: {
    width: 24, height: 24, borderRadius: 6,
    background: "#e0f2fe", color: "#0ea5e9",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  desc: { fontSize: 12, color: "#94a3b8", margin: "0 0 12px" },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 },
  input: {
    width: "100%", padding: "8px 12px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, color: "#0f172a", background: "white",
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  },
  select: {
    width: "100%", padding: "8px 12px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    fontSize: 14, color: "#0f172a", background: "white",
    outline: "none", boxSizing: "border-box", cursor: "pointer",
  },
  serviceTag: {
    padding: "5px 12px", borderRadius: 20,
    border: "1px solid", fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  tag: {
    display: "inline-flex", alignItems: "center", gap: 4,
    background: "#e0f2fe", color: "#0369a1",
    fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20,
  },
  thumb: {
    width: 80, height: 80, borderRadius: 8, overflow: "hidden",
    border: "1px solid #e2e8f0", position: "relative", flexShrink: 0,
  },
};

function SectionCard({ number, title, description, children }) {
  return (
    <div style={st.card}>
      <h3 style={st.sectionTitle}>
        <span style={st.stepBadge}>{number}</span>
        {title}
      </h3>
      {description && <p style={st.desc}>{description}</p>}
      {children}
    </div>
  );
}

function HeaderButton({ onClick, icon, label, primary, disabled }: any) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer", border: "1px solid",
        background: primary ? (hov ? "#0284c7" : "#0ea5e9") : (hov ? "#f8fafc" : "white"),
        color: primary ? "white" : "#374151",
        borderColor: primary ? "transparent" : "#e2e8f0",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ToolbarBtn({ onMD, children, title }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onMouseDown={onMD}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, border: "none", cursor: "pointer",
        borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center",
        color: "#374151", background: hov ? "#f1f5f9" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function RichTextEditor({ onChange }) {
  const editorRef = useRef(null);
  const exec = (cmd, val) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(cmd, false, val || null);
  };
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap",
        padding: "6px 8px", borderBottom: "1px solid #e2e8f0", background: "#fafafa",
      }}>
        <ToolbarBtn title="Gras" onMD={(e) => { e.preventDefault(); exec("bold"); }}><Bold size={14} /></ToolbarBtn>
        <ToolbarBtn title="Italique" onMD={(e) => { e.preventDefault(); exec("italic"); }}><Italic size={14} /></ToolbarBtn>
        <ToolbarBtn title="H2" onMD={(e) => { e.preventDefault(); exec("formatBlock", "h2"); }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>H2</span>
        </ToolbarBtn>
        <ToolbarBtn title="H3" onMD={(e) => { e.preventDefault(); exec("formatBlock", "h3"); }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>H3</span>
        </ToolbarBtn>
        <ToolbarBtn title="Liste" onMD={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}><List size={14} /></ToolbarBtn>
        <ToolbarBtn title="Liste num." onMD={(e) => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered size={14} /></ToolbarBtn>
        <ToolbarBtn title="Citation" onMD={(e) => { e.preventDefault(); exec("formatBlock", "blockquote"); }}><Quote size={14} /></ToolbarBtn>
        <ToolbarBtn title="Lien" onMD={(e) => {
          e.preventDefault();
          const url = prompt("URL :");
          if (url) exec("createLink", url);
        }}><Link size={14} /></ToolbarBtn>
        <div style={{ width: 1, height: 18, background: "#e2e8f0", margin: "0 4px" }} />
        <ToolbarBtn title="Annuler" onMD={(e) => { e.preventDefault(); exec("undo"); }}><Undo size={14} /></ToolbarBtn>
        <ToolbarBtn title="Retablir" onMD={(e) => { e.preventDefault(); exec("redo"); }}><Redo size={14} /></ToolbarBtn>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        style={{ minHeight: 220, padding: "12px 14px", fontSize: 14, color: "#0f172a", outline: "none", lineHeight: 1.7 }}
      />
    </div>
  );
}

function GalleryManager({ images, onChange }) {
  const fileRef = useRef(null);
  const [mediaTitle, setMediaTitle] = useState("");

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange([...images, { url: ev.target.result, title: mediaTitle }]);
      setMediaTitle("");
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {images.map((img, i) => (
            <div key={i} style={st.thumb}>
              <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                style={{
                  position: "absolute", top: 3, right: 3,
                  background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 4,
                  color: "white", cursor: "pointer", width: 18, height: 18,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ border: "1px dashed #cbd5e1", borderRadius: 8, padding: "14px 16px", background: "#fafafa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <ImageIcon size={15} color="#94a3b8" />
          <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>Ajouter une image ou video</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={st.label}>Fichier (image ou video)</label>
            <input
              ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile}
              style={{ fontSize: 13, width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 10px", background: "white", boxSizing: "border-box", cursor: "pointer" }}
            />
          </div>
          <div>
            <label style={st.label}>Titre (optionnel)</label>
            <input type="text" value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} placeholder="Titre du media" style={st.input} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceSelector({ selected, onChange }) {
  const toggle = (item) =>
    onChange(selected.includes(item) ? selected.filter((x) => x !== item) : [...selected, item]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {SERVICES.map((item) => {
        const active = selected.includes(item);
        return (
          <button
            key={item}
            onClick={() => toggle(item)}
            style={{
              ...st.serviceTag,
              background: active ? "#0ea5e9" : "white",
              color: active ? "white" : "#334155",
              borderColor: active ? "#0ea5e9" : "#cbd5e1",
            }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map((t) => (
            <span key={t} style={st.tag}>
              {t}
              <button
                onClick={() => onChange(tags.filter((x) => x !== t))}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#0369a1", padding: 0, display: "flex", alignItems: "center" }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        placeholder="Ajouter un tag et appuyer Entree..."
        style={st.input}
      />
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useState(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  });
  return isMobile;
}

export default function ArticleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState([]);
  const isMobile = useIsMobile();
  const today = new Date().toISOString().split("T")[0];

  const onBack = () => navigate("/seo/blog");

  const [form, setForm] = useState<any>({
    title: "", slug: "", excerpt: "", content: "",
    author: "Equipe Clean Cards", category: "Particuliers",
    tags: [], status: "draft", publishedAt: today,
    gallery: [], recommendedServices: [],
    ctaContactLink: "/contact", ctaPhone: "+212 5 22 00 00 00",
    servicesSection: [],
  });

  useEffect(() => {
    getBlogCategories().then(res => {
       const cats = res.data?.results || res.data || [];
       setDynamicCategories(cats);
       if (cats.length > 0 && form.category === "Particuliers") {
           setForm(prev => ({ ...prev, category: cats[0].id.toString() }));
       }
    }).catch(e => console.error(e));

    if (id) {
      setIsLoading(true);
      getBlogPost(id).then(res => {
        const article = res.data;
        setForm(prev => ({
          ...prev,
          title: article.title || "",
          slug: article.slug || "",
          excerpt: article.excerpt || "",
          content: article.content || "",
          status: article.status || "draft",
          category: article.category?.toString() || prev.category, 
          author: article.author_name || article.author || prev.author,
          
          tags: prev.tags,
          gallery: prev.gallery,
          recommendedServices: prev.recommendedServices,
          servicesSection: prev.servicesSection
        }));
      }).catch(err => {
        toast.error("Article introuvable");
        navigate("/seo/blog");
      }).finally(() => {
        setIsLoading(false);
      });
    }
  }, [id, navigate]);

  const updateField = (key, value) => {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "title" && !isEditing) updated.slug = generateSlug(value);
      return updated;
    });
  };

  const handleSave = async (publish) => {
    if (!form.title.trim()) { toast.error("Le titre est requis"); return; }
    if (!form.slug.trim()) { toast.error("Le slug est requis"); return; }
    
    const formData = new FormData();
    formData.append("title", form.title);
    if (!isEditing) formData.append("slug", form.slug || generateSlug(form.title));
    if (form.excerpt) formData.append("excerpt", form.excerpt);
    if (form.content) formData.append("content", form.content);
    
    if (form.category && form.category !== "Particuliers") {
      formData.append("category", form.category.toString());
    }
    
    const finalStatus = publish ? "published" : (form.status || "draft");
    formData.append("status", finalStatus);

    if (form.gallery && form.gallery.length > 0) {
      const firstImg = form.gallery[0];
      if (firstImg.url && firstImg.url.startsWith('data:')) {
         const res = await fetch(firstImg.url);
         const blob = await res.blob();
         formData.append("featured_image", blob, `cover-${generateId()}.${blob.type.split('/')[1]}`);
      }
    }

    try {
       setIsLoading(true);
       if (isEditing) {
         await updateBlogPost(id!, formData);
         toast.success(publish ? "Article publié !" : "Article mis à jour !");
       } else {
         await createBlogPost(formData);
         toast.success(publish ? "Article créé et publié !" : "Brouillon sauvegardé !");
       }
       navigate("/seo/blog");
    } catch(err: any) {
       console.error(err);
       toast.error(err.response?.data?.detail || "Erreur lors de la sauvegarde");
    } finally {
       setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header style={st.header}>
        <div style={{ ...st.headerInner, padding: isMobile ? "10px 16px" : "10px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
            <button onClick={onBack} style={st.backBtn}>
              <ArrowLeft size={16} />
              {!isMobile && <span>Retour</span>}
            </button>
            <h1 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 600, color: "#0f172a", margin: 0 }}>
              {isEditing ? "Modifier" : "Nouvel article"}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8 }}>
            <HeaderButton
              onClick={() => setShowPreview(!showPreview)}
              icon={showPreview ? <EyeOff size={15} /> : <Eye size={15} />}
              label={isMobile ? "" : (showPreview ? "Editer" : "Apercu")}
            />
            <HeaderButton onClick={() => handleSave(false)} icon={<Save size={15} />} label={isMobile ? "" : "Brouillon"} disabled={isLoading} primary={false} />
            <HeaderButton onClick={() => handleSave(true)} icon={<Send size={15} />} label={isLoading ? "..." : (isMobile ? "" : "Publier")} primary disabled={isLoading} />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: isMobile ? "16px 12px 48px" : "24px 24px 48px" }}>
        {showPreview ? (
          <div style={st.card}>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#0f172a" }}>{form.title || "Sans titre"}</h2>
            {form.excerpt && <p style={{ color: "#64748b", marginBottom: 16 }}>{form.excerpt}</p>}
            <div style={{ fontSize: 15, lineHeight: 1.8, color: "#334155" }} dangerouslySetInnerHTML={{ __html: form.content || "<p style='color:#94a3b8'>Aucun contenu.</p>" }} />
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 340px",
            gap: isMobile ? 16 : 24,
            alignItems: "start",
          }}>

            {/* Main sections */}
            <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 20 }}>

              <SectionCard number={1} title="Titre de l'article">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={st.label}>Titre</label>
                    <input type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Titre de l'article" style={st.input} />
                  </div>
                  <div>
                    <label style={st.label}>Slug (URL)</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <span style={{ fontSize: 13, color: "#94a3b8", whiteSpace: "nowrap" }}>/blog/</span>
                      <input type="text" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} placeholder="slug-de-l-article" disabled={isEditing} style={{ ...st.input, flex: 1, opacity: isEditing ? 0.6 : 1 }} />
                    </div>
                  </div>
                  <div>
                    <label style={st.label}>Extrait</label>
                    <textarea value={form.excerpt} onChange={(e) => updateField("excerpt", e.target.value)} placeholder="Resume court de l'article..." rows={3} style={{ ...st.input, resize: "vertical" }} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard number={2} title="Contenu de l'article">
                <RichTextEditor onChange={(v) => updateField("content", v)} />
              </SectionCard>

              <SectionCard number={3} title="Galerie d'images" description="Ajoutez plusieurs images avec un titre pour chacune.">
                <GalleryManager images={form.gallery} onChange={(g) => updateField("gallery", g)} />
              </SectionCard>

              <SectionCard number={4} title="Nos services recommandes" description="Selectionnez les services a recommander dans cet article.">
                <ServiceSelector selected={form.recommendedServices} onChange={(v) => updateField("recommendedServices", v)} />
              </SectionCard>

              <SectionCard number={5} title="Pret a passer a l'action" description="Configurez le lien de contact et le numero de telephone pour l'appel a l'action.">
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={st.label}>Lien contact</label>
                    <input type="text" value={form.ctaContactLink} onChange={(e) => updateField("ctaContactLink", e.target.value)} placeholder="/contact" style={st.input} />
                  </div>
                  <div>
                    <label style={st.label}>Numero de telephone</label>
                    <input type="text" value={form.ctaPhone} onChange={(e) => updateField("ctaPhone", e.target.value)} placeholder="+212 5 22 00 00 00" style={st.input} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard number={6} title="Nos services" description="Selectionnez les services a afficher dans la section Nos services.">
                <ServiceSelector selected={form.servicesSection} onChange={(v) => updateField("servicesSection", v)} />
              </SectionCard>

              {/* Sidebar cards shown inline on mobile, after section 6 */}
              {isMobile && (
                <>
                  <div style={st.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Parametres</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={st.label}>Auteur</label>
                        <input type="text" value={form.author} onChange={(e) => updateField("author", e.target.value)} style={st.input} />
                      </div>
                      <div>
                        <label style={st.label}>Categorie</label>
                        <select value={form.category} onChange={(e) => updateField("category", e.target.value)} style={st.select}>
                          {dynamicCategories.length > 0 ? (
                            dynamicCategories.map((c) => <option key={c.id} value={c.id.toString()}>{c.name}</option>)
                          ) : (
                            CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)
                          )}
                        </select>
                      </div>
                      <div>
                        <label style={st.label}>Statut</label>
                        <select value={form.status} onChange={(e) => updateField("status", e.target.value)} style={st.select}>
                          <option value="draft">Brouillon</option>
                          <option value="published">Publie</option>
                        </select>
                      </div>
                      <div>
                        <label style={st.label}>Date de publication</label>
                        <input type="date" value={form.publishedAt} onChange={(e) => updateField("publishedAt", e.target.value)} style={st.input} />
                      </div>
                    </div>
                  </div>

                  <div style={st.card}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" }}>Tags</h3>
                    <p style={{ ...st.desc, marginBottom: 12 }}>Tapez un tag et appuyez sur Entree pour l'ajouter.</p>
                    <TagInput tags={form.tags} onChange={(v) => updateField("tags", v)} />
                  </div>
                </>
              )}
            </div>

            {/* Sidebar — desktop only */}
            {!isMobile && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={st.card}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Parametres</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label style={st.label}>Auteur</label>
                      <input type="text" value={form.author} onChange={(e) => updateField("author", e.target.value)} style={st.input} />
                    </div>
                    <div>
                      <label style={st.label}>Categorie</label>
                      <select value={form.category} onChange={(e) => updateField("category", e.target.value)} style={st.select}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={st.label}>Statut</label>
                      <select value={form.status} onChange={(e) => updateField("status", e.target.value)} style={st.select}>
                        <option value="draft">Brouillon</option>
                        <option value="published">Publie</option>
                      </select>
                    </div>
                    <div>
                      <label style={st.label}>Date de publication</label>
                      <input type="date" value={form.publishedAt} onChange={(e) => updateField("publishedAt", e.target.value)} style={st.input} />
                    </div>
                  </div>
                </div>

                <div style={st.card}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 6px" }}>Tags</h3>
                  <p style={{ ...st.desc, marginBottom: 12 }}>Tapez un tag et appuyez sur Entree pour l'ajouter.</p>
                  <TagInput tags={form.tags} onChange={(v) => updateField("tags", v)} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}