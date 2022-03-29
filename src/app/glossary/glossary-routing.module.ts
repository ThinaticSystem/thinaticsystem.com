import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IndexComponent } from './index/index.component';
import { HoniComponent } from './honi/honi.component';
import { GomamayoComponent } from './gomamayo/gomamayo.component';

const routes: Routes = [
  {
    path: '',
    component: IndexComponent
  }, {
    path: 'honi',
    component: HoniComponent
  }, {
    path: 'gomamayo',
    component: GomamayoComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class GlossaryRoutingModule { }
