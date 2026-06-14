import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { formatPKR, formatDateTime } from '@/lib/utils'
import {
  fetchClientById,
  fetchContactsForClient,
  fetchInteractionsForClient,
  fetchActivityForClient,
  getHealthColor,
  getHealthLabel,
  getStatusLabel,
  type ClientRow,
} from '@/lib/supabase/clients'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export default async function ClientDetailPage({
  params,
}: {
  params: { clientId: string }
}) {
  const supabase = await createClient()
  const client = await fetchClientById(supabase, params.clientId)
  const contacts = await fetchContactsForClient(supabase, params.clientId)
  const interactions = await fetchInteractionsForClient(supabase, params.clientId)
  const activity = await fetchActivityForClient(supabase, params.clientId)

  if (!client) {
    notFound()
  }

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{client.name}</h1>
          <p className="text-sm text-slate-500 mt-1">Client profile, health score, and contact details.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/clients" className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Back to clients
          </Link>
          <Link href={`/dashboard/clients/${client.id}/edit`} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Edit client
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Badge variant={client.status === 'active' ? 'success' : client.status === 'prospect' ? 'info' : 'default'}>
              {getStatusLabel(client.status)}
            </Badge>
            <span className="text-sm text-slate-500">Joined {formatDateTime(client.created_at)}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Industry" value={client.industry ?? 'N/A'} />
            <DetailRow label="City" value={client.city ?? 'N/A'} />
            <DetailRow label="Email" value={client.email ?? 'N/A'} />
            <DetailRow label="Phone" value={client.phone ?? 'N/A'} />
            <DetailRow label="Website" value={client.website ?? 'N/A'} />
            <DetailRow label="Currency" value={client.currency ?? 'PKR'} />
            <DetailRow label="Monthly retainer" value={formatPKR(client.monthly_retainer ?? undefined)} />
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Notes</h2>
            <p className="text-sm leading-7 text-slate-600">
              {client.notes ?? 'No notes yet. Update the client profile with important context.'}
            </p>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Contacts</h2>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-500">No contacts yet. Add a contact below.</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium text-slate-900">{c.name}{c.is_primary ? ' • Primary' : ''}</p>
                      <p className="text-sm text-slate-500">{c.title ?? ''} {c.email ? `• ${c.email}` : ''}</p>
                    </div>
                    <form action={deleteContactAction} className="flex items-center gap-2">
                      <input type="hidden" name="contactId" value={c.id} />
                      <input type="hidden" name="clientId" value={client.id} />
                      <Button type="submit" variant="destructive">Delete</Button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <form action={createContactAction} className="grid gap-3">
                <input type="hidden" name="clientId" value={client.id} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="name" placeholder="Contact name" required />
                  <Input name="title" placeholder="Title" />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="email" type="email" placeholder="Email" />
                  <Input name="phone" placeholder="Phone" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Add contact</Button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Health score</p>
              <p className="text-3xl font-bold text-slate-900">{client.health_score}%</p>
            </div>
            <Badge variant={client.health_score >= 80 ? 'success' : client.health_score >= 50 ? 'warning' : client.health_score >= 30 ? 'destructive' : 'destructive'}>
              {getHealthLabel(client.health_score)}
            </Badge>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`${getHealthColor(client.health_score)} h-full rounded-full transition-all duration-300`}
              style={{ width: `${client.health_score}%` }}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Interpretation</p>
            <p className="mt-2 text-slate-600">Use the health score to track whether this client needs attention or follow-up action.</p>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent interactions</h3>
            {interactions.length === 0 ? (
              <p className="text-sm text-slate-500">No interactions recorded. Log your first interaction below.</p>
            ) : (
              <div className="space-y-3">
                {interactions.map((i: any) => (
                  <div key={i.id} className="rounded-md border p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-900">{i.subject ?? i.type}</p>
                        <p className="text-sm text-slate-500">{i.notes}</p>
                      </div>
                      <div className="text-sm text-slate-500">{formatDateTime(i.date)}</div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <form action={deleteInteractionAction}>
                        <input type="hidden" name="interactionId" value={i.id} />
                        <input type="hidden" name="clientId" value={client.id} />
                        <Button type="submit" variant="ghost">Delete</Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <form action={createInteractionAction} className="grid gap-2">
                <input type="hidden" name="clientId" value={client.id} />
                <Input name="subject" placeholder="Subject or type (call, email)" required />
                <Textarea name="notes" placeholder="Notes about this interaction" />
                <div className="flex justify-end">
                  <Button type="submit">Log interaction</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Activity log</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No recent activity.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((a: any, idx: number) => (
                <li key={idx} className="text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{a.title}</p>
                      {a.notes && <p className="text-slate-500">{a.notes}</p>}
                    </div>
                    <div className="text-xs text-slate-400">{formatDateTime(a.date)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

async function deleteClientAction(formData: FormData) {
  'use server'
  const clientId = String(formData.get('clientId') || '')
  if (!clientId) throw new Error('Missing client id')

  const supabase = await createClient()
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/clients')
  redirect('/dashboard/clients')
}

async function createContactAction(formData: FormData) {
  'use server'
  const clientId = String(formData.get('clientId') || '')
  const name = String(formData.get('name') || '')
  if (!clientId || !name) throw new Error('Missing required fields')

  const supabase = await createClient()
  const { error } = await supabase.from('contacts').insert([
    {
      client_id: clientId,
      name,
      email: String(formData.get('email') || null),
      phone: String(formData.get('phone') || null),
      title: String(formData.get('title') || null),
    },
  ])

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/clients/${clientId}`)
  redirect(`/dashboard/clients/${clientId}`)
}

async function deleteContactAction(formData: FormData) {
  'use server'
  const contactId = String(formData.get('contactId') || '')
  const clientId = String(formData.get('clientId') || '')
  if (!contactId) throw new Error('Missing contact id')

  const supabase = await createClient()
  const { error } = await supabase.from('contacts').delete().eq('id', contactId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/clients/${clientId}`)
  redirect(`/dashboard/clients/${clientId}`)
}

async function createInteractionAction(formData: FormData) {
  'use server'
  const clientId = String(formData.get('clientId') || '')
  const subject = String(formData.get('subject') || '')
  if (!clientId || !subject) throw new Error('Missing required fields')

  const supabase = await createClient()
  const { error } = await supabase.from('interactions').insert([
    {
      client_id: clientId,
      subject,
      notes: String(formData.get('notes') || null),
    },
  ])

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/clients/${clientId}`)
  redirect(`/dashboard/clients/${clientId}`)
}

async function deleteInteractionAction(formData: FormData) {
  'use server'
  const interactionId = String(formData.get('interactionId') || '')
  const clientId = String(formData.get('clientId') || '')
  if (!interactionId) throw new Error('Missing interaction id')

  const supabase = await createClient()
  const { error } = await supabase.from('interactions').delete().eq('id', interactionId)
  if (error) throw new Error(error.message)

  revalidatePath(`/dashboard/clients/${clientId}`)
  redirect(`/dashboard/clients/${clientId}`)
}
