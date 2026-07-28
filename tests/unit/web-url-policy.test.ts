import { describe, expect, it, vi } from "vitest";

import {
  registerWebSource,
  validateProviderWebSource,
  validateRegisteredWebSource,
} from "@/lib/ai/web/source-policy";
import {
  normalizeAndValidateUrl,
  resolveAndValidateUrl,
  type DnsResolver,
  UrlPolicyError,
} from "@/lib/ai/web/url-policy";

const publicResolver: DnsResolver = async () => [
  { address: "93.184.216.34", family: 4 },
  { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
];

describe("web URL policy", () => {
  it("canonicalizes equivalent public URLs and hashes the canonical form", () => {
    const first = normalizeAndValidateUrl(
      " HTTPS://Example.COM.:443/path?z=2&a=1#fragment ",
    );
    const second = normalizeAndValidateUrl(
      "https://example.com/path?a=1&z=2",
    );

    expect(first).toEqual(second);
    expect(first.url).toBe("https://example.com/path?a=1&z=2");
    expect(first.urlHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    "ftp://example.com/file",
    "https://user:secret@example.com/",
    "https://example.com:8443/",
    "http://localhost/",
    "http://api.localhost/",
    "http://service.local/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0177.0.0.1/",
    "http://0x7f000001/",
    "http://10.0.0.1/",
    "http://169.254.1.1/",
    "http://192.0.2.1/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[2001:db8::1]/",
  ])("rejects unsafe target %s", (url) => {
    expect(() => normalizeAndValidateUrl(url)).toThrow(UrlPolicyError);
  });

  it.each([
    "https://linkedin.com/jobs",
    "https://www.linkedin.com/jobs",
    "https://topcv.vn/viec-lam",
    "https://jobs.vietnamworks.com/",
  ])("blocks unlicensed extraction domain %s", (url) => {
    expect(() => normalizeAndValidateUrl(url)).toThrow(/not allowed/);
  });

  it("does not block unrelated suffix lookalikes", () => {
    expect(normalizeAndValidateUrl("https://notlinkedin.com/").url).toBe(
      "https://notlinkedin.com/",
    );
  });

  it.each([
    "http://service.internal/",
    "http://router.lan/",
    "http://host.home.arpa/",
    "http://service.test/",
  ])("rejects special-use hostname %s without DNS resolution", async (url) => {
    const resolver = vi.fn(publicResolver);
    await expect(resolveAndValidateUrl(url, { resolver })).rejects.toThrow(
      /Special-use/,
    );
    expect(resolver).not.toHaveBeenCalled();
  });

  it.each([
    ["0.0.0.0", 4],
    ["10.1.2.3", 4],
    ["100.64.0.1", 4],
    ["127.0.0.1", 4],
    ["169.254.10.20", 4],
    ["172.20.0.1", 4],
    ["192.168.1.1", 4],
    ["192.0.2.1", 4],
    ["224.0.0.1", 4],
    ["240.0.0.1", 4],
    ["::", 6],
    ["::1", 6],
    ["fc00::1", 6],
    ["fe80::1", 6],
    ["ff02::1", 6],
    ["2001:db8::1", 6],
  ] as const)("rejects DNS answer %s", async (address, family) => {
    await expect(
      resolveAndValidateUrl("https://public.example.net/", {
        resolver: async () => [{ address, family }],
      }),
    ).rejects.toThrow(/non-public/);
  });

  it("rejects a hostname if any DNS answer is non-public", async () => {
    await expect(
      resolveAndValidateUrl("https://public.example.net/", {
        resolver: async () => [
          { address: "93.184.216.34", family: 4 },
          { address: "127.0.0.1", family: 4 },
        ],
      }),
    ).rejects.toThrow(/non-public/);
  });

  it("accepts public A and AAAA DNS answers", async () => {
    await expect(
      resolveAndValidateUrl("https://public.example.net/path", {
        resolver: publicResolver,
      }),
    ).resolves.toMatchObject({ url: "https://public.example.net/path" });
  });
});

describe("web source registration policy", () => {
  it("validates registered sources again before provider use", async () => {
    const source = await registerWebSource("https://example.com/report", {
      resolver: publicResolver,
    });
    await expect(
      validateRegisteredWebSource(source, { resolver: publicResolver }),
    ).resolves.toBe(source);

    await expect(
      validateRegisteredWebSource(
        { ...source, urlHash: "tampered" },
        { resolver: publicResolver },
      ),
    ).rejects.toThrow(/hash is invalid/);
  });

  it("accepts only canonically equivalent provider-returned URLs by default", async () => {
    const requested = await registerWebSource("https://example.com/report", {
      resolver: publicResolver,
    });
    const returned = await validateProviderWebSource(
      requested,
      " HTTPS://Example.COM.:443/report#section ",
      { resolver: publicResolver },
    );

    expect(returned.url).toBe("https://example.com/report");
    await expect(
      validateProviderWebSource(requested, "https://example.com/final-report", {
        resolver: publicResolver,
      }),
    ).rejects.toThrow(/requested source/);
    await expect(
      validateProviderWebSource(requested, "http://127.0.0.1/private", {
        resolver: publicResolver,
      }),
    ).rejects.toThrow(UrlPolicyError);
    await expect(
      validateProviderWebSource(requested, "https://linkedin.com/jobs", {
        resolver: publicResolver,
      }),
    ).rejects.toThrow(UrlPolicyError);
  });

  it("rejects a provider-returned URL from a different origin by default", async () => {
    const requested = await registerWebSource("https://example.com/report", {
      resolver: publicResolver,
    });

    await expect(
      validateProviderWebSource(requested, "https://cdn.example.com/report", {
        resolver: publicResolver,
      }),
    ).rejects.toThrow(/requested source/);
    await expect(
      validateProviderWebSource(requested, "https://cdn.example.com/report", {
        allowCrossOrigin: true,
        resolver: publicResolver,
      }),
    ).resolves.toMatchObject({ url: "https://cdn.example.com/report" });
  });
});
