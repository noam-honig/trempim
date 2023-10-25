import { remultExpress } from 'remult/remult-express'
import { User } from '../app/users/user'
import { SignInController } from '../app/users/SignInController'
import { initRequest } from './server-session'
import { Task } from '../app/events/tasks'
import { TaskImage } from 'src/app/events/TaskImage'
import { TaskStatusChanges } from 'src/app/events/TaskStatusChanges'
import {
  createPostgresDataProviderWithSchema,
  getConnectionForSchema,
} from './PostgresSchemaWrapper'
import { config } from 'dotenv'
import { SqlDatabase, remult, repo } from 'remult'
import { VersionInfo } from './version'
import { Locks } from '../app/events/locks'
import {
  getBackendSite,
  getSite,
  getSiteFromPath,
  initSite,
} from '../app/users/sites'
import { SseSubscriptionServer } from 'remult/server'
import { Roles } from '../app/users/roles'

//import { readExcelVolunteers } from './read-excel'
//import { readTripExcel } from './read-excel'

config() //loads the configuration from the .env file

//SqlDatabase.LogToConsole = true
const entities = [User, Task, TaskStatusChanges, VersionInfo, Locks, TaskImage]
export const api = remultExpress({
  subscriptionServer: new SseSubscriptionServer((x) =>
    remult.isAllowed(Roles.dispatcher)
  ),
  controllers: [SignInController],
  rootPath: '/*/api',
  entities,
  initRequest: async (req) => {
    let schema = getSiteFromPath(req)
    initSite(schema)
    remult.dataProvider = await getConnectionForSchema({
      disableSsl: Boolean(process.env['dev']),
      schema: getBackendSite(schema)!.dbSchema,
      entities,
    })
    return await initRequest(req)
  },

  initApi: async () => {
    //;(await import('./read-excel')).readTripExcel()
  },
})
//[ ] = לדאוג שידים יעשה REDIRECT נכון
