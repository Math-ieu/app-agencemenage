export interface GalleryImage {
  id: string;
  url: string;
  title?: string;
  type?: "image" | "video";
}

export interface BlogArticle {
  id: string | number;
  title: string;
  slug: string;
  coverImage?: string;
  excerpt: string;
  content: string;
  author: string;
  category: string | number;
  tags: string[];
  status: "draft" | "published";
  publishedAt: string;
  createdAt?: string;
  updatedAt?: string;
  gallery: GalleryImage[];
  recommendedServices: string[];
  ctaContactLink: string;
  ctaPhone: string;
  servicesSection: string[];
}

export const CATEGORIES = [
  "Particuliers",
  "Professionnels",
  "Astuces",
  "Événements"
];

export const AVAILABLE_SERVICES = [
  "Ménage à domicile",
  "Nettoyage bureau",
  "Fin de chantier",
  "Entretien vitres",
  "Nettoyage canapé",
  "Repassage"
];

export const generateId = () => Math.random().toString(36).substr(2, 9);
export const generateSlug = (text: string) => text.toLowerCase().replace(/[\\s_]+/g, '-').replace(/[^\\w-]+/g, '');

// Placeholder mocks so that the UI can function if the backend fails, 
// though we use the real API in ArticleForm.
export const getArticle = (id: string) => null;
export const saveArticle = (article: BlogArticle) => {};
