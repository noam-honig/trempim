import { Component, Injectable, OnInit } from '@angular/core'
import { UIToolsService } from '../common/UIToolsService'
import { BusyService } from '../common-ui-elements'
import { tripsGrid } from '../events/tripsGrid'
import { remult, repo } from 'remult'
import { User } from '../users/user'
import { Task } from '../events/tasks'

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

  ngOnInit(): void {}
  rowsLoaded = false
  tripGrid = tripsGrid({
    ui: this.ui,
    busy: this.busy,
    rowsLoaded: () => {
      if (!this.rowsLoaded) this.updates.updateLastUpdatedView()
      this.rowsLoaded = true
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
    const user = await repo(User).findFirst({ id: [remult.user?.id!] })
    this.lastUpdateViewed = user.lastUpdateView
    user.lastUpdateView = new Date()
    this.waitingUpdates = 0
    await user.save()
  }
  waitingUpdates = 0
  async updateWaitingUpdates() {
    const user = await repo(User).findFirst({ id: [remult.user?.id!] })
    this.lastUpdateViewed = user.lastUpdateView || new Date()
    this.waitingUpdates = await repo(Task).count({
      statusChangeDate: { $gt: this.lastUpdateViewed },
    })
  }
  constructor() {
    this.lastUpdateViewed = new Date()
    this.lastUpdateViewed.setDate(this.lastUpdateViewed.getDate() - 1)
  }
  lastUpdateViewed: Date
}
