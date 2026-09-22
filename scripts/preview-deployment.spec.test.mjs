import assert from 'node:assert/strict';
import test from 'node:test';
import {parseDeploymentsResponse, selectPreviewDeployment} from './preview-deployment.mjs';

const commitSha = 'a'.repeat(40);
const expected = {commitSha, branch: 'chore-modernization-renovate', environment: 'preview', actionUrl: 'https://candidate.pages.dev'};
const deployment = {id: 'dep-1', url: expected.actionUrl, aliases: ['https://alias.pages.dev'], branch: expected.branch, environment: 'preview', deployment_trigger: {metadata: {commit_hash: commitSha}}, latest_stage: {name: 'Success', status: 'success'}};

test('selector accepts exactly one successful matching preview deployment', () => {
  assert.deepEqual(selectPreviewDeployment({result: [deployment]}, expected), {id: 'dep-1', url: expected.actionUrl, aliases: [expected.actionUrl, 'https://alias.pages.dev'], branch: expected.branch, environment: 'preview', commitSha, latestStage: 'Success'});
});

for (const [name, result] of [
  ['zero matches', []],
  ['ambiguous matches', [deployment, {...deployment, id: 'dep-2'}]],
  ['production environment', [{...deployment, environment: 'production'}]],
  ['mismatched branch', [{...deployment, branch: 'master'}]],
  ['failed stage', [{...deployment, latest_stage: {name: 'Failed', status: 'failure'}}]],
  ['contradictory success name and failure status', [{...deployment, latest_stage: {name: 'Success', status: 'failure'}}]],
  ['missing stage status', [{...deployment, latest_stage: {name: 'Success'} }]],
  ['mismatched commit', [{...deployment, deployment_trigger: {metadata: {commit_hash: 'b'.repeat(40)}}}]],
  ['missing URL', [{...deployment, url: ''}]],
  ['malformed payload', [{...deployment, latest_stage: null}]],
]) test(`selector fails closed for ${name}`, () => {
  assert.throws(() => selectPreviewDeployment({result}, expected));
});

test('parser rejects malformed API JSON', () => assert.throws(() => parseDeploymentsResponse('{not-json')));
