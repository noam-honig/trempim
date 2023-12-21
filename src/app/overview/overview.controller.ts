import {
  BackendMethod,
  SqlDatabase,
  ValueConverters,
  ValueListFieldType,
  dbNamesOf,
  remult,
  repo,
} from 'remult'
import { Roles } from '../users/roles'
import { Task } from '../events/tasks'
import { backendSites, getSite } from '../users/sites'
import { taskStatus } from '../events/taskStatus'
import { User } from '../users/user'

export class OverviewController {
  @BackendMethod({ allowed: Roles.admin })
  static async getOverview() {
    const db = SqlDatabase.getDb()
    const t = await dbNamesOf(Task)
    let sites = [...backendSites]
    if (getSite().urlPrefix === 'test1') {
      sites = sites.filter(
        (x) => x.urlPrefix === 'test1' || x.urlPrefix === 'dshinua'
      )
    } else sites = sites.filter((x) => !x.ignore)
    if (!remult.isAllowed(Roles.superAdmin)) {
      sites = sites.filter((x) => x.urlPrefix === getSite().urlPrefix)
    }

    let sql = (
      await Promise.all(
        sites.map(
          async (x) => `
select '${x.title.replace(/'/g, "''")}'  org,
date_trunc('week', ${
            t.statusChangeDate
          }) - interval '1 day' date, count(*) rides, count(distinct ${
            t.driverId
          }) drivers 
from ${x.dbSchema}.${t} 
where ${t.taskStatus} in (${[
            taskStatus.assigned,
            taskStatus.driverPickedUp,
            taskStatus.completed,
          ]
            .map((x) => x.id)
            .join(',')}) 
            and ${t.org} = '${x.org}'

          
group by org, date_trunc('week', ${t.statusChangeDate}) - interval '1 day' 

          `
        )
      )
    ).join(' union all ')

    const r = await db.execute(`select * from (${sql}) as x order by date desc`)
    //console.table(r.rows)
    return r.rows
  }
  @BackendMethod({ allowed: Roles.admin })
  static async topDrivers(from: string, to: string, km: boolean) {
    const fromDate = new Date(Date.parse(from))
    const toDate = new Date(Date.parse(to))
    const db = SqlDatabase.getDb()
    const t = await dbNamesOf(Task)
    const u = await dbNamesOf(User)

    const c = db.createCommand()

    return (
      await c.execute(`select ${u.name}, ${u.phone}, sum(${
        km ? t.distance : 1
      }) 
    from (select * from ${t} where ${t.taskStatus} in (${[
        taskStatus.assigned,
        taskStatus.driverPickedUp,
        taskStatus.completed,
      ]
        .map((x) => x.id)
        .join(',')}) 
      and ${t.org} = '${getSite().org}' and ${
        t.statusChangeDate
      }>=${c.addParameterAndReturnSqlToken(fromDate)} and ${
        t.statusChangeDate
      }<=${c.addParameterAndReturnSqlToken(
        toDate
      )}   ) as t join ${u} as u on u.${u.id}=${t.driverId}
    where   u.${u.org}='${getSite().org}'
    group by ${u.name}, ${u.phone}
    order by 3 desc
    limit 10
    `)
    ).rows
  }
}

export interface TopDriver {
  name: string
  phone: string
  sum: number
}
