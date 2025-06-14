import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { db } from '../db/drizzle';
import { otps } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

// Email configuration (using Gmail SMTP - free tier)
const emailTransporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD, // App-specific password
    },
});

// Twilio configuration (free trial with $15 credit)
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

export class OTPService {
    private generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async sendEmailOTP(email: string): Promise<{ success: boolean; message: string }> {
        try {
            const otp = this.generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Save OTP to database
            await db.insert(otps).values({
                identifier: email,
                type: 'email',
                otp,
                expiresAt,
            });

            // Send email
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Vyapar - Email Verification OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563eb;">Vyapar Email Verification</h2>
                        <p>Your OTP for email verification is:</p>
                        <div style="background: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                            <h1 style="color: #1f2937; font-size: 32px; margin: 0;">${otp}</h1>
                        </div>
                        <p>This OTP will expire in 10 minutes.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                `,
            };

            await emailTransporter.sendMail(mailOptions);
            return { success: true, message: 'OTP sent successfully to email' };
        } catch (error) {
            console.error('Email OTP error:', error);
            return { success: false, message: 'Failed to send email OTP' };
        }
    }

    async sendSMSOTP(mobile: string): Promise<{ success: boolean; message: string }> {
        try {
            const otp = this.generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Save OTP to database
            await db.insert(otps).values({
                identifier: mobile,
                type: 'sms',
                otp,
                expiresAt,
            });

            // Send SMS using Twilio
            await twilioClient.messages.create({
                body: `Your Vyapar verification code is: ${otp}. Valid for 10 minutes.`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: mobile,
            });

            return { success: true, message: 'OTP sent successfully to mobile' };
        } catch (error) {
            console.error('SMS OTP error:', error);
            return { success: false, message: 'Failed to send SMS OTP' };
        }
    }

    async verifyOTP(identifier: string, otp: string, type: 'email' | 'sms'): Promise<{ success: boolean; message: string }> {
        try {
            const otpRecord = await db
                .select()
                .from(otps)
                .where(
                    and(
                        eq(otps.identifier, identifier),
                        eq(otps.type, type),
                        eq(otps.otp, otp),
                        eq(otps.verified, false),
                        gt(otps.expiresAt, new Date())
                    )
                )
                .limit(1);

            if (otpRecord.length === 0) {
                return { success: false, message: 'Invalid or expired OTP' };
            }

            // Mark OTP as verified
            await db
                .update(otps)
                .set({ verified: true })
                .where(eq(otps.id, otpRecord[0].id));

            return { success: true, message: 'OTP verified successfully' };
        } catch (error) {
            console.error('OTP verification error:', error);
            return { success: false, message: 'Failed to verify OTP' };
        }
    }

    async cleanupExpiredOTPs(): Promise<void> {
        try {
            await db.delete(otps).where(gt(new Date(), otps.expiresAt));
        } catch (error) {
            console.error('OTP cleanup error:', error);
        }
    }
}

export const otpService = new OTPService();