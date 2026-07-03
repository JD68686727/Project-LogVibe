import type { Severity } from '@/lib/analysis/findings';
import type { ConfigSyntax } from './parse';

/**
 * A static hardening rule checked against a config entry. Kept as plain data
 * (no code, no network) so the ruleset is a versioned, auditable JSON-like
 * catalog — extend it by adding entries, not logic.
 */
export interface ConfigRule {
  id: string;
  severity: Severity;
  title: string;
  remediation: string;
  /** Directive key for key/value checks (sshd, nginx), matched case-insensitively. */
  key?: string;
  /** Fires when the value equals one of these (case-insensitive). */
  unsafeValues?: string[];
  /** Fires when the value is present but NOT one of these. */
  safeValues?: string[];
  /** Fires when the key is absent entirely. */
  requirePresent?: boolean;
  /**
   * Fires when any raw config line matches — for dialects (Cisco IOS) and
   * checks that don't reduce to a single key/value pair.
   */
  unsafeLine?: RegExp;
  /** Fires when NO raw line matches — a required hardening line is missing. */
  requireLine?: RegExp;
  /** Entity label shown for line-pattern rules (defaults to the rule id). */
  subject?: string;
}

/** OpenSSH server hardening checks (sshd_config). */
export const SSH_RULES: ConfigRule[] = [
  {
    id: 'ssh-root-login',
    key: 'PermitRootLogin',
    severity: 'high',
    title: 'Root login over SSH permitted',
    remediation: 'Set PermitRootLogin no (or prohibit-password).',
    unsafeValues: ['yes'],
  },
  {
    id: 'ssh-empty-passwords',
    key: 'PermitEmptyPasswords',
    severity: 'critical',
    title: 'Empty passwords allowed',
    remediation: 'Set PermitEmptyPasswords no.',
    unsafeValues: ['yes'],
  },
  {
    id: 'ssh-password-auth',
    key: 'PasswordAuthentication',
    severity: 'medium',
    title: 'Password authentication enabled',
    remediation: 'Prefer key-based auth: PasswordAuthentication no.',
    unsafeValues: ['yes'],
  },
  {
    id: 'ssh-protocol-1',
    key: 'Protocol',
    severity: 'high',
    title: 'Legacy SSH protocol 1 enabled',
    remediation: 'Use Protocol 2 only.',
    unsafeValues: ['1', '1,2', '2,1'],
  },
  {
    id: 'ssh-x11-forwarding',
    key: 'X11Forwarding',
    severity: 'low',
    title: 'X11 forwarding enabled',
    remediation: 'Disable unless required: X11Forwarding no.',
    unsafeValues: ['yes'],
  },
];

/** nginx web-server hardening checks. */
export const NGINX_RULES: ConfigRule[] = [
  {
    id: 'nginx-server-tokens',
    key: 'server_tokens',
    severity: 'low',
    title: 'Server version disclosed',
    remediation: 'Set server_tokens off;',
    unsafeValues: ['on'],
  },
  {
    id: 'nginx-autoindex',
    key: 'autoindex',
    severity: 'medium',
    title: 'Directory listing enabled',
    remediation: 'Set autoindex off;',
    unsafeValues: ['on'],
  },
  {
    id: 'nginx-weak-tls',
    subject: 'ssl_protocols',
    severity: 'high',
    title: 'Weak TLS protocol enabled',
    remediation: 'Allow only TLSv1.2 and TLSv1.3.',
    // Matches a weak token but not TLSv1.2/1.3.
    unsafeLine: /ssl_protocols[^;\n]*\b(?:SSLv2|SSLv3|TLSv1\.1|TLSv1(?!\.\d))\b/i,
  },
  {
    id: 'nginx-hsts-missing',
    subject: 'HSTS header',
    severity: 'low',
    title: 'HSTS header not set',
    remediation:
      'Add: add_header Strict-Transport-Security "max-age=63072000" always;',
    requireLine: /add_header\s+Strict-Transport-Security/i,
  },
];

/** Cisco IOS device hardening checks (running/startup-config). */
export const CISCO_RULES: ConfigRule[] = [
  {
    id: 'cisco-enable-password',
    subject: 'enable password',
    severity: 'high',
    title: 'Enable password stored without strong hashing',
    remediation: 'Use "enable secret" instead of "enable password".',
    unsafeLine: /^\s*enable password\b/i,
  },
  {
    id: 'cisco-no-password-encryption',
    subject: 'service password-encryption',
    severity: 'medium',
    title: 'Password encryption disabled',
    remediation: 'Enable "service password-encryption".',
    unsafeLine: /^\s*no service password-encryption\b/i,
  },
  {
    id: 'cisco-telnet-vty',
    subject: 'transport input',
    severity: 'high',
    title: 'Telnet remote access enabled',
    remediation: 'Restrict VTY lines to SSH: transport input ssh.',
    unsafeLine: /transport input\s+(?:telnet|all)\b/i,
  },
  {
    id: 'cisco-snmp-default-community',
    subject: 'snmp community',
    severity: 'high',
    title: 'Default SNMP community string',
    remediation: 'Replace public/private and prefer SNMPv3.',
    unsafeLine: /snmp-server community\s+(?:public|private)\b/i,
  },
  {
    id: 'cisco-http-server',
    subject: 'ip http server',
    severity: 'medium',
    title: 'Unencrypted HTTP management enabled',
    remediation: 'Disable: no ip http server (use ip http secure-server).',
    unsafeLine: /^\s*ip http server\s*$/i,
  },
];

/**
 * Built-in rulesets per dialect. INI/generic ship empty for now — the point is
 * the shape: adding a ruleset is pure data, no engine changes.
 */
export const RULES_BY_SYNTAX: Record<ConfigSyntax, ConfigRule[]> = {
  ssh: SSH_RULES,
  nginx: NGINX_RULES,
  cisco: CISCO_RULES,
  ini: [],
  generic: [],
};

const ALL_RULES = [...SSH_RULES, ...NGINX_RULES, ...CISCO_RULES];

/** Human-readable title for a rule id (across all dialects), for reports. */
export function ruleTitle(id: string): string | undefined {
  return ALL_RULES.find((r) => r.id === id)?.title;
}
