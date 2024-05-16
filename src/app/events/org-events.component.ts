import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'

import { EntityFilter, remult, repo, Unsubscribe, UserInfo } from 'remult'
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

export enum DriveTabs {
  MY_DRIVES,
  SEARCH_DRIVES,
  ACTIVE_DRIVES,
  FOR_DRIVERS,
  FOR_PICKUPEES,
}

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

    let orgOrFilter: EntityFilter<Task> = {}
    let orgAndFilter: EntityFilter<Task> = {}
    let orgFilter: EntityFilter<Task> = {}
    if (remult.user?.showAllOrgs == null) { // If a user is unauthenticated, then show all (drive) tasks.
      orgAndFilter = { $and: [getSite().tasksFilter()] }
    } else if (remult.user!.showAllOrgs == false) {
      orgFilter = { org: getSite().org }
    } else {
      orgOrFilter = {
        $or: remult.user?.orgs
          .filter((x) => !getSiteByOrg(x.org).showPastEvents)
          .map((x) => ({
            $or: [{ org: { '!=': x.org } }, { validUntil: { $gt: date } }],
          }))
      }
    }

    const tabs = this.getTabs()

    const whereSearch = this.getTabSearchLogic(tabs, date, orgFilter, orgAndFilter, orgOrFilter)
    if (whereSearch === null) {
      return
    }

    // Beware. API Prefilter is the only thing protecting this component from giving
    //  access to all tasks to anonymous users. isDrive is forced back there already.
    repo(Task)
      .find({
        where: whereSearch,
        include:
          tabs[this.activeTab] == DriveTabs.ACTIVE_DRIVES
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
      .catch((e) => {
        console.log('bp')
      })
  }

  getTabs() {
    if (remult.isAllowed(Roles.dispatcher)) {
      return [
        DriveTabs.FOR_PICKUPEES, DriveTabs.FOR_DRIVERS, DriveTabs.MY_DRIVES, DriveTabs.SEARCH_DRIVES, DriveTabs.ACTIVE_DRIVES
      ]
    } else {
      return [DriveTabs.FOR_PICKUPEES, DriveTabs.FOR_DRIVERS, DriveTabs.MY_DRIVES]
    }
  }

  private getTabSearchLogic(
    tabs: DriveTabs[], date: Date, orgFilter: EntityFilter<Task>,
    orgAndFilter: EntityFilter<Task>, orgOrFilter: EntityFilter<Task>
  ): EntityFilter<Task> | null {
    const buildSearchDrives = (withDriveOffers: boolean, withRequests: boolean): EntityFilter<Task> => {
      const q = {
        category:
          (remult.user?.allowedCategories?.filter((x) => x)?.length ||
            0) > 0
            ? remult.user!.allowedCategories
            : undefined,
        $and: [
          orgAndFilter, // will be $and[$and] = {...}
          {
            $or: [
              { taskStatus: [taskStatus.active], isDrive: false },
              { taskStatus: [taskStatus.assigned], isDrive: true },
            ]
          }
        ],
        $or: [
          orgOrFilter, // will be $or[$or] = {...}
        ],
        validUntil: getSite().showPastEvents
          ? undefined!
          : { $gt: date },
        ...orgFilter,
      }

      const orBlock = []
      if (withDriveOffers) {
        orBlock.push({ taskStatus: [taskStatus.assigned], isDrive: true})
      }
      if (withRequests) {
        orBlock.push({ taskStatus: [taskStatus.active], isDrive: false })
      }

      if (withDriveOffers || withRequests) {
        q["$and"].push({"$or": orBlock})
      }

      return q
    }

    const selectedTab = tabs[this.activeTab]
    switch (selectedTab) {
      case DriveTabs.MY_DRIVES: {
        return {
          taskStatus: [taskStatus.assigned, taskStatus.full, taskStatus.driverPickedUp],
          driverId: remult.user!.orgs.map((x) => x.userId),
        }
      }
      case DriveTabs.SEARCH_DRIVES: {
        return buildSearchDrives(true, true)
      }
      case DriveTabs.ACTIVE_DRIVES: {
        return {
          taskStatus: [
            taskStatus.assigned,
            taskStatus.full,
            taskStatus.driverPickedUp,
            taskStatus.otherProblem,
          ],
          $and: [getSite().tasksFilter()],
          driverId: this.isVolunteer() ? remult.user!.id : undefined,
        }
      }
      case DriveTabs.FOR_DRIVERS: {
        return buildSearchDrives(false, true)
      }
      case DriveTabs.FOR_PICKUPEES: {
        return buildSearchDrives(true, false)
      }
    }

    return null
  }

  private gotoSearchEvents() {
    this.tabGroup.selectedIndex = 1
  }

  public isPublicView() {
    return getSite().allowDriveTasks && !remult.authenticated()
  }

  private isVolunteer() {
    return !remult.isAllowed(Roles.dispatcher) && !remult.isAllowed(Roles.manageDrivers) && !remult.isAllowed(Roles.admin) && !remult.isAllowed(Roles.superAdmin) && !remult.isAllowed(Roles.trainee)
  }
}
