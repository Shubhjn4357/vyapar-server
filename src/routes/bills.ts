import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { bills, insertBillSchema, selectBillSchema } from '../db/schema';
import { eq } from "drizzle-orm";
export default async function (fastify: FastifyInstance) {
    // Create bill
    fastify.post("/add", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const data = insertBillSchema.parse(req.body);
            const inserted = await db.insert(bills).values(data).returning().then(r => r[0]);
            return reply.code(201).send({ success: true, data: inserted });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to create bill" });
        }
    });

    // Get all bills
    fastify.get("/all", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const allBills = await db.select().from(bills);
            return reply.send({ success: true, data: allBills });
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message || "Failed to fetch bills" });
        }
    });

    // Get bill by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const bill = await db.select().from(bills).where(eq(bills.id, id)).then(r => r[0]);
            if (!bill) {
                return reply.code(404).send({ success: false, error: "Bill not found" });
            }
            return reply.send({ success: true, data: bill });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to fetch bill" });
        }
    });

    // Update bill
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const data = selectBillSchema.partial().parse(req.body);
            const updated = await db.update(bills).set(data).where(eq(bills.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({ success: false, error: "Bill not found" });
            }
            return reply.send({ success: true, data: updated });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to update bill" });
        }
    });

    // Delete bill
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const result = await db.delete(bills).where(eq(bills.id, id));
            return reply.send({ success: true });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to delete bill" });
        }
    });
}
