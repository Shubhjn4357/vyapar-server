import { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/drizzle";
import { users, selectUserSchema } from '../db/schema';

export default async function (fastify: FastifyInstance) {
    // Get current user profile
    fastify.get("/me", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const userId = (req.user as { id: number }).id;
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        return user;
    });

    // Update current user profile
    fastify.put("/me", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        const userId = (req.user as { id: number }).id;
        const update = selectUserSchema.partial().parse(req.body);
        const [user] = await db.update(users).set(update).where(eq(users.id, userId)).returning();
        return user;
    });

    // List all users (admin only)
    fastify.get("/", { preHandler: [fastify.authenticate, fastify.requireRole("ADMIN")] }, async (_req: FastifyRequest) => {
        return db.select().from(users);
    });

    // Get user by id (ADMIN only)
    fastify.get("/:id", { preHandler: [fastify.authenticate, fastify.requireRole("ADMIN")] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        const [user] = await db.select().from(users).where(eq(users.id, Number(id)));
        return user;
    });

    // Delete user (ADMIN only)
    fastify.delete("/:id", { preHandler: [fastify.authenticate, fastify.requireRole("ADMIN")] }, async (req: FastifyRequest) => {
        const { id } = req.params as { id: string };
        await db.delete(users).where(eq(users.id, Number(id)));
        return { success: true };
    });
}