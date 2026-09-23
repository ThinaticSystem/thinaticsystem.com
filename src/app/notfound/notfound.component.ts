import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoadingService } from "../services/loading.service";
import { NavigateService } from "../services/navigate.service";

@Component({
  standalone: true,
  selector: 'app-notfound',
  templateUrl: './notfound.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./notfound.component.scss'],
  imports: [RouterLink],
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
