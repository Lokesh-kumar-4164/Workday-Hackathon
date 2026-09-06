import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../config/db.js';
import { eventsTable, registrationsTable } from '../config/schemas.js';

/* ─────────────────────────────────────────────
   POST /events/:id/register
   Atomically checks availability, prevents
   duplicates, and decrements availableSeats.
───────────────────────────────────────────── */
export const registerForEventController = async (req, res) => {
    try {
        const eventId = Number(req.params.id);
        if (!eventId) return res.status(400).json({ message: 'Invalid event id.' });

        const userId = req.user.id;

        // 1. Load the event
        const [event] = await db
            .select()
            .from(eventsTable)
            .where(eq(eventsTable.id, eventId))
            .limit(1);

        if (!event) return res.status(404).json({ message: 'Event not found.' });

        // 2. Check availability flag
        if (!event.available) {
            return res.status(409).json({ message: 'This event is no longer available for registration.' });
        }

        // 3. Check seats remaining
        if (event.availableSeats <= 0) {
            return res.status(409).json({ message: 'Sorry, this event is fully booked.' });
        }

        // 4. Check duplicate registration
        const [existing] = await db
            .select({ id: registrationsTable.id })
            .from(registrationsTable)
            .where(
                and(
                    eq(registrationsTable.userId, userId),
                    eq(registrationsTable.eventId, eventId),
                ),
            )
            .limit(1);

        if (existing) {
            return res.status(409).json({ message: 'You are already registered for this event.' });
        }

        // 5. Atomic decrement + insert registration
        //    Use a conditional UPDATE that only succeeds if availableSeats > 0
        //    to guard against race conditions.
        const updated = await db
            .update(eventsTable)
            .set({ availableSeats: sql`${eventsTable.availableSeats} - 1` })
            .where(and(eq(eventsTable.id, eventId), gt(eventsTable.availableSeats, 0)))
            .returning({ availableSeats: eventsTable.availableSeats });

        if (updated.length === 0) {
            // Another concurrent request grabbed the last seat
            return res.status(409).json({ message: 'Sorry, this event just became fully booked.' });
        }

        // 6. Insert registration record
        const [registration] = await db
            .insert(registrationsTable)
            .values({ userId, eventId })
            .returning();

        return res.status(201).json({
            message: 'Registration successful!',
            registration,
            availableSeats: updated[0].availableSeats,
        });
    } catch (error) {
        // Handle unique constraint violation (race condition duplicate)
        if (error?.code === '23505') {
            return res.status(409).json({ message: 'You are already registered for this event.' });
        }
        console.error('registerForEventController:', error);
        return res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
};
