-- =============================================================
-- ZF Cup — 01_tables.sql
-- Vytvoření všech tabulek v pořadí FK závislostí.
-- Bezpečné opakované spuštění: CREATE TABLE IF NOT EXISTS
-- =============================================================

-- -------------------------------------------------------
-- 1. TOURNAMENT — globální parametry turnaje (žádné FK)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL DEFAULT '',
  subtitle             TEXT DEFAULT '',
  date                 TEXT DEFAULT '',
  venue                TEXT DEFAULT '',
  description          TEXT DEFAULT '',
  tips_enabled         BOOLEAN DEFAULT false,
  format               TEXT DEFAULT 'groups',        -- 'groups' | 'league'
  match_duration       INTEGER DEFAULT 20,
  halves               SMALLINT DEFAULT 1,
  playoff_kickoff      TEXT DEFAULT '',
  round_break          INTEGER DEFAULT 5,
  tips_lock_from       TEXT DEFAULT '',              -- YYYY-MM-DD; datový zámek tipů
  num_teams            INTEGER DEFAULT 0,
  num_groups           INTEGER DEFAULT 2,
  advancing_per_group  INTEGER DEFAULT 2,
  num_pitches          INTEGER DEFAULT 2,            -- počet souběžných hřišť
  rules_content        TEXT DEFAULT '',              -- text pravidel (pre-wrap)
  league_has_playoff   BOOLEAN DEFAULT true,
  created_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at           TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 2. TEAMS (žádné FK)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#2563eb',
  logo_url   TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 3. REFEREES (žádné FK)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS referees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 4. ANNOUNCEMENTS (žádné FK)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon       TEXT DEFAULT '',
  title      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  position   INTEGER DEFAULT 0,
  type       TEXT DEFAULT 'text',     -- 'text' | 'image' | 'video'
  media_url  TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 5. PLAYERS — FK → teams
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  number     INTEGER,
  role       TEXT,   -- NULL | 'captain' | 'goalkeeper' | 'both'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 6. GROUPS — žádné FK (team_ids je pole, ne relace)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  team_ids        TEXT[] NOT NULL DEFAULT '{}',
  schedule        TEXT DEFAULT 'once',           -- 'once' | 'twice'
  tiebreaker      TEXT DEFAULT 'score_then_h2h', -- 'score_first' | 'h2h_first' | 'score_then_h2h'
  start_time      TEXT NOT NULL DEFAULT '',
  match_duration  INTEGER DEFAULT 20,
  break_between   INTEGER DEFAULT 5,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 7. MATCHES — FK → groups (SET NULL), teams
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID REFERENCES groups(id) ON DELETE SET NULL,
  round          TEXT NOT NULL DEFAULT '',         -- TEXT NOT NULL (název skupiny nebo 'Liga')
  home_id        UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  away_id        UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  home_score     INTEGER DEFAULT 0,
  away_score     INTEGER DEFAULT 0,
  played         BOOLEAN DEFAULT false,
  scheduled_time TEXT NOT NULL DEFAULT '',         -- TEXT NOT NULL; '' pro nenaplánované
  referee_id     UUID REFERENCES referees(id) ON DELETE SET NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 8. GOALS — FK → players, matches (CASCADE)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS goals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  count      INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(player_id, match_id)
);

-- -------------------------------------------------------
-- 9. BRACKET_ROUNDS — žádné FK
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  position        INTEGER NOT NULL UNIQUE,
  scheduled_start TEXT DEFAULT '',
  break_after     INTEGER DEFAULT 5,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 10. BRACKET_SLOTS — FK → bracket_rounds (CASCADE), teams (SET NULL), referees (SET NULL)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_slots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id       UUID NOT NULL REFERENCES bracket_rounds(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  home_id        UUID REFERENCES teams(id) ON DELETE SET NULL,
  away_id        UUID REFERENCES teams(id) ON DELETE SET NULL,
  home_score     INTEGER DEFAULT 0,
  away_score     INTEGER DEFAULT 0,
  played         BOOLEAN DEFAULT false,
  scheduled_time TEXT,                            -- TEXT nullable
  referee_id     UUID REFERENCES referees(id) ON DELETE SET NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 11. BRACKET_GOALS — FK → bracket_slots (CASCADE), players (CASCADE)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_goals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id    UUID NOT NULL REFERENCES bracket_slots(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  count      INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(slot_id, player_id)
);

-- -------------------------------------------------------
-- 12. TIPSTERS — žádné FK
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS tipsters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  pin          CHAR(4) NOT NULL,
  total_points INTEGER DEFAULT 0,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- 13. TIPS — FK → tipsters (CASCADE), matches (CASCADE)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS tips (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id     UUID NOT NULL REFERENCES tipsters(id) ON DELETE CASCADE,
  match_id       UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home INTEGER NOT NULL DEFAULT 0,
  predicted_away INTEGER NOT NULL DEFAULT 0,
  points_earned  INTEGER DEFAULT 0,
  evaluated      BOOLEAN DEFAULT false,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tipster_id, match_id)
);

-- -------------------------------------------------------
-- 14. BRACKET_TIPS — FK → tipsters (CASCADE), bracket_slots (CASCADE)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_tips (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id     UUID NOT NULL REFERENCES tipsters(id) ON DELETE CASCADE,
  slot_id        UUID NOT NULL REFERENCES bracket_slots(id) ON DELETE CASCADE,
  predicted_home INTEGER NOT NULL DEFAULT 0,
  predicted_away INTEGER NOT NULL DEFAULT 0,
  points_earned  INTEGER DEFAULT 0,
  evaluated      BOOLEAN DEFAULT false,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tipster_id, slot_id)
);

-- -------------------------------------------------------
-- 15. SPECIAL_TIPS — FK → tipsters (CASCADE), teams (CASCADE)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS special_tips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id        UUID NOT NULL REFERENCES tipsters(id) ON DELETE CASCADE,
  tip_type          TEXT NOT NULL,
  -- 'tournament_winner' | 'group_winner:{groupId}' | 'group_last:{groupId}'
  predicted_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  points_earned     INTEGER DEFAULT 0,
  evaluated         BOOLEAN DEFAULT false,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tipster_id, tip_type)
);
