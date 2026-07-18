import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.RUSTFS_ENDPOINT;
const region = process.env.RUSTFS_REGION || "us-east-1";
const accessKeyId = process.env.RUSTFS_ACCESS_KEY;
const secretAccessKey = process.env.RUSTFS_SECRET_KEY;
const bucket = process.env.RUSTFS_BUCKET || "behind-the-headlines-media";
const publicUrl = process.env.RUSTFS_PUBLIC_URL || endpoint;

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("RUSTFS_ENDPOINT, RUSTFS_ACCESS_KEY, and RUSTFS_SECRET_KEY must be set before using object storage.");
  }
  if (!client) {
    client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }
  return client;
}

export async function ensureBucket(): Promise<void> {
  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export type UploadResult = { key: string; url: string; bucket: string; etag?: string };

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  const url = `${publicUrl}/${bucket}/${key}`;
  return { key, url, bucket };
}

export async function deleteFile(key: string): Promise<void> {
  const s3 = getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const s3 = getClient();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export async function getSignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
  const s3 = getClient();
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export function getObjectUrl(key: string): string {
  return `${publicUrl}/${bucket}/${key}`;
}

export function isStorageConfigured(): boolean {
  return Boolean(endpoint && accessKeyId && secretAccessKey);
}

export type StoredObject = {
  key: string;
  size: number;
  lastModified: Date;
  contentType: string;
};

/**
 * List all objects in the bucket under the given prefixes.
 * Returns objects from both "media/" and "rss-images/" folders.
 */
export async function listAllObjects(prefixes: string[] = ["media/", "rss-images/"]): Promise<StoredObject[]> {
  const s3 = getClient();
  const results: StoredObject[] = [];

  for (const prefix of prefixes) {
    let continuationToken: string | undefined;
    do {
      const response = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        }),
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (!obj.Key) continue;
          results.push({
            key: obj.Key,
            size: obj.Size ?? 0,
            lastModified: obj.LastModified ?? new Date(),
            contentType: guessContentType(obj.Key),
          });
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  return results;
}

function guessContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    svg: "image/svg+xml",
  };
  return types[ext || ""] || "application/octet-stream";
}
