# MoneyGuy

A personal finance application built with Next.js, Prisma, and OpenAI.

## Features

- 💰 Transaction tracking
- 📊 Budget management
- 🎯 Financial goals
- 🤖 AI financial assistant
- 📈 Real-time analytics

## Tech Stack

- Next.js 14
- TypeScript
- Prisma ORM
- PostgreSQL (Railway)
- NextAuth.js
- OpenAI API
- Tailwind CSS

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `./.env.example` to `.env.local` (and `./.env.production.example` to `.env.production` for deployment) and provide the values below
4. Run the development server: `npm run dev`

## Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `NEXTAUTH_SECRET` | 32-64 character secret used to sign NextAuth JWTs |
| `NEXTAUTH_URL` | Base URL of the app (`http://localhost:3000` in dev, your production domain when deployed) |
| `OPENAI_API_KEY` | API key for the OpenAI client that powers the chat assistant |

Built with ❤️ by Juan Sanchez


