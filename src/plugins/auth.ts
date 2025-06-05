import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { AuthJwtPayload, verifyJwt } from "../utils/jwt";

const authPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const user = verifyJwt(request.headers.authorization?.replace("Bearer ", "") || "");
            request.user = user as AuthJwtPayload;
        } catch (err) {
            return reply.code(401).send({ error: "Unauthorized" });
        }
    });
};

export default fp(authPlugin);