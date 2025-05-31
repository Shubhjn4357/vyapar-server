import { FastifyInstance, FastifyRequest } from "fastify";
import { eq, ilike } from "drizzle-orm";
import { db } from "../db/drizzle";
import { companies, SelectCompanies } from '../db/schema';



export default async function (fastify: FastifyInstance) {
    fastify.post("/", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const userId = (req.user as { id: number }).id;
        const data = req.body as Omit<SelectCompanies, "id" | "createdAt" | "updatedAt">;
        const [company] = await db.insert(companies).values({ ...data, userId }).returning();
        return company;
    });

    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const userId = (req.user as { id: number }).id;
        return db.select().from(companies).where(eq(companies.userId, userId));
    });

    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const data = req.body as Partial<Omit<SelectCompanies, "id" | "createdAt" | "updatedAt">>;;
        const [company] = await db.update(companies).set(data).where(eq(companies.id, Number(id))).returning();
        return company;
    });

    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        await db.delete(companies).where(eq(companies.id, Number(id)));
        return { success: true };
    });

    // Get company by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const [company] = await db.select().from(companies).where(eq(companies.id, Number(id)));
        return company;
    });

    // Update company settings
    fastify.put("/:id/settings", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const { settings } = req.body as { settings: any };
        const [company] = await db.update(companies).set({ settings }).where(eq(companies.id, Number(id))).returning();
        return company;
    });

    // Filter companies by name
    fastify.get("/search", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { name } = req.query as { name: string };
        // Use ilike for case-insensitive search if supported, else fallback
        return db.select().from(companies).where(ilike(companies.name,`%${name}%`) || eq(companies.name, name));
    });
}