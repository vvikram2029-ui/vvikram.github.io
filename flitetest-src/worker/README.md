# flitetest helper worker (free)

One small Cloudflare Worker gives the site:

- **AI chat**: Google Gemini's free tier if you add a key, otherwise Cloudflare Workers AI, which is free (10,000 "neurons" a day).
- **Uploads**: the Import button sends the already-encrypted .ork here, and the worker commits it with a GitHub token that never reaches a browser. Teammates need only the site password.
- **Stocks + world news** for the ticker (Yahoo Finance and BBC block browsers, so the worker relays them, cached for 5 minutes).
- **Build status**, so a school's shared IP doesn't hit GitHub's anonymous rate limit.

Everything here fits in free plans and no credit card is needed.

## Set up (about 10 minutes, once)

1. Make a free Cloudflare account at https://dash.cloudflare.com/sign-up.
2. In a terminal, from this folder (`flitetest-src/worker`):
   ```bash
   npx wrangler login
   npx wrangler deploy
   ```
   It prints the worker URL, e.g. `https://flitetest.<your-subdomain>.workers.dev`.
3. Add the secrets (each command prompts you to paste a value):
   ```bash
   npx wrangler secret put AUTH_HASH
   ```
   Value: on the site, open **Import .ork → Connection settings → Copy worker auth hash**. It's derived from the site password, so if you change the password, update this too.
   ```bash
   npx wrangler secret put GITHUB_TOKEN
   ```
   Value: a fine-grained token from https://github.com/settings/personal-access-tokens/new with repository access set to **only `yoda-3x3/yoda-3x3.github.io`** and permissions **Contents: Read and write** and **Actions: Read-only**.
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
   Optional but recommended: a free key from https://aistudio.google.com/apikey gives smarter answers and a bigger daily quota. Without it, chat uses Workers AI (Llama 3.3 70B).
4. Put the worker URL in `flitetest-src/config.json` (`"worker_url": "https://flitetest.<you>.workers.dev"`) and push. The GitHub Action rebuilds the site so everyone gets it. Until then, you can paste the URL under **Import .ork → Connection settings**, which saves it in your browser only.

Check it with `https://flitetest.<you>.workers.dev/health` (live: https://flitetest.flitetest-bhs.workers.dev/health).
