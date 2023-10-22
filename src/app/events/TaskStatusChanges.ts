import { IdEntity, remult, Fields, Field, Relations, Entity } from 'remult'
import { Roles } from '../users/roles'
import { User } from '../users/user'
import { CreatedAtField } from './date-utils'
import { taskStatus } from './taskStatus'

@Entity<TaskStatusChanges>('taskStatusChanges', {
  allowApiCrud: false,
  allowApiRead: Roles.dispatcher,
  defaultOrderBy: {
    createdAt: 'desc',
  },
})
export class TaskStatusChanges extends IdEntity {
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
  @Relations.toOne<TaskStatusChanges, User>(() => User, 'createUserId')
  createUser?: User
  @CreatedAtField({ caption: 'מתי' })
  createdAt = new Date()
}
