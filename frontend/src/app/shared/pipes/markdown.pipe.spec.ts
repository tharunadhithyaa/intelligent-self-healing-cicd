import { describe, it, expect } from 'vitest';
import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  const pipe = new MarkdownPipe();

  it('should return empty string for empty or undefined input', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  describe('Normal Markdown Rendering', () => {
    it('should convert markdown headers', () => {
      const result = pipe.transform('# Hello World');
      expect(result).toContain('<h1>Hello World</h1>');
    });

    it('should convert bold text', () => {
      const result = pipe.transform('**bold text**');
      expect(result).toContain('<strong>bold text</strong>');
    });

    it('should convert standard markdown links', () => {
      const result = pipe.transform('[Google](https://google.com)');
      expect(result).toContain('<a href="https://google.com">Google</a>');
    });

    it('should convert unordered lists', () => {
      const result = pipe.transform('- Item 1\n- Item 2');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
    });

    it('should convert code blocks', () => {
      const result = pipe.transform('```js\nconst x = 42;\n```');
      expect(result).toContain('<pre><code class="language-js">');
      expect(result).toContain('const x = 42;');
    });
  });

  describe('Security Sanitization', () => {
    it('should sanitize <script> payloads', () => {
      const payload = '<script>alert("xss")</script>';
      const result = pipe.transform(payload);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert(');
    });

    it('should strip onerror, onload, and onclick event attributes', () => {
      const payload = '<img src="x" onerror="alert(1)"> <svg onload="alert(2)"> <b onclick="alert(3)">click</b>';
      const result = pipe.transform(payload);
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('onload');
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('alert');
    });

    it('should sanitize javascript: URLs', () => {
      const htmlPayload = '<a href="javascript:alert(1)">Evil link</a>';
      const markdownPayload = '[Evil link](javascript:alert(1))';

      const resultHtml = pipe.transform(htmlPayload);
      const resultMd = pipe.transform(markdownPayload);

      expect(resultHtml).not.toContain('href="javascript:');
      expect(resultMd).not.toContain('href="javascript:');
    });

    it('should remove iframe, object, and embed elements', () => {
      const payload = '<iframe src="https://evil.com"></iframe><object data="evil.swf"></object><embed src="evil.swf">';
      const result = pipe.transform(payload);
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
    });
  });
});

