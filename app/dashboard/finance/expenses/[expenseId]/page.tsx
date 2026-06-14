import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate, formatDateTime } from '@/lib/utils'
import {
  fetchExpenseById,
  deleteExpense,
  getExpenseCategoryLabel,
} from '@/lib/supabase/finance'

export default async function ExpenseDetailPage({ params }: { params: { expenseId: string } }) {
  const supabase = await createClient()
  const expense = await fetchExpenseById(supabase, params.expenseId)
  if (!expense) notFound()

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{expense.description}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="default">{getExpenseCategoryLabel(expense.category)}</Badge>
            {expense.is_billable && <Badge variant="info">Billable</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/finance/expenses" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link>
          <Link href={`/dashboard/finance/expenses/${expense.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Edit</Link>
          <form action={deleteExpenseAction}>
            <input type="hidden" name="expenseId" value={expense.id} />
            <Button type="submit" variant="destructive">Delete</Button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Category" value={getExpenseCategoryLabel(expense.category)} />
            <DetailRow label="Billable" value={expense.is_billable ? 'Yes' : 'No'} />
            <DetailRow label="Date" value={expense.expense_date ? formatDate(expense.expense_date) : '—'} />
            <DetailRow label="Amount" value={formatPKR(expense.amount)} />
            <DetailRow label="Currency" value={expense.currency ?? 'PKR'} />
          </div>
          {expense.client_name && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <DetailRow label="Client" value={expense.client_name} />
            </div>
          )}
          {expense.project_name && (
            <div className="mt-4">
              <DetailRow label="Project" value={expense.project_name} />
            </div>
          )}
          {expense.notes && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3>
              <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">{expense.notes}</p>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Amount</h3>
          <p className="text-3xl font-bold text-red-600">{formatPKR(expense.amount)}</p>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Category</p>
            <p className="mt-2">{getExpenseCategoryLabel(expense.category)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

async function deleteExpenseAction(formData: FormData) {
  'use server'
  const expenseId = String(formData.get('expenseId') || '')
  if (!expenseId) throw new Error('Missing expense id')
  const supabase = await createClient()
  await deleteExpense(supabase, expenseId)
  revalidatePath('/dashboard/finance/expenses')
  redirect('/dashboard/finance/expenses')
}