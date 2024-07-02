import { Allow, BackendMethod, Entity, Fields, Relations, remult, repo } from 'remult'
import { Roles } from '../users/roles'
import { User } from '../users/user'
import { CreatedAtField } from './date-utils'

@Entity('locks', {
  allowApiCrud: false,
  allowApiRead: false,
})
export class Locks {
  @Fields.string()
  lockId = ''
  @CreatedAtField()
  createdAt = new Date()
  @Fields.string()
  lockUserId = ''
  @Relations.toOne<Locks, User>(() => User, 'lockUserId')
  lockUser?: User
  @BackendMethod({ allowed: Allow.authenticated })
  static async lock(lockId: string, force: boolean) {
    let l = await repo(Locks).findFirst(
      { lockId },
      { include: { lockUser: true } }
    )
    if (l) {
      if (force) {
        await Locks.unlock(lockId)
      } else throw 'נסיעה נעולה על ידי ' + l.lockUser?.name
    }
    l = await repo(Locks).insert({ lockId, lockUserId: remult.user!.id })
    return true
  }
  @BackendMethod({ allowed: Allow.authenticated })
  static async unlock(lockId: string) {
    await repo(Locks).delete({ lockId })
    return true
  }
}
