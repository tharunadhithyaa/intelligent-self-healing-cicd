import { describe, it, expect } from 'vitest';
import { MarkdownPipe } from './markdown.pipe';
import { DomSanitizer } from '@angular/platform-browser';

describe('MarkdownPipe', () => {
  const fakeSanitizer: DomSanitizer = {
    bypassSecurityTrustHtml: (val: string) => val as any,
    sanitize: () => '',
    bypassSecurityTrustStyle: () => '' as any,
    bypassSecurityTrustScript: () => '' as any,
    bypassSecurityTrustUrl: () => '' as any,
    bypassSecurityTrustResourceUrl: () => '' as any,
  };

  const pipe = new MarkdownPipe(fakeSanitizer);

  it('should return empty string for empty input', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('should convert markdown headers and sanitize html', () => {
    const result = pipe.transform('# Hello World') as any;
    expect(result).toContain('<h1>Hello World</h1>');
  });

  it('should sanitize script tags from markdown', () => {
    const result = pipe.transform('<script>alert("xss")</script>') as any;
    expect(result).not.toContain('<script>');
  });
});
