/**
 * CivicPulse AI — Angular Standalone Application Bootstrap
 * ========================================================
 * Bootstraps root Angular application component using standalone provider config.
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
