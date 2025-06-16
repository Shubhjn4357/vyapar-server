import "fastify";
import { RoleType, SelectCompanies, SubscriptionPlanType, SubscriptionStatusType } from "../db/schema";
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthJwtPayload } from "../utils/jwt";

declare module "fastify" {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireRole: (role: RoleType) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
    interface FastifyRequest {
        user?: AuthJwtPayload;
        company?: SelectCompanies;
        subscription?: {
            plan: SubscriptionPlanType;
            status: SubscriptionStatusType;
            expiresAt: string;
            companiesLimit: number;
            features: string[];
        }
    }
}
