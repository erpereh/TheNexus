import { describe, expect, it } from 'vitest';

import { redactJsonStrings, redactSecrets, type SecretKind } from './redact';

/**
 * Secret-like fixtures are intentionally assembled at runtime.
 *
 * This file tests secret-redaction logic, so the resulting values need to
 * resemble real provider credentials. However, complete credential-shaped
 * literals must NOT exist in the repository because GitHub Secret Scanning
 * can correctly identify them as potential secrets and block pushes.
 *
 * Keep credential prefixes/payloads split when adding new fixtures.
 */
const join = (...parts: string[]): string => parts.join('');

const secretFixtures = {
  openAiProject: (): string => join('sk', '-proj-', 'abcdefghijklmnopqrstuvwxyz123456'),

  anthropic: (): string => join('sk', '-ant-', 'api03-', 'abcdefghijklmnop'),

  plainApiKey: (): string => join('sk', '-plainkey', '0123456789'),

  githubPat: (): string => join('gh', 'p_', '0123456789abcdefghijklmnopqrstuvwxyz'),

  githubOAuth: (): string => join('gh', 'o_', '0123456789abcdefghijklmnopqrstuvwxyz'),

  githubShortPat: (): string => join('gh', 'p_', 'abcdefghijklmnopqrstuvwxyz'),

  gitlabPat: (): string => join('gl', 'pat-', '0123456789abcdefghijklmnopqrst'),

  slackBot: (): string => join('xo', 'xb-', '0123456789-', 'abcdefghijklmnop'),

  awsAccessKey: (): string => join('AK', 'IA', 'IOSFODNN7EXAMPLE'),

  awsSecretAccessKey: (): string => join('wJalrXUtnFEMI/', 'K7MDENG/', 'bPxRfiCYEXAMPLEKEY'),

  awsEnvSecretAccessKey: (): string => join('wJalrXUtnFEMI/', 'K7MDENG', 'bPxRfiDOKENKEY'),

  googleApiKey: (): string => join('AI', 'za', 'SyA0123456789', 'abcdefghijklmnopqrstuv'),

  npmToken: (): string => join('npm', '_', '0123456789abcdefghijklmnopqrstuvwxyz'),

  jwtLong: (): string =>
    join(
      'eyJhbGciOiJIUzI1NiJ9',
      '.',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      '.',
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    ),

  jwtShort: (): string =>
    join('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxIn0', '.', 'SflKxwRJSMeKKF2QT4fwpM'),

  jwtStructured: (): string =>
    join('eyJhbGciOiJIUzI1NiJ9', '.', 'eyJzdWIiOiIxIn0', '.', 'sig_part098765'),

  rsaPrivateKeyBlock: (): string =>
    [
      join('-----BEGIN ', 'RSA PRIVATE KEY-----'),
      'MIIEowIBAAKCAQEA',
      'abcdefghijklmnop',
      join('-----END ', 'RSA PRIVATE KEY-----'),
    ].join('\n'),

  privateKeyBlock: (): string =>
    [join('-----BEGIN ', 'PRIVATE KEY-----'), 'MIIEow', join('-----END ', 'PRIVATE KEY-----')].join(
      '\n',
    ),
};

describe('redactSecrets pattern classes', () => {
  it('redacts OpenAI/Anthropic-style API keys', () => {
    const result = redactSecrets(
      [
        'using',
        secretFixtures.openAiProject(),
        'and',
        secretFixtures.anthropic(),
        'and',
        secretFixtures.plainApiKey(),
      ].join(' '),
    );

    expect(result.redactedCount).toBe(3);
    expect(result.kinds).toEqual(['api-key']);
    expect(result.text).not.toContain('sk-');
    expect(result.text).toMatch(/\[REDACTED:api-key\]/g);
  });

  it('redacts GitHub, GitLab, Slack, AWS and Google provider tokens', () => {
    const result = redactSecrets(
      [
        secretFixtures.githubPat(),
        secretFixtures.githubOAuth(),
        secretFixtures.gitlabPat(),
        secretFixtures.slackBot(),
        secretFixtures.awsAccessKey(),
        secretFixtures.googleApiKey(),
        secretFixtures.npmToken(),
      ].join(' '),
    );

    expect(result.redactedCount).toBe(7);
    expect(result.kinds).toEqual(['provider-token']);

    for (const marker of ['ghp_', 'gho_', 'glpat-', 'xoxb-', 'AKIA', 'AIza', 'npm_']) {
      expect(result.text).not.toContain(marker);
    }
  });

  it('redacts an AWS access key together with its adjacent secret', () => {
    const result = redactSecrets(
      `${secretFixtures.awsAccessKey()} ${secretFixtures.awsSecretAccessKey()}`,
    );

    expect(result.redactedCount).toBe(1);
    expect(result.text).toBe('[REDACTED:provider-token]');
  });

  it('redacts JWT triplets', () => {
    const result = redactSecrets(`token ${secretFixtures.jwtLong()} end`);

    expect(result.redactedCount).toBe(1);
    expect(result.kinds).toEqual(['jwt']);
    expect(result.text).toBe('token [REDACTED:jwt] end');
  });

  it('redacts Authorization Bearer headers', () => {
    const result = redactSecrets('Authorization: Bearer abc123def456ghi789');

    expect(result.redactedCount).toBe(1);
    expect(result.kinds).toEqual(['bearer']);
    expect(result.text).toBe('Authorization: Bearer [REDACTED:bearer]');
  });

  it('redacts other auth headers including the whole value', () => {
    const result = redactSecrets('Proxy-Authorization: Basic dXNlcjpwYXNzd29yZA==');

    expect(result.redactedCount).toBe(1);
    expect(result.kinds).toEqual(['auth-header']);
    expect(result.text).toBe('Proxy-Authorization: [REDACTED:auth-header]');

    // The Basic credential must not survive as plaintext.
    expect(result.text).not.toContain('dXNlcjpwYXNzd29yZA');
  });

  it('redacts private key blocks across lines', () => {
    const result = redactSecrets(
      ['before', secretFixtures.rsaPrivateKeyBlock(), 'after'].join('\n'),
    );

    expect(result.redactedCount).toBe(1);
    expect(result.kinds).toEqual(['private-key']);
    expect(result.text).toBe('before\n[REDACTED:private-key]\nafter');
  });

  it('redacts environment variable secrets with and without export', () => {
    const result = redactSecrets(
      [
        'DB_PASSWORD=sup3rs3cret',
        `export AWS_SECRET_ACCESS_KEY=${secretFixtures.awsEnvSecretAccessKey()}`,
        'NEXUS_API_KEY=abc123def456',
      ].join(' '),
    );

    expect(result.kinds).toEqual(['env-secret']);
    expect(result.text).toContain('DB_PASSWORD=[REDACTED:env-secret]');
    expect(result.text).toContain('AWS_SECRET_ACCESS_KEY=[REDACTED:env-secret]');
    expect(result.text).toContain('NEXUS_API_KEY=[REDACTED:env-secret]');
    expect(result.text).not.toContain('sup3rs3cret');
  });
});

describe('redactSecrets behavior', () => {
  it('is idempotent: re-redacting changes nothing and counts zero', () => {
    const mixed = [
      'Bearer abc123def456ghi789',
      secretFixtures.openAiProject(),
      'DB_PASSWORD=sup3rs3cret',
      secretFixtures.jwtLong(),
      secretFixtures.githubPat(),
    ].join(' | ');

    const first = redactSecrets(mixed);

    expect(first.redactedCount).toBe(5);

    const second = redactSecrets(first.text);

    expect(second.text).toBe(first.text);
    expect(second.redactedCount).toBe(0);
    expect(second.kinds).toEqual([]);
  });

  it('leaves non-secret text untouched', () => {
    const text =
      'The agent finished task 42 with 3 files changed; see ws_demo/room_alpha for details.';

    const result = redactSecrets(text);

    expect(result.text).toBe(text);
    expect(result.redactedCount).toBe(0);
    expect(result.kinds).toEqual([]);
  });

  it('filters by requested kinds only', () => {
    const text = [secretFixtures.openAiProject(), 'and', secretFixtures.githubPat()].join(' ');

    const onlyProviderTokens = redactSecrets(text, {
      kinds: ['provider-token'],
    });

    expect(onlyProviderTokens.kinds).toEqual(['provider-token']);
    expect(onlyProviderTokens.text).toContain('sk-proj-');
    expect(onlyProviderTokens.text).not.toContain('ghp_');

    const onlyApiKeys = redactSecrets(text, {
      kinds: ['api-key'],
    });

    expect(onlyApiKeys.kinds).toEqual(['api-key']);
    expect(onlyApiKeys.text).toContain('ghp_');
    expect(onlyApiKeys.text).not.toContain('sk-proj-');

    const none = redactSecrets(text, { kinds: [] });

    expect(none).toEqual({
      text,
      redactedCount: 0,
      kinds: [],
    });
  });

  it('supports a custom replacement token', () => {
    const result = redactSecrets(`token=${secretFixtures.githubPat()}`, {
      replacement: '<secret>',
    });

    expect(result.text).toBe('token=<secret>');
  });

  it('reports multiple kinds in a stable order', () => {
    const result = redactSecrets(
      ['a', secretFixtures.plainApiKey(), 'b', secretFixtures.githubPat(), 'c'].join(' '),
    );

    expect(result.redactedCount).toBe(2);
    expect(result.kinds).toEqual(['api-key', 'provider-token']);
  });
});

describe('redactJsonStrings', () => {
  it('redacts secrets inside nested objects, arrays and leaves other values intact', () => {
    const input = {
      prompt: `run with key ${secretFixtures.openAiProject()}`,
      attempts: [
        {
          note: `token ${secretFixtures.githubPat()}`,
        },
        7,
        null,
        true,
      ],
      count: 3,
      ratio: 0.5,
      flagged: false,
      empty: null,
    };

    const output = redactJsonStrings(input) as typeof input;

    expect(output.prompt).toBe('run with key [REDACTED:api-key]');
    expect(output.attempts[0]).toEqual({
      note: 'token [REDACTED:provider-token]',
    });
    expect(output.attempts[1]).toBe(7);
    expect(output.attempts[2]).toBeNull();
    expect(output.attempts[3]).toBe(true);
    expect(output.count).toBe(3);
    expect(output.ratio).toBe(0.5);
    expect(output.flagged).toBe(false);
    expect(output.empty).toBeNull();
  });

  it('walks null-prototype objects (parsed JSON) and non-plain instances are returned as-is', () => {
    const parsed: Record<string, unknown> = JSON.parse(
      '{"meta":{"header":"Bearer abc123def456ghi789"}}',
    );

    const output = redactJsonStrings(parsed) as {
      meta: {
        header: string;
      };
    };

    expect(output.meta.header).toBe('Bearer [REDACTED:bearer]');

    const date = new Date(0);
    const wrapped = { when: date };

    const same = redactJsonStrings(wrapped) as typeof wrapped;

    expect(same.when).toBe(date);
  });

  it('is idempotent on structured input', () => {
    const input = {
      deep: {
        list: [
          'DB_PASSWORD=sup3rs3cret',
          {
            jwt: secretFixtures.jwtStructured(),
          },
        ],
      },
    };

    const once = redactJsonStrings(input);
    const twice = redactJsonStrings(once);

    expect(twice).toEqual(once);
  });
});

describe('SecretKind exhaustiveness', () => {
  it('every kind can be requested and is reported when matched', () => {
    const kinds: readonly SecretKind[] = [
      'api-key',
      'bearer',
      'auth-header',
      'private-key',
      'env-secret',
      'jwt',
      'provider-token',
    ];

    const samples: Record<SecretKind, string> = {
      'api-key': secretFixtures.plainApiKey(),

      bearer: 'Bearer abc123def456ghi789',

      'auth-header': 'X-Api-Key: abc123def456ghi789',

      'private-key': secretFixtures.privateKeyBlock(),

      'env-secret': 'NEXUS_TOKEN=abc123def456',

      jwt: secretFixtures.jwtShort(),

      'provider-token': secretFixtures.githubPat(),
    };

    for (const kind of kinds) {
      const result = redactSecrets(samples[kind], {
        kinds: [kind],
      });

      expect(result.redactedCount, `kind ${kind} must match its sample`).toBeGreaterThan(0);

      expect(result.kinds).toEqual([kind]);
    }
  });
});

describe('review hardening (quoted env values, shared refs)', () => {
  it('redacts quoted env-secret values (single and double quotes)', () => {
    const cases = [
      'MY_SECRET="abc123def456"',
      "API_TOKEN='abc123def456ghi'",
      'export DATABASE_PASSWORD="hunter2 secret"',
    ];

    for (const text of cases) {
      const result = redactSecrets(text);

      expect(result.redactedCount, text).toBe(1);
      expect(result.text).toContain('[REDACTED:env-secret]');
      expect(result.text).not.toContain('abc123');
      expect(result.text).not.toContain('hunter2');
    }

    // Double-quoted form keeps the quotes for debuggability.
    expect(redactSecrets('MY_SECRET="abc123def456"').text).toBe(
      'MY_SECRET="[REDACTED:env-secret]"',
    );
  });

  it('redaction of quoted env values is idempotent', () => {
    const once = redactSecrets('MY_SECRET="abc123def456"');

    const twice = redactSecrets(once.text);

    expect(twice.text).toBe(once.text);
    expect(twice.redactedCount).toBe(0);
  });

  it('redacts shared (non-circular) object references consistently', () => {
    const inner = {
      secret: secretFixtures.githubShortPat(),
    };

    const input = {
      a: inner,
      b: inner,
    };

    const output = redactJsonStrings(input) as {
      a: {
        secret: string;
      };
      b: {
        secret: string;
      };
    };

    expect(output.a.secret).toBe('[REDACTED:provider-token]');

    expect(output.b.secret).toBe('[REDACTED:provider-token]');

    // The original input object is never mutated.
    expect(inner.secret).toBe(secretFixtures.githubShortPat());
  });
});
