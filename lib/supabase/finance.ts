import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---- Invoices ----

export const invoiceStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'] as const
export const invoiceStatusOptions = ['all', ...invoiceStatuses] as const
export type InvoiceStatus = (typeof invoiceStatuses)[number]
export type InvoiceListStatus = (typeof invoiceStatusOptions)[number]

export const paymentMethods = ['bank_transfer', 'cash', 'easypaisa', 'jazzcash', 'other'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export const invoiceFormSchema = z.object({
  client_id: z.string().uuid('Client is required'),
  project_id: z.string().uuid().optional().nullable().transform((v) => v || null),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  status: z.enum(invoiceStatuses).default('draft'),
  issue_date: z.string().optional().nullable().transform((v) => v || null),
  due_date: z.string().optional().nullable().transform((v) => v || null),
  subtotal: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  tax_rate: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  tax_amount: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  discount: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  total: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
  currency: z.string().trim().optional().default('PKR'),
  notes: z.string().trim().optional().nullable().transform((v) => v || null),
  payment_method: z.enum(paymentMethods).optional().nullable().transform((v) => v || null),
})

export type InvoiceRow = {
  id: string
  user_id: string
  client_id: string
  project_id: string | null
  invoice_number: string
  status: InvoiceStatus
  issue_date: string | null
  due_date: string | null
  paid_at: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount: number
  total: number
  currency: string
  notes: string | null
  payment_method: string | null
  created_at: string
  updated_at: string | null
}

export type InvoiceWithRelations = InvoiceRow & {
  client_name?: string | null
  project_name?: string | null
}

export type InvoiceItemRow = {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  total: number
  order_index: number
}

export const invoiceItemFormSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.string().trim().optional().default('1').transform((v) => Number(v) || 1),
  unit_price: z.string().trim().min(1, 'Price is required').transform((v) => Number(v) || 0),
  order_index: z.string().trim().optional().default('0').transform((v) => Number(v) || 0),
})

// ---- Expenses ----

export const expenseCategories = ['software', 'ads_budget', 'freelancer', 'salary', 'office', 'travel', 'other'] as const
export type ExpenseCategory = (typeof expenseCategories)[number]

export const expenseFormSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.string().trim().min(1, 'Amount is required').transform((v) => Number(v) || 0),
  currency: z.string().trim().optional().default('PKR'),
  category: z.enum(expenseCategories).optional().nullable().transform((v) => v || 'other'),
  expense_date: z.string().optional().nullable().transform((v) => v || null),
  project_id: z.string().uuid().optional().nullable().transform((v) => v || null),
  client_id: z.string().uuid().optional().nullable().transform((v) => v || null),
  is_billable: z.string().optional().default('false').transform((v) => v === 'true'),
  notes: z.string().trim().optional().nullable().transform((v) => v || null),
})

export type ExpenseRow = {
  id: string
  user_id: string
  project_id: string | null
  client_id: string | null
  description: string
  amount: number
  currency: string
  category: string | null
  expense_date: string | null
  is_billable: boolean
  receipt_url: string | null
  notes: string | null
  created_at: string
}

export type ExpenseWithRelations = ExpenseRow & {
  project_name?: string | null
  client_name?: string | null
}

// ---- Display helpers ----

export function getInvoiceStatusLabel(status: InvoiceListStatus | InvoiceStatus): string {
  if (status === 'all') return 'All'
  const map: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

export function getInvoiceStatusVariant(
  status: InvoiceStatus
): 'default' | 'success' | 'warning' | 'destructive' | 'info' {
  const map: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'destructive' | 'info'> = {
    draft: 'default',
    sent: 'info',
    paid: 'success',
    overdue: 'destructive',
    cancelled: 'destructive',
  }
  return map[status] ?? 'default'
}

export function getPaymentMethodLabel(method: string | null): string {
  if (!method) return '—'
  const map: Record<string, string> = {
    bank_transfer: 'Bank Transfer',
    cash: 'Cash',
    easypaisa: 'EasyPaisa',
    jazzcash: 'JazzCash',
    other: 'Other',
  }
  return map[method] ?? method
}

export function getExpenseCategoryLabel(category: string | null): string {
  if (!category) return 'Other'
  const map: Record<string, string> = {
    software: 'Software',
    ads_budget: 'Ads Budget',
    freelancer: 'Freelancer',
    salary: 'Salary',
    office: 'Office',
    travel: 'Travel',
    other: 'Other',
  }
  return map[category] ?? category
}

// ---- Invoice Fetching ----

function sanitizeSearchQuery(searchQuery: string) {
  return searchQuery.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export async function fetchInvoices(
  supabase: SupabaseClient,
  searchQuery?: string,
  status?: InvoiceListStatus
): Promise<InvoiceWithRelations[]> {
  let query = supabase
    .from('invoices')
    .select('*, clients!invoices_client_id_fkey(name), projects!invoices_project_id_fkey(name)')
    .order('created_at', { ascending: false })

  if (searchQuery) {
    const escaped = sanitizeSearchQuery(searchQuery)
    query = query.or(`invoice_number.ilike.%${escaped}%,notes.ilike.%${escaped}%`)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    client_name: row.clients?.name ?? null,
    project_name: row.projects?.name ?? null,
  })) as InvoiceWithRelations[]
}

export async function fetchInvoiceById(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<InvoiceWithRelations | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients!invoices_client_id_fkey(name), projects!invoices_project_id_fkey(name)')
    .eq('id', invoiceId)
    .single()

  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }

  return {
    ...data,
    client_name: (data as any).clients?.name ?? null,
    project_name: (data as any).projects?.name ?? null,
  } as InvoiceWithRelations
}

export async function fetchInvoiceItems(supabase: SupabaseClient, invoiceId: string): Promise<InvoiceItemRow[]> {
  const { data, error } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('order_index', { ascending: true })

  if (error) throw error
  return (data ?? []) as InvoiceItemRow[]
}

export async function generateInvoiceNumber(supabase: SupabaseClient): Promise<string> {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `INV-${year}-%`)
    .order('created_at', { ascending: false })
    .limit(1)

  const lastNum = data && data.length > 0 ? parseInt((data[0] as any).invoice_number.split('-').pop() ?? '0', 10) : 0
  const nextNum = String(lastNum + 1).padStart(3, '0')
  return `INV-${year}-${nextNum}`
}

export async function createInvoice(
  supabase: SupabaseClient,
  userId: string,
  params: {
    client_id: string
    project_id?: string | null
    invoice_number: string
    status?: InvoiceStatus
    issue_date?: string | null
    due_date?: string | null
    subtotal?: number
    tax_rate?: number
    tax_amount?: number
    discount?: number
    total?: number
    currency?: string
    notes?: string | null
    payment_method?: string | null
  }
) {
  const { data, error } = await supabase.from('invoices').insert([
    {
      ...params,
      user_id: userId,
    },
  ])
  if (error) throw error
  return data
}

export async function updateInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  patch: Record<string, any>
) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
  if (error) throw error
  return data
}

export async function deleteInvoice(supabase: SupabaseClient, invoiceId: string) {
  const { data, error } = await supabase.from('invoices').delete().eq('id', invoiceId)
  if (error) throw error
  return data
}

// ---- Invoice Item CRUD ----

export async function createInvoiceItem(
  supabase: SupabaseClient,
  params: { invoice_id: string; description: string; quantity?: number; unit_price: number; order_index?: number }
) {
  const { data, error } = await supabase.from('invoice_items').insert([params])
  if (error) throw error
  return data
}

export async function updateInvoiceItem(supabase: SupabaseClient, itemId: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from('invoice_items').update(patch).eq('id', itemId)
  if (error) throw error
  return data
}

export async function deleteInvoiceItem(supabase: SupabaseClient, itemId: string) {
  const { data, error } = await supabase.from('invoice_items').delete().eq('id', itemId)
  if (error) throw error
  return data
}

// ---- Expense Fetching ----

export async function fetchExpenses(
  supabase: SupabaseClient,
  searchQuery?: string,
  category?: string
): Promise<ExpenseWithRelations[]> {
  let query = supabase
    .from('expenses')
    .select('*, projects!expenses_project_id_fkey(name), clients!expenses_client_id_fkey(name)')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (searchQuery) {
    const escaped = sanitizeSearchQuery(searchQuery)
    query = query.ilike('description', `%${escaped}%`)
  }

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) throw error

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    project_name: row.projects?.name ?? null,
    client_name: row.clients?.name ?? null,
  })) as ExpenseWithRelations[]
}

export async function fetchExpenseById(
  supabase: SupabaseClient,
  expenseId: string
): Promise<ExpenseWithRelations | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, projects!expenses_project_id_fkey(name), clients!expenses_client_id_fkey(name)')
    .eq('id', expenseId)
    .single()

  if (error) {
    if ((error as any).code === 'PGRST116') return null
    throw error
  }

  return {
    ...data,
    project_name: (data as any).projects?.name ?? null,
    client_name: (data as any).clients?.name ?? null,
  } as ExpenseWithRelations
}

export async function createExpense(
  supabase: SupabaseClient,
  userId: string,
  params: {
    description: string
    amount: number
    currency?: string
    category?: string | null
    expense_date?: string | null
    project_id?: string | null
    client_id?: string | null
    is_billable?: boolean
    notes?: string | null
  }
) {
  const { data, error } = await supabase.from('expenses').insert([
    {
      ...params,
      user_id: userId,
    },
  ])
  if (error) throw error
  return data
}

export async function updateExpense(supabase: SupabaseClient, expenseId: string, patch: Record<string, any>) {
  const { data, error } = await supabase.from('expenses').update(patch).eq('id', expenseId)
  if (error) throw error
  return data
}

export async function deleteExpense(supabase: SupabaseClient, expenseId: string) {
  const { data, error } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (error) throw error
  return data
}