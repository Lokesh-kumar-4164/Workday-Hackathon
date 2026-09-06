import { and, eq, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { eventsTable, registrationsTable, usersTable } from '../config/schemas.js';

/* ─────────────────────────────────────────────
   GET /events
   - Users see only available=true events
   - Admins see all events
───────────────────────────────────────────── */
export const listEventsController = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'ADMIN';

        const events = isAdmin
            ? await db.select().from(eventsTable).orderBy(eventsTable.eventDate)
            : await db
                  .select()
                  .from(eventsTable)
                  .where(eq(eventsTable.available, true))
                  .orderBy(eventsTable.eventDate);

        return res.status(200).json({ events });
    } catch (error) {
        console.error('listEventsController:', error);
        return res.status(500).json({ message: 'Failed to fetch events.' });
    }
};

/* ─────────────────────────────────────────────
   POST /events   (admin only)
───────────────────────────────────────────── */
export const createEventController = async (req, res) => {
    try {
        const {
            title,
            description,
            location,
            eventDate,
            startTime,
            endTime,
            category,
            capacity,
        } = req.body ?? {};

        // Validation
        if (!title?.trim()) return res.status(400).json({ message: 'Event title is required.' });
        if (!location?.trim()) return res.status(400).json({ message: 'Location is required.' });
        if (!eventDate) return res.status(400).json({ message: 'Event date is required.' });
        const parsedDate = new Date(eventDate);
        if (isNaN(parsedDate)) return res.status(400).json({ message: 'Invalid event date.' });
        const cap = Number(capacity);
        if (!capacity || isNaN(cap) || cap < 1)
            return res.status(400).json({ message: 'Capacity must be a positive integer.' });

        const [event] = await db
            .insert(eventsTable)
            .values({
                title: title.trim(),
                description: description?.trim() ?? null,
                location: location.trim(),
                eventDate: parsedDate,
                startTime: startTime ?? null,
                endTime: endTime ?? null,
                category: category ?? 'Other',
                capacity: cap,
                availableSeats: cap,   // starts fully open
                available: true,
                organizerId: req.user.id,
            })
            .returning();

        return res.status(201).json({ message: 'Event created.', event });
    } catch (error) {
        console.error('createEventController:', error);
        return res.status(500).json({ message: 'Failed to create event.' });
    }
};

/* ─────────────────────────────────────────────
   PATCH /events/:id   (admin only)
   Allows updating any event fields
───────────────────────────────────────────── */
export const updateEventController = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid event id.' });

        const [existing] = await db
            .select()
            .from(eventsTable)
            .where(eq(eventsTable.id, id))
            .limit(1);

        if (!existing) return res.status(404).json({ message: 'Event not found.' });

        const {
            title, description, location, eventDate,
            startTime, endTime, category, capacity,
        } = req.body ?? {};

        const updates = {};
        if (title !== undefined) updates.title = title.trim();
        if (description !== undefined) updates.description = description?.trim() ?? null;
        if (location !== undefined) updates.location = location.trim();
        if (eventDate !== undefined) {
            const d = new Date(eventDate);
            if (isNaN(d)) return res.status(400).json({ message: 'Invalid event date.' });
            updates.eventDate = d;
        }
        if (startTime !== undefined) updates.startTime = startTime;
        if (endTime !== undefined) updates.endTime = endTime;
        if (category !== undefined) updates.category = category;
        if (capacity !== undefined) {
            const cap = Number(capacity);
            if (isNaN(cap) || cap < 1)
                return res.status(400).json({ message: 'Capacity must be a positive integer.' });

            // Recalculate available seats keeping registrations in mind
            const registeredCount = existing.capacity - existing.availableSeats;
            const newAvailableSeats = Math.max(0, cap - registeredCount);
            updates.capacity = cap;
            updates.availableSeats = newAvailableSeats;
        }

        if (Object.keys(updates).length === 0)
            return res.status(400).json({ message: 'No valid fields to update.' });

        const [updated] = await db
            .update(eventsTable)
            .set(updates)
            .where(eq(eventsTable.id, id))
            .returning();

        return res.status(200).json({ message: 'Event updated.', event: updated });
    } catch (error) {
        console.error('updateEventController:', error);
        return res.status(500).json({ message: 'Failed to update event.' });
    }
};

/* ─────────────────────────────────────────────
   PATCH /events/:id/availability   (admin only)
   Toggles the available flag
───────────────────────────────────────────── */
export const toggleAvailabilityController = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid event id.' });

        const [existing] = await db
            .select()
            .from(eventsTable)
            .where(eq(eventsTable.id, id))
            .limit(1);

        if (!existing) return res.status(404).json({ message: 'Event not found.' });

        // If a specific value was passed, use it; otherwise toggle
        const newAvailable = req.body?.available !== undefined
            ? Boolean(req.body.available)
            : !existing.available;

        const [updated] = await db
            .update(eventsTable)
            .set({ available: newAvailable })
            .where(eq(eventsTable.id, id))
            .returning();

        return res.status(200).json({
            message: `Event ${newAvailable ? 'enabled' : 'disabled'}.`,
            event: updated,
        });
    } catch (error) {
        console.error('toggleAvailabilityController:', error);
        return res.status(500).json({ message: 'Failed to toggle event availability.' });
    }
};

/* ─────────────────────────────────────────────
   DELETE /events/:id   (admin only)
───────────────────────────────────────────── */
export const deleteEventController = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid event id.' });

        const [existing] = await db
            .select({ id: eventsTable.id })
            .from(eventsTable)
            .where(eq(eventsTable.id, id))
            .limit(1);

        if (!existing) return res.status(404).json({ message: 'Event not found.' });

        // Delete registrations first (FK constraint)
        await db.delete(registrationsTable).where(eq(registrationsTable.eventId, id));
        await db.delete(eventsTable).where(eq(eventsTable.id, id));

        return res.status(200).json({ message: 'Event deleted.' });
    } catch (error) {
        console.error('deleteEventController:', error);
        return res.status(500).json({ message: 'Failed to delete event.' });
    }
};

/* ─────────────────────────────────────────────
   GET /events/:id/registrations   (admin only)
   Returns list of users registered for an event
───────────────────────────────────────────── */
export const getEventRegistrantsController = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid event id.' });

        const [event] = await db
            .select()
            .from(eventsTable)
            .where(eq(eventsTable.id, id))
            .limit(1);

        if (!event) return res.status(404).json({ message: 'Event not found.' });

        const registrants = await db
            .select({
                registrationId: registrationsTable.id,
                registeredAt: registrationsTable.registeredAt,
                userId: usersTable.id,
                userName: usersTable.name,
                userEmail: usersTable.email,
                userAvatar: usersTable.avatarUrl,
            })
            .from(registrationsTable)
            .innerJoin(usersTable, eq(registrationsTable.userId, usersTable.id))
            .where(eq(registrationsTable.eventId, id))
            .orderBy(registrationsTable.registeredAt);

        return res.status(200).json({
            event,
            registrants,
            totalRegistered: registrants.length,
            availableSeats: event.availableSeats,
        });
    } catch (error) {
        console.error('getEventRegistrantsController:', error);
        return res.status(500).json({ message: 'Failed to fetch registrants.' });
    }
};
