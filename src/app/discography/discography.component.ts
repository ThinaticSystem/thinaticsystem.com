import { HttpClient, HttpHeaders } from '@angular/common/http';
import {Component, OnDestroy, OnInit} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import {Discography} from "../interfaces/discography";
import {LoadingService} from "../service/loading.service";
import {NavigateService} from "../service/navigate.service";


@Component({
  selector: 'app-discography',
  templateUrl: './discography.component.html',
  styleUrls: ['./discography.component.scss']
})
export class DiscographyComponent implements OnInit, OnDestroy {
  discographies!: Discography[];
  environment = environment;
  loadedImages = 0;

  constructor(
    private httpClient: HttpClient,
    private titleService: Title,
    public loadingService: LoadingService,
    public navigate: NavigateService,
  ) { }

  ngOnInit(): void {
    this.titleService.setTitle('Discography | しなちくシステム');
    this.httpClient.get<Discography[]>(`${environment.cmsUrl}/discographies`)
    .subscribe((data) => {
      this.discographies = data;
    });
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }

  imageLoaded(): void {
    this.loadedImages++;
    if (this.loadedImages === this.discographies.length) {
      this.loadingService.loading = false;
    }
  }

}
