# Phase 5 deployment

ChessLens can still run as a static site. Phase 5 uses Supabase Auth,
PostgreSQL and PostgREST as its managed backend.

1. Create or select a Supabase project. Apply the SQL migration in
   `supabase/migrations` to a development project, then to the deployment
   project. Confirm row-level security policies exist on all four tables.
2. Enable email signup and email verification. Configure email delivery
   and Auth rate limits in the Supabase dashboard. For Google sign-in,
   enable its Auth provider and add the callback URL shown by Supabase
   to the Google OAuth client settings.
3. Add the production account URL to Auth redirect URLs. For GitHub Pages
   the account URL is
   `https://golfchinnawat.github.io/chesslens/?view=account`.
   Add `http://localhost:5173/?view=account` for local testing.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at build
   time. Use modern `sb_publishable_…` keys. The browser build must
   never contain a service role key or a Google OAuth secret.

## Frontend hosting

- **Vercel** or **Netlify**: select Vite, run `npm ci && npm run build`,
  publish `dist`, and supply the same environment variables.
- **GitHub Pages**: use the existing Pages deployment. The repository
  variables read by the workflow are optional. An unconfigured build
  keeps local review available and hides cloud save links.

After deploying, create two disposable accounts on the development project.
Confirm email verification and Google redirect flow, save a game with the
first account, and verify the second cannot read the review or training
positions. Check that account deletion cascades using disposable data only.

The PostgreSQL ownership tests run locally and in GitHub Actions. Browser
tests with mocked Auth and REST responses exercise the frontend wiring.
A live Supabase project is needed to verify email delivery and Google OAuth.

## Reproduce the browser test

Install the Python Playwright package and its Chromium browser in a test
environment. Build with fake browser configuration and serve the build:

```sh
VITE_SUPABASE_URL=https://chesslens-test.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test npm run build
npm run preview -- --port 4184
```

In a second terminal run `python tests/e2e/account.py`. The test intercepts
Supabase requests and uses real Stockfish for the PGN review.
