import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { insertPaymentSchema, payments, selectPaymentSchema } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";


export default async function (fastify: FastifyInstance) {
    // Create payment
    fastify.post("/payments", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = insertPaymentSchema.parse(req.body);
        const inserted = await db.insert(payments).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all payments (optionally filter by billId or companyId)
    fastify.get("/payments", { preHandler: [fastify.authenticate] }, async (req) => {
        const { billId, companyId } = req.query as { billId?: string; companyId?: string };
        const whereClauses = [];
        if (billId) {
            whereClauses.push(eq(payments.billId, billId));
        }
        if (companyId) {
            whereClauses.push(eq(payments.companyId, companyId));
        }
        const query = await db
            .select()
            .from(payments)
            .where(whereClauses.length === 0 ? undefined : whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses))
            .execute();
        return query;
    });

    // Get payment by id
    fastify.get("/payments/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(payments).where(eq(payments.id, id)).then(r => r[0]);
    });

    // Update payment
    fastify.put("/payments/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        const data = selectPaymentSchema.partial().parse(req.body);
        const updated = await db.update(payments).set(data).where(eq(payments.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete payment
    fastify.delete("/payments/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        await db.delete(payments).where(eq(payments.id, id));
        return { success: true };
    });
}
