import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { companies, insertCompanySchema, selectCompanySchema } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const CompanySchema = z.object({
    name: z.string(),
    gstin: z.string().optional(),
    address: z.any().optional(),
    contactDetails: z.any().optional(),
    settings: z.any().optional(),
});

export default async function (fastify: FastifyInstance) {
    // Create company
    fastify.post("/companies", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = insertCompanySchema.parse(req.body);
        const inserted = await db.insert(companies).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all companies
    fastify.get("/companies", { preHandler: [fastify.authenticate] }, async () => {
        return db.select().from(companies);
    });

    // Get company by id
    fastify.get("/companies/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: number };
        return db.select().from(companies).where(eq(companies.id, id)).then(r => r[0]);
    });

    // Update company
    fastify.put("/companies/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: number };
        const data = selectCompanySchema.partial().parse(req.body);
        const updated = await db.update(companies).set(data).where(eq(companies.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete company
    fastify.delete("/companies/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: number };
        await db.delete(companies).where(eq(companies.id, id));
        return { success: true };
    });
}
