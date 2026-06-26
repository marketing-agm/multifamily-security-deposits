# /deploy-cf

Build and deploy to Cloudflare Pages.

**First-time setup** (run once):
```bash
npx wrangler login
npx wrangler pages project create agm-security-deposits
```

**Build for Cloudflare Pages:**
```bash
npm run build:cf
```

**Preview locally:**
```bash
npm run preview
```

**Deploy to production:**
```bash
npm run deploy
```

**Notes:**
- `wrangler.toml` is configured with `nodejs_compat` flag (required for pdf-lib and xlsx)
- The Cloudflare Pages project name is `agm-security-deposits`
- Set the build command in Cloudflare dashboard to: `npm run build:cf`
- Set the build output directory to: `.vercel/output/static`
- No environment variables required for v1
