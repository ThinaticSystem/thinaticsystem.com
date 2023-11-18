import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Title } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { Subject, map, takeUntil, tap } from 'rxjs';
import { environment } from "../../../environments/environment";
import { Blog } from "../../interfaces/blog";
import { LoadingService } from "../../services/loading.service";
import { NavigateService } from "../../services/navigate.service";

interface TagFilter {
  blogTags?: (BlogTags | null)[] | null;
}

interface BlogTags {
  tag: string;
}

@Component({
  selector: 'app-index',
  templateUrl: './tag.component.html',
  styleUrls: ['./tag.component.scss']
})
export class TagComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>();

  blogs = signal<Blog[] | null>(null);
  environment = environment;
  tag = "";

  // ページ設定部分
  page = 1;

  constructor(
    private route: ActivatedRoute,
    private httpClient: HttpClient,
    private titleService: Title,
    public navigate: NavigateService,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('しなちくシステム');

    // URLからブログのタグを取得
    const tag = this.route.snapshot.paramMap.get('tag');

    // なんらかの理由でタグが存在しない場合はブログトップへ
    if (tag === null) {
      this.navigate.go('/blog');
      return;
    }
    this.tag = tag;

    // ブログ情報の取得
    this.httpClient.get<Blog[]>(`${environment.cmsUrl}/blogs`)
      .pipe(
        // タグが合致するものだけに絞る
        map((list) =>
          list.filter((article) =>
            article.blogTags?.some(
              tagEntry => tagEntry?.tag === this.tag
            ) ?? false
          )
        ),
        tap((list) => this.blogs.set(list)),
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
