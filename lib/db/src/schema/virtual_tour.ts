import { pgTable, serial, text, real, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const virtualTourScenesTable = pgTable("virtual_tour_scenes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  imageUrl: text("image_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  positionX: real("position_x"),
  positionY: real("position_y"),
  pitchCorrection: real("pitch_correction").default(0),
  yawCorrection: real("yaw_correction").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const virtualTourHotspotsTable = pgTable("virtual_tour_hotspots", {
  id: serial("id").primaryKey(),
  fromSceneId: integer("from_scene_id").notNull().references(() => virtualTourScenesTable.id, { onDelete: "cascade" }),
  toSceneId: integer("to_scene_id").notNull().references(() => virtualTourScenesTable.id, { onDelete: "cascade" }),
  yaw: real("yaw").notNull().default(0),
  pitch: real("pitch").notNull().default(0),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVirtualTourSceneSchema = createInsertSchema(virtualTourScenesTable).omit({ id: true, createdAt: true });
export const insertVirtualTourHotspotSchema = createInsertSchema(virtualTourHotspotsTable).omit({ id: true, createdAt: true });

export type InsertVirtualTourScene = z.infer<typeof insertVirtualTourSceneSchema>;
export type VirtualTourScene = typeof virtualTourScenesTable.$inferSelect;
export type InsertVirtualTourHotspot = z.infer<typeof insertVirtualTourHotspotSchema>;
export type VirtualTourHotspot = typeof virtualTourHotspotsTable.$inferSelect;
