import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | undefined): SafeHtml {
    if (!value) return '';

    // Parse markdown to HTML
    const rawHtml = marked.parse(value) as string;

    // Sanitize the HTML
    const cleanHtml = DOMPurify.sanitize(rawHtml);

    // Return safe HTML to Angular
    return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
  }
}
