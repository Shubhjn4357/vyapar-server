import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { SelectUsers } from "../db/schema";

function isUserWithRole(user: unknown): user is SelectUsers {
    return typeof user === "object" && user !== null && "role" in user;
}

const roleGuard: FastifyPluginAsync = async (fastify) => {
    fastify.decorate("requireRole", (role: string) => {
        return async (req: FastifyRequest, reply: FastifyReply) => {
            if (!isUserWithRole(req.user) || req.user.role !== role) {
                return reply.code(403).send({ error: "Forbidden" });
            }
        };
    });
};

export default fp(roleGuard);
