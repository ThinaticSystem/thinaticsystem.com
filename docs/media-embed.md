# メディアの埋め込み

CMSに登録された音楽・動画プレーヤーを、作品ページに表示する  
SoundCloud、Spotify、YouTubeに対応し、検証したURLをサイト側のiframeで読み込む

## 対応するサービス

| サービス | 受け付けるURL | URLの扱い |
| --- | --- | --- |
| SoundCloud | `https://w.soundcloud.com/player/` | 内部の`url`は`https://api.soundcloud.com/tracks/<digits>`のみ。booleanの表示設定と6桁のcolorを再構築し、`auto_play=false`にする |
| Spotify | `https://open.spotify.com/embed/track/<22-character-id>` | `utm_source`は受け付けるが、出力URLには含めない |
| YouTube | `https://www.youtube.com/embed/<11-character-id>`または同じ形式の`www.youtube-nocookie.com` | 入力で指定されたホストを維持し、クエリは付けない |

対応するのは上記のプレーヤーURLで、albumやplaylistは対象外  
サービスやURLの許可範囲を広げるときは、実データ、公式仕様、攻撃を模したテストデータで妥当性を確認する

## プレーヤーの表示

SoundCloudは通常166px、visualでは300px、Spotifyは80pxの高さで表示する

YouTubeは幅が足りる場合に16:9で表示し、高さは公式最小値の200px以上を確保する  
コンテナー幅が200px未満の場合や初回計測前は、iframeの代わりに
検証済みの動画IDから組み立てた「YouTubeで開く」リンクを表示する

表示中に幅が縮んだ場合もiframeを取り外し、操作できない音声だけが残ることを防ぐ  
幅を監視するResizeObserverは、コンポーネントの破棄時に解除する

CMSの入力が空欄なら何も表示せず、検証で拒否した値には固定文言を表示する

## 入力HTMLとURLの検証

CMSの`demo.iframe`は、プレーヤーのURLを取り出すための入力として使う  
`readEmbedHtml`が長さを制限した文字列を、内容を実行しないtemplate内で解析する

受け付けるのは単独のHTML iframeだけで、`srcdoc`やイベント属性がある場合は拒否する  
取り出すのはURLのみで、CMSのDOMノードやstyle、class、sandbox、permissionsなどの属性は表示側へ引き継がない

抽出したURLは`admitPlayerUrl`でサービスごとの許可範囲と照合し、組み直す  
次の条件に当てはまるURLは拒否する

| 検査対象 | 拒否する条件 |
| --- | --- |
| 通信方式 | HTTPS以外 |
| 接続先 | userinfo付き、非標準ポート付き、未登録のホストまたはパス |
| 付加情報 | フラグメント付き、クエリの重複、未登録のクエリ |

`MediaEmbedComponent`は、この検証済みURLだけをAngularの信頼済みResourceURLに変換する  
変換箇所はコンポーネント内の一か所にまとめている

通常のHTML表示は別の処理で、`SanitizeHtmlPipe`がAngularのHTML sanitizerを使って安全性を確認する

## iframeの設定

iframeのsandbox、allow、referrerpolicyは、Angular templateの静的属性としてサイト側で管理する  
CMSの設定では変更できない

sandboxで許可するのは`allow-scripts allow-same-origin`のみ  
最上位ページへの移動、ポップアップ、フォーム送信、ダウンロード、プレゼンテーションは許可しない

| サービス | allowで明示する権限 |
| --- | --- |
| SoundCloud | autoplay |
| Spotify | autoplay/encrypted-media |
| YouTube | autoplay/encrypted-media/fullscreen/picture-in-picture |

自動再生の権限は付与するが、プレーヤーURLには自動再生を要求するクエリを出力しない  
referrerpolicyは`strict-origin-when-cross-origin`とし、オリジンをリファラーとして保つ

このsandboxでは、外部プレーヤーのログイン、外部リンク、アプリ起動、共有などが動かない場合がある  
サイト側で管理するのはURLとiframeの権限までで、プレーヤー内部の実装、サービスの稼働、音声出力、アカウント別の制約は外部サービスに依存する

自動テストは入力の検証や表示の切り替え、テスト用プレーヤーでのsandboxの動作を対象とし、実サービスでの再生確認は含まない

## 公式資料

- [Angularのセキュリティ](https://angular.dev/best-practices/security)
- [AngularのNG0910](https://angular.dev/errors/NG0910)
- [YouTubeのplayer parameters](https://developers.google.com/youtube/player_parameters)
- [Spotifyの埋め込み](https://developer.spotify.com/documentation/embeds)
- [SoundCloudのHTML5 widget](https://developers.soundcloud.com/docs/api/html5-widget)
