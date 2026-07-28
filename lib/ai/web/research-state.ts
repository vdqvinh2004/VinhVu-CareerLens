import type { ToolSourceRegistry } from "../agent/tools";
import type { AgentSource } from "../agent/types";

export type WebEvidence = Readonly<{
  id: string;
  sourceId: string;
  quote: string;
}>;

export class WebResearchState {
  readonly #sourceIdsByUrl = new Map<string, string>();
  readonly #createdSourceIds = new Set<string>();
  readonly #attemptedReadSourceIds = new Set<string>();
  readonly #searchSnippets = new Map<string, string>();
  readonly #evidence = new Map<string, WebEvidence>();
  #nextSourceId = 1;
  #nextEvidenceId = 1;

  sourceIdForUrl(url: string): string | undefined {
    return this.#sourceIdsByUrl.get(url);
  }

  registerSource(
    registry: ToolSourceRegistry,
    url: string,
    source: Omit<AgentSource, "id">,
  ): AgentSource {
    const existingId = this.#sourceIdsByUrl.get(url);
    if (existingId) {
      const existing = registry.get(existingId);
      if (!existing) throw new Error("Registered web source is no longer available");
      return existing;
    }

    const preferredId = `W${this.#nextSourceId}`;
    const registered = registry.register(source, preferredId);
    if (registered.id !== preferredId) {
      throw new Error("Web source registry must honor stable source IDs");
    }
    this.#nextSourceId += 1;
    this.#sourceIdsByUrl.set(url, registered.id);
    this.#createdSourceIds.add(registered.id);
    return registered;
  }

  ownsSource(sourceId: string): boolean {
    return this.#createdSourceIds.has(sourceId);
  }

  setSearchSnippet(sourceId: string, snippet: string): void {
    if (!this.ownsSource(sourceId)) {
      throw new Error(`Source ${sourceId} is not owned by this web research state`);
    }
    const normalized = snippet.replace(/\s+/g, " ").trim();
    if (normalized) this.#searchSnippets.set(sourceId, normalized);
  }

  searchSnippet(sourceId: string): string | undefined {
    return this.#searchSnippets.get(sourceId);
  }

  reserveReads(sourceIds: readonly string[], maxPerRun = 6): void {
    const next = new Set(this.#attemptedReadSourceIds);
    for (const sourceId of sourceIds) next.add(sourceId);
    if (next.size > maxPerRun) {
      throw new Error(`A run may read at most ${maxPerRun} sources`);
    }
    for (const sourceId of sourceIds) this.#attemptedReadSourceIds.add(sourceId);
  }

  addEvidence(sourceId: string, quote: string): WebEvidence {
    const evidence = Object.freeze({
      id: `E${this.#nextEvidenceId++}`,
      sourceId,
      quote,
    });
    this.#evidence.set(evidence.id, evidence);
    return evidence;
  }

  getEvidence(evidenceId: string): WebEvidence | undefined {
    return this.#evidence.get(evidenceId);
  }

  listEvidence(): readonly WebEvidence[] {
    return [...this.#evidence.values()];
  }
}

export class StableWebSourceRegistry implements ToolSourceRegistry {
  readonly #sources = new Map<string, AgentSource>();
  readonly #idsByUrl = new Map<string, string>();

  get(sourceId: string): AgentSource | undefined {
    return this.#sources.get(sourceId);
  }

  register(source: Omit<AgentSource, "id">, preferredId?: string): AgentSource {
    const existingId = this.#idsByUrl.get(source.url);
    if (existingId) return this.#sources.get(existingId)!;
    const id = preferredId ?? `S${this.#sources.size + 1}`;
    if (this.#sources.has(id)) throw new Error(`Source ID ${id} is already registered`);
    const registered = Object.freeze({ id, ...source });
    this.#sources.set(id, registered);
    this.#idsByUrl.set(source.url, id);
    return registered;
  }

  list(): readonly AgentSource[] {
    return [...this.#sources.values()];
  }
}
