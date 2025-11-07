import { NextRequest, NextResponse } from "next/server";
import { getVideoById } from "@/lib/db";
import { localStorageGetInternal } from "@/lib/localStorage";
import { getBypassAuth } from "@/lib/db";
import { eq } from "drizzle-orm";
import { videos } from "@/drizzle/schema";
import { getDb } from "@/lib/db";
import { sdk } from "@/lib/_core/sdk";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const videoId = parseInt(id);
    if (isNaN(videoId)) {
      return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
    }

    // Get video directly from database (without URL normalization)
    const db = await getDb();
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const videoResult = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (videoResult.length === 0) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const video = videoResult[0];
    const mimeType = video.mimeType;

    // Check if bypass auth is enabled (admin user can access all videos)
    const bypassAuth = await getBypassAuth();
    let user = null;

    if (bypassAuth) {
      // Development mode: create mock admin user
      // Admin users can access all videos including unpublished ones
      user = {
        id: 1,
        openId: "dev-user",
        name: "Development User",
        email: "dev@example.com",
        loginMethod: "bypass",
        role: "admin" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
      console.log(`[Video Stream] Video ${videoId} accessed by admin user (bypass auth enabled), Published: ${video.isPublished}`);
    } else {
      // Authentication check (can be enabled/disabled via environment variable)
      const enableAuth = process.env.ENABLE_VIDEO_AUTH === "true";

      if (enableAuth) {
        try {
          // Try to authenticate user
          const expressReq = {
            headers: {
              cookie: req.headers.get("cookie") || "",
            },
          } as any;
          user = await sdk.authenticateRequest(expressReq);

          // Check if video is published
          if (video.isPublished === 0) {
            // Unpublished video requires authentication
            if (!user) {
              console.log(`[Video Stream] Unauthorized access attempt to unpublished video ${videoId}`);
              return NextResponse.json({ 
                error: "Unauthorized",
                message: "この動画を視聴するにはログインが必要です",
                requiresAuth: true
              }, { status: 401 });
            }
            console.log(`[Video Stream] Video ${videoId} accessed by authenticated user ${user.id} (${user.name})`);
          } else {
            // Published video - log access
            console.log(`[Video Stream] Video ${videoId} accessed by ${user ? `user ${user.id} (${user.name})` : 'anonymous'}`);
          }
        } catch (error) {
          // Authentication failed
          if (video.isPublished === 0) {
            console.log(`[Video Stream] Authentication failed for unpublished video ${videoId}`);
            return NextResponse.json({ 
              error: "Unauthorized",
              message: "この動画を視聴するにはログインが必要です",
              requiresAuth: true
            }, { status: 401 });
          }
          // Published video - allow anonymous access
          console.log(`[Video Stream] Video ${videoId} accessed anonymously (auth failed)`);
        }
      } else {
        // Auth disabled - log for comparison
        console.log(`[Video Stream] Video ${videoId} accessed (auth disabled), Published: ${video.isPublished}`);
      }
    }

    // Get signed URL from MinIO using internal endpoint (for container-to-container communication)
    // This ensures the URL uses the internal network endpoint (minio:9000)
    const { url: internalMinioUrl } = await localStorageGetInternal(video.fileKey, 3600);

    // Handle Range Requests for video streaming
    const range = req.headers.get("range");
    
    if (range) {
      // Fetch with Range header from MinIO
      const response = await fetch(internalMinioUrl, {
        headers: { Range: range },
      });

      if (response.status === 206) {
        // Partial content
        const contentRange = response.headers.get("content-range");
        const contentLength = response.headers.get("content-length");
        const contentType = response.headers.get("content-type") || mimeType;

        const headers = new Headers();
        headers.set("Content-Range", contentRange || "");
        headers.set("Content-Length", contentLength || "");
        headers.set("Content-Type", contentType);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "public, max-age=3600");

        // Stream the response body
        if (response.body) {
          return new NextResponse(response.body, {
            status: 206,
            headers,
          });
        }
      } else {
        // Fallback to full content
        const contentType = response.headers.get("content-type") || mimeType;
        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Accept-Ranges", "bytes");
        headers.set("Cache-Control", "public, max-age=3600");

        if (response.body) {
          return new NextResponse(response.body, {
            status: 200,
            headers,
          });
        }
      }
    } else {
      // No range request - stream full video
      const response = await fetch(internalMinioUrl);
      const contentType = response.headers.get("content-type") || video.mimeType;
      const contentLength = response.headers.get("content-length");

      const headers = new Headers();
      headers.set("Content-Type", contentType);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", contentLength || "");
      headers.set("Cache-Control", "public, max-age=3600");

      if (response.body) {
        return new NextResponse(response.body, {
          status: 200,
          headers,
        });
      }
    }

    return NextResponse.json({ error: "Failed to stream video" }, { status: 500 });
  } catch (error) {
    console.error("[Video Stream] Error:", error);
    return NextResponse.json({ error: "Failed to stream video" }, { status: 500 });
  }
}

