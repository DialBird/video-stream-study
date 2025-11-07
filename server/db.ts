import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertVideo, InsertSetting, users, videos, settings } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Video management helpers
 */

export async function createVideo(video: InsertVideo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(videos).values(video);
  return result;
}

function normalizeVideoUrl(url: string, videoId: number): string {
  // Use proxy endpoint instead of direct MinIO URL
  // This prevents direct download and URL exposure
  return `/api/video/stream/${videoId}`;
}

export async function getVideoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  if (result.length > 0) {
    const video = result[0];
    // Return proxy URL instead of direct MinIO URL
    return { ...video, url: normalizeVideoUrl(video.url, video.id) };
  }
  return undefined;
}

export async function getAllVideos() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(videos).orderBy(videos.createdAt);
  return result.map(video => ({ ...video, url: normalizeVideoUrl(video.url, video.id) }));
}

export async function getPublishedVideos() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select().from(videos).where(eq(videos.isPublished, 1)).orderBy(videos.createdAt);
  return result.map(video => ({ ...video, url: normalizeVideoUrl(video.url, video.id) }));
}

export async function updateVideoPublishedStatus(id: number, isPublished: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(videos).set({ isPublished }).where(eq(videos.id, id));
}

export async function deleteVideo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(videos).where(eq(videos.id, id));
}

export async function incrementViewCount(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(videos).set({ viewCount: sql`${videos.viewCount} + 1` }).where(eq(videos.id, id));
}

/**
 * Settings management helpers
 */

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result.length > 0 ? result[0].value : null;
}

export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  
  if (existing.length > 0) {
    await db.update(settings).set({ value, description }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value, description });
  }
}

export async function getBypassAuth(): Promise<boolean> {
  // Check database only (environment variable support removed)
  const dbValue = await getSetting("BYPASS_AUTH");
  return dbValue === "true";
}
