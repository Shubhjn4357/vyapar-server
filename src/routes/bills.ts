import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { bills, insertBillSchema, selectBillSchema, customers, payments } from '../db/schema';
import { eq, and, gte, lte, like, desc, asc, count, sum, sql } from "drizzle-orm";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Helper function to generate bill number
    const generateBillNumber = async (companyId: string): Promise<string> => {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const prefix = `INV-${year}${month}`;
        
        const lastBill = await db.select({ billNumber: bills.billNumber })
            .from(bills)
            .where(like(bills.billNumber, `${prefix}%`))
            .orderBy(desc(bills.billNumber))
            .limit(1);
        
        let sequence = 1;
        if (lastBill.length > 0) {
            const lastNumber = lastBill[0].billNumber.split('-').pop();
            sequence = parseInt(lastNumber || '0') + 1;
        }
        
        return `${prefix}-${String(sequence).padStart(4, '0')}`;
    };

    // Get all bills with filters and pagination
    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                page: z.string().optional().transform(val => val ? parseInt(val) : 1),
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                status: z.string().optional(),
                customerId: z.string().optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                search: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            const offset = (params.page - 1) * params.limit;
            
            let whereConditions = [];
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            if (params.status) whereConditions.push(eq(bills.status, params.status));
            if (params.customerId) whereConditions.push(eq(bills.customerId, params.customerId));
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            if (params.search) {
                whereConditions.push(
                    sql`(${bills.billNumber} ILIKE ${`%${params.search}%`} OR ${bills.customerName} ILIKE ${`%${params.search}%`})`
                );
            }
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const [billsResult, totalResult] = await Promise.all([
                db.select().from(bills)
                    .where(whereClause)
                    .orderBy(desc(bills.createdAt))
                    .limit(params.limit)
                    .offset(offset),
                db.select({ count: count() }).from(bills).where(whereClause)
            ]);
            
            const total = totalResult[0].count;
            const totalPages = Math.ceil(total / params.limit);
            
            return reply.send({
                status: 'success',
                data: {
                    bills: billsResult,
                    total,
                    page: params.page,
                    totalPages
                }
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch bills" 
            });
        }
    });

    // Create bill
    fastify.post("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const createBillSchema = z.object({
                customerId: z.string(),
                customerName: z.string(),
                customerGstin: z.string().optional(),
                customerAddress: z.string().optional(),
                customerPhone: z.string().optional(),
                customerEmail: z.string().optional(),
                date: z.string(),
                dueDate: z.string(),
                items: z.array(z.object({
                    name: z.string(),
                    description: z.string().optional(),
                    quantity: z.number(),
                    rate: z.number(),
                    unit: z.string().optional(),
                    taxRate: z.number(),
                    taxAmount: z.number(),
                    amount: z.number(),
                    hsnCode: z.string().optional(),
                    total: z.number()
                })),
                notes: z.string().optional(),
                terms: z.string().optional(),
                discount: z.number().optional(),
                discountType: z.enum(['percentage', 'amount']).optional(),
                companyId: z.string()
            });
            
            const data = createBillSchema.parse(req.body);
            const billNumber = await generateBillNumber(data.companyId);
            
            // Calculate amounts
            const amount = data.items.reduce((sum, item) => sum + item.amount, 0);
            const taxAmount = data.items.reduce((sum, item) => sum + item.taxAmount, 0);
            let totalAmount = amount + taxAmount;
            
            if (data.discount) {
                if (data.discountType === 'percentage') {
                    totalAmount -= (totalAmount * data.discount / 100);
                } else {
                    totalAmount -= data.discount;
                }
            }
            
            const billData = {
                billNumber,
                customerId: data.customerId,
                customerName: data.customerName,
                customerGstin: data.customerGstin,
                customerAddress: data.customerAddress,
                customerPhone: data.customerPhone,
                customerEmail: data.customerEmail,
                amount: amount.toString(),
                taxAmount: taxAmount.toString(),
                totalAmount: totalAmount.toString(),
                date: new Date(data.date),
                dueDate: new Date(data.dueDate),
                items: data.items,
                status: 'draft' as const,
                paymentStatus: 'pending' as const,
                notes: data.notes,
                terms: data.terms,
                companyId: data.companyId,
                discount: data.discount?.toString(),
                discountType: data.discountType,
                createdBy: (req.user as any).id,
                updatedBy: (req.user as any).id
            };
            
            const inserted = await db.insert(bills).values(billData).returning().then(r => r[0]);
            return reply.code(201).send({ 
                status: 'success', 
                data: inserted,
                message: 'Bill created successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to create bill" 
            });
        }
    });

    // Get bill by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const bill = await db.select().from(bills).where(eq(bills.id, id)).then(r => r[0]);
            if (!bill) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Bill not found" 
                });
            }
            return reply.send({ 
                status: 'success', 
                data: bill 
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch bill" 
            });
        }
    });

    // Update bill
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const updateData = { ...(req.body as any), updatedBy: (req.user as any).id, updatedAt: new Date() };
            const updated = await db.update(bills).set(updateData).where(eq(bills.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Bill not found" 
                });
            }
            return reply.send({ 
                status: 'success', 
                data: updated,
                message: 'Bill updated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to update bill" 
            });
        }
    });

    // Delete bill
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            await db.delete(bills).where(eq(bills.id, id));
            return reply.send({ 
                status: 'success',
                message: 'Bill deleted successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to delete bill" 
            });
        }
    });

    // Get bill summary
    fastify.get("/summary", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                customerId: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            if (params.customerId) whereConditions.push(eq(bills.customerId, params.customerId));
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const summary = await db.select({
                totalBills: count(),
                totalAmount: sum(bills.totalAmount),
                paidAmount: sum(sql`CASE WHEN ${bills.paymentStatus} = 'paid' THEN ${bills.totalAmount} ELSE 0 END`),
                pendingAmount: sum(sql`CASE WHEN ${bills.paymentStatus} = 'pending' THEN ${bills.totalAmount} ELSE 0 END`),
                overdueAmount: sum(sql`CASE WHEN ${bills.status} = 'overdue' THEN ${bills.totalAmount} ELSE 0 END`)
            }).from(bills).where(whereClause);
            
            const thisMonth = new Date();
            thisMonth.setDate(1);
            thisMonth.setHours(0, 0, 0, 0);
            
            const thisMonthConditions = [...(whereConditions || []), gte(bills.date, thisMonth)];
            const thisMonthSummary = await db.select({
                thisMonthBills: count(),
                thisMonthAmount: sum(bills.totalAmount)
            }).from(bills).where(and(...thisMonthConditions));
            
            const result = {
                totalBills: Number(summary[0].totalBills) || 0,
                totalAmount: Number(summary[0].totalAmount) || 0,
                paidAmount: Number(summary[0].paidAmount) || 0,
                pendingAmount: Number(summary[0].pendingAmount) || 0,
                overdueAmount: Number(summary[0].overdueAmount) || 0,
                thisMonthBills: Number(thisMonthSummary[0].thisMonthBills) || 0,
                thisMonthAmount: Number(thisMonthSummary[0].thisMonthAmount) || 0
            };
            
            return reply.send({ 
                status: 'success', 
                data: result 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch bill summary" 
            });
        }
    });

    // Mark bill as paid
    fastify.post("/:id/payment", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const paymentSchema = z.object({
                paymentMethod: z.string(),
                paymentDate: z.string(),
                amount: z.number(),
                notes: z.string().optional()
            });
            
            const paymentData = paymentSchema.parse(req.body);
            
            const updated = await db.update(bills)
                .set({
                    paymentStatus: 'paid',
                    paymentMethod: paymentData.paymentMethod,
                    status: 'paid',
                    updatedBy: (req.user as any).id,
                    updatedAt: new Date()
                })
                .where(eq(bills.id, id))
                .returning()
                .then(r => r[0]);
            
            if (!updated) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Bill not found" 
                });
            }
            
            return reply.send({ 
                status: 'success', 
                data: updated,
                message: 'Payment recorded successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to record payment" 
            });
        }
    });

    // Send bill to customer
    fastify.post("/:id/send", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const sendSchema = z.object({
                email: z.string().optional(),
                phone: z.string().optional(),
                method: z.enum(['email', 'sms', 'whatsapp']),
                message: z.string().optional()
            });
            
            const sendData = sendSchema.parse(req.body);
            
            // Update bill status to sent
            await db.update(bills)
                .set({ 
                    status: 'sent',
                    updatedBy: (req.user as any).id,
                    updatedAt: new Date()
                })
                .where(eq(bills.id, id));
            
            // Here you would implement actual sending logic (email, SMS, WhatsApp)
            // For now, just return success
            
            return reply.send({ 
                status: 'success',
                message: `Bill sent via ${sendData.method} successfully`
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to send bill" 
            });
        }
    });

    // Generate bill PDF
    fastify.get("/:id/pdf", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            
            // Here you would implement PDF generation logic
            // For now, return a placeholder URL
            
            return reply.send({ 
                status: 'success', 
                data: { 
                    pdfUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/api/bills/${id}/download-pdf`
                }
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to generate PDF" 
            });
        }
    });

    // Duplicate bill
    fastify.post("/:id/duplicate", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const originalBill = await db.select().from(bills).where(eq(bills.id, id)).then(r => r[0]);
            
            if (!originalBill) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Bill not found" 
                });
            }
            
            const newBillNumber = await generateBillNumber(originalBill.companyId);
            const duplicatedBill = {
                ...originalBill,
                id: undefined,
                billNumber: newBillNumber,
                status: 'draft',
                paymentStatus: 'pending',
                paymentMethod: null,
                createdBy: (req.user as any).id,
                updatedBy: (req.user as any).id,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const inserted = await db.insert(bills).values(duplicatedBill).returning().then(r => r[0]);
            
            return reply.send({ 
                status: 'success', 
                data: inserted,
                message: 'Bill duplicated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to duplicate bill" 
            });
        }
    });

    // Get recent bills
    fastify.get("/recent", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const recentBills = await db.select()
                .from(bills)
                .where(whereClause)
                .orderBy(desc(bills.createdAt))
                .limit(params.limit);
            
            return reply.send({ 
                status: 'success', 
                data: recentBills 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch recent bills" 
            });
        }
    });

    // Get overdue bills
    fastify.get("/overdue", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [
                eq(bills.paymentStatus, 'pending'),
                sql`${bills.dueDate} < NOW()`
            ];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            
            const overdueBills = await db.select()
                .from(bills)
                .where(and(...whereConditions))
                .orderBy(asc(bills.dueDate));
            
            return reply.send({ 
                status: 'success', 
                data: overdueBills 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch overdue bills" 
            });
        }
    });

    // Bulk update bills
    fastify.put("/bulk-update", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const bulkUpdateSchema = z.object({
                billIds: z.array(z.string()),
                updateData: z.object({
                    status: z.string().optional(),
                    paymentStatus: z.string().optional(),
                    paymentMethod: z.string().optional()
                })
            });
            
            const { billIds, updateData } = bulkUpdateSchema.parse(req.body);
            
            await db.update(bills)
                .set({
                    ...updateData,
                    updatedBy: (req.user as any).id,
                    updatedAt: new Date()
                })
                .where(sql`${bills.id} = ANY(${billIds})`);
            
            return reply.send({ 
                status: 'success',
                message: `${billIds.length} bills updated successfully`
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to bulk update bills" 
            });
        }
    });

    // Get bill analytics
    fastify.get("/analytics", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                groupBy: z.enum(['day', 'week', 'month', 'year']).optional().default('month'),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            // Get basic analytics
            const analytics = await db.select({
                totalBills: count(),
                totalAmount: sum(bills.totalAmount),
                averageAmount: sql`AVG(${bills.totalAmount})`
            }).from(bills).where(whereClause);
            
            // Get chart data (simplified for now)
            const chartData = await db.select({
                period: sql`DATE_TRUNC(${params.groupBy}, ${bills.date})`,
                amount: sum(bills.totalAmount),
                count: count()
            })
            .from(bills)
            .where(whereClause)
            .groupBy(sql`DATE_TRUNC(${params.groupBy}, ${bills.date})`)
            .orderBy(sql`DATE_TRUNC(${params.groupBy}, ${bills.date})`);
            
            const result = {
                totalBills: Number(analytics[0].totalBills) || 0,
                totalAmount: Number(analytics[0].totalAmount) || 0,
                averageAmount: Number(analytics[0].averageAmount) || 0,
                chartData: chartData.map(item => ({
                    period: item.period,
                    amount: Number(item.amount) || 0,
                    count: Number(item.count) || 0
                }))
            };
            
            return reply.send({ 
                status: 'success', 
                data: result 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch bill analytics" 
            });
        }
    });
}
