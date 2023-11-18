import { provideHttpClient } from "@angular/common/http";
import { ApplicationConfig } from "@angular/core";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { routes } from "./routes";

/** スクロールしたらトップに戻る設定 */
const InMemoryScrollingFeature = withInMemoryScrolling({
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled',
});

export const appConfig = {
    providers: [
        provideRouter(routes, InMemoryScrollingFeature),
        provideHttpClient(),
        // provideMarkdown(),
    ],
} satisfies ApplicationConfig;
