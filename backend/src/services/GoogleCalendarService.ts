import { google } from 'googleapis'
import { GoogleAPIService } from './GoogleAPIService'
import type { CalendarEventData } from './OutlookCalendarService'

const TZ = 'America/Sao_Paulo'

export class GoogleCalendarService {
  private googleService: GoogleAPIService

  constructor(userId: string) {
    this.googleService = new GoogleAPIService(userId)
  }

  private buildBody(data: CalendarEventData) {
    const [h, m] = data.time.split(':').map(Number)
    const endTime = data.endTime ?? `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    return {
      summary:     data.title,
      start:       { dateTime: `${data.date}T${data.time}:00`, timeZone: TZ },
      end:         { dateTime: `${data.date}T${endTime}:00`,   timeZone: TZ },
      ...(data.location    ? { location:    data.location    } : {}),
      ...(data.description ? { description: data.description } : {}),
    }
  }

  async createEvent(data: CalendarEventData): Promise<string> {
    const auth = await this.googleService.getClient()
    const calendar = google.calendar({ version: 'v3', auth })
    const { data: ev } = await calendar.events.insert({
      calendarId:  'primary',
      requestBody: this.buildBody(data),
    })
    return ev.id!
  }

  async updateEvent(eventId: string, data: CalendarEventData): Promise<void> {
    const auth = await this.googleService.getClient()
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.patch({
      calendarId:  'primary',
      eventId,
      requestBody: this.buildBody(data),
    })
  }

  async deleteEvent(eventId: string): Promise<void> {
    const auth = await this.googleService.getClient()
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({ calendarId: 'primary', eventId })
  }
}
