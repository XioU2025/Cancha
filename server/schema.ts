import { pgTable, serial, varchar, integer, timestamp, pgEnum, text } from "drizzle-orm/pg-core";

export const matchStatus = pgEnum("match_status", ["scheduled", "live", "finished"]);
export const eventType = pgEnum("event_type", ["goal", "foul", "substitution", "yellow_card", "red_card", "start", "half_time", "full_time"]);

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  homeTeam: varchar("home_team", { length: 100 }).notNull(),
  awayTeam: varchar("away_team", { length: 100 }).notNull(),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  status: matchStatus("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const matchEvents = pgTable("match_events", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  type: eventType("type").notNull(),
  minute: integer("minute").notNull(),
  team: varchar("team", { length: 100 }),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
