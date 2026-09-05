import { describe, it, expect } from 'vitest';
import { App } from './app';

describe('App Component', () => {
  it('should create the app and have correct title', () => {
    const app = new App();
    expect(app['title']()).toBe('frontend');
  });
});
