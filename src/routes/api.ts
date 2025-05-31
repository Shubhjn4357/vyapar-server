import { FastifyInstance, FastifyRequest } from "fastify";

export default async function (fastify: FastifyInstance) {
    // Get current user profile
    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req: FastifyRequest) => {
        return { message: "Welcome to the Vyapar API!" };
    });
}