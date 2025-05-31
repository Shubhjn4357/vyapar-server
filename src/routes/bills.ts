import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { bills } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const BillItemSchema = z.object({
    name: z.string(),
    quantity: z.number(),
    price: z.number(),
    total: z.number(),
    gstRate: z.number().optional(),
    hsnCode: z.string().optional(),
});

const BillSchema = z.object({
    customerId: z.string(),
    customerName: z.string(),
    amount: z.number(),
    date: z.string().or(z.date()),
    items: z.array(BillItemSchema),
    status: z.enum(['paid', 'unpaid', 'partial']),
    dueDate: z.string().or(z.date()),
    notes: z.string().optional(),
});

export default async function (fastify: FastifyInstance) {
    // Create bill
    fastify.post("/bills", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = BillSchema.parse(req.body);
        const inserted = await db.insert(bills).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all bills
    fastify.get("/bills", { preHandler: [fastify.authenticate] }, async () => {
        return db.select().from(bills);
    });

    // Get bill by id
    fastify.get("/bills/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(bills).where(eq(bills.id, id)).then(r => r[0]);
    });

    // Update bill
    fastify.put("/bills/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        const data = BillSchema.partial().omit(id).parse(req.body);
        const updated = await db.update(bills).set(data).where(eq(bills.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete bill
    fastify.delete("/bills/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        await db.delete(bills).where(eq(bills.id, id));
        return { success: true };
    });
}
