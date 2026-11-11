import "server-only";

import { createAuth } from "./config";
import { prisma } from "../../../server/db/client";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;

if (!secret || !baseURL) {
  throw new Error(
    "Configure BETTER_AUTH_SECRET and BETTER_AUTH_URL before starting RedTally."
  );
}

export const auth = createAuth(prisma, { secret, baseURL });
