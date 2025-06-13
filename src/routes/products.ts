import { FastifyInstance } from "fastify";
import { db } from "../db/drizzle";
import { eq, and, gte, lte, like, desc, asc, count, sum, sql } from "drizzle-orm";
import { z } from "zod";

// Mock products table structure - in real implementation, you'd have a products table
const mockProducts = [
    {
        id: "1",
        name: "Product 1",
        description: "Sample product description",
        sku: "SKU001",
        category: "Electronics",
        price: 1000,
        cost: 800,
        stock: 50,
        unit: "pcs",
        hsnCode: "8517",
        taxRate: 18,
        isActive: true,
        companyId: "company1",
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

export default async function (fastify: FastifyInstance) {
    // Get all products with pagination and filters
    fastify.get("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                page: z.string().optional().transform(val => val ? parseInt(val) : 1),
                limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
                search: z.string().optional(),
                category: z.string().optional(),
                isActive: z.string().optional().transform(val => val === 'true'),
                sortBy: z.enum(['name', 'price', 'stock', 'createdAt']).optional().default('name'),
                sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            
            // Mock implementation - filter and paginate mockProducts
            let filteredProducts = [...mockProducts];
            
            if (params.search) {
                filteredProducts = filteredProducts.filter(p => 
                    p.name.toLowerCase().includes(params.search!.toLowerCase()) ||
                    p.sku.toLowerCase().includes(params.search!.toLowerCase())
                );
            }
            
            if (params.category) {
                filteredProducts = filteredProducts.filter(p => p.category === params.category);
            }
            
            if (params.isActive !== undefined) {
                filteredProducts = filteredProducts.filter(p => p.isActive === params.isActive);
            }
            
            if (params.companyId) {
                filteredProducts = filteredProducts.filter(p => p.companyId === params.companyId);
            }
            
            // Sort
            filteredProducts.sort((a, b) => {
                const aVal = a[params.sortBy as keyof typeof a];
                const bVal = b[params.sortBy as keyof typeof b];
                const order = params.sortOrder === 'desc' ? -1 : 1;
                return aVal > bVal ? order : aVal < bVal ? -order : 0;
            });
            
            // Paginate
            const total = filteredProducts.length;
            const totalPages = Math.ceil(total / params.limit);
            const offset = (params.page - 1) * params.limit;
            const products = filteredProducts.slice(offset, offset + params.limit);
            
            return reply.send({
                status: 'success',
                data: {
                    products,
                    total,
                    page: params.page,
                    totalPages
                }
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch products"
            });
        }
    });

    // Create product
    fastify.post("/", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const createProductSchema = z.object({
                name: z.string(),
                description: z.string().optional(),
                sku: z.string(),
                category: z.string(),
                price: z.number(),
                cost: z.number().optional(),
                stock: z.number().optional().default(0),
                unit: z.string().default('pcs'),
                hsnCode: z.string().optional(),
                taxRate: z.number().optional().default(18),
                companyId: z.string()
            });
            
            const data = createProductSchema.parse(req.body);
            
            // Mock implementation - in real app, insert into products table
            const newProduct = {
                id: Date.now().toString(),
                ...data,
                description: data.description || '',
                cost: data.cost || 0,
                hsnCode: data.hsnCode || '',
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            mockProducts.push(newProduct);
            
            return reply.code(201).send({
                status: 'success',
                data: newProduct,
                message: 'Product created successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to create product"
            });
        }
    });

    // Get product by id
    fastify.get("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const product = mockProducts.find(p => p.id === id);
            
            if (!product) {
                return reply.code(404).send({
                    status: 'error',
                    message: "Product not found"
                });
            }
            
            return reply.send({
                status: 'success',
                data: product
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch product"
            });
        }
    });

    // Update product
    fastify.put("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const updateSchema = z.object({
                name: z.string().optional(),
                description: z.string().optional(),
                sku: z.string().optional(),
                category: z.string().optional(),
                price: z.number().optional(),
                cost: z.number().optional(),
                stock: z.number().optional(),
                unit: z.string().optional(),
                hsnCode: z.string().optional(),
                taxRate: z.number().optional(),
                isActive: z.boolean().optional()
            });
            
            const updateData = updateSchema.parse(req.body);
            const productIndex = mockProducts.findIndex(p => p.id === id);
            
            if (productIndex === -1) {
                return reply.code(404).send({
                    status: 'error',
                    message: "Product not found"
                });
            }
            
            mockProducts[productIndex] = {
                ...mockProducts[productIndex],
                ...updateData,
                updatedAt: new Date()
            };
            
            return reply.send({
                status: 'success',
                data: mockProducts[productIndex],
                message: 'Product updated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to update product"
            });
        }
    });

    // Delete product
    fastify.delete("/:id", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const productIndex = mockProducts.findIndex(p => p.id === id);
            
            if (productIndex === -1) {
                return reply.code(404).send({
                    status: 'error',
                    message: "Product not found"
                });
            }
            
            mockProducts.splice(productIndex, 1);
            
            return reply.send({
                status: 'success',
                message: "Product deleted successfully"
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to delete product"
            });
        }
    });

    // Search products
    fastify.get("/search", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                q: z.string(),
                companyId: z.string().optional(),
                limit: z.string().optional().transform(val => val ? parseInt(val) : 20)
            });
            
            const params = querySchema.parse(req.query);
            
            let searchResults = mockProducts.filter(p => 
                p.name.toLowerCase().includes(params.q.toLowerCase()) ||
                p.sku.toLowerCase().includes(params.q.toLowerCase()) ||
                p.description?.toLowerCase().includes(params.q.toLowerCase())
            );
            
            if (params.companyId) {
                searchResults = searchResults.filter(p => p.companyId === params.companyId);
            }
            
            searchResults = searchResults.slice(0, params.limit);
            
            return reply.send({
                status: 'success',
                data: searchResults
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to search products"
            });
        }
    });

    // Get product categories
    fastify.get("/categories", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            
            let products = [...mockProducts];
            if (params.companyId) {
                products = products.filter(p => p.companyId === params.companyId);
            }
            
            const categories = [...new Set(products.map(p => p.category))];
            
            return reply.send({
                status: 'success',
                data: categories
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch categories"
            });
        }
    });

    // Get low stock products
    fastify.get("/low-stock", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const querySchema = z.object({
                threshold: z.string().optional().transform(val => val ? parseInt(val) : 10),
                companyId: z.string().optional()
            });
            
            const params = querySchema.parse(req.query);
            
            let lowStockProducts = mockProducts.filter(p => p.stock <= params.threshold);
            
            if (params.companyId) {
                lowStockProducts = lowStockProducts.filter(p => p.companyId === params.companyId);
            }
            
            return reply.send({
                status: 'success',
                data: lowStockProducts
            });
        } catch (error: any) {
            return reply.code(500).send({
                status: 'error',
                message: error.message || "Failed to fetch low stock products"
            });
        }
    });

    // Update stock
    fastify.post("/:id/stock", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const { id } = req.params as { id: string };
            const stockSchema = z.object({
                quantity: z.number(),
                type: z.enum(['add', 'subtract', 'set']),
                reason: z.string().optional()
            });
            
            const { quantity, type, reason } = stockSchema.parse(req.body);
            const productIndex = mockProducts.findIndex(p => p.id === id);
            
            if (productIndex === -1) {
                return reply.code(404).send({
                    status: 'error',
                    message: "Product not found"
                });
            }
            
            const product = mockProducts[productIndex];
            let newStock = product.stock;
            
            switch (type) {
                case 'add':
                    newStock += quantity;
                    break;
                case 'subtract':
                    newStock -= quantity;
                    break;
                case 'set':
                    newStock = quantity;
                    break;
            }
            
            if (newStock < 0) {
                return reply.code(400).send({
                    status: 'error',
                    message: "Stock cannot be negative"
                });
            }
            
            mockProducts[productIndex].stock = newStock;
            mockProducts[productIndex].updatedAt = new Date();
            
            return reply.send({
                status: 'success',
                data: mockProducts[productIndex],
                message: 'Stock updated successfully'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to update stock"
            });
        }
    });

    // Bulk import products
    fastify.post("/bulk-import", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            // This would handle file upload and CSV/Excel parsing
            // For now, return a placeholder response
            
            return reply.send({
                status: 'success',
                data: {
                    imported: 0,
                    failed: 0,
                    errors: []
                },
                message: 'Bulk import feature coming soon'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to import products"
            });
        }
    });

    // Export products
    fastify.post("/export", { preHandler: [fastify.authenticate] }, async (req, reply) => {
        try {
            const exportSchema = z.object({
                format: z.enum(['csv', 'excel']),
                filters: z.object({
                    category: z.string().optional(),
                    isActive: z.boolean().optional(),
                    companyId: z.string().optional()
                }).optional()
            });
            
            const { format, filters } = exportSchema.parse(req.body);
            
            return reply.send({
                status: 'success',
                data: {
                    downloadUrl: `${process.env.BASE_URL || 'http://localhost:4000'}/api/products/download-export`,
                    fileName: `products_export.${format}`
                },
                message: 'Export feature coming soon'
            });
        } catch (error: any) {
            return reply.code(400).send({
                status: 'error',
                message: error.message || "Failed to export products"
            });
        }
    });
}