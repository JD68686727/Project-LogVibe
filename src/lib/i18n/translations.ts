import type { Lang } from '@/types/i18n';

/**
 * English is the source-of-truth catalog. Keys are flat, dotted, and grouped by
 * surface; add a key here and to `de` below (the type keeps them in lockstep).
 * Placeholders use `{name}` and are filled by `translate`.
 */
export const en = {
  'app.tagline': 'Privacy-first, local CSV & log analyzer',

  'header.settings': 'Settings',
  'header.shortcuts': 'Keyboard shortcuts',

  'empty.customLog.prompt': 'Unstructured log (Nginx, Apache, syslog…)?',
  'empty.customLog.action': 'Build a custom log format',
  'empty.audit.prompt': 'Have a server config (SSH, INI…)?',
  'empty.audit.action': 'Audit it for hardening issues',
  'empty.tail.prompt': 'Watching a log that keeps growing?',
  'empty.tail.action': 'Tail it live',
  'empty.samples.heading': 'Or try a sample — nothing is uploaded',

  'common.close': 'Close',
  'common.clear': 'Clear',

  'workspace.mode.analyze': 'Analyze',
  'workspace.mode.compare': 'Compare',
  'workspace.rowsTitle': '{name} · {rows} rows',
  'workspace.remove': 'Remove {name}',
  'workspace.parsing': 'Parsing… {progress}%',
  'workspace.addFile': '+ Add file',
  'workspace.customLog': '+ Custom log',
  'workspace.auditConfig': '+ Audit config',
  'workspace.tailFile': '+ Tail file (live)',

  'dropzone.aria': 'Upload a CSV or log file',
  'dropzone.parsing': 'Parsing your file…',
  'dropzone.title': 'Drop your CSV or log file here',
  'dropzone.orPrefix': 'or ',
  'dropzone.browse': 'browse',
  'dropzone.orSuffix': ' to upload',
  'dropzone.privacy': '{types} — processed 100% locally, nothing leaves your browser',

  'parse.failed': 'Couldn’t parse the file',
  'parse.summary': '{rows} rows · {cols} columns · {size}',
  'parse.truncated': ' · truncated',

  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.appearance.hint': 'Light, system, or dark theme',
  'settings.language': 'Language',
  'settings.language.hint': 'Interface language',
  'settings.timezone': 'Display time zone',
  'settings.timezone.hint': 'Applied to date cells and chart buckets',
  'settings.alerts': 'Live-tail alerts',
  'settings.alerts.hint': 'Notify on high-severity findings while tailing a file',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.tailBuffer': 'Live-tail buffer',
  'settings.tailBuffer.hint':
    'Keep only the newest N rows while tailing (bounds memory on long tails)',
  'settings.tailBuffer.unlimited': 'Unlimited',
  'settings.tailBuffer.last': 'Last {n}',
  'settings.saved.title': 'Saved locally in this browser',
  'settings.saved.body':
    'Column types, computed columns, saved views, theme and time zone are remembered on this device only — your data itself never leaves the browser. {count} settings stored.',
  'settings.saved.clear': 'Clear saved preferences',
  'settings.saved.confirm': 'Clear everything and reload?',
  'settings.saved.confirmClear': 'Clear',
  'settings.saved.cancel': 'Cancel',

  'shortcuts.title': 'Keyboard shortcuts',
  'shortcuts.help': 'Show this help',
  'shortcuts.close': 'Close a dialog or the row detail',
  'shortcuts.prevNext': 'Previous / next row (in the row detail)',
  'shortcuts.open': 'Open the focused row’s detail',
  'shortcuts.secondarySort': 'Add a secondary sort (table header)',
  'shortcuts.tab': 'Move between controls (dialogs trap focus)',
} as const;

export type TKey = keyof typeof en;

/** German catalog — must cover every key in `en` (enforced by the type). */
export const de: Record<TKey, string> = {
  'app.tagline': 'Datenschutz-first, lokaler CSV- & Log-Analyzer',

  'header.settings': 'Einstellungen',
  'header.shortcuts': 'Tastaturkürzel',

  'empty.customLog.prompt': 'Unstrukturiertes Log (Nginx, Apache, syslog…)?',
  'empty.customLog.action': 'Eigenes Log-Format erstellen',
  'empty.audit.prompt': 'Server-Konfiguration (SSH, INI…)?',
  'empty.audit.action': 'Auf Härtungsprobleme prüfen',
  'empty.tail.prompt': 'Ein Log, das ständig wächst?',
  'empty.tail.action': 'Live mitverfolgen',
  'empty.samples.heading': 'Oder ein Beispiel testen — nichts wird hochgeladen',

  'common.close': 'Schließen',
  'common.clear': 'Leeren',

  'workspace.mode.analyze': 'Analysieren',
  'workspace.mode.compare': 'Vergleichen',
  'workspace.rowsTitle': '{name} · {rows} Zeilen',
  'workspace.remove': '{name} entfernen',
  'workspace.parsing': 'Wird geparst… {progress}%',
  'workspace.addFile': '+ Datei hinzufügen',
  'workspace.customLog': '+ Eigenes Log',
  'workspace.auditConfig': '+ Config prüfen',
  'workspace.tailFile': '+ Datei tailen (live)',

  'dropzone.aria': 'Eine CSV- oder Log-Datei hochladen',
  'dropzone.parsing': 'Datei wird geparst…',
  'dropzone.title': 'CSV- oder Log-Datei hier ablegen',
  'dropzone.orPrefix': 'oder ',
  'dropzone.browse': 'durchsuchen',
  'dropzone.orSuffix': ' zum Hochladen',
  'dropzone.privacy': '{types} — 100% lokal verarbeitet, nichts verlässt deinen Browser',

  'parse.failed': 'Datei konnte nicht geparst werden',
  'parse.summary': '{rows} Zeilen · {cols} Spalten · {size}',
  'parse.truncated': ' · gekürzt',

  'settings.title': 'Einstellungen',
  'settings.appearance': 'Darstellung',
  'settings.appearance.hint': 'Helles, System- oder dunkles Design',
  'settings.language': 'Sprache',
  'settings.language.hint': 'Sprache der Oberfläche',
  'settings.timezone': 'Anzeige-Zeitzone',
  'settings.timezone.hint': 'Gilt für Datumszellen und Chart-Buckets',
  'settings.alerts': 'Live-Tail-Warnungen',
  'settings.alerts.hint':
    'Bei Funden hoher Schwere benachrichtigen, während eine Datei getailt wird',
  'settings.on': 'An',
  'settings.off': 'Aus',
  'settings.tailBuffer': 'Live-Tail-Puffer',
  'settings.tailBuffer.hint':
    'Nur die neuesten N Zeilen behalten (begrenzt den Speicher bei langen Tails)',
  'settings.tailBuffer.unlimited': 'Unbegrenzt',
  'settings.tailBuffer.last': 'Letzte {n}',
  'settings.saved.title': 'Lokal in diesem Browser gespeichert',
  'settings.saved.body':
    'Spaltentypen, berechnete Spalten, gespeicherte Ansichten, Design und Zeitzone werden nur auf diesem Gerät gemerkt — deine Daten selbst verlassen den Browser nie. {count} Einstellungen gespeichert.',
  'settings.saved.clear': 'Gespeicherte Einstellungen löschen',
  'settings.saved.confirm': 'Alles löschen und neu laden?',
  'settings.saved.confirmClear': 'Löschen',
  'settings.saved.cancel': 'Abbrechen',

  'shortcuts.title': 'Tastaturkürzel',
  'shortcuts.help': 'Diese Hilfe anzeigen',
  'shortcuts.close': 'Einen Dialog oder die Zeilendetails schließen',
  'shortcuts.prevNext': 'Vorherige / nächste Zeile (in den Zeilendetails)',
  'shortcuts.open': 'Details der fokussierten Zeile öffnen',
  'shortcuts.secondarySort': 'Sekundäre Sortierung hinzufügen (Tabellenkopf)',
  'shortcuts.tab': 'Zwischen Steuerelementen wechseln (Dialoge fangen den Fokus)',
};

export const translations: Record<Lang, Record<TKey, string>> = { en, de };

/**
 * Resolves a key for a language, falling back to English then the key itself,
 * and fills `{name}` placeholders. Pure — the context layers React on top.
 */
export function translate(
  lang: Lang,
  key: TKey,
  vars?: Record<string, string | number>,
): string {
  let s: string = translations[lang]?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
