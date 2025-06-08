import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { insertPaymentSchema, payments, selectPaymentSchema } from "../db/schema";
import { eq, and } from "drizzle-orm";


export default async function (fastify: FastifyInstance) {
    // Create payment
    fastify.post("/create", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const data = insertPaymentSchema.parse(req.body);
            const inserted = await db.insert(payments).values(data).returning().then(r => r[0]);
            return reply.code(201).send({ success: true, data: inserted });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to create payment" });
        }
    });

    // Get all payments (optionally filter by billId or companyId)
    fastify.get("/all", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
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
            return reply.send({ success: true, data: query });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to fetch payments" });
        }
    });

    // Get payment by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const payment = await db.select().from(payments).where(eq(payments.id, id)).then(r => r[0]);
            if (!payment) {
                return reply.code(404).send({ success: false, error: "Payment not found" });
            }
            return reply.send({ success: true, data: payment });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to fetch payment" });
        }
    });

    // Update payment
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const data = selectPaymentSchema.partial().parse(req.body);
            const updated = await db.update(payments).set(data).where(eq(payments.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({ success: false, error: "Payment not found" });
            }
            return reply.send({ success: true, data: updated });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to update payment" });
        }
    });

    // Delete payment
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const result = await db.delete(payments).where(eq(payments.id, id));
            return reply.send({ success: true, message: "Payment deleted successfully" });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to delete payment" });
        }
    });
}
