import "fastify";
import { RoleEnumType, SelectCompanies, SubscriptionStatusType } from "../db/schema";
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthJwtPayload } from "../utils/jwt";

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireRole: (role: RoleEnumType) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
    interface FastifyRequest {
        user?: AuthJwtPayload;
        company?: SelectCompanies;
        subscription?: {
            planId: string;
            status: SubscriptionStatusType;
            expiresAt: string;
        };
    }
}
