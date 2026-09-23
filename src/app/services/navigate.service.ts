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

  go(page: string): Promise<boolean> {
    if (this.router.url === page) {
      return Promise.resolve(false);
    }

    // NOTE: Router events own pending navigation and error cleanup, not an animation timer.
    return this.router.navigate([page]).catch(() => false);
  }
}
