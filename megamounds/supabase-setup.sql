-- ============================================
-- MEGAMOUNDS PM APP — SUPABASE DATABASE SETUP
-- Paste this entire file into Supabase SQL Editor
-- and click RUN. Do it once.
-- ============================================

-- 1. PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  role text default 'Site Supervisor',
  created_at timestamp with time zone default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'Site Supervisor')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. PROJECTS
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  location text,
  project_type text,
  description text,
  target_date date,
  rag_status text default 'Not Started',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. TASKS
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects on delete cascade,
  title text not null,
  week text,
  section text,
  status text default 'Not Started',
  priority text default 'Normal',
  is_critical boolean default false,
  notes text,
  assignee_id uuid references public.profiles,
  start_date date,
  end_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. TASK PHOTOS
create table public.task_photos (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks on delete cascade,
  url text not null,
  filename text,
  uploaded_by uuid references public.profiles,
  created_at timestamp with time zone default now()
);

-- 5. RISKS
create table public.risks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects on delete cascade,
  title text not null,
  likelihood text default 'High',
  impact text default 'High',
  status text default 'Active',
  mitigation text,
  owner text,
  created_at timestamp with time zone default now()
);

-- 6. RESOURCES
create table public.resources (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects on delete cascade,
  name text not null,
  type text default 'Labour',
  quantity numeric,
  unit text,
  cost_per_unit numeric,
  status text default 'Planned',
  created_at timestamp with time zone default now()
);

-- 7. PROJECT MEMBERS
create table public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects on delete cascade,
  profile_id uuid references public.profiles on delete cascade,
  unique(project_id, profile_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_photos enable row level security;
alter table public.risks enable row level security;
alter table public.resources enable row level security;
alter table public.project_members enable row level security;

-- Profiles: users can read all, update own
create policy "Profiles are viewable by authenticated users" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Projects: all authenticated users can read
create policy "Projects viewable by all authenticated" on public.projects for select using (auth.role() = 'authenticated');
create policy "Managers can insert projects" on public.projects for insert with check (auth.role() = 'authenticated');
create policy "Managers can update projects" on public.projects for update using (auth.role() = 'authenticated');

-- Tasks: all authenticated can read/write
create policy "Tasks viewable by authenticated" on public.tasks for select using (auth.role() = 'authenticated');
create policy "Tasks insertable by authenticated" on public.tasks for insert with check (auth.role() = 'authenticated');
create policy "Tasks updatable by authenticated" on public.tasks for update using (auth.role() = 'authenticated');
create policy "Tasks deletable by authenticated" on public.tasks for delete using (auth.role() = 'authenticated');

-- Task photos
create policy "Photos viewable by authenticated" on public.task_photos for select using (auth.role() = 'authenticated');
create policy "Photos insertable by authenticated" on public.task_photos for insert with check (auth.role() = 'authenticated');

-- Risks
create policy "Risks viewable by authenticated" on public.risks for select using (auth.role() = 'authenticated');
create policy "Risks manageable by authenticated" on public.risks for all using (auth.role() = 'authenticated');

-- Resources
create policy "Resources viewable by authenticated" on public.resources for select using (auth.role() = 'authenticated');
create policy "Resources manageable by authenticated" on public.resources for all using (auth.role() = 'authenticated');

-- Project members
create policy "Members viewable by authenticated" on public.project_members for select using (auth.role() = 'authenticated');
create policy "Members manageable by authenticated" on public.project_members for all using (auth.role() = 'authenticated');

-- ============================================
-- STORAGE BUCKET FOR PHOTOS
-- ============================================
insert into storage.buckets (id, name, public) values ('task-photos', 'task-photos', true);

create policy "Photos publicly viewable" on storage.objects for select using (bucket_id = 'task-photos');
create policy "Authenticated users can upload photos" on storage.objects for insert with check (bucket_id = 'task-photos' and auth.role() = 'authenticated');

-- ============================================
-- SEED: THE CURVE PROJECT
-- ============================================
insert into public.projects (name, location, project_type, target_date, rag_status, description)
values ('The Curve', 'Lasode, Victoria Island', '4 Storey Residential Development', '2026-03-27', 'At Risk', 'Practical completion target: 27 March 2026');

-- Get the project id for seeding tasks
do $$
declare
  proj_id uuid;
begin
  select id into proj_id from public.projects where name = 'The Curve' limit 1;

  -- WEEK 1 TASKS
  insert into public.tasks (project_id, title, week, section, status, priority, is_critical, start_date, end_date) values
  (proj_id, 'Plaster lift shaft', 'WEEK 1', 'Roofing & Rooftop', 'Not Started', 'Critical', true, '2026-02-17', '2026-02-23'),
  (proj_id, 'Complete rooftop duct casting', 'WEEK 1', 'Roofing & Rooftop', 'Not Started', 'Critical', true, '2026-02-17', '2026-02-23'),
  (proj_id, 'Aluminium roof covering installation', 'WEEK 1', 'Roofing & Rooftop', 'Not Started', 'Critical', true, '2026-02-17', '2026-02-23'),
  (proj_id, 'Prepare surfaces for waterproofing', 'WEEK 1', 'Roofing & Rooftop', 'Not Started', 'High', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Conduct full pressure test', 'WEEK 1', 'Plumbing', 'Not Started', 'High', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Begin kitchen plumbing rework across all floors', 'WEEK 1', 'Plumbing', 'Not Started', 'Critical', true, '2026-02-17', '2026-02-23'),
  (proj_id, 'Begin rooftop toilet plumbing', 'WEEK 1', 'Plumbing', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Begin kitchen electrical rework', 'WEEK 1', 'Electrical', 'Not Started', 'Critical', true, '2026-02-17', '2026-02-23'),
  (proj_id, 'Connect load cables to ground floor panels', 'WEEK 1', 'Electrical', 'Not Started', 'High', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Begin rooftop cabling', 'WEEK 1', 'Electrical', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Complete all external painting', 'WEEK 1', 'External Works', 'Not Started', 'High', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Curtain wall vendor completes installation', 'WEEK 1', 'External Works', 'Not Started', 'High', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Fix all glasses & complete window installations', 'WEEK 1', 'External Works', 'Not Started', 'High', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'External electrical works completed', 'WEEK 1', 'External Works', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Fascia brick procurement and touch-ups', 'WEEK 1', 'External Works', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Railing vendor mobilises', 'WEEK 1', 'External Works', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Service stair plastering for screed', 'WEEK 1', 'Internal Prep', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Panel room plastering', 'WEEK 1', 'Internal Prep', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Generator area plastering', 'WEEK 1', 'Internal Prep', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Internal plaster maintenance corrections', 'WEEK 1', 'Internal Prep', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Beam bulge corrections', 'WEEK 1', 'Internal Prep', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Complete demolition', 'WEEK 1', 'Security House', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  (proj_id, 'Begin foundation rebuild', 'WEEK 1', 'Security House', 'Not Started', 'Normal', false, '2026-02-17', '2026-02-23'),
  -- WEEK 2 TASKS
  (proj_id, 'Waterproofing works commence', 'WEEK 2', 'Rooftop', 'Not Started', 'Critical', true, '2026-02-24', '2026-03-01'),
  (proj_id, 'Cure period observed', 'WEEK 2', 'Rooftop', 'Not Started', 'Critical', true, '2026-02-24', '2026-03-01'),
  (proj_id, 'Wall dressing correction for rooftop wall', 'WEEK 2', 'Rooftop', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Rooftop toilet plumbing completion', 'WEEK 2', 'Rooftop', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Resume toilet tiling across all floors', 'WEEK 2', 'Toilets', 'Not Started', 'High', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Begin tiling maids rooms', 'WEEK 2', 'Toilets', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Tile maintenance corrections', 'WEEK 2', 'Toilets', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Continue plumbing & electrical rework', 'WEEK 2', 'Kitchen', 'Not Started', 'Critical', true, '2026-02-24', '2026-03-01'),
  (proj_id, 'Begin plastering kitchen areas where complete', 'WEEK 2', 'Kitchen', 'Not Started', 'High', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Complete 3rd floor toilet POP (once roof sealed)', 'WEEK 2', 'POP & Screeding', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Complete staircase POP (3rd floor)', 'WEEK 2', 'POP & Screeding', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Continue ground floor POP', 'WEEK 2', 'POP & Screeding', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Screed service stairwell', 'WEEK 2', 'POP & Screeding', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Sand filling & compaction (compound)', 'WEEK 2', 'External Works', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Obtain stamp concrete design from ED/Architect', 'WEEK 2', 'External Works', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  (proj_id, 'Finalize fence contractor selection', 'WEEK 2', 'External Works', 'Not Started', 'Normal', false, '2026-02-24', '2026-03-01'),
  -- WEEK 3 TASKS
  (proj_id, 'Waterproofing completed', 'WEEK 3', 'Rooftop', 'Not Started', 'Critical', true, '2026-03-02', '2026-03-08'),
  (proj_id, 'Rooftop screeding', 'WEEK 3', 'Rooftop', 'Not Started', 'High', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Rooftop tiling begins', 'WEEK 3', 'Rooftop', 'Not Started', 'Critical', true, '2026-03-02', '2026-03-08'),
  (proj_id, 'Complete reworked plumbing & electrical', 'WEEK 3', 'Kitchens', 'Not Started', 'Critical', true, '2026-03-02', '2026-03-08'),
  (proj_id, 'POP completed', 'WEEK 3', 'Kitchens', 'Not Started', 'High', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Screeding completed', 'WEEK 3', 'Kitchens', 'Not Started', 'High', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Begin full ground floor tiling', 'WEEK 3', 'Ground Floor', 'Not Started', 'Critical', true, '2026-03-02', '2026-03-08'),
  (proj_id, 'Begin car park ceiling screeding', 'WEEK 3', 'Ground Floor', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Begin car park floor tiling', 'WEEK 3', 'Ground Floor', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Marble at lift faces', 'WEEK 3', 'Marble Works', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Marble at column faces', 'WEEK 3', 'Marble Works', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Demolition of existing fence', 'WEEK 3', 'Fence', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Begin reconstruction', 'WEEK 3', 'Fence', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Generator house toilet works', 'WEEK 3', 'Generator House', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  (proj_id, 'Finishing works', 'WEEK 3', 'Generator House', 'Not Started', 'Normal', false, '2026-03-02', '2026-03-08'),
  -- WEEK 4 TASKS
  (proj_id, 'Lift installation begins', 'WEEK 4', 'Lift', 'Not Started', 'Critical', true, '2026-03-09', '2026-03-15'),
  (proj_id, 'Door delivery', 'WEEK 4', 'Doors', 'Not Started', 'Critical', true, '2026-03-09', '2026-03-15'),
  (proj_id, 'Begin door installation', 'WEEK 4', 'Doors', 'Not Started', 'Critical', true, '2026-03-09', '2026-03-15'),
  (proj_id, 'Begin cabinet installation (if available)', 'WEEK 4', 'Kitchens', 'Not Started', 'Normal', false, '2026-03-09', '2026-03-15'),
  (proj_id, 'Complete all toilet tiling', 'WEEK 4', 'Toilets', 'Not Started', 'Critical', true, '2026-03-09', '2026-03-15'),
  (proj_id, 'Begin sanitary fixture installation', 'WEEK 4', 'Toilets', 'Not Started', 'High', false, '2026-03-09', '2026-03-15'),
  (proj_id, 'Final panel terminations', 'WEEK 4', 'Electrical', 'Not Started', 'High', false, '2026-03-09', '2026-03-15'),
  (proj_id, 'Begin internal fittings installation', 'WEEK 4', 'Electrical', 'Not Started', 'Normal', false, '2026-03-09', '2026-03-15'),
  (proj_id, 'Gate fabrication offsite', 'WEEK 4', 'Gates & Compound', 'Not Started', 'Critical', true, '2026-03-09', '2026-03-15'),
  (proj_id, 'Stamp concrete works begin', 'WEEK 4', 'Gates & Compound', 'Not Started', 'Normal', false, '2026-03-09', '2026-03-15'),
  -- WEEK 5 TASKS
  (proj_id, 'Sanitary fixtures installed', 'WEEK 5', 'Plumbing', 'Not Started', 'High', false, '2026-03-16', '2026-03-22'),
  (proj_id, 'Final plumbing testing', 'WEEK 5', 'Plumbing', 'Not Started', 'High', false, '2026-03-16', '2026-03-22'),
  (proj_id, 'Full building energisation', 'WEEK 5', 'Electrical', 'Not Started', 'High', false, '2026-03-16', '2026-03-22'),
  (proj_id, 'Socket & lighting testing', 'WEEK 5', 'Electrical', 'Not Started', 'Normal', false, '2026-03-16', '2026-03-22'),
  (proj_id, 'Lift testing & commissioning', 'WEEK 5', 'Lift', 'Not Started', 'Critical', true, '2026-03-16', '2026-03-22'),
  (proj_id, 'Fence completed', 'WEEK 5', 'Fence & Gate', 'Not Started', 'Critical', true, '2026-03-16', '2026-03-22'),
  (proj_id, 'Gate installation', 'WEEK 5', 'Fence & Gate', 'Not Started', 'Critical', true, '2026-03-16', '2026-03-22'),
  (proj_id, 'Full internal painting begins', 'WEEK 5', 'Internal Painting', 'Not Started', 'Normal', false, '2026-03-16', '2026-03-22'),
  (proj_id, 'Fascia brick final correction', 'WEEK 5', 'Final Touches', 'Not Started', 'Normal', false, '2026-03-16', '2026-03-22'),
  (proj_id, 'Tile maintenance corrections', 'WEEK 5', 'Final Touches', 'Not Started', 'Normal', false, '2026-03-16', '2026-03-22'),
  (proj_id, 'Silicone & finishing details', 'WEEK 5', 'Final Touches', 'Not Started', 'Normal', false, '2026-03-16', '2026-03-22'),
  -- WEEK 6 TASKS
  (proj_id, 'Full building snag walk', 'WEEK 6', 'Snagging', 'Not Started', 'High', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Paint stain corrections', 'WEEK 6', 'Snagging', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Tile misalignment corrections', 'WEEK 6', 'Snagging', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Silicone gap corrections', 'WEEK 6', 'Snagging', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Door alignment corrections', 'WEEK 6', 'Snagging', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Plumbing leak corrections', 'WEEK 6', 'Snagging', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Deep cleaning', 'WEEK 6', 'Cleaning & Handover', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Remove all debris', 'WEEK 6', 'Cleaning & Handover', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27'),
  (proj_id, 'Landscape finishing touches', 'WEEK 6', 'Cleaning & Handover', 'Not Started', 'Normal', false, '2026-03-23', '2026-03-27');

  -- Seed risks
  insert into public.risks (project_id, title, likelihood, impact, status, mitigation, owner) values
  (proj_id, 'Kitchen rework manpower delays', 'High', 'High', 'Active', 'Increase gang size immediately. Source additional skilled tradespeople this week.', 'Project Manager'),
  (proj_id, 'Rooftop waterproofing delay', 'High', 'High', 'Active', 'Waterproofing must begin Week 2. Confirm contractor mobilisation date now.', 'Site Supervisor'),
  (proj_id, 'Door delivery delay', 'High', 'High', 'Active', 'Chase supplier for confirmed delivery date. Identify backup supplier.', 'Project Manager'),
  (proj_id, 'Lift installation duration', 'Medium', 'High', 'Active', 'Confirm lift contractor programme. Ensure shaft is clear by Week 4 start.', 'Project Manager'),
  (proj_id, 'Fence demolition timing', 'Medium', 'Medium', 'Active', 'Confirm contractor and start date. Do not delay beyond Week 3.', 'Site Supervisor'),
  (proj_id, 'Stamp concrete design delay', 'High', 'Medium', 'Active', 'Design must be obtained from ED/Architect in Week 2. Escalate if not received.', 'Project Manager');

end $$;
