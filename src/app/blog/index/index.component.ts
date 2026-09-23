import {HttpClient} from '@angular/common/http';
import {Component, inject, signal, ChangeDetectionStrategy} from '@angular/core';
import type {OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {NgxPaginationModule} from 'ngx-pagination';
import {finalize, Subscription} from 'rxjs';
import {BlogCardComponent} from 'src/app/components/blog-card/blog-card.component';
import {environment} from '../../../environments/environment';
import type {Blog} from '../../interfaces/blog';
import {LoadingService} from '../../services/loading.service';
import {readBlogPage} from './page';

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [BlogCardComponent, NgxPaginationModule, RouterLink]
})
export default class IndexComponent implements OnInit, OnDestroy {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  #routeSubscription: Subscription | null = null;
  #urlPage: number | null = null;
  #pageRequest: Subscription | null = null;
  #countRequest: Subscription | null = null;
  #destroyed = false;
  blogs = signal<Blog[] | null>(null);
  error = signal(false);
  countError = signal(false);
  ITEMS_PER_PAGE = 6;
  page = 1;
  totalItems = signal<number | null>(null);

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    public loadingService: LoadingService,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('ブログ | しなちくシステム');
    this.#routeSubscription = this.#route.queryParamMap.subscribe(query => {
      const state = readBlogPage(query.get('page'));
      if (state.invalid) this.changePage(1, true);
      if (this.#urlPage === state.page) return;
      this.#urlPage = state.page;
      this.loadPage(state.page);
    });
    this.loadCount();
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    this.#routeSubscription?.unsubscribe();
    this.#pageRequest?.unsubscribe();
    this.#countRequest?.unsubscribe();
  }

  /** Only the current page owns its data and loading completion. */
  changePage(page: number, replaceUrl = false): void {
    if (this.#destroyed || readBlogPage(String(page)).invalid) return;
    // NOTE: page changes belong to browser history; unrelated inbound query and fragment survive.
    void this.#router.navigate([], {relativeTo: this.#route, queryParams: {page: page === 1 ? null : page},
      queryParamsHandling: 'merge', preserveFragment: true, replaceUrl}).catch(() => this.error.set(true));
  }

  /** Only the current request owns data and loading completion; retry does not add history. */
  loadPage(page: number): void {
    if (this.#destroyed || !Number.isInteger(page) || page < 1) return;
    // NOTE: finish the outgoing request before the new one acquires loading.
    this.#pageRequest?.unsubscribe();
    this.page = page;
    this.blogs.set(null);
    this.error.set(false);
    this.loadingService.loading = true;
    const query = `_sort=published_at:desc&_limit=${this.ITEMS_PER_PAGE}&_start=${this.ITEMS_PER_PAGE * (page - 1)}`;
    this.#pageRequest = this.httpClient.get<Blog[]>(`${environment.cmsUrl}/blogs?${query}`)
      .pipe(finalize(() => {if (!this.#destroyed) this.loadingService.loading = false;}))
      .subscribe({
        next: data => this.blogs.set(data),
        error: () => this.error.set(true),
      });
  }

  /** A count failure must not discard a successfully loaded page. */
  loadCount(): void {
    if (this.#destroyed) return;
    this.#countRequest?.unsubscribe();
    this.countError.set(false);
    this.#countRequest = this.httpClient.get<number>(`${environment.cmsUrl}/blogs/count`)
      .subscribe({next: count => this.totalItems.set(count), error: () => this.countError.set(true)});
  }
}
