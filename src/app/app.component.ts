import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ClipboardService } from 'ngx-clipboard';

export interface Sangyo {
  sangyo: String;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  sangyo!: Sangyo[];
  cookie = false;

  constructor(
    private httpClient: HttpClient,
    private _clipboardService: ClipboardService,
  ) {}

  ngOnInit(): void {
    this.httpClient.get<Sangyo[]>(`${environment.cmsUrl}/sangyos`)
      .subscribe((data) => {
        this.sangyo = data;
      });
  }

  share(): void {
    this._clipboardService.copy(document.title + '\n' + location.href);
    alert('コピーしました');
  }
}
