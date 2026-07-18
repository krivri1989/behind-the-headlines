import { S3Client, HeadBucketCommand, CreateBucketCommand, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const endpoint = process.env.RUSTFS_ENDPOINT;
const region = process.env.RUSTFS_REGION || "us-east-1";
const accessKeyId = process.env.RUSTFS_ACCESS_KEY;
const secretAccessKey = process.env.RUSTFS_SECRET_KEY;
const bucket = process.env.RUSTFS_BUCKET || "behind-the-headlines-media";

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.error("RustFS env vars not set");
  process.exit(1);
}

console.log("Connecting to RustFS at", endpoint);
const s3 = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

try {
  console.log("Checking bucket:", bucket);
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("✓ Bucket exists");
  } catch {
    console.log("Bucket not found, creating...");
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log("✓ Bucket created");
  }

  console.log("Uploading test file...");
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: "test-connection.txt",
    Body: "RustFS connection test",
    ContentType: "text/plain",
  }));
  console.log("✓ Test file uploaded");

  console.log("Listing objects...");
  const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 10 }));
  console.log("✓ Objects:", list.Contents?.map(o => o.Key) || []);

  process.exit(0);
} catch (error) {
  console.error("✗ RustFS error:", error.message);
  if (error.$metadata) console.error("  Metadata:", JSON.stringify(error.$metadata));
  process.exit(1);
}
