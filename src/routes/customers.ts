import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { customers, insertCustomerSchema, selectCustomerSchema, bills, payments } from "../db/schema";
import { eq, and, gte, lte, like, desc, asc, count, sum, sql } from "drizzle-orm";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Get all customers with pagination and filters
    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                page: z.string().optional().transform(val => val ? parseInt(val) : 1),
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                search: z.string().optional(),
                isActive: z.string().optional().transform(val => val === 'true'),
                sortBy: z.enum(['name', 'totalAmount', 'lastTransactionDate']).optional().default('name'),
                sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            const offset = (params.page - 1) * params.limit;
            
            let whereConditions = [];
            if (params.companyId) whereConditions.push(eq(customers.companyId, params.companyId));
            if (params.isActive !== undefined) whereConditions.push(eq(customers.isActive, params.isActive));
            if (params.search) {
                whereConditions.push(
                    sql`(${customers.name} ILIKE ${`%${params.search}%`} OR ${customers.email} ILIKE ${`%${params.search}%`} OR ${customers.phone} ILIKE ${`%${params.search}%`})`
                );
            }
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            // Determine sort column
            let sortColumn: any = customers.name;
            if (params.sortBy === 'totalAmount') sortColumn = customers.totalAmount;
            if (params.sortBy === 'lastTransactionDate') sortColumn = customers.lastTransactionDate;
            
            const sortOrder = params.sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn);
            
            const [customersResult, totalResult] = await Promise.all([
                db.select().from(customers)
                    .where(whereClause)
                    .orderBy(sortOrder)
                    .limit(params.limit)
                    .offset(offset),
                db.select({ count: count() }).from(customers).where(whereClause)
            ]);
            
            const total = totalResult[0].count;
            const totalPages = Math.ceil(total / params.limit);
            
            return reply.send({
                status: 'success',
                data: {
                    customers: customersResult,
                    total,
                    page: params.page,
                    totalPages
                }
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch customers" 
            });
        }
    });

    // Create customer
    fastify.post("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const createCustomerSchema = z.object({
                name: z.string(),
                email: z.string().optional(),
                phone: z.string().optional(),
                gstin: z.string().optional(),
                address: z.object({
                    street: z.string(),
                    city: z.string(),
                    state: z.string(),
                    pincode: z.string(),
                    country: z.string()
                }).optional(),
                contactPerson: z.string().optional(),
                creditLimit: z.number().optional(),
                paymentTerms: z.number().optional(),
                companyId: z.string(),
                userId: z.number()
            });
            
            const data = createCustomerSchema.parse(req.body);
            const customerData = {
                ...data,
                creditLimit: data.creditLimit?.toString(),
                createdBy: (req.user as any).id,
                updatedBy: (req.user as any).id
            };
            
            const inserted = await db.insert(customers).values(customerData).returning().then(r => r[0]);
            return reply.code(201).send({ 
                status: 'success', 
                data: inserted,
                message: 'Customer created successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to create customer" 
            });
        }
    });

    // Get customer by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const customer = await db.select().from(customers).where(eq(customers.id, id)).then(r => r[0]);
            if (!customer) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Customer not found" 
                });
            }
            return reply.send({ 
                status: 'success', 
                data: customer 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch customer" 
            });
        }
    });

    // Update customer
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const updateData = { ...(req.body as any), updatedBy: (req.user as any).id, updatedAt: new Date() };
            const updated = await db.update(customers).set(updateData).where(eq(customers.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Customer not found" 
                });
            }
            return reply.send({ 
                status: 'success', 
                data: updated,
                message: 'Customer updated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to update customer" 
            });
        }
    });

    // Delete customer
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            await db.delete(customers).where(eq(customers.id, id));
            return reply.send({ 
                status: 'success',
                message: "Customer deleted successfully"
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to delete customer" 
            });
        }
    });

    // Get customer transactions
    fastify.get("/:id/transactions", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const querySchema = z.object({
                page: z.string().optional().transform(val => val ? parseInt(val) : 1),
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                startDate: z.string().optional(),
                endDate: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            const offset = (params.page - 1) * params.limit;
            
            let whereConditions = [eq(bills.customerId, id)];
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            
            const whereClause = and(...whereConditions);
            
            const [transactionsResult, totalResult] = await Promise.all([
                db.select({
                    id: bills.id,
                    type: sql`'bill'`,
                    date: bills.date,
                    amount: bills.totalAmount,
                    status: bills.status,
                    description: sql`CONCAT('Bill #', ${bills.billNumber})`
                }).from(bills)
                    .where(whereClause)
                    .orderBy(desc(bills.date))
                    .limit(params.limit)
                    .offset(offset),
                db.select({ count: count() }).from(bills).where(whereClause)
            ]);
            
            const total = totalResult[0].count;
            const totalPages = Math.ceil(total / params.limit);
            
            return reply.send({
                status: 'success',
                data: {
                    transactions: transactionsResult,
                    total,
                    page: params.page,
                    totalPages
                }
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch customer transactions" 
            });
        }
    });

    // Get customer statement
    fastify.get("/:id/statement", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            
            // Get customer details
            const customer = await db.select().from(customers).where(eq(customers.id, id)).then(r => r[0]);
            if (!customer) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Customer not found" 
                });
            }
            
            let whereConditions = [eq(bills.customerId, id)];
            if (params.startDate) whereConditions.push(gte(bills.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(bills.date, new Date(params.endDate)));
            
            const whereClause = and(...whereConditions);
            
            // Get transactions
            const transactions = await db.select({
                date: bills.date,
                description: sql`CONCAT('Bill #', ${bills.billNumber})`,
                debit: bills.totalAmount,
                credit: sql`0`,
                balance: bills.totalAmount
            }).from(bills)
                .where(whereClause)
                .orderBy(asc(bills.date));
            
            // Calculate running balance
            let runningBalance = 0;
            const processedTransactions = transactions.map(transaction => {
                runningBalance += Number(transaction.debit) - Number(transaction.credit);
                return {
                    ...transaction,
                    balance: runningBalance
                };
            });
            
            const totalDebit = transactions.reduce((sum, t) => sum + Number(t.debit), 0);
            const totalCredit = transactions.reduce((sum, t) => sum + Number(t.credit), 0);
            
            return reply.send({
                status: 'success',
                data: {
                    customer,
                    openingBalance: 0,
                    transactions: processedTransactions,
                    closingBalance: runningBalance,
                    totalDebit,
                    totalCredit
                }
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch customer statement" 
            });
        }
    });

    // Search customers
    fastify.get("/search", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                q: z.string(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            
            let whereConditions = [
                sql`(${customers.name} ILIKE ${`%${params.q}%`} OR ${customers.email} ILIKE ${`%${params.q}%`} OR ${customers.phone} ILIKE ${`%${params.q}%`})`
            ];
            
            if (params.companyId) whereConditions.push(eq(customers.companyId, params.companyId));
            
            const searchResults = await db.select()
                .from(customers)
                .where(and(...whereConditions))
                .limit(20);
            
            return reply.send({ 
                status: 'success', 
                data: searchResults 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to search customers" 
            });
        }
    });

    // Get top customers
    fastify.get("/top", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                sortBy: z.enum(['totalAmount', 'totalBills', 'lastTransactionDate']).optional().default('totalAmount'),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            
            let whereConditions = [];
            if (params.companyId) whereConditions.push(eq(customers.companyId, params.companyId));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            let sortColumn: any = customers.totalAmount;
            if (params.sortBy === 'totalBills') sortColumn = customers.totalBills;
            if (params.sortBy === 'lastTransactionDate') sortColumn = customers.lastTransactionDate;
            
            const topCustomers = await db.select()
                .from(customers)
                .where(whereClause)
                .orderBy(desc(sortColumn))
                .limit(params.limit);
            
            return reply.send({ 
                status: 'success', 
                data: topCustomers 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch top customers" 
            });
        }
    });

    // Bulk import customers
    fastify.post("/bulk-import", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            // This would handle file upload and CSV/Excel parsing
            // For now, return a placeholder response
            return reply.send({
                status: 'success',
                data: {
                    imported: 0,
                    failed: 0,
                    errors: []
                },
                message: 'Bulk import feature coming soon'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to import customers" 
            });
        }
    });

    // Export customers
    fastify.post("/export", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const exportSchema = z.object({
                format: z.enum(['csv', 'excel'])
            });
            
            const { format } = exportSchema.parse(req.body);
            
            // This would generate and return a download URL
            // For now, return a placeholder response
            return reply.send({
                status: 'success',
                data: {
                    downloadUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/api/customers/download-export`,
                    fileName: `customers_export.${format}`
                },
                message: 'Export feature coming soon'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to export customers" 
            });
        }
    });
}
