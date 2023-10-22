import { SubscriptionChannel } from 'remult'

export const updateChannel = new SubscriptionChannel<UpdateMessage>('updates')
export interface UpdateMessage {
  userId: string
  action: string
  message: string
  status: number
}
