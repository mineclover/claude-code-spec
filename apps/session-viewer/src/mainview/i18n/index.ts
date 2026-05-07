/**
 * i18n bootstrap for the renderer.
 *
 * The summary-output language toggle in the topbar (en/ko) drives the UI
 * locale through `setRendererLanguage`. We deliberately couple the two so
 * the operator picks one language for both the surface chrome and the
 * model's narrative output — keeping them aligned avoids the surprise of
 * a Korean UI generating English summaries (or vice-versa).
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ko from './locales/ko.json';

export type RendererLanguage = 'en' | 'ko';

export const SUPPORTED_LANGUAGES: readonly RendererLanguage[] = ['en', 'ko'];

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ko: { translation: ko },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  returnNull: false,
});

export function setRendererLanguage(lng: RendererLanguage): void {
  void i18n.changeLanguage(lng);
}

export default i18n;
