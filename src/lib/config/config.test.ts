import { describe, it, expect } from 'vitest';
import {
  parseSpaceKv,
  parseIniKv,
  parseNginx,
  parseCiscoIos,
  detectSyntax,
} from './parse';
import { auditConfig, auditConfigText } from './audit';
import { SSH_RULES, NGINX_RULES, CISCO_RULES } from './rules';

const APACHE = `ServerRoot "/etc/httpd"
Listen 80
ServerTokens Full
ServerSignature On
TraceEnable On
SSLProtocol all
<Directory "/var/www/html">
    Options Indexes FollowSymLinks
</Directory>`;

const SSHD = `# Managed by Ansible
Port 22
PermitRootLogin yes    # legacy
PasswordAuthentication yes
X11Forwarding no
Protocol 2
`;

describe('parseSpaceKv', () => {
  it('extracts key/value pairs, stripping comments and blanks', () => {
    const entries = parseSpaceKv(SSHD);
    const byKey = Object.fromEntries(entries.map((e) => [e.key, e.value]));
    expect(byKey.Port).toBe('22');
    expect(byKey.PermitRootLogin).toBe('yes'); // trailing comment removed
    expect(entries.find((e) => e.key === 'PermitRootLogin')?.line).toBe(3);
  });
});

describe('parseIniKv', () => {
  it('parses key = value and ignores [sections]', () => {
    const entries = parseIniKv('[server]\nssl = on\n; note\nport=8080');
    expect(entries).toEqual([
      { key: 'ssl', value: 'on', line: 2, raw: 'ssl = on' },
      { key: 'port', value: '8080', line: 4, raw: 'port=8080' },
    ]);
  });
});

describe('detectSyntax', () => {
  it('recognizes ssh by filename or content', () => {
    expect(detectSyntax('sshd_config', '')).toBe('ssh');
    expect(detectSyntax('unknown', 'PermitRootLogin no')).toBe('ssh');
  });
  it('recognizes ini by section headers', () => {
    expect(detectSyntax('app.cfg', '[main]\nx = 1')).toBe('ini');
  });
});

describe('auditConfig', () => {
  it('flags insecure sshd directives with severity', () => {
    const findings = auditConfig(parseSpaceKv(SSHD), SSH_RULES);
    const ids = findings.map((f) => f.rule);
    expect(ids).toContain('ssh-root-login');
    expect(ids).toContain('ssh-password-auth');
    // X11Forwarding no + Protocol 2 are safe → not flagged.
    expect(ids).not.toContain('ssh-x11-forwarding');
    expect(ids).not.toContain('ssh-protocol-1');
    const root = findings.find((f) => f.rule === 'ssh-root-login');
    expect(root?.severity).toBe('high');
    expect(root?.detail).toContain('line 3');
  });

  it('uses the first occurrence of a repeated key', () => {
    const findings = auditConfig(
      parseSpaceKv('PermitRootLogin no\nPermitRootLogin yes'),
      SSH_RULES,
    );
    expect(findings.find((f) => f.rule === 'ssh-root-login')).toBeUndefined();
  });
});

describe('auditConfigText', () => {
  it('detects dialect, parses and audits end-to-end', () => {
    const res = auditConfigText('sshd_config', SSHD);
    expect(res.syntax).toBe('ssh');
    expect(res.entryCount).toBe(5);
    expect(res.findings.length).toBeGreaterThan(0);
  });
});

const NGINX = `server {
    listen 443 ssl;
    server_name example.com;
    server_tokens on;
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
    autoindex on;
    location / {
        proxy_pass http://app;
    }
}`;

describe('nginx dialect', () => {
  it('parses directives, stripping braces and trailing semicolons', () => {
    const byKey = Object.fromEntries(
      parseNginx(NGINX).map((e) => [e.key, e.value]),
    );
    expect(byKey.server_tokens).toBe('on');
    expect(byKey.listen).toBe('443 ssl');
    expect(byKey.server).toBe(''); // block opener, brace stripped
  });

  it('detects nginx by filename or content', () => {
    expect(detectSyntax('nginx.conf', NGINX)).toBe('nginx');
    expect(detectSyntax('default.conf', NGINX)).toBe('nginx');
  });

  it('flags server_tokens, autoindex, weak TLS and missing HSTS', () => {
    const ids = auditConfig(parseNginx(NGINX), NGINX_RULES).map((f) => f.rule);
    expect(ids).toEqual(
      expect.arrayContaining([
        'nginx-server-tokens',
        'nginx-autoindex',
        'nginx-weak-tls',
        'nginx-hsts-missing',
      ]),
    );
  });

  it('does not flag TLSv1.2/1.3-only as weak', () => {
    const clean = 'server {\nssl_protocols TLSv1.2 TLSv1.3;\nadd_header Strict-Transport-Security "max-age=1" always;\n}';
    const ids = auditConfig(parseNginx(clean), NGINX_RULES).map((f) => f.rule);
    expect(ids).not.toContain('nginx-weak-tls');
    expect(ids).not.toContain('nginx-hsts-missing');
  });
});

const CISCO = `!
hostname edge-router
!
enable password cisco
no service password-encryption
!
line vty 0 4
 transport input telnet
!
snmp-server community public RO
ip http server
!
end`;

describe('cisco IOS dialect', () => {
  it('parses lines and skips ! comments, preserving raw indentation', () => {
    const entries = parseCiscoIos(CISCO);
    const transport = entries.find((e) => e.raw.includes('transport input'));
    expect(transport?.raw).toBe(' transport input telnet'); // leading space kept
    expect(entries.some((e) => e.raw.startsWith('!'))).toBe(false);
  });

  it('detects cisco by filename or content', () => {
    expect(detectSyntax('running-config.txt', CISCO)).toBe('cisco');
    expect(detectSyntax('switch.cfg', 'enable secret 5 xyz')).toBe('cisco');
  });

  it('flags telnet, weak enable password, SNMP default, http server', () => {
    const ids = auditConfig(parseCiscoIos(CISCO), CISCO_RULES).map((f) => f.rule);
    expect(ids).toEqual(
      expect.arrayContaining([
        'cisco-enable-password',
        'cisco-no-password-encryption',
        'cisco-telnet-vty',
        'cisco-snmp-default-community',
        'cisco-http-server',
      ]),
    );
  });
});

describe('apache dialect', () => {
  it('detects apache by filename or content, not as nginx despite `Listen`', () => {
    expect(detectSyntax('httpd.conf', APACHE)).toBe('apache');
    expect(detectSyntax('config', 'ServerTokens Full')).toBe('apache');
    expect(detectSyntax('site', 'Listen 80\nServerSignature On')).toBe('apache');
  });

  it('flags server tokens, TRACE, weak TLS, directory listing and missing HSTS', () => {
    const ids = auditConfigText('httpd.conf', APACHE).findings.map((f) => f.rule);
    expect(ids).toEqual(
      expect.arrayContaining([
        'apache-server-tokens',
        'apache-server-signature',
        'apache-trace-enable',
        'apache-weak-tls',
        'apache-directory-listing',
        'apache-hsts-missing',
      ]),
    );
  });

  it('does not flag hardened Options -Indexes or a present HSTS header', () => {
    const hardened =
      'Header always set Strict-Transport-Security "max-age=1"\n<Directory /x>\nOptions -Indexes\n</Directory>';
    const ids = auditConfigText('httpd.conf', hardened).findings.map((f) => f.rule);
    expect(ids).not.toContain('apache-directory-listing');
    expect(ids).not.toContain('apache-hsts-missing');
  });
});
