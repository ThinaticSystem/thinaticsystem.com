import { Routes } from "@angular/router";

const routes = [
    {
        path: '',
        loadComponent: () => import('./index/index.component'),
    }, {
        path: 'tag/:tag',
        loadComponent: () => import('./tag/tag.component'),
    }, {
        path: 'article/:id',
        loadComponent: () => import('./article/article.component'),
    }
] satisfies Routes;
export default routes;
