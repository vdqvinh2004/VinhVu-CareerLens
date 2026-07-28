import {
  normalizeAndValidateUrl,
  resolveAndValidateUrl,
  type AsyncUrlPolicyOptions,
  type CanonicalUrl,
  UrlPolicyError,
} from "./url-policy";

export type RegisteredWebSource = Readonly<CanonicalUrl>;

export type ProviderWebSourceOptions = AsyncUrlPolicyOptions & {
  allowCrossOrigin?: boolean;
};

export async function registerWebSource(
  candidateUrl: string,
  options?: AsyncUrlPolicyOptions,
): Promise<RegisteredWebSource> {
  return Object.freeze(await resolveAndValidateUrl(candidateUrl, options));
}

export async function validateRegisteredWebSource(
  source: RegisteredWebSource,
  options?: AsyncUrlPolicyOptions,
): Promise<RegisteredWebSource> {
  const validated = normalizeAndValidateUrl(source.url, options);

  if (validated.urlHash !== source.urlHash || validated.url !== source.url) {
    throw new UrlPolicyError("Registered source URL or hash is invalid");
  }

  await resolveAndValidateUrl(source.url, options);
  return source;
}

export async function validateProviderWebSource(
  requestedSource: RegisteredWebSource,
  returnedUrl: string,
  options: ProviderWebSourceOptions = {},
): Promise<RegisteredWebSource> {
  await validateRegisteredWebSource(requestedSource, options);
  const returnedSource = await registerWebSource(returnedUrl, options);

  if (!options.allowCrossOrigin && returnedSource.url !== requestedSource.url) {
    throw new UrlPolicyError("Provider-returned URL must match the requested source");
  }

  return returnedSource;
}
