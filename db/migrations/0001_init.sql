-- 灯 Tomoshibi: tasks and projects of signed-in people (guests stay on localStorage).
-- One row per item. `data` is the same JSON the browser keeps (src/store.ts: Task, Project),
-- so the board needs no mapping. `user_id` is the Clerk user id (the session token's `sub`).

CREATE TABLE IF NOT EXISTS projects (
  user_id    text        NOT NULL,
  id         text        NOT NULL,
  data       jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS tasks (
  user_id    text        NOT NULL,
  id         text        NOT NULL,
  data       jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- Applied migrations, so `npm run db:migrate` can run any number of times.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name       text        PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
