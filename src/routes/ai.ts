import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { aiService } from "../services/aiService";
import { z } from "zod";
import { RoleEnum } from "../db/schema";

export default async function (fastify: FastifyInstance) {
    // Allowed roles for AI endpoints
    const allowedRoles = RoleEnum.enumValues.filter(r =>
        ["user", "admin", "manager", "developer"].includes(r)
    );

    // Generate tax optimization insights
    fastify.post("/insights/tax-optimization", {
        preHandler: [fastify.authenticate, fastify.requireRole("user")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string()
            });
            const { companyId } = schema.parse(req.body);

            const insights = await aiService.generateTaxOptimizationInsights(companyId);

            reply.send({
                status: 'success',
                data: insights,
                message: 'Tax optimization insights generated successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to generate tax optimization insights"
            });
        }
    });

    // Generate risk analysis
    fastify.post("/insights/risk-analysis", {
        preHandler: [fastify.authenticate, fastify.requireRole("user")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string()
            });
            const { companyId } = schema.parse(req.body);

            const insights = await aiService.generateRiskAnalysis(companyId);

            reply.send({
                status: 'success',
                data: insights,
                message: 'Risk analysis generated successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to generate risk analysis"
            });
        }
    });

    // Generate trend analysis
    fastify.post("/insights/trend-analysis", {
        preHandler: [fastify.authenticate, fastify.requireRole("user")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string()
            });
            const { companyId } = schema.parse(req.body);

            const insights = await aiService.generateTrendAnalysis(companyId);

            reply.send({
                status: 'success',
                data: insights,
                message: 'Trend analysis generated successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to generate trend analysis"
            });
        }
    });

    // Generate expense analysis
    fastify.post("/insights/expense-analysis", {
        preHandler: [fastify.authenticate, fastify.requireRole("user")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string()
            });
            const { companyId } = schema.parse(req.body);

            const insights = await aiService.generateExpenseAnalysis(companyId);

            reply.send({
                status: 'success',
                data: insights,
                message: 'Expense analysis generated successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to generate expense analysis"
            });
        }
    });

    // Generate all insights
    fastify.post("/insights/generate-all", {
        preHandler: [fastify.authenticate, fastify.requireRole("user")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string()
            });
            const { companyId } = schema.parse(req.body);

            const insights = await aiService.generateAllInsights(companyId);

            reply.send({
                status: 'success',
                data: insights,
                message: 'All insights generated successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to generate insights"
            });
        }
    });

    // Get existing insights
    fastify.get("/insights", {
        preHandler: [fastify.authenticate, fastify.requireRole("user")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string(),
                type: z.string().optional()
            });
            const { companyId, type } = schema.parse(req.query);

            const insights = await aiService.getInsights(companyId, type);

            reply.send({
                status: 'success',
                data: insights,
                message: 'Insights retrieved successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to get insights"
            });
        }
    });
}