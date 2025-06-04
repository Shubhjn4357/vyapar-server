import { OAuth2Client } from 'google-auth-library';
import fetch from 'node-fetch';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleProfile {
    id?: string;
    email?: string;
    name?: string;
    picture?: string;
}

export interface FacebookProfile {
    id: string;
    email?: string;
    name?: string;
    picture?: { data: { url: string } };
    phone?: string;
}

export async function verifyGoogleToken(token: string): Promise<GoogleProfile> {
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        return {
            id: payload?.sub,
            email: payload?.email,
            name: payload?.name,
            picture: payload?.picture
        };
    } catch (err) {
        throw new Error("Invalid Google token");
    }
}

export async function verifyFacebookToken(accessToken: string): Promise<FacebookProfile> {
    const response = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );
    if (!response.ok) throw new Error('Invalid Facebook token');
    return response.json() as Promise<FacebookProfile>;
}
