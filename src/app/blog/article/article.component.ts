import { CommonModule } from "@angular/common";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { MarkdownPipe } from "ngx-markdown";
import { Subject, catchError, takeUntil, tap, throwError } from "rxjs";
import { ShareComponent } from "src/app/components/share/share.component";
import { environment } from "../../../environments/environment";
import { Blog } from "../../interfaces/blog";
import { LoadingService } from "../../services/loading.service";
import { NavigateService } from "../../services/navigate.service";

@Component({
  standalone: true,
  selector: 'app-article',
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss'],
  imports: [
    CommonModule,
    RouterLink,
    ShareComponent,
    MarkdownPipe,
  ],
})
export default class ArticleComponent implements OnInit, OnDestroy {
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
        catchError((error) => redirectWhen404(error, this.navigate)),
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

const redirectWhen404 = (error: HttpErrorResponse, navigate: NavigateService) => {
  if (error.status === 404) {
    console.error('No such article', error.error.message);
    navigate.go('/404');
  }
  return throwError(() => error.error);
};
