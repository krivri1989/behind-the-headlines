import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

console.log("Connecting to MongoDB...");
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log("✓ MongoDB connected successfully");
  console.log("  Database:", mongoose.connection.name);
  console.log("  Host:", mongoose.connection.host);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("  Collections:", collections.length);
  await mongoose.disconnect();
  process.exit(0);
} catch (error) {
  console.error("✗ MongoDB connection failed:", error.message);
  process.exit(1);
}
