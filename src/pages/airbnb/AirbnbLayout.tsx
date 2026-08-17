import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  Building2, PlusCircle, FileText, Shirt, Calendar, Receipt, Globe, Settings, Sparkles 
} from 'lucide-react';
import './AirbnbLayout.css';

export default function AirbnbLayout() {
  const location = useLocation();

  const tabs = [
    { to: '/airbnb/clients-biens', label: 'Clients & Biens', icon: Building2 },
    { to: '/airbnb/nouvelle-commande', label: 'Nouvelle Commande', icon: PlusCircle },
    { to: '/airbnb/commandes', label: 'Dossier Commande', icon: FileText },
    { to: '/airbnb/runner-laverie', label: 'Runner & Laverie', icon: Shirt },
    { to: '/airbnb/planning', label: 'Planning & Exécution', icon: Calendar },
    { to: '/airbnb/facturation', label: 'Facturation Conciergerie', icon: Receipt },
    { to: '/airbnb/espace-conciergerie', label: 'Espace Conciergerie', icon: Globe },
    { to: '/airbnb/parametres', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="abl-root">
      {/* Top Header Strip */}
      <div className="abl-header">
        <div className="abl-header-left">
          <div className="abl-badge-tag">
            <Sparkles size={12} />
            Module Métier
          </div>
          <h1 className="abl-title">Airbnb & Conciergerie</h1>
        </div>
        <div className="abl-header-actions">
          <NavLink
            to="/airbnb/nouvelle-commande"
            className="abl-btn-cta"
          >
            <PlusCircle size={16} />
            <span>Nouvelle Commande</span>
          </NavLink>
        </div>
      </div>

      {/* Navigation Subtabs — Modern Segmented Pills */}
      <div className="abl-tabs-bar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname.startsWith(tab.to);
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={`abl-tab-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Page Content */}
      <div className="abl-content">
        <Outlet />
      </div>
    </div>
  );
}
