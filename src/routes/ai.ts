import { FastifyInstance, FastifyRequest } from "fastify";
import { db } from "../db/drizzle";
import { aiInsights } from "../db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const AIInsightSchema = z.object({
    companyId: z.string(),
    type: z.string(),
    data: z.any(),
});

export default async function (fastify: FastifyInstance) {
    fastify.post("/analyze", { preHandler: [fastify.authenticate] }, async (_req: FastifyRequest) => {
        return { suggestion: "Optimize ITC claim", risk: "Low" };
    });

    // AI analytics
    fastify.post("/analytics", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        // Dummy AI analytics
        return { analytics: { profitability: 0.9, risk: 0.1 } };
    });

    // AI suggestions
    fastify.post("/suggestions", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        // Dummy suggestions
        return { suggestions: ["Optimize ITC", "File GSTR1 on time"] };
    });

    // Create AI insight
    fastify.post("/ai-insights", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        const data = AIInsightSchema.parse(req.body);
        const inserted = await db.insert(aiInsights).values(data).returning().then(r => r[0]);
        return inserted;
    });

    // Get all AI insights (optionally filter by companyId)
    fastify.get("/ai-insights", { preHandler: [fastify.authenticate] }, async (req) => {
        const { companyId } = req.query as { companyId?: string };
        if (companyId) {
            return db.select().from(aiInsights).where(eq(aiInsights.companyId, companyId));
        }
        return db.select().from(aiInsights);
    });

    // Get AI insight by id
    fastify.get("/ai-insights/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        return db.select().from(aiInsights).where(eq(aiInsights.id, id)).then(r => r[0]);
    });

    // Update AI insight
    fastify.put("/ai-insights/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        const data = AIInsightSchema.partial().parse(req.body);
        const updated = await db.update(aiInsights).set(data).where(eq(aiInsights.id, id)).returning().then(r => r[0]);
        return updated;
    });

    // Delete AI insight
    fastify.delete("/ai-insights/:id", { preHandler: [fastify.authenticate] }, async (req) => {
        const { id } = req.params as { id: string };
        await db.delete(aiInsights).where(eq(aiInsights.id, id));
        return { success: true };
    });
}