import { FastifyInstance, FastifyRequest } from "fastify";

export default async function (fastify: FastifyInstance) {
    // Get current user profile
    fastify.get("/", async (req: FastifyRequest, reply) => {
        try {
            return reply.code(200).send({ success: true, message: "Welcome to the Vyapar API!" });
        } catch (error) {
            return reply.code(500).send({ success: false, message: "Internal Server Error", error: (error as Error).message });
        }
    });
}