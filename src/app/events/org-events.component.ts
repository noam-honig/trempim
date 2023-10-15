import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'

import { remult, repo, Unsubscribe } from 'remult'
import { Roles } from '../users/roles'
import { Task } from './tasks'
import { UITools } from '../common/UITools'
import { UIToolsService } from '../common/UIToolsService'
import { MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs'
import { GridSettings } from '../common-ui-elements/interfaces'
import { saveToExcel } from '../common-ui-elements/interfaces/src/saveGridToExcel'
import { BusyService, openDialog } from '../common-ui-elements'
import { EventInfoComponent } from '../event-info/event-info.component'

@Component({
  selector: 'app-org-events',
  templateUrl: './org-events.component.html',
  styleUrls: ['./org-events.component.scss'],
})
export class OrgEventsComponent implements OnInit {
  constructor(private tools: UIToolsService, private busy: BusyService) {}

  addTask() {
    const t = repo(Task).create()
    t.openEditDialog(this.tools, () => (this.events = [t, ...this.events]))
  }
  @ViewChild('tabGroup')
  tabGroup!: MatTabGroup
  onTabChange(event: MatTabChangeEvent) {
    this.activeTab = event.index
    this.ngOnInit()
  }

  isDispatcher() {
    return remult.isAllowed(Roles.dispatcher)
  }
  activeTab = 0
  firstLoad = true

  events: Task[] = []
  allRides?: GridSettings<Task>
  async ngOnInit() {
    if (this.activeTab == 2) {
      this.allRides = new GridSettings<Task>(repo(Task), {
        include: {
          driver: true,
        },
        gridButtons: [
          {
            name: 'יצוא לאקסל',
            click: () => saveToExcel(this.allRides!, 'rides', this.busy),
          },
        ],
        columnSettings: (t) => [
          t.title,
          t.taskStatus,
          { field: t.driverId, getValue: (t) => t.driver?.name },
          t.category!,
          t.eventDate,
          t.startTime,

          t.statusChangeDate,
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
          ...Task.rowButtons(this.tools, {
            taskAdded: (t) => this.allRides!.items.push(t),
          }),
        ],
      })
    } else
      repo(Task)
        .find({
          where: {
            driverId: this.activeTab ? undefined : remult.user!.id,
            $and: [Task.filterActiveTasks()],
          },
        })
        .then((items) => {
          this.events = items
          if (this.firstLoad) {
            this.firstLoad = false
            if (this.events.length == 0) this.tabGroup.selectedIndex = 1
          }
        })
  }
}
