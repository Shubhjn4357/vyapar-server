import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { fileUploadService } from "../services/fileUploadService";
import { z } from "zod";

export default async function (fastify: FastifyInstance) {
    // Upload file
    fastify.post("/", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const data = await req.file();
            if (!data) {
                return reply.code(400).send({
                    status: 'error',
                    message: 'No file uploaded'
                });
            }

            const buffer = await data.toBuffer();
            const userId = (req as any).user.id;
            
            // Get additional fields from form data
            const companyId = data.fields.companyId as string | undefined;
            const category = data.fields.category as string | undefined;

            const result = await fileUploadService.uploadFile(
                buffer,
                data.filename,
                data.mimetype,
                userId,
                companyId,
                category
            );

            reply.send({
                status: 'success',
                data: result,
                message: 'File uploaded successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "File upload failed"
            });
        }
    });

    // Get user files
    fastify.get("/", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                category: z.string().optional()
            });
            const { category } = schema.parse(req.query);
            const userId = (req as any).user.id;

            const files = await fileUploadService.getUserFiles(userId, category);

            reply.send({
                status: 'success',
                data: files,
                message: 'Files retrieved successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to get files"
            });
        }
    });

    // Get specific file
    fastify.get("/:fileId", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                fileId: z.string()
            });
            const { fileId } = schema.parse(req.params);

            const file = await fileUploadService.getFile(fileId);
            if (!file) {
                return reply.code(404).send({
                    status: 'error',
                    message: 'File not found'
                });
            }

            const fs = require('fs');
            const stream = fs.createReadStream(file.path);
            
            reply.type(file.mimeType);
            return reply.send(stream);
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to get file"
            });
        }
    });

    // Delete file
    fastify.delete("/:fileId", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                fileId: z.string()
            });
            const { fileId } = schema.parse(req.params);
            const userId = (req as any).user.id;

            const success = await fileUploadService.deleteFile(fileId, userId);
            if (!success) {
                return reply.code(404).send({
                    status: 'error',
                    message: 'File not found or unauthorized'
                });
            }

            reply.send({
                status: 'success',
                message: 'File deleted successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to delete file"
            });
        }
    });

    // Update file metadata
    fastify.patch("/:fileId", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const paramsSchema = z.object({
                fileId: z.string()
            });
            const bodySchema = z.object({
                category: z.string().optional(),
                metadata: z.any().optional()
            });
            
            const { fileId } = paramsSchema.parse(req.params);
            const updates = bodySchema.parse(req.body);

            const success = await fileUploadService.updateFile(fileId, updates);
            if (!success) {
                return reply.code(404).send({
                    status: 'error',
                    message: 'File not found'
                });
            }

            reply.send({
                status: 'success',
                message: 'File updated successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to update file"
            });
        }
    });
}