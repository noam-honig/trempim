import { Component, Input, OnInit, Output } from '@angular/core'
import {
  BusyService,
  WantsToCloseDialog,
  openDialog,
} from '../common-ui-elements'
import { EventEmitter } from 'events'

import { remult, repo } from 'remult'
import { Roles } from '../users/roles'

import { UIToolsService } from '../common/UIToolsService'
import { Task, eventDisplayDate } from '../events/tasks'
import { taskStatus } from '../events/taskStatus'
import {
  getCity,
  getGoogleMapLink,
  getLongLat,
  openWaze,
} from '../common/address-input/google-api-helpers'
import {
  ContactInfo,
  TaskContactInfo,
  sendWhatsappToPhone,
} from '../events/phone'
import { UpdateStatusComponent } from '../update-status/update-status.component'
import { User } from '../users/user'
import { getImageUrl } from '../events/getImageUrl'
import { DialogConfig } from '../common-ui-elements/src/angular/DialogConfig'

@DialogConfig({ maxWidth: '95vw' })
@Component({
  selector: 'app-event-info',
  templateUrl: './event-info.component.html',
  styleUrls: ['./event-info.component.scss'],
})
export class EventInfoComponent implements OnInit, WantsToCloseDialog {
  constructor(public dialog: UIToolsService, private busy: BusyService) {}
  @Output() phoneChanged = new EventEmitter()
  @Input()
  e!: Task
  public refresh = () => {}
  driver?: User
  @Input() noClose = false
  displayDate() {
    return this.e.displayDate()
  }
  getImageUrl() {
    return getImageUrl(this.e.imageId)
  }

  menuOptions = Task.rowButtons(this.dialog, {
    taskAdded: (t) => this.refresh(),
    taskSaved: () => this.refresh(),
  })
  openSourceWaze() {
    openWaze(getLongLat(this.e.addressApiResult), this.e.address)
  }
  openTargetWaze() {
    openWaze(getLongLat(this.e.toAddressApiResult), this.e.toAddress)
  }

  openSourceGoogleMap() {
    window.open(getGoogleMapLink(this.e.addressApiResult), '_blank')
  }
  openTargetGoogleMap() {
    window.open(getGoogleMapLink(this.e.toAddressApiResult), '_blank')
  }
  sendWhatsapp(phone: string) {
    sendWhatsappToPhone(phone, '')
  }

  inProgress = false
  async registerToEvent() {
    if (this.inProgress) return
    this.inProgress = true
    try {
      await this.e.assignToMe()
      await this.e._.reload()
    } catch (err: any) {
      this.dialog.error(err)
      this.e.taskStatus = taskStatus.assigned
    } finally {
      this.inProgress = false
    }
  }
  async problem() {
    await openDialog(
      UpdateStatusComponent,
      (x) => (x.args = { showFailStatus: true, task: this.e })
    )
  }
  async completed() {
    await openDialog(
      UpdateStatusComponent,
      (x) => (x.args = { showFailStatus: false, task: this.e })
    )
    await this.e._.reload()
  }
  showCancel() {
    return (
      this.e.taskStatus != taskStatus.active &&
      this.e.taskStatus != taskStatus.assigned &&
      this.e.taskStatus != taskStatus.draft
    )
  }
  isAssigned() {
    return this.e.taskStatus == taskStatus.assigned
  }
  async clickedByMistake() {
    await this.e.statusClickedByMistake()
  }

  isDispatcher() {
    return remult.isAllowed(Roles.dispatcher)
  }
  registered() {
    return this.e.driverId === remult.user?.id
  }
  showAssign() {
    return this.e.taskStatus == taskStatus.active
  }
  contactInfo: TaskContactInfo = {
    origin: [],
    target: [],
  }
  ngOnInit(): void {
    repo(Task)
      .findFirst({ id: this.e.id })
      .then((x) => {
        if (!x) {
          this.dialog.error('הנסיעה כנראה כבר נלקחה על ידי נהג אחר')
          this.e.taskStatus = taskStatus.assigned
          this.closeDialog?.()
        }
      })
    if (this.e.driverId && this.isDispatcher())
      this.e._.relations.driver.findOne().then((x) => (this.driver = x))
  }

  edit() {
    this.e.openEditDialog(this.dialog, () => this.refresh())
  }
  getCity() {
    return getCity(this.e.addressApiResult!, this.e.address)
  }
  closeDialog!: VoidFunction
}
//[ ] - התקן המכשיר

//[ ] - add alerts and last seen stuff

//[ ] - add urgency, critical, high, medium, normal
//[ ] - add driver's address - to use for distance measurement
