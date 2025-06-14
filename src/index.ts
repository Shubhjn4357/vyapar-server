import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import companyRoutes from "./routes/companies";
import gstRoutes from "./routes/gst";
import defaultRoute from "./routes/api";
import billsRoutes from "./routes/bills";
import customersRoutes from "./routes/customers";
import paymentRoutes from "./routes/payments";
import reportsRoutes from "./routes/reports";
import productsRoutes from "./routes/products";
import uploadsRoutes from "./routes/uploads";
import syncRoutes from "./routes/sync";
import aiRoutes from "./routes/ai";
import notificationsRoutes from "./routes/notifications";
import fastifyCors from "@fastify/cors";
import dotenv from "dotenv";
import roleGuard from "./plugins/roleGuard";
import path from "path";
dotenv.config();
const fastify = Fastify({ logger: true });

fastify.register(fastifyCors, { origin: "*" });
fastify.register(fastifyJwt, { secret: process.env.JWT_SECRET! });
fastify.register(fastifyMultipart);
fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads/',
});
fastify.register(authPlugin);
fastify.register(roleGuard);
fastify.register(authRoutes, { prefix: "/api/auth" });
fastify.register(userRoutes, { prefix: "/api/user" });
fastify.register(companyRoutes, { prefix: "/api/company" });
fastify.register(gstRoutes, { prefix: "/api/gst" });
fastify.register(paymentRoutes, { prefix: "/api/payments" });
fastify.register(billsRoutes, { prefix: "/api/bills" });
fastify.register(customersRoutes, { prefix: "/api/customers" });
fastify.register(reportsRoutes, { prefix: "/api/reports" });
fastify.register(productsRoutes, { prefix: "/api/products" });
fastify.register(uploadsRoutes, { prefix: "/api/uploads" });
fastify.register(syncRoutes, { prefix: "/api/sync" });
fastify.register(aiRoutes, { prefix: "/api/ai" });
fastify.register(notificationsRoutes, { prefix: "/api/notifications" });
fastify.register(defaultRoute, { prefix: "/api" });
fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(error.statusCode || 500).send({
        statusCode: error.statusCode || 500,
        error: error.name,
        message: error.message,
    });
}
);
fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "The requested resource could not be found.",
    });
});

fastify.listen({ port: 4000, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err;
    fastify.log.info(`Server running at ${address}`);
});