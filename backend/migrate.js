import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
    console.log('Running migration...');

    // Add columns to events table
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS "startTime" varchar(10)`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS "endTime" varchar(10)`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS "category" varchar(100) NOT NULL DEFAULT 'Other'`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS "availableSeats" integer NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS "available" boolean NOT NULL DEFAULT true`;

    // Sync availableSeats = capacity for existing events
    await sql`UPDATE events SET "availableSeats" = capacity WHERE "availableSeats" = 0`;

    // Add unique constraint on registrations (userId, eventId) if it doesn't exist
    await sql`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'registrations_userId_eventId_unique'
            ) THEN
                ALTER TABLE registrations
                ADD CONSTRAINT "registrations_userId_eventId_unique"
                UNIQUE ("userId", "eventId");
            END IF;
        END$$
    `;

    console.log('Migration complete!');
    process.exit(0);
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
