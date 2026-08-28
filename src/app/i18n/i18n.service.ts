import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  AR,
  EN,
  Lang,
  MY_STATUS_I18N,
  TranslationKey,
} from './translations';

const STORAGE_KEY = 'jira-tracker-lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly platformId = inject(PLATFORM_ID);

  readonly lang = signal<Lang>('en');
  readonly isRtl = computed(() => this.lang() === 'ar');
  readonly dir = computed(() => (this.isRtl() ? 'rtl' : 'ltr'));

  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') {
      this.applyLang(saved);
    } else {
      this.applyLang('en');
    }
  }

  setLang(lang: Lang): void {
    this.applyLang(lang);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  }

  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const dict = this.lang() === 'ar' ? AR : EN;
    let text = dict[key] ?? EN[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{{${k}}}`, String(v));
      }
    }
    return text;
  }

  myStatusLabel(value: string): string {
    if (!value) return this.t('status.unset');
    const key = MY_STATUS_I18N[value];
    return key ? this.t(key) : value;
  }

  formatDate(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const isPm = hours >= 12;
    hours = hours % 12 || 12;
    const period =
      this.lang() === 'ar' ? (isPm ? 'م' : 'ص') : isPm ? 'PM' : 'AM';

    return `${day}/${month}/${year} ${hours}:${minutes} ${period}`;
  }

  private applyLang(lang: Lang): void {
    this.lang.set(lang);
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
}
