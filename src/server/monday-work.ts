import { ValueConverters, remult, repo } from 'remult'
import { Task } from '../app/events/tasks'
import { gql, update } from './getGraphQL'
import { User } from '../app/users/user'
import { fixPhoneInput, isPhoneValidForIsrael } from '../app/events/phone'
import { GetGeoInformation } from '../app/common/address-input/google-api-helpers'
import { Roles } from '../app/users/roles'
import { taskStatus } from '../app/events/taskStatus'

export const PACKED_READY_FOR_DELIVERY = 3,
  ACTIVE_DELIVERY = 0,
  DELIVERY_DONE = 1

export async function updateReceivedFromMonday(event: Root) {
  try {
    if (event.event.type == 'update_column_value') {
      const id = event.event.pulseId
      const column_id = event.event.columnId
      const value = event.event.value
      const board = event.event.boardId

      await upsertTaskBasedOnMondayValues(board, id, column_id == 'status73')
    }
  } catch (err) {
    console.error(err)
  }
}

export function updateStatusOnMonday(task: Task, status: number) {
  update(1290250715, parseInt(task.externalId.split(':')[1]), 'status73', {
    index: status,
  })
}
export async function updateDriverOnMonday(task: Task) {
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

export interface MondayItem {
  id: string
  name: string
  column_values: {
    id: string
    text: string
    value: string
  }[]
  subitems: any[]
}

const DRIVER_PHONE_COLUMN = 'text63'
const DRIVER_NAME_COLUMN = 'text6'
export async function upsertTaskBasedOnMondayValues(
  board: number,
  id: number,
  statusChanged = false
) {
  const mondayUser = await repo(User).findFirst(
    { phone: '0500000002' },
    { createIfNotFound: true }
  )
  if (mondayUser.isNew()) {
    mondayUser.name = 'Monday'
    await mondayUser.save()
  }
  if (mondayUser.deleted) throw 'monday Integration disabled'
  remult.user = {
    id: mondayUser.id,
    roles: [Roles.admin, Roles.dispatcher],
  }

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
        }`
  )
  const mondayItem = monday.boards[0].items_page.items[0] as MondayItem

  const item = await repo(Task).findFirst(
    { externalId: 'm:' + id },
    {
      createIfNotFound: true,
    }
  )
  const mondayStatus = get('status73', undefined, true)
  switch (mondayStatus.index) {
    case PACKED_READY_FOR_DELIVERY:
    case ACTIVE_DELIVERY:
    case DELIVERY_DONE:
      break
    default:
      return
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
  let toAddress = get('location')
  if (toAddress) {
    item.toAddress = toAddress.replace(', Israel', '')
    if (item.$.toAddress.valueChanged())
      item.toAddressApiResult = await GetGeoInformation(item.toAddress)
  }
  let fromAddress = get('long_text7')
  if (fromAddress) {
    item.address = fromAddress
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
  let boxes = get('numbers')
  if (boxes) {
    item.title = boxes + ' ארגזים'
  } else item.title = item.phone1Description
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
  }

  if (statusChanged)
    switch (mondayStatus.index) {
      case PACKED_READY_FOR_DELIVERY:
        if (item.taskStatus !== taskStatus.active) {
          item.taskStatus = taskStatus.active
          if (!item._.isNew())
            await item.insertStatusChange('נדרש שילוח מMONDAY')
        }
        break
      case ACTIVE_DELIVERY:
        if (
          ![taskStatus.assigned, taskStatus.driverPickedUp].includes(
            item.taskStatus
          )
        ) {
          item.taskStatus = taskStatus.assigned
          await item.insertStatusChange('שוייך נהג בMONDAY')
        }
        break
      case DELIVERY_DONE:
        if (item.taskStatus !== taskStatus.completed) {
          item.taskStatus = taskStatus.completed
          await item.insertStatusChange('נסיעה הושלמה בMONDAY')
        }
        break
      default:
        return
    }
  if (item.taskStatus === taskStatus.active) item.driverId = ''
  await item.save()
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
