import "fastify";
import { SelectUsers } from "../db/schema";
import { FastifyReply } from 'fastify';

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireRole: (role: string) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
    interface FastifyRequest {
        user: SelectUsers;
    }
}
