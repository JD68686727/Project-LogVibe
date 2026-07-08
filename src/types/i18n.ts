/** Supported UI languages. English is the source-of-truth catalog. */
export type Lang = 'en' | 'de';

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
];
