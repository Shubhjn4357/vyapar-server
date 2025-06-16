# Environment Variables & API Keys Needed

Below is a summary of all environment variables and API keys required by the server, based on a scan of the codebase:

---

## Required Environment Variables

| Variable Name           | Description / Usage                                      | Example Value / Notes                |
|------------------------ |---------------------------------------------------------|--------------------------------------|
| `DATABASE_URL`          | PostgreSQL connection string                            | `postgresql://user:pass@host:5432/db`|
| `JWT_SECRET`            | Secret for JWT signing                                  | `your-super-secret-jwt-key`          |
| `JWT_EXPIRES_IN`        | JWT token expiry duration (optional, default 7d)        | `7d`                                 |
| `GOOGLE_CLIENT_ID`      | Google OAuth client ID                                  |                                      |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth client secret                              |                                      |
| `FACEBOOK_APP_ID`       | Facebook OAuth app ID                                   |                                      |
| `FACEBOOK_APP_SECRET`   | Facebook OAuth app secret                               |                                      |
| `OPENAI_API_KEY`        | OpenAI API key for AI features                          |                                      |
| `SMS_API_KEY`           | SMS service API key (for OTP, optional)                 |                                      |
| `PORT`                  | Server port                                             | `3000` or `4000`                     |
| `HOST`                  | Server host                                             | `0.0.0.0`                            |
| `BASE_URL`              | Base URL for generating download links, etc.            | `http://localhost:4000`              |

---

## Where They Are Used

- **DATABASE_URL**: Used in `src/config/drizzle.config.ts` and database connection.
- **JWT_SECRET**: Used in `src/index.ts` and JWT utilities.
- **GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET**: Used for Google OAuth in authentication routes/services.
- **FACEBOOK_APP_ID / FACEBOOK_APP_SECRET**: Used for Facebook OAuth in authentication routes/services.
- **OPENAI_API_KEY**: Used in `src/services/aiService.ts` for AI/insights endpoints.
- **SMS_API_KEY**: Used in OTP service for sending SMS OTPs.
- **BASE_URL**: Used in routes for generating download URLs for exports, reports, etc.
- **PORT / HOST**: Used in `src/index.ts` for server startup.

---

## Optional/Advanced

- You may need additional keys for:
  - Email sending (SMTP, SendGrid, etc.) if you implement email notifications.
  - Cloud storage (AWS S3, GCP, etc.) if you move file uploads to the cloud.

---

## Example `.env` File

```env
DATABASE_URL=postgresql://username:password@localhost:5432/vyapar
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
OPENAI_API_KEY=your-openai-api-key
SMS_API_KEY=your-sms-service-api-key
BASE_URL=http://localhost:4000
PORT=4000
HOST=0.0.0.0
```

---
