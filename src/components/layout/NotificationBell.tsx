import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { getNotificationsUrgentes } from '../../api/client';
import { useNavigate } from 'react-router-dom';

interface UrgentDemand {
  id: number;
  client: string;
  service: string;
  hours_pending: number;
  created_at: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<UrgentDemand[]>([]);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data } = await getNotificationsUrgentes();
      setNotifications(data);
    } catch (e) {
      console.error('Failed to fetch urgent notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
          <Bell size={20} color="var(--primary)" />
          {notifications.length > 0 && (
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
              fontWeight: 'bold'
            }}>
              {notifications.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" style={{ width: '350px', padding: 0, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
            Notifications Urgentes ({notifications.length})
          </h4>
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto', backgroundColor: '#ffffff' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              Aucune demande urgente en attente.
            </div>
          ) : (
            notifications.map((notif) => (
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
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
