import { Component, Injectable, OnInit } from '@angular/core'
import { UIToolsService } from '../common/UIToolsService'
import { BusyService } from '../common-ui-elements'
import { tripsGrid } from '../events/tripsGrid'
import { EntityFilter, remult, repo } from 'remult'
import { User } from '../users/user'
import { Task } from '../events/tasks'
import { getSite } from '../users/sites'
import { fixPhoneInput } from '../events/phone'

@Component({
  selector: 'app-updates',
  templateUrl: './updates.component.html',
  styleUrls: ['./updates.component.scss'],
})
export class UpdatesComponent implements OnInit {
  constructor(
    private updates: UpdatesService,
    private ui: UIToolsService,
    private busy: BusyService
  ) {}

  searchString = ''
  doSearch() {
    this.tripGrid.page = 1
    this.busy.donotWait(() => this.tripGrid.reloadData())
  }

  ngOnInit(): void {}
  rowsLoaded = false
  tripGrid = tripsGrid({
    ui: this.ui,
    busy: this.busy,
    rowsLoaded: () => {
      if (!this.rowsLoaded) this.updates.updateLastUpdatedView()
      this.rowsLoaded = true
    },

    where: () => {
      const result: EntityFilter<Task> = {
        $and: [getSite().tasksFilter()],
      }
      if (this.searchString) {
        let or: EntityFilter<Task>[] = [
          { title: { $contains: this.searchString } },
          { externalId: { $contains: this.searchString } },
          { requesterPhone1Description: { $contains: this.searchString } },
          { phone1Description: { $contains: this.searchString } },
          { phone2Description: { $contains: this.searchString } },
        ]
        const searchDigits = fixPhoneInput(this.searchString)
        if (searchDigits)
          or.push(
            { phone1: { $contains: searchDigits } },
            { phone2: { $contains: searchDigits } },
            { requesterPhone1: { $contains: searchDigits } }
          )
        result.$or = or
      }
      return result
    },
    rowCssClass: (t) =>
      t.statusChangeDate > this.updates.lastUpdateViewed ? 'new-update' : '',
    orderBy: {
      statusChangeDate: 'desc',
    },
  })
}

@Injectable()
export class UpdatesService {
  async updateLastUpdatedView() {
    if (!getSite().countUpdates) return
    const user = await repo(User).findFirst({ id: [remult.user?.id!] })
    this.lastUpdateViewed = user.lastUpdateView
    user.lastUpdateView = new Date()
    this.waitingUpdates = 0
    await user.save()
  }
  waitingUpdates = 0
  async updateWaitingUpdates() {
    if (!getSite().countUpdates) return
    const user = await repo(User).findFirst({ id: [remult.user?.id!] })
    if (user.lastUpdateView) this.lastUpdateViewed = user.lastUpdateView
    this.waitingUpdates = await repo(Task).count({
      statusChangeDate: { $gt: this.lastUpdateViewed },
    })
  }

  lastUpdateViewed = new Date()
}
