import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db/drizzle";
import { accounts, SelectAccounts } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Trial Balance
    fastify.get("/trial-balance", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        // Implement trial balance logic or return all accounts for now
        const allAccounts = await db.select().from(accounts);
        // ...calculate trial balance...
        return allAccounts;
    });

    // Balance Sheet
    fastify.get("/balance-sheet", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        // Implement balance sheet logic or return all accounts for now
        const allAccounts = await db.select().from(accounts);
        // ...calculate balance sheet...
        return allAccounts;
    });

    // Journal Entries
    fastify.get("/journal", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        return db.select().from(accounts).where(eq(accounts.type, "journal"));
    });

    // Ledger Entries
    fastify.get("/ledger", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        return db.select().from(accounts).where(eq(accounts.type, "ledger"));
    });

    // Create account entry
    fastify.post("/accounts", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const schema = z.object({
            date: z.string().or(z.date()),
            description: z.string().optional(),
            debit: z.string().or(z.number()).default("0"),
            credit: z.string().or(z.number()).default("0"),
            account: z.string(),
            type: z.string(),
            reference: z.string().optional(),
        });
        const data = schema.parse(req.body);
        const inserted = await db.insert(accounts).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all account entries
    fastify.get("/accounts", { preHandler: [fastify.authenticate] }, async () => {
        return db.select().from(accounts);
    });

    // Get single account entry by id
    fastify.get("/accounts/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(accounts).where(eq(accounts.id, id)).then(r => r[0]);
    });

    // Update account entry
    fastify.put("/accounts/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        const schema = z.object({
            date: z.string().or(z.date()).optional(),
            description: z.string().optional(),
            debit: z.string().or(z.number()).optional(),
            credit: z.string().or(z.number()).optional(),
            account: z.string().optional(),
            type: z.string().optional(),
            reference: z.string().optional(),
        });
        const data = schema.parse(req.body);
        const updated = await db.update(accounts).set(data).where(eq(accounts.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete account entry
    fastify.delete("/accounts/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const { id } = req.params as { id: string };
        await db.delete(accounts).where(eq(accounts.id, id));
        return { success: true };
    });
}