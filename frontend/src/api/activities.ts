import api from './axios'
import type { ActivityListParams, ActivitySubmitRequest, MissedReminder, ReminderActivity } from '@/types/api'

export const activitiesApi = {
  list: (params: ActivityListParams = {}): Promise<ReminderActivity[]> =>
    api.get<ReminderActivity[]>('/activities', { params }).then((r) => r.data),

  missed: (params: { date?: string; task_id?: string } = {}): Promise<MissedReminder[]> =>
    api.get<MissedReminder[]>('/activities/missed', { params }).then((r) => r.data),

  submit: (data: ActivitySubmitRequest): Promise<ReminderActivity> =>
    api.post<ReminderActivity>('/activities/submit', data).then((r) => r.data),

  update: (id: string, text: string, session_status?: ActivitySubmitRequest['session_status']): Promise<ReminderActivity> =>
    api.patch<ReminderActivity>(`/activities/${id}`, { text, ...(session_status !== undefined && { session_status }) }).then((r) => r.data),
}
