import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { SanitizeHtmlPipe } from './sanitize-html.pipe';

describe('SanitizeHtmlPipe', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('create an instance', () => {
    const domSanitizer = TestBed.inject(DomSanitizer);
    const pipe = new SanitizeHtmlPipe(domSanitizer);
    expect(pipe).toBeTruthy();
  });

  it('preserves legitimate embedded content', () => {
    const domSanitizer = TestBed.inject(DomSanitizer);
    const pipe = new SanitizeHtmlPipe(domSanitizer);
    const content = '<p>fixture</p><iframe src="https://player.example.test/embed/1"></iframe>';

    expect(String(pipe.transform(content))).toContain(content);
  });


});
