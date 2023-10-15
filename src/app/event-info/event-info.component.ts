import { Component, Input, OnInit, Output } from '@angular/core'
import { BusyService, openDialog } from '../common-ui-elements'
import { EventEmitter } from 'events'

import { remult, repo } from 'remult'
import { Roles } from '../users/roles'

import { UIToolsService } from '../common/UIToolsService'
import { Task, eventDisplayDate, taskStatus } from '../events/tasks'
import {
  getCity,
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

@Component({
  selector: 'app-event-info',
  templateUrl: './event-info.component.html',
  styleUrls: ['./event-info.component.scss'],
})
export class EventInfoComponent implements OnInit {
  constructor(public dialog: UIToolsService, private busy: BusyService) {}
  @Output() phoneChanged = new EventEmitter()
  @Input()
  e!: Task
  public refresh = () => {}
  driver?: User
  @Input() noClose = false
  displayDate() {
    return eventDisplayDate(this.e)
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
    window.open(
      'https://maps.google.com/maps?q=' +
        getLongLat(this.e.addressApiResult) +
        '&hl=he',
      '_blank'
    )
  }
  openTargetGoogleMap() {
    window.open(
      'https://maps.google.com/maps?q=' +
        getLongLat(this.e.toAddressApiResult) +
        '&hl=he',
      '_blank'
    )
  }
  sendWhatsapp(phone: string) {
    sendWhatsappToPhone(phone, '')
  }

  inProgress = false
  async registerToEvent() {
    if (this.inProgress) return
    this.inProgress = true
    try {
      this.contactInfo = await this.e.assignToMe()
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
  }
  showCancel() {
    return (
      this.e.taskStatus != taskStatus.active &&
      this.e.taskStatus != taskStatus.assigned
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
  contactInfo?: TaskContactInfo
  ngOnInit(): void {
    if (this.e.driverId && this.isDispatcher())
      this.e._.relations.driver.findOne().then((x) => (this.driver = x))
    if (this.e.driverId === remult.user?.id || this.isDispatcher()) {
      this.e.getContactInfo().then((x) => (this.contactInfo = x))
    }
  }

  edit() {
    this.e.openEditDialog(this.dialog, () => this.refresh())
  }
  getCity() {
    return getCity(this.e.addressApiResult?.results[0]?.address_components!)
  }
}
