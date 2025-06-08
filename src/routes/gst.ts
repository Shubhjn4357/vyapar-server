import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/drizzle";
import { gstTransactions, insertGstTransactionSchema, selectGstTransactionSchema } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // GSTR1
    fastify.get("/gstr1", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send({ success: true, data: { period: "2024-06", sales: [], summary: {} } });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch GSTR1 data." });
        }
    });

    // GSTR2B
    fastify.get("/gstr2b", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send({ success: true, data: { period: "2024-06", purchases: [], summary: {} } });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch GSTR2B data." });
        }
    });

    // GSTR3B
    fastify.get("/gstr3b", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send({ success: true, data: { period: "2024-06", summary: {} } });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch GSTR3B data." });
        }
    });

    // GST Reconciliation
    fastify.get("/reconciliation", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send({ success: true, data: { matched: [], unmatched: [], partial: [], summary: {} } });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch reconciliation data." });
        }
    });

    // GST Analytics
    fastify.get("/analytics", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send({ success: true, data: { analytics: {} } });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch analytics data." });
        }
    });

    // GST Audit
    fastify.get("/audit", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.send({ success: true, data: { audit: {} } });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch audit data." });
        }
    });

    // E-Invoice
    fastify.post("/einvoice", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const { transactionId } = req.body as { transactionId: string };
            // Dummy e-invoice generation
            return reply.send({
                success: true,
                data: {
                    irn: `IRN${Date.now()}`,
                    qrCode: `QR${transactionId}`,
                    signedInvoice: "base64_encoded_signed_invoice"
                }
            });
        } catch (error) {
            return reply.status(400).send({ success: false, error: "Failed to generate e-invoice." });
        }
    });

    // Create GST transaction
    fastify.post("/gst-transactions", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const data = insertGstTransactionSchema.parse(req.body);
            const inserted = await db.insert(gstTransactions).values(data).returning().then(r => r[0]);
            return reply.send({ success: true, data: inserted });
        } catch (error) {
            return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : "Failed to create GST transaction." });
        }
    });

    // Get all GST transactions (optionally filter by companyId)
    fastify.get("/gst-transactions", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { companyId } = req.query as { companyId?: string };
            let result;
            if (companyId) {
                result = await db.select().from(gstTransactions).where(eq(gstTransactions.companyId, companyId));
            } else {
                result = await db.select().from(gstTransactions);
            }
            return reply.send({ success: true, data: result });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch GST transactions." });
        }
    });

    // Get GST transaction by id
    fastify.get("/gst-transactions/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const result = await db.select().from(gstTransactions).where(eq(gstTransactions.id, id)).then(r => r[0]);
            if (!result) {
                return reply.status(404).send({ success: false, error: "GST transaction not found." });
            }
            return reply.send({ success: true, data: result });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to fetch GST transaction." });
        }
    });

    // Update GST transaction
    fastify.put("/gst-transactions/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const data = selectGstTransactionSchema.partial().parse(req.body);
            const updated = await db.update(gstTransactions).set(data).where(eq(gstTransactions.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.status(404).send({ success: false, error: "GST transaction not found." });
            }
            return reply.send({ success: true, data: updated });
        } catch (error) {
            return reply.status(400).send({ success: false, error: error instanceof Error ? error.message : "Failed to update GST transaction." });
        }
    });

    // Delete GST transaction
    fastify.delete("/gst-transactions/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const deleted = await db.delete(gstTransactions).where(eq(gstTransactions.id, id));
            return reply.send({ success: true });
        } catch (error) {
            return reply.status(500).send({ success: false, error: "Failed to delete GST transaction." });
        }
    });
}