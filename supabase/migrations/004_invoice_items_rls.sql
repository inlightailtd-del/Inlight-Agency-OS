-- RLS policy for invoice_items - users can access items of their own invoices
create policy "Users see items for own invoices" on invoice_items for select
  using (invoice_id in (select id from invoices where user_id = auth.uid()));

create policy "Users can insert items for own invoices" on invoice_items
  for insert with check (
    invoice_id in (select id from invoices where user_id = auth.uid())
  );

create policy "Users can update items for own invoices" on invoice_items
  for update using (
    invoice_id in (select id from invoices where user_id = auth.uid())
  );

create policy "Users can delete items for own invoices" on invoice_items
  for delete using (
    invoice_id in (select id from invoices where user_id = auth.uid())
  );