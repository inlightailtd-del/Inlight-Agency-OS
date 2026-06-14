import Link from 'next/link'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDate, formatDateTime } from '@/lib/utils'
import {
  fetchInvoiceById,
  fetchInvoiceItems,
  updateInvoice,
  deleteInvoice,
  createInvoiceItem,
  deleteInvoiceItem,
  getInvoiceStatusLabel,
  getInvoiceStatusVariant,
  getPaymentMethodLabel,
} from '@/lib/supabase/finance'

export default async function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const supabase = await createClient()
  const invoice = await fetchInvoiceById(supabase, params.invoiceId)
  const items = await fetchInvoiceItems(supabase, params.invoiceId)
  if (!invoice) notFound()

  const itemTotal = items.reduce((sum, i) => sum + i.total, 0)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{invoice.invoice_number}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={getInvoiceStatusVariant(invoice.status)}>{getInvoiceStatusLabel(invoice.status)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/finance/invoices" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link>
          <Link href={`/dashboard/finance/invoices/${invoice.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Edit</Link>
          <form action={deleteInvoiceAction}><input type="hidden" name="invoiceId" value={invoice.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {invoice.client_name && (
              <div className="mb-6 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Client</p>
                <Link href={`/dashboard/clients/${invoice.client_id}`} className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-slate-900 hover:text-slate-700">{invoice.client_name}</Link>
                {invoice.project_name && <p className="text-sm text-slate-500 mt-1">Project: {invoice.project_name}</p>}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailRow label="Status" value={getInvoiceStatusLabel(invoice.status)} />
              <DetailRow label="Payment Method" value={getPaymentMethodLabel(invoice.payment_method)} />
              <DetailRow label="Issue Date" value={invoice.issue_date ? formatDate(invoice.issue_date) : '—'} />
              <DetailRow label="Due Date" value={invoice.due_date ? formatDate(invoice.due_date) : '—'} />
              <DetailRow label="Paid At" value={invoice.paid_at ? formatDateTime(invoice.paid_at) : '—'} />
              <DetailRow label="Currency" value={invoice.currency ?? 'PKR'} />
            </div>

            {/* Line Items */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Line Items</h3>
              {items.length === 0 ? (
                <p className="text-sm text-slate-500">No line items yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left font-medium text-slate-600">Description</th><th className="px-3 py-2 text-right font-medium text-slate-600">Qty</th><th className="px-3 py-2 text-right font-medium text-slate-600">Unit Price</th><th className="px-3 py-2 text-right font-medium text-slate-600">Total</th><th className="px-3 py-2"></th></tr></thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item) => (
                        <tr key={item.id}><td className="px-3 py-2 text-slate-900">{item.description}</td><td className="px-3 py-2 text-right text-slate-600">{item.quantity}</td><td className="px-3 py-2 text-right text-slate-600">{formatPKR(item.unit_price)}</td><td className="px-3 py-2 text-right font-medium text-slate-900">{formatPKR(item.total)}</td><td className="px-3 py-2 text-right"><form action={deleteItemAction}><input type="hidden" name="itemId" value={item.id} /><input type="hidden" name="invoiceId" value={invoice.id} /><Button type="submit" variant="ghost" size="sm">×</Button></form></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <form action={addItemAction} className="grid gap-3 sm:grid-cols-[1fr_80px_120px_auto]">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <Input name="description" placeholder="Item description" required />
                  <Input name="quantity" type="number" defaultValue="1" min="1" />
                  <Input name="unit_price" type="number" defaultValue="0" min="0" />
                  <Button type="submit">Add</Button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Amount Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium text-slate-900">{formatPKR(invoice.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tax ({invoice.tax_rate}%)</span><span className="font-medium text-slate-900">{formatPKR(invoice.tax_amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-medium text-red-600">-{formatPKR(invoice.discount)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-3"><span className="font-semibold text-slate-900">Total</span><span className="text-lg font-bold text-slate-900">{formatPKR(invoice.total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Line Items Total</span><span className="font-medium text-slate-600">{formatPKR(itemTotal)}</span></div>
            </div>
            {invoice.status === 'draft' && (
              <form action={markAsSentAction} className="mt-4"><input type="hidden" name="invoiceId" value={invoice.id} /><Button type="submit" variant="outline" className="w-full">Mark as Sent</Button></form>
            )}
            {invoice.status === 'sent' && (
              <form action={markAsPaidAction} className="mt-4"><input type="hidden" name="invoiceId" value={invoice.id} /><Button type="submit" variant="outline" className="w-full">Mark as Paid</Button></form>
            )}
          </div>
          {invoice.notes && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-semibold text-slate-900 mb-2">Notes</h3><p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p></div>
          )}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500"><p>Created: {formatDateTime(invoice.created_at)}</p></div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) { return (<div className="rounded-xl bg-slate-50 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-sm font-medium text-slate-900">{value}</p></div>) }

async function deleteInvoiceAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await deleteInvoice(supabase, String(formData.get('invoiceId') || ''))
  revalidatePath('/dashboard/finance/invoices')
  redirect('/dashboard/finance/invoices')
}

async function addItemAction(formData: FormData) {
  'use server'
  const invId = String(formData.get('invoiceId') || '')
  const supabase = await createClient()
  await createInvoiceItem(supabase, {
    invoice_id: invId,
    description: String(formData.get('description') || ''),
    quantity: Number(formData.get('quantity')) || 1,
    unit_price: Number(formData.get('unit_price')) || 0,
  })
  revalidatePath(`/dashboard/finance/invoices/${invId}`)
  redirect(`/dashboard/finance/invoices/${invId}`)
}

async function deleteItemAction(formData: FormData) {
  'use server'
  const itemId = String(formData.get('itemId') || '')
  const invId = String(formData.get('invoiceId') || '')
  const supabase = await createClient()
  await deleteInvoiceItem(supabase, itemId)
  revalidatePath(`/dashboard/finance/invoices/${invId}`)
  redirect(`/dashboard/finance/invoices/${invId}`)
}

async function markAsSentAction(formData: FormData) {
  'use server'
  const invId = String(formData.get('invoiceId') || '')
  const supabase = await createClient()
  await updateInvoice(supabase, invId, { status: 'sent' })
  revalidatePath(`/dashboard/finance/invoices/${invId}`)
  redirect(`/dashboard/finance/invoices/${invId}`)
}

async function markAsPaidAction(formData: FormData) {
  'use server'
  const invId = String(formData.get('invoiceId') || '')
  const supabase = await createClient()
  await updateInvoice(supabase, invId, { status: 'paid', paid_at: new Date().toISOString() })
  revalidatePath(`/dashboard/finance/invoices/${invId}`)
  redirect(`/dashboard/finance/invoices/${invId}`)
}