import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Users, UserCheck, History,
  DollarSign, Star, Megaphone, Settings, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuthStore, useNotificationStore } from '../../store/auth';
import logoUrl from '../../assets/LOGO-AGENCE-MENAGE.webp';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/demandes', icon: ClipboardList, label: 'Demandes en attente', badge: true },
  { to: '/profils', icon: UserCheck, label: 'Listing profils' },
  { to: '/clients', icon: Users, label: 'Listing clients' },
  { to: '/historique', icon: History, label: 'Historique' },
  { to: '/finance', icon: DollarSign, label: 'Gestion Financière' },
  { to: '/qualite', icon: Star, label: 'Qualité & Feedback' },
  { to: '/marketing', icon: Megaphone, label: 'Marketing' },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const { pendingCount } = useNotificationStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && (
            <div className="logo" style={{ display: 'flex', alignItems: 'center' }}>
              <img src={logoUrl} alt="Agence Ménage" style={{ maxHeight: '80px', width: 'auto', marginLeft: '-15px' }} />
            </div>
          )}
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              title={collapsed ? label : undefined}
            >
              <span className="nav-icon">
                <Icon size={20} />
              </span>
              {!collapsed && <span className="nav-label">{label}</span>}
              {!collapsed && badge && pendingCount > 0 && (
                <span className="nav-badge">{pendingCount}</span>
              )}
              {collapsed && badge && pendingCount > 0 && (
                <span className="nav-badge-dot" />
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && user && (
            <div className="user-info">
              <div className="user-avatar">{user.first_name?.[0]}{user.last_name?.[0]}</div>
              <div>
                <p className="user-name">{user.full_name}</p>
                <p className="user-role">{user.role}</p>
              </div>
            </div>
          )}
          <button className="logout-btn" onClick={handleLogout} title="Déconnexion">
            <LogOut size={18} />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
