import { Routes } from '@angular/router';

const routes = [
  {
    path: '',
    loadComponent: () => import('./index/index.component'),
  }, {
    path: 'honi',
    loadComponent: () => import('./honi/honi.component'),
  }, {
    path: 'gomamayo',
    loadComponent: () => import('./gomamayo/gomamayo.component'),
  }
] satisfies Routes;
export default routes;
