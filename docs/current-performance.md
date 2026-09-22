# 現行性能検証

`corepack pnpm run perf:current`は、通常motion下でコンテンツを利用できるまでの時間をページ内時計で測り、比較する工学的なgate。  
旧`perf:paired`/v4、historical control、functional budget v1は再現用に残し、古いFAILを上書きしない。

## 実行

Node、Corepack、歴史的baseline用Node、Cコンパイラーは、既存Nix devShellまたはCI設定を使う。

- **観測・判定のfixture**

  `corepack pnpm run test:performance-contract`で、純粋な観測検証・判定・request所有fixtureを実行する。

- **計測器canary**

  `corepack pnpm run test:performance-recorder`で、実Chromiumによる計測器canaryを実行する。

- **baselineとcandidateの比較**

  `corepack pnpm run perf:current`で、固定historical baselineと現在のcandidateをbuildする。  
  candidate同士のA/Aを4観測、ABBA/BAABを8観測する。  
  raw・process終了・source/build identityを`.artifacts/performance-v2/run-*/`に残す。

- **機能・accessibilityの検証**

  `corepack pnpm run test:e2e`を独立したgateとして実行する。  
  旧smokeの所要時間は、新しい性能判定へ入力しない。

## コンテンツと操作の観測範囲

コンテンツ導線は、desktopのcold Home/article/作品詳細、一覧から本文/作品詳細への遷移、一覧へ戻る操作を対象とする。  
mobileは現段階ではmenu開閉のみを判定し、mobile本文表示の受入は未実装。

本文を覆う要素がなくなるまで待ち、操作を妨げない装飾の終了は待たない。  
ページ内イベントからDOM/rAF観測までの時間は、物理paintやfield INPとは異なる。

themeは保存値だけでなく、bodyの実computed背景/文字色と、存在するaria-pressedの一致を待つ。  
両凍結buildに共通するwhite/gray-800 paletteを契約とし、色設計が変わる場合は、この限定adapterも見直す。

## fixtureと資源の観測範囲

### 合成CMSとcache

Playwright routeによる合成CMSを使い、HTTP cacheは無効にする。  
SPA/moduleのwarmとHTTP cache hitは区別する。

CMS本文・画像はfixtureを使い、実CMSや外部playerのpayload/availabilityを代表しない。  
viewportも実端末CPUの代用にはならない。

### requestの所有と観測窓

requestは開始時に所有し、終端・bodyをbounded drainで確認する。後続資源はtailへ区別する。  
tailはdriverによるendpoint取得後250msにdrainを加えた可変観測窓で、ページ時刻のendpoint+250msぴったりのcutではない。

このscopeを旧warm budgetへ自動継承しない。  
decoded bytesとwire bytesは別物として扱い、観測不能は0にしない。

画像・CMSをcode bytesへ混ぜず、codeだけを画面全体の転送量と呼ばない。

### 静的出力と予算

既存承認のinitial index集合と全出力JS/CSS上限を継承する。  
加えて、baseline/candidateの両方を同一process/compressorで集計する。

未訪問lazy chunkを含む静的全出力に大幅な増分があれば、上限内という理由だけで自動合格にしない。  
初期index集合はcold依存閉包ではない。新しい資源scope・画像/APIの絶対上限は、未確定のまま記録する。

## 判定と受入の限界

50msかつ20%、1,024Bかつ20%を、事前固定する暫定的な工学的重要度filterとして使う。  
利用者承認済みの絶対UX SLOでも、小さなbyte差が非ボトルネックという証明でもない。

- **INCONCLUSIVE**

  A/Aがこの幅で不安定な場合。

- **REVIEW_REQUIRED**

  継続的に有意量の比較悪化がある場合。

- **FAIL**

  承認済みサイズ予算を超過した場合。

- **INVALID_EVIDENCE**

  source/build/profileの不整合・欠落、未知error、不完全cleanupがある場合。

4回の観測からp95・統計的有意性を主張しない。  
最速結果の選別や、緑になるまでのretryはしない。

`PASS_WITH_NOTES`が示すのは、**この比較gateの通過**に限る。  
絶対UX・実端末・本番配信・screen readerの全受入ではなく、出力の`absoluteUxAcceptance: NOT_ESTABLISHED`を残す。

## CIと旧結果

build成功を条件として、機能/a11y・性能・TypeDoc・fixture配信smokeを独立実行する。  
性能失敗で後続docs/smokeをskipせず、各stepの失敗はjobに残す。

`continue-on-error`で未知失敗を握り潰さない。raw uploadは失敗時も実行する。

旧記事遷移+650BのFAILは、旧ゼロ増分方針の結果として残る。  
新しい比較は新schema/readiness/fixtureに紐づく別観測で、旧データの時刻を新しい測定と称して再利用しない。

本番公開・Renovate有効化・default branchへの設定反映は、このgateの権限に含まれない。

## メニューのmotion回帰

### 実行と時間設定

production buildのメニューを実Chromiumで確認する。出力先は未使用のdirectoryを指定する。

```sh
node scripts/performance/verify-menu-motion.mjs --dist dist/app/browser --output .artifacts/menu-motion
```

標準animationの所要時間は`--animate-duration`を参照し、未指定時のみ1秒へfallbackする。  
app shellの既存指定0.5秒を保ち、reduced-motionでは1msを優先する。

fadeの廃止、keyframeの変更、readiness条件や性能filterの緩和では解決しない。

### 確認範囲

この回帰では、native animationの時間設定・opacity推移・繰返し開閉・Blog遷移を確認する。  
実ブラウザーのfixture検証なので、人間の見た目評価、実端末の応答性、公開配信の受入とは区別する。
