import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/drizzle";
import { gstTransactions, insertGstTransactionSchema, selectGstTransactionSchema, bills } from "../db/schema";
import { eq, and, gte, lte, desc, count, sum, sql } from "drizzle-orm";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Get GST transactions with pagination and filters
    fastify.get("/transactions", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                page: z.string().optional().transform(val => val ? parseInt(val) : 1),
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                type: z.enum(['sale', 'purchase']).optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                partyGstin: z.string().optional(),
                search: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            const offset = (params.page - 1) * params.limit;
            
            let whereConditions = [];
            if (params.companyId) whereConditions.push(eq(gstTransactions.companyId, params.companyId));
            if (params.type) whereConditions.push(eq(gstTransactions.type, params.type));
            if (params.startDate) whereConditions.push(gte(gstTransactions.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(gstTransactions.date, new Date(params.endDate)));
            if (params.partyGstin) whereConditions.push(eq(gstTransactions.partyGstin, params.partyGstin));
            if (params.search) {
                whereConditions.push(
                    sql`(${gstTransactions.partyName} ILIKE ${`%${params.search}%`} OR ${gstTransactions.partyGstin} ILIKE ${`%${params.search}%`})`
                );
            }
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const [transactionsResult, totalResult] = await Promise.all([
                db.select().from(gstTransactions)
                    .where(whereClause)
                    .orderBy(desc(gstTransactions.date))
                    .limit(params.limit)
                    .offset(offset),
                db.select({ count: count() }).from(gstTransactions).where(whereClause)
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
                message: error.message || "Failed to fetch GST transactions"
            });
        }
    });

    // Get GST transaction by ID
    fastify.get("/transactions/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const transaction = await db.select().from(gstTransactions).where(eq(gstTransactions.id, id)).then(r => r[0]);
            if (!transaction) {
                return reply.code(404).send({
                    status: 'error',
                    message: "GST transaction not found"
                });
            }
            return reply.send({
                status: 'success',
                data: transaction
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch GST transaction"
            });
        }
    });

    // Create GST transaction
    fastify.post("/transactions", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const data = insertGstTransactionSchema.parse(req.body);
            const inserted = await db.insert(gstTransactions).values(data).returning().then(r => r[0]);
            return reply.code(201).send({
                status: 'success',
                data: inserted,
                message: 'GST transaction created successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to create GST transaction"
            });
        }
    });

    // Update GST transaction
    fastify.put("/transactions/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const data = selectGstTransactionSchema.partial().parse(req.body);
            const updated = await db.update(gstTransactions).set(data).where(eq(gstTransactions.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({
                    status: 'error',
                    message: "GST transaction not found"
                });
            }
            return reply.send({
                status: 'success',
                data: updated,
                message: 'GST transaction updated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to update GST transaction"
            });
        }
    });

    // Delete GST transaction
    fastify.delete("/transactions/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            await db.delete(gstTransactions).where(eq(gstTransactions.id, id));
            return reply.send({
                status: 'success',
                message: 'GST transaction deleted successfully'
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to delete GST transaction"
            });
        }
    });

    // Get GST summary
    fastify.get("/summary", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                period: z.string().optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(gstTransactions.companyId, params.companyId));
            if (params.startDate) whereConditions.push(gte(gstTransactions.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(gstTransactions.date, new Date(params.endDate)));
            
            const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
            
            const [summary] = await db.select({
                totalSales: sum(sql`CASE WHEN ${gstTransactions.type} = 'sale' THEN ${gstTransactions.total} ELSE 0 END`),
                totalPurchases: sum(sql`CASE WHEN ${gstTransactions.type} = 'purchase' THEN ${gstTransactions.total} ELSE 0 END`),
                totalTaxCollected: sum(sql`CASE WHEN ${gstTransactions.type} = 'sale' THEN ${gstTransactions.totalTax} ELSE 0 END`),
                totalTaxPaid: sum(sql`CASE WHEN ${gstTransactions.type} = 'purchase' THEN ${gstTransactions.totalTax} ELSE 0 END`),
                totalCGST: sum(gstTransactions.cgst),
                totalSGST: sum(gstTransactions.sgst),
                totalIGST: sum(gstTransactions.igst)
            }).from(gstTransactions).where(whereClause);
            
            const result = {
                totalSales: Number(summary.totalSales) || 0,
                totalPurchases: Number(summary.totalPurchases) || 0,
                totalTaxCollected: Number(summary.totalTaxCollected) || 0,
                totalTaxPaid: Number(summary.totalTaxPaid) || 0,
                netTaxLiability: (Number(summary.totalTaxCollected) || 0) - (Number(summary.totalTaxPaid) || 0),
                totalCGST: Number(summary.totalCGST) || 0,
                totalSGST: Number(summary.totalSGST) || 0,
                totalIGST: Number(summary.totalIGST) || 0
            };
            
            return reply.send({
                status: 'success',
                data: result
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch GST summary"
            });
        }
    });

    // Get GSTR-1 data
    fastify.get("/gstr1/:period", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { period } = req.params as { period: string };
            
            // Parse period (YYYY-MM format)
            const [year, month] = period.split('-');
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0);
            
            const salesData = await db.select()
                .from(gstTransactions)
                .where(and(
                    eq(gstTransactions.type, 'sale'),
                    gte(gstTransactions.date, startDate),
                    lte(gstTransactions.date, endDate)
                ));
            
            // Group data for GSTR-1 format
            const b2bData = salesData.filter(t => t.partyGstin);
            const b2cData = salesData.filter(t => !t.partyGstin);
            
            const gstr1Data = {
                period,
                gstin: "COMPANY_GSTIN", // Would come from company data
                b2b: b2bData,
                b2cl: b2cData.filter(t => Number(t.total) > 250000),
                b2cs: b2cData.filter(t => Number(t.total) <= 250000),
                summary: {
                    totalTaxableValue: salesData.reduce((sum, t) => sum + Number(t.taxableAmount), 0),
                    totalTax: salesData.reduce((sum, t) => sum + Number(t.totalTax), 0),
                    totalInvoices: salesData.length
                }
            };
            
            return reply.send({
                status: 'success',
                data: gstr1Data
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch GSTR-1 data"
            });
        }
    });

    // Get GSTR-3B data
    fastify.get("/gstr3b/:period", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { period } = req.params as { period: string };
            
            const [year, month] = period.split('-');
            const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            const endDate = new Date(parseInt(year), parseInt(month), 0);
            
            const [salesSummary] = await db.select({
                totalSales: sum(gstTransactions.total),
                totalTax: sum(gstTransactions.totalTax)
            }).from(gstTransactions)
            .where(and(
                eq(gstTransactions.type, 'sale'),
                gte(gstTransactions.date, startDate),
                lte(gstTransactions.date, endDate)
            ));
            
            const [purchaseSummary] = await db.select({
                totalPurchases: sum(gstTransactions.total),
                totalTax: sum(gstTransactions.totalTax)
            }).from(gstTransactions)
            .where(and(
                eq(gstTransactions.type, 'purchase'),
                gte(gstTransactions.date, startDate),
                lte(gstTransactions.date, endDate)
            ));
            
            const gstr3bData = {
                period,
                gstin: "COMPANY_GSTIN",
                outwardSupplies: {
                    totalTaxableValue: Number(salesSummary.totalSales) || 0,
                    totalTax: Number(salesSummary.totalTax) || 0
                },
                inwardSupplies: {
                    totalTaxableValue: Number(purchaseSummary.totalPurchases) || 0,
                    totalTax: Number(purchaseSummary.totalTax) || 0
                },
                netTaxLiability: (Number(salesSummary.totalTax) || 0) - (Number(purchaseSummary.totalTax) || 0)
            };
            
            return reply.send({
                status: 'success',
                data: gstr3bData
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch GSTR-3B data"
            });
        }
    });

    // Generate GSTR-1 JSON
    fastify.post("/gstr1/:period/generate", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { period } = req.params as { period: string };
            
            return reply.send({
                status: 'success',
                data: {
                    downloadUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/api/gst/download/gstr1-${period}.json`,
                    fileName: `GSTR1_${period}.json`
                },
                message: 'GSTR-1 JSON generation feature coming soon'
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to generate GSTR-1 JSON"
            });
        }
    });

    // Validate GSTIN
    fastify.post("/validate-gstin", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { gstin } = req.body as { gstin: string };
            
            // Basic GSTIN validation
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            const isValid = gstinRegex.test(gstin);
            
            // Mock response - in real implementation, you'd call GST API
            const validationResult = {
                isValid,
                businessName: isValid ? "Sample Business Name" : undefined,
                address: isValid ? "Sample Address" : undefined,
                status: isValid ? "Active" : "Invalid",
                registrationDate: isValid ? "2020-01-01" : undefined
            };
            
            return reply.send({
                status: 'success',
                data: validationResult
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to validate GSTIN"
            });
        }
    });

    // Get HSN summary
    fastify.get("/hsn-summary", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                startDate: z.string().optional(),
                endDate: z.string().optional(),
                type: z.enum(['sale', 'purchase']).optional(),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            let whereConditions = [];
            
            if (params.companyId) whereConditions.push(eq(gstTransactions.companyId, params.companyId));
            if (params.type) whereConditions.push(eq(gstTransactions.type, params.type));
            if (params.startDate) whereConditions.push(gte(gstTransactions.date, new Date(params.startDate)));
            if (params.endDate) whereConditions.push(lte(gstTransactions.date, new Date(params.endDate)));
            
            const transactions = await db.select()
                .from(gstTransactions)
                .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);
            
            // Group by HSN code from items
            const hsnSummary: { [key: string]: any } = {};
            
            transactions.forEach(transaction => {
                const items = transaction.items as any[] || [];
                items.forEach(item => {
                    const hsnCode = item.hsnCode || 'UNCLASSIFIED';
                    if (!hsnSummary[hsnCode]) {
                        hsnSummary[hsnCode] = {
                            hsnCode,
                            description: item.description || item.name,
                            quantity: 0,
                            taxableValue: 0,
                            cgstAmount: 0,
                            sgstAmount: 0,
                            igstAmount: 0,
                            totalTax: 0
                        };
                    }
                    
                    hsnSummary[hsnCode].quantity += item.quantity || 0;
                    hsnSummary[hsnCode].taxableValue += item.amount || 0;
                    hsnSummary[hsnCode].cgstAmount += Number(transaction.cgst) || 0;
                    hsnSummary[hsnCode].sgstAmount += Number(transaction.sgst) || 0;
                    hsnSummary[hsnCode].igstAmount += Number(transaction.igst) || 0;
                    hsnSummary[hsnCode].totalTax += Number(transaction.totalTax) || 0;
                });
            });
            
            const hsnData = Object.values(hsnSummary);
            const totalTaxableValue = hsnData.reduce((sum: number, hsn: any) => sum + hsn.taxableValue, 0);
            const totalTaxAmount = hsnData.reduce((sum: number, hsn: any) => sum + hsn.totalTax, 0);
            
            return reply.send({
                status: 'success',
                data: {
                    hsnData,
                    totalTaxableValue,
                    totalTaxAmount
                }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch HSN summary"
            });
        }
    });

    // Get e-Invoice status
    fastify.get("/e-invoice/:transactionId/status", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { transactionId } = req.params as { transactionId: string };
            
            // Mock e-invoice status
            const status = {
                status: 'generated' as const,
                irn: `IRN${transactionId}${Date.now()}`,
                ackNo: `ACK${Date.now()}`,
                ackDate: new Date().toISOString(),
                qrCode: `QR_CODE_DATA_${transactionId}`,
                signedInvoice: `SIGNED_INVOICE_DATA_${transactionId}`
            };
            
            return reply.send({
                status: 'success',
                data: status
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch e-Invoice status"
            });
        }
    });

    // Generate e-Invoice
    fastify.post("/e-invoice/:transactionId/generate", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { transactionId } = req.params as { transactionId: string };
            
            // Mock e-invoice generation
            const eInvoice = {
                irn: `IRN${transactionId}${Date.now()}`,
                ackNo: `ACK${Date.now()}`,
                ackDate: new Date().toISOString(),
                qrCode: `QR_CODE_DATA_${transactionId}`,
                signedInvoice: `SIGNED_INVOICE_DATA_${transactionId}`
            };
            
            return reply.send({
                status: 'success',
                data: eInvoice,
                message: 'e-Invoice generated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to generate e-Invoice"
            });
        }
    });

    // Get GST rates
    fastify.get("/rates", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { hsnCode } = req.query as { hsnCode?: string };
            
            // Mock GST rates data
            const rates = [
                {
                    hsnCode: "1001",
                    description: "Wheat",
                    cgstRate: 0,
                    sgstRate: 0,
                    igstRate: 0,
                    effectiveFrom: "2017-07-01"
                },
                {
                    hsnCode: "8517",
                    description: "Mobile phones",
                    cgstRate: 9,
                    sgstRate: 9,
                    igstRate: 18,
                    effectiveFrom: "2017-07-01"
                }
            ];
            
            const filteredRates = hsnCode ? 
                rates.filter(rate => rate.hsnCode === hsnCode) : 
                rates;
            
            return reply.send({
                status: 'success',
                data: { rates: filteredRates }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch GST rates"
            });
        }
    });

    // Bulk import GST transactions
    fastify.post("/bulk-import", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            // This would handle file upload and processing
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
                message: error.message || "Failed to import GST transactions"
            });
        }
    });
}