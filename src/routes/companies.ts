import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { companies, insertCompanySchema, selectCompanySchema, users } from "../db/schema";
import { eq } from "drizzle-orm";
// Removed unused CompanySchema

export default async function (fastify: FastifyInstance) {
    // Create company
    fastify.post("/add", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const data = insertCompanySchema.parse(req.body);
            const inserted = await db.insert(companies).values(data).returning().then(r => r[0]);
            return reply.code(201).send({ success: true, data: inserted });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(400).send({ success: false, error: error.message || "Failed to add company" });
        }
    });

    // Get all companies
    fastify.get("/all", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const allCompanies = await db.select().from(companies);
            return reply.send({ success: true, data: allCompanies });
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message || "Failed to fetch companies" });
        }
    });

    // Get companies by users
    fastify.get("/user/:userId", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { userId } = req.params as { userId: number };
            const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
            if (!user) {
                return reply.code(404).send({ success: false, error: "User not found" });
            }
            const companiesData = await db.select().from(companies).where(eq(companies.userId, userId));
            return reply.send({ success: true, data: companiesData });
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message || "Failed to fetch companies" });
        }
    });
    // Get company by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const company = await db.select().from(companies).where(eq(companies.id, id)).then(r => r[0]);
            if (!company) {
                return reply.code(404).send({ success: false, error: "Company not found" });
            }
            return reply.send({ success: true, data: company });
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message || "Failed to fetch company" });
        }
    });

    // Update company
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const data = selectCompanySchema.partial().parse(req.body);
            const updated = await db.update(companies).set(data).where(eq(companies.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({ success: false, error: "Company not found" });
            }
            return reply.send({ success: true, data: updated });
        } catch (error: any) {
            return reply.code(400).send({ success: false, error: error.message || "Failed to update company" });
        }
    });

    // Delete company
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            await db.delete(companies).where(eq(companies.id, id));
            return reply.send({ success: true });
        } catch (error: any) {
            return reply.code(500).send({ success: false, error: error.message || "Failed to delete company" });
        }
    });
}
