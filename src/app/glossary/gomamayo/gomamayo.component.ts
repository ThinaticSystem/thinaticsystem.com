import {Component, OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {LoadingService} from "../../services/loading.service";

@Component({
  selector: 'app-gomamayo',
  templateUrl: './gomamayo.component.html',
  styleUrls: ['./gomamayo.component.scss']
})
export class GomamayoComponent implements OnInit, OnDestroy {

  constructor(
    private titleService: Title,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('ゴママヨ-用語集 | しなちくシステム');

    setTimeout(() => {
      this.loadingService.loading = false;
    }, 500);
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
