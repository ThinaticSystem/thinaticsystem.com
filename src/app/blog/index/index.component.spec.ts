import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {render} from '@testing-library/angular';
import {provideRouter} from '@angular/router';
import IndexComponent from './index.component';
import {environment} from '../../../environments/environment';

describe('IndexComponent', () => {
  let http: HttpTestingController;
  let component: IndexComponent;
  let fixture: {detectChanges: () => void};

  beforeEach(async () => {
    const rendered = await render(IndexComponent, {
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    component = rendered.fixture.componentInstance;
    fixture = rendered.fixture;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('creates the page after its initial requests settle', () => {
    http.expectOne((request) => request.url.endsWith('/blogs?_sort=published_at:desc&_limit=6&_start=0')).flush([]);
    http.expectOne(`${environment.cmsUrl}/blogs/count`).flush(0);
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });
});
