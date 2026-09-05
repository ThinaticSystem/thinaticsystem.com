import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { LoadingService } from "../../services/loading.service";
import { NavigateService } from "../../services/navigate.service";

@Component({
  standalone: true,
  selector: 'app-index',
  templateUrl: './index.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./index.component.scss'],
  imports: [RouterLink],
})
export default class IndexComponent implements OnInit, OnDestroy {
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
