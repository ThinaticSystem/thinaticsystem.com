const sha = /^[a-f0-9]{40}$/;
const text = value => typeof value === 'string' && value.trim() !== '';

function commitOf(deployment) {
  return deployment?.deployment_trigger?.metadata?.commit_hash ?? deployment?.deployment_trigger?.metadata?.commitSha ?? deployment?.commit_hash ?? null;
}
function stageSucceeded(deployment) {
  const stage = deployment?.latest_stage;
  return stage?.status === 'success' || stage?.status === 'successfully_deployed' || stage?.name === 'Success';
}
function aliasesOf(deployment) {
  return [deployment?.url, ...(Array.isArray(deployment?.aliases) ? deployment.aliases : [])].filter(text);
}

/** Pure, fail-closed selection of exactly one Pages preview deployment. */
export function selectPreviewDeployment(payload, expected) {
  const deployments = payload?.result;
  if (!Array.isArray(deployments)) throw new Error('Pages deployments response has no result array');
  if (!sha.test(expected.commitSha) || expected.branch !== 'chore-modernization-renovate' || expected.environment !== 'preview' || !text(expected.actionUrl)) throw new Error('invalid expected deployment identity');
  const matches = deployments.filter(item => commitOf(item) === expected.commitSha && item.branch === expected.branch && item.environment === expected.environment && stageSucceeded(item) && aliasesOf(item).includes(expected.actionUrl));
  if (matches.length !== 1) throw new Error(`expected exactly one successful preview deployment, observed ${matches.length}`);
  const [deployment] = matches;
  if (!text(deployment.id) || !text(deployment.url) || deployment.environment !== 'preview' || deployment.branch !== expected.branch || commitOf(deployment) !== expected.commitSha) throw new Error('selected deployment identity is malformed');
  return {id: deployment.id, url: deployment.url, aliases: aliasesOf(deployment), branch: deployment.branch, environment: deployment.environment, commitSha: commitOf(deployment), latestStage: deployment.latest_stage?.name ?? deployment.latest_stage?.status ?? 'success'};
}

export function parseDeploymentsResponse(textBody) {
  try { return JSON.parse(textBody); } catch { throw new Error('Pages deployments response is not JSON'); }
}
