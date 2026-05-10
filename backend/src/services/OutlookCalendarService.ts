import axios from 'axios'
import { MicrosoftGraphService } from './MicrosoftGraphService'

const GRAPH = 'https://graph.microsoft.com/v1.0'
const TZ    = 'America/Sao_Paulo'

export interface CalendarEventData {
  title:       string
  date:        string   // YYYY-MM-DD
  time:        string   // HH:MM
  endTime?:    string   // HH:MM  (default: +1h)
  location?:   string
  description?: string
}

export class OutlookCalendarService {
  private graphService: MicrosoftGraphService

  constructor(userId: string) {
    this.graphService = new MicrosoftGraphService(userId)
  }

  private buildBody(data: CalendarEventData) {
    const [h, m] = data.time.split(':').map(Number)
    const endTime = data.endTime ?? `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    return {
      subject: data.title,
      start:   { dateTime: `${data.date}T${data.time}:00`, timeZone: TZ },
      end:     { dateTime: `${data.date}T${endTime}:00`,   timeZone: TZ },
      ...(data.location    ? { location: { displayName: data.location } }           : {}),
      ...(data.description ? { body: { contentType: 'text', content: data.description } } : {}),
      isReminderOn: true,
      reminderMinutesBeforeStart: 60,
    }
  }

  async createEvent(data: CalendarEventData): Promise<string> {
    const token = await this.graphService.getValidToken()
    const { data: ev } = await axios.post(`${GRAPH}/me/events`, this.buildBody(data), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    return ev.id as string
  }

  async updateEvent(eventId: string, data: CalendarEventData): Promise<void> {
    const token = await this.graphService.getValidToken()
    await axios.patch(`${GRAPH}/me/events/${eventId}`, this.buildBody(data), {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
  }

  async deleteEvent(eventId: string): Promise<void> {
    const token = await this.graphService.getValidToken()
    await axios.delete(`${GRAPH}/me/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}
