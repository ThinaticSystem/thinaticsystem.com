import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { NgxPaginationModule } from "ngx-pagination";
import { NgPipesModule } from "ngx-pipes";
import { Subject, takeUntil, tap } from 'rxjs';
import { BlogCardComponent } from "src/app/components/blog-card/blog-card.component";
import { environment } from "../../../environments/environment";
import { Blog } from "../../interfaces/blog";
import { LoadingService } from "../../services/loading.service";
import { NavigateService } from "../../services/navigate.service";

@Component({
  standalone: true,
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
  imports: [
    CommonModule,
    NgPipesModule,
    BlogCardComponent,
    NgxPaginationModule,
  ],
})
export default class IndexComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>();

  blogs = signal<Blog[] | null>(null);
  environment = environment;

  // ページ設定部分
  ITEMS_PER_PAGE = 6;
  page = 1;
  totalItems = signal<null | number>(null);

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    public navigate: NavigateService,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('しなちくシステム');

    this.#fetchPage(1)
      .pipe(
        tap((data) => {
          this.blogs.set(data);
        }),
      )
      .subscribe();

    this.#fetchTotalItems()
      .pipe(
        tap(((count) => {
          this.totalItems.set(count)
        })),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.#dispose$.next(null);
  }

  loadPage(page: number) {
    this.#fetchPage(page)
      .pipe(tap((data) => {
        this.blogs.set(data)
      }))
      .subscribe();
  }

  #fetchPage(page: number) {
    this.loadingService.loading = true;

    const queryParams = `${[
      '_sort=published_at:desc',
      `_limit=${this.ITEMS_PER_PAGE}`,
      `_start=${this.ITEMS_PER_PAGE * (page - 1)}`,
    ].join('&')}`;
    return this.httpClient.get<Blog[]>(`${environment.cmsUrl}/blogs?${queryParams}`)
      .pipe(
        tap(() => {
          this.loadingService.loading = false;
        }),
        takeUntil(this.#dispose$),
      );
  }

  #fetchTotalItems() {
    return this.httpClient.get<number>(`${environment.cmsUrl}/blogs/count`)
      .pipe(
        takeUntil(this.#dispose$),
      );
  }
}
