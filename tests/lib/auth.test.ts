import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { createAuth } from "../../app/lib/auth-config";

test("Better Auth handles credentials, revocable sessions, origin checks, and shared rate limits", async (t) => {
  // All HTTP handlers and Prisma queries use an isolated PostgreSQL instance.
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
  let prisma: PrismaClient | undefined;

  try {
    const directory = path.join(process.cwd(), "server/db/migrations");

    for (const name of (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()) {
      await db.exec(
        await readFile(path.join(directory, name, "migration.sql"), "utf8"),
      );
    }

    await server.start();

    prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
        max: 1,
      }),
    });

    const client = prisma;
    const config = {
      secret: "test-only-secret-with-more-than-thirty-two-characters",
      baseURL: "http://localhost:3000",
    };
    const auth = createAuth(client, config);
    const password = "A test password 42!";
    const email = "alice@example.test";

    function request(
      endpoint: string,
      body?: object,
      cookie = "",
      ip = "192.0.2.10",
      origin = config.baseURL,
    ) {
      return new Request(`${config.baseURL}/api/auth/${endpoint}`, {
        method: body ? "POST" : "GET",
        headers: {
          "content-type": "application/json",
          origin,
          cookie,
          "x-real-ip": ip,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }

    let cookie = "";
    let userId = "";

    await t.test("signup persists a password hash and an authenticated session", async () => {
      const response = await auth.handler(
        request("sign-up/email", { email, password, name: "Alice" }),
      );
      assert.equal(response.status, 200);

      const result = await response.json();
      userId = result.user.id;
      assert.equal(result.user.email, email);

      cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      assert.match(cookie, /session_token=/);
      assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);

      const account = await client.account.findFirstOrThrow({ where: { userId } });
      assert.notEqual(account.password, password);
      assert.ok((account.password?.length ?? 0) > 40);

      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
      assert.equal(session?.user.id, userId);
      assert.equal(await auth.api.getSession({ headers: new Headers() }), null);
      assert.equal(
        await auth.api.getSession({
          headers: new Headers({ cookie: "better-auth.session_token=forged" }),
        }),
        null,
      );
    });

    await t.test("weak passwords, duplicate signup, wrong passwords, and hostile origins fail", async () => {
      assert.equal(
        (await auth.handler(request("sign-up/email", {
          email: "weak@example.test",
          password: "short",
          name: "Weak",
        }))).status,
        400,
      );
      assert.ok(
        (await auth.handler(request("sign-up/email", {
          email,
          password,
          name: "Duplicate",
        }))).status >= 400,
      );
      assert.equal(
        (await auth.handler(request("sign-in/email", {
          email,
          password: "Definitely wrong 42!",
        }))).status,
        401,
      );
      assert.equal(
        (await auth.handler(request(
          "sign-in/email",
          { email, password },
          "",
          "192.0.2.20",
          "https://attacker.example",
        ))).status,
        403,
      );
      assert.equal(await client.user.count(), 1);
    });

    await t.test("signout revokes the old cookie and signin creates a fresh session", async () => {
      assert.equal((await auth.handler(request("sign-out", {}, cookie))).status, 200);
      assert.equal(await auth.api.getSession({ headers: new Headers({ cookie }) }), null);
      assert.equal(await client.session.count({ where: { userId } }), 0);

      const response = await auth.handler(request("sign-in/email", { email, password }));
      assert.equal(response.status, 200);

      const newCookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      assert.notEqual(newCookie, cookie);
      assert.equal(
        (await auth.api.getSession({
          headers: new Headers({ cookie: newCookie }),
        }))?.user.id,
        userId,
      );
    });

    await t.test("database rate limits survive another application instance", async () => {
      const otherInstance = createAuth(client, config);

      for (let attempt = 0; attempt < 5; attempt++) {
        const instance = attempt % 2 ? otherInstance : auth;

        assert.equal(
          (await instance.handler(request(
            "sign-in/email",
            { email, password: "Incorrect password!" },
            "",
            "192.0.2.99",
          ))).status,
          401,
        );
      }

      const limited = await otherInstance.handler(
        request("sign-in/email", { email, password }, "", "192.0.2.99"),
      );
      assert.equal(limited.status, 429);
      assert.ok(await client.rateLimit.count() > 0);
    });
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
