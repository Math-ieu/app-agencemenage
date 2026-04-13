import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';

// Layout & Auth
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import { ToastContainer } from './components/common/Toast';

// Pages
import Dashboard from './pages/Dashboard';
import DemandesEnAttente from './pages/DemandesEnAttente';
import Clients from './pages/Clients';
import Profils from './pages/Profils';
import Historique from './pages/Historique';
import VueGlobale from './pages/finance/VueGlobale';
import LaCaisse from './pages/finance/LaCaisse';
import Qualite from './pages/Qualite';
import Marketing from './pages/Marketing';
import Parametres from './pages/Parametres';
import ClientDetails from './pages/ClientDetails.tsx';
import ProfilDetails from './pages/ProfilDetails.tsx';
import Blog from './pages/seo/Blog';
import ArticleForm from './components/blog/ArticleForm';


// Navigation guard function
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected Routes directly inside Layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="demandes" element={<DemandesEnAttente />} />
          <Route path="clients/:id" element={<ClientDetails />} />
          <Route path="clients" element={<Clients />} />
          <Route path="profils/:id" element={<ProfilDetails />} />
          <Route path="profils" element={<Profils />} />
          <Route path="historique" element={<Historique />} />
          <Route path="finance">
            <Route path="vue-globale" element={<VueGlobale />} />
            <Route path="la-caisse" element={<LaCaisse />} />
          </Route>
          <Route path="qualite" element={<Qualite />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="parametres" element={<Parametres />} />

          {/* SEO / Blog Routes */}
          <Route path="seo">
            <Route path="blog" element={<Blog />} />
            <Route path="blog/new" element={<ArticleForm />} />
            <Route path="blog/edit/:id" element={<ArticleForm />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
