-- ============================================================
-- MILESTONES RLS POLICIES
-- ============================================================
-- Enables full CRUD for authenticated users on milestones
-- linked to projects they own.

-- Allow users to insert milestones on projects they own
create policy "Users can insert milestones for own projects" on milestones
  for insert with check (
    project_id in (select id from projects where user_id = auth.uid())
  );

-- Allow users to update milestones on projects they own
create policy "Users can update milestones for own projects" on milestones
  for update using (
    project_id in (select id from projects where user_id = auth.uid())
  );

-- Allow users to delete milestones on projects they own
create policy "Users can delete milestones for own projects" on milestones
  for delete using (
    project_id in (select id from projects where user_id = auth.uid())
  );