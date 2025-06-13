import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/drizzle";
import { users, selectUserSchema } from '../db/schema';
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Get current user profile
    fastify.get("/me", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = (req.user as { id: number }).id;
            const [user] = await db.select().from(users).where(eq(users.id, userId));
            if (!user) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "User not found" 
                });
            }
            return reply.send({ 
                status: 'success', 
                data: user 
            });
        } catch (err) {
            return reply.code(500).send({ 
                status: 'error', 
                message: "Internal server error" 
            });
        }
    });

    // Update current user profile
    fastify.put("/me", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const userId = (req.user as { id: number }).id;
            const update = selectUserSchema.partial().parse(req.body);
            const [user] = await db.update(users).set(update).where(eq(users.id, userId)).returning();
            if (!user) {
                return reply.code(404).send({ success: false, message: "User not found" });
            }
            return { success: true, data: user };
        } catch (err: any) {
            return reply.code(400).send({ success: false, message: err.message || "Invalid data" });
        }
    });

    // Update profile and mark as complete
    fastify.put("/me/profile", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Handle token from query parameter for profile completion
            const { token } = req.query as { token?: string };
            let userId: number;
            
            if (token) {
                // Verify token from query parameter
                try {
                    const decoded = fastify.jwt.verify(token) as { id: number };
                    userId = decoded.id;
                } catch (error) {
                    return reply.code(401).send({ 
                        status: 'error', 
                        message: "Invalid token" 
                    });
                }
            } else {
                // Use authenticated user
                await fastify.authenticate(req, reply);
                userId = (req.user as { id: number }).id;
            }
            
            const updateSchema = z.object({
                name: z.string().optional(),
                email: z.string().email().optional()
            });
            
            const update = updateSchema.parse(req.body);
            const profileData = { 
                ...update, 
                isProfileComplete: true,
                updatedAt: new Date()
            };
            
            const [user] = await db.update(users).set(profileData).where(eq(users.id, userId)).returning();
            if (!user) {
                return reply.code(404).send({ 
                    status: 'error', 
                    message: "User not found" 
                });
            }
            
            return reply.send({ 
                status: 'success', 
                data: user,
                message: 'Profile updated successfully'
            });
        } catch (err: any) {
            return reply.code(400).send({ 
                status: 'error', 
                message: err.message || "Invalid data" 
            });
        }
    });

    // List all users (admin only)
    fastify.get("/", { preHandler: [fastify.authenticate, fastify.requireRole("ADMIN")] }, async (_req: FastifyRequest, reply: FastifyReply) => {
        try {
            const allUsers = await db.select().from(users);
            return { success: true, data: allUsers };
        } catch (err) {
            return reply.code(500).send({ success: false, message: "Internal server error" });
        }
    });

    // Get user by id (ADMIN only)
    fastify.get("/:id", { preHandler: [fastify.authenticate, fastify.requireRole("ADMIN")] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = req.params as { id: string };
            const [user] = await db.select().from(users).where(eq(users.id, Number(id)));
            if (!user) {
                return reply.code(404).send({ success: false, message: "User not found" });
            }
            return { success: true, data: user };
        } catch (err) {
            return reply.code(400).send({ success: false, message: "Invalid user id" });
        }
    });

    // Delete user (ADMIN only)
    fastify.delete("/:id", { preHandler: [fastify.authenticate, fastify.requireRole("ADMIN")] }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id } = req.params as { id: string };
            const result = await db.delete(users).where(eq(users.id, Number(id)));
            if (result.rowCount === 0) {
                return reply.code(404).send({ success: false, message: "User not found" });
            }
            return { success: true, message: "User deleted" };
        } catch (err) {
            return reply.code(400).send({ success: false, message: "Invalid user id" });
        }
    });
}