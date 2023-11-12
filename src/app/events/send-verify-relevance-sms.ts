import { repo } from 'remult'
import { getSite } from '../users/sites'
import { TaskStatusChanges } from './TaskStatusChanges'
import { Task } from './tasks'
import { taskStatus } from './taskStatus'
import { sendSms } from '../../server/send-sms'
import { createId } from '@paralleldrive/cuid2'

export async function SendVerifyRelevanceSms() {
  console.log('I am here ' + getSite().urlPrefix)
  const lastStatusCheck = await repo(TaskStatusChanges).findFirst(
    { what: verifyRelevanceSms },
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
    let twoHoursAgo = new Date()
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)
    const tasks = await repo(Task).find({
      where: {
        taskStatus: taskStatus.active,
        createdAt: { $lt: twoHoursAgo },
      },
    })
    for (const task of tasks) {
      if (!task.editLink) {
        task.editLink = createId()
        task.__disableValidation = true
        await task.save()
      }
      const m = task.verifyRelevanceMessage(false)
      if (m.phone) {
        const smsResult = await sendSms(m.phone, m.message)

        await task.insertStatusChange(
          verifyRelevanceSms,
          JSON.stringify({
            phone: m.phone,
            response: smsResult,
          })
        )
      } else {
        console.log('no phone')
      }
    }
  }
}

const verifyRelevanceSms = 'SMS למבקש לבדיקת רלוונטיות'
