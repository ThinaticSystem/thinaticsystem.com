import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {IndexComponent} from "./index/index.component";
import {ArticleComponent} from "./article/article.component";
import {TagComponent} from "./tag/tag.component";

const routes: Routes = [
  {
    path: '',
    component: IndexComponent
  }, {
    path: 'tag/:tag',
    component: TagComponent
  }, {
    path: 'article/:id',
    component: ArticleComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BlogRoutingModule {
}
