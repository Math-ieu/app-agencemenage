import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Users, UserCheck, History,
  DollarSign, Star, Megaphone, Settings, LogOut, ChevronLeft, ChevronRight, Menu, X, Globe, ChevronDown
} from 'lucide-react';
import { useAuthStore, useNotificationStore } from '../../store/auth';
import logoUrl from '../../assets/LOGO-AGENCE-MENAGE.png';
import { NotificationBell } from './NotificationBell';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/demandes', icon: ClipboardList, label: 'Demandes en attente', badge: true },
  { to: '/profils', icon: UserCheck, label: 'Listing profils' },
  { to: '/clients', icon: Users, label: 'Listing clients' },
  { to: '/historique', icon: History, label: 'Historique' },
  {
    id: 'finance',
    icon: DollarSign,
    label: 'Gestion Financière',
    children: [
      { to: '/finance/vue-globale', label: 'Vue Globale' },
      { to: '/finance/la-caisse', label: 'La Caisse' }
    ]
  },
  { to: '/qualite', icon: Star, label: 'Qualité & Feedback' },
  { to: '/marketing', icon: Megaphone, label: 'Marketing' },
  { 
    id: 'seo',
    icon: Globe, 
    label: 'SEO',
    children: [
      { to: '/seo/blog', label: 'Blog' }
    ]
  },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { pendingCount } = useNotificationStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>(['seo', 'finance']);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* Mobile top navigation */}
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="mobile-header-logo">
          <img src={logoUrl} alt="Agence Ménage" style={{ maxHeight: '40px' }} />
        </div>
        <div style={{ width: 24 }}></div> {/* Spacer for alignment */}
      </div>

      {/* Overlay for mobile sidebar */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="sidebar-header">
          {!collapsed && (
            <div className="logo" style={{ display: 'flex', alignItems: 'center' }}>
              <img src={logoUrl} alt="Agence Ménage" style={{ maxHeight: '80px', width: 'auto', marginLeft: '-15px' }} />
            </div>
          )}
          <button className="collapse-btn desktop-only" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button className="collapse-btn mobile-only" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const { icon: Icon, label, badge } = item;
            const hasChildren = 'children' in item;
            const isExpanded = hasChildren && expandedItems.includes(item.id!);
            const isChildActive = hasChildren && item.children!.some(child => location.pathname.startsWith(child.to!));
            
            if (hasChildren) {
              return (
                <div key={item.id} className={`nav-group ${isChildActive ? 'group-active' : ''}`}>
                  <button 
                    className={`nav-item nav-parent ${isExpanded ? 'nav-parent-expanded' : ''} ${isChildActive ? 'nav-parent-active' : ''}`}
                    onClick={() => toggleExpand(item.id!)}
                  >
                    <span className="nav-icon">
                      <Icon size={20} />
                    </span>
                    {!collapsed && <span className="nav-label">{label}</span>}
                    {!collapsed && (
                      <ChevronDown size={14} className={`nav-chevron ${isExpanded ? 'rotated' : ''}`} />
                    )}
                    {collapsed && isChildActive && (
                      <span className="nav-badge-dot" style={{ backgroundColor: 'var(--accent)' }} />
                    )}
                  </button>
                  {isExpanded && !collapsed && (
                    <div className="nav-children">
                      {item.children!.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to!}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) => `nav-child-item ${isActive ? 'nav-child-active' : ''}`}
                        >
                          <span className="nav-child-label">{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
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
            );
          })}
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
        <header style={{ 
          height: '60px', 
          backgroundColor: '#fff', 
          borderBottom: '1px solid #e2e8f0', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end', 
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <NotificationBell />
        </header>
        <Outlet />
      </main>
    </div>
  );
}
