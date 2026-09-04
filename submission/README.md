# Switch It — course submission index

**Switch It** is a phone-first web app that coordinates a **direct driver-to-driver parking handoff**. A publisher who is about to leave a public street spot matches with a specific seeker for a short, timed exchange. Switch It does **not** sell, reserve, own, or guarantee a public parking space.

## Links

| Item | URL |
| --- | --- |
| Production (Vercel) | [https://switch-it-wine.vercel.app](https://switch-it-wine.vercel.app) |
| GitHub repository | [https://github.com/rotemkap10/switch-it](https://github.com/rotemkap10/switch-it) |

## Required documents

These files are copies of the canonical documents in `docs/final-submission/`. If they diverge, the canonical files in the repository win.

| Course requirement | This folder |
| --- | --- |
| Product specification | [product-specification.md](./product-specification.md) |
| Technical design | [technical-design.md](./technical-design.md) |
| Test specification | [test-specification.md](./test-specification.md) |
| Basic scalability | [scale.md](./scale.md) |
| Basic security | [security.md](./security.md) |
| Local run instructions | [local-setup.md](./local-setup.md) |
| Final explanation deck | [Switch_It_Submission_Explanation_v3.pdf](./Switch_It_Submission_Explanation_v3.pdf) |

The PDF is the **final explanation deck** for the grader. This course submission does not require a live oral presentation.

Also see the repository root [README.md](../README.md) for overview, stack, environment variable **names**, and commands.

Implemented tests: Vitest — **277** files, **1744** passing (`npx vitest run`). There is no Playwright/Cypress project.

## What this folder does not contain

- Secret values, `.env.local`, or service-role keys
- The native iOS/Android binary
