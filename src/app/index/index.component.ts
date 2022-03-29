import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ClipboardService } from 'ngx-clipboard';
import { environment } from 'src/environments/environment';

export interface News {
  contents?: (ContentsEntity)[] | null;
  totalCount: number;
  offset: number;
  limit: number;
}
export interface ContentsEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  revisedAt: string;
  summary: string;
  url?: string | null;
}

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit {
  news!: News;

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('㈲しなちくシステム');

    this.httpClient.get<News>('https://thinaticsystem-web.microcms.io/api/v1/news', {headers: new HttpHeaders({'x-api-key': environment.apiKey})})
    .subscribe((data) => {
      this.news = data;
    });
  }
}
