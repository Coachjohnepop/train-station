import dotenv from "dotenv";

// Must load before demo-json-blob (BLOB_TOKEN is read at module init).
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.vercel.prod" });
dotenv.config({ path: ".env.vercel.production", override: true });