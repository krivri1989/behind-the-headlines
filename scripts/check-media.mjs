import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) { console.error("MONGODB_URI is not set"); process.exit(1); }

await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const media = db.collection("media");

// Show sample URLs
const samples = await media.find({}).limit(5).toArray();
console.log("--- SAMPLE URLs ---");
for (const m of samples) {
  console.log(m.url);
}

// Count by URL pattern
const httpCount = await media.countDocuments({ url: /^http:\/\// });
const httpsCount = await media.countDocuments({ url: /^https:\/\// });
const hostDockerCount = await media.countDocuments({ url: /host\.docker\.internal/ });
const ipCount = await media.countDocuments({ url: /200\.97\.175\.18/ });
const domainCount = await media.countDocuments({ url: /behindtheheadlines\.in/ });
const mediaDomainCount = await media.countDocuments({ url: /media\.behindtheheadlines\.in/ });
const portCount = await media.countDocuments({ url: /:32769/ });

console.log("\n--- STATS ---");
console.log("Total media records:", await media.countDocuments());
console.log("HTTP URLs:", httpCount);
console.log("HTTPS URLs:", httpsCount);
console.log("host.docker.internal:", hostDockerCount);
console.log("IP 200.97.175.18:", ipCount);
console.log("behindtheheadlines.in:", domainCount);
console.log("media.behindtheheadlines.in:", mediaDomainCount);
console.log("Contains :32769:", portCount);

await mongoose.disconnect();
process.exit(0);
