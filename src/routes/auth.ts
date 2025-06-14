import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/drizzle";
import { users } from '../db/schema';
import { signJwt, verifyToken } from "../utils/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { generateOTP, verifyOTP } from "../utils/otp";
import { verifyFacebookToken } from "../utils/socialAuth";
import { otpService } from "../services/otpService";
import { socialAuthService } from "../services/socialAuthService";

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

    // Guest login
    fastify.post("/guest", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                deviceId: z.string(),
                deviceInfo: z.object({
                    platform: z.string(),
                    version: z.string(),
                    model: z.string().optional(),
                }).optional()
            });
            const { deviceId, deviceInfo } = schema.parse(req.body);

            // Create guest user
            const [guestUser] = await db.insert(users).values({
                name: `Guest_${Date.now()}`,
                isGuest: true,
                role: "GUEST",
                authProvider: "email",
                deviceInfo,
                subscription: {
                    plan: "free",
                    status: "active",
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                    companiesLimit: 1,
                    features: ["offline_mode", "basic_billing"]
                }
            }).returning();

            const token = signJwt({ id: guestUser.id, role: guestUser.role });
            
            reply.send({
                status: 'success',
                data: { 
                    token, 
                    user: guestUser,
                    isGuest: true 
                },
                message: 'Guest login successful'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Guest login failed"
            });
        }
    });

    // Enhanced Google OAuth
    fastify.post("/google/verify", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                idToken: z.string()
            });
            const { idToken } = schema.parse(req.body);

            const googleUser = await socialAuthService.verifyGoogleToken(idToken);
            if (!googleUser) {
                return reply.code(400).send({ error: "Invalid Google token" });
            }

            let [user] = await db.select().from(users).where(
                or(
                    eq(users.googleId, googleUser.id),
                    eq(users.email, googleUser.email)
                )
            );

            const isNewUser = !user;

            if (!user) {
                [user] = await db.insert(users).values({
                    name: googleUser.name,
                    email: googleUser.email,
                    googleId: googleUser.id,
                    authProvider: "google",
                    isEmailVerified: googleUser.email_verified,
                    isProfileComplete: true,
                    avatar: googleUser.picture,
                    role: "USER",
                    subscription: {
                        plan: "free",
                        status: "active",
                        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        companiesLimit: 1,
                        features: ["basic_billing", "cloud_sync"]
                    }
                }).returning();
            } else if (!user.googleId) {
                // Link existing account with Google
                [user] = await db.update(users)
                    .set({
                        googleId: googleUser.id,
                        isEmailVerified: true,
                        avatar: user.avatar || googleUser.picture
                    })
                    .where(eq(users.id, user.id))
                    .returning();
            }

            // Update last login
            await db.update(users)
                .set({ lastLoginAt: new Date() })
                .where(eq(users.id, user.id));

            const token = signJwt({ id: user.id, role: user.role });
            
            reply.send({
                status: 'success',
                data: { 
                    token, 
                    user,
                    isNewUser,
                    socialProfile: googleUser
                },
                message: 'Google authentication successful'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Google authentication failed"
            });
        }
    });

    // Enhanced Facebook OAuth
    fastify.post("/facebook/verify", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                accessToken: z.string()
            });
            const { accessToken } = schema.parse(req.body);

            const facebookUser = await socialAuthService.verifyFacebookToken(accessToken);
            if (!facebookUser) {
                return reply.code(400).send({ error: "Invalid Facebook token" });
            }

            let [user] = await db.select().from(users).where(
                or(
                    eq(users.facebookId, facebookUser.id),
                    eq(users.email, facebookUser.email || '')
                )
            );

            const isNewUser = !user;

            if (!user) {
                [user] = await db.insert(users).values({
                    name: facebookUser.name,
                    email: facebookUser.email,
                    facebookId: facebookUser.id,
                    authProvider: "facebook",
                    isEmailVerified: !!facebookUser.email,
                    isProfileComplete: true,
                    avatar: facebookUser.picture?.data?.url,
                    role: "USER",
                    subscription: {
                        plan: "free",
                        status: "active",
                        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        companiesLimit: 1,
                        features: ["basic_billing", "cloud_sync"]
                    }
                }).returning();
            } else if (!user.facebookId) {
                // Link existing account with Facebook
                [user] = await db.update(users)
                    .set({
                        facebookId: facebookUser.id,
                        avatar: user.avatar || facebookUser.picture?.data?.url
                    })
                    .where(eq(users.id, user.id))
                    .returning();
            }

            // Update last login
            await db.update(users)
                .set({ lastLoginAt: new Date() })
                .where(eq(users.id, user.id));

            const token = signJwt({ id: user.id, role: user.role });
            
            reply.send({
                status: 'success',
                data: { 
                    token, 
                    user,
                    isNewUser,
                    socialProfile: facebookUser
                },
                message: 'Facebook authentication successful'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Facebook authentication failed"
            });
        }
    });

    // Enhanced OTP endpoints
    fastify.post("/otp/send-email", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                email: z.string().email()
            });
            const { email } = schema.parse(req.body);

            const result = await otpService.sendEmailOTP(email);
            
            reply.send({
                status: result.success ? 'success' : 'error',
                message: result.message
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to send email OTP"
            });
        }
    });

    fastify.post("/otp/send-sms", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                mobile: z.string().min(10)
            });
            const { mobile } = schema.parse(req.body);

            const result = await otpService.sendSMSOTP(mobile);
            
            reply.send({
                status: result.success ? 'success' : 'error',
                message: result.message
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to send SMS OTP"
            });
        }
    });

    fastify.post("/otp/verify-email", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                email: z.string().email(),
                otp: z.string().length(6)
            });
            const { email, otp } = schema.parse(req.body);

            const result = await otpService.verifyOTP(email, otp, 'email');
            
            if (!result.success) {
                return reply.code(400).send({
                    status: 'error',
                    message: result.message
                });
            }

            // Update user email verification status
            let [user] = await db.select().from(users).where(eq(users.email, email));
            
            if (user) {
                await db.update(users)
                    .set({ isEmailVerified: true })
                    .where(eq(users.id, user.id));
            }

            reply.send({
                status: 'success',
                message: result.message
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Email OTP verification failed"
            });
        }
    });

    fastify.post("/otp/verify-mobile", async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                mobile: z.string().min(10),
                otp: z.string().length(6)
            });
            const { mobile, otp } = schema.parse(req.body);

            const result = await otpService.verifyOTP(mobile, otp, 'sms');
            
            if (!result.success) {
                return reply.code(400).send({
                    status: 'error',
                    message: result.message
                });
            }

            // Find or create user
            let [user] = await db.select().from(users).where(eq(users.mobile, mobile));
            const isNewUser = !user;

            if (!user) {
                [user] = await db.insert(users).values({
                    mobile,
                    isMobileVerified: true,
                    role: "USER",
                    authProvider: "email",
                    subscription: {
                        plan: "free",
                        status: "active",
                        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        companiesLimit: 1,
                        features: ["basic_billing"]
                    }
                }).returning();
            } else {
                await db.update(users)
                    .set({ 
                        isMobileVerified: true,
                        lastLoginAt: new Date()
                    })
                    .where(eq(users.id, user.id));
            }

            const token = signJwt({ id: user.id, role: user.role });
            
            reply.send({
                status: 'success',
                data: { 
                    token, 
                    user,
                    isNewUser
                },
                message: 'Mobile verification successful'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Mobile OTP verification failed"
            });
        }
    });

    // Convert guest to regular user
    fastify.post("/convert-guest", {
        preHandler: [fastify.authenticate]
    }, async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const schema = z.object({
                name: z.string().min(1),
                email: z.string().email().optional(),
                mobile: z.string().min(10).optional(),
                password: z.string().min(6).optional()
            });
            const data = schema.parse(req.body);
            const userId = (req as any).user.id;

            // Verify user is a guest
            const [user] = await db.select().from(users).where(eq(users.id, userId));
            if (!user || !user.isGuest) {
                return reply.code(400).send({
                    status: 'error',
                    message: 'User is not a guest'
                });
            }

            // Check if email/mobile already exists
            if (data.email) {
                const existingUser = await db.select().from(users).where(eq(users.email, data.email));
                if (existingUser.length > 0) {
                    return reply.code(400).send({
                        status: 'error',
                        message: 'Email already exists'
                    });
                }
            }

            if (data.mobile) {
                const existingUser = await db.select().from(users).where(eq(users.mobile, data.mobile));
                if (existingUser.length > 0) {
                    return reply.code(400).send({
                        status: 'error',
                        message: 'Mobile number already exists'
                    });
                }
            }

            // Update guest user to regular user
            const updateData: any = {
                name: data.name,
                email: data.email,
                mobile: data.mobile,
                isGuest: false,
                role: "USER",
                isProfileComplete: true,
                subscription: {
                    plan: "free",
                    status: "active",
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    companiesLimit: 1,
                    features: ["basic_billing", "cloud_sync"]
                }
            };

            if (data.password) {
                updateData.password = await bcrypt.hash(data.password, 10);
            }

            const [updatedUser] = await db.update(users)
                .set(updateData)
                .where(eq(users.id, userId))
                .returning();

            const token = signJwt({ id: updatedUser.id, role: updatedUser.role });
            
            reply.send({
                status: 'success',
                data: { 
                    token, 
                    user: updatedUser
                },
                message: 'Guest account converted successfully'
            });
        } catch (err: any) {
            fastify.log.error(err);
            reply.code(400).send({
                status: 'error',
                message: err.message || "Failed to convert guest account"
            });
        }
    });
}