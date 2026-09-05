import { createHash } from "node:crypto";

export class SourceFetchError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "SourceFetchError";
  }
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&colon;/gi, ":")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function htmlParagraphsToText(html) {
  if (typeof html !== "string") throw new TypeError("html must be a string");
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decodeHtml(match[1].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function contentHash(rawText) {
  return createHash("sha256").update(rawText, "utf8").digest("hex");
}

export async function fetchSourceSnapshot(config, {
  fetchImpl = globalThis.fetch,
  previousSnapshot = null,
  now = new Date()
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetchImpl must be a function");
  let response;
  try {
    response = await fetchImpl(config.url, {
      headers: { "user-agent": "CanvasesSports/0.2 (+https://github.com/braziliany/canvases-sports)" },
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    throw new SourceFetchError(`Failed to fetch ${config.name}: ${error.message}`, error);
  }
  if (response?.status !== 200) {
    throw new SourceFetchError(`Failed to fetch ${config.name}: HTTP ${response?.status ?? "unknown"}`);
  }
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new SourceFetchError(`Unexpected content type from ${config.name}: ${contentType || "missing"}`);
  }
  const html = await response.text();
  for (const marker of config.requiredMarkers ?? []) {
    if (!html.includes(marker)) {
      throw new SourceFetchError(`Unexpected content from ${config.name}: missing marker ${marker}`);
    }
  }
  let rawText = htmlParagraphsToText(html);
  if (config.contentLineMarkers?.length) {
    rawText = rawText.split("\n")
      .filter((line) => config.contentLineMarkers.every((marker) => line.includes(marker)))
      .join("\n");
  }
  if (!rawText) throw new SourceFetchError(`Unexpected content from ${config.name}: no article paragraphs`);
  const hash = contentHash(rawText);
  const reusablePreviousSnapshot = previousSnapshot?.adapter === config.adapter &&
    previousSnapshot?.source?.name === config.name &&
    previousSnapshot?.source?.type === config.type &&
    previousSnapshot?.source?.url === config.url &&
    JSON.stringify(previousSnapshot?.context) === JSON.stringify(config.context);
  const retrievedAt = reusablePreviousSnapshot && previousSnapshot?.contentHash === hash &&
    typeof previousSnapshot?.source?.retrievedAt === "string"
    ? previousSnapshot.source.retrievedAt
    : new Date(now).toISOString();

  return {
    schemaVersion: 1,
    adapter: config.adapter,
    source: {
      name: config.name,
      type: config.type,
      url: config.url,
      retrievedAt
    },
    context: structuredClone(config.context),
    title: config.title,
    contentHash: hash,
    rawText
  };
}
