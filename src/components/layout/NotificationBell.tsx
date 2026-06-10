import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { getNotificationsUrgentes, getAppNotifications, markNotificationRead } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { AppNotification } from '../../types';

interface UrgentDemand {
  id: number;
  client: string;
  service: string;
  hours_pending: number;
  created_at: string;
}

export function NotificationBell() {
  const [urgentNotifs, setUrgentNotifs] = useState<UrgentDemand[]>([]);
  const [planningNotifs, setPlanningNotifs] = useState<AppNotification[]>([]);
  const [activeTab, setActiveTab] = useState<'urgent' | 'planning'>('urgent');
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const [urgentRes, planningRes] = await Promise.all([
        getNotificationsUrgentes(),
        getAppNotifications()
      ]);
      setUrgentNotifs(urgentRes.data || []);
      
      const pData = planningRes.data;
      const notificationsArray = Array.isArray(pData) ? pData : (pData?.results || []);
      setPlanningNotifs(notificationsArray);
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadPlanningCount = planningNotifs.filter(n => !n.is_read).length;
  const totalCount = urgentNotifs.length + unreadPlanningCount;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
          <Bell size={20} color="var(--primary, #037265)" />
          {totalCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              border: '2px solid white'
            }}>
              {totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" style={{ width: '350px', padding: 0, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', zIndex: 100 }}>
        {/* Header Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <button
            onClick={() => setActiveTab('urgent')}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              borderBottom: activeTab === 'urgent' ? '3px solid #ef4444' : 'none',
              background: 'none',
              fontWeight: 700,
              color: activeTab === 'urgent' ? '#ef4444' : '#64748b',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
          >
            Urgents ({urgentNotifs.length})
          </button>
          <button
            onClick={() => setActiveTab('planning')}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              borderBottom: activeTab === 'planning' ? '3px solid #037265' : 'none',
              background: 'none',
              fontWeight: 700,
              color: activeTab === 'planning' ? '#037265' : '#64748b',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
          >
            Planning ({unreadPlanningCount})
          </button>
        </div>

        {/* Content list */}
        <div style={{ maxHeight: '400px', overflowY: 'auto', backgroundColor: '#ffffff' }}>
          {activeTab === 'urgent' ? (
            urgentNotifs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                Aucune demande urgente en attente.
              </div>
            ) : (
              urgentNotifs.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => {
                    navigate(`/demandes`);
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    backgroundColor: '#ffffff',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{notif.client}</span>
                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>
                      {notif.hours_pending}h d'attente
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    Demande de {notif.service} en attente depuis bientôt 24h !
                  </div>
                </div>
              ))
            )
          ) : (
            planningNotifs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                Aucun rappel d'intervention.
              </div>
            ) : (
              planningNotifs.map((notif) => (
                <div 
                  key={notif.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    backgroundColor: notif.is_read ? '#ffffff' : '#f0fdf4',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', paddingRight: '8px' }}>
                      {notif.title}
                    </span>
                    {!notif.is_read && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await markNotificationRead(notif.id);
                            fetchNotifications();
                          } catch (err) {
                            console.error('Failed to mark read', err);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#037265',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#e6f4f2',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d0ebd8'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e6f4f2'}
                      >
                        Marquer lu
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: '1.4' }}>
                    {notif.message}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {new Date(notif.created_at).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
