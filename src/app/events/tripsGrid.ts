import { repo } from 'remult'
import { Task } from './tasks'
import { UITools } from '../common/UITools'
import { GridSettings, IDataSettings } from '../common-ui-elements/interfaces'
import { saveToExcel } from '../common-ui-elements/interfaces/src/saveGridToExcel'
import { BusyService, openDialog } from '../common-ui-elements'
import { EventInfoComponent } from '../event-info/event-info.component'
import { taskStatus } from './taskStatus'
import { getRelationInfo } from 'remult/internals'

export function tripsGrid({
  ui,
  busy,
  gridButtons,
  ...gridOptions
}: { ui: UITools; busy: BusyService } & IDataSettings<Task>) {
  let allRides: GridSettings<Task> = new GridSettings<Task>(repo(Task), {
    include: {
      driver: true,
      createUser: true,
    },
    allowSelection: true,
    gridButtons: [
      ...(gridButtons || []),
      {
        name: 'סמן נסיעות לבירור רלוונטיות',
        icon: 'question_mark',
        click: async () => {
          const relevantRides = allRides.selectedRows.filter(
            (x) => x.taskStatus == taskStatus.active
          )
          if (!relevantRides.length) {
            ui.error('לא סומנו נסיעות מתאימות, אנא סמנו בעזרת תיבת הסימון')
            return
          }
          if (
            await ui.yesNoQuestion(
              `האם לעדכן ${relevantRides.length} נסיעות לבירור רלוונטיות?`
            )
          ) {
            ui.error(
              `עודכנו ${await Task.markTasksForRelevanceCheck(
                relevantRides.map((x) => x.id)
              )} נסיעות`
            )
          }
        },
      },

      {
        name: 'יצוא לאקסל',
        click: () =>
          saveToExcel(allRides!, 'rides', busy, {
            excludeColumn: (e: Task, c) =>
              !!getRelationInfo(c.metadata.options) ||
              c === e.$.toAddressApiResult ||
              c == e.$.addressApiResult,
            moreColumns: (e: Task, addField) => {
              addField('טלפון נהג', e.driver?.$.phone.displayValue!, 's')
            },
          }),
      },
    ],
    ...gridOptions,
    columnSettings: (t) => [
      t.externalId,
      t.title,
      t.taskStatus,
      t.statusChangeDate,
      {
        field: t.driverId,
        getValue: (t) => t.driver?.name,
        customFilter: (select) => {
          ui.selectUser({
            onSelect: (x) => select(x.id),
            onCancel: () => select(undefined),
          })
        },
      },
      t.statusNotes,
      t.category!,
      t.eventDate,
      t.startTime,
      t.relevantHours,
      t.validUntil,
      t.address,
      t.phone1,
      t.phone1Description,
      t.toAddress,
      t.toPhone1,
      t.tpPhone1Description,

      t.createUserId,
    ],
    rowButtons: [
      {
        name: 'הצג נסיעה',
        click: (e) => {
          openDialog(EventInfoComponent, (x) => {
            x.e = e
            x.context = 'מהטבלה'
          })
        },
      },
      ...Task.rowButtons(ui, {
        taskAdded: (t) => allRides!.items.push(t),
      }),
    ],
  })
  return allRides
}
