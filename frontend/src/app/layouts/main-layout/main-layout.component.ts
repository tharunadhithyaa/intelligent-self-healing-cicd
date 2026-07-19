import { Component, signal, computed, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TopbarComponent } from './topbar/topbar.component';
import { LoadingService } from '../../core/services/loading.service';
import { ChatbotWidgetComponent } from '../../shared/components/chatbot-widget/chatbot-widget.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, ChatbotWidgetComponent, MatProgressBarModule],
  template: `
    <div class="layout" [class.sidebar-open]="sidebarOpen()" [class.sidebar-collapsed]="sidebarCollapsed()">
      <app-sidebar
        [isOpen]="sidebarOpen()"
        [isCollapsed]="sidebarCollapsed()"
        (toggle)="toggleSidebar()"
        (collapse)="toggleCollapse()"
      />

      @if (sidebarOpen() && isMobile()) {
        <div class="layout__backdrop" (click)="closeSidebar()"></div>
      }

      <div class="layout__main">
        <app-topbar
          (menuToggle)="toggleSidebar()"
        />

        <main class="layout__content">
          <div class="layout__content-inner">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>

    <app-chatbot-widget />

    @if (loadingService.isLoading()) {
      <mat-progress-bar mode="indeterminate" class="global-progress-bar"></mat-progress-bar>
    }
  `,
  styles: [`
    @use 'styles/variables' as *;
    @use 'styles/mixins' as *;

    .layout {
      display: flex;
      min-height: 100vh;
      background: $background;

      &__backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: $z-backdrop;
        animation: fadeIn 0.2s ease;
      }

      &__main {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        transition: margin-left $transition-normal;

        @include desktop-only {
          margin-left: $sidebar-width;
        }
      }

      &.sidebar-collapsed &__main {
        @include desktop-only {
          margin-left: $sidebar-collapsed;
        }
      }

      &__content {
        flex: 1;
        overflow-y: auto;
        @include custom-scrollbar;
      }

      &__content-inner {
        @include container;
        padding-top: $spacing-6;
        padding-bottom: $spacing-8;

        @include mobile-only {
          padding-top: $spacing-4;
          padding-bottom: $spacing-6;
        }
      }
    }

    .global-progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: $z-tooltip;
      height: 3px;
    }
  `],
})
export class MainLayoutComponent {
  readonly sidebarOpen = signal(false);
  readonly sidebarCollapsed = signal(false);
  readonly isMobile = signal(window.innerWidth < 992);

  constructor(readonly loadingService: LoadingService) {
    this.updateMobile();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateMobile();
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleCollapse(): void {
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  private updateMobile(): void {
    this.isMobile.set(window.innerWidth < 992);
    if (!this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }
}
