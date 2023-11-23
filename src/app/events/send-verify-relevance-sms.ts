import { repo } from 'remult'
import { getSite } from '../users/sites'
import { TaskStatusChanges } from './TaskStatusChanges'
import { SMS_CONFIRM_MESSAGE, Task } from './tasks'
import { taskStatus } from './taskStatus'
import { sendSms } from '../../server/send-sms'
import { createId } from '@paralleldrive/cuid2'
import { BlockedPhone } from './blockedPhone'

export async function SendVerifyRelevanceSms() {
  console.log('I am here ' + getSite().urlPrefix)
  const lastStatusCheck = await repo(TaskStatusChanges).findFirst(
    { what: verifyRelevanceSms, org: getSite().org },
    {
      orderBy: {
        createdAt: 'desc',
      },
    }
  )
  let lastCheck = lastStatusCheck?.createdAt.valueOf() || 0
  let nineAm = new Date().setHours(9 - 2, 0, 0, 0).valueOf()
  let sevenPm = new Date().setHours(19 - 2, 0, 0, 0).valueOf()
  let current = new Date().valueOf()
  if (
    !lastStatusCheck ||
    (current > sevenPm && lastCheck < sevenPm) ||
    (current > nineAm && lastCheck < nineAm)
  ) {
    let fourHoursAgo = new Date()
    fourHoursAgo.setHours(fourHoursAgo.getHours() - 4)
    const tasks = await repo(Task).find({
      where: {
        taskStatus: taskStatus.active,
        createdAt: { $lt: fourHoursAgo },
        org: getSite().org,
        category: { $ne: 'שינוע רכב' },
        validUntil: getSite().sendTextMessageOnlyForFutureEvents
          ? { $gt: new Date() }
          : undefined,
      },
    })
    console.log(getSite().org, 'Verify SMS', tasks.length)
    for (const task of tasks) {
      if (!task.editLink) {
        task.editLink = createId()
        task.__disableValidation = true
        await task.save()
      }
      if (!task.externalId.startsWith('m:')) {
        const p = task.getTextMessagePhone()
        let phone = p.phone
        if (
          phone &&
          (await repo(TaskStatusChanges).count({
            taskId: task.id,
            what: SMS_CONFIRM_MESSAGE,
            createdAt: { $gt: fourHoursAgo },
          })) == 0
        ) {
          if ((await repo(BlockedPhone).count({ phone: phone })) == 0) {
            const m = task.verifyRelevanceMessage(p.name!, false)
            const smsResult = await sendSms(phone, m)

            await task.insertStatusChange(
              verifyRelevanceSms,
              JSON.stringify({
                phone: phone,
                response: smsResult,
              })
            )
          }
        }
      } else {
        console.log('no phone for ', task.externalId)
      }
    }
  }
}

const verifyRelevanceSms = 'SMS למבקש לבדיקת רלוונטיות'
