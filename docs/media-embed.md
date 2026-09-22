# メディアの埋め込み

メディア埋め込みは、CMSに登録された音楽・動画プレーヤーを、許可したURLから表示する処理。
SoundCloud、Spotify、YouTubeのURLを検証して組み直し、サイト側で定義したiframeに渡す。
CMSの`demo.iframe`はURLを取り出すための入力としてだけ使い、実行可能なHTMLとして画面に挿入しない。

## CMS入力から表示まで

`readEmbedHtml`は、長さを制限した文字列を、内容を実行しないtemplate内で解析する。
単独のHTML iframe以外を拒否し、`srcdoc`やイベント属性が付いたiframeも拒否する。
CMSのDOMノードは表示中のDOMへ挿入せず、URL以外の属性も転送しない。
style、class、sandbox、permissionsもCMSからは引き継がない。

抽出したURLは`admitPlayerUrl`へ渡し、サービスごとに定義した許可範囲に従って再構築する。
`MediaEmbedComponent`内でAngularのResourceURLを信頼済みにする箇所は一つだけで、この出力だけを受け付ける。
空欄は何も表示せず、拒否した値には固定文言を表示する。

この処理とは別に、汎用の`SanitizeHtmlPipe`はAngularのHTML sanitizerを使う。
汎用HTMLの安全性確認を省略する処理は行わない。

## 許可するURLと表示仕様

### SoundCloud

`https://w.soundcloud.com/player/`を許可し、内部の`url`は
`https://api.soundcloud.com/tracks/<digits>`だけを受け付ける。
booleanの表示設定と6桁のcolorだけを再構築し、`auto_play=false`にする。
高さは通常166px、visualでは300pxとする。

### Spotify

`https://open.spotify.com/embed/track/<22-character-id>`だけを許可する。
`utm_source`は受け付けるが出力しない。高さは80pxとする。

### YouTube

`https://www.youtube.com/embed/<11-character-id>`と、同じ形式でホストが
`www.youtube-nocookie.com`のURLを許可する。クエリは付けず、入力URLが指定したプライバシーモードのホストを維持する。

幅が足りる場合は16:9とし、高さは公式最小値の200px以上にする。
コンテナー幅が200px未満の場合や初回計測前はiframeを生成せず、
同じ検証済み動画IDから組み立てた「YouTubeで開く」リンクを表示する。
幅が縮んだ際はiframeを取り外し、操作できない音声だけを残さない。
ResizeObserverはコンポーネント破棄時にdisconnectする。

### 共通の拒否条件

| 検査対象 | 拒否する条件 |
| --- | --- |
| 通信方式 | HTTPS以外 |
| 接続先 | userinfo付き、非標準ポート付き、未登録のホストまたはパス |
| URLの付加情報 | フラグメント付き、クエリの重複、未登録のクエリ |

未知のサービスやalbum、playlist、クエリなどを暗黙に許可しない。
許可範囲を追加する際は、実データ、公式仕様、攻撃を模したテストデータで妥当性を確認する。

## iframeの権限と外部サービスの制約

iframeのsandbox/allow/referrerpolicyなどは、Angular template内の静的属性として定義する。
sandboxには`allow-scripts allow-same-origin`だけを指定し、
最上位ページへの移動、ポップアップ、フォーム送信、ダウンロード、プレゼンテーションを許可しない。

| サービス | 明示するpermission |
| --- | --- |
| SoundCloud | autoplay |
| Spotify | autoplay/encrypted-media |
| YouTube | autoplay/encrypted-media/fullscreen/picture-in-picture |

permissionの付与は、自動再生の要求そのものではない。
許可したURLには、自動再生を要求するクエリを出力しない。
referrerpolicyは`strict-origin-when-cross-origin`とし、オリジンをリファラーとして保つ。

sandboxによって、外部プレーヤーのログイン、外部リンク、アプリ起動、共有などが動かない場合がある。
この埋め込み方針で管理するのはURLとiframeの権限までで、
第三者iframe内部の実装、サービスの稼働、音声出力、アカウント別の制約は保証しない。

## テストで確認する範囲

2026-09-12の公開CMS読み取りでは、13件のreleaseと21行のdemoを調べ、20個のiframeと1個のnullを確認した。
この観測に基づく互換性確認用の固定データを`test/fixtures/observed-media-embeds.ts`に置く。

実装に併設した通常テストでは、次の動作を検査する。

- 公開CMSの20個のiframeの受け入れと空欄1件の表示
- URL/HTML攻撃の拒否とタイトルのエスケープ
- 許可→拒否→空欄の遷移とサービスの置換

ブラウザ試験では、実際のAngular本番ビルド成果物と、明示的に用意したテスト用プレーヤーを使う。
未知の外部通信は中断し、記録する。
ここで確認するのはテスト環境での埋め込みとsandboxの動作で、実際のSoundCloud/Spotify/YouTubeの再生成功ではない。

## 修正時の記録

既存の8修正と今回の`unsafe-html-content`は、`test/product-repairs.json`で追跡する。
既知の不具合の未修正ケースが0件になっても、テストランナーをスキップしない。
`resolvedCheck`は、判定に使う記録を出力するreporter付きで4個の通常のセキュリティ回帰テストを実行する。
ケース・ファイル・件数の正確な一致、正常終了、エラーがないことを合格条件とする。
旧expected-failure validatorと過去のbaseline controlsは変更しない。

この修正では、性能閾値、Home CTA/notice、本番設定、依存バージョンは変更しない。
先行8修正の固定性能判定のFAILも、この修正で解消したとは扱わない。

証拠は`.artifacts/embed-policy-2026-09-11T23-57-59.143Z/`に保持する。
取得した公式文書とhash、CMSの生データと全件数、編集前ソースのアーカイブ、RED/GREEN実行ログを含む。
この作業では、公開、CMSへの書き込み、外部プレーヤーの実再生、人手によるスクリーンリーダー受け入れ確認は行っていない。

## 公式資料

- [Angularのセキュリティ](https://angular.dev/best-practices/security)
- [AngularのNG0910](https://angular.dev/errors/NG0910)
- [YouTubeのplayer parameters](https://developers.google.com/youtube/player_parameters)
- [Spotifyの埋め込み](https://developer.spotify.com/documentation/embeds)
- [SoundCloudのHTML5 widget](https://developers.soundcloud.com/docs/api/html5-widget)
