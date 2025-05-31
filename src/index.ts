import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import dotenv from "dotenv";
dotenv.config();

import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import companyRoutes from "./routes/company";
import billRoutes from "./routes/bill";
import accountingRoutes from "./routes/accounting";
import gstRoutes from "./routes/gst";
import aiRoutes from "./routes/ai";
import paymentRoutes from "./routes/payment";
import billsRoutes from "./routes/bills";
import customersRoutes from "./routes/customers";
import paymentsRoutes from "./routes/payments";

const fastify = Fastify({ logger: true });

fastify.register(fastifyCors, { origin: "*" });
fastify.register(fastifyJwt, { secret: process.env.JWT_SECRET! });
fastify.register(authPlugin);

fastify.register(authRoutes, { prefix: "/api/auth" });
fastify.register(userRoutes, { prefix: "/api/user" });
fastify.register(companyRoutes, { prefix: "/api/company" });
fastify.register(billRoutes, { prefix: "/api/bill" });
fastify.register(accountingRoutes, { prefix: "/api/accounting" });
fastify.register(gstRoutes, { prefix: "/api/gst" });
fastify.register(aiRoutes, { prefix: "/api/ai" });
fastify.register(paymentRoutes, { prefix: "/api/payment" });
fastify.register(billsRoutes, { prefix: "/api/bills" });
fastify.register(customersRoutes, { prefix: "/api/customers" });
fastify.register(paymentsRoutes, { prefix: "/api/payments" });

fastify.listen({ port: 4000, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err;
    fastify.log.info(`Server running at ${address}`);
});