import { describe, it, expect, vi } from 'vitest';
import { runInInjectionContext, DestroyRef } from '@angular/core';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  const createComponent = (role = 'admin', name = 'Test User') => {
    const mockAuthService: any = {
      userRole: () => role,
      userFullName: () => name,
    };

    const mockDestroyRef = { onDestroy: vi.fn() };

    const mockInjector: any = {
      get: (token: any) => {
        if (token === DestroyRef) return mockDestroyRef;
        return mockAuthService;
      },
    };

    let component!: SidebarComponent;
    runInInjectionContext(mockInjector, () => {
      component = new SidebarComponent(mockAuthService);
    });

    return component;
  };

  it.each([
    ['admin', '/admin/dashboard'],
    ['officer', '/officer/dashboard'],
    ['field_worker', '/field-worker/dashboard'],
  ])('should compute navItems correctly for %s role', (role, expectedRoute) => {
    const sidebar = createComponent(role);
    const items = sidebar.navItems();

    expect(items).toBeDefined();
    expect(items.some((item) => item.route === expectedRoute)).toBe(true);
  });

  it('should compute default navItems for citizen or unknown role', () => {
    const sidebar = createComponent('citizen');
    const items = sidebar.navItems();
    expect(items.some((i) => i.route === '/dashboard')).toBe(true);
  });

  it('should emit toggleSidebar on nav click when screen width is mobile (< 992px)', () => {
    const sidebar = createComponent('citizen');
    const spy = vi.fn();
    sidebar.toggleSidebar.subscribe(spy);

    vi.stubGlobal('innerWidth', 500);
    sidebar.onNavClick();

    expect(spy).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('should NOT emit toggleSidebar on nav click when screen width is desktop (>= 992px)', () => {
    const sidebar = createComponent('citizen');
    const spy = vi.fn();
    sidebar.toggleSidebar.subscribe(spy);

    vi.stubGlobal('innerWidth', 1200);
    sidebar.onNavClick();

    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
