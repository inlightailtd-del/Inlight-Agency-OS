# CRM Database Schema

This document describes the CRM foundation tables for the INLIGHT Agency OS MVP.

## Tables

### `clients`
Stores the core client profile and relationship data.

Fields:
- `id` — uuid, primary key
- `user_id` — uuid, references `auth.users(id)`, owner of the client
- `name` — text, required
- `industry` — text
- `status` — text, default `active` (`active`, `inactive`, `prospect`)
- `phone` — text
- `email` — text
- `address` — text
- `city` — text
- `website` — text
- `notes` — text
- `monthly_retainer` — decimal(12,2), PKR amount
- `currency` — text, default `PKR`
- `tags` — text[]
- `health_score` — integer default `50`, range `0-100`
- `created_at` — timestamptz default `now()`
- `updated_at` — timestamptz default `now()`

Indexes:
- `idx_clients_user` on `user_id`
- `idx_clients_status` on `status`

Row Level Security:
- `clients` is protected with RLS.
- Policy: users can only select rows where `auth.uid() = user_id`.
- Policy: users can insert and update rows only when `user_id` matches their own user ID.

---

### `contacts`
Stores contact people linked to clients.

Fields:
- `id` — uuid, primary key
- `client_id` — uuid, references `clients(id)`
- `name` — text, required
- `email` — text
- `phone` — text
- `whatsapp` — text
- `title` — text
- `is_primary` — boolean default `false`
- `notes` — text
- `created_at` — timestamptz default `now()`

Indexes:
- `idx_contacts_client` on `client_id`

Row Level Security:
- `contacts` is protected with RLS.
- Policy: users can select contacts only if the contact belongs to a client owned by the current user.
- Policy: users can insert or update contacts only for clients they own.

---

### `interactions`
Stores activity records related to clients and contacts.

Fields:
- `id` — uuid, primary key
- `client_id` — uuid, references `clients(id)`
- `contact_id` — uuid, references `contacts(id)`
- `type` — text, required (`call`, `meeting`, `whatsapp`, `email`, `note`)
- `subject` — text
- `notes` — text
- `date` — timestamptz default `now()`
- `duration_min` — integer
- `next_action` — text
- `next_action_date` — date
- `created_at` — timestamptz default `now()`

Indexes:
- `idx_interactions_client` on `client_id`
- `idx_interactions_date` on `date`

Row Level Security:
- `interactions` is protected with RLS.
- Policy: users can select interactions only if the interaction is linked to a client they own.
- Policy: users can insert or update interactions only for clients they own.

---

## Relationships

- A `client` belongs to a `user`.
- A `contact` belongs to a `client`.
- An `interaction` belongs to a `client` and may optionally belong to a `contact`.

## CRM Foundation Notes

- CRM tables are now split into dedicated migration files for clients, contacts, and interactions.
- This keeps the CRM foundation separate from later project and finance tables.
- Health score is designed for future CRM insights and client health displays.
