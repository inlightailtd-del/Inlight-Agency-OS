import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate } from '@/lib/utils'
import {
  fetchExpenses,
  expenseCategories,
  getExpenseCategoryLabel,
  type ExpenseWithRelations,
} from '@/lib/supabase/finance'

const G = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v?.trim() ?? ''

export default async function ExpensesPage({ searchParams }: { searchParams?: { query?: string | string[]; category?: string | string[] } }) {
  const q = G(searchParams?.query)
  const cat = G(searchParams?.category)
  const supabase = await createClient()
  const expenses = await fetchExpenses(supabase, q, cat || undefined)

  const catQuery = (c: string) => `/dashboard/finance/expenses?category=${c}${q ? `&query=${encodeURIComponent(q)}` : ''}`
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)
  const billableAmount = expenses.filter((e) => e.is_billable).reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Expenses</h1><p className="text-sm text-slate-500 mt-1">Track business expenses by category, project, and client.</p></div>
        <div className="flex gap-3"><Link href="/dashboard/finance"><Button variant="outline">Dashboard</Button></Link><Link href="/dashboard/finance/expenses/new"><Button>Add Expense</Button></Link></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Expenses" value={expenses.length} />
        <KPI title="Total Amount" value={formatPKR(totalAmount)} color="text-red-600" />
        <KPI title="Billable" value={formatPKR(billableAmount)} color="text-emerald-600" />
        <KPI title="Avg per Expense" value={formatPKR(expenses.length > 0 ? Math.round(totalAmount / expenses.length) : 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr] mb-6">
        <form method="get" className="flex gap-3"><div className="flex-1"><Input name="query" placeholder="Search by description" defaultValue={q} /></div><Button type="submit" variant="secondary">Search</Button></form>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Categories</p>
          <div className="flex flex-wrap gap-2">
            {['all', ...expenseCategories].map((c) => { const active = (cat || 'all') === c; return <Link key={c} href={catQuery(c)} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>{c === 'all' ? 'All' : getExpenseCategoryLabel(c)}</Link> })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50"><tr><th className="px-4 py-3 font-medium text-slate-600">Description</th><th className="px-4 py-3 font-medium text-slate-600">Category</th><th className="px-4 py-3 font-medium text-slate-600">Client / Project</th><th className="px-4 py-3 font-medium text-slate-600">Billable</th><th className="px-4 py-3 font-medium text-slate-600">Date</th><th className="px-4 py-3 font-medium text-slate-600">Amount</th><th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-200">
            {expenses.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">No expenses found.</td></tr> : expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-4"><Link href={`/dashboard/finance/expenses/${e.id}`} className="font-semibold text-slate-900 hover:text-slate-700">{e.description}</Link></td>
                <td className="px-4 py-4"><Badge variant="default">{getExpenseCategoryLabel(e.category)}</Badge></td>
                <td className="px-4 py-4 text-sm text-slate-600">{e.client_name ?? e.project_name ?? '—'}</td>
                <td className="px-4 py-4">{e.is_billable ? <Badge variant="info">Billable</Badge> : <span className="text-sm text-slate-400">—</span>}</td>
                <td className="px-4 py-4 text-sm text-slate-600">{e.expense_date ? formatDate(e.expense_date) : '—'}</td>
                <td className="px-4 py-4 text-sm font-semibold text-red-600">{formatPKR(e.amount)}</td>
                <td className="px-4 py-4 text-right text-sm font-medium"><Link href={`/dashboard/finance/expenses/${e.id}`} className="text-slate-700 hover:text-slate-900">View</Link><span className="mx-2 text-slate-300">|</span><Link href={`/dashboard/finance/expenses/${e.id}/edit`} className="text-slate-900 hover:underline">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) { return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p><p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p></div> }