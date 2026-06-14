import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { clientFormSchema, clientStatusOptions, fetchClientById } from '@/lib/supabase/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

async function updateClientAction(formData: FormData) {
  'use server'

  const rawValues = Object.fromEntries(
    Array.from(formData.entries(), ([key, value]) => [key, typeof value === 'string' ? value : ''])
  )

  const clientId = String(rawValues.id || '')
  if (!clientId) {
    throw new Error('Missing client ID')
  }

  const result = clientFormSchema.safeParse(rawValues)
  if (!result.success) {
    throw new Error(result.error.message)
  }

  const supabase = await createClient()
  const { error } = await supabase.from('clients').update(result.data).eq('id', clientId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/dashboard/clients')
  revalidatePath(`/dashboard/clients/${clientId}`)
  redirect(`/dashboard/clients/${clientId}`)
}

export default async function EditClientPage({
  params,
}: {
  params: { clientId: string }
}) {
  const supabase = await createClient()
  const client = await fetchClientById(supabase, params.clientId)

  if (!client) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-600">Client not found.</p>
        <Link href="/dashboard/clients" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Back to clients
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Edit Client</h1>
          <p className="text-sm text-slate-500 mt-1">Update profile details and client health information.</p>
        </div>
        <Link href={`/dashboard/clients/${client.id}`} className="text-slate-700 hover:text-slate-900">
          View details
        </Link>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form action={updateClientAction} className="grid gap-6">
          <input type="hidden" name="id" value={client.id} />

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Client name
              </label>
              <Input id="name" name="name" defaultValue={client.name} required />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="status">
                Status
              </label>
              <Select id="status" name="status" defaultValue={client.status}>
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
              <Input id="industry" name="industry" defaultValue={client.industry ?? ''} />
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
                defaultValue={String(client.health_score)}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" defaultValue={client.email ?? ''} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="phone">
                Phone
              </label>
              <Input id="phone" name="phone" defaultValue={client.phone ?? ''} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="city">
                City
              </label>
              <Input id="city" name="city" defaultValue={client.city ?? ''} />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="website">
                Website
              </label>
              <Input id="website" name="website" defaultValue={client.website ?? ''} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="monthly_retainer">
                Monthly retainer
              </label>
              <Input
                id="monthly_retainer"
                name="monthly_retainer"
                type="number"
                defaultValue={client.monthly_retainer ?? ''}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="notes">
              Notes
            </label>
            <Textarea id="notes" name="notes" defaultValue={client.notes ?? ''} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/dashboard/clients/${client.id}`} className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </Link>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
