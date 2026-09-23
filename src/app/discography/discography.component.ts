import {DatePipe} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Component, signal, ChangeDetectionStrategy} from '@angular/core';
import type {OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {RouterLink} from '@angular/router';
import {NgPipesModule} from 'ngx-pipes';
import {Subscription} from 'rxjs';
import {environment} from 'src/environments/environment';
import type {Discography} from '../interfaces/discography';
import {LoadingService} from '../services/loading.service';

@Component({
  selector: 'app-discography',
  templateUrl: './discography.component.html',
  styleUrls: ['./discography.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [DatePipe, NgPipesModule, RouterLink]
})
export default class DiscographyComponent implements OnInit, OnDestroy {
  #request: Subscription | null = null;
  #settledImages = new Set<EventTarget>();
  #destroyed = false;
  discographies = signal<Discography[] | null>(null);
  error = signal(false);
  environment = environment;

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    public loadingService: LoadingService,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Discography | しなちくシステム');
    this.loadDiscographies();
  }

  loadDiscographies(): void {
    if (this.#destroyed) return;
    this.#request?.unsubscribe();
    this.#settledImages.clear();
    this.discographies.set(null);
    this.error.set(false);
    this.loadingService.loading = true;
    this.#request = this.httpClient.get<Discography[]>(`${environment.cmsUrl}/discographies`).subscribe({
      next: data => {
        this.discographies.set(data);
        if (data.length === 0) this.loadingService.loading = false;
      },
      error: () => {
        this.error.set(true);
        this.loadingService.loading = false;
      },
    });
  }

  /** Each current image can settle only once, whether decoded or failed. */
  imageLoaded(data: Discography, event: Event): void {
    const image = event.currentTarget;
    const releases = this.discographies();
    if (this.#destroyed || !image || !releases?.includes(data) || this.#settledImages.has(image)) return;
    this.#settledImages.add(image);
    if (this.#settledImages.size === releases.length) this.loadingService.loading = false;
  }

  ngOnDestroy(): void {
    this.#destroyed = true;
    this.#request?.unsubscribe();
    this.#settledImages.clear();
  }
}
