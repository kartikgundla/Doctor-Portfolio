// /api/login.js
// Verifies the admin email + password against server-only env vars and
// issues a short-lived signed session token. Nothing here ever ships to
// the browser bundle — this file only runs on the server (Vercel function).

const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_CREDENTIAL_HASH = process.env.ADMIN_CREDENTIAL_HASH; // sha256(email::password)
  const SESSION_SECRET = process.env.SESSION_SECRET;

  if (!ADMIN_EMAIL || !ADMIN_CREDENTIAL_HASH || !SESSION_SECRET) {
    res.status(500).json({ error: 'Server is not configured yet — missing ADMIN_EMAIL, ADMIN_CREDENTIAL_HASH, or SESSION_SECRET.' });
    return;
  }

  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Missing email or password' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const hash = sha256(`${normalizedEmail}::${password}`);

    if (normalizedEmail !== ADMIN_EMAIL.trim().toLowerCase() || hash !== ADMIN_CREDENTIAL_HASH) {
      res.status(401).json({ error: "That email or password isn't right." });
      return;
    }

    // 2-hour session token, signed with a server-only secret.
    const payload = JSON.stringify({ exp: Date.now() + 1000 * 60 * 60 * 2 });
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const signature = sign(payloadB64, SESSION_SECRET);
    const token = `${payloadB64}.${signature}`;

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
};
