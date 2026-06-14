import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { fetchClients } from '@/lib/supabase/clients'
import { fetchProjects } from '@/lib/supabase/projects'
import {
  invoiceFormSchema,
  invoiceStatuses,
  paymentMethods,
  fetchInvoiceById,
  updateInvoice,
  deleteInvoice,
  getInvoiceStatusLabel,
  getPaymentMethodLabel,
} from '@/lib/supabase/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateInvoiceAction(formData: FormData) {
  'use server'
  const rawValues = Object.fromEntries(Array.from(formData.entries(), ([k, v]) => [k, typeof v === 'string' ? v : '']))
  const invId = String(rawValues.id || '')
  if (!invId) throw new Error('Missing invoice ID')
  const result = invoiceFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)
  const supabase = await createClient()
  await updateInvoice(supabase, invId, {
    client_id: result.data.client_id,
    project_id: result.data.project_id,
    invoice_number: result.data.invoice_number,
    status: result.data.status,
    issue_date: result.data.issue_date,
    due_date: result.data.due_date,
    subtotal: result.data.subtotal,
    tax_rate: result.data.tax_rate,
    tax_amount: result.data.tax_amount,
    discount: result.data.discount,
    total: result.data.total,
    currency: result.data.currency,
    notes: result.data.notes,
    payment_method: result.data.payment_method,
  })
  revalidatePath('/dashboard/finance/invoices')
  revalidatePath(`/dashboard/finance/invoices/${invId}`)
  redirect(`/dashboard/finance/invoices/${invId}`)
}

async function deleteInvoiceAction(formData: FormData) {
  'use server'
  const supabase = await createClient()
  await deleteInvoice(supabase, String(formData.get('invoiceId') || ''))
  revalidatePath('/dashboard/finance/invoices')
  redirect('/dashboard/finance/invoices')
}

export default async function EditInvoicePage({ params }: { params: { invoiceId: string } }) {
  const supabase = await createClient()
  const invoice = await fetchInvoiceById(supabase, params.invoiceId)
  const clients = await fetchClients(supabase)
  const projects = await fetchProjects(supabase)
  if (!invoice) return <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><p className="text-slate-600">Invoice not found.</p><Link href="/dashboard/finance/invoices" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</Link></div>

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-slate-900">Edit Invoice</h1><p className="text-sm text-slate-500 mt-1">Update invoice #{invoice.invoice_number}</p></div>
        <div className="flex gap-3">
          <Link href={`/dashboard/finance/invoices/${invoice.id}`} className="text-slate-700 hover:text-slate-900">View</Link>
          <form action={deleteInvoiceAction}><input type="hidden" name="invoiceId" value={invoice.id} /><Button type="submit" variant="destructive">Delete</Button></form>
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateInvoiceAction} className="grid gap-6">
          <input type="hidden" name="id" value={invoice.id} />
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="client_id">Client <span className="text-red-500">*</span></label><Select id="client_id" name="client_id" defaultValue={invoice.client_id} required><option value="">— Select —</option>{clients.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="project_id">Project</label><Select id="project_id" name="project_id" defaultValue={invoice.project_id ?? ''}><option value="">— None —</option>{projects.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="invoice_number">Invoice #</label><Input id="invoice_number" name="invoice_number" required defaultValue={invoice.invoice_number} /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label><Select id="status" name="status" defaultValue={invoice.status}>{invoiceStatuses.map((s) => (<option key={s} value={s}>{getInvoiceStatusLabel(s)}</option>))}</Select></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="issue_date">Issue date</label><Input id="issue_date" name="issue_date" type="date" defaultValue={invoice.issue_date ?? ''} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="due_date">Due date</label><Input id="due_date" name="due_date" type="date" defaultValue={invoice.due_date ?? ''} /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-4">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="subtotal">Subtotal</label><Input id="subtotal" name="subtotal" type="number" defaultValue={String(invoice.subtotal ?? 0)} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="tax_rate">Tax rate (%)</label><Input id="tax_rate" name="tax_rate" type="number" step="0.01" defaultValue={String(invoice.tax_rate ?? 0)} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="tax_amount">Tax amount</label><Input id="tax_amount" name="tax_amount" type="number" defaultValue={String(invoice.tax_amount ?? 0)} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="discount">Discount</label><Input id="discount" name="discount" type="number" defaultValue={String(invoice.discount ?? 0)} /></div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div><label className="text-sm font-medium text-slate-700" htmlFor="total">Total</label><Input id="total" name="total" type="number" defaultValue={String(invoice.total ?? 0)} /></div>
            <div><label className="text-sm font-medium text-slate-700" htmlFor="payment_method">Payment method</label><Select id="payment_method" name="payment_method" defaultValue={invoice.payment_method ?? ''}><option value="">— Select —</option>{paymentMethods.map((m) => (<option key={m} value={m}>{getPaymentMethodLabel(m)}</option>))}</Select></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700" htmlFor="notes">Notes</label><Textarea id="notes" name="notes" defaultValue={invoice.notes ?? ''} /></div>
          <div className="flex justify-end gap-3 pt-2"><Link href={`/dashboard/finance/invoices/${invoice.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link><Button type="submit">Save changes</Button></div>
        </form>
      </div>
    </div>
  )
}