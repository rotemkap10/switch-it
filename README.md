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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Progressive Web App (production)

Switch It is installable as a PWA on HTTPS deployments.

- Manifest: `/manifest.webmanifest`
- Service worker: `/sw.js` (production only; set `NEXT_PUBLIC_PWA_DEV=true` to test locally)
- Offline fallback: `/offline`
- Install entry: Profile menu → **Install app** (when supported)

Production QA: verify manifest, icons, and service worker in Chrome DevTools →
Application. No Supabase or MapTiler responses should appear in Cache Storage.

Phase 9B live location (two-phone): after claim, seeker taps **Share live location**
and grants permission; publisher should see Waiting → Live location on the
compact progress map. Background the seeker app and confirm the publisher moves
to delayed/paused by age. Complete/cancel/expire must remove the marker and stop
sharing. Live location must never appear in Cache Storage or any DB table.
Do not expect routing or ETA (Phase 9C).
