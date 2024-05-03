import { provideHttpClient } from "@angular/common/http";
import { ApplicationConfig } from "@angular/core";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { MARKED_OPTIONS, provideMarkdown } from "ngx-markdown";
import { markedOptionsFactory } from "./providers/markdown/options";
import { routes } from "./app.routes";

/** スクロールしたらトップに戻る設定 */
const InMemoryScrollingFeature = withInMemoryScrolling({
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled',
});

export const appConfig = {
    providers: [
        provideRouter(routes, InMemoryScrollingFeature),
        provideHttpClient(),
        provideMarkdown({
            markedOptions: {
                provide: MARKED_OPTIONS,
                useFactory: markedOptionsFactory,
            },
        }),
    ],
} satisfies ApplicationConfig;
