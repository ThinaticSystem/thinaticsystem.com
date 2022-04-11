import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';

export interface Notifications {
  title: String;
  url: String;
}

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit {
  notifications!: Notifications[];

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('㈲しなちくシステム');

    this.httpClient.get<Notifications[]>(`${environment.cmsUrl}/notifications`)
    .subscribe((data) => {
      this.notifications = data;
    });
  }
}
