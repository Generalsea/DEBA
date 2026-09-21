# DEBA

Modern marketplace and donation platform built with Next.js App Router and Supabase.

## Foundation

- Next.js App Router
- TypeScript
- Vercel deployment configuration
- GitHub Actions for test, typecheck, build, and optional Vercel deployment
- Supabase environment placeholders
- Arabic RTL app shell

## Vercel deployment

Connect this repository to Vercel and create a Vercel project for `Generalsea/DEBA`.

For CLI deployment through GitHub Actions, configure these repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never commit `SUPABASE_SERVICE_ROLE_KEY`.

## Local development

```bash
npm install
npm run dev
```
