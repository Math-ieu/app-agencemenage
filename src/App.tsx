import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { getRolesPermissions } from './api/client';
import { hasPermission } from './utils/permissions';

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
import LesSuivis from './pages/finance/LesSuivis';
import LaCaisse from './pages/finance/LaCaisse';
import Qualite from './pages/Qualite';
import Marketing from './pages/Marketing';
import ParametresProfil from './pages/parametres/Profil';
import ParametresUtilisateurs from './pages/parametres/Utilisateurs';
import ParametresJoursFeries from './pages/parametres/JoursFeries';
import ClientDetails from './pages/ClientDetails.tsx';
import ProfilDetails from './pages/ProfilDetails.tsx';
import Blog from './pages/seo/Blog';
import ArticleForm from './components/blog/ArticleForm';
import MoteurDevis from './pages/MoteurDevis';
import DevisList from './pages/devis/DevisList';
import DevisNouveau from './pages/devis/DevisNouveau';


// Navigation guard function
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Route permission guard
const PermissionRoute = ({ permission, children }: { permission: string; children: JSX.Element }) => {
  const { user } = useAuthStore();
  if (!hasPermission(user, permission)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && window.location.pathname !== '/login') {
      getRolesPermissions()
        .then((res) => {
          if (res.data) {
            localStorage.setItem('roles_permissions', JSON.stringify(res.data));
          }
        })
        .catch((err) => {
          console.error('Failed to sync roles permissions from API:', err);
        });
    }
  }, [isAuthenticated]);

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
          <Route index element={<PermissionRoute permission="consulter_dashboard"><Dashboard /></PermissionRoute>} />
          <Route path="demandes" element={<PermissionRoute permission="consulter_demandes"><DemandesEnAttente /></PermissionRoute>} />
          <Route path="clients/:id" element={<PermissionRoute permission="consulter_clients"><ClientDetails /></PermissionRoute>} />
          <Route path="clients" element={<PermissionRoute permission="consulter_clients"><Clients /></PermissionRoute>} />
          <Route path="profils/:id" element={<PermissionRoute permission="consulter_agents"><ProfilDetails /></PermissionRoute>} />
          <Route path="profils" element={<PermissionRoute permission="consulter_agents"><Profils /></PermissionRoute>} />
          <Route path="historique" element={<PermissionRoute permission="consulter_historique_global"><Historique /></PermissionRoute>} />
          <Route path="finance">
            <Route path="vue-globale" element={<PermissionRoute permission="voir_la_caisse"><VueGlobale /></PermissionRoute>} />
            <Route path="les-suivis" element={<PermissionRoute permission="voir_la_caisse"><LesSuivis /></PermissionRoute>} />
            <Route path="la-caisse" element={<PermissionRoute permission="voir_la_caisse"><LaCaisse /></PermissionRoute>} />
          </Route>
          <Route path="qualite" element={<PermissionRoute permission="consulter_retours_qualite"><Qualite /></PermissionRoute>} />
          <Route path="marketing" element={<PermissionRoute permission="consulter_marketing"><Marketing /></PermissionRoute>} />
          <Route path="devis" element={<DevisList />} />
          <Route path="devis/nouveau" element={<DevisNouveau />} />
          <Route path="devis/calculateur" element={<MoteurDevis />} />
          <Route path="parametres">
            <Route path="profil" element={<ParametresProfil />} />
            <Route path="utilisateurs" element={<PermissionRoute permission="parametres_globaux"><ParametresUtilisateurs /></PermissionRoute>} />
            <Route path="jours-feries" element={<PermissionRoute permission="parametres_globaux"><ParametresJoursFeries /></PermissionRoute>} />
          </Route>

          {/* SEO / Blog Routes */}
          <Route path="seo">
            <Route path="blog" element={<PermissionRoute permission="rediger_blog"><Blog /></PermissionRoute>} />
            <Route path="blog/new" element={<PermissionRoute permission="rediger_blog"><ArticleForm /></PermissionRoute>} />
            <Route path="blog/edit/:id" element={<PermissionRoute permission="rediger_blog"><ArticleForm /></PermissionRoute>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
