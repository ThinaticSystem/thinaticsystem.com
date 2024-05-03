import { Routes } from '@angular/router';

const routes = [
  {
    path: '',
    loadComponent: () => import('./discography.component'),
  },
  {
    path: '',
    loadChildren: () => import('./detail/detail.routes')
  }
] satisfies Routes;
export default routes;
