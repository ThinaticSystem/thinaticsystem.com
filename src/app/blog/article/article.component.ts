import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { Subject, takeUntil, tap } from "rxjs";
import { environment } from "../../../environments/environment";
import { Blog } from "../../interfaces/blog";
import { LoadingService } from "../../services/loading.service";
import { NavigateService } from "../../services/navigate.service";

@Component({
  selector: 'app-article',
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss']
})
export class ArticleComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>()

  blog = signal<Blog | null>(null);
  environment = environment;
  url = location.href;

  constructor(
    private route: ActivatedRoute,
    private httpClient: HttpClient,
    private titleService: Title,
    public navigate: NavigateService,
    public loadingService: LoadingService
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('ブログ | しなちくシステム');

    this.httpClient.get<Blog>(`${environment.cmsUrl}/blogs/${this.route.snapshot.paramMap.get('id')}`)
      .pipe(
        tap((data) => {
          this.blog.set(data);
          this.titleService.setTitle(`${data.title} | しなちくシステム`);
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
