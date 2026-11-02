-- Demo data: Harbourline Pharma, a fictional prescription medicines company with a field force in
-- Auckland and Christchurch (New Zealand) and Sydney and Melbourne (Australia). Every name, product,
-- lot and figure here is invented. Dates are relative to today, so the attention list always has
-- something to say: a recalled lot still in two reps' stock and two prescribers not yet told, a
-- sample given to a practice nurse who cannot prescribe, a New Zealand sample with no signed
-- receipt, a rep whose hawker's licence ran out before she issued samples, a Sydney starter pack
-- with no written request, a dinner meeting over the hospitality cap, a takeaway lunch in Auckland,
-- a speaker fee paid before the notice of disclosure, A-segment specialists nobody has seen this
-- cycle, follow-ups gone past their date, expired inhaler stock in a car boot, and a starter pack
-- request waiting nine days for delivery.
-- Safe to run twice: every row has a natural key.

insert into settings (key, value, note) values
  ('cycle_days', '56', 'House rule: the call cycle, in days. Coverage counts calls in the last cycle'),
  ('short_dated_days', '90', 'House rule: sample stock expiring within this many days is short-dated'),
  ('sample_deliver_days', '7', 'House rule: a starter pack request should be delivered within this many days'),
  ('quiet_days', '60', 'House rule: an A or B segment professional not seen for this many days has gone quiet'),
  ('licence_warn_days', '30', 'House rule: flag a rep''s sample licence this many days before it runs out'),
  ('hospitality_cap_cents_au', '14000', 'Medicines Australia Code Tool Kit, Hospitality and Venues: A$140 a head a meal, excluding gratuities and GST, from 3 November 2022. Check it each year')
on conflict (key) do nothing;

insert into territories (code, name, country, state) values
  ('AKL', 'Auckland', 'NZ', null),
  ('CHC', 'Christchurch and Canterbury', 'NZ', null),
  ('SYD', 'Sydney', 'AU', 'NSW'),
  ('MEL', 'Melbourne', 'AU', 'VIC')
on conflict (code) do nothing;

insert into reps (code, name, email, territory_id, sample_licence, licence_expires)
select v.code, v.name, v.email, t.id, v.licence, current_date + v.expires
from (values
  ('R-01', 'Aroha Ngata', 'aroha.ngata@example.com', 'AKL', 'HL-20417', 210),
  ('R-02', 'Kate Robson', 'kate.robson@example.com', 'CHC', 'HL-19982', -5),
  ('R-03', 'Priya Raman', 'priya.raman@example.com', 'SYD', null, null),
  ('R-04', 'Luke Daniels', 'luke.daniels@example.com', 'MEL', null, null)
) as v(code, name, email, territory, licence, expires)
join territories t on t.code = v.territory
on conflict (code) do nothing;

insert into products (code, name, strength, form, kind, registered, starter_packs) values
  ('CRD10', 'Cardovex', '10 mg', 'tablet', 'prescription', true, true),
  ('CRD20', 'Cardovex', '20 mg', 'tablet', 'prescription', true, false),
  ('GLY500', 'Glyzera', '500 mg', 'modified release tablet', 'prescription', true, true),
  ('RSP100', 'Respiflo', '100 mcg', 'inhaler', 'prescription', true, true),
  ('DRM01', 'Dermaclear', '0.1%', 'cream', 'prescription', true, false),
  ('PNT25', 'Pentavir', '25 mg', 'tablet', 'prescription', false, false)
on conflict (code) do nothing;

insert into accounts (code, name, kind, territory_id, address, city, state, postcode)
select v.code, v.name, v.kind, t.id, v.address, v.city, v.state, v.postcode
from (values
  ('A-01', 'Ponsonby Family Doctors', 'practice', 'AKL', '120 Ponsonby Road', 'Auckland', null, '1011'),
  ('A-02', 'Auckland Heart Clinic', 'clinic', 'AKL', '8 Gillies Avenue', 'Auckland', null, '1023'),
  ('A-03', 'Mt Eden Medical', 'practice', 'AKL', '455 Mount Eden Road', 'Auckland', null, '1024'),
  ('A-04', 'Riccarton Medical', 'practice', 'CHC', '66 Riccarton Road', 'Christchurch', null, '8011'),
  ('A-05', 'Canterbury Respiratory Unit', 'hospital', 'CHC', '2 Riccarton Avenue', 'Christchurch', null, '8011'),
  ('A-06', 'Bondi Junction Medical Centre', 'practice', 'SYD', '30 Oxford Street', 'Bondi Junction', 'NSW', '2022'),
  ('A-07', 'St Leonards Cardiology', 'clinic', 'SYD', '11 Pacific Highway', 'St Leonards', 'NSW', '2065'),
  ('A-08', 'Parramatta Diabetes Centre', 'clinic', 'SYD', '160 Church Street', 'Parramatta', 'NSW', '2150'),
  ('A-09', 'Richmond General Practice', 'practice', 'MEL', '250 Swan Street', 'Richmond', 'VIC', '3121'),
  ('A-10', 'Box Hill Respiratory', 'clinic', 'MEL', '7 Station Street', 'Box Hill', 'VIC', '3128')
) as v(code, name, kind, territory, address, city, state, postcode)
join territories t on t.code = v.territory
on conflict (code) do nothing;

insert into hcps (code, name, profession, specialty, prescriber, registration_number, account_id, territory_id, segment, target_calls, email, status)
select v.code, v.name, v.profession, v.specialty, v.prescriber, v.reg, a.id, a.territory_id, v.segment, v.target, v.email, v.status
from (values
  ('H-101', 'Dr Anika Shah', 'gp', 'General practice', true, 'MCNZ 41207', 'A-01', 'A', 2, 'anika.shah@example.com', 'active'),
  ('H-102', 'Dr Tama Whaanga', 'gp', 'General practice', true, 'MCNZ 38845', 'A-01', 'B', 1, 'tama.whaanga@example.com', 'active'),
  ('H-103', 'Dr Grace Liu', 'specialist', 'Cardiology', true, 'MCNZ 29930', 'A-02', 'A', 3, 'grace.liu@example.com', 'active'),
  ('H-104', 'Rachel Kemp', 'nurse', 'Practice nursing', false, 'NCNZ 210448', 'A-01', 'C', 0, 'rachel.kemp@example.com', 'active'),
  ('H-105', 'Dr Michael Oduya', 'gp', 'General practice', true, 'MCNZ 45512', 'A-03', 'B', 1, 'michael.oduya@example.com', 'active'),
  ('H-201', 'Dr Fiona Grant', 'gp', 'General practice', true, 'MCNZ 33016', 'A-04', 'A', 2, 'fiona.grant@example.com', 'active'),
  ('H-202', 'Dr Paul Henare', 'specialist', 'Respiratory medicine', true, 'MCNZ 30177', 'A-05', 'A', 2, 'paul.henare@example.com', 'active'),
  ('H-203', 'Jo Walsh', 'nurse-practitioner', 'Primary care', true, 'NCNZ 188102', 'A-04', 'B', 1, 'jo.walsh@example.com', 'active'),
  ('H-301', 'Dr Emily Carter', 'gp', 'General practice', true, 'MED0001234567', 'A-06', 'A', 2, 'emily.carter@example.com', 'active'),
  ('H-302', 'Dr Raj Menon', 'specialist', 'Cardiology', true, 'MED0001876543', 'A-07', 'A', 3, 'raj.menon@example.com', 'active'),
  ('H-303', 'Dr Sophie Nguyen', 'specialist', 'Endocrinology', true, 'MED0002345678', 'A-08', 'B', 1, 'sophie.nguyen@example.com', 'active'),
  ('H-304', 'Dr Daniel Brooks', 'gp', 'General practice', true, 'MED0003456789', 'A-06', 'C', 0, 'daniel.brooks@example.com', 'active'),
  ('H-305', 'Dr Hannah Lee', 'gp', 'General practice', true, 'MED0004567890', 'A-08', 'A', 2, 'hannah.lee@example.com', 'active'),
  ('H-401', 'Dr Oliver Smith', 'gp', 'General practice', true, 'MED0005678901', 'A-09', 'A', 2, 'oliver.smith@example.com', 'active'),
  ('H-402', 'Dr Mei Tan', 'specialist', 'Respiratory medicine', true, 'MED0006789012', 'A-10', 'A', 2, 'mei.tan@example.com', 'active'),
  ('H-403', 'Dr Ahmed Karimi', 'gp', 'General practice', true, 'MED0007890123', 'A-09', 'B', 1, 'ahmed.karimi@example.com', 'active'),
  ('H-404', 'Dr Laura Fitzgerald', 'specialist', 'Endocrinology', true, 'MED0008901234', 'A-10', 'B', 1, 'laura.fitzgerald@example.com', 'active'),
  ('H-405', 'Dr Ben Walker', 'gp', 'General practice', true, 'MED0009012345', 'A-09', 'C', 0, 'ben.walker@example.com', 'retired')
) as v(code, name, profession, specialty, prescriber, reg, account, segment, target, email, status)
join accounts a on a.code = v.account
on conflict (code) do nothing;

insert into calls (ref, hcp_id, rep_id, call_on, channel, notes, next_step, follow_up_on, follow_up_done_on)
select v.ref, h.id, r.id, current_date - v.ago, v.channel, v.notes, v.next_step,
  case when v.follow is null then null else current_date + v.follow end,
  case when v.done then current_date - v.ago + 3 else null end
from (values
  ('C-0001', 'H-101', 'R-01', 10, 'face-to-face', 'Asked about Cardovex in patients already on an ACE inhibitor. Left the prescribing summary. Requested starter packs.', 'Bring the combination therapy reprint', 18, false),
  ('C-0002', 'H-101', 'R-01', 40, 'face-to-face', 'Cardovex launch detail. Interested, wants local data.', 'Invite to the lunchtime update', null, false),
  ('C-0003', 'H-102', 'R-01', 30, 'remote', 'Short video call. Uses a competitor first line, open to Cardovex for intolerant patients.', null, null, false),
  ('C-0004', 'H-103', 'R-01', 70, 'face-to-face', 'Discussed the heart failure subgroup. Wants the full paper.', 'Send the full paper through medical information', -55, false),
  ('C-0005', 'H-105', 'R-01', 20, 'face-to-face', 'Glyzera detail. Asked for starter packs for newly diagnosed patients.', 'Check how the first patients are going', -6, false),
  ('C-0006', 'H-104', 'R-01', 40, 'group', 'Practice team lunch, nurse-led diabetes clinic. Rachel asked for patient leaflets.', 'Drop patient leaflets', -30, true),
  ('C-0007', 'H-201', 'R-02', 9, 'face-to-face', 'Respiflo technique demo with the practice nurse. Starter packs requested.', null, null, false),
  ('C-0008', 'H-201', 'R-02', 50, 'face-to-face', 'First Respiflo detail.', null, null, false),
  ('C-0009', 'H-202', 'R-02', 85, 'face-to-face', 'Agreed to speak at the asthma dinner meeting.', 'Confirm the talk outline', -60, false),
  ('C-0010', 'H-203', 'R-02', 25, 'phone', 'Asked whether Respiflo is funded for her patients. Answered from the funding notice.', null, null, false),
  ('C-0011', 'H-301', 'R-03', 15, 'face-to-face', 'Cardovex detail. Took four starter packs on the spot.', 'Follow up on first patients', 6, false),
  ('C-0012', 'H-301', 'R-03', 48, 'face-to-face', 'Hypertension guidelines discussion.', null, null, false),
  ('C-0013', 'H-302', 'R-03', 22, 'face-to-face', 'Briefed for the dinner meeting talk. Asked about the advisory board.', 'Send the advisory board agreement', -8, false),
  ('C-0014', 'H-303', 'R-03', 30, 'face-to-face', 'Glyzera detail with the diabetes educator. Requested starter packs.', null, null, false),
  ('C-0015', 'H-305', 'R-03', 9, 'face-to-face', 'Glyzera detail. Signed a starter pack request for four packs.', 'Deliver the starter packs', -2, false),
  ('C-0016', 'H-305', 'R-03', 44, 'remote', 'Short catch-up on the dinner meeting invitation.', null, null, false),
  ('C-0017', 'H-304', 'R-03', 120, 'face-to-face', 'Low prescriber of the category. Courtesy call.', null, null, false),
  ('C-0018', 'H-401', 'R-04', 6, 'face-to-face', 'Respiflo detail and technique demo. Starter packs delivered.', 'Check inhaler technique at the next visit', 30, false),
  ('C-0019', 'H-401', 'R-04', 35, 'face-to-face', 'Took part in the inhaler workshop.', null, null, false),
  ('C-0020', 'H-402', 'R-04', 80, 'face-to-face', 'Agreed to run the inhaler technique workshop.', 'Send the speaker agreement', -70, true),
  ('C-0021', 'H-403', 'R-04', 64, 'face-to-face', 'Asked about Respiflo for COPD. Not an approved indication: referred the question to medical information.', 'Medical information to reply directly', -50, true),
  ('C-0022', 'H-404', 'R-04', 18, 'remote', 'Glyzera detail, interested in the modified release profile.', 'Send the pharmacokinetics summary', -4, false),
  ('C-0023', 'H-101', 'R-01', 95, 'face-to-face', 'Pre-launch relationship call.', null, null, false),
  ('C-0024', 'H-302', 'R-03', 110, 'face-to-face', 'Cardovex detail, specialist slide deck.', null, null, false),
  ('C-0025', 'H-402', 'R-04', 150, 'face-to-face', 'Respiflo launch detail.', null, null, false)
) as v(ref, hcp, rep, ago, channel, notes, next_step, follow, done)
join hcps h on h.code = v.hcp join reps r on r.code = v.rep
on conflict (ref) do nothing;

insert into call_products (call_id, product_id)
select c.id, p.id
from (values
  ('C-0001', 'CRD10'), ('C-0002', 'CRD10'), ('C-0003', 'CRD10'), ('C-0004', 'CRD10'), ('C-0004', 'CRD20'), ('C-0005', 'GLY500'),
  ('C-0006', 'GLY500'), ('C-0007', 'RSP100'), ('C-0008', 'RSP100'), ('C-0009', 'RSP100'), ('C-0010', 'RSP100'), ('C-0011', 'CRD10'),
  ('C-0012', 'CRD10'), ('C-0013', 'CRD10'), ('C-0013', 'GLY500'), ('C-0014', 'GLY500'), ('C-0015', 'GLY500'), ('C-0016', 'CRD10'),
  ('C-0017', 'CRD10'), ('C-0018', 'RSP100'), ('C-0019', 'RSP100'), ('C-0020', 'RSP100'), ('C-0021', 'RSP100'), ('C-0022', 'GLY500'),
  ('C-0023', 'CRD10'), ('C-0024', 'CRD10'), ('C-0024', 'CRD20'), ('C-0025', 'RSP100')
) as v(call, product)
join calls c on c.ref = v.call join products p on p.code = v.product
on conflict do nothing;

insert into lots (product_id, lot_number, expires_on, recalled_on, recall_note)
select p.id, v.lot, current_date + v.expires, case when v.recalled is null then null else current_date - v.recalled end, v.note
from (values
  ('CRD10', 'L2401', 420, null, null),
  ('CRD10', 'L2398', 45, null, null),
  ('GLY500', 'G1187', 300, 3, 'Supplier recall: tablet hardness out of specification. Quarantine and return all stock; tell every prescriber who received this lot.'),
  ('RSP100', 'R3301', -10, null, null),
  ('RSP100', 'R3420', 500, null, null)
) as v(product, lot, expires, recalled, note)
join products p on p.code = v.product
on conflict (product_id, lot_number) do nothing;

insert into samples (ref, hcp_id, rep_id, product_id, quantity, request_kind, requested_on, request_address, status, delivered_on, lot_id, receipt_signed_on)
select v.ref, h.id, r.id, p.id, v.qty, v.kind, case when v.req is null then null else current_date - v.req end, v.address, v.status,
  case when v.del is null then null else current_date - v.del end, l.id, case when v.signed is null then null else current_date - v.signed end
from (values
  ('S-0001', 'H-101', 'R-01', 'CRD10', 4, 'written', 12, 'Dr Anika Shah, Ponsonby Family Doctors, 120 Ponsonby Road, Auckland 1011', 'delivered', 10, 'L2401', 10),
  ('S-0002', 'H-105', 'R-01', 'GLY500', 2, 'written', 20, 'Dr Michael Oduya, Mt Eden Medical, 455 Mount Eden Road, Auckland 1024', 'delivered', 18, 'G1187', null),
  ('S-0003', 'H-104', 'R-01', 'CRD10', 2, 'written', 40, 'Rachel Kemp, Ponsonby Family Doctors, 120 Ponsonby Road, Auckland 1011', 'delivered', 40, 'L2398', 40),
  ('S-0004', 'H-201', 'R-02', 'RSP100', 3, 'written', 9, 'Dr Fiona Grant, Riccarton Medical, 66 Riccarton Road, Christchurch 8011', 'delivered', 2, 'R3420', 2),
  ('S-0005', 'H-301', 'R-03', 'CRD10', 4, 'none', null, null, 'delivered', 15, 'L2401', null),
  ('S-0006', 'H-305', 'R-03', 'GLY500', 4, 'written', 9, 'Dr Hannah Lee, Parramatta Diabetes Centre, 160 Church Street, Parramatta NSW 2150', 'requested', null, null, null),
  ('S-0007', 'H-303', 'R-03', 'GLY500', 2, 'written', 30, 'Dr Sophie Nguyen, Parramatta Diabetes Centre, 160 Church Street, Parramatta NSW 2150', 'delivered', 28, 'G1187', 28),
  ('S-0008', 'H-401', 'R-04', 'RSP100', 2, 'written', 6, 'Dr Oliver Smith, Richmond General Practice, 250 Swan Street, Richmond VIC 3121', 'delivered', 5, 'R3420', 5),
  ('S-0009', 'H-402', 'R-04', 'RSP100', 3, 'written', 60, 'Dr Mei Tan, Box Hill Respiratory, 7 Station Street, Box Hill VIC 3128', 'delivered', 58, 'R3301', 58)
) as v(ref, hcp, rep, product, qty, kind, req, address, status, del, lot, signed)
join hcps h on h.code = v.hcp join reps r on r.code = v.rep join products p on p.code = v.product
left join lots l on l.product_id = p.id and l.lot_number = v.lot
on conflict (ref) do nothing;

insert into stock_moves (ref, rep_id, lot_id, qty, kind, moved_on, sample_id, note)
select v.ref, r.id, l.id, v.qty, v.kind, current_date - v.ago, s.id, v.note
from (values
  ('M-0001', 'R-01', 'L2401', 20, 'received', 60, null, 'Quarterly allocation'),
  ('M-0002', 'R-01', 'L2398', 10, 'received', 60, null, 'Quarterly allocation'),
  ('M-0003', 'R-01', 'G1187', 10, 'received', 45, null, 'Launch allocation'),
  ('M-0004', 'R-02', 'R3420', 12, 'received', 30, null, 'Quarterly allocation'),
  ('M-0005', 'R-03', 'L2401', 20, 'received', 50, null, 'Quarterly allocation'),
  ('M-0006', 'R-03', 'G1187', 12, 'received', 50, null, 'Launch allocation'),
  ('M-0007', 'R-04', 'R3301', 10, 'received', 90, null, 'Quarterly allocation'),
  ('M-0008', 'R-04', 'R3420', 10, 'received', 20, null, 'Top-up'),
  ('M-0009', 'R-01', 'L2401', -4, 'issued', 10, 'S-0001', null),
  ('M-0010', 'R-01', 'G1187', -2, 'issued', 18, 'S-0002', null),
  ('M-0011', 'R-01', 'L2398', -2, 'issued', 40, 'S-0003', null),
  ('M-0012', 'R-02', 'R3420', -3, 'issued', 2, 'S-0004', null),
  ('M-0013', 'R-03', 'L2401', -4, 'issued', 15, 'S-0005', null),
  ('M-0014', 'R-03', 'G1187', -2, 'issued', 28, 'S-0007', null),
  ('M-0015', 'R-04', 'R3420', -2, 'issued', 5, 'S-0008', null),
  ('M-0016', 'R-04', 'R3301', -3, 'issued', 58, 'S-0009', null)
) as v(ref, rep, lot, qty, kind, ago, sample, note)
join reps r on r.code = v.rep join lots l on l.lot_number = v.lot
left join samples s on s.ref = v.sample
on conflict (ref) do nothing;

insert into events (ref, title, kind, country, territory_id, held_on, venue, education, hours, meal_cents, takeaway, entertainment, status)
select v.ref, v.title, v.kind, t.country, t.id, current_date + v.days, v.venue, v.education, v.hours, v.meal, v.takeaway, false, v.status
from (values
  ('E-01', 'Managing resistant hypertension in general practice', 'dinner-meeting', 'SYD', -25, 'Function room, Harbour View Hotel, North Sydney', '45-minute case-based session by a consultant cardiologist, then questions', 1.5, 16800, false, 'held'),
  ('E-02', 'Inhaler technique workshop for practice teams', 'workshop', 'MEL', -40, 'Box Hill Town Hall meeting room', 'Three-hour hands-on workshop on inhaler technique and asthma action plans', 3.0, 6200, false, 'held'),
  ('E-03', 'Cardiovascular risk update', 'company-meeting', 'AKL', -14, 'Ponsonby Family Doctors meeting room', '30-minute lunchtime update on the cardiovascular risk guidelines', 0.5, 3500, true, 'held'),
  ('E-04', 'Glyzera advisory board', 'advisory-board', 'SYD', 21, 'Meeting suite, Parramatta', 'Half-day advisory board on starting modified release therapy in primary care', 4.0, 9500, false, 'planned'),
  ('E-05', 'Asthma in primary care', 'dinner-meeting', 'CHC', 10, 'Conference room, Riccarton Park', 'One-hour talk by a respiratory physician, then case discussion', 1.5, 7500, false, 'planned')
) as v(ref, title, kind, territory, days, venue, education, hours, meal, takeaway, status)
join territories t on t.code = v.territory
on conflict (ref) do nothing;

insert into attendees (event_id, hcp_id, role, attended)
select e.id, h.id, v.role, v.attended
from (values
  ('E-01', 'H-302', 'speaker', true), ('E-01', 'H-301', 'delegate', true), ('E-01', 'H-305', 'delegate', true), ('E-01', 'H-304', 'delegate', false),
  ('E-02', 'H-402', 'speaker', true), ('E-02', 'H-401', 'delegate', true), ('E-02', 'H-403', 'delegate', true),
  ('E-03', 'H-101', 'delegate', true), ('E-03', 'H-102', 'delegate', true), ('E-03', 'H-104', 'delegate', true),
  ('E-04', 'H-302', 'advisor', null), ('E-04', 'H-303', 'advisor', null),
  ('E-05', 'H-202', 'speaker', null), ('E-05', 'H-201', 'delegate', null), ('E-05', 'H-203', 'delegate', null)
) as v(event, hcp, role, attended)
join events e on e.ref = v.event join hcps h on h.code = v.hcp
on conflict (event_id, hcp_id) do nothing;

insert into transfers (ref, hcp_id, event_id, kind, description, amount_cents, currency, paid_on, paid_to, identity_known, notice_given_on, review_sent_on)
select v.ref, h.id, e.id, v.kind, v.description, v.amount, v.currency, current_date - v.paid, v.paid_to, v.known,
  case when v.notice is null then null else current_date - v.notice end, case when v.review is null then null else current_date - v.review end
from (values
  ('T-0001', 'H-302', 'E-01', 'speaker-fee', 'Speaking at an educational dinner meeting on resistant hypertension', 150000, 'AUD', 24, 'hcp', true, 60, null),
  ('T-0002', 'H-402', 'E-02', 'speaker-fee', 'Running an inhaler technique workshop for practice teams', 120000, 'AUD', 38, 'hcp', true, 35, null),
  ('T-0003', 'H-402', 'E-02', 'travel', 'Taxi to and from the workshop venue', 18000, 'AUD', 38, 'hcp', true, 35, null),
  ('T-0004', 'H-303', null, 'consultancy', 'Review of the Glyzera patient starter guide', 80000, 'AUD', 200, 'hcp', true, 230, null),
  ('T-0005', 'H-305', null, 'registration', 'Registration at a national diabetes scientific meeting', 95000, 'AUD', 150, 'third-party', true, 170, null),
  ('T-0006', 'H-401', null, 'market-research', 'Blinded market research interview through an agency', 15000, 'AUD', 60, 'third-party', false, null, null),
  ('T-0007', 'H-301', null, 'consultancy', 'Review of a hypertension patient leaflet', 100000, 'AUD', 380, 'hcp', true, 400, 350),
  ('T-0008', 'H-103', null, 'speaker-fee', 'Speaking at a cardiology registrar teaching evening', 90000, 'NZD', 14, 'hcp', true, 30, null)
) as v(ref, hcp, event, kind, description, amount, currency, paid, paid_to, known, notice, review)
join hcps h on h.code = v.hcp left join events e on e.ref = v.event
on conflict (ref) do nothing;

-- The half-year a year ago was reported on time.
insert into transparency_reports (period_from, submitted_on, declaration_on)
select tov_period_from(current_date - 380), tov_due_on(tov_period_from(current_date - 380)) - 10, tov_due_on(tov_period_from(current_date - 380)) - 7
on conflict (period_from) do nothing;

insert into activity (actor, action, ref, detail)
select 'Demo', 'seed', null, 'Harbourline Pharma demo data loaded'
where not exists (select 1 from activity where action = 'seed');
