import {
  IdEntity,
  remult,
  Fields,
  Field,
  Relations,
  Entity,
  BackendMethod,
  Allow,
  repo,
} from 'remult'
import { Roles } from '../users/roles'
import { User } from '../users/user'
import { CreatedAtField } from './date-utils'
import { taskStatus } from './taskStatus'
import { Task } from './tasks'
import { OrgEntity } from '../users/OrgEntity'

@Entity<TaskStatusChanges>('taskStatusChanges', {
  allowApiCrud: false,
  allowApiRead: Roles.dispatcher,
  defaultOrderBy: {
    createdAt: 'desc',
  },
})
export class TaskStatusChanges extends OrgEntity {
  @Fields.string()
  taskId = ''
  @Fields.string({ caption: 'פעולה' })
  what = ''
  @Field(() => taskStatus)
  eventStatus!: taskStatus

  @Fields.string({ caption: 'הערות' })
  notes = ''
  @Fields.string({ caption: 'נהג' })
  driverId = ''
  @Relations.toOne<TaskStatusChanges, User>(() => User, 'driverId')
  driver?: User
  @Fields.string({ caption: 'בוצע ע"י' })
  createUserId = remult.user?.id!
  @Fields.string()
  session = remult.context.sessionId
  @Relations.toOne<TaskStatusChanges, User>(() => User, 'createUserId')
  createUser?: User
  @CreatedAtField({ caption: 'מתי' })
  createdAt = new Date()

  @BackendMethod({ allowed: true })
  static async view(what: string, info: string, taskId?: string) {
    let task: Task | undefined = undefined
    if (taskId) task = await repo(Task).findId(taskId)
    await repo(TaskStatusChanges).insert({
      taskId: taskId,
      what: what,
      eventStatus: task?.taskStatus,
      notes: info,
      driverId: task?.driverId,
    })
  }
}
