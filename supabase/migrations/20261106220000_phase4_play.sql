-- Phase 4 claims a round step so two refreshes cannot score it twice.
-- The browser still cannot write rounds, answers, votes, or scores.

create or replace function public.claim_round_step(round_id uuid, step integer, next_resolution jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rounds
  set resolution = next_resolution
  where id = round_id
    and state = 'open'
    and coalesce((resolution->>'scored_inner')::integer, 0) < step;
  return found;
end;
$$;

create or replace function public.close_round(round_id uuid, next_resolution jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rounds
  set state = 'resolved',
      resolution = next_resolution
  where id = round_id
    and state = 'open';
  return found;
end;
$$;

revoke all on function public.claim_round_step(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.close_round(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_round_step(uuid, integer, jsonb) to service_role;
grant execute on function public.close_round(uuid, jsonb) to service_role;
