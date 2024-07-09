// app/locales/dictionaries.js
import 'server-only';

const dictionaries = {
  en: () => import('./en/translation.json').then((module) => module.default),
  zh: () => import('./zh/translation.json').then((module) => module.default),
};

export const getDictionary = async (locale) => dictionaries[locale]();
