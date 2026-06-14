import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate } from '@/lib/utils'
import { fetchInvoices, fetchExpenses, getInvoiceStatusLabel, getInvoiceStatusVariant } from '@/lib/supabase/finance'

export default async function FinanceDashboardPage() {
  const supabase = await createClient()
  const invoices = await fetchInvoices(supabase)
  const expenses = await fetchExpenses(supabase)

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)
  const pendingRevenue = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + i.total, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const profit = totalRevenue - totalExpenses
  const outstandingCount = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length

  const recentInvoices = invoices.slice(0, 5)
  const recentExpenses = expenses.slice(0, 5)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Finance</h1>
          <p className="text-sm text-slate-500 mt-1">Revenue, expenses, invoices, and financial health at a glance.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/finance/invoices"><Button variant="outline">Invoices</Button></Link>
          <Link href="/dashboard/finance/expenses"><Button variant="outline">Expenses</Button></Link>
          <Link href="/dashboard/finance/analytics"><Button variant="outline">Analytics</Button></Link>
          <Link href="/dashboard/finance/invoices/new"><Button>New Invoice</Button></Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatPKR(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatPKR(pendingRevenue)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatPKR(totalExpenses)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1 ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatPKR(profit)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{invoices.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{outstandingCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{overdueCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Paid</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{invoices.filter((i) => i.status === 'paid').length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Invoices</h2>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices yet.</p>
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => (
                <Link key={inv.id} href={`/dashboard/finance/invoices/${inv.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{inv.invoice_number}</p>
                    <p className="text-xs text-slate-500 mt-1">{inv.client_name ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={getInvoiceStatusVariant(inv.status)}>{getInvoiceStatusLabel(inv.status)}</Badge>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{formatPKR(inv.total)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Expenses */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Expenses</h2>
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-slate-500">No expenses yet.</p>
          ) : (
            <div className="space-y-3">
              {recentExpenses.map((exp) => (
                <Link key={exp.id} href={`/dashboard/finance/expenses/${exp.id}`} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{exp.description}</p>
                    <p className="text-xs text-slate-500 mt-1">{exp.expense_date ? formatDate(exp.expense_date) : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">{formatPKR(exp.amount)}</p>
                    {exp.is_billable && <Badge variant="info" className="mt-1">Billable</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}