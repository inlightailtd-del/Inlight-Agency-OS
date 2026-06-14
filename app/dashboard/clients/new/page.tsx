import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { clientFormSchema, clientStatusOptions, type ClientListStatus } from '@/lib/supabase/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function createClientAction(formData: FormData) {
  'use server'

  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )

  const result = clientFormSchema.safeParse(rawValues)
  if (!result.success) {
    throw new Error(result.error.message)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    throw new Error('Unable to determine authenticated user')
  }

  const { error } = await supabase.from('clients').insert([
    {
      ...result.data,
      user_id: user.id,
    },
  ])

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/clients')
  redirect('/dashboard/clients')
}

export default function NewClientPage() {
  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Add New Client</h1>
          <p className="text-sm text-slate-500 mt-1">Enter a new client profile and keep client health visible from the start.</p>
        </div>
        <Link href="/dashboard/clients" className="text-slate-700 hover:text-slate-900">
          Back to clients
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={createClientAction} className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Client name
              </label>
              <Input id="name" name="name" required placeholder="Acme Studio" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <Select id="status" name="status" defaultValue="active">
                {clientStatusOptions.filter((value) => value !== 'all').map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="industry">
                Industry
              </label>
              <Input id="industry" name="industry" placeholder="Marketing, e-commerce, finance" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="health_score">
                Health score
              </label>
              <Input
                id="health_score"
                name="health_score"
                type="number"
                min={0}
                max={100}
                defaultValue="50"
                placeholder="50"
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" placeholder="hello@acme.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                Phone
              </label>
              <Input id="phone" name="phone" placeholder="+92 300 1234567" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="city">
                City
              </label>
              <Input id="city" name="city" placeholder="Karachi" />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="website">
                Website
              </label>
              <Input id="website" name="website" placeholder="https://acme.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="monthly_retainer">
                Monthly retainer
              </label>
              <Input id="monthly_retainer" name="monthly_retainer" type="number" placeholder="50000" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="notes">
              Notes
            </label>
            <Textarea id="notes" name="notes" placeholder="Important client details, contracts, or preferences." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/dashboard/clients" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </Link>
            <Button type="submit">Create client</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
