import {AsyncPipe, DatePipe} from '@angular/common';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Component, inject, signal, ChangeDetectionStrategy} from '@angular/core';
import type {OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {MarkdownPipe} from 'ngx-markdown';
import {distinctUntilChanged, finalize, map, Subscription} from 'rxjs';
import {ShareComponent} from 'src/app/components/share/share.component';
import {environment} from '../../../environments/environment';
import type {Blog} from '../../interfaces/blog';
import {LoadingService} from '../../services/loading.service';
import {NavigateService} from '../../services/navigate.service';

@Component({
  selector: 'app-article',
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [AsyncPipe, DatePipe, RouterLink, ShareComponent, MarkdownPipe]
})
export default class ArticleComponent implements OnInit, OnDestroy {
  readonly #route = inject(ActivatedRoute);
  readonly #httpClient = inject(HttpClient);
  readonly #titleService = inject(Title);
  readonly #navigate = inject(NavigateService);
  readonly #loadingService = inject(LoadingService);
  #routeSubscription: Subscription | null = null;
  #request: Subscription | null = null;
  #id: string | null = null;
  #destroyed = false;
  blog = signal<Blog | null>(null);
  error = signal(false);
  environment = environment;
  url = location.href;

  ngOnInit(): void {
    this.#routeSubscription = this.#route.paramMap.pipe(
      map(params => params.get('id')),
      distinctUntilChanged(),
    ).subscribe(id => {
      this.#id = id;
      this.loadArticle();
    });
  }

  /** Replacement cancels all outgoing content, title and error effects. */
  loadArticle(): void {
    if (this.#destroyed) return;
    this.#request?.unsubscribe();
    this.blog.set(null);
    this.error.set(false);
    this.#titleService.setTitle('ブログ | しなちくシステム');
    if (!this.#id) {
      this.#navigate.go('/404');
      this.#loadingService.loading = false;
      return;
    }
    this.url = new URL(`/blog/article/${encodeURIComponent(this.#id)}`, location.origin).href;
    this.#loadingService.loading = true;
    this.#request = this.#httpClient.get<Blog>(`${environment.cmsUrl}/blogs/${encodeURIComponent(this.#id)}`)
      .pipe(finalize(() => {if (!this.#destroyed) this.#loadingService.loading = false;}))
      .subscribe({
        next: data => {
          this.blog.set(data);
          this.#titleService.setTitle(`${data.title} | しなちくシステム`);
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) this.#navigate.go('/404');
          else this.error.set(true);
        },
      });
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    this.#routeSubscription?.unsubscribe();
    this.#request?.unsubscribe();
  }
}
