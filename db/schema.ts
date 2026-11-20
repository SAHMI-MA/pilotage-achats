import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("projects", {id:text("id").primaryKey(),payload:text("payload").notNull(),revision:integer("revision").notNull().default(1),updatedAt:text("updated_at").notNull()});
export const notificationDeliveries = sqliteTable("notification_deliveries",{id:text("id").primaryKey(),deliveredAt:text("delivered_at").notNull()});
export const projectImports = sqliteTable("project_imports", {
 id:text("id").primaryKey().notNull(),
 sourceHash:text("source_hash").notNull(),
 appliedAt:text("applied_at").notNull(),
 summary:text("summary").notNull(),
 backupPayload:text("backup_payload").notNull(),
 snapshotVerified:integer("snapshot_verified").notNull(),
},table=>[check("project_import_snapshot_verified",sql`${table.snapshotVerified} = 1`)]);
