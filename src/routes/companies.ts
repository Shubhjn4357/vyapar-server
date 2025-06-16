import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { companies, insertCompanySchema, selectCompanySchema, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireSubscription, requireCompanyAccess } from "../plugins/roleGuard";

export default async function (fastify: FastifyInstance) {
    // Create company
    fastify.post("/add", { 
        preHandler: [fastify.authenticate, requireSubscription(['free', 'basic', 'premium'])] 
    }, async (req, reply) => {
        try {
            const createCompanySchema = z.object({
                name: z.string().min(1, "Company name is required"),
                gstin: z.string().min(15, "Valid GSTIN is required"),
                address: z.string().optional()
            });
            
            const data = createCompanySchema.parse(req.body);
            
            // Check subscription limits for company creation
            const userCompanies = await db.select()
                .from(companies)
                .where(eq(companies.userId, (req.user as any).id));
            
            const subscription = req.subscription!;
            let maxCompanies = 1; // free plan
            if (subscription.plan === 'basic') maxCompanies = 3;
            if (subscription.plan === 'premium') maxCompanies = 10;

            if (userCompanies.length >= maxCompanies) {
                return reply.code(403).send({
                    status: 'error',
                    message: `Your ${subscription.plan} plan allows maximum ${maxCompanies} companies. Please upgrade your subscription.`
                });
            }
            
            const companyData = {
                userId: (req.user as any).id,
                name: data.name,
                gstin: data.gstin,
                address: data.address,
                createdBy: (req.user as any).id,
                updatedBy: (req.user as any).id
            };
            
            const inserted = await db.insert(companies).values(companyData).returning().then(r => r[0]);
            return reply.code(201).send({ 
                status: 'success', 
                data: inserted,
                message: 'Company created successfully'
            });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to add company" 
            });
        }
    });

    // Get all companies
    fastify.get("/all", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const allCompanies = await db.select().from(companies);
            return reply.send({ 
                status: 'success', 
                data: allCompanies 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch companies" 
            });
        }
    });

    // Get current user's companies
    fastify.get("/my", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const companiesData = await db.select().from(companies).where(eq(companies.userId, (req.user as any).id));
            return reply.send({ 
                status: 'success', 
                data: companiesData 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch companies" 
            });
        }
    });

    // Get companies by users (admin only)
    fastify.get("/user/:userId", { preHandler: [fastify.authenticate, fastify.requireRole("admin")] }, async (req, reply) => {
        try {
            const { userId } = req.params as { userId: number };
            const user = await db.select().from(users).where(eq(users.id, userId)).then(r => r[0]);
            if (!user) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "User not found" 
                });
            }
            const companiesData = await db.select().from(companies).where(eq(companies.userId, userId));
            return reply.send({ 
                status: 'success', 
                data: companiesData 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch companies" 
            });
        }
    });
    // Get company by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const company = await db.select().from(companies).where(eq(companies.id, id)).then(r => r[0]);
            if (!company) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Company not found" 
                });
            }
            return reply.send({ 
                status: 'success', 
                data: company 
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to fetch company" 
            });
        }
    });

    // Update company
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const updateSchema = z.object({
                name: z.string().optional(),
                gstin: z.string().optional(),
                address: z.string().optional()
            });
            
            const data = updateSchema.parse(req.body);
            const updateData = {
                ...data,
                updatedBy: (req.user as any).id,
                updatedAt: new Date()
            };
            
            const updated = await db.update(companies).set(updateData).where(eq(companies.id, id)).returning().then(r => r[0]);
            if (!updated) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "Company not found" 
                });
            }
            return reply.send({ 
                status: 'success', 
                data: updated,
                message: 'Company updated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: error.message || "Failed to update company" 
            });
        }
    });

    // Delete company
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            await db.delete(companies).where(eq(companies.id, id));
            return reply.send({ 
                status: 'success',
                message: 'Company deleted successfully'
            });
        } catch (error: any) {
            return reply.code(500).send({ 
                status: 'error', 
                message: error.message || "Failed to delete company" 
            });
        }
    });
}
