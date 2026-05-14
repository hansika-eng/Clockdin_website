import React, { useEffect, useState } from 'react';
import EventCard from './EventCard';
import '../Events.css';
import { apiFetch } from '../utils/api';
import { getNotificationStorageKeys } from '../utils/notificationStorage';

const Notifications = () => {
  const [notifiedEvents, setNotifiedEvents] = useState(() => {
    const { itemsKey } = getNotificationStorageKeys();
    const data = localStorage.getItem(itemsKey);
    return data ? JSON.parse(data) : [];
  });

  const refresh = () => {
    const { itemsKey } = getNotificationStorageKeys();
    const data = localStorage.getItem(itemsKey);
    setNotifiedEvents(data ? JSON.parse(data) : []);
  };

  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key || e.key.includes('notify_event_')) refresh();
    };
    const onCustom = () => refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('notify-events-changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('notify-events-changed', onCustom);
    };
  }, []);

  const token = localStorage.getItem('clockdin_token');
  const showSignInBanner = !token && notifiedEvents.length > 0;

  const removeNotifiedLocal = (eventId) => {
    const { idsKey, itemsKey } = getNotificationStorageKeys();
    const ids = JSON.parse(localStorage.getItem(idsKey) || '[]').filter(id => id !== eventId);
    const items = JSON.parse(localStorage.getItem(itemsKey) || '[]').filter(ev => (ev._id || ev.id) !== eventId);
    localStorage.setItem(idsKey, JSON.stringify(ids));
    localStorage.setItem(itemsKey, JSON.stringify(items));
    setNotifiedEvents(items);
    window.dispatchEvent(new Event('notify-events-changed'));
  };

  const handleUnsubscribe = async (ev) => {
    const id = ev._id || ev.id;
    removeNotifiedLocal(id);
    const token = localStorage.getItem('clockdin_token');
    if (!token) return;
    try {
      await apiFetch(`/api/users/notifications/subscribe/${id}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
    } catch (err) {
      console.error('Failed to unsubscribe notification', err);
    }
  };

  return (
    <div className="container mt-4" style={{maxWidth:'1200px'}}>
      {showSignInBanner && (
        <div className="alert alert-warning" role="alert">
          Sign in to receive email reminders 2 days before deadlines for these events. <a href="/login">Sign in</a>
        </div>
      )}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 style={{fontWeight:900, fontSize:'2.4rem', color:'#22223b', marginBottom:4, letterSpacing:'-1px'}}>
            Notifications
          </h1>
          <div style={{color:'#64748b', fontSize:'1.05rem'}}>Manage your "Notify Me" events here.</div>
        </div>
        <span className="badge bg-primary" style={{fontWeight:800, fontSize:'1rem'}}>{notifiedEvents.length}</span>
      </div>

      {notifiedEvents.length === 0 ? (
        <div className="d-flex align-items-center gap-3" style={{border:'1px dashed #cbd5e1', borderRadius:'1rem', padding:'1.2rem', background:'#fff'}}>
          <i className="bi bi-bell" style={{fontSize:'1.8rem', color:'#94a3b8'}}></i>
          <div style={{color:'#64748b', fontWeight:600}}>No notification events yet. Tap "Notify Me" on any event to track it.</div>
        </div>
      ) : (
        <div className="row g-3">
          {notifiedEvents.map((ev, idx) => {
            const key = ev._id || ev.id || idx;
            return (
              <div className="col-md-6" key={key}>
                <div className="p-3" style={{border:'1px solid #e5e7eb', borderRadius:'1rem', background:'#fff', height:'100%', display:'flex', flexDirection:'column', gap:'0.75rem'}}>
                  <EventCard event={ev} showBookmark={false} showActions={false} />
                  <button
                    className="btn btn-outline-danger"
                    style={{fontWeight:700, borderRadius:'0.8rem'}}
                    onClick={() => handleUnsubscribe(ev)}
                  >
                    <i className="bi bi-x-circle me-1"></i>Unsubscribe
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
