import { Component, OnDestroy, OnInit } from '@angular/core';
import { LoadingService } from "../services/loading.service";
import { NavigateService } from "../services/navigate.service";

@Component({
  standalone: true,
  selector: 'app-notfound',
  templateUrl: './notfound.component.html',
  styleUrls: ['./notfound.component.scss'],
})
export default class NotfoundComponent implements OnInit, OnDestroy {
  constructor(
    public loadingService: LoadingService,
    public navigate: NavigateService,
  ) {
  }

  ngOnInit(): void {
    this.loadingService.loading = false;
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
