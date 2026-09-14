-- CoolSpot seed — the 15 existing categories, each with a distinct, sensible colour
-- and a Lucide icon name. Colours are data (not design tokens): they are shared by
-- pins, chips and category pages regardless of the light/dark theme, and are editable
-- here. Idempotent: safe to re-run.

INSERT INTO categories (id, slug, name, color, icon, position) VALUES
    (1,  'chill',              'Chill',              '#2f9e8f', 'Coffee',         1),
    (2,  'socializing',        'Socializing',        '#e07030', 'Users',          2),
    (3,  'scenic',             'Scenic',             '#3e9d52', 'Mountain',       3),
    (4,  'dangerous',          'Dangerous',          '#d1483f', 'TriangleAlert',  4),
    (5,  'hidden-gem',         'Hidden Gem',         '#8b5fc7', 'Gem',            5),
    (6,  'nightlife',          'Nightlife',          '#5a54c9', 'Moon',           6),
    (7,  'foodie',             'Foodie',             '#e08a1e', 'UtensilsCrossed', 7),
    (8,  'romantic',           'Romantic',           '#d4538b', 'Heart',          8),
    (9,  'artistic',           'Artistic',           '#b03a86', 'Palette',        9),
    (10, 'historical',         'Historical',         '#8f6b4a', 'Landmark',       10),
    (11, 'family-friendly',    'Family-Friendly',    '#4f8fce', 'Baby',           11),
    (12, 'pet-friendly',       'Pet-Friendly',       '#6b8e23', 'PawPrint',       12),
    (13, 'outdoor-activities', 'Outdoor Activities', '#2e7d46', 'Trees',          13),
    (14, 'pay',                'Pay',                '#c8891b', 'Coins',          14),
    (15, 'other',              'Other',              '#7a7f87', 'MapPin',         15)
ON CONFLICT (slug) DO NOTHING;

-- Keep the sequence ahead of the explicit ids above so later inserts do not collide.
SELECT setval('categories_id_seq', (SELECT max(id) FROM categories));
