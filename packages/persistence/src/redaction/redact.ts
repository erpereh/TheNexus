/**
 * Best-effort secret redaction for optional raw data surfaces
 * (docs/architecture/04-storage-privacy-security.md "Redaction").
 *
 * IMPORTANT: redaction is a SAFETY LAYER, NOT A GUARANTEE. These patterns
 * cover common secret shapes (API tokens, authorization headers, private key
 * blocks, environment-secret assignments, JWTs); they cannot identify every
 * secret. UI and documentation must not claim exhaustiveness.
 *
 * Idempotency: with the default `[REDACTED:<kind>]` replacement, running the
 * result back through redaction changes nothing and reports zero matches
 * (patterns never match the replacement token). A custom `replacement` is
 * used verbatim and is only idempotent if it does not re-trigger patterns.
 */
export type SecretKind =
  'api-key' | 'bearer' | 'auth-header' | 'private-key' | 'env-secret' | 'jwt' | 'provider-token';

export interface RedactionOptions {
  /** Restrict redaction to these kinds; defaults to all kinds. */
  kinds?: readonly SecretKind[];
  /** Replacement token; defaults to `[REDACTED:<kind>]`. */
  replacement?: string;
}

export interface RedactionResult {
  text: string;
  redactedCount: number;
  /** Kinds that actually matched at least once, in pattern order. */
  kinds: readonly SecretKind[];
}

interface Pattern {
  readonly kind: SecretKind;
  readonly regex: RegExp;
  /**
   * Renders the replacement for one match. Omit to replace the whole match
   * with the configured token.
   */
  readonly render?: (match: RegExpExecArray, replacement: string) => string;
}

/**
 * Pattern list, order matters: structural/longest forms first (private keys,
 * auth headers, env assignments) so token patterns never get a chance to
 * partially redact inside them. `(?!\[REDACTED` guards keep already-redacted
 * values from matching again (idempotency).
 */
const PATTERNS: readonly Pattern[] = [
  // Private key blocks, including the full body across lines.
  {
    kind: 'private-key',
    regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  // "Authorization: Bearer <token>" — the token goes, the "Bearer" word is
  // kept. The lookahead rejects purely-alphabetic words so prose ("bearer
  // authentication") is not redacted.
  {
    kind: 'bearer',
    regex: /\b(Bearer)(\s+)(?![A-Za-z]+\b)[A-Za-z0-9._~+/=-]{10,}/gi,
    render: (match, replacement) => `${match[1] ?? ''}${match[2] ?? ''}${replacement}`,
  },
  // Other authorization-style headers: keep the header name, replace the rest
  // of the line so multi-token credentials (Basic auth) cannot survive. The
  // guard scans the whole remainder: a header whose value was already
  // redacted by an earlier pattern (e.g. Bearer) must not be re-redacted
  // (a plain (?!\[REDACTED) would be defeated by \s* backtracking).
  {
    kind: 'auth-header',
    regex:
      /\b(Authorization|Proxy-Authorization|X-Api-Key|X-Auth-Token)(\s*:\s*)(?![^\r\n]*\[REDACTED:)[^\r\n]+/gi,
    render: (match, replacement) => `${match[1] ?? ''}${match[2] ?? ''}${replacement}`,
  },
  // Environment-variable style secrets (VAR_(KEY|TOKEN|SECRET|PASSWORD)=… and
  // `export …`): the variable name is kept for debuggability, the value goes.
  // Quoted values (the dominant real-world form in terminal output, .env and
  // CI logs) are matched with their quotes preserved around the token.
  {
    kind: 'env-secret',
    regex:
      /\b(export\s+)?([A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))\s*=\s*(?![\s"']*\[REDACTED)(?:"([^"]*)"|'([^']*)'|[^\s"']+)/g,
    render: (match, replacement) => {
      const prefix = `${match[1] ?? ''}${match[2] ?? ''}=`;
      if (match[3] !== undefined) return `${prefix}"${replacement}"`;
      if (match[4] !== undefined) return `${prefix}'${replacement}'`;
      return `${prefix}${replacement}`;
    },
  },
  // JWT/JWS compact serializations (header.payload.signature).
  { kind: 'jwt', regex: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]*/g },
  // OpenAI/Anthropic-style API keys: sk-proj-…, sk-ant-…, sk-….
  { kind: 'api-key', regex: /\bsk-(?:proj-|ant-|svcacct-)?[A-Za-z0-9_-]{16,}/g },
  // GitHub tokens: ghp_/gho_/ghu_/ghs_/ghr_.
  { kind: 'provider-token', regex: /\bgh[pousr]_[A-Za-z0-9]{16,}/g },
  // GitLab personal access tokens.
  { kind: 'provider-token', regex: /\bglpat-[A-Za-z0-9_-]{16,}/g },
  // Slack tokens: xoxa/xoxb/xoxp/xoxr/xoxs.
  { kind: 'provider-token', regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  // AWS access key id traveling together with its secret: replaced as one
  // unit. Falls through to the bare-id pattern when no secret follows.
  {
    kind: 'provider-token',
    regex: /\bAKIA[0-9A-Z]{16}\b[^A-Za-z0-9/+=]{1,24}[A-Za-z0-9/+=]{40}\b/g,
  },
  // Bare AWS access key ids.
  { kind: 'provider-token', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  // Google API keys.
  { kind: 'provider-token', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  // npm granular/automation tokens.
  { kind: 'provider-token', regex: /\bnpm_[A-Za-z0-9_-]{20,}/g },
];

/**
 * Redacts secrets in a text string. Never mutates the input; returns the
 * redacted text, the number of replacements and the kinds that matched.
 */
export function redactSecrets(text: string, options?: RedactionOptions): RedactionResult {
  const kindsFilter = options?.kinds;
  const customReplacement = options?.replacement;
  let result = text;
  let redactedCount = 0;
  const matchedKinds: SecretKind[] = [];

  for (const pattern of PATTERNS) {
    if (kindsFilter !== undefined && !kindsFilter.includes(pattern.kind)) {
      continue;
    }
    // Fresh regex per call: shared `g` regexes would carry lastIndex state.
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    const replacement = customReplacement ?? `[REDACTED:${pattern.kind}]`;
    let patternCount = 0;
    let output = '';
    let lastIndex = 0;
    for (let match = regex.exec(result); match !== null; match = regex.exec(result)) {
      const rendered = pattern.render ? pattern.render(match, replacement) : replacement;
      output += result.slice(lastIndex, match.index) + rendered;
      lastIndex = match.index + match[0].length;
      patternCount += 1;
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
    }
    if (patternCount > 0) {
      result = output + result.slice(lastIndex);
      redactedCount += patternCount;
      if (!matchedKinds.includes(pattern.kind)) {
        matchedKinds.push(pattern.kind);
      }
    }
  }

  return { text: result, redactedCount, kinds: matchedKinds };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function redactValue(
  value: unknown,
  options: RedactionOptions | undefined,
  seen: Set<object>,
  memo: WeakMap<object, unknown>,
): unknown {
  if (typeof value === 'string') {
    return redactSecrets(value, options).text;
  }
  if (Array.isArray(value)) {
    const cached = memo.get(value);
    if (cached !== undefined) return cached;
    if (seen.has(value)) {
      // True cycle: cannot redact in place, preserve as-is.
      return value;
    }
    seen.add(value);
    const output = value.map((item) => redactValue(item, options, seen, memo));
    memo.set(value, output);
    return output;
  }
  // Only plain objects (and null-prototype JSON.parse results) are walked;
  // class instances (Date, Buffer, Map, …) are returned untouched so their
  // semantics never change under redaction.
  if (isPlainObject(value)) {
    const cached = memo.get(value);
    if (cached !== undefined) return cached;
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = redactValue(item, options, seen, memo);
    }
    memo.set(value, output);
    return output;
  }
  return value;
}

/**
 * Recursively redacts every string inside a JSON-like structure (plain
 * objects, arrays, strings). Numbers, booleans, null and non-plain instances
 * pass through untouched. Shared (non-circular) object references are
 * redacted once and memoized so every reference yields the redacted copy;
 * true cycles are preserved as-is (documented limitation).
 */
export function redactJsonStrings(value: unknown, options?: RedactionOptions): unknown {
  return redactValue(value, options, new Set<object>(), new WeakMap<object, unknown>());
}
