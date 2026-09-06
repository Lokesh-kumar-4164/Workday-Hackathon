import {
    boolean,
    integer,
    pgTable,
    unique,
    varchar,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

// USERS
export const usersTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),

    name: varchar({ length: 255 }).notNull(),

    email: varchar({ length: 255 }).notNull().unique(),

    password: varchar({ length: 255 }),

    googleId: varchar({ length: 255 }).unique(),

    authProvider: varchar({ length: 50 })
        .notNull()
        .default("local"),

    avatarUrl: varchar({ length: 512 }),

    role: varchar({ length: 50 })
        .notNull()
        .default("USER"),
});


// EVENTS
export const eventsTable = pgTable("events", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),

    title: varchar({ length: 255 }).notNull(),

    description: text(),

    location: varchar({ length: 255 }).notNull(),

    eventDate: timestamp().notNull(),

    // start/end time strings (HH:MM) for display
    startTime: varchar({ length: 10 }),

    endTime: varchar({ length: 10 }),

    category: varchar({ length: 100 }).notNull().default("Other"),

    capacity: integer().notNull(),

    // tracks remaining seats; decremented atomically on each registration
    availableSeats: integer().notNull(),

    // admin can toggle visibility
    available: boolean().notNull().default(true),

    organizerId: integer()
        .notNull()
        .references(() => usersTable.id),
});


// REGISTRATIONS
export const registrationsTable = pgTable(
    "registrations",
    {
        id: integer().primaryKey().generatedAlwaysAsIdentity(),

        userId: integer()
            .notNull()
            .references(() => usersTable.id),

        eventId: integer()
            .notNull()
            .references(() => eventsTable.id),

        registeredAt: timestamp()
            .notNull()
            .defaultNow(),
    },
    (t) => ({
        // prevent a user from registering for the same event twice
        uniqueUserEvent: unique().on(t.userId, t.eventId),
    }),
);
