import {mkdirSync, writeFileSync} from 'node:fs';
import {selectPreviewDeployment, parseDeploymentsResponse} from './preview-deployment.mjs';
import {CANDIDATE_BRANCH} from './build-pages.mjs';

const actionUrl = process.argv[2];
const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const commitSha = process.env.GITHUB_SHA;
if (!actionUrl || !token || !accountId || !commitSha) throw new Error('deployment readback requires action URL and environment identity');
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/thinaticsystem-com/deployments`;
const response = await fetch(endpoint, {headers: {authorization: `Bearer ${token}`, accept: 'application/json'}});
if (!response.ok) throw new Error(`Pages deployment readback failed with HTTP ${response.status}`);
const selected = selectPreviewDeployment(parseDeploymentsResponse(await response.text()), {commitSha, branch: CANDIDATE_BRANCH, environment: 'preview', actionUrl});
mkdirSync('.artifacts', {recursive: true});
writeFileSync('.artifacts/deployment-witness.json', JSON.stringify({schema: 'thinaticsystem/pages-preview-witness/v1', ...selected}, null, 2) + '\n');
console.log(`Pages preview witness saved for deployment ${selected.id}`);
