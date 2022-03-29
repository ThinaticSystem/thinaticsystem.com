import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IndexRoutingModule } from './index-routing.module';
import { IndexComponent } from './index.component';
import { HttpClientModule } from '@angular/common/http';


@NgModule({
  declarations: [
    IndexComponent
  ],
  imports: [
    CommonModule,
    IndexRoutingModule,
    HttpClientModule,
  ]
})
export class IndexModule { }
