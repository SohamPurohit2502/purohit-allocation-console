import { sqliteTable,text } from 'drizzle-orm/sqlite-core';
export const clients=sqliteTable('clients',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const schemes=sqliteTable('schemes',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const records=sqliteTable('records',{id:text('id').primaryKey(),status:text('status').notNull(),payload:text('payload').notNull()});
export const preferences=sqliteTable('preferences',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const baskets=sqliteTable('baskets',{id:text('id').primaryKey(),payload:text('payload').notNull()});
