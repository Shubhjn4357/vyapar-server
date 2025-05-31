import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { customers, insertCustomerSchema, selectCustomerSchema } from "../db/schema";
import { eq } from "drizzle-orm";


export default async function (fastify: FastifyInstance) {
    // Create customer
    fastify.post("/add", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = insertCustomerSchema.parse(req.body);
        const inserted = await db.insert(customers).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all customers (optionally filter by companyId)
    fastify.get("/all", { preHandler: [fastify.authenticate] }, async (req) => {
        const { companyId } = req.query as { companyId?: string };
        if (companyId) {
            return db.select().from(customers).where(eq(customers.companyId, companyId));
        }
        return db.select().from(customers);
    });

    // Get customer by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(customers).where(eq(customers.id, id)).then(r => r[0]);
    });

    // Update customer
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        const data = selectCustomerSchema.partial().parse(req.body);
        const updated = await db.update(customers).set(data).where(eq(customers.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete customer
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        await db.delete(customers).where(eq(customers.id, id));
        return { success: true };
    });
}
