import {
    integer,
    pgTable,
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

    capacity: integer().notNull(),

    organizerId: integer()
        .notNull()
        .references(() => usersTable.id),
});


// REGISTRATIONS
export const registrationsTable = pgTable("registrations", {
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
});
