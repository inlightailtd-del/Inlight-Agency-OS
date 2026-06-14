-- ============================================================
-- TASKS RLS POLICIES
-- ============================================================
-- Enables full CRUD for authenticated users on tasks
-- linked to projects they own.

-- SELECT policy (already exists from initial migration):
-- "Users see tasks for own projects" on tasks for select
--   using (project_id in (select id from projects where user_id = auth.uid()));

-- Allow users to insert tasks on projects they own
create policy "Users can insert tasks for own projects" on tasks
  for insert with check (
    project_id in (select id from projects where user_id = auth.uid())
  );

-- Allow users to update tasks on projects they own
create policy "Users can update tasks for own projects" on tasks
  for update using (
    project_id in (select id from projects where user_id = auth.uid())
  );

-- Allow users to delete tasks on projects they own
create policy "Users can delete tasks for own projects" on tasks
  for delete using (
    project_id in (select id from projects where user_id = auth.uid())
  );