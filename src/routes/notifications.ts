import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { notificationService } from "../services/notificationService";
import { z } from "zod";
import { RoleEnum } from "../db/schema";

export default async function (fastify: FastifyInstance) {
    // Get user notifications
    fastify.get("/", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string().optional(),
                limit: z.string().transform(Number).optional(),
                offset: z.string().transform(Number).optional()
            });
            const { companyId, limit = 50, offset = 0 } = schema.parse(req.query);
            const userId = (req as any).user.id;

            const notifications = await notificationService.getUserNotifications(
                userId,
                companyId,
                limit,
                offset
            );

            reply.send({
                status: 'success',
                data: notifications,
                message: 'Notifications retrieved successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to get notifications"
            });
        }
    });

    // Get unread count
    fastify.get("/unread-count", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string().optional()
            });
            const { companyId } = schema.parse(req.query);
            const userId = (req as any).user.id;

            const count = await notificationService.getUnreadCount(userId, companyId);

            reply.send({
                status: 'success',
                data: { count },
                message: 'Unread count retrieved successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to get unread count"
            });
        }
    });

    // Mark notification as read
    fastify.patch("/:notificationId/read", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                notificationId: z.string()
            });
            const { notificationId } = schema.parse(req.params);
            const userId = (req as any).user.id;

            const success = await notificationService.markAsRead(notificationId, userId);
            
            if (!success) {
                return reply.code(404).send({
                    status: 'error',
                    message: 'Notification not found'
                });
            }

            reply.send({
                status: 'success',
                message: 'Notification marked as read'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to mark notification as read"
            });
        }
    });

    // Mark all notifications as read
    fastify.patch("/mark-all-read", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string().optional()
            });
            const { companyId } = schema.parse(req.body);
            const userId = (req as any).user.id;

            const success = await notificationService.markAllAsRead(userId, companyId);
            
            if (!success) {
                return reply.code(400).send({
                    status: 'error',
                    message: 'Failed to mark notifications as read'
                });
            }

            reply.send({
                status: 'success',
                message: 'All notifications marked as read'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to mark all notifications as read"
            });
        }
    });

    // Delete notification
    fastify.delete("/:notificationId", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                notificationId: z.string()
            });
            const { notificationId } = schema.parse(req.params);
            const userId = (req as any).user.id;

            const success = await notificationService.deleteNotification(notificationId, userId);
            
            if (!success) {
                return reply.code(404).send({
                    status: 'error',
                    message: 'Notification not found'
                });
            }

            reply.send({
                status: 'success',
                message: 'Notification deleted successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to delete notification"
            });
        }
    });

    // Send promotional notification (admin only)
    fastify.post("/promotional", {
        preHandler: [fastify.authenticate, fastify.requireRole("admin")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                userIds: z.array(z.number()),
                title: z.string(),
                message: z.string(),
                data: z.any().optional()
            });
            const { userIds, title, message, data } = schema.parse(req.body);

            await notificationService.sendPromotionalNotification(userIds, title, message, data);

            reply.send({
                status: 'success',
                message: 'Promotional notification sent successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to send promotional notification"
            });
        }
    });

    // Send system update notification (admin only)
    fastify.post("/system-update", {
        preHandler: [fastify.authenticate, fastify.requireRole("admin")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                title: z.string(),
                message: z.string(),
                isGlobal: z.boolean().default(true)
            });
            const { title, message, isGlobal } = schema.parse(req.body);

            await notificationService.sendSystemUpdate(title, message, isGlobal);

            reply.send({
                status: 'success',
                message: 'System update notification sent successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to send system update notification"
            });
        }
    });

    // Schedule notification
    fastify.post("/schedule", {
        preHandler: [fastify.authenticate, fastify.requireRole("admin")]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                userId: z.number(),
                companyId: z.string().optional(),
                type: z.enum(['bill_reminder', 'payment_received', 'subscription_expiry', 'system_update', 'promotional']),
                title: z.string(),
                message: z.string(),
                data: z.any().optional(),
                scheduledFor: z.string().transform(str => new Date(str))
            });
            const notificationData = schema.parse(req.body);

            const notificationId = await notificationService.scheduleNotification(
                notificationData,
                notificationData.scheduledFor
            );

            reply.send({
                status: 'success',
                data: { notificationId },
                message: 'Notification scheduled successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to schedule notification"
            });
        }
    });
}