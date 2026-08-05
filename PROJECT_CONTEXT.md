# Switch It – Project Context

## Product

Switch It is a responsive web application that helps drivers coordinate the
handoff of public street parking spots.

A user who is about to leave a parking spot can publish its location and
expected availability time. Another authenticated user can claim the spot for
a limited period.

## Course requirements

The project is built for the RUNI Internet Technologies final assignment.

Required technologies:

- Next.js
- TypeScript
- Supabase
- Vercel

The project must demonstrate:

- Product thinking
- Authentication
- Authorization
- Database design
- CRUD operations
- Business logic
- Testing
- Basic security
- Basic scalability
- Deployment
- Technical documentation

## MVP

1. User registration, login and logout.
2. User profile with a credit balance.
3. Map showing available parking spots.
4. Publishing a parking spot.
5. Claiming a parking spot.
6. Preventing more than one active claim for a spot.
7. Completing or cancelling a claim (verified handoff code on completion).
8. Mandatory vehicle onboarding before using the main app.
8. Credit transactions.
9. User activity history.
10. Responsive user interface.
11. Live UI updates for active handoffs via Supabase Realtime (invalidation + refresh).

## Non-goals for the MVP

- Real payments
- Native mobile application
- Push notifications
- Chat
- AI features
- Computer vision
- Municipal integrations
- Complex rating system

## Technical principles

- Use Next.js App Router.
- Use strict TypeScript and avoid `any`.
- Keep business-critical logic on the server or in the database.
- Validate external input with Zod.
- Use Supabase Row Level Security.
- Never expose service-role keys in client-side code.
- Store database changes in migration files.
- Keep components focused and reasonably small.
- Add tests for central business flows (including handoff code validation).
- Prefer simple, readable solutions over unnecessary abstractions.
- Explain every library and architectural decision.