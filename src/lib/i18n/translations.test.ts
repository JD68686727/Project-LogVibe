import { describe, it, expect } from 'vitest';
import { translate, en, de } from './translations';

describe('translate', () => {
  it('returns the string for the active language', () => {
    expect(translate('en', 'header.settings')).toBe('Settings');
    expect(translate('de', 'header.settings')).toBe('Einstellungen');
  });

  it('interpolates {placeholders}', () => {
    expect(translate('en', 'settings.tailBuffer.last', { n: '50,000' })).toBe(
      'Last 50,000',
    );
    expect(translate('de', 'settings.saved.body', { count: 3 })).toContain(
      '3 Einstellungen',
    );
  });

  it('has a German entry for every English key (catalogs in lockstep)', () => {
    const enKeys = Object.keys(en).sort();
    const deKeys = Object.keys(de).sort();
    expect(deKeys).toEqual(enKeys);
    // no empty translations
    expect(Object.values(de).every((v) => v.length > 0)).toBe(true);
  });
});
