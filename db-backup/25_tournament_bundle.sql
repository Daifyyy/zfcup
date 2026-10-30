-- ════════════════════════════════════════════════════════════════════════════
-- 25 — Data turnaje jedním dotazem (audit P2: sloučení startovních dotazů)
-- ════════════════════════════════════════════════════════════════════════════
--   tournament_bundle(p_tournament) → JSON se všemi tabulkami turnaje, stejné řazení jako hooky.
--   SECURITY INVOKER (výchozí): platí RLS volajícího — soukromý turnaj jen s kódem / vlastník,
--   přesně jako dosavadní samostatné dotazy. Nic nového nezpřístupňuje.
-- Frontend (src/lib/bundle.ts) ji používá při otevření turnaje a pravidelné obnově (1 dotaz místo ~19);
-- po uložení a při realtime změně dál čte jen jednu tabulku. Bez této migrace se použijí původní dotazy.
-- Idempotentní.

CREATE OR REPLACE FUNCTION public.tournament_bundle(p_tournament UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'tournament',        (SELECT to_jsonb(t) FROM tournament t WHERE t.id = p_tournament),
    'teams',             coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM teams x WHERE x.tournament_id = p_tournament), '[]'),
    'players',           coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.number) FROM players x WHERE x.tournament_id = p_tournament), '[]'),
    'groups',            coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM groups x WHERE x.tournament_id = p_tournament), '[]'),
    'matches',           coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.scheduled_time NULLS LAST, x.id) FROM matches x WHERE x.tournament_id = p_tournament), '[]'),
    'goals',             coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM goals x WHERE x.tournament_id = p_tournament), '[]'),
    'assists',           coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM assists x WHERE x.tournament_id = p_tournament), '[]'),
    'cards',             coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM cards x WHERE x.tournament_id = p_tournament), '[]'),
    'penalties',         coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM penalties x WHERE x.tournament_id = p_tournament), '[]'),
    'bracket_rounds',    coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM bracket_rounds x WHERE x.tournament_id = p_tournament), '[]'),
    'bracket_slots',     coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM bracket_slots x WHERE x.tournament_id = p_tournament), '[]'),
    'bracket_goals',     coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM bracket_goals x WHERE x.tournament_id = p_tournament), '[]'),
    'bracket_assists',   coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM bracket_assists x WHERE x.tournament_id = p_tournament), '[]'),
    'bracket_cards',     coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM bracket_cards x WHERE x.tournament_id = p_tournament), '[]'),
    'bracket_penalties', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM bracket_penalties x WHERE x.tournament_id = p_tournament), '[]'),
    'announcements',     coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM announcements x WHERE x.tournament_id = p_tournament), '[]'),
    'rule_items',        coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM rule_items x WHERE x.tournament_id = p_tournament), '[]'),
    'referees',          coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name) FROM referees x WHERE x.tournament_id = p_tournament), '[]'),
    'sponsors',          coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM sponsors x WHERE x.tournament_id = p_tournament), '[]')
  );
$$;

-- Diváci (anon) i přihlášení smějí volat — data filtruje RLS volajícího.
GRANT EXECUTE ON FUNCTION public.tournament_bundle(UUID) TO anon, authenticated;

-- Ověření: SELECT jsonb_array_length(public.tournament_bundle('<id>') -> 'matches');
