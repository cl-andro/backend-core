-- Rename raid vehicles from military theme to dev culture theme.
-- IDs (raid_helicopter, raid_drone, raid_rocket) stay the same so existing
-- purchases continue to work; only display name and description change.

UPDATE items
SET name = 'Mech Keyboard',
    description = 'Raid vehicle: mechanical keyboard with RGB underglow'
WHERE id = 'raid_helicopter';

UPDATE items
SET name = 'PC Tower',
    description = 'Raid vehicle: 90s beige PC tower with floppy and CD-ROM drives'
WHERE id = 'raid_drone';

UPDATE items
SET name = 'Hacker Rig',
    description = 'Raid vehicle: floating desk with CRT, keyboard, floppy stack and coffee mug'
WHERE id = 'raid_rocket';
