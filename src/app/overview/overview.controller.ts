import { BackendMethod, SqlDatabase, dbNamesOf, remult, repo } from 'remult'
import { Roles } from '../users/roles'
import { Task } from '../events/tasks'
import { backendSites, getSite } from '../users/sites'
import { taskStatus } from '../events/taskStatus'

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
    } else sites.filter((x) => !x.ignore)
    if (!remult.isAllowed(Roles.superAdmin)) {
      sites = sites.filter((x) => x.urlPrefix === getSite().urlPrefix)
    }

    let sql = (
      await Promise.all(
        sites.map(
          async (x) => `
select '${x.title.replace(/'/g, "''")}'  org, date(${
            t.statusChangeDate
          }) date, count(*) rides, count(distinct ${t.driverId}) drivers 
from ${x.dbSchema}.${t} 
where ${await SqlDatabase.filterToRaw(repo(Task), {
            taskStatus: [
              taskStatus.assigned,
              taskStatus.driverPickedUp,
              taskStatus.completed,
            ],
          })}
group by org, date(${t.statusChangeDate})

          `
        )
      )
    ).join(' union all ')

    const r = await db.execute(`select * from (${sql}) as x order by date desc`)
    console.table(r.rows)
    return r.rows
  }
}
