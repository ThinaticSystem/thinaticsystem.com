import {Injectable} from '@angular/core';
import {Router} from "@angular/router";
import {LoadingService} from "./loading.service";

@Injectable({
  providedIn: 'root'
})
export class NavigateService {

  constructor(
    private router: Router,
    public loadingService: LoadingService,
  ) {
  }

  go(page: string): void {
    if (this.router.url === page) {
      return;
    }

    this.loadingService.loading = true;

    setTimeout(() => {
      this.router.navigate([page]);
    }, 300);
  }
}
