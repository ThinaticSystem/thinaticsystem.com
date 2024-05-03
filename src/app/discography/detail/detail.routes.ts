import { Routes } from '@angular/router';

const routes = [
  {
    path: ':id',
    loadComponent: () => import('./detail.component'),
  }
] satisfies Routes;
export default routes;
