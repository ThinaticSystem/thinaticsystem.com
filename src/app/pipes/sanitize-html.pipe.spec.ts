import {TestBed} from '@angular/core/testing';
import {DomSanitizer} from '@angular/platform-browser';
import {vi} from 'vitest';
import {SanitizeHtmlPipe} from './sanitize-html.pipe';

describe('SanitizeHtmlPipe Given the owner is initialized', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      expect(args).toEqual(['WARNING: sanitizing HTML stripped some content, see https://angular.dev/best-practices/security#preventing-cross-site-scripting-xss']);
    });
  });
  afterEach(() => vi.restoreAllMocks());
  const makePipe = () => new SanitizeHtmlPipe(TestBed.inject(DomSanitizer));
  it('When the recorded scenario is exercised Then the contract demonstrates that preserves ordinary non-executable HTML without marking it trusted', () => {
    const value = makePipe().transform('<p>fixture <strong>text</strong></p>');
    expect(value).toBe('<p>fixture <strong>text</strong></p>');
  });
  it('When the recorded scenario is exercised Then the contract demonstrates that [unsafe-html-content] removes executable scripts rather than trusting HTML', () => {
    const value = makePipe().transform('<p>fixture</p><script>unsafe()</script>');
    expect(String(value)).not.toContain('<script>');
  });
  it('When the recorded scenario is exercised Then the contract demonstrates that does not retain event handlers or srcdoc HTML', () => {
    const value = makePipe().transform('<img src="/fixture.png" onerror="unsafe()"><iframe srcdoc="<script>unsafe()</script>"></iframe>');
    expect(String(value)).not.toContain('onerror');
    expect(String(value)).not.toContain('srcdoc');
    expect(String(value)).not.toContain('<iframe');
  });
  it('When the recorded scenario is exercised Then the contract demonstrates that cannot bypass the dedicated player allowlist through generic HTML', () => {
    expect(makePipe().transform('<iframe src="https://player.example.test/embed/1"></iframe>')).toBe('');
  });
});
