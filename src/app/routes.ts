import { Routes } from '@angular/router';

/** ルーティング設定 (最上位) */
export const routes = [
    {
        path: '',
        loadComponent: () => import('./index/index.component'),
    }, {
        path: 'about',
        loadComponent: () => import('./about/about.component'),
    }, {
        path: 'blog',
        loadChildren: () => import('./blog/blog.routes'),
    }, {
        path: 'discography',
        loadChildren: () => import('./discography/discography.module').then(m => m.DiscographyModule)
    }, {
        path: 'glossary',
        loadChildren: () => import('./glossary/glossary.module').then(m => m.GlossaryModule)
    }, {
        path: '404',
        loadChildren: () => import('./notfound/notfound.module').then(m => m.NotfoundModule)
    }, {
        path: '**',
        redirectTo: '404'
    },
] satisfies Routes;
