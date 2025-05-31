import { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/drizzle";
import { payments, SelectPayments } from "../db/schema";

export default async function (fastify: FastifyInstance) {
    // Create payment
    fastify.post("/", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const data = req.body as Omit<SelectPayments, "id" | "createdAt" | "updatedAt">;
        const [payment] = await db.insert(payments).values(data).returning();
        return payment;
    });

    // Get all payments (optionally filter by billId)
    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { billId } = req.query as { billId?: number };
        if (billId) {
            return db.select().from(payments).where(eq(payments.billId, billId));
        }
        return db.select().from(payments);
    });

    // Get payment by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const [payment] = await db.select().from(payments).where(eq(payments.id, Number(id)));
        return payment;
    });

    // Update payment
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const data = req.body as Partial<SelectPayments>;
        const [payment] = await db.update(payments).set(data).where(eq(payments.id, Number(id))).returning();
        return payment;
    });

    // Delete payment
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        await db.delete(payments).where(eq(payments.id, Number(id)));
        return { success: true };
    });
}
