import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Videos table for storing uploaded video metadata
 */
export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(),
  /** Title of the video */
  title: varchar("title", { length: 255 }).notNull(),
  /** Optional description */
  description: text("description"),
  /** S3 file key for the video file */
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  /** Public URL to access the video */
  url: varchar("url", { length: 1024 }).notNull(),
  /** MIME type of the video (e.g., video/mp4) */
  mimeType: varchar("mimeType", { length: 64 }).notNull(),
  /** File size in bytes */
  fileSize: int("fileSize").notNull(),
  /** Duration in seconds (optional) */
  duration: int("duration"),
  /** Thumbnail URL (optional) */
  thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
  /** User who uploaded the video */
  uploadedBy: int("uploadedBy").notNull(),
  /** View count */
  viewCount: int("viewCount").default(0).notNull(),
  /** Published status */
  isPublished: int("isPublished").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;