-- Redraw — re-draw a winner when the drawn one is absent.
-- Each raffle keeps its own list of already-excluded winners (excluded_winner_ids),
-- so exclusions are scoped to a single raffle and never affect any other raffle.
alter table raffles
  add column if not exists excluded_winner_ids uuid[] not null default '{}';

-- Atomic redraw: excludes the current (absent) winner and draws a new one from
-- the remaining participants of THIS raffle, all inside one transaction.
-- The `for update` row lock serializes concurrent redraws on the same raffle so
-- a rapid double-call can never lose an exclusion (no read-modify-write race).
-- Raises on error so the whole change rolls back, leaving the raffle untouched:
--   raffle_not_found          — no raffle with that id
--   no_current_winner         — nothing has been drawn yet, nothing to redraw
--   no_eligible_participants  — every participant has already been excluded
create or replace function redraw_raffle_winner(p_raffle_id uuid)
returns table (winner_id uuid, winner_name text, winner_phone text, excluded_id uuid)
language plpgsql
security definer
as $$
declare
  v_current  uuid;
  v_excluded uuid[];
  v_new      raffle_participants%rowtype;
begin
  select r.winner_id, r.excluded_winner_ids
    into v_current, v_excluded
    from raffles r
   where r.id = p_raffle_id
   for update;

  if not found then
    raise exception 'raffle_not_found';
  end if;

  if v_current is null then
    raise exception 'no_current_winner';
  end if;

  -- Exclude the current winner from this raffle only (dedup the array).
  v_excluded := (select array(select distinct unnest(array_append(v_excluded, v_current))));

  -- Draw a new winner among the not-yet-excluded participants of this raffle.
  select p.* into v_new
    from raffle_participants p
   where p.raffle_id = p_raffle_id
     and not (p.id = any (v_excluded))
   order by random()
   limit 1;

  if not found then
    raise exception 'no_eligible_participants';
  end if;

  update raffles
     set winner_id = v_new.id,
         excluded_winner_ids = v_excluded
   where id = p_raffle_id;

  winner_id    := v_new.id;
  winner_name  := v_new.name;
  winner_phone := v_new.phone;
  excluded_id  := v_current;
  return next;
end;
$$;
