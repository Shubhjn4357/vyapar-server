import { db } from '../db/drizzle';
import { offlineSync, bills, customers, products, payments, SyncStatusEnum } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface SyncOperation {
    id: string;
    tableName: string;
    recordId: string;
    operation: 'create' | 'update' | 'delete';
    data: any;
    status: typeof SyncStatusEnum.enumValues[number];
    deviceId?: string;
    conflictData?: any;
}

export interface SyncResult {
    success: boolean;
    synced: number;
    failed: number;
    conflicts: number;
    errors: string[];
}

export class OfflineSyncService {
    async addSyncOperation(
        userId: number,
        companyId: string,
        tableName: string,
        recordId: string,
        operation: 'create' | 'update' | 'delete',
        data: any,
        deviceId?: string
    ): Promise<string> {
        try {
            const [syncRecord] = await db.insert(offlineSync).values({
                userId,
                companyId,
                tableName,
                recordId,
                operation,
                data,
                deviceId,
                status: 'pending',
            }).returning();

            return syncRecord.id;
        } catch (error) {
            console.error('Add sync operation error:', error);
            throw new Error('Failed to add sync operation');
        }
    }

    async getPendingSyncOperations(userId: number, companyId?: string): Promise<SyncOperation[]> {
        try {
            let filter;
            if (companyId) {
                filter = and(
                    eq(offlineSync.userId, userId),
                    eq(offlineSync.companyId, companyId),
                    eq(offlineSync.status, 'pending')
                );
            } else {
                filter = and(
                    eq(offlineSync.userId, userId),
                    eq(offlineSync.status, 'pending')
                );
            }

            const operations = await db
                .select()
                .from(offlineSync)
                .where(filter)
                .orderBy(offlineSync.createdAt);

            return operations.map(op => ({
                id: op.id,
                tableName: op.tableName,
                recordId: op.recordId,
                operation: op.operation as 'create' | 'update' | 'delete',
                data: op.data,
                status: op.status as 'pending' | 'synced' | 'failed' | 'conflict',
                deviceId: op.deviceId || undefined,
                conflictData: op.conflictData || undefined,
            }));
        } catch (error) {
            console.error('Get pending sync operations error:', error);
            return [];
        }
    }

    async syncOperations(userId: number, companyId: string): Promise<SyncResult> {
        const result: SyncResult = {
            success: true,
            synced: 0,
            failed: 0,
            conflicts: 0,
            errors: [],
        };

        try {
            const pendingOperations = await this.getPendingSyncOperations(userId, companyId);

            for (const operation of pendingOperations) {
                try {
                    const syncSuccess = await this.syncSingleOperation(operation);
                    
                    if (syncSuccess.success) {
                        await this.updateSyncStatus(operation.id, 'synced');
                        result.synced++;
                    } else if (syncSuccess.conflict) {
                        await this.updateSyncStatus(operation.id, 'conflict', syncSuccess.conflictData);
                        result.conflicts++;
                    } else {
                        await this.updateSyncStatus(operation.id, 'failed');
                        result.failed++;
                        result.errors.push(syncSuccess.error || 'Unknown error');
                    }
                } catch (error) {
                    await this.updateSyncStatus(operation.id, 'failed');
                    result.failed++;
                    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
                }
            }

            result.success = result.failed === 0;
        } catch (error) {
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Sync failed');
        }

        return result;
    }

    private async syncSingleOperation(operation: SyncOperation): Promise<{
        success: boolean;
        conflict?: boolean;
        conflictData?: any;
        error?: string;
    }> {
        try {
            switch (operation.tableName) {
                case 'bills':
                    return await this.syncBill(operation);
                case 'customers':
                    return await this.syncCustomer(operation);
                case 'products':
                    return await this.syncProduct(operation);
                case 'payments':
                    return await this.syncPayment(operation);
                default:
                    return { success: false, error: `Unsupported table: ${operation.tableName}` };
            }
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private async syncBill(operation: SyncOperation): Promise<{
        success: boolean;
        conflict?: boolean;
        conflictData?: any;
        error?: string;
    }> {
        try {
            switch (operation.operation) {
                case 'create':
                    await db.insert(bills).values(operation.data);
                    return { success: true };

                case 'update':
                    // Check for conflicts
                    const existingBill = await db
                        .select()
                        .from(bills)
                        .where(eq(bills.id, operation.recordId))
                        .limit(1);

                    if (existingBill.length === 0) {
                        return { success: false, error: 'Bill not found' };
                    }

                    // Simple conflict detection based on updatedAt
                    const serverUpdatedAt = new Date(existingBill[0].updatedAt || '');
                    const clientUpdatedAt = new Date(operation.data.updatedAt || '');

                    if (serverUpdatedAt > clientUpdatedAt) {
                        return {
                            success: false,
                            conflict: true,
                            conflictData: existingBill[0],
                        };
                    }

                    await db
                        .update(bills)
                        .set(operation.data)
                        .where(eq(bills.id, operation.recordId));
                    return { success: true };

                case 'delete':
                    await db.delete(bills).where(eq(bills.id, operation.recordId));
                    return { success: true };

                default:
                    return { success: false, error: 'Invalid operation' };
            }
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private async syncCustomer(operation: SyncOperation): Promise<{
        success: boolean;
        conflict?: boolean;
        conflictData?: any;
        error?: string;
    }> {
        try {
            switch (operation.operation) {
                case 'create':
                    await db.insert(customers).values(operation.data);
                    return { success: true };

                case 'update':
                    const existingCustomer = await db
                        .select()
                        .from(customers)
                        .where(eq(customers.id, operation.recordId))
                        .limit(1);

                    if (existingCustomer.length === 0) {
                        return { success: false, error: 'Customer not found' };
                    }

                    const serverUpdatedAt = new Date(existingCustomer[0].updatedAt || '');
                    const clientUpdatedAt = new Date(operation.data.updatedAt || '');

                    if (serverUpdatedAt > clientUpdatedAt) {
                        return {
                            success: false,
                            conflict: true,
                            conflictData: existingCustomer[0],
                        };
                    }

                    await db
                        .update(customers)
                        .set(operation.data)
                        .where(eq(customers.id, operation.recordId));
                    return { success: true };

                case 'delete':
                    await db.delete(customers).where(eq(customers.id, operation.recordId));
                    return { success: true };

                default:
                    return { success: false, error: 'Invalid operation' };
            }
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private async syncProduct(operation: SyncOperation): Promise<{
        success: boolean;
        conflict?: boolean;
        conflictData?: any;
        error?: string;
    }> {
        try {
            switch (operation.operation) {
                case 'create':
                    await db.insert(products).values(operation.data);
                    return { success: true };

                case 'update':
                    const existingProduct = await db
                        .select()
                        .from(products)
                        .where(eq(products.id, operation.recordId))
                        .limit(1);

                    if (existingProduct.length === 0) {
                        return { success: false, error: 'Product not found' };
                    }

                    const serverUpdatedAt = new Date(existingProduct[0].updatedAt || '');
                    const clientUpdatedAt = new Date(operation.data.updatedAt || '');

                    if (serverUpdatedAt > clientUpdatedAt) {
                        return {
                            success: false,
                            conflict: true,
                            conflictData: existingProduct[0],
                        };
                    }

                    await db
                        .update(products)
                        .set(operation.data)
                        .where(eq(products.id, operation.recordId));
                    return { success: true };

                case 'delete':
                    await db.delete(products).where(eq(products.id, operation.recordId));
                    return { success: true };

                default:
                    return { success: false, error: 'Invalid operation' };
            }
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private async syncPayment(operation: SyncOperation): Promise<{
        success: boolean;
        conflict?: boolean;
        conflictData?: any;
        error?: string;
    }> {
        try {
            switch (operation.operation) {
                case 'create':
                    await db.insert(payments).values(operation.data);
                    return { success: true };

                case 'update':
                    const existingPayment = await db
                        .select()
                        .from(payments)
                        .where(eq(payments.id, operation.recordId))
                        .limit(1);

                    if (existingPayment.length === 0) {
                        return { success: false, error: 'Payment not found' };
                    }

                    const serverUpdatedAt = new Date(existingPayment[0].updatedAt || '');
                    const clientUpdatedAt = new Date(operation.data.updatedAt || '');

                    if (serverUpdatedAt > clientUpdatedAt) {
                        return {
                            success: false,
                            conflict: true,
                            conflictData: existingPayment[0],
                        };
                    }

                    await db
                        .update(payments)
                        .set(operation.data)
                        .where(eq(payments.id, operation.recordId));
                    return { success: true };

                case 'delete':
                    await db.delete(payments).where(eq(payments.id, operation.recordId));
                    return { success: true };

                default:
                    return { success: false, error: 'Invalid operation' };
            }
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private async updateSyncStatus(
        syncId: string,
        status: 'synced' | 'failed' | 'conflict',
        conflictData?: any
    ): Promise<void> {
        try {
            const updateData: any = { status };
            if (status === 'synced') {
                updateData.syncedAt = new Date();
            }
            if (conflictData) {
                updateData.conflictData = conflictData;
            }

            await db
                .update(offlineSync)
                .set(updateData)
                .where(eq(offlineSync.id, syncId));
        } catch (error) {
            console.error('Update sync status error:', error);
        }
    }

    async resolveConflict(
        syncId: string,
        resolution: 'use_server' | 'use_client' | 'merge',
        mergedData?: any
    ): Promise<boolean> {
        try {
            const [syncRecord] = await db
                .select()
                .from(offlineSync)
                .where(eq(offlineSync.id, syncId))
                .limit(1);

            if (!syncRecord || syncRecord.status !== 'conflict') {
                return false;
            }

            switch (resolution) {
                case 'use_server':
                    await this.updateSyncStatus(syncId, 'synced');
                    break;

                case 'use_client':
                    // Retry the sync operation
                    const operation: SyncOperation = {
                        id: syncRecord.id,
                        tableName: syncRecord.tableName,
                        recordId: syncRecord.recordId,
                        operation: syncRecord.operation as any,
                        data: syncRecord.data,
                        status: 'pending',
                    };
                    
                    const result = await this.syncSingleOperation(operation);
                    if (result.success) {
                        await this.updateSyncStatus(syncId, 'synced');
                    } else {
                        await this.updateSyncStatus(syncId, 'failed');
                    }
                    break;

                case 'merge':
                    if (!mergedData) {
                        return false;
                    }
                    
                    // Update with merged data
                    const mergeOperation: SyncOperation = {
                        id: syncRecord.id,
                        tableName: syncRecord.tableName,
                        recordId: syncRecord.recordId,
                        operation: 'update',
                        data: mergedData,
                        status: 'pending',
                    };
                    
                    const mergeResult = await this.syncSingleOperation(mergeOperation);
                    if (mergeResult.success) {
                        await this.updateSyncStatus(syncId, 'synced');
                    } else {
                        await this.updateSyncStatus(syncId, 'failed');
                    }
                    break;
            }

            return true;
        } catch (error) {
            console.error('Resolve conflict error:', error);
            return false;
        }
    }

    async getSyncStatus(userId: number, companyId?: string): Promise<{
        pending: number;
        synced: number;
        failed: number;
        conflicts: number;
    }> {
        try {
            let filter;
            if (companyId) {
                filter = and(
                    eq(offlineSync.userId, userId),
                    eq(offlineSync.companyId, companyId)
                );
            } else {
                filter = eq(offlineSync.userId, userId);
            }

            const allOperations = await db
                .select()
                .from(offlineSync)
                .where(filter);

            const status = {
                pending: 0,
                synced: 0,
                failed: 0,
                conflicts: 0,
            };

            allOperations.forEach(op => {
                switch (op.status) {
                    case 'pending':
                        status.pending++;
                        break;
                    case 'synced':
                        status.synced++;
                        break;
                    case 'failed':
                        status.failed++;
                        break;
                    case 'conflict':
                        status.conflicts++;
                        break;
                }
            });

            return status;
        } catch (error) {
            console.error('Get sync status error:', error);
            return { pending: 0, synced: 0, failed: 0, conflicts: 0 };
        }
    }
}

export const offlineSyncService = new OfflineSyncService();