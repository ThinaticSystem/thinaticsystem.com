import assert from 'node:assert/strict';
import test from 'node:test';
import {CLOUDFLARE_PAGES_DEPLOYMENTS_SOURCE, parseDeploymentsResponse, selectPreviewDeployment} from './preview-deployment.mjs';

const commitSha = 'a'.repeat(40);
const expected = {commitSha, branch: 'chore-modernization-renovate', environment: 'preview', actionUrl: 'https://candidate.pages.dev'};
const deployment = {id: 'dep-1', url: expected.actionUrl, aliases: ['https://alias.pages.dev'], branch: expected.branch, environment: 'preview', deployment_trigger: {metadata: {commit_hash: commitSha}}, latest_stage: {name: 'deploy', status: 'success'}};

test('When the recorded scenario is exercised Then the contract demonstrates that selector records and accepts the official Pages deployment stage contract', () => {
  assert.equal(CLOUDFLARE_PAGES_DEPLOYMENTS_SOURCE, 'https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/');
  assert.deepEqual(selectPreviewDeployment({result: [deployment]}, expected), {id: 'dep-1', url: expected.actionUrl, aliases: [expected.actionUrl, 'https://alias.pages.dev'], branch: expected.branch, environment: 'preview', commitSha, latestStage: 'deploy'});
});

for (const [name, result] of [
  ['zero matches', []], ['ambiguous matches', [deployment, {...deployment, id: 'dep-2'}]], ['production environment', [{...deployment, environment: 'production'}]], ['mismatched branch', [{...deployment, branch: 'master'}]], ['failed stage', [{...deployment, latest_stage: {name: 'deploy', status: 'failure'}}]], ['invented success stage', [{...deployment, latest_stage: {name: 'Success', status: 'success'}}]], ['contradictory success name and failure status', [{...deployment, latest_stage: {name: 'Success', status: 'failure'}}]], ['missing stage status', [{...deployment, latest_stage: {name: 'deploy'}}]], ['mismatched commit', [{...deployment, deployment_trigger: {metadata: {commit_hash: 'b'.repeat(40)}}}]], ['missing URL', [{...deployment, url: ''}]], ['malformed payload', [{...deployment, latest_stage: null}]],
]) test(`selector fails closed for ${name}`, () => { assert.throws(() => selectPreviewDeployment({result}, expected)); });
test('When the recorded scenario is exercised Then the contract demonstrates that parser rejects malformed API JSON', () => assert.throws(() => parseDeploymentsResponse('{not-json')));
