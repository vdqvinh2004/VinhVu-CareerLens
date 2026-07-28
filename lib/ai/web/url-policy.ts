import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAX_URL_LENGTH = 2_048;

export const BLOCKED_EXTRACTION_DOMAINS = [
  "linkedin.com",
  "topcv.vn",
  "vietnamworks.com",
] as const;

export type UrlPolicyOptions = {
  additionalBlockedDomains?: readonly string[];
  maxUrlLength?: number;
};

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type DnsResolver = (
  hostname: string,
) => Promise<readonly ResolvedAddress[]>;

export type AsyncUrlPolicyOptions = UrlPolicyOptions & {
  resolver?: DnsResolver;
};

export type CanonicalUrl = {
  url: string;
  urlHash: string;
};

export class UrlPolicyError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UrlPolicyError";
  }
}

function normalizeDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/\.+$/, "");
}

const SPECIAL_USE_HOSTNAMES = [
  "localhost",
  "local",
  "internal",
  "intranet",
  "lan",
  "home",
  "home.arpa",
  "corp",
  "localdomain",
  "test",
  "example",
  "invalid",
  "onion",
] as const;

const blockedIpv4Addresses = new BlockList();
const blockedIpv6Addresses = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4Addresses.addSubnet(network, prefix, "ipv4");
}

// Only 2000::/3 is allocated as ordinary global unicast IPv6 space.
for (const [network, prefix] of [
  ["::", 3],
  ["4000::", 2],
  ["8000::", 1],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const) {
  blockedIpv6Addresses.addSubnet(network, prefix, "ipv6");
}

async function defaultResolver(hostname: string): Promise<ResolvedAddress[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map(({ address, family }) => {
    if (family !== 4 && family !== 6) {
      throw new UrlPolicyError("DNS returned an unsupported address family");
    }
    return { address, family };
  });
}

function isDomainOrSubdomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function assertValidBlockedDomain(domain: string) {
  if (!domain || domain === "localhost" || domain.includes(":") || domain.includes("/")) {
    throw new UrlPolicyError(`Invalid blocked domain: ${domain || "(empty)"}`);
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeAndValidateUrl(
  input: string,
  options: UrlPolicyOptions = {},
): CanonicalUrl {
  const maxUrlLength = options.maxUrlLength ?? MAX_URL_LENGTH;

  if (!Number.isSafeInteger(maxUrlLength) || maxUrlLength <= 0) {
    throw new UrlPolicyError("maxUrlLength must be a positive safe integer");
  }

  const rawUrl = input.trim();
  if (!rawUrl || rawUrl.length > maxUrlLength) {
    throw new UrlPolicyError("URL is empty or exceeds the allowed length");
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new UrlPolicyError("URL is invalid", { cause: error });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlPolicyError("Only HTTP(S) URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new UrlPolicyError("URL credentials are not allowed");
  }

  const allowedPort = parsed.protocol === "http:" ? "80" : "443";
  if (parsed.port && parsed.port !== allowedPort) {
    throw new UrlPolicyError("URL port is not allowed");
  }

  const hostname = normalizeDomain(parsed.hostname);
  if (!hostname) {
    throw new UrlPolicyError("URL hostname is required");
  }

  const unwrappedHostname = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (isIP(unwrappedHostname) !== 0) {
    throw new UrlPolicyError("IP literal URLs are not allowed");
  }

  if (SPECIAL_USE_HOSTNAMES.some((domain) => isDomainOrSubdomain(hostname, domain))) {
    throw new UrlPolicyError("Special-use hostnames are not allowed");
  }

  const blockedDomains = [
    ...BLOCKED_EXTRACTION_DOMAINS,
    ...(options.additionalBlockedDomains ?? []),
  ].map(normalizeDomain);

  for (const domain of blockedDomains) {
    assertValidBlockedDomain(domain);
    if (isDomainOrSubdomain(hostname, domain)) {
      throw new UrlPolicyError(`Extraction from ${domain} is not allowed`);
    }
  }

  parsed.hostname = hostname;
  parsed.hash = "";
  parsed.searchParams.sort();

  const url = parsed.toString();
  return { url, urlHash: sha256(url) };
}

export async function resolveAndValidateUrl(
  input: string,
  options: AsyncUrlPolicyOptions = {},
): Promise<CanonicalUrl> {
  const canonical = normalizeAndValidateUrl(input, options);
  const hostname = new URL(canonical.url).hostname;

  let addresses: readonly ResolvedAddress[];
  try {
    addresses = await (options.resolver ?? defaultResolver)(hostname);
  } catch (error) {
    throw new UrlPolicyError("URL hostname could not be resolved", { cause: error });
  }

  if (addresses.length === 0) {
    throw new UrlPolicyError("URL hostname did not resolve to an address");
  }

  for (const result of addresses) {
    const family = isIP(result.address);
    if (
      family === 0 ||
      family !== result.family ||
      (family === 4
        ? blockedIpv4Addresses.check(result.address, "ipv4")
        : blockedIpv6Addresses.check(result.address, "ipv6"))
    ) {
      throw new UrlPolicyError("URL hostname resolves to a non-public address");
    }
  }

  return canonical;
}
