import type { SupabaseClient } from '@supabase/supabase-js'
import { IntegrationSDK } from '@/lib/integrations/sdk'
import { executeAgentTask } from '@/lib/ai/execution'
import { storeMemory } from '@/lib/ai/memory'

export interface WhatsAppAppointmentSlot {
  date: string
  time: string
  available: boolean
  label?: string
}

export interface WhatsAppAppointment {
  id: string
  userId: string
  contactWaId: string
  contactName?: string
  contactPhone: string
  scheduledAt: string
  durationMin: number
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled' | 'no_show'
  service?: string
  notes?: string
  meetingUrl?: string
  remindersSent: number
  createdAt: string
  updatedAt: string
}

export const DEFAULT_AVAILABILITY = {
  days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  startHour: 9,
  endHour: 18,
  slotDurationMin: 30,
  timezone: 'America/New_York',
}

export async function getAvailableSlots(
  supabase: SupabaseClient,
  userId: string,
  date?: string,
  durationMin?: number
): Promise<WhatsAppAppointmentSlot[]> {
  const targetDate = date || new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()

  if (!DEFAULT_AVAILABILITY.days.includes(dayOfWeek)) {
    return []
  }

  const slots: WhatsAppAppointmentSlot[] = []
  const slotDuration = durationMin || DEFAULT_AVAILABILITY.slotDurationMin
  const { data: existing } = await supabase
    .from('whatsapp_appointments')
    .select('scheduled_at')
    .eq('user_id', userId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', `${targetDate}T${String(DEFAULT_AVAILABILITY.startHour).padStart(2, '0')}:00:00`)
    .lte('scheduled_at', `${targetDate}T${String(DEFAULT_AVAILABILITY.endHour).padStart(2, '0')}:00:00`)

  const bookedTimes = new Set((existing ?? []).map((r: any) => r.scheduled_at))

  for (let h = DEFAULT_AVAILABILITY.startHour; h < DEFAULT_AVAILABILITY.endHour; h++) {
    for (let m = 0; m < 60; m += slotDuration) {
      const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const slotTime = `${targetDate}T${time}:00`
      const isBooked = bookedTimes.has(slotTime)

      slots.push({
        date: targetDate, time, available: !isBooked,
        label: isBooked ? 'Booked' : 'Available',
      })
    }
  }

  return slots
}

export async function bookAppointment(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string,
  contactPhone: string,
  scheduledAt: string,
  durationMin = 30,
  service?: string,
  contactName?: string
): Promise<WhatsAppAppointment> {
  const { data, error } = await supabase.from('whatsapp_appointments').insert([{
    user_id: userId, contact_wa_id: contactWaId,
    contact_name: contactName, contact_phone: contactPhone,
    scheduled_at: scheduledAt, duration_min: durationMin,
    service, status: 'scheduled',
  }]).select().single()
  if (error) throw error
  const r = data as any

  const appointment: WhatsAppAppointment = {
    id: r.id, userId: r.user_id, contactWaId: r.contact_wa_id,
    contactName: r.contact_name, contactPhone: r.contact_phone,
    scheduledAt: r.scheduled_at, durationMin: r.duration_min,
    status: r.status, service: r.service, notes: r.notes,
    meetingUrl: r.meeting_url, remindersSent: r.reminders_sent || 0,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }

  const sdk = new IntegrationSDK(supabase, userId)
  const day = new Date(scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = new Date(scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  await sdk.executeAction('whatsapp', 'send_text', {
    to: contactWaId,
    text: `Great! I've booked your appointment for *${day} at ${time}* (${durationMin} min).\n\nI'll send you a reminder before our meeting. If you need to reschedule or cancel, just let me know.`,
  })

  await storeMemory(supabase, userId, {
    category: 'whatsapp', tags: ['appointment', contactWaId],
    content: { type: 'appointment_booked', contactWaId, scheduledAt, durationMin, service, appointmentId: appointment.id },
  })

  return appointment
}

export async function confirmAppointment(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string
): Promise<void> {
  await supabase.from('whatsapp_appointments').update({
    status: 'confirmed', updated_at: new Date().toISOString(),
  }).eq('id', appointmentId).eq('user_id', userId)
}

export async function cancelAppointment(
  supabase: SupabaseClient,
  userId: string,
  appointmentId: string,
  reason?: string
): Promise<void> {
  await supabase.from('whatsapp_appointments').update({
    status: 'cancelled', notes: reason, updated_at: new Date().toISOString(),
  }).eq('id', appointmentId).eq('user_id', userId)
}

export async function getAppointments(
  supabase: SupabaseClient,
  userId: string,
  status?: string
): Promise<WhatsAppAppointment[]> {
  let q = supabase.from('whatsapp_appointments').select('*').eq('user_id', userId)
  if (status) q = q.eq('status', status)
  q = q.order('scheduled_at', { ascending: false }).limit(50)
  const { data } = await q
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, userId: r.user_id, contactWaId: r.contact_wa_id,
    contactName: r.contact_name, contactPhone: r.contact_phone,
    scheduledAt: r.scheduled_at, durationMin: r.duration_min,
    status: r.status, service: r.service, notes: r.notes,
    meetingUrl: r.meeting_url, remindersSent: r.reminders_sent || 0,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }))
}

export async function sendAppointmentReminder(
  supabase: SupabaseClient,
  userId: string,
  appointment: WhatsAppAppointment
): Promise<void> {
  const sdk = new IntegrationSDK(supabase, userId)
  const day = new Date(appointment.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = new Date(appointment.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  await sdk.executeAction('whatsapp', 'send_text', {
    to: appointment.contactWaId,
    text: `⏰ *Reminder:* You have an appointment coming up on *${day} at ${time}*.\n\nReply "confirm" to confirm or "reschedule" to pick a different time.`,
  })

  await supabase.from('whatsapp_appointments').update({
    reminders_sent: (appointment.remindersSent || 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', appointment.id)
}

export async function processSchedulingIntent(
  supabase: SupabaseClient,
  userId: string,
  contactWaId: string,
  contactPhone: string,
  message: string,
  contactName?: string
): Promise<{ appointment?: WhatsAppAppointment; response: string }> {
  const systemPrompt = `You are a WhatsApp appointment scheduler. Extract scheduling details from natural language. Return JSON: {"intent": "book|reschedule|cancel|check|other", "desiredDate": "YYYY-MM-DD or null", "desiredTime": "HH:MM or null", "service": "string or null", "durationMin": number, "confidence": 0-1, "reason": "string or null"}`
  const result = await executeAgentTask(supabase, userId, null,
    `User said: "${message}". Extract the scheduling intent and details.`, { systemPrompt }
  )

  let parsed: any = {}
  try { parsed = JSON.parse(result.response || '{}') } catch {
    return { response: 'I can help you schedule an appointment! Just let me know what day and time works best for you.' }
  }

  switch (parsed.intent) {
    case 'book': {
      if (parsed.desiredDate && parsed.desiredTime) {
        const appointment = await bookAppointment(
          supabase, userId, contactWaId, contactPhone,
          `${parsed.desiredDate}T${parsed.desiredTime}:00`,
          parsed.durationMin || 30, parsed.service, contactName
        )
        return { appointment, response: `Appointment booked for ${parsed.desiredDate} at ${parsed.desiredTime}.` }
      }
      const slots = await getAvailableSlots(supabase, userId)
      const available = slots.filter(s => s.available).slice(0, 5)
      if (available.length === 0) {
        return { response: "I'm sorry, there are no available slots right now. Please try another day." }
      }
      const slotList = available.map(s => `- ${s.date} at ${s.time}`).join('\n')
      return { response: `Here are my available slots:\n${slotList}\n\nReply with the date and time you prefer!` }
    }
    case 'cancel': {
      const appointments = await getAppointments(supabase, userId)
      const upcoming = appointments.filter(a => a.contactWaId === contactWaId && a.status === 'scheduled')
      if (upcoming.length === 0) {
        return { response: "You don't have any upcoming appointments to cancel." }
      }
      await cancelAppointment(supabase, userId, upcoming[0].id, parsed.reason)
      return { response: 'Your appointment has been cancelled. Let me know if you\'d like to reschedule!' }
    }
    case 'check': {
      const appointments = await getAppointments(supabase, userId)
      const mine = appointments.filter(a => a.contactWaId === contactWaId)
      if (mine.length === 0) {
        return { response: "You don't have any appointments scheduled." }
      }
      const details = mine.map(a =>
        `${a.status === 'scheduled' ? '📅' : '✅'} ${new Date(a.scheduledAt).toLocaleDateString()} at ${new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${a.status}`
      ).join('\n')
      return { response: `Here are your appointments:\n${details}` }
    }
    default:
      return { response: 'I can help schedule, cancel, or check appointments for you. Just let me know what you need!' }
  }
}
