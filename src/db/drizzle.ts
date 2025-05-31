import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import dotenv from "dotenv";
dotenv.config();

const queryClient = neon(process.env.DATABASE_URL!);
export const db = drizzle(queryClient, { schema });