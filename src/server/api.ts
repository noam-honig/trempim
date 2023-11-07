import { remultExpress } from 'remult/remult-express'
import { User } from '../app/users/user'
import { SignInController } from '../app/users/SignInController'
import { initRequestUser } from './server-session'
import { Task } from '../app/events/tasks'
import { TaskImage } from 'src/app/events/TaskImage'
import { TaskStatusChanges } from 'src/app/events/TaskStatusChanges'
import { getPostgresSchemaManager } from './PostgresSchemaWrapper'
import { config } from 'dotenv'
import {
  InMemoryLiveQueryStorage,
  LiveQueryStorage,
  SqlDatabase,
  SubscriptionServer,
  remult,
  repo,
} from 'remult'
import { VersionInfo } from './version'
import { Locks } from '../app/events/locks'
import {
  getBackendSite,
  getSite,
  getSiteFromPath,
  initSite,
} from '../app/users/sites'
import { InitRequestOptions, SseSubscriptionServer } from 'remult/server'
import { Roles } from '../app/users/roles'
import { sendSms } from './send-sms'
import { gql, update } from './getGraphQL'
import {
  ACTIVE_DELIVERY,
  updateStatusOnMonday,
  upsertTaskBasedOnMondayValues,
} from './monday-work'
import {
  GetGeoInformation,
  updateGeocodeResult,
} from '../app/common/address-input/google-api-helpers'
import { ChangeLog } from '../app/common/change-log/change-log'

import { OverviewController } from '../app/overview/overview.controller'
import fetch from 'node-fetch'

//import { readExcelVolunteers } from './read-excel'
//import { readTripExcel } from './read-excel'

config() //loads the configuration from the .env file

//SqlDatabase.LogToConsole = true
const entities = [
  User,
  Task,
  TaskStatusChanges,
  VersionInfo,
  Locks,
  TaskImage,
  ChangeLog,
]

const postgres = getPostgresSchemaManager({
  disableSsl: Boolean(process.env['dev']),
  entities,
})

export const api = remultExpress({
  subscriptionServer: new SseSubscriptionServer(() =>
    remult.isAllowed([Roles.dispatcher, Roles.manageDrivers])
  ),
  controllers: [SignInController, OverviewController],
  rootPath: '/*/api',
  entities,
  initRequest: async (req, options) => {
    let schema = getSiteFromPath(req)
    initSite(schema)
    remult.context.origin =
      'https://' + req.get('host') + '/' + getSite().urlPrefix
    const info = getBackendSite(schema)
    if (!info) {
      console.log('Error, invalid schema - request was: ' + req.path)
      throw 'invalid schema'
    }
    remult.dataProvider = await postgres.getConnectionForSchema(
      getBackendSite(schema)!.dbSchema
    )
    await initRequestUser(req)
    initRemultBasedOnRequestInfo(schema, options)
  },
  contextSerializer: {
    serialize: async () => ({
      origin: remult.context.origin,
      site: getSite().urlPrefix,
    }),
    deserialize: async (json, options) => {
      let schema = json.site
      remult.context.origin = json.origin
      initSite(schema)
      remult.dataProvider = await postgres.getConnectionForSchema(
        getBackendSite(schema)!.dbSchema
      )
      initRemultBasedOnRequestInfo(schema, options)
    },
  },

  initApi: async () => {
    try {
      remult.dataProvider = await postgres.getConnectionForSchema(
        getBackendSite('test1')!.dbSchema
      )

      remult.subscriptionServer = new SseSubscriptionServer()

      //await updateStatusOnMonday(item, ACTIVE_DELIVERY)

      //await upsertTaskBasedOnMondayValues(1290250715, 1299715447)
    } catch (error: any) {
      console.error(error)
    }
  },
})

const siteEventPublishers = new Map<
  string,
  {
    subscriptionServer: SubscriptionServer
    liveQueryStorage: LiveQueryStorage
  }
>()
function initRemultBasedOnRequestInfo(
  site: string,
  options: InitRequestOptions
) {
  let found = siteEventPublishers.get(site)
  if (!found) {
    let subscriptionServer: SubscriptionServer
    let x = new SseSubscriptionServer((channel, remult) => {
      return remult.isAllowed([Roles.dispatcher, Roles.manageDrivers])
    })

    subscriptionServer = x

    var liveQueryStorage = new InMemoryLiveQueryStorage()
    siteEventPublishers.set(
      site,
      (found = {
        subscriptionServer,
        liveQueryStorage,
      })
    )
  }
  remult.subscriptionServer = found.subscriptionServer
  options.liveQueryStorage = found.liveQueryStorage
}
