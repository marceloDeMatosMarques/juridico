import { prisma } from '../config/database'
import { OutlookCalendarService } from './OutlookCalendarService'
import { GoogleCalendarService } from './GoogleCalendarService'
import type { CalendarEventData } from './OutlookCalendarService'

export class CalendarService {
  constructor(private userId: string) {}

  private async getPreference(): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: this.userId },
      select: { calendar_provider: true },
    })
    return user?.calendar_provider ?? 'outlook'
  }

  async createEvent(data: CalendarEventData): Promise<{ outlook_event_id?: string; google_event_id?: string }> {
    const pref = await this.getPreference()
    const result: { outlook_event_id?: string; google_event_id?: string } = {}

    if (pref === 'outlook' || pref === 'ambos') {
      await new OutlookCalendarService(this.userId).createEvent(data)
        .then(id => { result.outlook_event_id = id })
        .catch(() => null)
    }
    if (pref === 'google' || pref === 'ambos') {
      await new GoogleCalendarService(this.userId).createEvent(data)
        .then(id => { result.google_event_id = id })
        .catch(() => null)
    }
    return result
  }

  async updateEvent(
    eventIds: { outlook_event_id?: string | null; google_event_id?: string | null },
    data: CalendarEventData,
  ): Promise<void> {
    if (eventIds.outlook_event_id) {
      new OutlookCalendarService(this.userId).updateEvent(eventIds.outlook_event_id, data).catch(() => null)
    }
    if (eventIds.google_event_id) {
      new GoogleCalendarService(this.userId).updateEvent(eventIds.google_event_id, data).catch(() => null)
    }
  }

  async deleteEvent(eventIds: { outlook_event_id?: string | null; google_event_id?: string | null }): Promise<void> {
    if (eventIds.outlook_event_id) {
      new OutlookCalendarService(this.userId).deleteEvent(eventIds.outlook_event_id).catch(() => null)
    }
    if (eventIds.google_event_id) {
      new GoogleCalendarService(this.userId).deleteEvent(eventIds.google_event_id).catch(() => null)
    }
  }
}
