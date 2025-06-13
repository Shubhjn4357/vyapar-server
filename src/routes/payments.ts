import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { insertPaymentSchema, payments, selectPaymentSchema, bills, customers } from "../db/schema";
import { eq, and, gte, lte, desc, asc, count, sum, sql } from "drizzle-orm";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Get all payments with pagination and filters
    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                page: z.string().optional().transform(val => val ? parseInt(val) : 1),
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                billId: z.string().optional(),
                companyId: z.string().optional(),
                mode: z.string().optional(),
                status: z.enum(['pending', 'completed', 'failed']).optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                search: z.string().optional(),
                sortBy: z.enum(['date', 'amount', 'mode']).optional().default('date'),
                sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
            });
            
            const params = querySchema.parse(req.query);
            const offset = (params.page - 1) * params.limit;
            
            let whereConditions = [];
            if (params.billId) whereConditions.push(eq(payments.billId, params.billId));
            if (params.companyId) whereConditions.push(eq(payments.companyId, params.companyId));
            if (params.mode) whereConditions.push(eq(payments.mode, params.mode));
            if (params.status) whereConditions.push(eq(payments.status, params.status));
            if (params.startDate) whereConditions.push(gte(payments.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(payments.date, new Date(params.endDate)));
            if (params.search) {
                whereConditions.push(
                    sql`(${payments.reference} ILIKE ${`%${params.search}%`} OR ${payments.notes} ILIKE ${`%${params.search}%`})`
                );
            }
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            // Determine sort column
            let sortColumn: any = payments.date;
            if (params.sortBy === 'amount') sortColumn = payments.amount;
            if (params.sortBy === 'mode') sortColumn = payments.mode;
            
            const sortOrder = params.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);
            
            const [paymentsResult, totalResult] = await Promise.all([
                db.select().from(payments)
                    .where(whereClause)
                    .orderBy(sortOrder)
                    .limit(params.limit)
                    .offset(offset),
                db.select({ count: count() }).from(payments).where(whereClause)
            ]);
            
            const total = totalResult[0].count;
            const totalPages = Math.ceil(total / params.limit);
            
            return reply.send({
                status: 'success',
                data: {
                    payments: paymentsResult,
                    total,
                    page: params.page,
                    totalPages
                }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch payments"
            });
        }
    });

    // Create payment
    fastify.post("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const createPaymentSchema = z.object({
                billId: z.string(),
                amount: z.number(),
                mode: z.string(),
                reference: z.string().optional(),
                notes: z.string().optional(),
                companyId: z.string()
            });
            
            const data = createPaymentSchema.parse(req.body);
            const paymentData = {
                billId: data.billId,
                companyId: data.companyId,
                userId: (req.user as any).id,
                amount: data.amount.toString(),
                date: new Date(),
                mode: data.mode,
                status: 'completed',
                reference: data.reference,
                notes: data.notes,
                createdBy: (req.user as any).id,
                updatedBy: (req.user as any).id
            };
            
            const inserted = await db.insert(payments).values(paymentData).returning().then(r => r[0]);
            
            // Update bill payment status
            await db.update(bills)
                .set({ paymentStatus: 'paid' })
                .where(eq(bills.id, data.billId));
            
            return reply.code(201).send({
                status: 'success',
                data: inserted,
                message: 'Payment recorded successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to create payment"
            });
        }
    });

    // Get payment by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const payment = await db.select().from(payments).where(eq(payments.id, id)).then(r => r[0]);
            if (!payment) {
                return reply.code(404).send({
                    status: 'error',
                    message: "Payment not found"
                });
            }
            return reply.send({
                status: 'success',
                data: payment
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch payment"
            });
        }
    });

    // Update payment
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const updateData = { ...(req.body as any), updatedBy: (req.user as any).id, updatedAt: new Date() };
            const updated = await db.update(payments).set(updateData).where(eq(payments.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({
                    status: 'error',
                    message: "Payment not found"
                });
            }
            return reply.send({
                status: 'success',
                data: updated,
                message: 'Payment updated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to update payment"
            });
        }
    });

    // Delete payment
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            await db.delete(payments).where(eq(payments.id, id));
            return reply.send({
                status: 'success',
                message: "Payment deleted successfully"
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to delete payment"
            });
        }
    });

    // Get payment summary
    fastify.get("/summary", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(payments.companyId, params.companyId));
            if (params.startDate) whereConditions.push(gte(payments.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(payments.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const [summary] = await db.select({
                totalPayments: sum(payments.amount),
                totalCount: count(),
                completedPayments: sum(sql`CASE WHEN ${payments.status} = 'completed' THEN ${payments.amount} ELSE 0 END`),
                pendingPayments: sum(sql`CASE WHEN ${payments.status} = 'pending' THEN ${payments.amount} ELSE 0 END`),
                failedPayments: sum(sql`CASE WHEN ${payments.status} = 'failed' THEN ${payments.amount} ELSE 0 END`)
            }).from(payments).where(whereClause);
            
            const result = {
                totalPayments: Number(summary.totalPayments) || 0,
                totalCount: Number(summary.totalCount) || 0,
                completedPayments: Number(summary.completedPayments) || 0,
                pendingPayments: Number(summary.pendingPayments) || 0,
                failedPayments: Number(summary.failedPayments) || 0
            };
            
            return reply.send({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch payment summary"
            });
        }
    });

    // Get payment methods summary
    fastify.get("/methods", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(payments.companyId, params.companyId));
            if (params.startDate) whereConditions.push(gte(payments.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(payments.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const methodsSummary = await db.select({
                mode: payments.mode,
                totalAmount: sum(payments.amount),
                count: count()
            })
            .from(payments)
            .where(whereClause)
            .groupBy(payments.mode);
            
            const methods = methodsSummary.map(method => ({
                mode: method.mode,
                totalAmount: Number(method.totalAmount) || 0,
                count: Number(method.count) || 0
            }));
            
            return reply.send({
                status: 'success',
                data: methods
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch payment methods summary"
            });
        }
    });

    // Get recent payments
    fastify.get("/recent", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(payments.companyId, params.companyId));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const recentPayments = await db.select()
                .from(payments)
                .where(whereClause)
                .orderBy(desc(payments.date))
                .limit(params.limit);
            
            return reply.send({
                status: 'success',
                data: recentPayments
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch recent payments"
            });
        }
    });
}
