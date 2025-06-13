import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/drizzle";
import { users } from '../db/schema';
import { signJwt, verifyToken } from "../utils/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateOTP, verifyOTP } from "../utils/otp";
import { verifyFacebookToken } from "../utils/socialAuth";

export default async function (fastify: FastifyInstance) {
    fastify.post("/register", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                mobile: z.string().min(10),
                email: z.string().email().optional(),
                password: z.string().min(6),
                name: z.string().optional()
            });
            const data = schema.parse(req.body);

            const hash = await bcrypt.hash(data.password, 10);
            const subscription = {
                planId: "free",
                status: "active" as "active",
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            };
            const [user] = await db.insert(users).values({
                mobile: data.mobile,
                email: data.email,
                password: hash,
                name: data.name,
                role: "USER",
                subscription
            }).returning({mobile:users.mobile, id: users.id, role: users.role, name: users.name, email: users.email, subscription: users.subscription});
            if (!user) {
                return reply.code(400).send({ error: "User registration failed" });
            }
            const token = signJwt({ id: user.id, role: user.role });
            reply.send({ 
                status: 'success',
                data: { token, user },
                message: 'Registration successful'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({ 
                status: 'error',
                message: err.message || "Registration failed" 
            });
        }
    });

    fastify.post("/login", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const { mobile, password } = req.body as { mobile: string; password: string };
            const [user] = await db.select().from(users).where(eq(users.mobile, mobile));
            if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
                return reply.code(401).send({ error: "Invalid credentials" });
            }
            const token = signJwt({ id: user.id, role: user.role });
            reply.send({ 
                status: 'success',
                data: { token, user },
                message: 'Login successful'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({ 
                status: 'error',
                message: err.message || "Login failed" 
            });
        }
    });

    fastify.post("/reset-password", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                mobile: z.string().min(10),
                password: z.string().min(6),
                otp: z.string().length(6)
            });
            const { mobile, password, otp } = schema.parse(req.body);

            const isValid = await verifyOTP(mobile, otp);
            if (!isValid) {
                return reply.code(400).send({ error: "Invalid OTP" });
            }

            const hash = await bcrypt.hash(password, 10);
            const [user] = await db.update(users)
                .set({ password: hash })
                .where(eq(users.mobile, mobile))
                .returning({mobile:users.mobile, id: users.id, role: users.role, name: users.name, email: users.email, subscription: users.subscription});

            if (!user) {
                return reply.code(400).send({ error: "Password reset failed" });
            }
            const token = signJwt({ id: user.id, role: user.role });
            reply.send({ token, user });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({ error: err.message || "Reset password failed" });
        }
    });

    fastify.post("/google", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const { googleId, email, name, phone } = req.body as { googleId: string; email: string; name?: string, phone?: string };
            let [user] = await db.select().from(users).where(eq(users.googleId, googleId));
            if (!user) {
                const subscription = {
                    planId: "free",
                    status: "active" as "active",
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                };
                [user] = await db.insert(users).values({
                    mobile: phone ?? "",
                    name,
                    role: "USER",
                    subscription,
                    email,
                }).returning();
            }
            const token = signJwt({ id: user.id, role: user.role });
            reply.send({ token, user });
        } catch (err: any) 
        {
            fastify.log.error(err);
            reply.code(400).send({ error: err.message || "Google login failed" });
        }
    });

    fastify.post("/otp/request", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({ mobile: z.string().min(10) });
            const { mobile } = schema.parse(req.body);

            const otp = await generateOTP(mobile);
            reply.send({
                otpId: otp.id,
                expiresAt: otp.expiresAt
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({ error: err.message || "OTP request failed" });
        }
    });

    fastify.post("/otp/verify", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                mobile: z.string().min(10),
                otp: z.string().length(6)
            });
            const { mobile, otp } = schema.parse(req.body);

            const isValid = await verifyOTP(mobile, otp);
            if (!isValid) {
                return reply.code(400).send({ error: "Invalid OTP" });
            }

            let [user] = await db.select().from(users).where(eq(users.mobile, mobile));
            const isNewUser = !user;

            if (!user) {
                [user] = await db.insert(users).values({
                    mobile,
                    role: "USER",
                    subscription: {
                        planId: "free",
                        status: "active",
                        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                    },
                   
                }).returning();
            }

            const token = signJwt({ id: user.id, role: user.role });
            reply.send({ token, user, isNewUser });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({ error: err.message || "OTP verification failed" });
        }
    });

    fastify.post("/facebook", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({ accessToken: z.string() });
            const { accessToken } = schema.parse(req.body);

            const fbUser = await verifyFacebookToken(accessToken);

            let [user] = await db.select().from(users).where(eq(users.facebookId, fbUser.id));
            const isNewUser = !user;

            if (!user) {
                [user] = await db.insert(users).values({
                    mobile: fbUser.phone ?? "",
                    email: fbUser.email,
                    name: fbUser.name,
                    role: "USER",
                    subscription: {
                        planId: "free",
                        status: "active",
                        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
                    },
                }).returning();
            }

            const token = signJwt({ id: user.id, role: user.role });
            reply.send({ token, user, isNewUser, socialProfile: fbUser });
        } catch (err: any) {
            reply.code(400).send({ error: err.message || "Facebook login failed" });
        }
    });

    fastify.post("/refresh", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({ token: z.string() });
            const { token } = schema.parse(req.body);

            const decoded = verifyToken(token);
            if (
                !decoded ||
                typeof decoded.id === "undefined" ||
                typeof decoded.role === "undefined"
            ) {
                return reply.code(401).send({ error: "Invalid token" });
            }

            const newToken = signJwt({ id: decoded.id, role: decoded.role });
            reply.send({
                token: newToken,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({ error: err.message || "Token refresh failed" });
        }
    });
}