import "server-only";

import { createAuth } from "./auth-config";
import { prisma } from "./prisma";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret || !baseURL) {
  throw new Error(
    "Configure BETTER_AUTH_SECRET and BETTER_AUTH_URL before starting RedFunds."
  );
}

export const auth = createAuth(prisma, { secret, baseURL });
