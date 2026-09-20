import {Pipe, SecurityContext} from '@angular/core';
import type {PipeTransform} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';

@Pipe({standalone: true, name: 'sanitizeHtml'})
export class SanitizeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  /** Generic markup never admits executable content; players use the dedicated allowlist. */
  transform(value: string | null): string {
    if (typeof value !== 'string') return '';
    return this.sanitizer.sanitize(SecurityContext.HTML, value) ?? '';
  }
}
