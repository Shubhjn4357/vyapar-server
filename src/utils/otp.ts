import { desc, eq } from "drizzle-orm";
import { db } from "../db/drizzle";
import { otps } from "../db/schema";

export async function generateOTP(mobile: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const [otpRecord] = await db.insert(otps).values({
        mobile,
        otp,
        expiresAt
    }).returning();

    // In production, send OTP via SMS here
    console.log(`OTP for ${mobile}: ${otp}`);

    return {
        id: otpRecord.id,
        expiresAt: otpRecord.expiresAt
    };
}

export async function verifyOTP(mobile: string, otp: string): Promise<boolean> {
    const [otpRecord] = await db.select()
        .from(otps)
        .where(eq(otps.mobile, mobile))
        .orderBy(desc(otps.createdAt))
        .limit(1);

    if (!otpRecord) return false;
    if (new Date(otpRecord.expiresAt) < new Date()) return false;
    return otpRecord.otp === otp;
}
