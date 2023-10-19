import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'

import { remult, repo, Unsubscribe } from 'remult'
import { Roles } from '../users/roles'
import { Task, taskStatus } from './tasks'
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
  onlyShowRelevant = true
  async ngOnInit() {
    this.events = []
    if (this.activeTab == 2) {
      if (!this.allRides) {
        this.allRides = new GridSettings<Task>(repo(Task), {
          where: () => {
            if (this.onlyShowRelevant)
              return {
                taskStatus: {
                  $ne: [taskStatus.notRelevant, taskStatus.completed],
                },
              }
            return {}
          },
          orderBy: {
            taskStatus: 'desc',
            statusChangeDate: 'desc',
          },
          include: {
            driver: true,
            createUser: true,
          },
          gridButtons: [
            {
              textInMenu: () =>
                this.onlyShowRelevant ? 'הצג הכל' : 'הצג רק רלוונטיות',
              click: () => {
                this.onlyShowRelevant = !this.onlyShowRelevant
                this.allRides?.reloadData()
              },
            },
            {
              name: 'יצוא לאקסל',
              click: () => saveToExcel(this.allRides!, 'rides', this.busy),
            },
          ],
          columnSettings: (t) => [
            t.externalId,
            t.title,
            t.taskStatus,
            t.statusChangeDate,
            { field: t.driverId, getValue: (t) => t.driver?.name },
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
            t.draft,

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
            ...Task.rowButtons(this.tools, {
              taskAdded: (t) => this.allRides!.items.push(t),
            }),
          ],
        })
      } else this.allRides.reloadData()
    } else
      repo(Task)
        .find({
          where:
            this.activeTab == 0
              ? {
                  draft: false,
                  driverId: remult.user!.id,
                }
              : { draft: false, taskStatus: taskStatus.active },
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
