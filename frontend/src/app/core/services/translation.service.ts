import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  readonly currentLang = signal<'en' | 'ta'>('en');

  private readonly translations = {
    'en': {
      'settings.appearance': 'Appearance',
      'settings.notifications': 'Notifications',
      'settings.privacy': 'Privacy',
      'settings.language': 'Language',
      'settings.accessibility': 'Accessibility',
    },
    'ta': {
      'settings.appearance': 'தோற்றம்',
      'settings.notifications': 'அறிவிப்புகள்',
      'settings.privacy': 'தனியுரிமை',
      'settings.language': 'மொழி',
      'settings.accessibility': 'அணுகல்',
    }
  };

  setLanguage(lang: 'en' | 'ta') {
    this.currentLang.set(lang);
  }

  translate(key: string): string {
    const lang = this.currentLang();
    const dictionary = this.translations[lang] as Record<string, string>;
    return dictionary[key] || key;
  }
}
