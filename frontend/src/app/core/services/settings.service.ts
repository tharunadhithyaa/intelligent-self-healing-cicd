import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface AppSettings {
  appearance?: { theme: string; compactMode: boolean };
  notifications?: { email: boolean; sms: boolean; complaints: boolean; system: boolean };
  privacy?: { showProfile: boolean; showContact: boolean };
  language?: { language: string };
  accessibility?: { highContrast: boolean; reducedMotion: boolean; largerText: boolean };
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/citizen/settings`;

  readonly settings = signal<AppSettings>({});

  constructor() {
    this.loadSettings();

    // Listen for OS theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.settings().appearance?.theme === 'system' || !this.settings().appearance?.theme) {
        this.applyThemeAndAccessibility();
      }
    });
  }

  loadSettings() {
    this.http.get<{ success: boolean; data: { settings: AppSettings } }>(this.API_URL).subscribe({
      next: (res) => {
        if (res.success && res.data?.settings) {
          this.settings.set(res.data.settings);
          this.applyThemeAndAccessibility();
        }
      },
      error: (err) => console.error('Failed to load settings', err),
    });
  }

  updateSettings(newSettings: AppSettings) {
    return this.http.put<{ success: boolean; data: { user: any } }>(this.API_URL, newSettings).pipe(
      tap(() => {
        this.settings.set(newSettings);
        this.applyThemeAndAccessibility();
      }),
    );
  }

  downloadAccountData() {
    return this.http.get(`${environment.apiUrl}/citizen/download-data`, {
      responseType: 'blob',
    });
  }

  private applyThemeAndAccessibility() {
    const s = this.settings();
    const html = document.documentElement;

    // Reset all
    html.classList.remove(
      'theme-light',
      'theme-dark',
      'theme-system',
      'theme-green',
      'compact-mode',
      'high-contrast',
      'reduced-motion',
      'large-text',
    );

    const themeStr = s.appearance?.theme || 'system';

    // Persist for index.html FOUT script
    localStorage.setItem('civicpulse-theme', themeStr);

    if (
      themeStr === 'dark' ||
      (themeStr === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      html.classList.add('theme-dark');
    } else if (themeStr === 'light' || themeStr === 'system') {
      html.classList.add('theme-light');
    } else {
      html.classList.add(`theme-${themeStr}`);
    }

    if (s.appearance?.compactMode) {
      html.classList.add('compact-mode');
    }

    // Apply Accessibility
    if (s.accessibility?.highContrast) html.classList.add('high-contrast');
    if (s.accessibility?.reducedMotion) html.classList.add('reduced-motion');
    if (s.accessibility?.largerText) html.classList.add('large-text');
  }
}
