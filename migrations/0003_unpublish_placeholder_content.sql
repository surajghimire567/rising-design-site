-- Hide only the untouched starter examples; approved edits and other records stay published.
UPDATE case_studies
SET is_published = 0
WHERE id IN ('case-001', 'case-002', 'case-003', 'case-004')
  AND (summary LIKE 'Example portfolio entry%' OR body LIKE 'This is demonstration copy%');

UPDATE testimonials
SET is_published = 0
WHERE id = 'test-001'
  AND quote LIKE 'Placeholder testimonial%';

UPDATE team_members
SET is_published = 0
WHERE id IN ('team-001', 'team-002')
  AND (bio LIKE 'Placeholder biography%' OR name = 'Team Member Name');
