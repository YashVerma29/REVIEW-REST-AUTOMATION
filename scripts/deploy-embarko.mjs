import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Resolve Token
let token = process.env.DEPLOY_TOKEN;
const credPath = path.join(os.homedir(), '.embarko', 'credentials');
if (!token && fs.existsSync(credPath)) {
  token = fs.readFileSync(credPath, 'utf8').trim();
}

if (!token) {
  console.error('ERROR: No deploy token found in DEPLOY_TOKEN or ~/.embarko/credentials.');
  process.exit(1);
}

console.log(`[1/5] Deploy token found (${token.substring(0, 10)}...)`);

// 2. Create tarball
const tarPath = path.join(rootDir, 'app.tar.gz');
if (fs.existsSync(tarPath)) {
  fs.unlinkSync(tarPath);
}

console.log('[2/5] Creating application tarball (excluding node_modules, .env, .git)...');
execSync(
  'tar -czf app.tar.gz --exclude=node_modules --exclude=.git --exclude=.env* --exclude=app.tar.gz .',
  { cwd: rootDir, stdio: 'inherit' }
);

const tarStats = fs.statSync(tarPath);
console.log(`Tarball created: ${tarPath} (${(tarStats.size / 1024).toFixed(1)} KB)`);

// 3. Deploy to Embarko
let appName = 'restaurant-review-to-revenue';
console.log(`[3/5] Deploying "${appName}" to https://ship.embarko.ai/apps...`);

async function deployApp(targetName) {
  const fileBuffer = fs.readFileSync(tarPath);
  const formData = new FormData();
  formData.append('source', new Blob([fileBuffer]), 'app.tar.gz');

  const response = await fetch('https://ship.embarko.ai/apps', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-App-Name': targetName,
      'X-Agent-Name': 'antigravity'
    },
    body: formData
  });

  const bodyText = await response.text();
  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = { raw: bodyText };
  }

  if (!response.ok) {
    if (response.status === 409) {
      console.warn(`App name "${targetName}" is already taken (409). Trying fallback name...`);
      return null;
    }
    throw new Error(`Deployment failed HTTP ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

let deployResult = await deployApp(appName);
if (!deployResult) {
  appName = 'reviewpilot-ai';
  console.log(`Retrying with app name "${appName}"...`);
  deployResult = await deployApp(appName);
  if (!deployResult) {
    appName = `reviewpilot-${Date.now().toString(36)}`;
    console.log(`Retrying with app name "${appName}"...`);
    deployResult = await deployApp(appName);
  }
}

console.log('Deploy response:', JSON.stringify(deployResult, null, 2));

// 4. Set Environment Variables
console.log(`[4/5] Configuring environment variables for "${appName}"...`);
try {
  const envRes = await fetch(`https://ship.embarko.ai/api/apps/${appName}/env-vars`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Agent-Name': 'antigravity',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vars: [
        { key: 'VIASOCKET_ORG_ID', value: '70933' },
        { key: 'VIASOCKET_PROJECT_ID', value: 'projHSG4Qlrb' },
        { key: 'VIASOCKET_EMBED_SECRET', value: 'QptxmPwPJ7DeFY6NYaJ4CCWdINwvm0EUa7zDgmLKQzx' }
      ],
      apply: true
    })
  });
  const envJson = await envRes.json().catch(() => ({}));
  console.log('Env vars result:', envRes.status, envJson);
} catch (err) {
  console.warn('Note setting env vars:', err.message);
}

// 5. Poll Status
console.log(`[5/5] Polling status for "${appName}" until live...`);
const maxWaitMs = 360000; // 6 minutes
const startTime = Date.now();
let finalStatus = null;

while (Date.now() - startTime < maxWaitMs) {
  await new Promise(r => setTimeout(r, 6000));
  try {
    const statusRes = await fetch(`https://ship.embarko.ai/apps/${appName}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (statusRes.ok) {
      const data = await statusRes.json();
      console.log(`Status: ${data.status} | Step: ${data.step || ''} | Details: ${data.message || ''}`);
      if (['live', 'ready'].includes(data.status)) {
        finalStatus = data;
        break;
      }
      if (['failed', 'crashed'].includes(data.status)) {
        throw new Error(`Deployment failed with status: ${data.status} - ${JSON.stringify(data)}`);
      }
    } else {
      console.log(`Status check HTTP ${statusRes.status}`);
    }
  } catch (err) {
    console.warn(`Polling notice: ${err.message}`);
  }
}

// Clean up tarball
try {
  if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
} catch (_) {}

const liveUrl = `https://${appName}.embarko.app`;
console.log(`\n========================================`);
console.log(`Application deployed successfully!`);
console.log(`Live URL: ${liveUrl}`);
console.log(`========================================\n`);

// Quick live check
try {
  console.log(`Testing ${liveUrl}/api/health ...`);
  const testRes = await fetch(`${liveUrl}/api/health`);
  const testBody = await testRes.text();
  console.log(`Health check: HTTP ${testRes.status} -> ${testBody}`);
} catch (e) {
  console.warn(`Initial health ping: ${e.message}`);
}
