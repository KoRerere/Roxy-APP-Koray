import type { BuiltinTool } from "./index.ts";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_CHARS = 50_000;

export interface WebFetchDeps {
  /** Test back-door: inject a fetch implementation instead of globalThis.fetch. */
  _fetch?: typeof fetch;
}

/** Content types we return as text. Anything else is refused (binary). */
function isTextual(contentType: string): boolean {
  const ct = contentType.toLowerCase();
  return (
    ct.startsWith("text/") ||
    ct.includes("json") ||
    ct.includes("xml") ||
    ct.includes("javascript") ||
    ct.includes("x-www-form-urlencoded")
  );
}

/**
 * Reduce an HTML document to readable text: drop script/style/head noise,
 * turn block-level boundaries into newlines, strip the remaining tags, decode
 * the common entities, and collapse blank runs. Deliberately dependency-free —
 * a rough page text is enough for the model to extract facts from.
 */
export function htmlToText(html: string): string {
  let text = html
    .replace(/<script\b[^]*?<\/script>/gi, " ")
    .replace(/<style\b[^]*?<\/style>/gi, " ")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|table|ul|ol|blockquote|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fetch a URL and return its textual content. Sensitive — outbound network
 * traffic can exfiltrate context (prompt-injection risk), so HITL gates it in
 * strict/delegate modes; add a `{ match: "web_fetch", sensitive: false }` rule
 * to allow it unattended.
 */
export function web_fetchTool(deps: WebFetchDeps = {}): BuiltinTool {
  const fetchImpl = deps._fetch ?? fetch;
  return {
    descriptor: {
      name: "web_fetch",
      description:
        "Fetch a public http(s) URL and return its textual content (HTML is reduced to readable text; JSON/XML/plain text returned as-is; binary refused). Output truncated at 50000 chars. Sensitive.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Absolute http:// or https:// URL." },
          timeoutMs: { type: "number", description: "Timeout in milliseconds (default 30000)." },
        },
        required: ["url"],
      },
      source: "builtin",
      metadata: { sensitive: true },
    },
    handler: async (input, ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.url !== "string" || raw.url.length === 0) {
        return { content: "web_fetch: 'url' is required", isError: true };
      }
      let url: URL;
      try {
        url = new URL(raw.url);
      } catch {
        return { content: `web_fetch: invalid URL: ${raw.url}`, isError: true };
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return {
          content: `web_fetch: only http/https URLs are allowed (got ${url.protocol})`,
          isError: true,
        };
      }
      const timeoutMs = typeof raw.timeoutMs === "number" && raw.timeoutMs > 0 ? raw.timeoutMs : DEFAULT_TIMEOUT_MS;

      try {
        const response = await fetchImpl(url.toString(), {
          redirect: "follow",
          signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(timeoutMs)]),
          headers: {
            accept: "text/html,application/json,text/*;q=0.9,*/*;q=0.5",
            "user-agent": "roxy-agent/1.0 (+web_fetch)",
          },
        });
        const contentType = response.headers.get("content-type") ?? "unknown";
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          return {
            content: `web_fetch: HTTP ${response.status} for ${url}\n${body.slice(0, 500)}`,
            isError: true,
          };
        }
        if (!isTextual(contentType)) {
          return {
            content: `web_fetch: unsupported content-type '${contentType}' — only textual responses are returned`,
            isError: true,
          };
        }
        const bodyText = await response.text();
        let text = contentType.toLowerCase().includes("text/html") ? htmlToText(bodyText) : bodyText;
        if (text.length > MAX_CHARS) {
          text = `${text.slice(0, MAX_CHARS)}\n…[truncated ${text.length - MAX_CHARS} chars]`;
        }
        return {
          content: `HTTP ${response.status} ${contentType}\nURL: ${response.url || url}\n\n${text}`,
          isError: false,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: `web_fetch: ${message}`, isError: true };
      }
    },
  };
}
