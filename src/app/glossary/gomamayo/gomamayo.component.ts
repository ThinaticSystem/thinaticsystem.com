import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { LoadingService } from "../../services/loading.service";

@Component({
  standalone: true,
  selector: 'app-gomamayo',
  templateUrl: './gomamayo.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./gomamayo.component.scss']
})
export default class GomamayoComponent implements OnInit, OnDestroy {
  constructor(
    private titleService: Title,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('ゴママヨ-用語集 | しなちくシステム');

    this.loadingService.loading = false;
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
