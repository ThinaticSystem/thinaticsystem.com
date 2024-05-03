import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';
import { Subject, takeUntil, tap } from "rxjs";
import { environment } from "../../environments/environment";
import { LoadingService } from "../services/loading.service";

export interface About {
  id: number;
  title: string;
  body: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

@Component({
  standalone: true,
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  imports: [
    MarkdownComponent,
  ],
})
export default class AboutComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>();

  title = signal('');
  body = signal('');

  constructor(
    private titleService: Title,
    private httpClient: HttpClient,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('しなちくシステムについて | しなちくシステム');

    this.httpClient.get<About>(`${environment.cmsUrl}/about`)
      .pipe(
        tap((data) => {
          this.title.set(data.title);
          this.body.set(data.body);
        }),
        takeUntil(this.#dispose$),
      )
      .subscribe(() => {
        setTimeout(() => {
          this.loadingService.loading = false;
        }, 500);
      });
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;

    this.#dispose$.next(null);
  }
}
