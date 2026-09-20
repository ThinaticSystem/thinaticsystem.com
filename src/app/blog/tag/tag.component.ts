import {HttpClient} from '@angular/common/http';
import {Component, inject, signal, ChangeDetectionStrategy} from '@angular/core';
import type {OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {ActivatedRoute, Router, RouterLink} from '@angular/router';
import {NgxPaginationModule} from 'ngx-pagination';
import {NgPipesModule} from 'ngx-pipes';
import {combineLatest, finalize, Subscription} from 'rxjs';
import {BlogCardComponent} from 'src/app/components/blog-card/blog-card.component';
import {environment} from '../../../environments/environment';
import type {Blog} from '../../interfaces/blog';
import {LoadingService} from '../../services/loading.service';
import {NavigateService} from '../../services/navigate.service';
import {readBlogPage} from '../index/page';

@Component({
  selector: 'app-index',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [NgPipesModule, BlogCardComponent, NgxPaginationModule, RouterLink]
})
export default class TagComponent implements OnInit, OnDestroy {
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #http = inject(HttpClient);
  readonly #title = inject(Title);
  readonly #navigate = inject(NavigateService);
  readonly #loading = inject(LoadingService);
  #routeSubscription: Subscription | null = null;
  #request: Subscription | null = null;
  #destroyed = false;
  blogs = signal<Blog[] | null>(null);
  error = signal(false);
  tag = signal<string | null>(null);
  page = signal(1);

  ngOnInit(): void {
    this.#routeSubscription = combineLatest([this.#route.paramMap, this.#route.queryParamMap]).subscribe(([params, query]) => {
      const state = readBlogPage(query.get('page'));
      this.page.set(state.page);
      if (state.invalid) this.changePage(1, true);
      const tag = params.get('tag');
      if (tag === this.tag()) return;
      this.tag.set(tag);
      this.loadTag();
    });
    if (this.tag() === null) this.#navigate.go('/blog');
  }

  /** Query-only history reuses the loaded tag data; a new tag cancels the outgoing owner. */
  loadTag(): void {
    if (this.#destroyed) return;
    this.#request?.unsubscribe();
    this.blogs.set(null);
    this.error.set(false);
    const tag = this.tag();
    if (tag === null) return;
    this.#title.setTitle(`${tag} | ブログ | しなちくシステム`);
    this.#loading.loading = true;
    this.#request = this.#http.get<Blog[]>(`${environment.cmsUrl}/blogs`)
      .pipe(finalize(() => {if (!this.#destroyed) this.#loading.loading = false;}))
      .subscribe({
        next: articles => this.blogs.set(articles.filter(article => article.blogTags?.some(entry => entry?.tag === tag) ?? false)),
        error: () => this.error.set(true),
      });
  }

  changePage(page: number, replaceUrl = false): void {
    if (this.#destroyed || readBlogPage(String(page)).invalid) return;
    // NOTE: the router owns history; rejection remains an actionable local failure.
    void this.#router.navigate([], {relativeTo: this.#route, queryParams: {page: page === 1 ? null : page},
      queryParamsHandling: 'merge', preserveFragment: true, replaceUrl}).catch(() => this.error.set(true));
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    this.#routeSubscription?.unsubscribe();
    this.#request?.unsubscribe();
  }
}
