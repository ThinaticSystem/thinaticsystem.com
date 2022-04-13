import {Component, OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {LoadingService} from "../service/loading.service";

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit, OnDestroy {

  constructor(
    private titleService: Title,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('しなちくシステムについて | しなちくシステム');

    setTimeout(() => {
      this.loadingService.loading = false;
    }, 500);
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
