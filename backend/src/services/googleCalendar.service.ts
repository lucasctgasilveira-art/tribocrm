import { getValidToken } from './googleOAuth.service'

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

interface CalendarEvent {
  title: string
  description?: string
  startDateTime: string // ISO 8601
  endDateTime: string   // ISO 8601
  attendees?: string[]  // email addresses
}

export async function createEvent(userId: string, tenantId: string, event: CalendarEvent): Promise<{ eventId: string; htmlLink: string }> {
  const accessToken = await getValidToken(userId, tenantId, 'GOOGLE_CALENDAR')

  if (!accessToken) {
    throw new Error('Google Calendar not connected or token expired. Please reconnect.')
  }

  const body = {
    summary: event.title,
    description: event.description ?? '',
    start: { dateTime: event.startDateTime, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: event.endDateTime, timeZone: 'America/Sao_Paulo' },
    ...(event.attendees?.length ? { attendees: event.attendees.map(email => ({ email })) } : {}),
  }

  const res = await fetch(CALENDAR_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.json() as { error?: { message?: string } }
    throw new Error(`Calendar API error: ${error.error?.message ?? res.statusText}`)
  }

  const data = await res.json() as { id: string; htmlLink: string }
  return { eventId: data.id, htmlLink: data.htmlLink }
}

export async function updateEvent(userId: string, tenantId: string, eventId: string, event: Partial<CalendarEvent>): Promise<{ htmlLink: string }> {
  const accessToken = await getValidToken(userId, tenantId, 'GOOGLE_CALENDAR')

  if (!accessToken) {
    throw new Error('Google Calendar not connected or token expired. Please reconnect.')
  }

  const body: Record<string, unknown> = {}
  if (event.title) body.summary = event.title
  if (event.description !== undefined) body.description = event.description
  if (event.startDateTime) body.start = { dateTime: event.startDateTime, timeZone: 'America/Sao_Paulo' }
  if (event.endDateTime) body.end = { dateTime: event.endDateTime, timeZone: 'America/Sao_Paulo' }
  if (event.attendees?.length) body.attendees = event.attendees.map(email => ({ email }))

  const res = await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.json() as { error?: { message?: string } }
    throw new Error(`Calendar API error: ${error.error?.message ?? res.statusText}`)
  }

  const data = await res.json() as { htmlLink: string }
  return { htmlLink: data.htmlLink }
}

export async function deleteEvent(userId: string, tenantId: string, eventId: string): Promise<void> {
  const accessToken = await getValidToken(userId, tenantId, 'GOOGLE_CALENDAR')

  if (!accessToken) {
    throw new Error('Google Calendar not connected or token expired. Please reconnect.')
  }

  const res = await fetch(`${CALENDAR_API}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok && res.status !== 404) {
    const error = await res.json() as { error?: { message?: string } }
    throw new Error(`Calendar API error: ${error.error?.message ?? res.statusText}`)
  }
}
