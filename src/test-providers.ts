import {provideHttpClient} from '@angular/common/http';
import {provideMarkdown} from 'ngx-markdown';
import {provideRouter} from '@angular/router';

export default [
  provideHttpClient(),
  provideMarkdown(),
  provideRouter([]),
];
