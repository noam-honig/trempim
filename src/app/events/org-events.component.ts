import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'

import { remult, repo, Unsubscribe } from 'remult'
import { Roles } from '../users/roles'
import { Task } from './tasks'
import { taskStatus } from './taskStatus'
import { UIToolsService } from '../common/UIToolsService'
import { MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs'
import { GridSettings, RowButton } from '../common-ui-elements/interfaces'
import { BusyService, openDialog } from '../common-ui-elements'
import { EventInfoComponent } from '../event-info/event-info.component'
import { ActivatedRoute } from '@angular/router'
import { Location } from '@angular/common'
import { getImageUrl } from './getImageUrl'
import { tripsGrid } from './tripsGrid'
import { getSite } from '../users/sites'
import { EventCardComponent } from '../event-card/event-card.component'

@Component({
  selector: 'app-org-events',
  templateUrl: './org-events.component.html',
  styleUrls: ['./org-events.component.scss'],
})
export class OrgEventsComponent implements OnInit {
  constructor(
    private tools: UIToolsService,
    private busy: BusyService,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  @ViewChild('tabGroup')
  tabGroup!: MatTabGroup

  @ViewChild(EventCardComponent)
  eventCardComponent?: EventCardComponent

  onTabChange(event: MatTabChangeEvent) {
    if (event.index != this.activeTab) {
      this.activeTab = event.index
      this.loadEvents()
    }
  }

  isDispatcher() {
    return remult.isAllowed(Roles.dispatcher)
  }
  activeTab = 0
  firstLoad = true

  events: Task[] = []

  onlyShowRelevant = true
  tripId = ''
  async ngOnInit() {
    this.events = []
    this.route.paramMap.subscribe((param) => {
      this.tripId = param.get('id')!
      if (this.tripId) this.activeTab = 1
      this.loadEvents()
    })
  }

  private loadEvents() {
    let date = new Date()
    date.setHours(date.getHours() - 2)

    repo(Task)
      .find({
        where:
          this.activeTab == 0
            ? {
                taskStatus: [taskStatus.assigned, taskStatus.driverPickedUp],
                driverId: remult.user!.id,
              }
            : // : document.location.host.includes('localhost') && false
            // ? {}
            this.activeTab == 1
            ? {
                category:
                  (remult.user?.allowedCategories?.length || 0) > 0
                    ? remult.user!.allowedCategories
                    : undefined,
                taskStatus: [taskStatus.active],
                validUntil: getSite().showPastEvents
                  ? undefined!
                  : { $gt: date },
              }
            : {
                taskStatus: [
                  taskStatus.assigned,
                  taskStatus.driverPickedUp,
                  taskStatus.otherProblem,
                ],
              },
        include:
          this.activeTab == 2
            ? {
                driver: true,
              }
            : {},
      })
      .then(async (items) => {
        this.events = items
        if (this.firstLoad) {
          this.firstLoad = false
          if (this.tripId) {
            this.location.replaceState('/')
            let t = items.find((x) => x.id == this.tripId)
            if (!t) {
              t = await repo(Task).findId(this.tripId)
            }
            if (t)
              openDialog(EventInfoComponent, (x) => {
                ;(x.e = t!), (x.context = 'מקישור')
                x.args = {
                  closeScreenAfterAdd: async () => {
                    return this.eventCardComponent?.suggestRides(t!) || false
                  },
                }
              })
            else this.tools.error('לנסיעה זו כבר משוייך נהג', this.tripId)
          }
          if (this.events.length == 0) this.gotoSearchEvents()
        }
      })
  }

  private gotoSearchEvents() {
    this.tabGroup.selectedIndex = 1
  }
}
