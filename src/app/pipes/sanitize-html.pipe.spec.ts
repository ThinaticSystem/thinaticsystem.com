import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { SanitizeHtmlPipe } from './sanitize-html.pipe';

describe('SanitizeHtmlPipe', () => {
  it('create an instance', () => {
    const domSanitizer = TestBed.inject(DomSanitizer);
    const pipe = new SanitizeHtmlPipe(domSanitizer);
    expect(pipe).toBeTruthy();
  });
});
