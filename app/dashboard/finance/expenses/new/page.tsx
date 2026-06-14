import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchClients } from '@/lib/supabase/clients'
import { fetchProjects } from '@/lib/supabase/projects'
import {
  expenseFormSchema,
  expenseCategories,
  createExpense,
  getExpenseCategoryLabel,
} from '@/lib/supabase/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createExpenseAction(formData: FormData) {
  'use server'
  const rawValues = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const result = expenseFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  await createExpense(supabase, user.id, {
    description: result.data.description,
    amount: result.data.amount,
    currency: result.data.currency,
    category: result.data.category,
    expense_date: result.data.expense_date,
    project_id: result.data.project_id,
    client_id: result.data.client_id,
    is_billable: result.data.is_billable,
    notes: result.data.notes,
  })
  revalidatePath('/dashboard/finance/expenses')
  redirect('/dashboard/finance/expenses')
}

export default async function NewExpensePage() {
  const supabase = await createClient()
  const clients = await fetchClients(supabase)
  const projects = await fetchProjects(supabase)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Add Expense</h1><p className="text-sm text-slate-500 mt-1">Record a business expense with category and optional client/project linkage.</p></div>
        <Link href="/dashboard/finance/expenses" className="text-slate-700 hover:text-slate-900">Back to expenses</Link>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createExpenseAction} className="grid gap-6">
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Description <span className="text-red-500">*</span></label><Input id="description" name="description" required placeholder="Google Ads campaign budget" /></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="amount">Amount <span className="text-red-500">*</span></label><Input id="amount" name="amount" type="number" required min="0" placeholder="50000" /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="category">Category</label><Select id="category" name="category" defaultValue="other">{expenseCategories.map((c) => (<option key={c} value={c}>{getExpenseCategoryLabel(c)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="expense_date">Date</label><Input id="expense_date" name="expense_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="client_id">Client</label><Select id="client_id" name="client_id"><option value="">— None —</option>{clients.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="project_id">Project</label><Select id="project_id" name="project_id"><option value="">— None —</option>{projects.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}</Select></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex items-center gap-3 pt-2"><input type="checkbox" id="is_billable" name="is_billable" value="true" className="h-4 w-4 rounded border-slate-300" /><label htmlFor="is_billable" className="text-sm font-medium text-slate-700">Billable to client</label></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="notes">Notes</label><Textarea id="notes" name="notes" placeholder="Additional notes..." /></div>
          <div className="flex justify-end gap-3 pt-2"><Link href="/dashboard/finance/expenses" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Add expense</Button></div>
        </form>
      </div>
    </div>
  )
}