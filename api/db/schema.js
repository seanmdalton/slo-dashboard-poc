import { pgTable, text, varchar, integer, decimal, timestamp, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Experiences (top-level grouping)
export const experiences = pgTable('experiences', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Journeys (grouped under experiences)
export const journeys = pgTable('journeys', {
  id: varchar('id', { length: 255 }).primaryKey(),
  experienceId: varchar('experience_id', { length: 255 }).notNull().references(() => experiences.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  experienceIdx: index('journeys_experience_idx').on(table.experienceId),
}));

// SLOs (Service Level Objectives)
export const slos = pgTable('slos', {
  id: varchar('id', { length: 255 }).primaryKey(),
  journeyId: varchar('journey_id', { length: 255 }).notNull().references(() => journeys.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  criticality: varchar('criticality', { length: 50 }).notNull(), // tier-0, tier-1, tier-2
  owner: varchar('owner', { length: 255 }).notNull(),
  budgetingWindowDays: integer('budgeting_window_days').notNull().default(28),
  objectivePercent: decimal('objective_percent', { precision: 6, scale: 3 }).notNull(), // e.g., 99.900
  errorBudgetPercent: decimal('error_budget_percent', { precision: 6, scale: 3 }).notNull(), // e.g., 0.100
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  journeyIdx: index('slos_journey_idx').on(table.journeyId),
  ownerIdx: index('slos_owner_idx').on(table.owner),
  criticalityIdx: index('slos_criticality_idx').on(table.criticality),
}));

// SLIs (Service Level Indicators)
export const slis = pgTable('slis', {
  id: varchar('id', { length: 255 }).primaryKey(),
  sloId: varchar('slo_id', { length: 255 }).notNull().references(() => slos.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // availability, latency, quality, etc.
  unit: varchar('unit', { length: 50 }).notNull(), // percent, ms, etc.
  objectiveDirection: varchar('objective_direction', { length: 10 }).notNull(), // gte, lte
  target: decimal('target', { precision: 10, scale: 3 }).notNull(),
  source: varchar('source', { length: 255 }).notNull(), // server, client, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  sloIdx: index('slis_slo_idx').on(table.sloId),
  typeIdx: index('slis_type_idx').on(table.type),
}));

// Data Points (time series data for SLIs)
export const dataPoints = pgTable('data_points', {
  id: varchar('id', { length: 255 }).primaryKey(),
  sliId: varchar('sli_id', { length: 255 }).notNull().references(() => slis.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp').notNull(),
  good: integer('good').notNull().default(0), // for availability metrics
  bad: integer('bad').notNull().default(0), // for availability metrics
  value: decimal('value', { precision: 12, scale: 3 }), // for latency/other metrics
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sliTimestampIdx: index('data_points_sli_timestamp_idx').on(table.sliId, table.timestamp),
  timestampIdx: index('data_points_timestamp_idx').on(table.timestamp),
}));

// Relations
export const experiencesRelations = relations(experiences, ({ many }) => ({
  journeys: many(journeys),
}));

export const journeysRelations = relations(journeys, ({ one, many }) => ({
  experience: one(experiences, {
    fields: [journeys.experienceId],
    references: [experiences.id],
  }),
  slos: many(slos),
}));

export const slosRelations = relations(slos, ({ one, many }) => ({
  journey: one(journeys, {
    fields: [slos.journeyId],
    references: [journeys.id],
  }),
  indicators: many(slis),
}));

export const slisRelations = relations(slis, ({ one, many }) => ({
  slo: one(slos, {
    fields: [slis.sloId],
    references: [slos.id],
  }),
  dataPoints: many(dataPoints),
}));

export const dataPointsRelations = relations(dataPoints, ({ one }) => ({
  sli: one(slis, {
    fields: [dataPoints.sliId],
    references: [slis.id],
  }),
}));


