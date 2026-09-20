import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {JSDOM} from 'jsdom';
import {captureBuildIdentity} from './paired-identity.mjs';
import {collectInitialAssets} from './performance-check.mjs';

const buildInputs=new Set(['angular.json','pnpm-lock.yaml','pnpm-workspace.yaml','tailwind.config.js','tsconfig.app.json','tsconfig.json','flake.nix','flake.lock','.node-version','.baseline-node-version']);
/** Conservative application/build witness; tool/test-only edits do not imply a loading-boundary change. */
export function applicationFiles(source) {
 return source.files.filter(file=>((file.path.startsWith('src/')||file.path.startsWith('public/'))&&!file.path.endsWith('.spec.ts'))||buildInputs.has(file.path));
}
/** Byte identity is an admission witness for the reviewed application, not a proof of arbitrary code semantics. */
export function validateApplicationBoundary(source,packageJson,policy) {
 const {scripts: _scripts,...metadata}=packageJson;
 const boundary=policy.applicationBoundary;
 const errors=[];
 if(boundary?.kind!=='exact-reviewed-application-inputs/v1'||!isDeepStrictEqual(applicationFiles(source),boundary.files)) errors.push('Application/build inputs changed: independent loading/representation/origin review required');
 if(!isDeepStrictEqual(metadata,boundary?.packageMetadata)) errors.push('Dependency/package metadata changed: independent boundary review required');
 return errors;
}

/** Count real output files, reject ambiguous roots/classification, and reuse the unchanged compression algorithm. */
export function collectBudgetAssets(root,policy) {
 const manifest=captureBuildIdentity(root);
 const emitted=manifest.files.filter(file=>/\.(?:js|css)$/.test(file.path));
 if(!emitted.length||manifest.files.some(file=>/\.(?:mjs|cjs|wasm)$/i.test(file.path))) throw new Error('Missing JS/CSS or unreviewed executable asset representation');
 const html=readFileSync(join(root,'index.html'),'utf8');
 const dom=new JSDOM(html);
 const references=[];
 try {
  for(const element of dom.window.document.querySelectorAll('script,link')) {
   if(element.localName==='link'&&!['stylesheet','modulepreload'].includes(element.rel)) continue;
   const reference=element.getAttribute(element.localName==='script'?'src':'href');
   if(!reference||(element.localName==='script'&&element.textContent.trim())) throw new Error('Inline/missing application entry requires review');
   const url=new URL(reference,'https://budget.invalid/');
   if(url.origin!=='https://budget.invalid'||url.search||url.hash||!/^\/?[A-Za-z0-9_./-]+\.(?:js|css)$/.test(reference)||reference.includes('..')) throw new Error('Unreviewed initial origin/path/classification');
   const path=url.pathname.slice(1);
   if(!emitted.some(file=>file.path===path)) throw new Error('Missing initial asset');
   references.push(path);
  }
 } finally {dom.window.close();}
 const initial=collectInitialAssets(root);
 const names=[...new Set(references)].map(path=>path.split('/').at(-1)).sort();
 if(!names.length||new Set(names).size!==names.length||!isDeepStrictEqual(names,initial.files.map(file=>file.file).sort())) throw new Error('Index asset mapping differs from frozen collector');
 const selector=policy.detailLogicalRoot?.selector;
 if(selector!=='app-detail') throw new Error('Unknown logical detail root');
 const details=emitted.filter(file=>file.path.endsWith('.js')&&/selectors:\[\[(["'`])app-detail\1\]\]/.test(readFileSync(join(root,file.path),'utf8')));
 if(details.length!==1||references.includes(details[0].path)) throw new Error('Missing/duplicate/eager detail component root');
 return {initial:initial.total,initialFiles:initial.files,detailChunkRawBytes:details[0].sizeInBytes,detailFile:details[0].path,allEmittedJsCssRawBytes:emitted.reduce((sum,file)=>sum+file.sizeInBytes,0),emitted,build:manifest};
}
