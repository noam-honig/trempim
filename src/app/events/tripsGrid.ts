import { repo } from 'remult'
import { Task } from './tasks'
import { UITools } from '../common/UITools'
import { GridSettings, IDataSettings } from '../common-ui-elements/interfaces'
import { saveToExcel } from '../common-ui-elements/interfaces/src/saveGridToExcel'
import { BusyService, openDialog } from '../common-ui-elements'
import { EventInfoComponent } from '../event-info/event-info.component'

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
    gridButtons: [
      ...(gridButtons || []),

      {
        name: 'יצוא לאקסל',
        click: () => saveToExcel(allRides!, 'rides', busy),
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
            //x.refresh = () => this.refresh()
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
