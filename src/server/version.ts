import {
  dbNamesOf,
  Entity,
  Fields,
  getValueList,
  IdEntity,
  remult,
  repo,
  SqlDatabase,
} from 'remult'
import {
  calcValidUntil,
  Task,
  taskStatus,
  TaskStatusChanges,
} from '../app/events/tasks'
import { phoneConfig } from '../app/events/phone'

@Entity(undefined!, {
  dbName: 'versionInfo',
})
export class VersionInfo extends IdEntity {
  @Fields.number()
  version: number = 0
}

export async function versionUpdate() {
  let version = async (ver: number, what: () => Promise<void>) => {
    let v = await remult.repo(VersionInfo).findFirst()
    if (!v) {
      v = remult.repo(VersionInfo).create()
      v.version = 0
    }
    if (v.version <= ver - 1) {
      await what()
      v.version = ver
      await v.save()
    }
  }
  const db = SqlDatabase.getDb()

  await version(1, async () => {
    await db.execute(`CREATE SEQUENCE task_seq
    START WITH 3000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;`)
  })
  version(2, async () => {
    phoneConfig.disableValidation = true
    for await (const task of repo(Task).query()) {
      task.validUntil = calcValidUntil(
        task.eventDate,
        task.startTime,
        task.relevantHours
      )
      try {
        await task.save()
      } catch (err: any) {
        console.error(err.message)
        throw err
      }
    }
    phoneConfig.disableValidation = false
  })

  version(5, async () => {
    const t = await dbNamesOf(Task)
    const s = await dbNamesOf(TaskStatusChanges)
    await db.execute(
      `insert into ${s} (${s.id}, ${s.taskId},${s.what},${s.eventStatus},${s.driverId},${s.createUserId},${s.createdAt}) 
      select ${t.id},${t.id},'יצירה',${t.taskStatus},${t.driverId},${t.createUserId},${t.createdAt} from ${t}`
    )
  })
}
