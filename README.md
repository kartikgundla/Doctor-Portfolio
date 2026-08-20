# Umika Homeopathy — Portfolio Site (secure edition)

A static portfolio site with a no-code content editor. The editor logs in and
saves changes straight to this GitHub repo, but does so through two small
serverless functions — so the GitHub token and login credentials **never**
reach the browser. This assumes deployment on **Vercel** (works with any
GitHub-connected Vercel project, zero extra config needed for the functions).

## What changed from the previous version — and why

The earlier version stored `VITE_GITHUB_TOKEN` and `VITE_ADMIN_CREDENTIAL_HASH`
as client-side environment variables. Anything prefixed `VITE_` gets bundled
directly into the JavaScript sent to every visitor's browser — meaning that
GitHub token (with write access to this repo) was visible to anyone who
opened dev tools. This version fixes that by moving both the login check and
the GitHub write into two serverless functions (`/api/login.js` and
`/api/save-content.js`) that run only on the server. The browser talks to
these functions over HTTPS; it never sees the token or the credential hash.

## Project structure

```
├── index.html                 # public site (fetches content.json client-side)
├── admin.html                  # login + editor UI, calls /api/login and /api/save-content
├── content.json                 # all editable site text + embedded photos
├── generate-credentials.html     # one-time local tool to create your login hash
├── api/
│   ├── login.js                    # verifies email+password, issues a signed session token
│   └── save-content.js              # verifies session token, writes content.json to GitHub
└── package.json
```

## One-time setup

### 1. Generate your admin login credentials
Open `generate-credentials.html` **locally in a browser** (double-click the file — it needs no server).
Enter the email and password you want to log into `admin.html` with, click Generate,
and copy the two values it shows you (`ADMIN_EMAIL` and `ADMIN_CREDENTIAL_HASH`).

### 2. Create a GitHub token for the site to use
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
Scope it to **only this repository**, with **Contents: Read and write** permission and nothing else.
Copy the token — you won't be able to see it again.

### 3. Set environment variables in Vercel
Project → Settings → Environment Variables. Add all of these (no `VITE_` prefix —
that's what keeps them server-only):

| Variable | Value |
|---|---|
| `ADMIN_EMAIL` | from step 1 |
| `ADMIN_CREDENTIAL_HASH` | from step 1 |
| `SESSION_SECRET` | any long random string (e.g. generate one at [1password.com/password-generator](https://1password.com/password-generator) or run `openssl rand -hex 32`) |
| `GITHUB_TOKEN` | from step 2 |
| `GITHUB_OWNER` | your GitHub username, e.g. `kartikgundla` |
| `GITHUB_REPO` | this repo's name, e.g. `Doctor-Portfolio` |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_PATH` | `content.json` |

Redeploy after adding these (Vercel → Deployments → ⋯ → Redeploy) so the functions pick them up.

### 4. (Optional) Set up EmailJS for the booking form
Open `index.html`, find the `EMAILJS_PUBLIC_KEY` / `EMAILJS_SERVICE_ID` / `EMAILJS_TEMPLATE_ID`
constants near the bottom of the script, and paste your real values from
[emailjs.com](https://www.emailjs.com). These are safe to hardcode directly — EmailJS's
public key is designed to be visible client-side, unlike the GitHub token.

## Day-to-day use (for the doctor)

1. Go to `yoursite.com/admin.html`.
2. Log in with the email/password from step 1.
3. Edit any text, upload photos.
4. Click **Save Changes** — this saves directly to the live site via GitHub. No downloads, no file uploads, no code.

## Local development

```bash
npm i -g vercel
vercel dev
```

This runs both the static site and the `/api` functions locally with your env vars
(create a `.env.local` file with the same variables listed above, or run `vercel env pull`).

## Security notes

- Never commit real values for `SESSION_SECRET` or `GITHUB_TOKEN` to this repo — they belong only in Vercel's environment variable settings.
- The GitHub token should be scoped to this repository only, with the minimum permission it needs (Contents: Read and write).
- If you ever suspect a token has leaked, revoke it immediately in GitHub settings and issue a new one.