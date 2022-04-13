import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IndexRoutingModule } from './index-routing.module';
import { IndexComponent } from './index.component';
import { HttpClientModule } from '@angular/common/http';
import {OrderModule} from "ngx-order-pipe";


@NgModule({
  declarations: [
    IndexComponent
  ],
  imports: [
    CommonModule,
    IndexRoutingModule,
    HttpClientModule,
    OrderModule,
  ]
})
export class IndexModule { }
