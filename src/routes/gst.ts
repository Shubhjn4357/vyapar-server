import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db/drizzle";
import { gstTransactions } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const GSTTransactionSchema = z.object({
    companyId: z.string(),
    billId: z.string().optional(),
    type: z.enum(['sales', 'purchase']),
    date: z.string().or(z.date()),
    partyName: z.string().optional(),
    partyGstin: z.string().optional(),
    taxableAmount: z.number(),
    totalTax: z.number(),
    cgst: z.number().optional(),
    sgst: z.number().optional(),
    igst: z.number().optional(),
    total: z.number(),
    items: z.any().optional(),
    placeOfSupply: z.string().optional(),
    reverseCharge: z.boolean().optional(),
});

export default async function (fastify: FastifyInstance) {
    // GSTR1
    fastify.get("/gstr1", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest) => {
        // Return dummy GSTR1 data or integrate with your GST logic
        return { period: "2024-06", sales: [], summary: {} };
    });

    // GSTR2B
    fastify.get("/gstr2b", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest) => {
        return { period: "2024-06", purchases: [], summary: {} };
    });

    // GSTR3B
    fastify.get("/gstr3b", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest) => {
        return { period: "2024-06", summary: {} };
    });

    // GST Reconciliation
    fastify.get("/reconciliation", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest) => {
        return { matched: [], unmatched: [], partial: [], summary: {} };
    });

    // GST Analytics
    fastify.get("/analytics", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest) => {
        return { analytics: {} };
    });

    // GST Audit
    fastify.get("/audit", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest) => {
        return { audit: {} };
    });

    // E-Invoice
    fastify.post("/einvoice", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const { transactionId } = req.body as { transactionId: string };
        // Dummy e-invoice generation
        return {
            irn: `IRN${Date.now()}`,
            qrCode: `QR${transactionId}`,
            signedInvoice: "base64_encoded_signed_invoice"
        };
    });

    // Create GST transaction
    fastify.post("/gst-transactions", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = GSTTransactionSchema.parse(req.body);
        const inserted = await db.insert(gstTransactions).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all GST transactions (optionally filter by companyId)
    fastify.get("/gst-transactions", { preHandler: [fastify.authenticate] }, async (req) => {
        const { companyId } = req.query as { companyId?: string };
        if (companyId) {
            return db.select().from(gstTransactions).where(eq(gstTransactions.companyId, companyId));
        }
        return db.select().from(gstTransactions);
    });

    // Get GST transaction by id
    fastify.get("/gst-transactions/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(gstTransactions).where(eq(gstTransactions.id, id)).then(r => r[0]);
    });

    // Update GST transaction
    fastify.put("/gst-transactions/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        const data = GSTTransactionSchema.partial().parse(req.body);
        const updated = await db.update(gstTransactions).set(data).where(eq(gstTransactions.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete GST transaction
    fastify.delete("/gst-transactions/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        await db.delete(gstTransactions).where(eq(gstTransactions.id, id));
        return { success: true };
    });
}