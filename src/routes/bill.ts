import { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/drizzle";
import { bills, SelectBills } from '../db/schema';

export default async function (fastify: FastifyInstance) {
    fastify.post("/", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const data = req.body as Omit<SelectBills, "id" | "createdAt">;
        const [bill] = await db.insert(bills).values(data).returning();
        return bill;
    });

    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { companyId } = req.query as { companyId: string };
        return db.select().from(bills).where(eq(bills.companyId, Number(companyId)));
    });

    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const data = req.body as Partial<Omit<SelectBills, "id" | "createdAt">>;
        const updatedData = {
            ...data,

        }
        const [bill] = await db.update(bills).set(updatedData).where(eq(bills.id, Number(id))).returning();
        return bill;
    });

    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        await db.delete(bills).where(eq(bills.id, Number(id)));
        return { success: true };
    });

    // Get bill by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const [bill] = await db.select().from(bills).where(eq(bills.id, Number(id)));
        return bill;
    });

    // Filter bills by status, date range, etc.
    fastify.get("/search", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { status, fromDate, toDate } = req.query as { status?: string; fromDate?: string; toDate?: string };
        
        let q = db.select().from(bills);

        // Dynamically build where conditions based on query params
        const conditions = [];

        if (status) {
            conditions.push(eq(bills.status, status));
        }

        // Add more dynamic filters based on query params
        for (const [key, value] of Object.entries(req.query as Record<string, any>)) {
            if (
            value !== undefined &&
            value !== "" &&
            key !== "status" &&
            key !== "fromDate" &&
            key !== "toDate" &&
            key in bills
            ) {
            // @ts-ignore
            conditions.push(eq(bills[key], value));
            }
        }

        if (conditions.length > 0) {
            // Import and from drizzle-orm if not already
            // import { and } from "drizzle-orm";
            // @ts-ignore
            q = q.where(and(...conditions));
        }
        return await q;
    });
}