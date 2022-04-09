import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./index/index.module').then(m => m.IndexModule)
  }, {
    path: 'about',
    loadChildren: () => import('./about/about.module').then(m => m.AboutModule)
  }, {
    path: 'discography',
    loadChildren: () => import('./discography/discography.module').then(m => m.DiscographyModule)
  }, {
    path: 'glossary',
    loadChildren: () => import('./glossary/glossary.module').then(m => m.GlossaryModule)
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'top' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
