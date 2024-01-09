import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'

import { EntityFilter, remult, repo, Unsubscribe } from 'remult'
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
import { getSite, getSiteByOrg } from '../users/sites'
import { EventCardComponent } from '../event-card/event-card.component'
import { User } from '../users/user'

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
      if (this.tripId) this.activeTab = this.isPublicView() ? 0 : 1
      this.loadEvents()
      if (remult.user && remult.user.showAllOrgs == null && remult.user!.orgs.length > 1) {
        this.tools
          .yesNoQuestion(
            `הנך רשום במספר ארגונים, האם תרצה להציג את הנסיעות של כל הארגונים?\n תמיד תוכל לשנות הגדרה זו במסך עדכון פרטים`
          )
          .then((showAllOrgs) => {
            remult.user!.showAllOrgs = showAllOrgs
            repo(User).update(remult.user!.id, {
              showAllOrgs,
            })
            this.ngOnInit()
          })
      }
    })
  }

  private loadEvents() {
    let date = new Date()
    date.setHours(date.getHours() - 2)
    let orgFilter: EntityFilter<Task> = {}
    if (remult.user?.showAllOrgs == null) { // TODO are volunteers allowed to see all orgs?
      orgFilter = { $and: [getSite().tasksFilter()] }
    } else if (remult.user!.showAllOrgs == false) {
      orgFilter = { org: getSite().org }
    } else
      orgFilter = {
        $or: remult.user?.orgs
          .filter((x) => !getSiteByOrg(x.org).showPastEvents)
          .map((x) => ({
            $or: [{ org: { '!=': x.org } }, { validUntil: { $gt: date } }],
          })),
      }

    let tabs = []
    if (this.isPublicView()) {
      tabs = [1] // TODO are we missing some further authentications in case user forcefully requests tab 0/2?
    } else {
      tabs = [0, 1, 2]
    }

    repo(Task)
      .find({
        where:
          tabs[this.activeTab] == 0
            ? {
                taskStatus: [taskStatus.assigned, taskStatus.driverPickedUp],
                driverId: remult.user!.orgs.map((x) => x.userId),
              }
            : // : document.location.host.includes('localhost') && false
            // ? {}
            tabs[this.activeTab] == 1
            ? {
                category:
                  (remult.user?.allowedCategories?.filter((x) => x)?.length ||
                    0) > 0
                    ? remult.user!.allowedCategories
                    : undefined,
                taskStatus: [taskStatus.active],
                isDrive: this.isPublicView() ? true : undefined,
                validUntil: getSite().showPastEvents
                  ? undefined!
                  : { $gt: date },
                ...orgFilter,
              }
            : {
                taskStatus: [
                  taskStatus.assigned,
                  taskStatus.driverPickedUp,
                  taskStatus.otherProblem,
                ],
                $and: [getSite().tasksFilter()],
              },
        include:
          tabs[this.activeTab] == 2
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
            let monday = this.tripId.startsWith('m:')
            let t = items.find((x) =>
              monday ? x.externalId == this.tripId : x.id == this.tripId
            )
            if (!t) {
              if (monday)
                t = await repo(Task).findFirst({
                  externalId: this.tripId,
                })
              else t = await repo(Task).findId(this.tripId)
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
            else if (remult.isAllowed(Roles.dispatcher))
              this.tools.error('נסיעה לא נמצאה', this.tripId)
            else this.tools.error('לנסיעה זו כבר משוייך נהג', this.tripId)
          }
          if (this.events.length == 0) this.gotoSearchEvents()
        }
      })
  }

  private gotoSearchEvents() {
    this.tabGroup.selectedIndex = 1
  }

  public isPublicView() {
    return !remult.authenticated() // TODO are volunteers authenticated?
  }
}
