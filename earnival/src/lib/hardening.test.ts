import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { db } from "./db";
import { generateOrderGroupRef } from "./ids";
import { RATE_LIMITS, RateLimitError, consume, purgeExpiredCounters } from "./rate-limit";
import { issueLookupToken, lookupUrl, verifyLookupToken } from "./lookup";
import { MediaError, idFromUrl, storeImage } from "./media";
import { isSandbox } from "./paystack";

/**
 * Regression cover for the hardening pass. Each test here maps to a defect
 * that was live in the codebase, so a failure means a real vulnerability has
 * come back rather than a style preference being violated.
 */

beforeAll(() => {
  process.env.AUTH_SECRET ||= "test-auth-secret-that-is-long-enough-to-pass";
});

afterAll(async () => {
  await db.rateLimitCounter.deleteMany({ where: { key: { contains: "vitest" } } });
  await db.mediaAsset.deleteMany({ where: { ownerId: null, byteSize: { lt: 64 } } });
  await db.$disconnect();
});

describe("order references", () => {
  it("does not collide when thousands are minted in the same instant", () => {
    // The previous generator derived from Date.now() alone and produced two
    // distinct values for 200 same-millisecond orders — 198 failed checkouts.
    const seen = new Set<string>();
    for (let i = 0; i < 50_000; i += 1) seen.add(generateOrderGroupRef());
    expect(seen.size).toBe(50_000);
  });

  it("stays readable enough to give out over the phone", () => {
    const reference = generateOrderGroupRef();
    expect(reference).toMatch(/^EA-[A-Z0-9]{4}-[A-Z0-9]{6}$/);
    // No characters that are ambiguous when read aloud or written down.
    expect(reference.slice(3)).not.toMatch(/[OI]/);
  });
});

describe("rate limiting", () => {
  it("blocks once the bucket is empty and reports when to retry", async () => {
    const rule = { scope: "vitest-burst", limit: 3, windowSeconds: 60 };
    const who = `vitest-${Date.now()}`;

    await consume(rule, who);
    await consume(rule, who);
    await consume(rule, who);

    await expect(consume(rule, who)).rejects.toBeInstanceOf(RateLimitError);

    try {
      await consume(rule, who);
    } catch (error) {
      expect((error as RateLimitError).retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("counts each client separately", async () => {
    const rule = { scope: "vitest-isolation", limit: 1, windowSeconds: 60 };
    await consume(rule, "vitest-client-a");
    // A second client must not inherit the first one's exhausted bucket.
    await expect(consume(rule, "vitest-client-b")).resolves.toBeUndefined();
    await expect(consume(rule, "vitest-client-a")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("caps checkout tightly enough to stop inventory denial", () => {
    // The attack is holding every seat in 20-minute reservations for free, so
    // this limit needs to stay low even though it is a little conservative.
    expect(RATE_LIMITS.checkout.limit).toBeLessThanOrEqual(15);
    expect(RATE_LIMITS.lookup.limit).toBeLessThanOrEqual(10);
  });

  it("purges stale windows", async () => {
    await db.rateLimitCounter.create({
      data: {
        key: `vitest-old-${Date.now()}`,
        count: 1,
        windowStart: new Date(Date.now() - 48 * 60 * 60 * 1000),
      },
    });
    expect(await purgeExpiredCounters()).toBeGreaterThan(0);
  });
});

describe("ticket lookup links", () => {
  it("round-trips the address it was issued for", () => {
    const token = issueLookupToken("Zainab@Mail.com ");
    expect(verifyLookupToken(token)).toBe("zainab@mail.com");
  });

  it("rejects a tampered token", () => {
    const token = issueLookupToken("zainab@mail.com");
    expect(verifyLookupToken(`${token.slice(0, -3)}abc`)).toBeNull();
  });

  it("rejects a token whose payload was swapped for another address", () => {
    // Someone taking their own valid link and editing the email must not get
    // access to a stranger's tickets.
    const mine = issueLookupToken("me@mail.com");
    const [, expiresAt, signature] = mine.split(".");
    const forged = `${Buffer.from("victim@mail.com").toString("base64url")}.${expiresAt}.${signature}`;
    expect(verifyLookupToken(forged)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = issueLookupToken("zainab@mail.com");
    const [payload, , signature] = token.split(".");
    const expired = `${payload}.${Date.now() - 1000}.${signature}`;
    expect(verifyLookupToken(expired)).toBeNull();
  });

  it("builds an absolute URL", () => {
    expect(lookupUrl("abc")).toMatch(/\/find\/abc$/);
  });
});

describe("image uploads", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
  ]);

  it("accepts real images", async () => {
    const stored = await storeImage({ bytes: jpeg });
    expect(stored.url).toMatch(/^\/api\/media\//);
    await db.mediaAsset.delete({ where: { id: stored.id } });

    const stored2 = await storeImage({ bytes: png });
    expect(stored2.id).toBeTruthy();
    await db.mediaAsset.delete({ where: { id: stored2.id } });
  });

  it("rejects a payload that merely claims to be an image", async () => {
    // An SVG or HTML file stored and later served back is a stored-XSS vector,
    // so the format is sniffed from the bytes rather than trusted.
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(storeImage({ bytes: svg })).rejects.toBeInstanceOf(MediaError);

    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    await expect(storeImage({ bytes: html })).rejects.toBeInstanceOf(MediaError);
  });

  it("rejects empty and oversized files", async () => {
    await expect(storeImage({ bytes: new Uint8Array(0) })).rejects.toBeInstanceOf(
      MediaError,
    );

    const huge = new Uint8Array(4 * 1024 * 1024);
    huge.set(jpeg.slice(0, 12));
    await expect(storeImage({ bytes: huge })).rejects.toBeInstanceOf(MediaError);
  });

  it("extracts ids only from its own URL shape", () => {
    expect(idFromUrl("/api/media/abc123")).toBe("abc123");
    expect(idFromUrl("https://evil.example/x.png")).toBeNull();
    expect(idFromUrl(null)).toBeNull();
  });
});

describe("sandbox payment guard", () => {
  const original = { ...process.env };
  afterAll(() => {
    process.env.APP_URL = original.APP_URL;
    process.env.PAYSTACK_SECRET_KEY = original.PAYSTACK_SECRET_KEY;
    delete process.env.EARNIVAL_ALLOW_SANDBOX;
  });

  it("runs on localhost", () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.EARNIVAL_ALLOW_SANDBOX;
    process.env.APP_URL = "http://localhost:3000";
    expect(isSandbox()).toBe(true);
  });

  it("refuses on a real domain even when NODE_ENV is unset", () => {
    // This was the live hole: NODE_ENV is not set on every host, and the old
    // check would have opened free-ticket minting on a public deployment.
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.EARNIVAL_ALLOW_SANDBOX;
    process.env.APP_URL = "https://earnival.app";
    expect(isSandbox()).toBe(false);
  });

  it("never engages when real credentials exist", () => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_something";
    process.env.APP_URL = "http://localhost:3000";
    expect(isSandbox()).toBe(false);
  });

  it("allows a deliberate staging opt-in", () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    process.env.APP_URL = "https://staging.earnival.app";
    process.env.EARNIVAL_ALLOW_SANDBOX = "1";
    expect(isSandbox()).toBe(true);
  });
});
