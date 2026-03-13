import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';

// Layout & Auth
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';

// Pages
import Dashboard from './pages/Dashboard';
import DemandesEnAttente from './pages/DemandesEnAttente';
import Clients from './pages/Clients';
import Profils from './pages/Profils';
import Historique from './pages/Historique';
import Finance from './pages/Finance';
import Qualite from './pages/Qualite';
import Marketing from './pages/Marketing';
import Parametres from './pages/Parametres';

// Navigation guard function
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="clients" element={<Clients />} />
          <Route path="profils" element={<Profils />} />
          <Route path="historique" element={<Historique />} />
          <Route path="finance" element={<Finance />} />
          <Route path="qualite" element={<Qualite />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="parametres" element={<Parametres />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
