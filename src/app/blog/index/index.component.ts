import {Component, OnInit} from '@angular/core';
import {environment} from "../../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {Title} from "@angular/platform-browser";
import {LoadingService} from "../../service/loading.service";
import {NavigateService} from "../../service/navigate.service";
import {Blog} from "../../interfaces/blog";

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit {
  blogs!: Blog[];
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
      .subscribe((data) => {
        this.blogs = data;
        this.loadingService.loading = false;
      });
  }
}
