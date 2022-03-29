import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ClipboardService } from 'ngx-clipboard';

export interface Sangyo {
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
  text: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  sangyo!: Sangyo;
  cookie = false;

  constructor(
    private httpClient: HttpClient,
    private _clipboardService: ClipboardService,
  ) {}

  ngOnInit(): void {
    this.httpClient.get<Sangyo>('https://thinaticsystem-web.microcms.io/api/v1/sangyo', { headers: new HttpHeaders({ 'x-api-key': environment.apiKey }) })
      .subscribe((data) => {
        this.sangyo = data;
      });
  }

  share(): void {
    this._clipboardService.copy(document.title + '\n' + location.href);
    alert('コピーしました');
  }
}
