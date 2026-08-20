// /api/save-content.js
// Verifies the caller's session token, then pushes updated content.json
// to GitHub using a GitHub token that lives ONLY in this server-side
// environment. The token is never sent to, or readable by, the browser.

const crypto = require('crypto');

function verifySession(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payloadB64, signature] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  if (signature !== expectedSig) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) {
    res.status(500).json({ error: 'Server is not configured yet — missing SESSION_SECRET.' });
    return;
  }

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!verifySession(token, SESSION_SECRET)) {
    res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    return;
  }

  const { content } = req.body || {};
  if (!content) {
    res.status(400).json({ error: 'Missing content to save' });
    return;
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = process.env.GITHUB_OWNER;
  const GITHUB_REPO = process.env.GITHUB_REPO;
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
  const GITHUB_PATH = process.env.GITHUB_PATH || 'content.json';

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    res.status(500).json({ error: 'Server is not configured yet — missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO.' });
    return;
  }

  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`;

    // Need the current file's sha to update it.
    const getRes = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    if (!getRes.ok) throw new Error('Could not read the current file from GitHub.');
    const fileInfo = await getRes.json();

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const contentB64 = Buffer.from(contentStr, 'utf8').toString('base64');

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update site content via admin editor',
        content: contentB64,
        sha: fileInfo.sha,
        branch: GITHUB_BRANCH
      })
    });

    if (!putRes.ok) {
      const errBody = await putRes.json().catch(() => ({}));
      throw new Error(errBody.message || 'GitHub rejected the save.');
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
