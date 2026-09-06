import React, { useCallback, useEffect, useState } from 'react';
import AuthPage from './pages/AuthPage';
import EventRegistration from './pages/EventRegistration';
import AdminPage from './pages/AdminPage';
import { useAuth } from './context/AuthContext';
import { fetchEventsApi } from './api/eventApi';

export default function App() {
  const { user, loading, logout } = useAuth();
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');

  const loadEvents = useCallback(async () => {
    if (!user) return;
    setEventsLoading(true);
    setEventsError('');
    try {
      const data = await fetchEventsApi();
      setEvents(data.events ?? []);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to load events.';
      setEventsError(msg);
    } finally {
      setEventsLoading(false);
    }
  }, [user]);

  // Load events whenever the logged-in user changes
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  /* ── Loading spinner (auth check) ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-400">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (user.role?.toLowerCase() === 'admin') {
    return (
      <AdminPage
        user={user}
        onLogout={logout}
        events={events}
        eventsLoading={eventsLoading}
        eventsError={eventsError}
        onRefreshEvents={loadEvents}
      />
    );
  }

  return (
    <EventRegistration
      user={user}
      onLogout={logout}
      events={events}
      eventsLoading={eventsLoading}
      eventsError={eventsError}
      onRefreshEvents={loadEvents}
    />
  );
}