import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import dotenv from "dotenv";
dotenv.config();

import authPlugin from "./plugins/auth";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import companyRoutes from "./routes/companies";
import billRoutes from "./routes/bills";
import gstRoutes from "./routes/gst";

import billsRoutes from "./routes/bills";
import customersRoutes from "./routes/customers";
import paymentRoutes from "./routes/payments";
const fastify = Fastify({ logger: true });

fastify.register(fastifyCors, { origin: "*" });
fastify.register(fastifyJwt, { secret: process.env.JWT_SECRET! });
fastify.register(authPlugin);

fastify.register(authRoutes, { prefix: "/api/auth" });
fastify.register(userRoutes, { prefix: "/api/user" });
fastify.register(companyRoutes, { prefix: "/api/company" });
fastify.register(billRoutes, { prefix: "/api/bills" });
fastify.register(gstRoutes, { prefix: "/api/gst" });
fastify.register(paymentRoutes, { prefix: "/api/payments" });
fastify.register(billsRoutes, { prefix: "/api/bills" });
fastify.register(customersRoutes, { prefix: "/api/customers" });

fastify.listen({ port: 4000, host: "0.0.0.0" }, (err, address) => {
    if (err) throw err;
    fastify.log.info(`Server running at ${address}`);
});