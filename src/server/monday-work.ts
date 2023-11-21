import { JsonDataProvider, ValueConverters, remult, repo } from 'remult'
import { Task } from '../app/events/tasks'
import { MondayItem, get, gql, update } from './getGraphQL'
import { User } from '../app/users/user'
import { fixPhoneInput, isPhoneValidForIsrael } from '../app/events/phone'
import { GetGeoInformation } from '../app/common/address-input/google-api-helpers'
import { Roles } from '../app/users/roles'
import { taskStatus } from '../app/events/taskStatus'
import { sendSms } from './send-sms'
import { getSite } from '../app/users/sites'

export const PACKED_READY_FOR_DELIVERY = 3,
  ACTIVE_DELIVERY = 0,
  DELIVERY_DONE = 1,
  NO_PACK_READY_FOR_DELIVERY = 6,
  ON_HOLD = 14

export async function updateReceivedFromMonday(event: Root) {
  try {
    if (event?.event?.type == 'update_column_value') {
      const id = event.event.pulseId
      const column_id = event.event.columnId
      const value = event.event.value
      const board = event.event.boardId

      await upsertTaskBasedOnMondayValues(
        board,
        id,
        ['status73', DRIVER_NAME_COLUMN, DRIVER_PHONE_COLUMN].includes(
          column_id
        )
      )
    }
  } catch (err) {
    console.error(err)
  }
}

export function updateStatusOnMonday(task: Task, status: number) {
  if (remult.user?.phone === MONDAY_USER_PHONE) return
  update(1290250715, parseInt(task.externalId.split(':')[1]), 'status73', {
    index: status,
  })
}
export async function updateDriverOnMonday(task: Task) {
  if (remult.user?.phone === MONDAY_USER_PHONE) return
  if (task.driverId) {
    const user = await repo(User).findId(task.driverId)
    if (user) {
      update(
        1290250715,
        parseInt(task.externalId.split(':')[1]),
        DRIVER_PHONE_COLUMN,
        user.phone
      )
      update(
        1290250715,
        parseInt(task.externalId.split(':')[1]),
        DRIVER_NAME_COLUMN,
        user.name
      )
    }
  }
}

export interface Root {
  event: Event
}

export interface Event {
  app: string
  type: string
  triggerTime: string
  subscriptionId: number
  userId: number
  originalTriggerUuid: any
  boardId: number
  groupId: string
  pulseId: number
  pulseName: string
  columnId: string
  columnType: string
  columnTitle: string
  value: Value
  previousValue: Value
  changedAt: number
  isTopGroup: boolean
  triggerUuid: string
}

export interface Value {
  label: Label
  post_id: any
}

export interface Label {
  index: number
  text: string
  style: Style
  is_done: boolean
}

export interface Style {
  color: string
  border: string
  var_name: string
}

export const MONDAY_USER_PHONE = '0500000002'
const DRIVER_PHONE_COLUMN = 'text63'
const DRIVER_NAME_COLUMN = 'text6'

const TRMPS_BOARD = 1287079265

export async function upsertTaskBasedOnMondayValues(
  board: number,
  id: number,
  statusOrDriverChange = false
) {
  await initIntegrationUser('Monday')
  const warRoomDriversBoard = board == 1307656994
  const apiKey = warRoomDriversBoard
    ? process.env['MONDAY_WARROOM_API_TOKEN']
    : undefined

  const monday = await gql(
    {
      board: board,
      item: id,
    },
    `#graphql
        query ($board: ID!, $item: ID!) {
          boards(ids: [$board]) {
            id
            name
            board_folder_id
            board_kind
            items_page(query_params: {ids: [$item]}) {
              items {
                id
                name
                column_values {
                  id
                  text
                  value
                }
              }
            }
          }
        }`,
    apiKey
  )
  const mondayItem = monday.boards[0].items_page.items[0] as MondayItem

  if (warRoomDriversBoard) {
    await updateDriverBasedOnMonday()
  } else await updateTaskBasedOnMondayValues()

  async function updateDriverBasedOnMonday() {
    const phone = fixPhoneInput(get('text65'))
    if (get('status8', undefined, true)?.index == 0) {
      if (phone) {
        const user = await repo(User).findFirst(
          { phone },
          { createIfNotFound: true }
        )
        if (user.isNew() || !user.name) {
          user.name = mondayItem.name
          await user.save()
          await sendSms(
            user.phone,
            `אהלן ${user.name}, בקשתך להצטרף כנהג/אופנוען מתנדב ל"חדר מלחמה כנפי ברזל" אושרה!
לצפיה בנסיעות המחכות לעזרה לחץ:
https://sh.hagai.co/wrc`
          )
        }
      }
    }
  }

  function get(
    mondayColumn: string,
    process?: (val: any) => any,
    useVal?: boolean
  ): any {
    for (const c of mondayItem.column_values) {
      if (c.id == mondayColumn) {
        let val = c.text
        if (useVal) val = JSON.parse(c.value)
        if (val && process) val = process(val)

        if (val) return val
      }
    }
    return undefined
  }
  async function updateTaskBasedOnMondayValues() {
    const item = await repo(Task).findFirst(
      { externalId: 'm:' + id },
      {
        createIfNotFound: true,
      }
    )
    const mondayStatus = get('status73', undefined, true)
    switch (mondayStatus?.index) {
      case PACKED_READY_FOR_DELIVERY:
      case NO_PACK_READY_FOR_DELIVERY:
      case ACTIVE_DELIVERY:
      case DELIVERY_DONE:
        break
      default:
        if (item.isNew()) return
        break
    }
    item.__disableValidation = true
    item.phone1Description = mondayItem.name
    function set(
      mondayColumn: string,
      taskField: keyof Task,
      process?: (val: any) => any
    ) {
      let val = get(mondayColumn, process)
      if (val) {
        item.$.find(taskField).value = val
      }
    }

    let toAddress = get('location')
    if (toAddress) {
      item.toAddress = toAddress.replace(', Israel', '')
      if (item.$.toAddress.valueChanged())
        item.toAddressApiResult = await GetGeoInformation(item.toAddress)
    }
    let fromAddress = get('location0')
    if (fromAddress) {
      item.address = fromAddress
      if (get('status_1', undefined, true)?.index === 2)
        item.address = 'יהודה הלוי 48 תל אביב'
      if (item.$.address.valueChanged())
        item.addressApiResult = await GetGeoInformation(item.address)
    }

    set('text4', 'phone1')
    set('short_text', 'tpPhone1Description')
    set('short_text0', 'toPhone1')
    set('date', 'eventDate', (x) => ValueConverters.DateOnly.fromJson!(x))
    item.description = ''
    function setDesc(
      mondayColumn: string,
      title?: string,
      process?: (val: any) => any
    ) {
      let val = get(mondayColumn)
      if (val && process) val = process(val)
      if (val) {
        item.description += (title ? title + ': ' : '') + val + '\n'
      }
    }
    setDesc('long_text3', 'ציוד')
    setDesc('single_select', 'כשרות')
    setDesc('long_text76', 'ציוד נדרש עבור נשים')
    setDesc('long_text', 'הערות')
    item.title = get('text47')
    if (!item.title) {
      let boxes = get('numbers')
      if (boxes && boxes.trim() != '0') {
        item.title = boxes == 1 ? 'ארגז אחד' : boxes + ' ארגזים'
      }
    }
    if (!item.title) item.title = 'ציוד'
    let driverPhone = get(DRIVER_PHONE_COLUMN)
    if (driverPhone) {
      driverPhone = fixPhoneInput(driverPhone)
      if (isPhoneValidForIsrael(driverPhone)) {
        const user = await repo(User).findFirst(
          { phone: driverPhone },
          { createIfNotFound: true }
        )
        if (user.isNew() || !user.name) {
          user.name = get(DRIVER_NAME_COLUMN) as string
          await user.save()
        }
        if (item.driverId !== user.id) {
          item.driverId = user.id
        }
      }
    } else item.driverId = ''

    if (statusOrDriverChange)
      switch (mondayStatus.index) {
        case PACKED_READY_FOR_DELIVERY:
        case NO_PACK_READY_FOR_DELIVERY:
          let relevantStatus = item.driverId
            ? taskStatus.assigned
            : taskStatus.active
          item.returnMondayStatus = mondayStatus.index
          if (item.taskStatus !== relevantStatus) {
            item.taskStatus = relevantStatus
            if (!item._.isNew())
              await item.insertStatusChange('נדרש שילוח מMONDAY')
          }
          break
        case ACTIVE_DELIVERY:
          if (![taskStatus.driverPickedUp].includes(item.taskStatus)) {
            item.taskStatus = taskStatus.driverPickedUp
            await item.insertStatusChange('משלוח נאסף בMONDAY')
          }
          break
        case DELIVERY_DONE:
          if (item.taskStatus !== taskStatus.completed) {
            item.taskStatus = taskStatus.completed
            await item.insertStatusChange('נסיעה הושלמה בMONDAY')
          }
          break
        case ON_HOLD:
          if (item.taskStatus !== taskStatus.draft) {
            item.taskStatus = taskStatus.draft
            await item.insertStatusChange(
              'הועבר בMONDAY לסטטוס ' + mondayStatus.text
            )
          }
          break
      }
    if (item.taskStatus === taskStatus.active) item.driverId = ''
    await item.save()
  }
}

export async function listTasks() {
  const fs = await import('fs')
  if (false) {
    const items = await gql(
      { board: TRMPS_BOARD },
      `#graphql

query ($board: ID!) {
  boards(ids: [$board]) {
    id
    name
    board_folder_id
    board_kind
    items_page(limit:500,
    query_params:{
      rules:[
        {
          column_id:"status"
          compare_value:2
        }
      ]
    }
    ) {
      items {
        id
        name
        column_values {
          id
          text
          value
        }
      }
    }
  }
}
  `,
      process.env['MONDAY_TREMPS_API_TOKEN']
    )

    const mondayItems = items.boards[0].items_page.items as MondayItem[]
    fs.writeFileSync('tmp/trmps.json', JSON.stringify(mondayItems, null, 2))
  }
  const mondayItems: MondayItem[] = JSON.parse(
    fs.readFileSync('tmp/trmps.json').toString()
  )
  await initIntegrationUser('Monday')
  for (const item of mondayItems) {
    await upsertTrmpsMondayItem(item)
  }
}
export async function upsertTrmpsMondayItem(item: MondayItem) {
  const task = await repo(Task).findFirst(
    { externalId: 'm:' + item.id },
    {
      createIfNotFound: true,
    }
  )
  switch (get(item, 'status', true).index) {
    case 2:
      break
    default:
      if (task.isNew()) return
  }
  task.title = 'שינוע'
  task.__disableValidation = true
  task.phone1Description = item.name
  task.eventDate = task.$.eventDate.metadata.valueConverter.fromInput(
    get(item, 'date')
  )
  task.description = get(item, 'text12')
  task.address = get(item, 'location')
  if (task.$.address.valueChanged())
    task.addressApiResult = await GetGeoInformation(task.address)
  task.toAddress = get(item, 'location5')
  if (task.$.toAddress.valueChanged())
    task.toAddressApiResult = await GetGeoInformation(task.toAddress)
  task.phone1 = get(item, 'phone') || ''
  task.category = get(item, 'status3')
  await task.save()
}

export interface MondayAddress {
  lat: string
  lng: string
  city: City
  street: Street
  address: string
  country: Country
  placeId: string
  changed_at: string
  streetNumber: StreetNumber
}

export interface City {
  long_name: string
  short_name: string
}

export interface Street {
  long_name: string
  short_name: string
}

export interface Country {
  long_name: string
  short_name: string
}

export interface StreetNumber {
  long_name: string
  short_name: string
}
export async function initIntegrationUser(name: string) {
  const mondayUser = await repo(User).findFirst(
    { phone: MONDAY_USER_PHONE },
    { createIfNotFound: true }
  )
  if (mondayUser.isNew()) {
    mondayUser.name = name
    await mondayUser.save()
  }
  if (mondayUser.deleted) throw 'monday Integration disabled'
  remult.user = {
    id: mondayUser.id,
    phone: MONDAY_USER_PHONE,
    roles: [Roles.admin, Roles.dispatcher],
    orgs: [{ org: getSite().org, userId: mondayUser.id }],
    showAllOrgs: false,
  }
  remult.context.availableTaskIds = []
}
