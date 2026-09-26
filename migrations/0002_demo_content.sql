-- All records below are explicitly sample content. Replace or remove them before launch.
INSERT OR IGNORE INTO services (id,title,slug,description,icon,short_label,sort_order) VALUES
('svc-001','Design & Drawing','design-drawing','Concept, architectural and engineering drawing support tailored to your project brief.','⌂','Design',1),
('svc-002','3D Interior Design','3d-interior-design','Visualize interior layouts, materials and finishes before work begins.','◇','3D Design',2),
('svc-003','Estimation & Costing','estimation-costing','Clear quantity estimates and preliminary cost planning to support informed decisions.','▤','Costing',3),
('svc-004','Detailed Project Report','detailed-project-report','Structured project documentation and feasibility inputs for your next step.','▧','DPR',4),
('svc-005','Surveying','surveying','Site measurement and survey coordination to establish a dependable project basis.','◎','Survey',5),
('svc-006','Site Supervision','site-supervision','Practical site oversight focused on quality, coordination and clear communication.','◉','Supervision',6);

INSERT OR IGNORE INTO case_studies (id,title,slug,summary,body,service_id,project_date) VALUES
('case-001','Sample Residential Design','sample-residential-design','Example portfolio entry — replace this sample with an actual completed project.','This is demonstration copy only. Add a verified project story, scope, location (if approved), and outcomes in the admin panel.','svc-001','2025-01-01'),
('case-002','Sample Interior Visualization','sample-interior-visualization','Example portfolio entry — replace this sample with an actual completed project.','This is demonstration copy only. Upload approved renderings and describe the design brief and deliverables.','svc-002','2025-02-01'),
('case-003','Sample Cost Planning','sample-cost-planning','Example portfolio entry — replace this sample with an actual completed project.','This is demonstration copy only. Add a client-approved description of the estimate scope and project context.','svc-003','2025-03-01'),
('case-004','Sample Site Supervision','sample-site-supervision','Example portfolio entry — replace this sample with an actual completed project.','This is demonstration copy only. Replace with a real project, with client permission, before publishing.','svc-006','2025-04-01');

INSERT OR IGNORE INTO testimonials (id,client_name,company,quote) VALUES
('test-001','Sample Client','Sample Company','Placeholder testimonial — replace with an approved client quote before publishing.');
INSERT OR IGNORE INTO team_members (id,name,role,bio,sort_order) VALUES
('team-001','Team Member Name','Civil Engineer','Placeholder biography. Add a real team member’s experience and focus areas before launch.',1),
('team-002','Team Member Name','Design Consultant','Placeholder biography. Replace this text with an approved professional introduction.',2);
