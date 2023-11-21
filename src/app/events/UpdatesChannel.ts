import { SubscriptionChannel } from 'remult'
import { getSite } from '../users/sites'

export const updateChannel = (org: string) =>
  new SubscriptionChannel<UpdateMessage>('updates_' + org)
export interface UpdateMessage {
  userId: string
  action: string
  message: string
  status: number
}
