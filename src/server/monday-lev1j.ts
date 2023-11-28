import { repo } from 'remult'
import { Event, MondayItem, get, getMondayItem, update } from './getGraphQL'
import { Task } from '../app/events/tasks'
import { initIntegrationUser } from './monday-work'
import { GetGeoInformation } from '../app/common/address-input/google-api-helpers'
import { taskStatus } from '../app/events/taskStatus'
import { User } from '../app/users/user'

export async function test() {
  for (let index = 0; index < 100; index++) {
    await update(BOARD_ID, 1327015792, 'text_1', index.toString(), API_TOKEN())
  }
}

const API_TOKEN = () => process.env['MONDAY_LEV1_API_TOKEN']
const BOARD_ID = 1322810347
export async function updateReceivedFromMondayLev1j(event: Event) {
  await upsertTaskBasedOnMondayValues(
    await getMondayItem(BOARD_ID, event.pulseId, API_TOKEN())
  )
}

async function upsertTaskBasedOnMondayValues(item: MondayItem) {
  await initIntegrationUser('Monday')

  const task = await repo(Task).findFirst(
    { externalId: 'm:' + item.id },
    {
      createIfNotFound: true,
    }
  )
  task.__disableValidation = true
  let mondayStatus = get(item, 'status', true)
  switch (mondayStatus.index) {
    case 0:
      if (task.isNew()) {
        task.taskStatus = taskStatus.draft
        task.category = get(item, 'single_select49')

        task.title = get(item, 'short_text')
        task.address = get(item, 'location').replace(', Israel', '')
        if (task.$.address.valueChanged())
          task.addressApiResult = await GetGeoInformation(task.address)
        task.toAddress = get(item, 'location8').replace(', Israel', '')
        if (task.$.toAddress.valueChanged())
          task.toAddressApiResult = await GetGeoInformation(task.toAddress)
        task.description = get(item, 'text')
        task.phone1Description = item.name
        task.eventDate = task.$.eventDate.metadata.valueConverter.fromInput(
          get(item, 'date')
        )
        task.description = get(item, 'long_text')
        task.phone1 = get(item, 'phone') || ''
        task.phone1Description = item.name
        const d = get(item, 'date05').split(' ')
        task.eventDate = task.$.eventDate.metadata.valueConverter.fromInput(
          d[0]
        )
        task.startTime = (d[1] || '08:00') + ':00'
      } else if (task.taskStatus == taskStatus.notRelevant) {
        task.taskStatus = task.driverId
          ? taskStatus.assigned
          : taskStatus.active
      }
      break
    default:
      if (task.isNew()) return
      if (
        ![taskStatus.completed, taskStatus.notRelevant, taskStatus].includes(
          task.taskStatus
        )
      ) {
        task.taskStatus = taskStatus.notRelevant
        await task.insertStatusChange(
          'הועבר בMONDAY לסטטוס ' + mondayStatus.text
        )
      }
  }

  await task.save()
}

export async function updateLev1Monday(task: Task) {
  const id = task.externalId?.split(':')[1]
  if (!id) return
  if (task.$.driverId.valueChanged()) {
    const driver =
      task.driverId != '' ? await repo(User).findId(task.driverId) : undefined
    update(BOARD_ID, +id, 'text_2', driver?.name || '', API_TOKEN())
    update(BOARD_ID, +id, 'text_3', driver?.phone || '', API_TOKEN())
  }

  if (task.$.taskStatus.valueChanged()) {
    update(BOARD_ID, +id, 'text0', task.taskStatus?.caption || '', API_TOKEN())
  }
  if (task.$.statusNotes.valueChanged()) {
    update(BOARD_ID, +id, 'text_1', task.statusNotes || '', API_TOKEN())
  }
}
