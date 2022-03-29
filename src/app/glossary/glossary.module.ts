import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GlossaryRoutingModule } from './glossary-routing.module';
import { IndexComponent } from './index/index.component';
import { HoniComponent } from './honi/honi.component';
import { GomamayoComponent } from './gomamayo/gomamayo.component';


@NgModule({
  declarations: [
    IndexComponent,
    HoniComponent,
    GomamayoComponent
  ],
  imports: [
    CommonModule,
    GlossaryRoutingModule
  ]
})
export class GlossaryModule { }
