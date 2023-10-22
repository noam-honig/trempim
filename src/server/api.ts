import { remultExpress } from 'remult/remult-express'
import { User } from '../app/users/user'
import { SignInController } from '../app/users/SignInController'
import { initRequest } from './server-session'
import { Task } from '../app/events/tasks'
import { TaskImage } from 'src/app/events/TaskImage'
import { TaskStatusChanges } from 'src/app/events/TaskStatusChanges'
import { createPostgresDataProviderWithSchema } from './PostgresSchemaWrapper'
import { config } from 'dotenv'
import { SqlDatabase, remult, repo } from 'remult'
import { VersionInfo } from './version'
import { Locks } from '../app/events/locks'
import { Site, initSite } from '../app/users/sites'
import { SseSubscriptionServer } from 'remult/server'
import { Roles } from '../app/users/roles'

//import { readExcelVolunteers } from './read-excel'
//import { readTripExcel } from './read-excel'

config() //loads the configuration from the .env file

export const schema = process.env['DB_SCHEMA']!

//SqlDatabase.LogToConsole = true
const entities = [User, Task, TaskStatusChanges, VersionInfo, Locks, TaskImage]
export const api = remultExpress({
  subscriptionServer: new SseSubscriptionServer((x) =>
    remult.isAllowed(Roles.dispatcher)
  ),
  controllers: [SignInController],
  entities,
  initRequest: async (req) => {
    initSite(schema)
    return await initRequest(req)
  },
  dataProvider: () =>
    createPostgresDataProviderWithSchema({
      disableSsl: Boolean(process.env['dev']),
      schema,
    }),
  initApi: async () => {
    //;(await import('./read-excel')).readTripExcel()
  },
})
