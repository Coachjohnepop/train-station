This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy (GitHub + Supabase + Vercel)

See [DEPLOY.md](./DEPLOY.md) for the exact step-by-step (you do the logins; I run the commands, edits, and verification).

High level:
- Supabase Postgres (free tier) for the DB — replaces the local sqlite.
- GitHub for source + CI trigger.
- Vercel for hosting + automatic deploys + env var injection for DATABASE_URL.
- No DNS/custom domain steps yet (per request).

Local: `npm run dev`, `npm run db:push`, `npm run db:seed`, `npm run build`.
