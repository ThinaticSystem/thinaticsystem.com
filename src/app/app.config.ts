import { provideHttpClient } from "@angular/common/http";
import { ApplicationConfig } from "@angular/platform-browser";
import { provideRouter, withInMemoryScrolling } from "@angular/router";
import { provideMarkdown } from "ngx-markdown";
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
        provideMarkdown(),
    ],
} satisfies ApplicationConfig;
