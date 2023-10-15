import { Component, Input, OnInit } from '@angular/core'
import { Field, Fields, getFields, remult } from 'remult'
import { EventInfoComponent } from '../event-info/event-info.component'
import { DataAreaSettings, RowButton } from '../common-ui-elements/interfaces'
import { BusyService, openDialog } from '../common-ui-elements'

import * as copy from 'copy-to-clipboard'
import { UIToolsService } from '../common/UIToolsService'
import { Category, Task, eventDisplayDate, taskStatus } from '../events/tasks'
import { Roles } from '../users/roles'
import {
  Location,
  GetDistanceBetween,
  getCity,
  getLongLat,
  getLocation,
  getCurrentLocation,
  getRegion,
} from '../common/address-input/google-api-helpers'
const AllCategories = {
  id: 'asdfaetfsafads',
  caption: 'הכל',
  count: 0,
}
@Component({
  selector: 'app-event-card',
  templateUrl: './event-card.component.html',
  styleUrls: ['./event-card.component.scss'],
})
export class EventCardComponent implements OnInit {
  constructor(private dialog: UIToolsService) {}

  menuOptions: RowButton<Task>[] = Task.rowButtons(this.dialog, {
    taskAdded: (t) => {
      this.tasks.push(t)
      this.refresh()
    },
    taskSaved: () => this.refresh(),
  })

  getStatus(e: Task) {
    if (e.taskStatus != taskStatus.active) return e.taskStatus.caption
    return ''
  }
  isDispatcher() {
    return remult.isAllowed(Roles.dispatcher)
  }
  dates: dateEvents[] = []
  regions: { id: string; count: number; caption: string }[] = []
  types: { id: string; count: number; caption: string }[] = []
  trackBy(i: number, e: { id: any }): any {
    return e.id as any
  }

  @Fields.string({
    caption: 'איפה?',
  })
  region: string = ''
  @Field(() => Category, { caption: 'קטגוריה' })
  category = AllCategories
  area!: DataAreaSettings

  _tasks!: Task[]

  @Input()
  set tasks(val: Task[]) {
    this._tasks = val
    this.refresh()
  }
  showLocation = false
  refresh() {
    this.dates = []
    this.tasks.sort((a, b) => compareEventDate(a, b))

    let firstLongLat: string | undefined

    this.regions.splice(0)
    this.types.splice(0)
    for (const e of this._tasks) {
      if (!firstLongLat) firstLongLat = getLongLat(e.addressApiResult)
      if (getLongLat(e.addressApiResult) != firstLongLat)
        this.showLocation = true
      let d = this.dates.find((d) => d.date == eventDisplayDate(e))
      if (!d) this.dates.push((d = { date: eventDisplayDate(e), events: [] }))
      d.events.push(e)
      let region = this.regions.find(
        (c) => c.id == getRegion(e.addressApiResult)
      )
      if (!region) {
        this.regions.push({
          id: getRegion(e.addressApiResult),
          count: 1,
          caption: '',
        })
      } else region.count++
      let type = this.types.find((c) => c.id == e.category?.id)
      if (!type) {
        this.types.push({
          id: e.category?.id!,
          count: 1,
          caption: e.category?.caption || '',
        })
      } else type.count++
    }
    this.regions.sort((b, a) => a.count - b.count)
    this.regions.forEach((c) => (c.caption = c.id + ' - ' + c.count))
    this.regions.splice(0, 0, {
      id: '',
      count: this._tasks.length,
      caption: 'כל הארץ' + ' - ' + this._tasks.length,
    })

    this.types.sort((b, a) => a.count - b.count)
    this.types.forEach((c) => (c.caption = c.caption + ' - ' + c.count))

    this.types.splice(0, 0, AllCategories)

    this.dates = this.dates.filter((d) => d.events.length > 0)
    this.sortEvents()
    this.area = new DataAreaSettings({
      fields: () => [
        [
          {
            field: this.$.region,
            valueList: this.regions,
            visible: () => this.regions.length > 2,
          },
          {
            field: this.$.category,
            valueList: this.types,
            visible: () => this.types.length > 2,
          },
        ],
      ],
    })
  }

  filter(e: Task) {
    return (
      (this.region == '' || getRegion(e.addressApiResult) == this.region) &&
      (this.category == undefined ||
        this.category == AllCategories ||
        e.category?.id == this.category.id)
    )
  }
  hasEvents(d: dateEvents) {
    return !!d.events.find((x) => this.filter(x))
  }
  get tasks() {
    return this._tasks
  }
  get $() {
    return getFields(this, remult)
  }

  ngOnInit(): void {}
  eventDetails(e: Task) {
    openDialog(EventInfoComponent, (x) => {
      x.e = e
      x.refresh = () => this.refresh()
    })
  }
  displayDate(e: Task) {
    return eventDisplayDate(e)
  }
  clickButton(b: RowButton<Task>, e: Task) {
    b.click!(e)
  }

  edit(e: Task) {
    e.openEditDialog(this.dialog, () => this.refresh())
  }
  isFull(e: Task) {
    return e.driverId != ''
  }

  distance(e: Task) {
    if (!this.volunteerLocation) return undefined
    return (
      GetDistanceBetween(
        this.volunteerLocation,
        getLocation(e.addressApiResult)
      ).toFixed(1) +
      ' ' +
      'ק"מ'
    )
  }
  volunteerLocation?: Location
  async sortByDistance() {
    try {
      if (!this.volunteerLocation)
        this.volunteerLocation = await getCurrentLocation(true, this.dialog)
      else this.volunteerLocation = undefined
      this.sortEvents()
    } catch {}
  }
  isRegisteredToEvent(task: Task) {
    return task.driverId === remult.user?.id
  }
  eventCity(e: Task) {
    return getCity(e.addressApiResult?.results?.[0]?.address_components!)
  }
  eventToCity(e: Task) {
    return getCity(e.toAddressApiResult?.results?.[0]?.address_components!)
  }
  travelDistance(e: Task) {
    return (
      GetDistanceBetween(
        getLocation(e.addressApiResult),
        getLocation(e.toAddressApiResult)
      ).toFixed(1) +
      ' ' +
      'ק"מ'
    )
  }
  sortEvents() {
    if (!this.volunteerLocation)
      this.dates.forEach((d) => d.events.sort((a, b) => compareEventDate(a, b)))
    else
      this.dates.forEach((d) =>
        d.events.sort(
          (a, b) =>
            GetDistanceBetween(
              this.volunteerLocation!,
              getLocation(a.addressApiResult)
            ) -
            GetDistanceBetween(
              this.volunteerLocation!,
              getLocation(b.addressApiResult)
            )
        )
      )
  }
}

function compareEventDate(a: Task, b: Task) {
  let r = a.eventDate.valueOf() - b.eventDate.valueOf()

  if (r != 0) return r
  return (a.createdAt?.valueOf() || 0) - (b.createdAt?.valueOf() || 0)
}

interface dateEvents {
  date: string
  events: Task[]
}
