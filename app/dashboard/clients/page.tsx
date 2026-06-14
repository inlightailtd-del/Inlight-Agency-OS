import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatPKR } from '@/lib/utils'
import {
  clientStatusOptions,
  fetchClients,
  getHealthColor,
  getHealthLabel,
  getStatusLabel,
  type ClientListStatus,
} from '@/lib/supabase/clients'

const getSearchValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value?.trim() ?? ''

const getStatusValue = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value
  return clientStatusOptions.includes(raw as ClientListStatus)
    ? (raw as ClientListStatus)
    : 'all'
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: { query?: string | string[]; status?: string | string[] }
}) {
  const query = getSearchValue(searchParams?.query)
  const status = getStatusValue(searchParams?.status)
  const supabase = await createClient()
  const clients = await fetchClients(supabase, query, status)

  const statusQuery = (statusValue: ClientListStatus) =>
    `/dashboard/clients?status=${statusValue}${query ? `&query=${encodeURIComponent(query)}` : ''}`

  return (
    <div>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">Manage client relationships, pipeline status, and health at a glance.</p>
        </div>
        <Link href="/dashboard/clients/new">
          <Button>Add Client</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr] mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="sr-only" htmlFor="query">
              Search clients
            </label>
            <Input
              id="query"
              name="query"
              placeholder="Search by name or email"
              defaultValue={query}
            />
          </div>
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            Search
          </Button>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Status filters</p>
          <div className="flex flex-wrap gap-2">
            {clientStatusOptions.map((option) => {
              const active = status === option
              return (
                <Link
                  key={option}
                  href={statusQuery(option)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {getStatusLabel(option)}
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
              <th className="px-4 py-3 font-medium text-slate-600">Client</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Health</th>
              <th className="px-4 py-3 font-medium text-slate-600">Contact</th>
              <th className="px-4 py-3 font-medium text-slate-600">Retainer</th>
              <th className="px-4 py-3 font-medium text-slate-600 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  No clients found. Add your first client to start tracking relationships.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 align-top">
                    <Link href={`/dashboard/clients/${client.id}`} className="font-semibold text-slate-900 hover:text-slate-700">
                      {client.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      {client.industry ?? 'Industry not set'}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Badge variant={client.status === 'active' ? 'success' : client.status === 'prospect' ? 'info' : 'default'}>
                      {getStatusLabel(client.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 align-top w-48">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900">{client.health_score}%</span>
                      <span className="text-xs text-slate-500">{getHealthLabel(client.health_score)}</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${getHealthColor(client.health_score)}`}
                        style={{ width: `${client.health_score}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">
                    {client.email ?? client.phone ?? '-'}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">
                    {formatPKR(client.monthly_retainer ?? undefined)}
                  </td>
                  <td className="px-4 py-4 align-top text-right text-sm font-medium">
                    <Link href={`/dashboard/clients/${client.id}`} className="text-slate-700 hover:text-slate-900">
                      View
                    </Link>
                    <span className="mx-2 text-slate-300">|</span>
                    <Link href={`/dashboard/clients/${client.id}/edit`} className="text-slate-900 hover:underline">
                      Edit
                    </Link>
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
