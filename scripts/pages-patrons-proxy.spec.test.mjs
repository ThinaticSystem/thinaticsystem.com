import assert from "node:assert/strict";
import test from "node:test";
import {handlePagesRequest, normalizePublicPatrons} from "./pages-patrons-proxy.mjs";

const validRow = {data:{id:"public-id",type:"member",attributes:{currently_entitled_amount_cents:1200,full_name:"Sample Public",lifetime_support_cents:2400,patron_status:"active_patron"}},links:{self:"https://example.test/public"},ignored:"not forwarded"};
const jsonResponse = (value, status=200, headers={"content-type":"text/plain;charset=UTF-8"}) => new Response(JSON.stringify(value),{status,headers});
const makeEnv = (assetCalls=[]) => ({ASSETS:{fetch:async request=>{assetCalls.push(request.url);return new Response("static asset",{status:200})}}});

test("Given a GET to the exact route then only the fixed upstream is fetched without caller data and public schema is normalized", async () => {
  let captured;
  const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons?url=https://attacker.test&token=secret",{headers:{cookie:"session=secret",authorization:"Bearer secret", "x-forwarded-host":"attacker.test","x-extra":"private"}}),makeEnv(),{fetchImpl:async (url,init)=>{captured={url:String(url),init};return jsonResponse([validRow]);}});
  assert.equal(captured.url,"https://thinaticsystem.com/workers/patrons");
  assert.equal(captured.init.method,"GET");
  assert.equal(captured.init.redirect,"manual");
  assert.deepEqual([...new Headers(captured.init.headers).entries()],[ ["accept","application/json"] ]);
  assert.equal(captured.init.signal instanceof AbortSignal,true);
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-type"),/^application\/json/);
  assert.deepEqual(await response.json(),[{data:{attributes:{full_name:"Sample Public",lifetime_support_cents:2400,patron_status:"active_patron"}}}]);
});

test("Given a request outside the exact API path then static assets receive it unchanged", async () => {
  const assetCalls=[];const request=new Request("https://preview.example/workers/patrons/extra");
  const response=await handlePagesRequest(request,makeEnv(assetCalls),{fetchImpl:async()=>{throw new Error("must not fetch upstream");}});
  assert.equal(response.status,200);assert.deepEqual(assetCalls,[request.url]);
});

test("Given a non-GET request to the API then the proxy returns 405 without upstream access", async () => {
  const assetCalls=[];let called=false;
  const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons",{method:"POST"}),makeEnv(assetCalls),{fetchImpl:async()=>{called=true;}});
  assert.equal(response.status,405);assert.equal(response.headers.get("allow"),"GET");assert.equal(called,false);assert.deepEqual(assetCalls,[]);
});

test("Given an upstream redirect then the proxy refuses it and never follows the destination", async () => {
  let calls=0;const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons"),makeEnv(),{fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:"https://attacker.test/"}});}});
  assert.equal(calls,1);assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:"patrons_upstream_unavailable"});
});

test("Given upstream HTTP failure then body details are not forwarded", async () => {
  const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons"),makeEnv(),{fetchImpl:async()=>new Response("private upstream detail",{status:503})});
  assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:"patrons_upstream_unavailable"});
});

test("Given a delayed upstream then the deadline aborts the request and returns 504", async () => {
  let aborted=false;
  const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons"),makeEnv(),{timeoutInMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>{aborted=true;reject(new Error("aborted"));},{once:true}))});
  assert.equal(response.status,504);assert.equal(aborted,true);assert.deepEqual(await response.json(),{error:"patrons_upstream_timeout"});
});

test("Given the body arrives after the upstream deadline then the proxy returns 504", async () => {
  const body=new ReadableStream({start(controller){setTimeout(()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify([validRow])));controller.close();},20);}});
  const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons"),makeEnv(),{timeoutInMs:5,fetchImpl:async()=>new Response(body,{status:200})});
  assert.equal(response.status,504);assert.deepEqual(await response.json(),{error:"patrons_upstream_timeout"});
});

test("Given a body above the configured byte bound then the stream is rejected", async () => {
  let cancelled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode("123456"));},cancel(){cancelled=true;}});
  const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons"),makeEnv(),{maxBodySizeInBytes:5,fetchImpl:async()=>new Response(body,{status:200})});
  assert.equal(response.status,502);assert.equal(cancelled,true);assert.deepEqual(await response.json(),{error:"patrons_upstream_invalid"});
});

test("Given malformed JSON or invalid schema then the proxy fails closed", async t => {
  await t.test("malformed JSON",async()=>{const r=await handlePagesRequest(new Request("https://preview.example/workers/patrons"),makeEnv(),{fetchImpl:async()=>new Response("not-json",{status:200})});assert.equal(r.status,502);});
  await t.test("invalid patron shape",async()=>{assert.throws(()=>normalizePublicPatrons([{data:{id:"",type:"member",attributes:{}}}]),/schema/);});
  await t.test("non-array",async()=>{assert.throws(()=>normalizePublicPatrons({data:[]}),/schema/);});
});

test("Given valid JSON served as text/plain then the public JSON API remains compatible",async()=>{
  const response=await handlePagesRequest(new Request("https://preview.example/workers/patrons"),makeEnv(),{fetchImpl:async()=>jsonResponse([validRow])});
  assert.equal(response.status,200);assert.equal((await response.json()).length,1);
});
