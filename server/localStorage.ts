// Local S3 storage helpers for development environment
// Uses AWS SDK to connect directly to S3 or MinIO

import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const config: any = {
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  };

  // For MinIO or S3-compatible services
  if (process.env.AWS_S3_ENDPOINT) {
    config.endpoint = process.env.AWS_S3_ENDPOINT;
    config.forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === "true";
  }

  s3Client = new S3Client(config);
  return s3Client;
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET environment variable is not set");
  }
  return bucket;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Upload file to S3/MinIO
 */
export async function localStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);

  const body = typeof data === "string" ? Buffer.from(data) : data;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);

  // Construct public URL
  // Use AWS_S3_PUBLIC_ENDPOINT for browser-accessible URLs, fallback to AWS_S3_ENDPOINT
  const publicEndpoint = process.env.AWS_S3_PUBLIC_ENDPOINT || process.env.AWS_S3_ENDPOINT || `https://s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;
  const url = `${publicEndpoint}/${bucket}/${key}`;

  return { key, url };
}

/**
 * Get presigned download URL for S3/MinIO object
 */
export async function localStorageGet(
  relKey: string,
  expiresIn = 3600
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  let url = await getSignedUrl(client, command, { expiresIn });
  
  // Replace internal endpoint with public endpoint if AWS_S3_PUBLIC_ENDPOINT is set
  if (process.env.AWS_S3_PUBLIC_ENDPOINT && process.env.AWS_S3_ENDPOINT) {
    const internalEndpoint = process.env.AWS_S3_ENDPOINT;
    const publicEndpoint = process.env.AWS_S3_PUBLIC_ENDPOINT;
    url = url.replace(internalEndpoint, publicEndpoint);
  }

  return { key, url };
}

/**
 * Delete file from S3/MinIO
 */
export async function localStorageDelete(relKey: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucket();
  const key = normalizeKey(relKey);

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}
