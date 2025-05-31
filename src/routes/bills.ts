import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { bills, insertBillSchema, selectBillSchema } from '../db/schema';
import { eq } from "drizzle-orm";
export default async function (fastify: FastifyInstance) {
    // Create bill
    fastify.post("/add", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = insertBillSchema.parse(req.body);
        const inserted = await db.insert(bills).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all bills
    fastify.get("/all", { preHandler: [fastify.authenticate] }, async () => {
        return db.select().from(bills);
    });

    // Get bill by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(bills).where(eq(bills.id, id)).then(r => r[0]);
    });

    // Update bill
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        const data = selectBillSchema.partial().parse(req.body);
        const updated = await db.update(bills).set(data).where(eq(bills.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete bill
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        await db.delete(bills).where(eq(bills.id, id));
        return { success: true };
    });
}
