import { describe, it, expect } from 'vitest';
import {
  parseSpaceKv,
  parseIniKv,
  parseNginx,
  parseCiscoIos,
  parseRawLines,
  detectSyntax,
} from './parse';
import { auditConfig, auditConfigText } from './audit';
import {
  SSH_RULES,
  NGINX_RULES,
  CISCO_RULES,
  DOCKER_RULES,
  FIREWALL_RULES,
} from './rules';

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

const DOCKER = `version: "3.8"
services:
  web:
    image: nginx:latest
    privileged: true
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
  db:
    image: postgres:16
    pid: "host"`;

describe('docker dialect', () => {
  it('parses every meaningful line, keeping raw and stripping # comments', () => {
    const entries = parseRawLines('# note\nimage: nginx:latest\n\n  privileged: true');
    expect(entries.map((e) => e.raw)).toEqual(['image: nginx:latest', '  privileged: true']);
  });

  it('detects docker by filename or compose content', () => {
    expect(detectSyntax('docker-compose.yml', DOCKER)).toBe('docker');
    expect(detectSyntax('stack', DOCKER)).toBe('docker');
  });

  it('flags privileged, host network/PID, docker.sock and :latest', () => {
    const ids = auditConfigText('docker-compose.yml', DOCKER).findings.map((f) => f.rule);
    expect(ids).toEqual(
      expect.arrayContaining([
        'docker-privileged',
        'docker-host-network',
        'docker-host-pid',
        'docker-socket-mount',
        'docker-latest-tag',
      ]),
    );
  });

  it('does not flag a pinned image without risky options', () => {
    const clean = 'services:\n  app:\n    image: postgres:16\n';
    const ids = auditConfig(parseRawLines(clean), DOCKER_RULES).map((f) => f.rule);
    expect(ids).not.toContain('docker-latest-tag');
    expect(ids).not.toContain('docker-privileged');
  });
});

const IPTABLES = `*filter
-P INPUT ACCEPT
-A INPUT -i lo -j ACCEPT
-A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT
-A INPUT -p tcp --dport 3306 -j ACCEPT
COMMIT`;

const UFW = `ufw default allow incoming
ufw allow 3306/tcp
ufw allow from 10.0.0.0/8 to any port 5432`;

describe('firewall dialect', () => {
  it('detects firewall from iptables or ufw content and filenames', () => {
    expect(detectSyntax('iptables.rules', IPTABLES)).toBe('firewall');
    expect(detectSyntax('rules', 'ufw default allow incoming')).toBe('firewall');
    expect(detectSyntax('rules.v4', '-A INPUT -j DROP')).toBe('firewall');
  });

  it('flags allow-by-default policy and a DB port open to any source', () => {
    const ids = auditConfig(parseRawLines(IPTABLES), FIREWALL_RULES).map((f) => f.rule);
    expect(ids).toEqual(
      expect.arrayContaining(['fw-iptables-input-accept', 'fw-iptables-port-any']),
    );
  });

  it('does not flag a port scoped with a -s source', () => {
    const scoped = '-P INPUT DROP\n-A INPUT -p tcp --dport 3306 -s 10.0.0.0/8 -j ACCEPT';
    const ids = auditConfig(parseRawLines(scoped), FIREWALL_RULES).map((f) => f.rule);
    expect(ids).not.toContain('fw-iptables-port-any');
    expect(ids).not.toContain('fw-iptables-input-accept');
  });

  it('flags ufw default allow and an unscoped port, not a from-scoped one', () => {
    const ids = auditConfig(parseRawLines(UFW), FIREWALL_RULES).map((f) => f.rule);
    expect(ids).toContain('fw-ufw-default-allow');
    expect(ids).toContain('fw-ufw-port-any'); // 3306/tcp with no `from`
    // The 5432 rule is scoped with `from 10.0.0.0/8` → the only port-any hit is 3306.
    const portAny = auditConfig(parseRawLines(UFW), FIREWALL_RULES).find(
      (f) => f.rule === 'fw-ufw-port-any',
    );
    expect(portAny?.detail).toContain('3306');
  });
});
