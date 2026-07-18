import { betterAuth } from "better-auth";
import { Pool } from "pg";

import {
  authorizeRegistration,
  completeRegistration
} from "@qusto/control-plane";
import { PostgresRegistrationRepository } from "@qusto/database/registration";
import type { RegistrationAuthorization } from "@qusto/control-plane";

function requiredDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url.length === 0) {
    throw new Error("DATABASE_URL is required for authentication");
  }
  return url;
}

const pendingRegistrations = new Map<string, RegistrationAuthorization>();

function createAuth() {
  const databaseUrl = requiredDatabaseUrl();
  const registrationRepository = new PostgresRegistrationRepository(
    databaseUrl
  );

  return betterAuth({
    account: {
      fields: {
        accessToken: "access_token",
        accessTokenExpiresAt: "access_token_expires_at",
        accountId: "account_id",
        createdAt: "created_at",
        idToken: "id_token",
        providerId: "provider_id",
        refreshToken: "refresh_token",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        updatedAt: "updated_at",
        userId: "user_id"
      },
      modelName: "accounts"
    },
    appName: "Qusto",
    database: new Pool({ connectionString: databaseUrl, max: 10 }),
    databaseHooks: {
      user: {
        create: {
          async after(user) {
            const email = user.email.toLowerCase();
            const authorization = pendingRegistrations.get(email);
            pendingRegistrations.delete(email);
            if (authorization === undefined) {
              throw new Error("Registration authorization expired");
            }
            await completeRegistration(
              authorization,
              { email: user.email, id: user.id },
              registrationRepository
            );
          },
          async before(user, context) {
            const email = user.email.toLowerCase();
            const invitationToken =
              context?.request?.headers.get("x-qusto-invitation") ?? undefined;
            try {
              const authorization = await authorizeRegistration(
                email,
                invitationToken,
                registrationRepository
              );
              pendingRegistrations.set(email, authorization);
            } catch {
              return false;
            }
          }
        }
      }
    },
    emailAndPassword: {
      enabled: true,
      maxPasswordLength: 128,
      minPasswordLength: 12
    },
    rateLimit: {
      enabled: true,
      max: 20,
      window: 60
    },
    session: {
      fields: {
        createdAt: "created_at",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        updatedAt: "updated_at",
        userAgent: "user_agent",
        userId: "user_id"
      },
      modelName: "sessions"
    },
    user: {
      fields: {
        createdAt: "created_at",
        emailVerified: "email_verified",
        updatedAt: "updated_at"
      },
      modelName: "users"
    },
    verification: {
      fields: {
        createdAt: "created_at",
        expiresAt: "expires_at",
        updatedAt: "updated_at"
      },
      modelName: "verifications"
    }
  });
}

let cachedAuth: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  cachedAuth ??= createAuth();
  return cachedAuth;
}
