import {Component, OnDestroy, OnInit} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {LoadingService} from "../../service/loading.service";

@Component({
  selector: 'app-honi',
  templateUrl: './honi.component.html',
  styleUrls: ['./honi.component.scss']
})
export class HoniComponent implements OnInit, OnDestroy {

  constructor(
    private titleService: Title,
    public loadingService: LoadingService,
  ) {
  }

  ngOnInit(): void {
    this.titleService.setTitle('ほに-用語集 | しなちくシステム');
    setTimeout(() => {
      this.loadingService.loading = false;
    }, 500);
  }

  ngOnDestroy(): void {
    this.loadingService.loading = true;
  }
}
