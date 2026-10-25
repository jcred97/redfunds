import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export function createAuth(
  prisma: PrismaClient,
  config: { secret: string; baseURL: string }
) {
  if (config.secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }
  const url = new URL(config.baseURL);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "BETTER_AUTH_URL must be the application origin, without a path or credentials."
    );
  }

  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("BETTER_AUTH_URL must use HTTPS outside local development.");
  }

  return betterAuth({
    appName: "RedFunds",
    secret: config.secret,
    baseURL: url.origin,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      // Email delivery/verification and recovery are a separate milestone.
      requireEmailVerification: false,
    },
    account: {
      accountLinking: {
        disableImplicitLinking: true,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Check the database on every request so revoked sessions stop working.
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-real-ip"],
      },
    },
  });
}
