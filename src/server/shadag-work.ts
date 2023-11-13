import { remult, repo } from 'remult'
import { User } from '../app/users/user'
import { MONDAY_USER_PHONE, initIntegrationUser } from './monday-work'
import { Roles } from '../app/users/roles'
import { Task } from '../app/events/tasks'
import e from 'express'
import { GetGeoInformation } from '../app/common/address-input/google-api-helpers'

export async function upsertShadagTrip(trip: ShadagItem) {
  initIntegrationUser('Shadag integration')

  const item = await repo(Task).findFirst(
    { externalId: 's:' + trip.id },
    {
      createIfNotFound: true,
    }
  )
  switch (trip['סטטוס טיפול']) {
    case 'מוכן לשילוח':
      break
    default:
      if (item.isNew()) return
      break
  }
  item.__disableValidation = true
  item.category = trip['קטגוריה לשינוע']
  item.title = trip['מס בקשה']
  item.address = trip['כתובת חמל'] + ' ' + trip['עיר חמל']
  if (item.$.address.valueChanged() || !item.addressApiResult?.results?.[0]) {
    item.addressApiResult = await GetGeoInformation(item.address)
  }

  item.toAddress = trip['כתובת'] + ' ' + trip['ישוב']
  if (
    item.$.toAddress.valueChanged() ||
    !item.toAddressApiResult?.results?.[0]
  ) {
    item.toAddressApiResult = await GetGeoInformation(item.toAddress)
  }
  item.description = ''
  function setDesc(field: keyof ShadagItem, title?: string) {
    let val = trip[field]
    if (!title) title = field
    if (val) {
      item.description += (title ? title + ': ' : '') + val + '\n'
    }
  }
  setDesc('הערות לכתובת')
  setDesc('כתובת 2')
  setDesc('פירוט הבקשה')
  setDesc('הערות לשינוע')
  item.phone1 = trip['טלפון נציג']
  item.phone1Description = trip['שם נציג']
  item.phone2 = trip['טלפון מנהל חמל']
  item.phone2Description = trip['שם מלא מנהל חמל']
  item.toPhone1 = trip['טלפון איש קשר']
  item.tpPhone1Description = trip['שם מלא איש קשר']

  item.imageId = trip.image
  await item.save()
}
export async function updateShadagBasedOnTask(t: Task) {
  if (remult.user?.phone === MONDAY_USER_PHONE) return
  const url = process.env['SHADAG_UPDATE_URL']
  if (!url) return
  const driver = await repo(User).findId(t.driverId)
  const fetch = await import('node-fetch')
  let r = await fetch
    .default(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: t.externalId.substring(2),
        org: t.org,
        status: t.taskStatus?.id,
        statusText: t.taskStatus?.caption,
        driverName: driver?.name,
        driverPhone: driver?.phone,
        statusNotes: t.statusNotes,
      }),
    })
    .then((x) => x.text())
  console.log('shadag update result', r)
}
interface ShadagItem {
  id: string
  'קטגוריה לשינוע': string
  'מס בקשה': string
  'כתובת חמל': string
  'עיר חמל': string
  כתובת: string
  'כתובת 2': string
  ישוב: string
  'הערות לכתובת': string
  'פירוט הבקשה': string
  'הערות לשינוע': string
  'תאריך ושעה של שינוע מבוקש': string
  'טלפון נציג': string
  'שם נציג': string
  'טלפון מנהל חמל': string
  'שם מלא מנהל חמל': string
  'טלפון איש קשר': string
  'שם מלא איש קשר': string
  'עבור מי ההזמנה': string
  'סטטוס טיפול': string
  'סטטוס משלוח': string
  image: string
}
