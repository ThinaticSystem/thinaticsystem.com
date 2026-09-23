import assert from 'node:assert/strict';
import test from 'node:test';
import {CANDIDATE_BRANCH} from './build-pages.mjs';
import {parseDeploymentsResponse, selectPreviewDeployment} from './preview-deployment.mjs';

const commitSha = 'a'.repeat(40);
const expected = {commitSha, branch: CANDIDATE_BRANCH, environment: 'preview', actionUrl: 'https://candidate.pages.dev'};
const deployment = {id: 'dep-1', url: expected.actionUrl, aliases: ['https://alias.pages.dev'], branch: expected.branch, environment: 'preview', deployment_trigger: {metadata: {commit_hash: commitSha}}, latest_stage: {name: 'deploy', status: 'success'}};

for (const [name, result] of [
  ['zero matching deployments', []],
  ['ambiguous matching deployments', [deployment, {...deployment, id: 'dep-2'}]],
  ['production environment', [{...deployment, environment: 'production'}]],
  ['mismatched branch', [{...deployment, branch: 'master'}]],
  ['failed deploy stage', [{...deployment, latest_stage: {name: 'deploy', status: 'failure'}}]],
  ['invented success stage', [{...deployment, latest_stage: {name: 'Success', status: 'success'}}]],
  ['contradictory stage name and status', [{...deployment, latest_stage: {name: 'Success', status: 'failure'}}]],
  ['missing stage status', [{...deployment, latest_stage: {name: 'deploy'}}]],
  ['mismatched commit SHA', [{...deployment, deployment_trigger: {metadata: {commit_hash: 'b'.repeat(40)}}}]],
  ['missing deployment URL', [{...deployment, url: ''}]],
  ['malformed deployment record', [{...deployment, latest_stage: null}]],
]) test('Given Pages API data has ' + name + ' when readback selects a deployment then it is rejected', () => {
  assert.throws(() => selectPreviewDeployment({result}, expected));
});

test('Given malformed Pages API JSON when readback parses the response then it is rejected', () => {
  assert.throws(() => parseDeploymentsResponse('{not-json'));
});
