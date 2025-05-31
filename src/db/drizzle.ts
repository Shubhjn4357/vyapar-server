import { drizzle } from "drizzle-orm/neon-http";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });