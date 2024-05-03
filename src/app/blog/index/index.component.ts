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
  page = 1;

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    public navigate: NavigateService,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('しなちくシステム');

    this.httpClient.get<Blog[]>(`${environment.cmsUrl}/blogs`)
      .pipe(
        tap((data) => {
          this.blogs.set(data);
        }),
        takeUntil(this.#dispose$),
      )
      .subscribe(() => {
        this.loadingService.loading = false;
      });
  }

  ngOnDestroy(): void {
    this.#dispose$.next(null);
  }
}
