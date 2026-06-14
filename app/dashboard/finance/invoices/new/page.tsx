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
  generateInvoiceNumber,
  createInvoice,
  getInvoiceStatusLabel,
  getPaymentMethodLabel,
} from '@/lib/supabase/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createInvoiceAction(formData: FormData) {
  'use server'
  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )
  const result = invoiceFormSchema.safeParse(rawValues)
  if (!result.success) throw new Error(result.error.message)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  await createInvoice(supabase, user.id, {
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
  redirect('/dashboard/finance/invoices')
}

export default async function NewInvoicePage() {
  const supabase = await createClient()
  const clients = await fetchClients(supabase)
  const projects = await fetchProjects(supabase)
  const nextInvoiceNumber = await generateInvoiceNumber(supabase)

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Create Invoice</h1>
          <p className="text-sm text-slate-500 mt-1">Generate a new invoice for a client with line items.</p>
        </div>
        <Link href="/dashboard/finance/invoices" className="text-slate-700 hover:text-slate-900">Back to invoices</Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createInvoiceAction} className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="client_id">Client <span className="text-red-500">*</span></label>
              <Select id="client_id" name="client_id" required>
                <option value="">— Select client —</option>
                {clients.map((c: any) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="project_id">Project</label>
              <Select id="project_id" name="project_id">
                <option value="">— None —</option>
                {projects.map((p: any) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="invoice_number">Invoice # <span className="text-red-500">*</span></label>
              <Input id="invoice_number" name="invoice_number" required defaultValue={nextInvoiceNumber} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">Status</label>
              <Select id="status" name="status" defaultValue="draft">
                {invoiceStatuses.map((s) => (<option key={s} value={s}>{getInvoiceStatusLabel(s)}</option>))}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="issue_date">Issue date</label>
              <Input id="issue_date" name="issue_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="due_date">Due date</label>
              <Input id="due_date" name="due_date" type="date" />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="subtotal">Subtotal</label>
              <Input id="subtotal" name="subtotal" type="number" defaultValue="0" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="tax_rate">Tax rate (%)</label>
              <Input id="tax_rate" name="tax_rate" type="number" step="0.01" defaultValue="0" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="tax_amount">Tax amount</label>
              <Input id="tax_amount" name="tax_amount" type="number" defaultValue="0" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="discount">Discount</label>
              <Input id="discount" name="discount" type="number" defaultValue="0" />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="total">Total</label>
              <Input id="total" name="total" type="number" defaultValue="0" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="payment_method">Payment method</label>
              <Select id="payment_method" name="payment_method">
                <option value="">— Select —</option>
                {paymentMethods.map((m) => (<option key={m} value={m}>{getPaymentMethodLabel(m)}</option>))}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="notes">Notes</label>
            <Textarea id="notes" name="notes" placeholder="Payment terms or additional notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/dashboard/finance/invoices" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
            <Button type="submit">Create invoice</Button>
          </div>
        </form>
      </div>
    </div>
  )
}