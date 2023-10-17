import { Component, OnInit } from '@angular/core'
import { remult, repo } from 'remult'
import { Task, taskStatus } from '../events/tasks'
import {
  GeocodeResult,
  getGoogleMapLink,
} from '../common/address-input/google-api-helpers'
import { UITools } from '../common/UITools'
import { UIToolsService } from '../common/UIToolsService'
import { openDialog } from '../common-ui-elements'
import { EventInfoComponent } from '../event-info/event-info.component'
import { Roles } from '../users/roles'

@Component({
  selector: 'app-draft-overview',
  templateUrl: './draft-overview.component.html',
  styleUrls: ['./draft-overview.component.scss'],
})
export class DraftOverviewComponent implements OnInit {
  constructor(private ui: UIToolsService) {}
  tasks: Task[] = []
  ngOnInit(): void {
    repo(Task)
      .find({
        where: {
          draft: true,
          taskStatus: taskStatus.active,
        },
        include: {
          createUser: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      .then((tasks) => {
        this.tasks = tasks
      })
  }
  isDispatcher() {
    return remult.isAllowed(Roles.dispatcher)
  }
  addTask() {
    const t = repo(Task).create({ draft: true })
    t.openEditDialog(this.ui, () => (this.tasks = [t, ...this.tasks]))
  }
  getGoogleAddress(address?: GeocodeResult | null) {
    if (!address?.results?.[0]) return 'כלל לא מצא'
    let result = address?.results?.[0]?.formatted_address!
    if (result == '' && address?.results?.[0]?.geometry) return 'נצ על מפה'
    if (result.endsWith('ישראל')) {
      result = result.slice(0, -'ישראל'.length).trim()
    }
    return result.trim()
  }
  getMapsLink = getGoogleMapLink
  edit(t: Task) {
    t.openEditDialog(this.ui)
  }
  show(t: Task) {
    openDialog(EventInfoComponent, (x) => {
      x.e = t
    })
  }
  async confirm(t: Task) {
    t.draft = !t.draft
    await t.save()
  }
  errorColor(address?: GeocodeResult | null) {
    if (!address?.results?.[0]?.geometry) return 'red'
    return ''
  }
}
