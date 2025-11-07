import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleVideoUpload, uploadMiddleware } from "../uploadHandler";
import { getVideoById } from "../db";
import { storageGet } from "../storageAdapter";
import { localStorageGetInternal } from "../localStorage";
import { getBypassAuth } from "../db";
import { eq } from "drizzle-orm";
import { videos } from "../../drizzle/schema";
import { getDb } from "../db";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Video upload endpoint
  app.post("/api/upload-video", uploadMiddleware, handleVideoUpload);
  
  // Video streaming proxy endpoint (prevents direct download)
  app.get("/api/video/stream/:id", async (req, res) => {
    try {
      const videoId = parseInt(req.params.id);
      if (isNaN(videoId)) {
        return res.status(400).json({ error: "Invalid video ID" });
      }

      // Get video directly from database (without URL normalization)
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }

      const videoResult = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
      if (videoResult.length === 0) {
        return res.status(404).json({ error: "Video not found" });
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
            user = await sdk.authenticateRequest(req);

            // Check if video is published
            if (video.isPublished === 0) {
              // Unpublished video requires authentication
              if (!user) {
                console.log(`[Video Stream] Unauthorized access attempt to unpublished video ${videoId}`);
                return res.status(401).json({ 
                  error: "Unauthorized",
                  message: "この動画を視聴するにはログインが必要です",
                  requiresAuth: true
                });
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
              return res.status(401).json({ 
                error: "Unauthorized",
                message: "この動画を視聴するにはログインが必要です",
                requiresAuth: true
              });
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
      const range = req.headers.range;
      
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

          res.status(206);
          res.setHeader("Content-Range", contentRange || "");
          res.setHeader("Content-Length", contentLength || "");
          res.setHeader("Content-Type", contentType);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Cache-Control", "public, max-age=3600");

          // Stream the response body
          if (response.body) {
            // Convert ReadableStream to Node.js Readable stream
            const reader = response.body.getReader();
            const pump = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  res.write(Buffer.from(value));
                }
                res.end();
              } catch (error) {
                console.error("[Video Stream] Stream error:", error);
                res.end();
              }
            };
            pump();
          } else {
            res.end();
          }
        } else {
          // Fallback to full content
          const contentType = response.headers.get("content-type") || mimeType;
          res.status(200);
          res.setHeader("Content-Type", contentType);
          res.setHeader("Accept-Ranges", "bytes");
          res.setHeader("Cache-Control", "public, max-age=3600");

          if (response.body) {
            const reader = response.body.getReader();
            const pump = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  res.write(Buffer.from(value));
                }
                res.end();
              } catch (error) {
                console.error("[Video Stream] Stream error:", error);
                res.end();
              }
            };
            pump();
          } else {
            res.end();
          }
        }
      } else {
        // No range request - stream full video
        const response = await fetch(internalMinioUrl);
        const contentType = response.headers.get("content-type") || video.mimeType;
        const contentLength = response.headers.get("content-length");

        res.status(200);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Length", contentLength || "");
        res.setHeader("Cache-Control", "public, max-age=3600");

        if (response.body) {
          const reader = response.body.getReader();
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
              res.end();
            } catch (error) {
              console.error("[Video Stream] Stream error:", error);
              res.end();
            }
          };
          pump();
        } else {
          res.end();
        }
      }
    } catch (error) {
      console.error("[Video Stream] Error:", error);
      res.status(500).json({ error: "Failed to stream video" });
    }
  });
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
