# Phase 5 data model

Supabase Auth owns users, password hashing, verification and session refresh.
PostgreSQL owns games and reviews. Each game belongs to the authenticated user
and is unique per owner and PGN fingerprint. Each game can have one review
per depth. The uploaded JSON is a client-computed display record and cannot
affect access control. Deleting a game cascades to its reviews and training
positions. Deleting an account cascades to all its application records.

- `games` stores PGN, source, result, time control, date and opening metadata.
- `reviews` stores engine version, depth, config version and review JSON.
- `mistake_positions` stores training positions and scheduling progress.
- `settings` stores profile preferences keyed by the authenticated user ID.

PostgREST provides the authenticated REST interface. Row-level ownership
applies even when a request is sent directly to the REST API. The review
upsert runs transactionally in an invoker-rights function.
