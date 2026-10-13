-- Example data for Phase 1: 2 campaigns, 5 donors, 3 pledges, 20 transactions.
-- Safe to re-run (fixed ids). Delete it again with the block at the bottom.
-- registered_by / approved_by use two placeholder admin ids.

insert into campaigns (id, title, slug, short_text, long_text, goal_sek, starts_on, ends_on, fund_type, status) values
 ('c0000000-0000-0000-0000-000000000001', 'Ramadan 2027', 'ramadan-2027',
  'Iftar varje kväll och mat till familjer i behov.',
  'Under Ramadan bjuder vi på iftar varje kväll och delar ut matkassar till familjer som behöver stöd.',
  400000, current_date - 20, current_date + 30, 'sadaqah', 'published'),
 ('c0000000-0000-0000-0000-000000000002', 'Byggfonden – ny bönesal', 'byggfonden',
  'Vi bygger en ny bönesal för 400 personer.',
  'Bönesalen byggs i två etapper. Varje krona går till bygget och redovisas öppet i årsredovisningen.',
  1500000, current_date - 120, current_date + 240, 'building', 'published')
on conflict (id) do nothing;

insert into donor_profiles (id, full_name, phone, email) values
 ('d0000000-0000-0000-0000-000000000001', 'Ahmed Hassan', '070-123 45 67', 'ahmed.h@example.se'),
 ('d0000000-0000-0000-0000-000000000002', 'Fatima Ali', '073-555 01 02', 'fatima.a@example.se'),
 ('d0000000-0000-0000-0000-000000000003', 'Omar Yusuf', '076-222 33 44', null),
 ('d0000000-0000-0000-0000-000000000004', 'Maryam Abdi', null, 'maryam.a@example.se'),
 ('d0000000-0000-0000-0000-000000000005', 'Ibrahim Nur', '072-111 22 33', 'ibrahim.n@example.se')
on conflict (id) do nothing;

insert into donor_consents (donor_id, purpose, granted, source)
select d, p, true, 'form'
from (values ('d0000000-0000-0000-0000-000000000001'::uuid), ('d0000000-0000-0000-0000-000000000002'), ('d0000000-0000-0000-0000-000000000003'),
             ('d0000000-0000-0000-0000-000000000004'), ('d0000000-0000-0000-0000-000000000005')) as d(d),
     (values ('storage'), ('contact_sms')) as p(p)
where not exists (select 1 from donor_consents);

-- Pledges: 1 = on plan, 2 = overdue, 3 = fulfilled
insert into pledges (id, campaign_id, donor_id, total_sek) values
 ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 12000),
 ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 6000),
 ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 2000)
on conflict (id) do nothing;

insert into pledge_installments (id, pledge_id, seq, due_on, amount_sek) values
 ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 1, current_date - 30, 2000),
 ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 2, current_date + 0,  2000),
 ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000001', 3, current_date + 30, 2000),
 ('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000001', 4, current_date + 60, 2000),
 ('b0000000-0000-0000-0000-000000000015', 'a0000000-0000-0000-0000-000000000001', 5, current_date + 90, 2000),
 ('b0000000-0000-0000-0000-000000000016', 'a0000000-0000-0000-0000-000000000001', 6, current_date + 120, 2000),
 ('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000002', 1, current_date - 40, 3000),
 ('b0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000002', 2, current_date - 10, 3000),
 ('b0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000003', 1, current_date - 14, 1000),
 ('b0000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000003', 2, current_date - 2,  1000)
on conflict (id) do nothing;

-- 20 transactions (fixed ids t...01-20). Online rows have no registered_by.
insert into transactions (id, campaign_id, amount_sek, received_on, method, status, donor_id, display_name, installment_id, receipt_no, registered_by, approved_by, approved_at, provider_ref) values
 ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001', 500,  current_date,     'swish','confirmed',null,'Amina',null,null,null,null,null,'SW-90001'),
 ('e0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001', 250,  current_date,     'card','confirmed',null,null,null,null,null,null,null,'CD-90002'),
 ('e0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000002', 1000, current_date,     'swish','confirmed','d0000000-0000-0000-0000-000000000005','Ibrahim',null,null,null,null,null,'SW-90003'),
 ('e0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001', 300,  current_date - 1, 'paypal','pending_provider',null,'Sara',null,null,null,null,null,'PP-90004'),
 ('e0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000002', 5000, current_date - 2, 'swish','confirmed',null,'Mohamed',null,null,null,null,null,'SW-90005'),
 ('e0000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001', 200,  current_date - 3, 'card','confirmed',null,'Layla',null,null,null,null,null,'CD-90006'),
 ('e0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000002', 750,  current_date - 5, 'swish','confirmed',null,null,null,null,null,null,null,'SW-90007'),
 ('e0000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000001', 150,  current_date - 6, 'paypal','confirmed',null,'Hassan',null,null,null,null,null,'PP-90008'),
 ('e0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000002', 2000, current_date - 9, 'card','confirmed','d0000000-0000-0000-0000-000000000002','Fatima',null,null,null,null,null,'CD-90009'),
 ('e0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000001', 100,  current_date - 14,'swish','confirmed',null,'Yahya',null,null,null,null,null,'SW-90010'),
 ('e0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000002', 3500, current_date - 22,'card','confirmed',null,'Maryam',null,null,null,null,null,'CD-90011'),
 ('e0000000-0000-0000-0000-000000000012','c0000000-0000-0000-0000-000000000002', 8000, current_date - 40,'swish','confirmed',null,null,null,null,null,null,null,'SW-90012'),
 ('e0000000-0000-0000-0000-000000000013','c0000000-0000-0000-0000-000000000002', 2000, current_date - 30,'swish','confirmed','d0000000-0000-0000-0000-000000000001','Ahmed','b0000000-0000-0000-0000-000000000011',null,null,null,null,'SW-90013'),
 ('e0000000-0000-0000-0000-000000000014','c0000000-0000-0000-0000-000000000002', 3000, current_date - 38,'bank_transfer','confirmed','d0000000-0000-0000-0000-000000000003','Omar','b0000000-0000-0000-0000-000000000021','K-0014','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2', now() - interval '37 days',null),
 ('e0000000-0000-0000-0000-000000000015','c0000000-0000-0000-0000-000000000001', 1000, current_date - 14,'cash','confirmed','d0000000-0000-0000-0000-000000000004','Maryam','b0000000-0000-0000-0000-000000000031','K-0015','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1', now() - interval '13 days',null),
 ('e0000000-0000-0000-0000-000000000016','c0000000-0000-0000-0000-000000000002', 2500, current_date - 1, 'cash','awaiting_approval',null,'Ali',null,'K-0016','00000000-0000-0000-0000-0000000000a1',null,null,null),
 ('e0000000-0000-0000-0000-000000000017','c0000000-0000-0000-0000-000000000002', 10000,current_date - 2, 'bank_transfer','awaiting_approval',null,null,null,'K-0017','00000000-0000-0000-0000-0000000000a2',null,null,null),
 ('e0000000-0000-0000-0000-000000000018','c0000000-0000-0000-0000-000000000001', 600,  current_date - 4, 'import','awaiting_approval',null,'Zainab',null,null,'00000000-0000-0000-0000-0000000000a1',null,null,null),
 ('e0000000-0000-0000-0000-000000000019','c0000000-0000-0000-0000-000000000001', 400,  current_date - 7, 'swish','rejected',null,'Omar',null,null,null,null,null,'SW-90019'),
 ('e0000000-0000-0000-0000-000000000020','c0000000-0000-0000-0000-000000000001', 1000, current_date - 2, 'card','confirmed','d0000000-0000-0000-0000-000000000004','Maryam','b0000000-0000-0000-0000-000000000032',null,null,null,null,'CD-90020')
on conflict (id) do nothing;

-- make the "stuck" PayPal row older than one hour
update transactions set created_at = now() - interval '1 day' where id = 'e0000000-0000-0000-0000-000000000004';

-- To remove all example data:
--   delete from transactions where id::text like 'e0000000-%';
--   delete from pledges where id::text like 'a0000000-%';
--   delete from donor_profiles where id::text like 'd0000000-%';
--   delete from campaigns where id::text like 'c0000000-%';
