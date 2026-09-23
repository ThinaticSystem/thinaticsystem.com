import { HttpClient } from "@angular/common/http";
import { Component, OnDestroy, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';
import { finalize, Subject, takeUntil, tap } from "rxjs";
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
    selector: 'app-about',
    templateUrl: './about.component.html',
    styleUrls: ['./about.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        MarkdownComponent,
    ]
})
export default class AboutComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>();

  error = signal(false);
  title = signal('');
  body = signal('');

  constructor(
    private titleService: Title,
    private httpClient: HttpClient,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    const finishLoading = this.loadingService.beginContentLoad();
    this.titleService.setTitle('しなちくシステムについて | しなちくシステム');

    this.httpClient.get<About>(`${environment.cmsUrl}/about`)
      .pipe(
        tap((data) => {
          this.title.set(data.title);
          this.body.set(data.body);
        }),
        takeUntil(this.#dispose$),
        finalize(finishLoading),
      )
      .subscribe({error: () => this.error.set(true)});
  }

  ngOnDestroy(): void {
    this.#dispose$.next(null);
  }
}
