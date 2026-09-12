-- Placeholder challenge list. Replace with the finalized live list (Section 16
-- of the plan) before the event — the QR codes encode only the page, never a
-- challenge id, so the rows here can change right up to hunt morning.
--
-- max_claims is the field doing the work:
--   1        true Golden Ticket, genuine scarcity
--   6-8      capped Type B stop, business-protection cap
--   999      normal open Type A/C/D challenge

insert into challenges (name, category, points, max_claims, page) values
  -- Page AB
  ('Photo with the Krog Street tunnel mural',            'A', 10,  999, 'ab'),
  ('Team selfie on the Eastside Trail overlook',         'A', 10,  999, 'ab'),
  ('Find the oldest date carved on a Ponce building',    'A', 15,  999, 'ab'),
  ('Buy something from a Ponce City Market maker',       'B', 20,    8, 'ab'),
  ('Order the staff pick at a partner coffee shop',      'B', 20,    6, 'ab'),
  ('Get a partner shop owner in your team photo',        'B', 25,    6, 'ab'),

  -- Page CD
  ('Name the three streets meeting at the fountain',     'C', 10,  999, 'cd'),
  ('Sketch the skyline from Historic Fourth Ward Park',  'C', 15,  999, 'cd'),
  ('Count the arches on the trestle bridge',             'C', 10,  999, 'cd'),
  ('Do the whole loop of the park lake',                 'D', 15,  999, 'cd'),
  ('Teach a stranger the team handshake',                'D', 20,  999, 'cd'),
  ('Recreate a historic Fourth Ward photo on location',  'D', 25,  999, 'cd'),

  -- Bonus page
  ('GOLDEN TICKET: first team to the skate park sign',   'bonus', 50, 1, 'bonus'),
  ('GOLDEN TICKET: find the hidden brick marker',        'bonus', 50, 1, 'bonus'),
  ('Bonus: full team cartwheel on the trail',            'bonus', 15, 999, 'bonus');
