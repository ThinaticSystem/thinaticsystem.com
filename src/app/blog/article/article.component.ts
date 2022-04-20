import {Component, OnInit} from '@angular/core';
import {ActivatedRoute} from "@angular/router";
import {Blog} from "../../interfaces/blog";
import {environment} from "../../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {Title} from "@angular/platform-browser";
import {LoadingService} from "../../services/loading.service";
import {NavigateService} from "../../services/navigate.service";

@Component({
  selector: 'app-article',
  templateUrl: './article.component.html',
  styleUrls: ['./article.component.scss']
})
export class ArticleComponent implements OnInit {
  blog!: Blog;
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
      .subscribe((data) => {
        this.blog = data;
        this.titleService.setTitle(`${this.blog.title} | しなちくシステム`);
        this.loadingService.loading = false;
      });

  }

}
