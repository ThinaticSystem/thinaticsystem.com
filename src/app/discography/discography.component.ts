import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { NgPipesModule } from 'ngx-pipes';
import { Subject, takeUntil, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Discography } from "../interfaces/discography";
import { LoadingService } from "../services/loading.service";
import { NavigateService } from "../services/navigate.service";

@Component({
    selector: 'app-discography',
    templateUrl: './discography.component.html',
    styleUrls: ['./discography.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        CommonModule,
        NgPipesModule,
        RouterLink,
    ]
})
export default class DiscographyComponent implements OnInit, OnDestroy {
  #dispose$ = new Subject<null>();

  discographies = signal<Discography[] | null>(null);
  environment = environment;
  loadedImages = 0;

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    public loadingService: LoadingService,
    public navigate: NavigateService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('Discography | しなちくシステム');
    this.httpClient.get<Discography[]>(`${environment.cmsUrl}/discographies`)
      .pipe(
        tap((data) => {
          this.discographies.set(data);
        }),
        takeUntil(this.#dispose$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;

    this.#dispose$.next(null);
  }

  imageLoaded(): void {
    this.loadedImages++;
    if (this.loadedImages === this.discographies()!.length) {
      this.loadingService.loading = false;
    }
  }
}
