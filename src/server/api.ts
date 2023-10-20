import { remultExpress } from 'remult/remult-express'
import { User } from '../app/users/user'
import { SignInController } from '../app/users/SignInController'
import { initRequest } from './server-session'
import { Task, TaskStatusChanges, TaskImage } from '../app/events/tasks'
import { createPostgresDataProviderWithSchema } from './PostgresSchemaWrapper'
import { config } from 'dotenv'
import { SqlDatabase, remult, repo } from 'remult'
import { VersionInfo } from './version'
import { Locks } from '../app/events/locks'
import { Site, initSite } from '../app/users/sites'

//import { readExcelVolunteers } from './read-excel'
//import { readTripExcel } from './read-excel'

config() //loads the configuration from the .env file

export const schema = process.env['DB_SCHEMA']!

//SqlDatabase.LogToConsole = true
const entities = [User, Task, TaskStatusChanges, VersionInfo, Locks, TaskImage]
export const api = remultExpress({
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
