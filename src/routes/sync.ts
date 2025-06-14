import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { offlineSyncService } from "../services/offlineSyncService";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Add sync operation
    fastify.post("/operations", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string(),
                tableName: z.string(),
                recordId: z.string(),
                operation: z.enum(['create', 'update', 'delete']),
                data: z.any(),
                deviceId: z.string().optional()
            });
            
            const syncData = schema.parse(req.body);
            const userId = (req as any).user.id;

            const syncId = await offlineSyncService.addSyncOperation(
                userId,
                syncData.companyId,
                syncData.tableName,
                syncData.recordId,
                syncData.operation,
                syncData.data,
                syncData.deviceId
            );

            reply.send({
                status: 'success',
                data: { syncId },
                message: 'Sync operation added successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to add sync operation"
            });
        }
    });

    // Get pending sync operations
    fastify.get("/operations/pending", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string().optional()
            });
            const { companyId } = schema.parse(req.query);
            const userId = (req as any).user.id;

            const operations = await offlineSyncService.getPendingSyncOperations(userId, companyId);

            reply.send({
                status: 'success',
                data: operations,
                message: 'Pending sync operations retrieved successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to get pending sync operations"
            });
        }
    });

    // Sync all pending operations
    fastify.post("/sync", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string()
            });
            const { companyId } = schema.parse(req.body);
            const userId = (req as any).user.id;

            const result = await offlineSyncService.syncOperations(userId, companyId);

            reply.send({
                status: result.success ? 'success' : 'partial',
                data: result,
                message: result.success ? 'All operations synced successfully' : 'Some operations failed to sync'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Sync failed"
            });
        }
    });

    // Get sync status
    fastify.get("/status", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                companyId: z.string().optional()
            });
            const { companyId } = schema.parse(req.query);
            const userId = (req as any).user.id;

            const status = await offlineSyncService.getSyncStatus(userId, companyId);

            reply.send({
                status: 'success',
                data: status,
                message: 'Sync status retrieved successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to get sync status"
            });
        }
    });

    // Resolve conflict
    fastify.post("/conflicts/:syncId/resolve", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const paramsSchema = z.object({
                syncId: z.string()
            });
            const bodySchema = z.object({
                resolution: z.enum(['use_server', 'use_client', 'merge']),
                mergedData: z.any().optional()
            });
            
            const { syncId } = paramsSchema.parse(req.params);
            const { resolution, mergedData } = bodySchema.parse(req.body);

            const success = await offlineSyncService.resolveConflict(syncId, resolution, mergedData);
            
            if (!success) {
                return reply.code(404).send({
                    status: 'error',
                    message: 'Sync operation not found or not in conflict state'
                });
            }

            reply.send({
                status: 'success',
                message: 'Conflict resolved successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to resolve conflict"
            });
        }
    });

    // Batch sync operations
    fastify.post("/batch", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                operations: z.array(z.object({
                    companyId: z.string(),
                    tableName: z.string(),
                    recordId: z.string(),
                    operation: z.enum(['create', 'update', 'delete']),
                    data: z.any(),
                    deviceId: z.string().optional()
                }))
            });
            
            const { operations } = schema.parse(req.body);
            const userId = (req as any).user.id;

            const results = [];
            for (const operation of operations) {
                try {
                    const syncId = await offlineSyncService.addSyncOperation(
                        userId,
                        operation.companyId,
                        operation.tableName,
                        operation.recordId,
                        operation.operation,
                        operation.data,
                        operation.deviceId
                    );
                    results.push({ success: true, syncId, operation: operation.recordId });
                } catch (error) {
                    results.push({ 
                        success: false, 
                        error: error instanceof Error ? error.message : 'Unknown error',
                        operation: operation.recordId 
                    });
                }
            }

            reply.send({
                status: 'success',
                data: results,
                message: 'Batch sync operations processed'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to process batch sync operations"
            });
        }
    });
}