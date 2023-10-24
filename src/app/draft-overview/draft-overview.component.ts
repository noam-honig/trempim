import { Component, OnInit } from '@angular/core'
import { remult, repo } from 'remult'
import { Task } from '../events/tasks'
import { taskStatus } from '../events/taskStatus'
import {
  GeocodeResult,
  getGoogleMapLink,
} from '../common/address-input/google-api-helpers'
import { UIToolsService } from '../common/UIToolsService'
import { openDialog } from '../common-ui-elements'
import { EventInfoComponent } from '../event-info/event-info.component'
import { Roles } from '../users/roles'
import { getTitle } from '../users/sites'
import { Title } from '@angular/platform-browser'
import { User } from '../users/user'

@Component({
  selector: 'app-draft-overview',
  templateUrl: './draft-overview.component.html',
  styleUrls: ['./draft-overview.component.scss'],
})
export class DraftOverviewComponent implements OnInit {
  constructor(private ui: UIToolsService, private title: Title) {}
  tasks: Task[] = []
  buttons = Task.rowButtons(this.ui)

  ngOnInit(): void {
    this.title.setTitle(getTitle() + ' ניהול')
    repo(Task)
      .find({
        where: {
          taskStatus: taskStatus.draft,
        },
        include: {
          createUser: true,
          responsibleDispatcher: true,
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
    const t = repo(Task).create({ taskStatus: taskStatus.draft })
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
    if (t.taskStatus === taskStatus.active) await t.markAsDraft()
    else await t.returnToActive()
  }
  errorColor(address?: GeocodeResult | null) {
    if (!address?.results?.[0]?.geometry) return 'red'
    return ''
  }
  showUser(t: Task) {
    this.ui.showUserInfo({ user: t.createUser, title: 'פרטי מוקדן' })
  }
  showDispatcher(t: Task) {
    this.ui.showUserInfo({ user: t.responsibleDispatcher, title: 'פרטי מוקדן' })
  }
  isDraft(t: Task) {
    return t.taskStatus === taskStatus.draft
  }
  async assignToMe(t: Task) {
    await t._.reload()
    if (t.responsibleDispatcherId) {
      if (!this.ui.yesNoQuestion('הקריאה כבר משוייכת למוקדן אחר, האם להחליף?'))
        return
    }
    t.responsibleDispatcherId = remult.user!.id
    await t.save()
    t.responsibleDispatcher = await repo(User).findId(remult.user!.id)
  }
  async clearMeAsDispatcher(t: Task) {
    t.responsibleDispatcherId = ''
    t.responsibleDispatcher = undefined
    await t.save()
  }
}
