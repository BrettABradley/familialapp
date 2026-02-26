
-- ============================================================
-- Demo data for "Test" circle: ff8b3fee-518c-4701-98ef-5db86f6dfd17
-- Owner: 59b40736-dbc2-48aa-9c78-4e4b7bfc78cd
-- ============================================================

DO $$
DECLARE
  v_circle_id uuid := 'ff8b3fee-518c-4701-98ef-5db86f6dfd17';
  v_owner_id  uuid := '59b40736-dbc2-48aa-9c78-4e4b7bfc78cd';

  v_mom     uuid := 'a1111111-1111-1111-1111-111111111111';
  v_dad     uuid := 'a2222222-2222-2222-2222-222222222222';
  v_sister  uuid := 'a3333333-3333-3333-3333-333333333333';
  v_brother uuid := 'a4444444-4444-4444-4444-444444444444';
  v_cousin  uuid := 'a5555555-5555-5555-5555-555555555555';
  v_grandma uuid := 'a6666666-6666-6666-6666-666666666666';

  v_post1 uuid := 'b1111111-1111-1111-1111-111111111111';
  v_post2 uuid := 'b2222222-2222-2222-2222-222222222222';
  v_post3 uuid := 'b3333333-3333-3333-3333-333333333333';
  v_post4 uuid := 'b4444444-4444-4444-4444-444444444444';
  v_post5 uuid := 'b5555555-5555-5555-5555-555555555555';
  v_post6 uuid := 'b6666666-6666-6666-6666-666666666666';
  v_post7 uuid := 'b7777777-7777-7777-7777-777777777777';
  v_post8 uuid := 'b8888888-8888-8888-8888-888888888888';
  v_post9 uuid := 'b9999999-9999-9999-9999-999999999999';
  v_post10 uuid := 'baaaaaa0-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  v_album1 uuid := 'c1111111-1111-1111-1111-111111111111';
  v_album2 uuid := 'c2222222-2222-2222-2222-222222222222';
  v_album3 uuid := 'c3333333-3333-3333-3333-333333333333';

  v_event1 uuid := 'd1111111-1111-1111-1111-111111111111';
  v_event2 uuid := 'd2222222-2222-2222-2222-222222222222';
  v_event3 uuid := 'd3333333-3333-3333-3333-333333333333';
  v_event4 uuid := 'd4444444-4444-4444-4444-444444444444';

BEGIN

-- 0. Create fake auth users (minimal records so FK constraints are satisfied)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
VALUES
  (v_mom,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-mom@familial.test',     crypt('DemoPass123!', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  (v_dad,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-dad@familial.test',     crypt('DemoPass123!', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  (v_sister,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-sarah@familial.test',   crypt('DemoPass123!', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  (v_brother, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-jake@familial.test',    crypt('DemoPass123!', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  (v_cousin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-mia@familial.test',     crypt('DemoPass123!', gen_salt('bf')), now(), now(), now(), '', '', '', ''),
  (v_grandma, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo-grandma@familial.test', crypt('DemoPass123!', gen_salt('bf')), now(), now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 1. Fake profiles
INSERT INTO profiles (user_id, display_name, bio, location) VALUES
  (v_mom,     'Mom',          'Family organizer & recipe collector', 'Austin, TX'),
  (v_dad,     'Dad',          'Grill master & weekend golfer',       'Austin, TX'),
  (v_sister,  'Sarah',        'College senior, dog lover 🐶',        'San Antonio, TX'),
  (v_brother, 'Jake',         'High school athlete & gamer',         'Austin, TX'),
  (v_cousin,  'Cousin Mia',   'Travel nurse & foodie',               'Denver, CO'),
  (v_grandma, 'Grandma Rose', 'Retired teacher, loves gardening 🌻', 'Houston, TX')
ON CONFLICT (user_id) DO NOTHING;

-- 2. Circle memberships
INSERT INTO circle_memberships (circle_id, user_id, role) VALUES
  (v_circle_id, v_mom,     'member'),
  (v_circle_id, v_dad,     'member'),
  (v_circle_id, v_sister,  'member'),
  (v_circle_id, v_brother, 'member'),
  (v_circle_id, v_cousin,  'member'),
  (v_circle_id, v_grandma, 'member')
ON CONFLICT DO NOTHING;

-- 3. Feed posts
INSERT INTO posts (id, author_id, circle_id, content, created_at) VALUES
  (v_post1, v_mom,     v_circle_id, 'Just tried a new lasagna recipe — turned out amazing! Will bring it to the next family dinner 🍝',   now() - interval '28 days'),
  (v_post2, v_dad,     v_circle_id, 'Who''s up for a fishing trip next Saturday? The lake is finally stocked again 🎣',                    now() - interval '25 days'),
  (v_post3, v_sister,  v_circle_id, 'Got accepted into the honors program!! 🎉🎉 Thank you everyone for the support!',                     now() - interval '22 days'),
  (v_post4, v_grandma, v_circle_id, 'My tomatoes are finally coming in. I''ll have bags of them if anyone wants some! 🍅',                 now() - interval '20 days'),
  (v_post5, v_brother, v_circle_id, 'Our team won the regional championship today! State finals here we come 🏆',                          now() - interval '17 days'),
  (v_post6, v_cousin,  v_circle_id, 'Sending love from Colorado! The mountains are gorgeous right now. Missing everyone back home ❤️',      now() - interval '14 days'),
  (v_post7, v_mom,     v_circle_id, 'Reminder: Grandma''s birthday is coming up on the 15th. Let''s plan something special! 🎂',            now() - interval '10 days'),
  (v_post8, v_dad,     v_circle_id, 'Fixed the deck railing this weekend. Also found Jake''s baseball glove that''s been missing for 3 months 😂', now() - interval '7 days'),
  (v_post9, v_sister,  v_circle_id, 'Does anyone have Grandma''s cornbread recipe? I want to make it for my roommates.',                    now() - interval '4 days'),
  (v_post10, v_grandma, v_circle_id, 'Thank you all for the beautiful birthday surprise! I am so blessed to have this family. Love you all so much 💕', now() - interval '1 day');

-- 4. Photo albums
INSERT INTO photo_albums (id, circle_id, created_by, name, description) VALUES
  (v_album1, v_circle_id, v_mom,    'Summer BBQ 2025',     'Annual backyard barbecue — burgers, pool, and family fun!'),
  (v_album2, v_circle_id, v_sister, 'Thanksgiving 2025',   'Thanksgiving at Grandma''s house. So much food!'),
  (v_album3, v_circle_id, v_dad,    'Family Reunion 2025', 'The big reunion at Lake Travis. Everyone made it!')
ON CONFLICT DO NOTHING;

-- 5. Events (2 past, 2 upcoming) linked to albums
INSERT INTO events (id, circle_id, created_by, title, description, event_date, event_time, location, album_id) VALUES
  (v_event1, v_circle_id, v_mom,     'Summer BBQ',                 'Annual backyard barbecue!',                    '2025-07-04', '14:00', 'Mom & Dad''s backyard',  v_album1),
  (v_event2, v_circle_id, v_grandma, 'Thanksgiving Dinner',        'Thanksgiving at Grandma''s — bring a dish!',   '2025-11-27', '15:00', 'Grandma Rose''s house',  v_album2),
  (v_event3, v_circle_id, v_dad,     'Family Reunion at the Lake', 'Everyone''s invited! Camping optional.',        '2026-03-28', '10:00', 'Lake Travis, TX',        v_album3),
  (v_event4, v_circle_id, v_cousin,  'Mia''s Visit Home',          'I''m flying in for a week — let''s hang out!', '2026-04-10', '18:00', 'Austin, TX',             NULL)
ON CONFLICT DO NOTHING;

-- 6. Fridge pins
INSERT INTO fridge_pins (circle_id, pinned_by, title, content, pin_type) VALUES
  (v_circle_id, v_mom,     'Grocery List',         'Eggs, milk, butter, flour, tomatoes, chicken breasts',       'note'),
  (v_circle_id, v_dad,     'Wi-Fi Password',       'Network: FamilyNet5G / Password: TacoTuesday2025!',         'note'),
  (v_circle_id, v_sister,  'Spring Break Dates',   'March 14-22. I''ll be home the whole week!',                 'note'),
  (v_circle_id, v_grandma, 'Doctor Appointment',   'March 5th at 2:00 PM — Dr. Patel, Building C',              'note'),
  (v_circle_id, v_brother, 'Game Schedule',         'Friday 6 PM vs Westlake, Saturday 1 PM vs Anderson',       'note'),
  (v_circle_id, v_cousin,  'Flight Info',           'Arriving April 10, Southwest WN 1423, lands at 5:45 PM',   'note');

-- 7. Reactions
INSERT INTO reactions (post_id, user_id, reaction_type) VALUES
  (v_post1, v_dad,     'heart'),
  (v_post1, v_sister,  'heart'),
  (v_post1, v_grandma, 'heart'),
  (v_post3, v_mom,     'heart'),
  (v_post3, v_dad,     'heart'),
  (v_post3, v_grandma, 'heart'),
  (v_post3, v_brother, 'heart'),
  (v_post5, v_mom,     'heart'),
  (v_post5, v_dad,     'heart'),
  (v_post5, v_sister,  'heart'),
  (v_post6, v_mom,     'heart'),
  (v_post6, v_grandma, 'heart'),
  (v_post10, v_mom,     'heart'),
  (v_post10, v_dad,     'heart'),
  (v_post10, v_sister,  'heart'),
  (v_post10, v_brother, 'heart'),
  (v_post10, v_cousin,  'heart'),
  (v_post10, v_owner_id,'heart');

-- 8. Comments
INSERT INTO comments (post_id, author_id, content, created_at) VALUES
  (v_post1, v_dad,     'Can you make that again for the BBQ?',                                          now() - interval '27 days'),
  (v_post1, v_grandma, 'I taught her well! 😊',                                                         now() - interval '27 days'),
  (v_post2, v_brother, 'I''m in! Can I bring Tyler?',                                                   now() - interval '24 days'),
  (v_post2, v_dad,     'Of course! The more the merrier.',                                               now() - interval '24 days'),
  (v_post3, v_mom,     'So proud of you, sweetheart!! 🥹',                                              now() - interval '21 days'),
  (v_post3, v_grandma, 'That''s my granddaughter! Brilliant!',                                          now() - interval '21 days'),
  (v_post5, v_dad,     'That''s my boy! 💪',                                                            now() - interval '16 days'),
  (v_post5, v_cousin,  'GO JAKE!! Wish I could''ve been there!',                                        now() - interval '16 days'),
  (v_post9, v_grandma, 'I''ll text it to you tonight, honey. It''s the one with buttermilk.',            now() - interval '3 days'),
  (v_post9, v_mom,     'It''s in the red recipe box in the kitchen — second drawer.',                    now() - interval '3 days'),
  (v_post10, v_sister, 'We love you Grandma!! ❤️',                                                      now() - interval '12 hours'),
  (v_post10, v_cousin, 'Happy birthday Grandma Rose! 🎉🎂',                                              now() - interval '10 hours');

END $$;
