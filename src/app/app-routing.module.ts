import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./index/index.component'),
  }, {
    path: 'about',
    loadChildren: () => import('./about/about.module').then(m => m.AboutModule)
  }, {
    path: 'blog',
    loadChildren: () => import('./blog/blog.module').then(m => m.BlogModule)
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
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {scrollPositionRestoration: 'top'})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
