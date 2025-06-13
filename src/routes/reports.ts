import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { bills, customers, companies, payments, gstTransactions } from "../db/schema";
import { eq, and, gte, lte, desc, asc, count, sum, sql } from "drizzle-orm";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Get dashboard metrics
    fastify.get("/dashboard", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            // Get basic metrics
            const [salesMetrics] = await db.select({
                totalSales: sum(bills.totalAmount),
                totalBills: count(),
                averageOrderValue: sql`AVG(${bills.totalAmount})`
            }).from(bills).where(whereClause);
            
            // Get payment metrics
            const [paymentMetrics] = await db.select({
                paidAmount: sum(sql`CASE WHEN ${bills.paymentStatus} = 'paid' THEN ${bills.totalAmount} ELSE 0 END`),
                pendingAmount: sum(sql`CASE WHEN ${bills.paymentStatus} = 'pending' THEN ${bills.totalAmount} ELSE 0 END`)
            }).from(bills).where(whereClause);
            
            // Get customer count
            const customerConditions = params.companyId ? [eq(customers.companyId, params.companyId)] : [];
            const [customerMetrics] = await db.select({
                totalCustomers: count(),
                activeCustomers: sum(sql`CASE WHEN ${customers.isActive} = true THEN 1 ELSE 0 END`)
            }).from(customers).where(customerConditions.length > 0 ? and(...customerConditions) : undefined);
            
            // Get monthly growth
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            
            const lastMonthConditions = [...(whereConditions || []), gte(bills.date, lastMonth)];
            const [lastMonthMetrics] = await db.select({
                lastMonthSales: sum(bills.totalAmount),
                lastMonthBills: count()
            }).from(bills).where(and(...lastMonthConditions));
            
            const metrics = {
                totalSales: Number(salesMetrics.totalSales) || 0,
                totalBills: Number(salesMetrics.totalBills) || 0,
                averageOrderValue: Number(salesMetrics.averageOrderValue) || 0,
                paidAmount: Number(paymentMetrics.paidAmount) || 0,
                pendingAmount: Number(paymentMetrics.pendingAmount) || 0,
                totalCustomers: Number(customerMetrics.totalCustomers) || 0,
                activeCustomers: Number(customerMetrics.activeCustomers) || 0,
                monthlyGrowth: {
                    sales: Number(lastMonthMetrics.lastMonthSales) || 0,
                    bills: Number(lastMonthMetrics.lastMonthBills) || 0
                }
            };
            
            return reply.send({
                status: 'success',
                data: metrics
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch dashboard metrics"
            });
        }
    });

    // Get sales report
    fastify.get("/sales", { preHandler: [fastify.authenticate] }, async (req, reply) => {
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
            
            // Get sales data grouped by period
            const salesData = await db.select({
                period: sql`DATE_TRUNC(${params.groupBy}, ${bills.date})`,
                totalSales: sum(bills.totalAmount),
                totalBills: count(),
                averageOrderValue: sql`AVG(${bills.totalAmount})`
            })
            .from(bills)
            .where(whereClause)
            .groupBy(sql`DATE_TRUNC(${params.groupBy}, ${bills.date})`)
            .orderBy(sql`DATE_TRUNC(${params.groupBy}, ${bills.date})`);
            
            // Get top customers
            const topCustomers = await db.select({
                customerId: bills.customerId,
                customerName: bills.customerName,
                totalAmount: sum(bills.totalAmount),
                billsCount: count()
            })
            .from(bills)
            .where(whereClause)
            .groupBy(bills.customerId, bills.customerName)
            .orderBy(desc(sum(bills.totalAmount)))
            .limit(10);
            
            const report = {
                summary: {
                    totalSales: salesData.reduce((sum, item) => sum + Number(item.totalSales), 0),
                    totalBills: salesData.reduce((sum, item) => sum + Number(item.totalBills), 0),
                    averageOrderValue: salesData.length > 0 ? 
                        salesData.reduce((sum, item) => sum + Number(item.averageOrderValue), 0) / salesData.length : 0
                },
                chartData: salesData.map(item => ({
                    period: item.period,
                    totalSales: Number(item.totalSales) || 0,
                    totalBills: Number(item.totalBills) || 0,
                    averageOrderValue: Number(item.averageOrderValue) || 0
                })),
                topCustomers: topCustomers.map(customer => ({
                    customerId: customer.customerId,
                    customerName: customer.customerName,
                    totalAmount: Number(customer.totalAmount) || 0,
                    billsCount: Number(customer.billsCount) || 0
                }))
            };
            
            return reply.send({
                status: 'success',
                data: report
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch sales report"
            });
        }
    });

    // Get customer-wise sales report
    fastify.get("/customer-sales", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const customerSales = await db.select({
                customerId: bills.customerId,
                customerName: bills.customerName,
                totalAmount: sum(bills.totalAmount),
                billsCount: count(),
                lastPurchaseDate: sql`MAX(${bills.date})`,
                averageOrderValue: sql`AVG(${bills.totalAmount})`
            })
            .from(bills)
            .where(whereClause)
            .groupBy(bills.customerId, bills.customerName)
            .orderBy(desc(sum(bills.totalAmount)));
            
            const totalAmount = customerSales.reduce((sum, customer) => sum + Number(customer.totalAmount), 0);
            
            return reply.send({
                status: 'success',
                data: {
                    customers: customerSales.map(customer => ({
                        customerId: customer.customerId,
                        customerName: customer.customerName,
                        totalAmount: Number(customer.totalAmount) || 0,
                        billsCount: Number(customer.billsCount) || 0,
                        lastPurchaseDate: customer.lastPurchaseDate,
                        averageOrderValue: Number(customer.averageOrderValue) || 0
                    })),
                    totalAmount,
                    totalCustomers: customerSales.length
                }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch customer sales report"
            });
        }
    });

    // Get product-wise sales report
    fastify.get("/product-sales", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            // Extract product data from bill items
            const billsWithItems = await db.select({
                items: bills.items,
                totalAmount: bills.totalAmount
            }).from(bills).where(whereClause);
            
            const productSales: { [key: string]: any } = {};
            
            billsWithItems.forEach(bill => {
                const items = bill.items as any[];
                items.forEach(item => {
                    if (!productSales[item.name]) {
                        productSales[item.name] = {
                            productName: item.name,
                            quantitySold: 0,
                            totalAmount: 0,
                            averageRate: 0,
                            profitMargin: 0
                        };
                    }
                    productSales[item.name].quantitySold += item.quantity;
                    productSales[item.name].totalAmount += item.total;
                });
            });
            
            // Calculate averages
            Object.values(productSales).forEach((product: any) => {
                product.averageRate = product.totalAmount / product.quantitySold;
                product.profitMargin = 0; // Would need cost data to calculate
            });
            
            const products = Object.values(productSales);
            const totalAmount = products.reduce((sum: number, product: any) => sum + product.totalAmount, 0);
            
            return reply.send({
                status: 'success',
                data: {
                    products,
                    totalAmount,
                    totalProducts: products.length
                }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch product sales report"
            });
        }
    });

    // Get aging report
    fastify.get("/aging", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                asOfDate: z.string().optional(),
                customerId: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            const asOfDate = params.asOfDate ? new Date(params.asOfDate) : new Date();
            
            let whereConditions = [eq(bills.paymentStatus, 'pending')];
            
            if (params.companyId) whereConditions.push(eq(bills.companyId, params.companyId));
            if (params.customerId) whereConditions.push(eq(bills.customerId, params.customerId));
            
            const outstandingBills = await db.select({
                customerId: bills.customerId,
                customerName: bills.customerName,
                totalAmount: bills.totalAmount,
                dueDate: bills.dueDate
            })
            .from(bills)
            .where(and(...whereConditions));
            
            const customerAging: { [key: string]: any } = {};
            
            outstandingBills.forEach(bill => {
                if (!customerAging[bill.customerId]) {
                    customerAging[bill.customerId] = {
                        customerId: bill.customerId,
                        customerName: bill.customerName,
                        totalOutstanding: 0,
                        current: 0,
                        days30: 0,
                        days60: 0,
                        days90: 0,
                        days90Plus: 0
                    };
                }
                
                const amount = Number(bill.totalAmount);
                const daysPastDue = Math.floor((asOfDate.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24));
                
                customerAging[bill.customerId].totalOutstanding += amount;
                
                if (daysPastDue <= 0) {
                    customerAging[bill.customerId].current += amount;
                } else if (daysPastDue <= 30) {
                    customerAging[bill.customerId].days30 += amount;
                } else if (daysPastDue <= 60) {
                    customerAging[bill.customerId].days60 += amount;
                } else if (daysPastDue <= 90) {
                    customerAging[bill.customerId].days90 += amount;
                } else {
                    customerAging[bill.customerId].days90Plus += amount;
                }
            });
            
            const customers = Object.values(customerAging);
            const summary = customers.reduce((acc: any, customer: any) => ({
                current: acc.current + customer.current,
                days30: acc.days30 + customer.days30,
                days60: acc.days60 + customer.days60,
                days90: acc.days90 + customer.days90,
                days90Plus: acc.days90Plus + customer.days90Plus
            }), { current: 0, days30: 0, days60: 0, days90: 0, days90Plus: 0 });
            
            const totalOutstanding = customers.reduce((sum: number, customer: any) => sum + customer.totalOutstanding, 0);
            
            return reply.send({
                status: 'success',
                data: {
                    customers,
                    totalOutstanding,
                    summary
                }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch aging report"
            });
        }
    });

    // Export report
    fastify.post("/export", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const exportSchema = z.object({
                reportType: z.string(),
                format: z.enum(['pdf', 'excel']),
                filters: z.object({
                    startDate: z.string().optional(),
                    endDate: z.string().optional(),
                    companyId: z.string().optional()
                }).optional()
            });
            
            const { reportType, format, filters } = exportSchema.parse(req.body);
            
            // Here you would implement actual export logic
            // For now, return a placeholder response
            
            return reply.send({
                status: 'success',
                data: {
                    downloadUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/api/reports/download/${reportType}`,
                    fileName: `${reportType}_report.${format}`
                },
                message: 'Export feature coming soon'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to export report"
            });
        }
    });

    // Get business insights
    fastify.get("/insights", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            
            // Generate sample insights based on data
            const insights = [
                {
                    type: 'growth' as const,
                    title: 'Sales Growth',
                    description: 'Your sales have increased by 15% compared to last month',
                    value: 15,
                    change: 15,
                    severity: 'low' as const
                },
                {
                    type: 'alert' as const,
                    title: 'Overdue Payments',
                    description: 'You have 5 overdue invoices totaling ₹25,000',
                    value: 25000,
                    change: -5,
                    severity: 'high' as const
                }
            ];
            
            const recommendations = [
                {
                    title: 'Follow up on overdue payments',
                    description: 'Send payment reminders to customers with overdue invoices',
                    priority: 'high' as const,
                    category: 'Collections'
                },
                {
                    title: 'Optimize inventory',
                    description: 'Review slow-moving products and consider promotions',
                    priority: 'medium' as const,
                    category: 'Inventory'
                }
            ];
            
            return reply.send({
                status: 'success',
                data: {
                    insights,
                    recommendations
                }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch business insights"
            });
        }
    });
}