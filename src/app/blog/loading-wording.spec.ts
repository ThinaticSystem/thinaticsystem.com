import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ActivatedRoute, convertToParamMap} from '@angular/router';
import {render, screen} from '@testing-library/angular';
import {of} from 'rxjs';
import ArticleComponent from './article/article.component';
import TagComponent from './tag/tag.component';
import {environment} from '../../environments/environment';

describe('Given page content is pending', () => {
  afterEach(() => TestBed.resetTestingModule());
  for (const component of [ArticleComponent, TagComponent]) {
    it(component.name + ' keeps pending accessible without visible wording and preserves failure/retry', async () => {
      const params = convertToParamMap({id: '1', tag: 'Music'});
      const {fixture} = await render<unknown>(component, {providers: [provideHttpClient(), provideHttpClientTesting(),
        {provide: ActivatedRoute, useValue: {paramMap: of(params), queryParamMap: of(convertToParamMap({})), snapshot: {paramMap: params}}},
      ]});
      const status = screen.getByRole('status');
      expect(status.textContent).toBe('記事を読み込み中…');
      expect(status.classList.contains('sr-only')).toBe(true);
      const http = TestBed.inject(HttpTestingController);
      http.expectOne(environment.cmsUrl + (component === ArticleComponent ? '/blogs/1' : '/blogs'))
        .flush({}, {status: 503, statusText: 'Unavailable'});
      fixture.detectChanges();
      expect(screen.getByRole('alert').textContent).toContain('記事を読み込めませんでした');
      expect(screen.getByRole('button', {name: '再試行'})).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
      http.verify();
    });
  }
});
