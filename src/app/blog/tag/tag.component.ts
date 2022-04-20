import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {Title} from "@angular/platform-browser";
import {LoadingService} from "../../services/loading.service";
import {NavigateService} from "../../services/navigate.service";
import {Blog} from "../../interfaces/blog";
import {ActivatedRoute} from "@angular/router";

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
      .subscribe((data) => {
        data.forEach((blog) => {
          if (blog.blogTags) {
            blog.blogTags.forEach((blogTag) => {
              if (blogTag?.tag.includes(<string>this.tag)) {
                this.blogs.push(blog);
                console.log(blog);
              }
            });
          }
        });
        this.loadingService.loading = false;
      });
  }
}
