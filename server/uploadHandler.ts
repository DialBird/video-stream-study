import { Request, Response } from "express";
import multer from "multer";
import { storagePut } from "./storageAdapter";

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept video files
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed"));
    }
  },
});

export const uploadMiddleware = upload.single("video");

export async function handleVideoUpload(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { fileKey } = req.body;
    if (!fileKey) {
      return res.status(400).json({ error: "File key is required" });
    }

    // Upload to S3
    const result = await storagePut(
      fileKey,
      req.file.buffer,
      req.file.mimetype
    );

    return res.json({
      success: true,
      url: result.url,
      fileKey: result.key,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
}
