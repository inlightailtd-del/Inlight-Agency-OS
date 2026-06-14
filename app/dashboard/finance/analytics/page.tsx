import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPKR } from '@/lib/utils'
import {
  fetchInvoices,
  fetchExpenses,
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  invoiceStatuses,
  expenseCategories,
  getExpenseCategoryLabel,
} from '@/lib/supabase/finance'

export default async function FinanceAnalyticsPage() {
  const supabase = await createClient()
  const invoices = await fetchInvoices(supabase)
  const expenses = await fetchExpenses(supabase)

  // Revenue KPIs
  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)
  const pendingRevenue = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + i.total, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const profit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0

  // Invoice status distribution
  const statusDistribution = invoiceStatuses.map((status) => ({
    name: getInvoiceStatusLabel(status),
    status,
    count: invoices.filter((i) => i.status === status).length,
    total: invoices.filter((i) => i.status === status).reduce((sum, i) => sum + i.total, 0),
  }))

  // Expense category distribution
  const categoryDistribution = expenseCategories.map((cat) => ({
    name: getExpenseCategoryLabel(cat),
    cat,
    count: expenses.filter((e) => e.category === cat).length,
    total: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
  }))

  // Client revenue attribution
  const clientRevenue: Record<string, { name: string; revenue: number; count: number }> = {}
  invoices.filter((i) => i.status === 'paid').forEach((i) => {
    const key = i.client_id
    if (!clientRevenue[key]) clientRevenue[key] = { name: i.client_name ?? 'Unknown', revenue: 0, count: 0 }
    clientRevenue[key].revenue += i.total
    clientRevenue[key].count += 1
  })
  const topClients = Object.values(clientRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  // Monthly revenue (from paid invoices)
  const monthlyRevenue: Record<string, number> = {}
  invoices.filter((i) => i.status === 'paid' && i.paid_at).forEach((i) => {
    const month = i.paid_at!.substring(0, 7) // YYYY-MM
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + i.total
  })

  // Monthly expenses
  const monthlyExpenses: Record<string, number> = {}
  expenses.filter((e) => e.expense_date).forEach((e) => {
    const month = e.expense_date!.substring(0, 7)
    monthlyExpenses[month] = (monthlyExpenses[month] || 0) + e.amount
  })

  // Combine months
  const allMonths = new Set([...Object.keys(monthlyRevenue), ...Object.keys(monthlyExpenses)])
  const sortedMonths = [...allMonths].sort()

  const maxMonthlyAmount = Math.max(
    ...sortedMonths.map((m) => Math.max(monthlyRevenue[m] || 0, monthlyExpenses[m] || 0)),
    1
  )

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Financial Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Revenue, expenses, client attribution, and monthly breakdown.
          </p>
        </div>
        <Link href="/dashboard/finance">
          <Button variant="outline">Back to Finance</Button>
        </Link>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Revenue" value={formatPKR(totalRevenue)} color="text-emerald-600" />
        <KPI title="Pending Revenue" value={formatPKR(pendingRevenue)} color="text-amber-600" />
        <KPI title="Total Expenses" value={formatPKR(totalExpenses)} color="text-red-600" />
        <KPI title="Net Profit" value={formatPKR(profit)} color={profit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPI title="Profit Margin" value={`${profitMargin}%`} color={profitMargin >= 20 ? 'text-emerald-600' : 'text-red-600'} />
        <KPI title="Paid Invoices" value={invoices.filter((i) => i.status === 'paid').length} color="text-emerald-600" />
        <KPI title="Overdue Invoices" value={invoices.filter((i) => i.status === 'overdue').length} color={invoices.filter((i) => i.status === 'overdue').length > 0 ? 'text-red-600' : 'text-slate-900'} />
        <KPI title="Avg Invoice Value" value={formatPKR(invoices.length > 0 ? Math.round(invoices.reduce((s, i) => s + i.total, 0) / invoices.length) : 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        {/* Invoice Status Distribution */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Invoice Status Distribution</h2>
          <div className="space-y-4">
            {statusDistribution.map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.name}</span>
                  <span className="font-semibold text-slate-900">{item.count} ({formatPKR(item.total)})</span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      item.status === 'paid' ? 'bg-emerald-500' :
                      item.status === 'sent' ? 'bg-sky-500' :
                      item.status === 'overdue' ? 'bg-red-500' :
                      item.status === 'draft' ? 'bg-slate-400' : 'bg-red-400'
                    } transition-all duration-500`}
                    style={{ width: `${invoices.length > 0 ? Math.round((item.count / invoices.length) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Category Distribution */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Expense Categories</h2>
          <div className="space-y-4">
            {categoryDistribution.filter((c) => c.total > 0).map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{item.name}</span>
                  <span className="font-semibold text-slate-900">{item.count} ({formatPKR(item.total)})</span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-red-400 transition-all duration-500"
                    style={{ width: `${totalExpenses > 0 ? Math.round((item.total / totalExpenses) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Breakdown */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Monthly Revenue vs Expenses</h2>
          {sortedMonths.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No monthly data available.</p>
          ) : (
            <div className="space-y-3">
              {sortedMonths.map((month) => {
                const rev = monthlyRevenue[month] || 0
                const exp = monthlyExpenses[month] || 0
                const net = rev - exp
                return (
                  <div key={month}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600 font-medium">{month}</span>
                      <span className={`text-xs font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        Net: {formatPKR(net)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 left-0 h-full bg-slate-300 rounded-full"
                          style={{ width: `${maxMonthlyAmount > 0 ? Math.round((rev / maxMonthlyAmount) * 100) : 0}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 h-full bg-red-400 rounded-full"
                          style={{ width: `${maxMonthlyAmount > 0 ? Math.round((exp / maxMonthlyAmount) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 w-28 text-right">
                        Rev: {formatPKR(rev)} | Exp: {formatPKR(exp)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top Clients by Revenue */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Top Clients by Revenue</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No paid invoices yet.</p>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {topClients.map((client, idx) => (
                <div key={client.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-5">{idx + 1}.</span>
                      <span className="text-slate-700">{client.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">{client.count} invoices</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${totalRevenue > 0 ? Math.round((client.revenue / totalRevenue) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900 w-28 text-right">{formatPKR(client.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPI({ title, value, color = 'text-slate-900' }: { title: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}