import "server-only"

// Embeddings for handbook chunks and search queries.
//
// NOT CONFIGURED YET. The plan specifies OpenAI text-embedding-3-small
// (1536 dimensions, matching document_chunks.embedding vector(1536)).
// Until OPENAI_API_KEY is provided and this module is implemented, ingestion
// stores chunks with an empty embedding and vector search is unavailable.

export const EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMENSIONS = 1536

export class EmbeddingsNotConfiguredError extends Error {
  constructor() {
    super("Embeddings are not configured yet (OPENAI_API_KEY is missing).")
    this.name = "EmbeddingsNotConfiguredError"
  }
}

/** Whether embeddings can be generated in this environment. */
export function embeddingsAvailable(): boolean {
  return false
}

/** One embedding per input text, in order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  void texts
  throw new EmbeddingsNotConfiguredError()
}

/** pgvector text format for inserts and RPC arguments, e.g. "[0.1,0.2,…]". */
export function toVectorLiteral(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}.`)
  }
  return `[${embedding.join(",")}]`
}
