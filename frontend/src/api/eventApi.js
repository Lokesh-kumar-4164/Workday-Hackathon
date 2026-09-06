import api from './setup';

/* ── Events ──────────────────────────────────────────────── */

/**
 * Fetch all events.
 * Users only receive available=true events; admins receive all.
 */
export const fetchEventsApi = async () => {
    const { data } = await api.get('/events');
    return data; // { events: [...] }
};

/**
 * Admin: create a new event.
 * @param {object} payload - { title, description, location, eventDate, startTime, endTime, category, capacity }
 */
export const createEventApi = async (payload) => {
    const { data } = await api.post('/events', payload);
    return data; // { message, event }
};

/**
 * Admin: update event fields.
 * @param {number} id
 * @param {object} updates
 */
export const updateEventApi = async (id, updates) => {
    const { data } = await api.patch(`/events/${id}`, updates);
    return data;
};

/**
 * Admin: toggle event availability on/off.
 * @param {number} id
 * @param {boolean|undefined} available - If undefined, backend will toggle.
 */
export const toggleEventAvailabilityApi = async (id, available) => {
    const { data } = await api.patch(`/events/${id}/availability`, { available });
    return data; // { message, event }
};

/**
 * Admin: delete an event (and all its registrations).
 * @param {number} id
 */
export const deleteEventApi = async (id) => {
    const { data } = await api.delete(`/events/${id}`);
    return data;
};

/**
 * Admin: get all registrants for an event.
 * @param {number} id
 */
export const getEventRegistrantsApi = async (id) => {
    const { data } = await api.get(`/events/${id}/registrations`);
    return data; // { event, registrants, totalRegistered, availableSeats }
};

/* ── Registrations ───────────────────────────────────────── */

/**
 * User: register for an event.
 * @param {number} eventId
 */
export const registerForEventApi = async (eventId) => {
    const { data } = await api.post(`/events/${eventId}/register`);
    return data; // { message, registration, availableSeats }
};
