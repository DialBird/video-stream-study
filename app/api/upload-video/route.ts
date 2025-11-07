import { NextRequest, NextResponse } from "next/server";
import { storagePut } from "@/lib/storageAdapter";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("video") as File | null;
    const fileKey = formData.get("fileKey") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!fileKey) {
      return NextResponse.json({ error: "File key is required" }, { status: 400 });
    }

    // Only accept video files
    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Only video files are allowed" }, { status: 400 });
    }

    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 500MB limit" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to S3
    const result = await storagePut(fileKey, buffer, file.type);

    return NextResponse.json({
      success: true,
      url: result.url,
      fileKey: result.key,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

