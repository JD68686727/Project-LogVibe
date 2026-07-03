/** One extracted key/value directive from a config file. */
export interface ConfigEntry {
  key: string;
  value: string;
  /** 1-based source line, for pinpointing findings. */
  line: number;
  raw: string;
}

/** Supported config dialects. `generic` = whitespace-separated key/value. */
export type ConfigSyntax = 'ssh' | 'apache' | 'nginx' | 'cisco' | 'ini' | 'generic';

/** Picks a dialect from the filename, then a light content sniff. */
export function detectSyntax(fileName: string, text: string): ConfigSyntax {
  const n = fileName.toLowerCase();
  if (n.includes('ssh') || /^\s*(?:permitrootlogin|passwordauthentication)\b/im.test(text)) {
    return 'ssh';
  }
  // Apache before nginx: Apache's `Listen 80` would otherwise trip the nginx
  // sniff. Match Apache-specific directives / block tags instead.
  if (
    n.includes('apache') ||
    n.includes('httpd') ||
    /^\s*(?:ServerTokens|ServerSignature|ServerRoot|DocumentRoot|LoadModule|TraceEnable)\b/im.test(text) ||
    /^\s*<(?:VirtualHost|Directory)\b/im.test(text)
  ) {
    return 'apache';
  }
  if (
    n.includes('nginx') ||
    /^\s*(?:server|http|location|upstream)\s*\{/im.test(text) ||
    /^\s*(?:listen|server_name|server_tokens|ssl_protocols)\b/im.test(text)
  ) {
    return 'nginx';
  }
  if (
    /cisco|ios|running-config|startup-config|\bswitch\b|\brouter\b/.test(n) ||
    /^\s*(?:enable (?:secret|password)|service password-encryption|line (?:vty|con)|transport input|snmp-server community)\b/im.test(text) ||
    (/^!/m.test(text) && /^\s*(?:interface|hostname)\s+\S+/im.test(text))
  ) {
    return 'cisco';
  }
  if (/\.(ini|cfg)$/.test(n) || /^\s*\[[^\]]+\]\s*$/m.test(text)) return 'ini';
  return 'generic';
}

/** Strips a `#`/`;` comment (dialect-dependent) and trims. */
function stripComment(raw: string, iniStyle: boolean): string {
  const cut = iniStyle ? raw.replace(/[#;].*$/, '') : raw.replace(/#.*$/, '');
  return cut.trim();
}

/** `sshd_config`-style: `Key value with spaces`. */
export function parseSpaceKv(text: string): ConfigEntry[] {
  const out: ConfigEntry[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = stripComment(raw, false);
    if (!line) return;
    const m = /^(\S+)\s+(.*)$/.exec(line);
    if (m) out.push({ key: m[1], value: m[2].trim(), line: i + 1, raw });
  });
  return out;
}

/** INI-style: `key = value`, ignoring `[sections]`. */
export function parseIniKv(text: string): ConfigEntry[] {
  const out: ConfigEntry[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = stripComment(raw, true);
    if (!line || /^\[[^\]]*\]$/.test(line)) return;
    const m = /^([^=]+)=(.*)$/.exec(line);
    if (m) out.push({ key: m[1].trim(), value: m[2].trim(), line: i + 1, raw });
  });
  return out;
}

/**
 * nginx-style: one `directive args;` per line, ignoring `#` comments and block
 * braces. Block openers (`server {`, `location / {`) still contribute their
 * directive so context is visible. The common one-directive-per-line style is
 * covered; the `raw` line is kept for pattern-based rules.
 */
export function parseNginx(text: string): ConfigEntry[] {
  const out: ConfigEntry[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line || line === '}') return;
    const stmt = line.replace(/\{$/, '').replace(/;$/, '').trim();
    if (!stmt) return;
    const m = /^(\S+)\s+(.*)$/.exec(stmt);
    if (m) out.push({ key: m[1], value: m[2].trim(), line: i + 1, raw });
    else out.push({ key: stmt, value: '', line: i + 1, raw });
  });
  return out;
}

/**
 * Cisco IOS: indentation-based, space-separated, `!`-delimited. The key is the
 * first token (many directives are multi-word, so most IOS rules match the
 * `raw` line via a pattern instead). Original indentation is preserved in `raw`.
 */
export function parseCiscoIos(text: string): ConfigEntry[] {
  const out: ConfigEntry[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('!')) return;
    const m = /^(\S+)\s*(.*)$/.exec(line);
    if (m) out.push({ key: m[1], value: m[2].trim(), line: i + 1, raw });
  });
  return out;
}

export function parseConfig(text: string, syntax: ConfigSyntax): ConfigEntry[] {
  switch (syntax) {
    case 'ini':
      return parseIniKv(text);
    case 'nginx':
      return parseNginx(text);
    case 'cisco':
      return parseCiscoIos(text);
    default:
      return parseSpaceKv(text); // ssh, apache, generic
  }
}
