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
import GestionAbonnements from './pages/GestionAbonnements';
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

// Airbnb Module
import AirbnbLayout from './pages/airbnb/AirbnbLayout';
import ClientsBiensView from './pages/airbnb/ClientsBiensView';
import NouvelleCommandeView from './pages/airbnb/NouvelleCommandeView';
import DossierCommandeView from './pages/airbnb/DossierCommandeView';
import RunnerLaverieView from './pages/airbnb/RunnerLaverieView';
import PlanningExecutionView from './pages/airbnb/PlanningExecutionView';
import FacturationAirbnbView from './pages/airbnb/FacturationAirbnbView';
import EspaceConciergerieView from './pages/airbnb/EspaceConciergerieView';
import ParametresAirbnbView from './pages/airbnb/ParametresAirbnbView';
import RunnerApp from './pages/runner/RunnerApp';
import EspaceLingeApp from './pages/laverie/EspaceLingeApp';


// Navigation guard function
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Route permission guard
const PermissionRoute = ({ permission, children }: { permission: string; children: JSX.Element }) => {
  const { user } = useAuthStore();
  const permissions = permission.split('|');
  const allowed = permissions.some(perm => hasPermission(user, perm.trim()));
  if (!allowed) {
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

        {/* Dedicated Standalone Applications (No Backoffice Sidebar) */}
        <Route
          path="/runner"
          element={
            <ProtectedRoute>
              <RunnerApp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/laverie"
          element={
            <ProtectedRoute>
              <EspaceLingeApp />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portail-conciergerie"
          element={
            <ProtectedRoute>
              <EspaceConciergerieView />
            </ProtectedRoute>
          }
        />

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
          <Route path="gestion-abonnement" element={<PermissionRoute permission="consulter_abonnements|consulter_planning_abonnements|consulter_facturation_abonnements"><GestionAbonnements /></PermissionRoute>} />
          
          {/* Airbnb & Conciergerie Routes */}
          <Route path="airbnb" element={<AirbnbLayout />}>
            <Route index element={<Navigate to="/airbnb/clients-biens" replace />} />
            <Route path="clients-biens" element={<ClientsBiensView />} />
            <Route path="nouvelle-commande" element={<NouvelleCommandeView />} />
            <Route path="commandes" element={<DossierCommandeView />} />
            <Route path="runner-laverie" element={<RunnerLaverieView />} />
            <Route path="planning" element={<PlanningExecutionView />} />
            <Route path="facturation" element={<FacturationAirbnbView />} />
            <Route path="espace-conciergerie" element={<EspaceConciergerieView />} />
            <Route path="parametres" element={<ParametresAirbnbView />} />
          </Route>

          <Route path="finance">
            <Route path="vue-globale" element={<PermissionRoute permission="voir_la_caisse"><VueGlobale /></PermissionRoute>} />
            <Route path="les-suivis" element={<PermissionRoute permission="consulter_dus_agences_profils|consulter_suivi_commerciaux"><LesSuivis /></PermissionRoute>} />
            <Route path="la-caisse" element={<PermissionRoute permission="consulter_tresorerie|mouvements_caisse|sorties_caisse"><LaCaisse /></PermissionRoute>} />
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
