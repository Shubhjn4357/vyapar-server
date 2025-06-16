import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { SelectUsers, RoleType, SubscriptionStatusType, SubscriptionPlanType } from "../db/schema";
import { db } from '../db/drizzle';
import { users, companies } from '../db/schema';
import { eq, and } from 'drizzle-orm';

function isUserWithRole(user: unknown): user is SelectUsers {
    return typeof user === "object" && user !== null && "role" in user;
}

export function requireRole(allowedRoles: RoleType[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;
        
        if (!user) {
            return reply.code(401).send({ 
                status: 'error',
                message: 'Authentication required' 
            });
        }
        
        if (!allowedRoles.includes(user.role as RoleType)) {
            return reply.code(403).send({ 
                status: 'error',
                message: 'Insufficient permissions' 
            });
        }
    };
}

export function requireSubscription(requiredPlans: string[] = ['free', 'basic', 'premium','unlimited']) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;
        
        if (!user) {
            return reply.code(401).send({ 
                status: 'error',
                message: 'Authentication required' 
            });
        }

        // Get fresh user data with subscription
        const [userData] = await db.select().from(users).where(eq(users.id, user.id));
        
        if (!userData || !userData.subscription) {
            return reply.code(403).send({ 
                status: 'error',
                message: 'No active subscription found' 
            });
        }

        const subscription = userData.subscription as {
            plan: SubscriptionPlanType;
            status: SubscriptionStatusType;
            expiresAt: string;
            companiesLimit: number;
            features: string[];
        }

        // Check if subscription is active
        if (subscription.status !== 'active') {
            return reply.code(403).send({ 
                status: 'error',
                message: 'Subscription is not active' 
            });
        }

        // Check if subscription has expired
        if (new Date(subscription.expiresAt) < new Date()) {
            return reply.code(403).send({ 
                status: 'error',
                message: 'Subscription has expired' 
            });
        }

        // Check if plan is allowed
        if (!requiredPlans.includes(subscription.plan)) {
            return reply.code(403).send({ 
                status: 'error',
                message: `This feature requires ${requiredPlans.join(' or ')} subscription` 
            });
        }

        // Add subscription info to request
        request.subscription = subscription;
    };
}

export function requireCompanyAccess() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;
        const companyId = (request.params as any)?.companyId || (request.body as any)?.companyId;
        
        if (!user) {
            return reply.code(401).send({ 
                status: 'error',
                message: 'Authentication required' 
            });
        }

        if (!companyId) {
            return reply.code(400).send({ 
                status: 'error',
                message: 'Company ID is required' 
            });
        }

        // Check if user has access to this company
        const [company] = await db.select()
            .from(companies)
            .where(and(
                eq(companies.id, companyId),
                eq(companies.userId, user.id)
            ));

        if (!company) {
            return reply.code(403).send({ 
                status: 'error',
                message: 'Access denied to this company' 
            });
        }

        // Add company info to request
        request.company = company;
    };
}

export function requireAdminOrOwner() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user as any;
        const targetUserId = (request.params as any)?.userId || (request.body as any)?.userId;
        
        if (!user) {
            return reply.code(401).send({ 
                status: 'error',
                message: 'Authentication required' 
            });
        }

        // Allow if user is admin/super or accessing their own data
        if (user.role === 'ADMIN' || user.role === 'SUPER' || user.id === parseInt(targetUserId)) {
            return;
        }

        return reply.code(403).send({ 
            status: 'error',
            message: 'Access denied' 
        });
    };
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
