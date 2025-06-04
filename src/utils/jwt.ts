import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthJwtPayload extends JwtPayload {
    id: number;
    role: string;
}

export function signJwt(payload: AuthJwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): AuthJwtPayload {
    return jwt.verify(token, JWT_SECRET) as AuthJwtPayload;
}

export function verifyToken(token: string): AuthJwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as AuthJwtPayload;
    } catch {
        return null;
    }
}