import { db } from '../db/drizzle';
import { notifications, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface NotificationData {
    userId: number;
    companyId?: string;
    type: 'bill_reminder' | 'payment_received' | 'subscription_expiry' | 'system_update' | 'promotional';
    title: string;
    message: string;
    data?: any;
    isGlobal?: boolean;
    scheduledFor?: Date;
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: any;
    badge?: number;
    sound?: string;
    priority?: 'high' | 'normal';
}

export class NotificationService {
    async createNotification(notificationData: NotificationData): Promise<string> {
        try {
            const [notification] = await db.insert(notifications).values({
                userId: notificationData.userId,
                companyId: notificationData.companyId,
                type: notificationData.type,
                title: notificationData.title,
                message: notificationData.message,
                data: notificationData.data,
                isGlobal: notificationData.isGlobal || false,
                scheduledFor: notificationData.scheduledFor,
            }).returning();

            return notification.id;
        } catch (error) {
            console.error('Create notification error:', error);
            throw new Error('Failed to create notification');
        }
    }

    async getUserNotifications(
        userId: number,
        companyId?: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<any[]> {
        try {
            let query = db
                .select()
                .from(notifications)
                .where(eq(notifications.userId, userId));

            if (companyId) {
                query = query.where(
                    and(
                        eq(notifications.userId, userId),
                        eq(notifications.companyId, companyId)
                    )
                );
            }

            const userNotifications = await query
                .orderBy(desc(notifications.createdAt))
                .limit(limit)
                .offset(offset);

            return userNotifications;
        } catch (error) {
            console.error('Get user notifications error:', error);
            return [];
        }
    }

    async markAsRead(notificationId: string, userId: number): Promise<boolean> {
        try {
            const result = await db
                .update(notifications)
                .set({ isRead: true })
                .where(
                    and(
                        eq(notifications.id, notificationId),
                        eq(notifications.userId, userId)
                    )
                );

            return true;
        } catch (error) {
            console.error('Mark notification as read error:', error);
            return false;
        }
    }

    async markAllAsRead(userId: number, companyId?: string): Promise<boolean> {
        try {
            let query = db
                .update(notifications)
                .set({ isRead: true })
                .where(eq(notifications.userId, userId));

            if (companyId) {
                query = query.where(
                    and(
                        eq(notifications.userId, userId),
                        eq(notifications.companyId, companyId)
                    )
                );
            }

            await query;
            return true;
        } catch (error) {
            console.error('Mark all notifications as read error:', error);
            return false;
        }
    }

    async getUnreadCount(userId: number, companyId?: string): Promise<number> {
        try {
            let query = db
                .select()
                .from(notifications)
                .where(
                    and(
                        eq(notifications.userId, userId),
                        eq(notifications.isRead, false)
                    )
                );

            if (companyId) {
                query = query.where(
                    and(
                        eq(notifications.userId, userId),
                        eq(notifications.companyId, companyId),
                        eq(notifications.isRead, false)
                    )
                );
            }

            const unreadNotifications = await query;
            return unreadNotifications.length;
        } catch (error) {
            console.error('Get unread count error:', error);
            return 0;
        }
    }

    async deleteNotification(notificationId: string, userId: number): Promise<boolean> {
        try {
            await db
                .delete(notifications)
                .where(
                    and(
                        eq(notifications.id, notificationId),
                        eq(notifications.userId, userId)
                    )
                );

            return true;
        } catch (error) {
            console.error('Delete notification error:', error);
            return false;
        }
    }

    async sendBillReminder(billId: string, customerId: string, amount: string, dueDate: Date): Promise<void> {
        try {
            // This would integrate with your bill and customer data
            // For now, creating a basic notification
            await this.createNotification({
                userId: 1, // This should be the actual user ID
                type: 'bill_reminder',
                title: 'Bill Payment Reminder',
                message: `Bill payment of ₹${amount} is due on ${dueDate.toLocaleDateString()}`,
                data: {
                    billId,
                    customerId,
                    amount,
                    dueDate: dueDate.toISOString(),
                },
            });
        } catch (error) {
            console.error('Send bill reminder error:', error);
        }
    }

    async sendPaymentReceived(billId: string, amount: string, paymentMethod: string): Promise<void> {
        try {
            await this.createNotification({
                userId: 1, // This should be the actual user ID
                type: 'payment_received',
                title: 'Payment Received',
                message: `Payment of ₹${amount} received via ${paymentMethod}`,
                data: {
                    billId,
                    amount,
                    paymentMethod,
                },
            });
        } catch (error) {
            console.error('Send payment received notification error:', error);
        }
    }

    async sendSubscriptionExpiry(userId: number, expiryDate: Date): Promise<void> {
        try {
            await this.createNotification({
                userId,
                type: 'subscription_expiry',
                title: 'Subscription Expiring Soon',
                message: `Your subscription will expire on ${expiryDate.toLocaleDateString()}. Renew now to continue using all features.`,
                data: {
                    expiryDate: expiryDate.toISOString(),
                },
            });
        } catch (error) {
            console.error('Send subscription expiry notification error:', error);
        }
    }

    async sendSystemUpdate(title: string, message: string, isGlobal: boolean = true): Promise<void> {
        try {
            if (isGlobal) {
                // Send to all users
                const allUsers = await db.select().from(users);
                
                for (const user of allUsers) {
                    await this.createNotification({
                        userId: user.id,
                        type: 'system_update',
                        title,
                        message,
                        isGlobal: true,
                    });
                }
            }
        } catch (error) {
            console.error('Send system update notification error:', error);
        }
    }

    async sendPromotionalNotification(
        userIds: number[],
        title: string,
        message: string,
        data?: any
    ): Promise<void> {
        try {
            for (const userId of userIds) {
                await this.createNotification({
                    userId,
                    type: 'promotional',
                    title,
                    message,
                    data,
                });
            }
        } catch (error) {
            console.error('Send promotional notification error:', error);
        }
    }

    // This method would integrate with Expo push notifications for mobile
    async sendPushNotification(
        userId: number,
        payload: PushNotificationPayload
    ): Promise<boolean> {
        try {
            // In a real implementation, you would:
            // 1. Get the user's push token from the database
            // 2. Use Expo's push notification service to send the notification
            // 3. Handle delivery receipts and errors
            
            console.log(`Sending push notification to user ${userId}:`, payload);
            
            // For web, you would use the Web Push API
            // For mobile, you would use Expo's push notification service
            
            return true;
        } catch (error) {
            console.error('Send push notification error:', error);
            return false;
        }
    }

    async scheduleNotification(
        notificationData: NotificationData,
        scheduledFor: Date
    ): Promise<string> {
        try {
            return await this.createNotification({
                ...notificationData,
                scheduledFor,
            });
        } catch (error) {
            console.error('Schedule notification error:', error);
            throw new Error('Failed to schedule notification');
        }
    }

    async processScheduledNotifications(): Promise<void> {
        try {
            const now = new Date();
            const scheduledNotifications = await db
                .select()
                .from(notifications)
                .where(
                    and(
                        eq(notifications.isRead, false),
                        // Add condition for scheduled notifications that are due
                    )
                );

            for (const notification of scheduledNotifications) {
                if (notification.scheduledFor && notification.scheduledFor <= now) {
                    // Send the notification (push notification, email, etc.)
                    await this.sendPushNotification(notification.userId, {
                        title: notification.title,
                        body: notification.message,
                        data: notification.data,
                    });
                }
            }
        } catch (error) {
            console.error('Process scheduled notifications error:', error);
        }
    }
}

export const notificationService = new NotificationService();