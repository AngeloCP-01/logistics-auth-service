import request from "supertest";
import {
  resetTables,
  startPostgresWithMigrations,
  stopPostgres,
  type TestPostgres,
} from "@tests/integration/helpers/postgres-container.js";
import {
  startRedis,
  stopRedis,
  type TestRedis,
} from "@tests/integration/helpers/redis-container.js";
import {
  startRabbit,
  stopRabbit,
  type TestRabbit,
} from "@tests/integration/helpers/rabbitmq-container.js";
import {
  buildTestApp,
  type BuiltTestApp,
} from "@tests/integration/helpers/build-test-app.js";

let pg: TestPostgres;
let redis: TestRedis;
let rabbit: TestRabbit;
let built: BuiltTestApp;
const JWT_SECRET = "x".repeat(32);

beforeAll(async () => {
  pg = await startPostgresWithMigrations();
  redis = await startRedis();
  rabbit = await startRabbit();
  built = await buildTestApp({
    prisma: pg.prisma,
    redis: redis.client,
    rabbitUrl: rabbit.url,
    jwtSecret: JWT_SECRET,
  });
}, 180000);

afterAll(async () => {
  if (built) await built.cleanup();
  if (rabbit) await stopRabbit(rabbit);
  if (redis) await stopRedis(redis);
  if (pg) await stopPostgres(pg);
});

beforeEach(async () => {
  await resetTables(pg.prisma);
  await redis.client.flushall();
});

describe("HTTP auth flow", () => {
  it("register → login → /me → refresh → reuse-detection", async () => {
    const reg = await request(built.app).post("/auth/register").send({
      email: "alice@example.com",
      password: "supersecret",
      role: "customer",
    });
    expect(reg.status).toBe(201);
    const userId: string = reg.body.userId;

    const login = await request(built.app)
      .post("/auth/login")
      .send({ email: "alice@example.com", password: "supersecret" });
    expect(login.status).toBe(200);
    const { accessToken, refreshToken } = login.body as {
      accessToken: string;
      refreshToken: string;
    };

    const me = await request(built.app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      id: userId,
      email: "alice@example.com",
      role: "customer",
      emailVerified: false,
    });

    const refresh = await request(built.app)
      .post("/auth/refresh")
      .send({ refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.refreshToken).not.toBe(refreshToken);

    // Reuse: present the old refresh token after rotation.
    const reuse = await request(built.app)
      .post("/auth/refresh")
      .send({ refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.type).toMatch(/token_reused/);

    // And the new refresh (issued in the prior step) is now also revoked.
    const reuseNew = await request(built.app)
      .post("/auth/refresh")
      .send({ refreshToken: refresh.body.refreshToken });
    expect(reuseNew.status).toBe(401);
  });

  it("lockout after 5 bad passwords; cleared by admin unlock", async () => {
    // Seed an admin manually
    await request(built.app)
      .post("/auth/register")
      .send({
        email: "victim@example.com",
        password: "thispassword",
        role: "customer",
      })
      .expect(201);
    await request(built.app)
      .post("/auth/register")
      .send({
        email: "admin@example.com",
        password: "adminpassword",
        role: "customer",
      })
      .expect(201);

    // Hand-promote the second user to admin via DB.
    const admin = await pg.prisma.user.findUnique({
      where: { email: "admin@example.com" },
    });
    await pg.prisma.user.update({
      where: { id: admin!.id },
      data: { role: "admin" },
    });

    // Five bad logins → lockout.
    for (let i = 0; i < 5; i++) {
      await request(built.app)
        .post("/auth/login")
        .set("X-Forwarded-For", "10.0.0.1")
        .send({ email: "victim@example.com", password: "wrong" })
        .expect(401);
    }
    await request(built.app)
      .post("/auth/login")
      .set("X-Forwarded-For", "10.0.0.1")
      .send({ email: "victim@example.com", password: "thispassword" })
      .expect(423);

    // Admin logs in and unlocks.
    const adminLogin = await request(built.app)
      .post("/auth/login")
      .set("X-Forwarded-For", "10.0.0.2")
      .send({ email: "admin@example.com", password: "adminpassword" })
      .expect(200);
    const adminToken: string = adminLogin.body.accessToken;
    const victim = await pg.prisma.user.findUnique({
      where: { email: "victim@example.com" },
    });
    await request(built.app)
      .post(`/auth/users/${victim!.id}/unlock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Forwarded-For", "10.0.0.2")
      .expect(204);

    await request(built.app)
      .post("/auth/login")
      .set("X-Forwarded-For", "10.0.0.3")
      .send({ email: "victim@example.com", password: "thispassword" })
      .expect(200);
  });
});
