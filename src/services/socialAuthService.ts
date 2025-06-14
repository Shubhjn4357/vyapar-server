import { OAuth2Client } from 'google-auth-library';
import fetch from 'node-fetch';

export interface GoogleUserInfo {
    id: string;
    email: string;
    name: string;
    picture?: string;
    email_verified: boolean;
}

export interface FacebookUserInfo {
    id: string;
    email: string;
    name: string;
    picture?: {
        data: {
            url: string;
        };
    };
}

export class SocialAuthService {
    private googleClient: OAuth2Client;

    constructor() {
        this.googleClient = new OAuth2Client(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
    }

    async verifyGoogleToken(token: string): Promise<GoogleUserInfo | null> {
        try {
            const ticket = await this.googleClient.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });

            const payload = ticket.getPayload();
            if (!payload) {
                return null;
            }

            return {
                id: payload.sub,
                email: payload.email || '',
                name: payload.name || '',
                picture: payload.picture,
                email_verified: payload.email_verified || false,
            };
        } catch (error) {
            console.error('Google token verification error:', error);
            return null;
        }
    }

    async verifyFacebookToken(accessToken: string): Promise<FacebookUserInfo | null> {
        try {
            // Verify token with Facebook
            const appTokenResponse = await fetch(
                `https://graph.facebook.com/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&grant_type=client_credentials`
            );
            const appTokenData = await appTokenResponse.json() as any;

            const verifyResponse = await fetch(
                `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appTokenData.access_token}`
            );
            const verifyData = await verifyResponse.json() as any;

            if (!verifyData.data.is_valid) {
                return null;
            }

            // Get user info
            const userResponse = await fetch(
                `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
            );
            const userData = await userResponse.json() as FacebookUserInfo;

            return userData;
        } catch (error) {
            console.error('Facebook token verification error:', error);
            return null;
        }
    }

    async getGoogleAuthUrl(redirectUri: string): Promise<string> {
        const authUrl = this.googleClient.generateAuthUrl({
            access_type: 'offline',
            scope: ['profile', 'email'],
            redirect_uri: redirectUri,
        });
        return authUrl;
    }

    async getFacebookAuthUrl(redirectUri: string): Promise<string> {
        const baseUrl = 'https://www.facebook.com/v18.0/dialog/oauth';
        const params = new URLSearchParams({
            client_id: process.env.FACEBOOK_APP_ID || '',
            redirect_uri: redirectUri,
            scope: 'email,public_profile',
            response_type: 'code',
        });
        return `${baseUrl}?${params.toString()}`;
    }

    async exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleUserInfo | null> {
        try {
            const { tokens } = await this.googleClient.getToken({
                code,
                redirect_uri: redirectUri,
            });

            if (!tokens.id_token) {
                return null;
            }

            return await this.verifyGoogleToken(tokens.id_token);
        } catch (error) {
            console.error('Google code exchange error:', error);
            return null;
        }
    }

    async exchangeFacebookCode(code: string, redirectUri: string): Promise<FacebookUserInfo | null> {
        try {
            // Exchange code for access token
            const tokenResponse = await fetch(
                `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&redirect_uri=${redirectUri}&code=${code}`
            );
            const tokenData = await tokenResponse.json() as any;

            if (!tokenData.access_token) {
                return null;
            }

            return await this.verifyFacebookToken(tokenData.access_token);
        } catch (error) {
            console.error('Facebook code exchange error:', error);
            return null;
        }
    }
}

export const socialAuthService = new SocialAuthService();