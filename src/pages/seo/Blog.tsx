import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Plus, FileText, Send, Edit,
  Search, Calendar as CalendarIcon, Edit2, Eye, Trash2,
  ChevronDown
} from "lucide-react";
import { getBlogPosts, deleteBlogPost, updateBlogPost } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Blog() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('tous');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const res = await getBlogPosts();
      setArticles(res.data.results || res.data);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du chargement des articles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const handleEdit = (article: any) => {
    navigate(`/seo/blog/edit/${article.slug || article.id}`);
  };

  const handleNew = () => {
    navigate('/seo/blog/new');
  };

  const handleDelete = async (article: any) => {
    if (window.confirm('Voulez-vous vraiment supprimer cet article ?')) {
      try {
        await deleteBlogPost(article.slug || article.id);
        toast.success('Article supprimé');
        fetchArticles();
      } catch (error) {
         toast.error('Erreur lors de la suppression');
      }
    }
  };

  const handlePublishToggle = async (article: any) => {
     const newStatus = article.status === 'published' ? 'draft' : 'published';
     try {
        const formData = new FormData();
        formData.append('status', newStatus);
        
        await updateBlogPost(article.slug || article.id, formData);
        toast.success(`Article ${newStatus === 'published' ? 'publié' : 'passé en brouillon'}`);
        fetchArticles();
     } catch(e) {
        toast.error('Erreur lors de la modification du statut');
     }
  };

  const filtered = articles.filter((a) => {
    const q = search.toLowerCase();
    const matchQ = (a.title && a.title.toLowerCase().includes(q)) || (a.excerpt && a.excerpt.toLowerCase().includes(q));
    const matchS = statusFilter === 'tous' || a.status === statusFilter;
    
    // date filtering (using built-in JS dates)
    const articleDate = a.published_at || a.created_at;
    const matchD1 = !dateStart || (articleDate && articleDate >= dateStart);
    // Simple end date compare
    const matchD2 = !dateEnd || (articleDate && articleDate <= dateEnd + 'T23:59:59');
    
    return matchQ && matchS && matchD1 && matchD2;
  });

  const total = articles.length;
  const published = articles.filter((a) => a.status === 'published').length;
  const drafts = articles.filter((a) => a.status === 'draft').length;

  return (
    <div className="page" style={{ padding: '2rem', maxWidth: '100%', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: '#0ea5e9', padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LayoutDashboard size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Gestion du Blog</h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, marginTop: '2px' }}>Créez et gérez vos articles</p>
          </div>
        </div>
        <button
          onClick={handleNew}
          style={{
            background: '#0ea5e9',
            color: 'white',
            border: 'none',
            padding: '9px 18px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#0284c7'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#0ea5e9'}
        >
          <Plus size={16} />
          Nouvel article
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '2rem' }}>
        <StatCard icon={<FileText size={18} />} iconBg="#f1f5f9" iconColor="#64748b" value={total} label="Total" />
        <StatCard icon={<Send size={18} />} iconBg="#e0f2fe" iconColor="#0ea5e9" value={published} label="Publiés" />
        <StatCard icon={<Edit size={18} />} iconBg="#fef9c3" iconColor="#ca8a04" value={drafts} label="Brouillons" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Rechercher un article..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={inputStyle({ paddingLeft: '34px' })}
          />
        </div>

        {/* Status */}
        <div style={{ position: 'relative' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...inputStyle({ paddingRight: '32px', minWidth: '170px' }), appearance: 'none', cursor: 'pointer' }}
          >
            <option value="tous">Tous les statuts</option>
            <option value="published">Publiés</option>
            <option value="draft">Brouillons</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
        </div>

        {/* Date début */}
        <div style={{ position: 'relative' }}>
          <CalendarIcon size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            placeholder="Date début"
            style={inputStyle({ paddingLeft: '32px', width: '140px', color: dateStart ? '#0f172a' : '#94a3b8' })}
          />
        </div>

        {/* Date fin */}
        <div style={{ position: 'relative' }}>
          <CalendarIcon size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            placeholder="Date fin"
            style={inputStyle({ paddingLeft: '32px', width: '140px', color: dateEnd ? '#0f172a' : '#94a3b8' })}
          />
        </div>
      </div>

      {/* Articles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '14px' }}>
                Chargement des articles...
            </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '14px' }}>
            Aucun article trouvé.
          </div>
        ) : null}
        
        {!isLoading && filtered.map((article) => (
          <ArticleCard 
            key={article.id} 
            article={article} 
            onEdit={() => handleEdit(article)}
            onDelete={() => handleDelete(article)}
            onTogglePublish={() => handlePublishToggle(article)}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, value, label }: any) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #f1f5f9',
      borderRadius: '12px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '8px',
        background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>{label}</div>
      </div>
    </div>
  );
}

function ArticleCard({ article, onEdit, onDelete, onTogglePublish }: any) {
  const [hovered, setHovered] = useState(false);

  // Format date nicely
  const dateStr = article.published_at || article.created_at;
  const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('fr-FR') : '';

  const isPublished = article.status === 'published';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        border: `1px solid ${hovered ? '#e2e8f0' : '#f1f5f9'}`,
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        boxShadow: hovered ? '0 4px 16px -4px rgba(6,81,237,0.12)' : '0 1px 4px rgba(0,0,0,0.03)',
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {isPublished ? (
            <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px' }}>
              Publié
            </span>
          ) : (
            <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              Brouillon
            </span>
          )}
          <span style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: '500', padding: '3px 10px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
            {article.category_name || article.category || 'Sans catégorie'}
          </span>
        </div>

        {/* Title + excerpt */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: hovered ? '#0ea5e9' : '#0f172a', margin: 0, transition: 'color 0.2s' }}>
            {article.title}
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0', lineHeight: '1.5', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {article.excerpt || "Aucun extrait"}
          </p>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
          <span>{article.author_name || article.author || 'Auteur'}</span>
          {formattedDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CalendarIcon size={12} />
              {formattedDate}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.2s',
        flexShrink: 0, marginLeft: '16px',
      }}>
        <ActionBtn title="Éditer" onClick={onEdit} hoverColor="#64748b" hoverBg="#f1f5f9" icon={<Edit2 size={16} />} />
        
        {/* Link to public blog article */}
        <ActionBtn 
          title="Aperçu" 
          onClick={() => window.open(`/seo/blog/edit/${article.slug || article.id}?preview=true`, '_blank')} 
          hoverColor="#64748b" 
          hoverBg="#f1f5f9" 
          icon={<Eye size={16} />} 
        />

        <ActionBtn 
          title={isPublished ? "Passer en brouillon" : "Publier"} 
          onClick={onTogglePublish} 
          hoverColor="#0ea5e9" hoverBg="#e0f2fe" 
          icon={isPublished ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg> : <Send size={16} />} 
        />
        <ActionBtn title="Supprimer" onClick={onDelete} hoverColor="#ef4444" hoverBg="#fef2f2" icon={<Trash2 size={16} />} />
      </div>
    </div>
  );
}

function ActionBtn({ icon, title, hoverColor, hoverBg, onClick }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '34px', height: '34px', border: 'none', cursor: 'pointer',
        borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hovered ? hoverBg : 'transparent',
        color: hovered ? hoverColor : '#94a3b8',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {icon}
    </button>
  );
}

function inputStyle(overrides = {}) {
  return {
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    background: 'white',
    color: '#0f172a',
    outline: 'none',
    width: '100%',
    ...overrides,
  };
}