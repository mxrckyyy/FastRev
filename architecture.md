# Architecture — Student Review System

## High-Level Flow
1. User authenticates via Supabase Auth.
2. User creates a deck (course).
3. User pastes notes → AI generates atomic flashcards.
4. User reviews cards → FSRS schedules next review.
5. Dashboard shows retention, weak topics, due cards.

## Component Map
- `src/lib/supabase.js` — Supabase client singleton.
- `src/lib/fsrs.js` — FSRS scheduling wrapper.
- `src/lib/ai.js` — Gemini card generation + fallback providers.
- `src/hooks/useAuth.js` — Auth context (user, signIn, signUp, signOut).
- `src/hooks/useDecks.js` — CRUD for decks.
- `src/hooks/useCards.js` — CRUD for cards.
- `src/hooks/useReviews.js` — Review queue, submission, FSRS update.
- `src/hooks/useAnalytics.js` — Aggregations: retention, streak, due forecast, activity, weak decks.
- `src/components/ErrorBoundary.jsx` — Global error boundary wrapping the router.
- `src/pages/Auth.jsx` — Login / signup page.
- `src/pages/DeckList.jsx` — Deck list + create deck.
- `src/pages/DeckDetail.jsx` — Cards inside a deck.
- `src/pages/Review.jsx` — Daily review session UI.
- `src/pages/Upload.jsx` — Notes → card generation UI.
- `src/pages/Settings.jsx` — API key settings dialog (localStorage only).
- `src/pages/Analytics.jsx` — Retention stats and forecasts.
- `src/pages/Dashboard.jsx` — Post-login landing: welcome + sign-out (gains stats later).
- `src/App.jsx` — Router + layout.
- `src/main.jsx` — App entry point.

## Database Schema (Supabase)
- `decks` (id, user_id, name, description, created_at)
- `cards` (
    id, deck_id, user_id, question, answer, source,
    due, stability, difficulty, elapsed_days, scheduled_days,
    reps, lapses, state, last_review, created_at
  )
- `review_logs` (id, card_id, user_id, rating, reviewed_at)

All tables have RLS enabled with `auth.uid() = user_id` policies.

## External Services
- Supabase (DB, Auth, RLS, pgvector)
- Google Gemini 2.5 Flash (card generation)
- Groq / Cerebras (fallback LLM providers)
- Vercel (frontend hosting)

## Data Flow: Card Generation
1. User pastes notes in `Upload.jsx`.
2. `ai.js` sends notes to Gemini with a structured JSON prompt.
3. Gemini returns array of `{ question, answer, source }`.
4. User edits/approves cards in the preview UI.
5. `useCards.js` inserts approved cards into the `cards` table.

## Data Flow: Review Session
1. `useReviews.js` queries `cards WHERE due <= now() AND user_id = auth.uid()`.
2. User rates card (Again / Hard / Good / Easy).
3. `fsrs.js` computes the next scheduling state via `ts-fsrs`.
4. `useReviews.js` updates the card row + inserts a `review_logs` row.
5. UI advances to the next card in the queue.

## File Extension Rules
- React components: `.jsx`
- Hooks, libs, utilities: `.js`
- Config: `vite.config.js`, `tailwind.config.js` (if needed)
- NO `.ts` or `.tsx` files in this project.
- `ts-fsrs` is an external npm package (compiled JS) — safe to import from `.js`.