import { SqlDatabase, remult, repo } from 'remult'
import { Task } from '../app/events/tasks'
import { ChangeLog } from '../app/common/change-log/change-log'
import { formatDate } from '../app/events/date-utils'
import { TaskStatusChanges } from '../app/events/TaskStatusChanges'
import { User } from '../app/users/user'

export async function investigate() {
  remult.context.disableOrgFiltering = true

  const task = await repo(Task).findFirst({ externalId: '7513' })!
  console.log('Task ORG', task.org)
  const statusChanges = await repo(TaskStatusChanges).find({
    where: { taskId: task.id },
    orderBy: { createdAt: 'asc' },
  })
  const changes = await repo(ChangeLog).find({
    where: {
      entity: 'tasks',
      relatedId: task.id,
    },
    orderBy: {
      changeDate: 'desc',
    },
  })

  for (const e of changes) {
    console.log(await formatUser(e.userId), formatDate(e.changeDate))
    console.table(
      e.changes.map((c) => ({
        key: c.key,
        val: c.newValue,
      }))
    )
  }
  console.table(
    await Promise.all(
      statusChanges.map(async (s) => ({
        user: await formatUser(s.createUserId),
        what: s.what,
      }))
    )
  )
  console.table(await repo(User).find({ where: { phone: '0537620739' } }))
}

async function formatUser(id?: string) {
  if (!id) return ''
  const user = await repo(User).findId(id)
  return user.name.split('').reverse().join('') + ` ${user.org} - ${user.phone}`
}
