import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {DiscographyComponent} from './discography.component';

const routes: Routes = [
  {
    path: '',
    component: DiscographyComponent
  }, {
    path: '',
    loadChildren: () => import('./detail/detail.module').then(m => m.DetailModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DiscographyRoutingModule {
}
