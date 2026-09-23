import assert from 'node:assert/strict';
import test from 'node:test';
import {CANDIDATE_BRANCH} from './build-pages.mjs';
import {CLOUDFLARE_PAGES_DEPLOYMENTS_SOURCE, parseDeploymentsResponse, selectPreviewDeployment} from './preview-deployment.mjs';

const commitSha = 'a'.repeat(40);
const expected = {commitSha, branch: CANDIDATE_BRANCH, environment: 'preview', actionUrl: 'https://candidate.pages.dev'};
const deployment = {id: 'dep-1', url: expected.actionUrl, aliases: ['https://alias.pages.dev'], branch: expected.branch, environment: 'preview', deployment_trigger: {metadata: {commit_hash: commitSha}}, latest_stage: {name: 'deploy', status: 'success'}};

test('Given an exact candidate deployment when readback selects it then the documented successful Pages deploy stage and identity are accepted', () => {
  assert.equal(CLOUDFLARE_PAGES_DEPLOYMENTS_SOURCE, 'https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/');
  assert.deepEqual(selectPreviewDeployment({result: [deployment]}, expected), {id: 'dep-1', url: expected.actionUrl, aliases: [expected.actionUrl, 'https://alias.pages.dev'], branch: expected.branch, environment: 'preview', commitSha, latestStage: 'deploy'});
  assert.equal(expected.branch, 'chore/modernization-renovate');
});

test('Given valid JSON text when the deployment response is parsed then its API object is returned', () => {
  assert.deepEqual(parseDeploymentsResponse(JSON.stringify({result: [deployment]})), {result: [deployment]});
});
