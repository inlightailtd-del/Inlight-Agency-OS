import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchClients } from '@/lib/supabase/clients'
import { fetchProjects } from '@/lib/supabase/projects'
import {
  expenseFormSchema,
  expenseCategories,
  fetchExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseCategoryLabel,
} from '@/lib/supabase/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateExpenseAction(formData: FormData) {
  'use server'
  const rawValues = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const expId = String(rawValues.id || '')
  if (!expId) throw new Error('Missing expense ID')
  const result = expenseFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  await updateExpense(supabase, expId, {
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
  revalidatePath(`/dashboard/finance/expenses/${expId}`)
  redirect(`/dashboard/finance/expenses/${expId}`)
}

async function deleteExpenseAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await deleteExpense(supabase, String(formData.get('expenseId') || ''))
  revalidatePath('/dashboard/finance/expenses')
  redirect('/dashboard/finance/expenses')
}

export default async function EditExpensePage({ params }: { params: { expenseId: string } }) {
  const supabase = await createClient()
  const expense = await fetchExpenseById(supabase, params.expenseId)
  const clients = await fetchClients(supabase)
  const projects = await fetchProjects(supabase)
  if (!expense) return <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">Expense not found.</p><Link href="/dashboard/finance/expenses" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link></div>

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Edit Expense</h1><p className="text-sm text-slate-500 mt-1">{expense.description}</p></div>
        <div className="flex gap-3">
          <Link href={`/dashboard/finance/expenses/${expense.id}`} className="text-slate-700 hover:text-slate-900">View</Link>
          <form action={deleteExpenseAction}><input type="hidden" name="expenseId" value={expense.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateExpenseAction} className="grid gap-6">
          <input type="hidden" name="id" value={expense.id} />
          <div><label className="text-sm font-medium text-slate-700" htmlFor="description">Description <span className="text-red-500">*</span></label><Input id="description" name="description" required defaultValue={expense.description} /></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="amount">Amount <span className="text-red-500">*</span></label><Input id="amount" name="amount" type="number" required min="0" defaultValue={String(expense.amount)} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="category">Category</label><Select id="category" name="category" defaultValue={expense.category ?? 'other'}>{expenseCategories.map((c) => (<option key={c} value={c}>{getExpenseCategoryLabel(c)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="expense_date">Date</label><Input id="expense_date" name="expense_date" type="date" defaultValue={expense.expense_date ?? ''} /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="client_id">Client</label><Select id="client_id" name="client_id" defaultValue={expense.client_id ?? ''}><option value="">— None —</option>{clients.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="project_id">Project</label><Select id="project_id" name="project_id" defaultValue={expense.project_id ?? ''}><option value="">— None —</option>{projects.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}</Select></div>
          </div>
          <div className="flex items-center gap-3"><input type="checkbox" id="is_billable" name="is_billable" value="true" defaultChecked={expense.is_billable} className="h-4 w-4 rounded border-slate-300" /><label htmlFor="is_billable" className="text-sm font-medium text-slate-700">Billable to client</label></div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="notes">Notes</label><Textarea id="notes" name="notes" defaultValue={expense.notes ?? ''} /></div>
          <div className="flex justify-end gap-3 pt-2"><Link href={`/dashboard/finance/expenses/${expense.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Save changes</Button></div>
        </form>
      </div>
    </div>
  )
}