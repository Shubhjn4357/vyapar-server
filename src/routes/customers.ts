import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { customers, insertCustomerSchema, selectCustomerSchema } from "../db/schema";
import { eq } from "drizzle-orm";


export default async function (fastify: FastifyInstance) {
    // Create customer
    fastify.post("/add", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const data = insertCustomerSchema.parse(req.body);
            const inserted = await db.insert(customers).values(data).returning().then(r => r[0]);
            return reply.code(201).send({ success: true, customer: inserted });
        } catch (error: any) {
            return reply.code(400).send({ success: false, message: error.message || "Failed to add customer" });
        }
    });

    // Get all customers (optionally filter by companyId)
    fastify.get("/all", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { companyId } = req.query as { companyId?: string };
            let result;
            if (companyId) {
                result = await db.select().from(customers).where(eq(customers.companyId, companyId));
            } else {
                result = await db.select().from(customers);
            }
            return reply.send({ success: true, customers: result });
        } catch (error: any) {
            return reply.code(500).send({ success: false, message: error.message || "Failed to fetch customers" });
        }
    });

    // Get customer by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const customer = await db.select().from(customers).where(eq(customers.id, id)).then(r => r[0]);
            if (!customer) {
                return reply.code(404).send({ success: false, message: "Customer not found" });
            }
            return reply.send({ success: true, customer });
        } catch (error: any) {
            return reply.code(500).send({ success: false, message: error.message || "Failed to fetch customer" });
        }
    });

    // Update customer
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const data = selectCustomerSchema.partial().parse(req.body);
            const updated = await db.update(customers).set(data).where(eq(customers.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({ success: false, message: "Customer not found" });
            }
            return reply.send({ success: true, customer: updated });
        } catch (error: any) {
            return reply.code(400).send({ success: false, message: error.message || "Failed to update customer" });
        }
    });

    // Delete customer
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const result = await db.delete(customers).where(eq(customers.id, id));
            // Optionally check if a row was deleted
            return reply.send({ success: true, message: "Customer deleted" });
        } catch (error: any) {
            return reply.code(500).send({ success: false, message: error.message || "Failed to delete customer" });
        }
    });
}
