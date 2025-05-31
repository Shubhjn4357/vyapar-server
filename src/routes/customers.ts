import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { customers } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const CustomerSchema = z.object({
    companyId: z.string(),
    name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.any().optional(),
    gstin: z.string().optional(),
    balance: z.number().optional(),
});

export default async function (fastify: FastifyInstance) {
    // Create customer
    fastify.post("/customers", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = CustomerSchema.parse(req.body);
        const inserted = await db.insert(customers).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all customers (optionally filter by companyId)
    fastify.get("/customers", { preHandler: [fastify.authenticate] }, async (req) => {
        const { companyId } = req.query as { companyId?: string };
        if (companyId) {
            return db.select().from(customers).where(eq(customers.companyId, companyId));
        }
        return db.select().from(customers);
    });

    // Get customer by id
    fastify.get("/customers/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(customers).where(eq(customers.id, id)).then(r => r[0]);
    });

    // Update customer
    fastify.put("/customers/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        const data = CustomerSchema.partial().parse(req.body);
        const updated = await db.update(customers).set(data).where(eq(customers.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete customer
    fastify.delete("/customers/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        await db.delete(customers).where(eq(customers.id, id));
        return { success: true };
    });
}
