-- Remap developers.city_theme after THEMES array reorder.
--
-- Old order: 0=Midnight, 1=Sunset, 2=Neon, 3=Emerald
-- New order: 0=Emerald, 1=Midnight, 2=Sunset, 3=Neon
--
-- Mapping: 0→1, 1→2, 2→3, 3→0
--
-- Uses a two-step update via a temporary offset to avoid collisions
-- (e.g. setting rows from 0→1 and then 1→2 in a single pass would
-- double-update the rows that started at 0).

-- Step 1: shift every valid value up by 10 so they don't collide with target values.
update developers
set city_theme = city_theme + 10
where city_theme between 0 and 3;

-- Step 2: apply the final mapping from shifted values.
update developers
set city_theme = case city_theme
  when 10 then 1  -- Midnight (was 0)  → now 1
  when 11 then 2  -- Sunset   (was 1)  → now 2
  when 12 then 3  -- Neon     (was 2)  → now 3
  when 13 then 0  -- Emerald  (was 3)  → now 0
end
where city_theme between 10 and 13;
