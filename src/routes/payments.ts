import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { payments } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const PaymentSchema = z.object({
    billId: z.string(),
    companyId: z.string(),
    amount: z.number(),
    date: z.string().or(z.date()),
    mode: z.string(),
    status: z.string(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    metadata: z.any().optional(),
});

export default async function (fastify: FastifyInstance) {
    // Create payment
    fastify.post("/payments", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = PaymentSchema.parse(req.body);
        const inserted = await db.insert(payments).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all payments (optionally filter by billId or companyId)
    fastify.get("/payments", { preHandler: [fastify.authenticate] }, async (req) => {
        const { billId, companyId } = req.query as { billId?: string; companyId?: string };
        let query = db.select().from(payments);
        if (billId) query = query.where(eq(payments.billId, billId));
        if (companyId) query = query.where(eq(payments.companyId, companyId));
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
        const data = PaymentSchema.partial().parse(req.body);
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
