import mongoose from "mongoose";

const mongoUri = process.env.MONGODB_URI;

type MongooseCache = { connection: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalWithMongoose = global as typeof globalThis & { mongoose?: MongooseCache };
const cache = globalWithMongoose.mongoose ?? { connection: null, promise: null };
globalWithMongoose.mongoose = cache;

export async function connectToDatabase() {
  if (!mongoUri) throw new Error("MONGODB_URI must be set before using the database.");
  if (cache.connection) return cache.connection;
  cache.promise ??= mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  cache.connection = await cache.promise;
  return cache.connection;
}
