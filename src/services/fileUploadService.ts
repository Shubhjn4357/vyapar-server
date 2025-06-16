import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { db } from '../db/drizzle';
import { fileUploads } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface UploadResult {
    id: string;
    fileName: string;
    originalName: string;
    url: string;
    size: number;
    mimeType: string;
    isCompressed: boolean;
}

export class FileUploadService {
    private uploadDir = path.join(process.cwd(), 'uploads');
    private maxFileSize = 10 * 1024 * 1024; // 10MB
    private compressionThreshold = 0.5 * 1024 * 1024; // 0.5MB

    constructor() {
        this.ensureUploadDir();
    }

    private async ensureUploadDir(): Promise<void> {
        try {
            await fs.access(this.uploadDir);
        } catch {
            await fs.mkdir(this.uploadDir, { recursive: true });
        }
    }

    private generateFileName(originalName: string): string {
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${name}_${timestamp}_${random}${ext}`;
    }

    private isImageFile(mimeType: string): boolean {
        return mimeType.startsWith('image/');
    }

    private async compressImage(inputPath: string, outputPath: string, quality: number = 80): Promise<{ size: number; compressed: boolean }> {
        try {
            const metadata = await sharp(inputPath).metadata();
            
            let pipeline = sharp(inputPath);
            
            // Resize if too large
            if (metadata.width && metadata.width > 1920) {
                pipeline = pipeline.resize(1920, null, { withoutEnlargement: true });
            }
            
            // Compress based on format
            if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
                pipeline = pipeline.jpeg({ quality });
            } else if (metadata.format === 'png') {
                pipeline = pipeline.png({ quality });
            } else if (metadata.format === 'webp') {
                pipeline = pipeline.webp({ quality });
            } else {
                // Convert to JPEG for other formats
                pipeline = pipeline.jpeg({ quality });
            }
            
            await pipeline.toFile(outputPath);
            
            const stats = await fs.stat(outputPath);
            return { size: stats.size, compressed: true };
        } catch (error) {
            console.error('Image compression error:', error);
            // If compression fails, copy original file
            await fs.copyFile(inputPath, outputPath);
            const stats = await fs.stat(outputPath);
            return { size: stats.size, compressed: false };
        }
    }

    async uploadFile(
        fileBuffer: Buffer,
        originalName: string,
        mimeType: string,
        userId: number,
        companyId?: string,
        category?: string
    ): Promise<UploadResult> {
        try {
            if (fileBuffer.length > this.maxFileSize) {
                throw new Error('File size exceeds maximum limit');
            }

            const fileName = this.generateFileName(originalName);
            const tempPath = path.join(this.uploadDir, `temp_${fileName}`);
            const finalPath = path.join(this.uploadDir, fileName);

            // Write buffer to temp file
            await fs.writeFile(tempPath, fileBuffer);

            let finalSize = fileBuffer.length;
            let isCompressed = false;

            // Compress image if needed
            if (this.isImageFile(mimeType) && fileBuffer.length > this.compressionThreshold) {
                const result = await this.compressImage(tempPath, finalPath);
                finalSize = result.size;
                isCompressed = result.compressed;
                
                // Remove temp file
                await fs.unlink(tempPath);
            } else {
                // Move temp file to final location
                await fs.rename(tempPath, finalPath);
            }

            // Save to database
            const [uploadRecord] = await db.insert(fileUploads).values({
                userId,
                companyId,
                fileName,
                originalName,
                mimeType,
                size: finalSize,
                path: finalPath,
                url: `/uploads/${fileName}`,
                category,
                isCompressed,
                metadata: {
                    originalSize: fileBuffer.length,
                    compressionRatio: isCompressed ? (fileBuffer.length - finalSize) / fileBuffer.length : 0,
                },
            }).returning();

            return {
                id: uploadRecord.id,
                fileName: uploadRecord.fileName,
                originalName: uploadRecord.originalName,
                url: uploadRecord.url || '',
                size: uploadRecord.size,
                mimeType: uploadRecord.mimeType,
                isCompressed: uploadRecord.isCompressed as boolean,
            };
        } catch (error) {
            console.error('File upload error:', error);
            throw new Error('Failed to upload file');
        }
    }

    async deleteFile(fileId: string, userId: number): Promise<boolean> {
        try {
            const [fileRecord] = await db
                .select()
                .from(fileUploads)
                .where(eq(fileUploads.id, fileId))
                .limit(1);

            if (!fileRecord || fileRecord.userId !== userId) {
                return false;
            }

            // Delete physical file
            try {
                await fs.unlink(fileRecord.path);
            } catch (error) {
                console.error('Error deleting physical file:', error);
            }

            // Delete database record
            await db.delete(fileUploads).where(eq(fileUploads.id, fileId));

            return true;
        } catch (error) {
            console.error('Delete file error:', error);
            return false;
        }
    }

    async getFile(fileId: string): Promise<{ path: string; mimeType: string } | null> {
        try {
            const [fileRecord] = await db
                .select()
                .from(fileUploads)
                .where(eq(fileUploads.id, fileId))
                .limit(1);

            if (!fileRecord) {
                return null;
            }

            return {
                path: fileRecord.path,
                mimeType: fileRecord.mimeType,
            };
        } catch (error) {
            console.error('Get file error:', error);
            return null;
        }
    }

    async getUserFiles(userId: number, category?: string): Promise<UploadResult[]> {
        try {
            let files;
            if (category) {
                files = await db
                    .select()
                    .from(fileUploads)
                    .where(and(eq(fileUploads.userId, userId), eq(fileUploads.category, category)))
                    .orderBy(desc(fileUploads.createdAt));
            } else {
                files = await db
                    .select()
                    .from(fileUploads)
                    .where(eq(fileUploads.userId, userId))
                    .orderBy(desc(fileUploads.createdAt));
            }

            return files.map(file => ({
                id: file.id,
                fileName: file.fileName,
                originalName: file.originalName,
                url: file.url || '',
                size: file.size,
                mimeType: file.mimeType,
                isCompressed: !!file.isCompressed,
            }));
        } catch (error) {
            console.error('Get user files error:', error);
            return [];
        }
    }

    async updateFile(fileId: string, updates: Partial<{ category: string; metadata: any }>): Promise<boolean> {
        try {
            await db
                .update(fileUploads)
                .set(updates)
                .where(eq(fileUploads.id, fileId));

            return true;
        } catch (error) {
            console.error('Update file error:', error);
            return false;
        }
    }
}

export const fileUploadService = new FileUploadService();