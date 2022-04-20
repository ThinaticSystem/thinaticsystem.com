import {Component, OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {LoadingService} from "../../services/loading.service";
import {NavigateService} from "../../services/navigate.service";

@Component({
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})
export class IndexComponent implements OnInit, OnDestroy {

  constructor(
    private titleService: Title,
    public loadingService: LoadingService,
    public navigate: NavigateService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('用語集 | しなちくシステム');
    setTimeout(() => {
      this.loadingService.loading = false;
    }, 500);
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
