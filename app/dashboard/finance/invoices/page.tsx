import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate } from '@/lib/utils'
import {
  fetchInvoices,
  invoiceStatusOptions,
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  type InvoiceListStatus,
} from '@/lib/supabase/finance'

const getSearchValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value?.trim() ?? ''

const getStatusValue = (value: string | string[] | undefined): InvoiceListStatus => {
  const raw = Array.isArray(value) ? value[0] : value
  return invoiceStatusOptions.includes(raw as InvoiceListStatus) ? (raw as InvoiceListStatus) : 'all'
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: { query?: string | string[]; status?: string | string[] }
}) {
  const query = getSearchValue(searchParams?.query)
  const status = getStatusValue(searchParams?.status)
  const supabase = await createClient()
  const invoices = await fetchInvoices(supabase, query, status)

  const statusQuery = (s: InvoiceListStatus) =>
    `/dashboard/finance/invoices?status=${s}${query ? `&query=${encodeURIComponent(query)}` : ''}`

  const totalAmount = invoices.reduce((sum, i) => sum + i.total, 0)
  const paidAmount = invoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">Manage invoices, track payments, and monitor outstanding balances.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/finance"><Button variant="outline">Dashboard</Button></Link>
          <Link href="/dashboard/finance/invoices/new"><Button>New Invoice</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KPI title="Total Invoices" value={invoices.length} />
        <KPI title="Total Amount" value={formatPKR(totalAmount)} color="text-slate-900" />
        <KPI title="Paid" value={formatPKR(paidAmount)} color="text-emerald-600" />
        <KPI title="Outstanding" value={invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').length} color="text-amber-600" />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr] mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1"><Input id="query" name="query" placeholder="Search by invoice number" defaultValue={query} /></div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">Search</Button>
        </form>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Status filters</p>
          <div className="flex flex-wrap gap-2">
            {invoiceStatusOptions.map((option) => {
              const active = status === option
              return (
                <Link key={option} href={statusQuery(option)} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                  {getInvoiceStatusLabel(option)}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Invoice #</th>
              <th className="px-4 py-3 font-medium text-slate-600">Client</th>
              <th className="px-4 py-3 font-medium text-slate-600">Project</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Issue Date</th>
              <th className="px-4 py-3 font-medium text-slate-600">Due Date</th>
              <th className="px-4 py-3 font-medium text-slate-600">Amount</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoices.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">No invoices found.</td></tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 align-top">
                    <Link href={`/dashboard/finance/invoices/${inv.id}`} className="font-semibold text-slate-900 hover:text-slate-700">{inv.invoice_number}</Link>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Link href={`/dashboard/clients/${inv.client_id}`} className="text-sm text-slate-700 hover:text-slate-900 hover:underline">{inv.client_name ?? '—'}</Link>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">{inv.project_name ?? '—'}</td>
                  <td className="px-4 py-4 align-top"><Badge variant={getInvoiceStatusVariant(inv.status)}>{getInvoiceStatusLabel(inv.status)}</Badge></td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">{inv.issue_date ? formatDate(inv.issue_date) : '—'}</td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                  <td className="px-4 py-4 align-top text-sm font-semibold text-slate-900">{formatPKR(inv.total)}</td>
                  <td className="px-4 py-4 align-top text-right text-sm font-medium">
                    <Link href={`/dashboard/finance/invoices/${inv.id}`} className="text-slate-700 hover:text-slate-900">View</Link>
                    <span className="mx-2 text-slate-300">|</span>
                    <Link href={`/dashboard/finance/invoices/${inv.id}/edit`} className="text-slate-900 hover:underline">Edit</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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