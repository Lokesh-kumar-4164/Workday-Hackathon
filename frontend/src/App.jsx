import React, { useState } from 'react';
import AuthPage from './pages/AuthPage';
import EventRegistration from './pages/EventRegistration';
import AdminPage from './pages/AdminPage';

/* ─── Shared initial event data (single source of truth) ─── */
const INITIAL_EVENTS = [
  {
    id: 1,
    name: 'Tech Innovation Summit 2026',
    date: 'September 20, 2026',
    time: '9:00 AM – 5:00 PM',
    location: 'Convention Center, Hall A',
    seats: 24,
    available: true,
    category: 'Technology',
  },
  {
    id: 2,
    name: 'Product Design Workshop',
    date: 'October 3, 2026',
    time: '10:00 AM – 2:00 PM',
    location: 'Studio 4, Creative Hub',
    seats: 16,
    available: true,
    category: 'Design',
  },
  {
    id: 3,
    name: 'Cloud Architecture Bootcamp',
    date: 'September 28, 2026',
    time: '8:30 AM – 4:30 PM',
    location: 'Online – Zoom',
    seats: 0,
    available: false,
    category: 'Engineering',
  },
  {
    id: 4,
    name: 'Leadership & Strategy Forum',
    date: 'October 10, 2026',
    time: '11:00 AM – 3:00 PM',
    location: 'Grand Ballroom, City Hotel',
    seats: 40,
    available: true,
    category: 'Leadership',
  },
  {
    id: 5,
    name: 'AI & Machine Learning Day',
    date: 'October 17, 2026',
    time: '9:00 AM – 6:00 PM',
    location: 'Tech Park Auditorium',
    seats: 0,
    available: false,
    category: 'Technology',
  },
  {
    id: 6,
    name: 'Startup Pitch Competition',
    date: 'November 1, 2026',
    time: '2:00 PM – 7:00 PM',
    location: 'Innovation Loft, Floor 3',
    seats: 12,
    available: true,
    category: 'Business',
  },
];

/* Role is set by the User/Admin toggle on the LoginForm — no email matching needed */

export default function App() {
  // null = logged out; { email, role: 'admin'|'user' } = logged in
  const [user, setUser] = useState(null);

  // Single shared events list — admin edits are instantly visible to users
  const [events, setEvents] = useState(INITIAL_EVENTS);

  function handleLoginSuccess(userData) {
    // userData already contains { email, role } from LoginForm
    setUser(userData);
  }

  function handleLogout() {
    setUser(null);
  }

  /* ── Event management handlers (used by AdminPage) ── */
  function handleAddEvent(newEvent) {
    setEvents(prev => [newEvent, ...prev]);
  }

  function handleRemoveEvent(id) {
    setEvents(prev => prev.filter(e => e.id !== id));
  }

  function handleToggleEvent(id) {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, available: !e.available } : e));
  }

  /* ── Routing ── */
  if (!user) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (user.role === 'admin') {
    return (
      <AdminPage
        user={user}
        onLogout={handleLogout}
        events={events}
        onAddEvent={handleAddEvent}
        onRemoveEvent={handleRemoveEvent}
      />
    );
  }

  return (
    <EventRegistration
      user={user}
      onLogout={handleLogout}
      events={events}
    />
  );
}