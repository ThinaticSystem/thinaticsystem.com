import {Component, OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {LoadingService} from "../service/loading.service";
import {HttpClient} from "@angular/common/http";
import {environment} from "../../environments/environment";

export interface About {
  id: number;
  title: string;
  body: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit, OnDestroy {
  about!: About;

  constructor(
    private titleService: Title,
    private httpClient: HttpClient,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('しなちくシステムについて | しなちくシステム');

    this.httpClient.get<About>(`${environment.cmsUrl}/about`)
      .subscribe((data) => {
        this.about = data;

        setTimeout(() => {
          this.loadingService.loading = false;
        }, 500);
      });
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
