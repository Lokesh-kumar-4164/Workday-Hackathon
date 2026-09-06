import React, { useState } from 'react';
import {
  MapPin, Clock, Calendar, Users, CheckCircle2, ChevronRight,
  X, Sparkles, LogOut, AlertCircle, Ticket,
} from 'lucide-react';

/* Events data is passed in as a prop from App.jsx (shared with AdminPage) */

const CATEGORY_COLORS = {
  Technology: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Design: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Engineering: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Leadership: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Business: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

function generateSeats(eventId, totalSeats) {
  const bookedIndexes = new Set();
  const count = Math.floor(totalSeats * 0.3);
  for (let i = 0; i < count; i++) {
    bookedIndexes.add((eventId * 7 + i * 3) % totalSeats);
  }
  return Array.from({ length: totalSeats }, (_, i) => ({
    id: i + 1,
    label: `S${String(i + 1).padStart(2, '0')}`,
    booked: bookedIndexes.has(i),
  }));
}

/* ─── Spinner ──────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

/* ─── Event Card ───────────────────────────────────────────────────── */
function EventCard({ event, onSelect, isSelected }) {
  const catCls = CATEGORY_COLORS[event.category] ?? 'bg-slate-700/30 text-slate-400 border-slate-700';
  return (
    <div className={`bg-slate-900/80 backdrop-blur-sm border rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 ${
      isSelected
        ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
        : 'border-slate-800/80 hover:border-slate-700 hover:shadow-md hover:shadow-indigo-950/40'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catCls}`}>
          {event.category}
        </span>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
          event.available
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-slate-700/30 text-slate-500 border-slate-700/30'
        }`}>
          {event.available ? `${event.seats} seats` : 'Full'}
        </span>
      </div>

      <h3 className="text-sm font-bold text-slate-100 leading-snug">{event.name}</h3>

      <div className="flex flex-col gap-1.5 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {event.date}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {event.time}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {event.location}
        </span>
      </div>

      <button
        onClick={() => onSelect(event)}
        disabled={!event.available}
        className={`mt-1 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
          !event.available
            ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
            : isSelected
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
            : 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white hover:border-transparent'
        }`}
      >
        {!event.available
          ? 'Not Available'
          : isSelected
          ? <><CheckCircle2 className="w-3.5 h-3.5" /> Selected</>
          : <><ChevronRight className="w-3.5 h-3.5" /> Register</>
        }
      </button>
    </div>
  );
}

/* ─── Seat Grid ────────────────────────────────────────────────────── */
function SeatGrid({ seats, selected, onSelect }) {
  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-5 mb-4 text-xs text-slate-400 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-emerald-500/20 border border-emerald-500/50 inline-block" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-yellow-400 inline-block border-2 border-yellow-500" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-md bg-slate-700/60 border border-slate-700 inline-block" />
          Booked
        </span>
      </div>

      {/* Grid */}
      <div className="flex flex-wrap gap-2">
        {seats.map((seat) => {
          const isSelected = selected === seat.id;
          let cls = 'w-11 h-11 rounded-xl text-[11px] font-bold flex items-center justify-center border-2 transition-all duration-100 ';
          if (seat.booked) {
            cls += 'bg-slate-800/60 border-slate-700/60 text-slate-600 cursor-not-allowed';
          } else if (isSelected) {
            cls += 'bg-yellow-400 border-yellow-500 text-yellow-900 cursor-pointer scale-110 shadow-lg shadow-yellow-400/20';
          } else {
            cls += 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 cursor-pointer hover:bg-emerald-500/25 hover:border-emerald-500';
          }
          return (
            <button
              key={seat.id}
              className={cls}
              disabled={seat.booked}
              onClick={() => onSelect(seat.id)}
              aria-label={`Seat ${seat.label}${seat.booked ? ' (booked)' : isSelected ? ' (selected)' : ''}`}
            >
              {seat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
export default function EventRegistration({ user, onLogout, events = [] }) {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  function handleSelectEvent(event) {
    setSelectedEvent(event);
    setSeats(generateSeats(event.id, event.seats));
    setSelectedSeat(null);
    setErrors({});
    setSuccess(null);
    setTimeout(() => {
      document.getElementById('registration-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleClearSelection() {
    setSelectedEvent(null);
    setSeats([]);
    setSelectedSeat(null);
    setErrors({});
    setSuccess(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const canSubmit = form.name.trim() && emailValid && selectedEvent && selectedSeat && !isSubmitting;

  function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!emailValid) errs.email = 'Enter a valid email';
    if (!selectedSeat) errs.seat = 'Please select a seat';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const seatLabel = seats.find((s) => s.id === selectedSeat)?.label;
      setSuccess({ name: form.name, event: selectedEvent.name, seat: seatLabel, date: selectedEvent.date, location: selectedEvent.location });
    }, 1200);
  }

  /* ── Background decorations (shared with auth pages) ── */
  const Bg = () => (
    <>
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse-glow" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[140px] pointer-events-none" />
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
    </>
  );

  /* ── Success Screen ── */
  if (success) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 relative overflow-hidden">
        <Bg />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-indigo-950/40 text-center space-y-5 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
                <Ticket className="w-3.5 h-3.5" />
                Registration Confirmed
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight mt-2">You're all set, {success.name}!</h2>
              <p className="text-slate-400 text-sm mt-2">
                Your seat <span className="text-indigo-400 font-semibold">{success.seat}</span> has been reserved for
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-left space-y-2.5">
              <p className="text-sm font-semibold text-slate-100">{success.event}</p>
              <div className="flex flex-col gap-1.5 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-400" />{success.date}</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-400" />{success.location}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500">A confirmation has been sent to your email.</p>

            <button
              onClick={() => { setSuccess(null); handleClearSelection(); }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              Browse More Events
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      <Bg />

      {/* ── Navbar ── */}
      <header className="relative z-10 border-b border-slate-800/80 backdrop-blur-md bg-slate-950/60 sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white">SurgeShield</span>
              <span className="ml-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Events</span>
            </div>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            {user?.email && (
              <span className="hidden sm:block text-xs text-slate-400 truncate max-w-[200px]">{user.name || user.email}</span>
            )}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 rounded-xl px-3 py-2 transition-colors duration-150 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── Page Header ── */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-3">
            <Calendar className="w-3.5 h-3.5" />
            Upcoming Events
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Register for an Event
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Browse available events and secure your seat instantly.
          </p>
        </div>

        {/* ── Event Grid ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              All Events <span className="text-slate-600 font-normal">({events.length})</span>
            </h2>
            {selectedEvent && (
              <button
                onClick={handleClearSelection}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-600 rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Clear selection
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                onSelect={handleSelectEvent}
                isSelected={selectedEvent?.id === ev.id}
              />
            ))}
          </div>
        </section>

        {/* ── Registration Panel ── */}
        {selectedEvent && (
          <section id="registration-panel">
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl shadow-2xl shadow-indigo-950/30 overflow-hidden">
              {/* Panel header bar */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-5">
                <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-0.5">Registering for</p>
                <h2 className="text-white text-xl font-bold">{selectedEvent.name}</h2>
              </div>

              <div className="p-6 space-y-8">
                {/* ── Event Details (read-only) ── */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Event Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { icon: Calendar, label: 'Date', value: selectedEvent.date },
                      { icon: Clock, label: 'Time', value: selectedEvent.time },
                      { icon: MapPin, label: 'Location', value: selectedEvent.location },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 uppercase tracking-wider mb-1">
                          <Icon className="w-3 h-3" /> {label}
                        </p>
                        <p className="text-sm font-medium text-slate-200">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* ── Your Info ── */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Your Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                          Full Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={form.name}
                          onChange={handleChange}
                          placeholder="Jane Smith"
                          className={`w-full px-4 py-3 bg-slate-950/60 border ${
                            errors.name ? 'border-rose-500 focus:ring-rose-500/30' : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30'
                          } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200`}
                        />
                        {errors.name && (
                          <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />{errors.name}
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                          Email Address <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={form.email}
                          onChange={handleChange}
                          placeholder="you@company.com"
                          className={`w-full px-4 py-3 bg-slate-950/60 border ${
                            errors.email ? 'border-rose-500 focus:ring-rose-500/30' : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/30'
                          } rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-4 transition-all duration-200`}
                        />
                        {errors.email && (
                          <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-1.5 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />{errors.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Seat Selection ── */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Select a Seat</p>
                      {selectedSeat ? (
                        <span className="text-xs font-semibold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-0.5 rounded-full">
                          {seats.find((s) => s.id === selectedSeat)?.label} selected
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Click a green seat to choose</span>
                      )}
                    </div>
                    <SeatGrid seats={seats} selected={selectedSeat} onSelect={setSelectedSeat} />
                    {errors.seat && (
                      <p className="flex items-center gap-1.5 text-xs text-rose-400 mt-2 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />{errors.seat}
                      </p>
                    )}
                  </div>

                  {/* ── Submit ── */}
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className={`sm:w-auto w-full px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                        canSubmit
                          ? 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 cursor-pointer active:scale-[0.99]'
                          : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? (
                        <><Spinner /> Confirming...</>
                      ) : (
                        <><Ticket className="w-4 h-4" /> Confirm Registration</>
                      )}
                    </button>
                    {!canSubmit && !isSubmitting && (
                      <p className="text-xs text-slate-500">
                        Fill your name, a valid email, and select a seat to continue.
                      </p>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-600">
        &copy; {new Date().getFullYear()} SurgeShield. All rights reserved.
      </footer>
    </div>
  );
}
