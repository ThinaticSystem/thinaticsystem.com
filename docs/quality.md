# 品質gate

## 現行CIの性能検証

現行CIの性能checkは[`perf:current`](current-performance.md)。  
本文/操作可能性を正のendpointとする通常motionの新計測、A/A校正、固定schedule比較、資源予算判定を使う。旧v4の時間値を新計測へ混ぜない。

この文書のhistorical節は、過去の再現手順・制約・結果の記録として読む。  
現行CIの呼出しや受入を上書きせず、過去の結果を現candidateの実行結果として扱わない。

## ローカルコマンドの契約

frozen install後に、各コマンドを次の範囲で使う。  
現行feedbackのreadinessとhosting実装については、後述の検証範囲の制限に従う。

- **`pnpm run check`**

  baseline quality gateとして、次を順に実行する。

  1. typecheck
  2. lint
  3. unit
  4. known-defect contract
  5. known-defect raw gate
  6. 性能予算contract fixture

- **`pnpm run docs:check`**

  TypeDocを生成する。

- **`pnpm run test:e2e`**

  owned synthetic fixtureを使い、実Chromiumでsemantic/a11y/browser smokeを実行する。

- **`pnpm run perf:paired`**

  同一runnerでhistorical baselineとcandidateをfresh計測する。

- **`pnpm run deploy:check`**

  自前のNode fixture serverのHTTP契約だけを検査する。

## known defectの扱い

### 修正の追跡と判定

ユーザー承認の8件と`unsafe-html-content`の修正は、`test/product-repairs.json`から通常colocated specへ追跡できる。  
現在の未修正known-defect caseは0件。ただし、空suiteを成功扱いしない。

`resolvedCheck`が、通常security regressionの4件をauthoritative reporter付きで実行する。  
検証条件は次のとおり。

- 正確なfile/case/count
- status=0
- skip/todo/duplicate/runner/setup/unhandled errorの不存在
- 未登録known-defect specの不存在

人間向けconsole出力は、判定の権威にしない。

### 過去の証拠と残る制約

非空known-debt用の既存expected-failure validatorとhistorical paired controlsは変更しない。  
旧9件および修正作業時の編集前source/rawは、各ignored artifact archiveへ保持する。

iframe境界・拒否条件・互換性の未検証範囲は、`docs/media-embed.md`に定義する。

CI greenが示すのは、通常suiteとknown-defect contractを満たしたことに限る。  
全製品要求が解決済みという意味ではない。登録defectは明示レビューなしに増やさない。

## ブラウザーとaccessibility

`test:e2e`はCMS/patronのlive endpointへ接続しない。  
Chromiumでは、home、theme toggle、mobile menu、blog list/article/back、discographyを通る。

記録する検証項目は次のとおり。

- role/nameまたはvisible textのsemantic locator
- keyboard operationとfocus
- mobile `375x812`、reduced motion、reflow
- axe scan
- console/page/request error inventory

axe passだけでは、screen reader usabilityの証明にならない。  
代表screen readerでの手動確認は、未実施ならpendingとして扱う。

## 現行feedbackの検証範囲

### feedbackのライフサイクル

承認済みのicon-only feedbackは、`ページを読み込み中`という名前の`role=status`とempty-alt imageを使う。  
表示のライフサイクルにはdelayed admissionと、別に所有するdecorative exitを使う。  
historical v4は、このライフサイクルの完了を待たない。

v4の凍結helper/control/source hashesは変更しないため、旧harnessのPASSは現行feedbackのreadiness受入にならない。  
現行のcolocated loading/clipboard testsと、別途保持するcorner/reduced-motion/browser evidenceは、それぞれ明記した挙動を検証する。

最終的な時間判定には、別途レビューした現行readinessの計測基盤が必要。  
historical controlsを黙って置き換えて対応しない。

### 性能予算とcoverage

別途承認された[functional budget](functional-performance-budget.md)も、旧raw failuresと不完全なcoverageを保持する。  
historical comparatorを緑に置き換えるための基準ではない。

後継collectorはcold article/detailとlist-to-detailの観測を追加するが、コードに観測処理があるだけでは実行合格を示さない。  
coverageは、そのcollectorの正確な現行runと制限を使って評価する。

自動axe/keyboard checksは、実screen readerのusabilityを証明しない。

## 配信の検証範囲

### ローカルfixtureのHTTP契約

`deploy:check`は`dist/app/browser`を127.0.0.1だけで配信し、次を検査する。

- deep-linkのHTML応答
- 既存API相当のJSON/status応答
- missing assetのHTTP 404
- 未知APIでのSPA HTML fallbackの拒否

### hosting実装の未確認範囲

このrepositoryには、actual Cloudflare handler・account/branch bindingの正本が含まれていない。  
`deploy:check`はCloudflare runtimeを起動せず、fixture responseを返す自前のNode serverを検証する。

この結果を、Cloudflare実互換性や`/workers/*`の実配信の合格として扱わない。  
正本の既存hosting設定を確認し、supported local provider runtimeでの検証、または権限を得た実環境検証を別途行うまで未確認。

Cloudflare account、branch binding、remote Actions、preview、本番deploy、DNS、CMS writeは、このローカルgateでは検証しない。

## Historical：旧性能方針

この節は、旧比較方式と過去のremediation時点の記録を残す。  
ここにある時間規則や実行失敗を、現行`perf:current`の規則・結果へ読み替えない。

### 比較方式

比較baselineには、approved SHA `33b4ef4e8d21276130127a61aede6f0a8e1c47cb`のsynthetic fixtureとChromiumを使う。  
gzip(level9,mtime0)とBrotli(quality11)を同じ方式で計算する。  
比較対象は、initial artifact sizeとper-route request/lazy-route bytes。

`browser-smoke`はreadiness完了までを計時し、axe scanとscreenshotはtimer外で実行する。  
timingは3 repeatのmedianをbaselineの固定20% noise/retest ruleで判定する。

超過はPASSにせず、`INCONCLUSIVE_OR_FAIL`としてgateを止める。  
local lab timingはfield UX保証ではない。

### Nix再検証の履歴

現在のNix shellは、candidate/計測用Node24とhistorical baseline build用Node22を分離して固定する。  
以下は過去のremediationの記録で、現candidateの実行結果ではない。

旧Nix実行はNode22 bridgeを使用した。  
当時の実行試験では、Node26でVitest native double-freeが発生したため採用しなかった。

Nix側では、次を別々の再検証対象とした。

- `install --frozen-lockfile`
- typecheck/unit/debt
- build
- dev/browser

そのremediation runでは、offline `nix develop`がversion出力前にtimeoutしたため、Nix実行をPASS扱いしない。  
親の旧Node26結果は履歴証拠として残し、新しいreportで混同しない。

## Historical：v4のvisible-readinessとブラウザー証拠

この節は、v4で使ったcapture/readiness契約と証拠の再現条件を記録する。  
現行feedbackのライフサイクルや新しい計測の受入とは区別する。

### fontとcaptureの契約

ブラウザーcaptureは、hashで固定したNoto Sans JPとNoto Color Emoji fallbackを、process-local fontconfig file経由で使う。  
font bytesとOFL licensesは、ignored `.artifacts/browser-fonts`にcacheする。

app CSS、webfont request、system font setting、app bundleは変更しない。  
このcapture契約にはLinux/Nixが必要。

`test:browser-contract`は、次を検査する。

- delayed loading transition
- missing loader
- stuck loader timeout
- 実際のplatform-font使用

`test:e2e`では、ブラウザーjourneyより前にこの検査を実行する。

### v4の待機条件

historical v4 readinessは、semantic nameで特定した旧loading imageのfadeを待ち、その後、有限のpage motionが落ち着くまで待つ。  
loaderを隠したり、待機を固定sleepへ置き換えたりしない。

desktop/mobileの初期themeとcolor schemeはlight。screenshots/axeはaction timer外に置く。

### 比較できる証拠の組合せ

v4のuser-visible timingをhistorical v3 baselineと比較しない。`perf:check`は、その混在を拒否する。  
freshなsame-host pairでは、browser/font/theme/readinessが一致するv4 baseline/candidate recordsを用意する。  
そのrecordsを指す`PERFORMANCE_BASELINE`と`EVIDENCE_OUTPUT`を渡す。

元の`test/performance-baseline.json`は、historical evidenceとして変更せずに残す。  
dev pairは`.artifacts/browser-ready-fix/final/{baseline,candidate,performance}.json`に保存している。  
これはhosted-CI baselineではない。

historical CIは`perf:paired`を呼び出していた。現行workflowは、別にversion管理する`perf:current`を使う。  
どちらのコマンドもdev timingsをhosted baselineとして読み込まない。

remote Actionsの成功を示すには、pushした正確なrevisionと実run結果が必要。

## Historical：同一runnerのpairedコマンド

以下は、旧`perf:paired`の実行契約と証拠の扱いを再現用に残した記録。  
現在のCI entrypointを置き換えず、この手順があること自体を実行成功の証拠にしない。

### 前提と実行

Linuxと既存Cコンパイラーのccが必要。native Nix shellとhosted Ubuntu runnerがccを提供する。  
owner bootstrapはpackageをinstallせず、system settingも変更しない。

candidateのfrozen installとChromium installationを終えてから、次のコマンドを実行する。

- `corepack pnpm run test:paired-contract`
- `corepack pnpm run perf:paired`

ローカルでは固定Nix Node24 shellを使う。  
Linuxでは、明示的な`BROWSER_EXECUTABLE_PATH`でinstall済みChromiumを選べる。

それ以外の継承されたbrowser/evidence/baseline controlsは破棄する。  
このコマンドは、historical timing fileや以前のbrowser resultを読み込まない。

### buildとtoolchainの分離

runnerは、一意のignored `.artifacts/paired-ci/run-*/` evidence directoryを作成する。  
併せて、不変のbase `33b4ef4e8d21276130127a61aede6f0a8e1c47cb`から、所有対象となるdetached sibling worktreeを1つ作る。

baselineとcandidateのbuild条件を分ける。

- **baseline**

  専用の固定pnpm9.10.0でfrozen install/buildする。  
  build専用Nodeは、`.baseline-node-version`に記録したNode22.23.2を使う。

- **candidateと計測**

  candidateはintegrity付きで固定したpackageManagerでbuildする。  
  candidate/measurementには、`.node-version`に記録したNode24.19.0を使う。

build workersは最大2つ。Angular18は保守対象外のhistorical frameworkで、Node22は公表された互換範囲内に入るが、Node24は入らない。

`BASELINE_NODE_EXECUTABLE`は、locked Nix shellが提供するか、CI setup-nodeがcandidate setup前に保存する。  
選択したNodeから隣接するCorepack entryを明示的に呼び、そのbinをbaseline PATHの先頭に置く。

install前に、実execPath/version/Corepack0.34.6/pnpm9.10.0/immutable lockを検査する。  
`ng version`がunsupported runtimeを報告してはならない。両browser driversはcandidate Node24のまま使う。

worktreeをsiblingに配置し、package-manager environmentを無害化する。  
これにより、Angular/package resolutionがcandidate installationをたどるのを防ぐ。  
既存baseline worktreesと以前からあるdirty filesは、reset・再利用・削除しない。

### 固定scheduleと比較規則

scheduleは**ABBA/BAAB**に固定する。A=baselineとし、1 repeatのchild runを8回、逐次実行する。  
各側4回、各runで完全な7 journeysを実行する。

すべてのrunで、candidate側のv4 fixture/readiness/font/theme/browser codeを使う。  
browser-contract checksを時間計測より先に実行する。

buildの並行実行、自動retry、最速runの選別、閾値の変更はしない。  
initial raw/gzip/Brotli sizes、request counts、route decoded bytesは増加を認めない。

timingには元の20% median flag ruleを使う。ゼロ回帰やfield UXを保証する規則ではない。  
flagが付いた結果は`INCONCLUSIVE_OR_FAIL`のまま残し、完全なpaired retestを別途検討する必要がある。

### 集計に使えるrawと失敗条件

集計に入れるのは、次の条件を満たす完全なraw v4 runsだけに限る。

- 正確な7 journey identities
- 有限で正のtiming
- 非負のresource/request counts
- 期待するviewport/keyboard/reflow
- 期待するfont/theme/readiness
- 同一のbrowser identity

child exit、signal、timeout、spawn failure、stderr、error inventoriesは、それぞれ独立に検査する。  
JSONの欠落・不完全なJSON、journeyの欠落・重複、schema/font/browser不一致、未知errorはfail-closedで停止する。

### baselineの既知失敗とcontrol v2

baseline raw exit1は、**KNOWN_BASELINE_FAILURE_NOT_PRODUCT_PASS**として残す。一括で無視しない。  
`test/paired-baseline-debt.json`は不変のまま保つ。

`test/paired-baseline-control-v2.json`を明示選択し、SHA256で固定する。  
このcontrolは元のidentitiesに加え、独立レビュー済みのserious color-contrast nodesを正確に2つ保持する。  
対象は`a[href$="fixture"]`のdesktop.blog-listとmobile.menu-blog。

同一DOM・現browserで、engineを順方向/逆方向に入れ替えるprobeを実行した。  
旧axe4.10.2のincomplete/bgOverlapが、axe4.13.0では測定可能な3.32:1になった。  
これは4.5:1未満のcontrastで、以前にPASSしていたことを意味しない。

control v2は、次のidentityを束縛する。

- parent hash
- baseline SHA/lock
- build runtime
- Chromium153.0.8010.12
- Playwright1.63.0
- axe4.13.0
- fixture/font/readiness source hashes

scopeはhistorical-performance-control-onlyに限定し、新しいproduct debtにはしない。

packageの`perf:paired`がpath/content hashを明示的に渡す。  
controlや計測基盤の欠落・誤り・編集はfail-closedで停止し、追加で許すpageerrorsは、homepageの正確なNG0953だけを0–2件に限る。

axe signaturesが欠落・変更された場合もrunを止める。  
このcontrolは比較にだけ使用を許すもので、baselineのcritical/serious accessibility defectsを受け入れるものではない。

candidateにはexit0と、axe/console/page/request errorsがないことを要求する。  
予期しないdebtは自動登録せず、明示レビューを必要とする。

### 実行時間の上限

| 処理 | 上限 |
| --- | --- |
| compiler bootstrap | 30s |
| git discovery | 30s |
| frozen baseline install | 480s |
| 各build | 300s |
| readiness contract | 90s |
| 各browser | 120s |
| comparison | 300s |
| worktree cleanup | 60s |

### process所有とcleanup

小さなLinux C subreaperを、各ignored run directory内へ1回compileする。  
次のcommand() stageに、それぞれ非特権ownerを付ける。

- worktree creation
- install
- toolchain probe
- build
- readiness
- browser
- comparison

通常exit、crash、timeout、SIGTERM/SIGINT時は、ownerがdirect childrenだけをkillしてreapする。  
その後、新たにadoptしたdescendantsをdrainし、waitpidがECHILDを報告するまで続ける。

detached descendantsとnon-main-thread descendantsも、元のparentが消えた後まで所有下に残る。  
cleanupのdeadlineは5s。Node adapterはcommand timeout/cancellationからさらに7s待ち、それでも完了しなければcleanup未検証として失敗する。

raw child exit/signalはownerのreceiptと別に保持する。  
receiptの欠落・不正やcleanupの不成功は、合格にしない。

各commandには、mode0700の使い捨て/tmp/thinatic-paired-* TMPDIRを用意し、owner exit後に削除する。  
短い絶対pathを使い、Chromium singleton socketsをLinux AF_UNIXの長さ制限内に収める。

compiler bootstrapが失敗した場合はcleanup未検証と報告し、compiler descendantsを回収できたと主張しない。  
既存の同期metadata操作（git discovery/diff/list、compiler version）とworktree removalには、別の実行上限を設ける。  
これらには、このsubreaper保証を適用しない。

### cleanupの限界とworkflow

通常cleanupで削除するのは、新しく作成したworktreeだけ。  
捕捉できないsupervisor SIGKILLやhost lossではcleanupを保証できない。

receiptの欠落・不完全はPASSにせず、ephemeral hosted runnerを外側の境界とする。  
通常の失敗時は、logs、receipts、screenshots、partial failure JSONを残す。

当時のworkflowはpaired stepを30分、jobを45分に制限し、actionsをpinしていた。  
contents-read permission、checkout credentials無効化、固定base用のfull historyも設定していた。

artifact uploadはalways()で動かし、hidden evidenceを含め、14日間保持する。  
ローカルrunからhosting/uploadの成功は主張しない。

### sourceとbuildの証拠

`identity.json`には、candidate HEADとdirty statusを記録する。  
併せて、Git-known/nonignored-untracked source全体の決定的manifestを記録する。  
manifestはpaths、byte hashes、modes、file kindsを含み、generated artifactsを除外し、秘密情報を含む可能性があるfilenamesを拒否する。

同じ`identity.json`に、次の情報も記録する。

- Node/package manager/Playwright/host/GitHub metadata
- 正確なcontrol selection
- 固定schedule
- policy

`candidate.patch`には、tracked working-tree differencesを残す。

`source-before.json`/`source-after.json`は、失敗・cancellation時もfinallyで比較する。  
両側でfrozen installsとfresh buildsを実行する。  
baseline/candidate build identityと完全なoutput manifestsで、実際のlocksと生成assetsを束縛する。

所有するworktreeを削除する前に、output identityを再検査する。

同じ場所に保存する証拠は次のとおり。

- `baseline-build-identity.json`とbuild logs
- 各raw browser JSONとprocess receipt
- 集計済みbaseline/candidate
- performance result
- 最終cleanup result

### axe診断と証拠の解釈

すべてのaxe scanで、hashを束縛した完全なraw diagnosticもtimer外に保存する。  
testEngine、incomplete、passes、any/all/none check dataを含む。

incompleteは補助証拠に限り、candidateに新たなmanual-review hard gateを加えるものではない。  
dirty candidateはHEAD**とfile hashes**で識別し、commitそのものと偽って表現しない。

このコマンドはremote writes、deployment、app-source changesを行わない。

## Historical：依存更新時点の互換性と判断

この節は、依存更新を検討・検証した時点のversion選定、試行結果、制約の記録。  
「確認済み」のversionやブラウザー結果は当時の情報を指し、現在のlatest照会や現candidateの再実行結果ではない。

### Nodeとpackage manager

- **Nodeの固定**

  locked nixpkgs提供の24.19.0、`.node-version`、package engines、CI、Nix assertを一致させる。  
  当時のofficial latest LTS24.21.0は確認済みだったが、このlockには未収録だった。

  限られたdev diskでは、Nix input全体更新やNode source buildを行わない。  
  Node26は旧native crash履歴を保持して採用しない。

- **pnpmの固定と自動追加の制限**

  pnpm12.3.4をintegrity付きでpinし、strict peer/engine checksを有効にする。  
  Angular native buildの4packageだけをallowBuildsへ明示する。

  最新Angular等のexact-version release-age exceptionsは、pnpmが生成した値をレビューして固定する。  
  将来の自動追加はminimumReleaseAgeStrictで止める。

### compiler・test・数式表示の互換性

保持するversionと、その制約を分けて記録する。

- **TypeScript6.0.3**

  Angular compiler/buildの>=6.0 <6.1と、TypeDoc対応範囲の交差に合わせる。

- **Vitest4.1.11**

  Angular buildの^4.0.8に合わせる。

- **KaTeX0.16.47**

  ngx-markdownの^0.16.0に合わせる。

TS7、Vitest5、KaTeX0.18への強制overrideは行わない。  
Angular template lintを維持し、Oxcとの重複lintを追加しない。

### Tailwind移行の試行と見送り

Tailwind4.3.3は、official upgrade tool、SCSS→CSS/@reference/PostCSS移行、実buildとChromium153 smokeまで試行した。  
表示では、新しいdynamic z-2 utilityによるhomeのstacking差と、articleのspacing差を確認した。  
転送量では、blog route decoded bytesの増加20803→28685を確認した。

変更前のrender/performance契約を優先し、3.4.19を保持する判断とした。  
試行source archive、ログ、画像はignored dependency-modernization artifactに保持し、閾値の緩和や旧debtへの登録はしない。

### ブラウザー証拠とhistorical control

Playwright1.63.0/Chromium153.0.8010.12/axe4.13.0で、新たなfixture browser結果を作成する。  
devでは既存Nixライブラリを使うprocess-local browser wrapperのみを用い、global nix-ldやfont設定は変更しない。

旧paired runは、axe signature差をfail-closedで拒否した履歴として保持する。  
独立因果reviewを根拠に、別versionのhistorical-only controlを明示選択し、baseline buildをlocked Node22.23.2へ分離する。

旧debtと旧rawは不変のまま保ち、旧candidate lockと現lockの差も保持する。  
新control登録は製品・性能受入ではない。

その時点のfull source manifestとfresh frozen install/buildに基づく全8attemptの結果だけを、新しい比較証拠とする。  
Angular18自体の保守やProduction/hosted CI成功は主張しない。

### CI uploadと未実行範囲

CI uploadは、次の必要証跡をallowlistとする。

- paired-ci
- performance-v2
- recorder canary
- browser/axe
- known-defects
- runner probes
- typedoc

local backup、ブラウザーbinary、既存Pages snapshotを、.artifacts全体から公開しない。  
この記録時点では、remote ActionsとProductionは未実行だった。
