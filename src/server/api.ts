import { remultExpress } from 'remult/remult-express'
import { createPostgresConnection } from 'remult/postgres'
import { User } from '../app/users/user'
import { SignInController } from '../app/users/SignInController'
import { initRequest } from './server-session'
import { Task, TaskStatusChanges } from '../app/events/tasks'
import { createPostgresDataProviderWithSchema } from './PostgresSchemaWrapper'
import { config } from 'dotenv'
import { analyzeAddresses } from './analyze-addresses'
//import { readExcelVolunteers } from './read-excel'
config() //loads the configuration from the .env file

const entities = [User, Task, TaskStatusChanges]
export const api = remultExpress({
  controllers: [SignInController],
  entities,
  initRequest,
  dataProvider: () =>
    createPostgresDataProviderWithSchema({
      disableSsl: Boolean(process.env['dev']),
      schema: process.env['DB_SCHEMA']!,
    }),
  initApi: analyzeAddresses,
})
