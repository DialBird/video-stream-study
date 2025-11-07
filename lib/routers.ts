import { COOKIE_NAME } from "@/shared/const";
import { getSessionCookieOptions } from "./_core/cookies-next";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createVideo, deleteVideo, getAllVideos, getPublishedVideos, getVideoById, incrementViewCount, updateVideoPublishedStatus } from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
    // Next.js API routes handle all API endpoints under /api/
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Note: Cookie clearing is handled in the API route handler
      return {
        success: true,
      } as const;
    }),
  }),

  video: router({
    // Upload video metadata after client uploads file
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          fileKey: z.string(),
          url: z.string(),
          mimeType: z.string(),
          fileSize: z.number(),
          duration: z.number().optional(),
          thumbnailUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createVideo({
          ...input,
          uploadedBy: ctx.user.id,
          isPublished: 1,
        });
        return { success: true };
      }),

    // Get all videos (admin only)
    listAll: protectedProcedure.query(async () => {
      return await getAllVideos();
    }),

    // Get published videos (public)
    // If user is authenticated (especially admin via bypass-auth), return all videos
    list: publicProcedure.query(async ({ ctx }) => {
      // If user is authenticated (including bypass-auth admin), show all videos
      if (ctx.user && ctx.user.role === 'admin') {
        return await getAllVideos();
      }
      // Otherwise, return only published videos
      return await getPublishedVideos();
    }),

    // Get video by ID
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const video = await getVideoById(input.id);
        if (!video) {
          throw new Error("Video not found");
        }
        return video;
      }),

    // Increment view count
    incrementView: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await incrementViewCount(input.id);
        return { success: true };
      }),

    // Delete video
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteVideo(input.id);
        return { success: true };
      }),

    // Update video published status
    updatePublishedStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          isPublished: z.number().min(0).max(1),
        })
      )
      .mutation(async ({ input }) => {
        await updateVideoPublishedStatus(input.id, input.isPublished);
        return { success: true };
      }),

    // Get upload URL for direct file upload
    getUploadUrl: protectedProcedure
      .input(
        z.object({
          filename: z.string(),
          mimeType: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 15);
        const fileKey = `videos/${ctx.user.id}/${timestamp}-${randomSuffix}-${input.filename}`;
        
        return {
          fileKey,
          uploadUrl: `/api/upload-video`, // We'll handle upload via API endpoint
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
