import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});

// Move this file outside of your 'src' directory, e.g. place it at the project root: 'e:\myApp\vyapar-server\drizzle.config.ts'
// If you are deploying, ensure your tsconfig.json has "rootDir": "./src" and this config file is not inside 'src'.
// No code changes needed, just move the file to the project root.
