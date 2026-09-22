import assert from 'node:assert/strict';
import {test} from 'node:test';
import {validateResolvedDebtRun} from './resolved-debt-contract.mjs';
const check={id:'unsafe-html-content',spec:'src/app/pipes/sanitize-html.pipe.spec.ts',suiteName:'SanitizeHtmlPipe',testNames:['[unsafe-html-content] blocks scripts','ordinary HTML','events','unapproved iframe']};
const make=()=>({manifest:{schema:'thinaticsystem-com/known-defects/v1',cases:[],resolvedCheck:structuredClone(check)},status:0,signal:null,error:null,stderr:'',openSpecs:[],report:{schema:'thinaticsystem-com/vitest-authoritative/v1',success:true,numTotalTests:4,numPassedTests:4,numFailedTests:0,numPendingTests:0,numTodoTests:0,numTotalTestSuites:2,numPassedTestSuites:2,numFailedTestSuites:0,numPendingTestSuites:0,unhandledErrors:[],runnerErrors:[],testResults:[{name:check.spec,status:'passed',message:'',runnerErrors:[],assertionResults:check.testNames.map(name=>({fullName:check.suiteName+' '+name,ancestorTitles:[check.suiteName],status:'passed',mode:'run',failureMessages:[],failureDetails:[]}))}]}});
test('Given a resolved-debt receipt claims a known regression when the receipt is validated Then accepts only the declared real passing regression projection',()=>assert.deepEqual(validateResolvedDebtRun(make()),[]));
for(const [name,poison] of [
 ['missing resolution',r=>delete r.manifest.resolvedCheck],
 ['missing manifest cases',r=>delete r.manifest.cases],
 ['open debt',r=>r.manifest.cases.push({id:'unknown'})],
 ['wrong resolution ID',r=>r.manifest.resolvedCheck.id='unknown'],
 ['wrong source file',r=>r.manifest.resolvedCheck.spec='../../secret'],
 ['undisclosed spec',r=>r.openSpecs.push('src/known-defects/hidden.spec.ts')],
 ['failed discovery',r=>r.openSpecs=null],
 ['nonzero exit',r=>r.status=1],
 ['missing exit',r=>r.status=null],
 ['signal after plausible pass',r=>r.signal='SIGABRT'],
 ['spawn error',r=>r.error=new Error('failed')],
 ['unexpected diagnostics',r=>r.stderr='unrelated failure'],
 ['missing report',r=>r.report=null],
 ['wrong report schema',r=>r.report.schema='unknown'],
 ['missing pass',r=>r.report.numPassedTests=3],
 ['skip',r=>r.report.numPendingTests=1],
 ['todo',r=>r.report.numTodoTests=1],
 ['wrong suite count',r=>r.report.numTotalTestSuites=1],
 ['runtime error',r=>r.report.unhandledErrors.push({name:'TypeError'})],
 ['collection error',r=>r.report.runnerErrors.push({name:'Error'})],
 ['omitted error inventory',r=>delete r.report.unhandledErrors],
 ['report error',r=>r.report.runExecError='failure'],
 ['unknown file',r=>r.report.testResults[0].name='/other/spec.ts'],
 ['duplicate file',r=>r.report.testResults.push(r.report.testResults[0])],
 ['unknown case',r=>r.report.testResults[0].assertionResults[0].fullName='unknown'],
 ['duplicate case',r=>r.report.testResults[0].assertionResults[1]=r.report.testResults[0].assertionResults[0]],
 ['failed assertion',r=>r.report.testResults[0].assertionResults[0].status='failed'],
 ['hidden assertion details',r=>r.report.testResults[0].assertionResults[0].failureDetails.push({name:'TypeError'})],
 ['missing mode',r=>delete r.report.testResults[0].assertionResults[0].mode],
 ['null mode',r=>r.report.testResults[0].assertionResults[0].mode=null],
 ['unknown mode',r=>r.report.testResults[0].assertionResults[0].mode='unknown'],
 ['skip mode with passing counts',r=>r.report.testResults[0].assertionResults[0].mode='skip'],
 ['todo mode with passing counts',r=>r.report.testResults[0].assertionResults[0].mode='todo'],
 ['null assertion',r=>r.report.testResults[0].assertionResults[0]=null],
 ['array assertion',r=>r.report.testResults[0].assertionResults[0]=[]],
 ['malformed assertion name',r=>r.report.testResults[0].assertionResults[0].fullName={toString:null,valueOf:null}],
])test('rejects '+name,()=>{const value=make();poison(value);assert.ok(validateResolvedDebtRun(value).length>0);});
