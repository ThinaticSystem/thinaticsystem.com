import { HttpClient } from '@angular/common/http';
import {Component, OnDestroy, OnInit} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import {LoadingService} from "../service/loading.service";
import {NavigateService} from "../service/navigate.service";

export interface Notifications {
  title: string;
  url: string;
  published_at: string;
}

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit, OnDestroy {
  notifications!: Notifications[];

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    public loadingService: LoadingService,
    public navigate: NavigateService,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('しなちくシステム');

    this.httpClient.get<Notifications[]>(`${environment.cmsUrl}/notifications`)
    .subscribe((data) => {
      this.notifications = data;

      setTimeout(() => {
        this.loadingService.loading = false;
      }, 500);
    });
  }
  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
