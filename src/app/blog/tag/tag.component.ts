import { Component, OnInit } from '@angular/core';
import { environment } from "../../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Title } from "@angular/platform-browser";
import { LoadingService } from "../../services/loading.service";
import { NavigateService } from "../../services/navigate.service";
import { Blog } from "../../interfaces/blog";
import { ActivatedRoute } from "@angular/router";
import { filter, from, mergeMap, tap } from 'rxjs';

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
export class TagComponent implements OnInit {
  blogs: Blog[] = [];
  environment = environment;
  tag: string | null = "";

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
    this.tag = this.route.snapshot.paramMap.get('tag');

    // なんらかの理由でタグが存在しない場合はブログトップへ
    if (this.tag === null) {
      this.navigate.go('/blog');
      return;
    }

    // ブログ情報の取得
    this.httpClient.get<Blog[]>(`${environment.cmsUrl}/blogs`)
      .pipe(
        // Blog[]のストリームをBlogのストリームへ変換
        mergeMap((list) => from(list)),
        // タグが合致するものだけに絞る
        filter((blog) =>
          blog.blogTags?.some(
            tagEntry => tagEntry?.tag === this.tag!
          ) ?? false
        ),
        tap((blog) => this.blogs.push(blog)),
      )
      .subscribe((_data) => {
        this.loadingService.loading = false;
      });
  }
}
