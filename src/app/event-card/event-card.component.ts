import { Component, Input, OnInit } from '@angular/core'
import { Field, Fields, getFields, remult, repo } from 'remult'
import { EventInfoComponent } from '../event-info/event-info.component'
import { DataAreaSettings, RowButton } from '../common-ui-elements/interfaces'
import { BusyService, openDialog } from '../common-ui-elements'

import { UIToolsService } from '../common/UIToolsService'
import { Task, eventDisplayDate } from '../events/tasks'
import { Category } from '../events/Category'
import { taskStatus } from '../events/taskStatus'
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
import { LocationErrorComponent } from '../location-error/location-error.component'
import copy from 'copy-to-clipboard'
import { displayTime } from '../events/date-utils'

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
  constructor(private tools: UIToolsService) {}

  menuOptions: RowButton<Task>[] = Task.rowButtons(this.tools, {
    taskAdded: (t) => {
      this.tasks.push(t)
      this.refresh()
    },
    taskSaved: () => this.refresh(),
  })
  addTask() {
    const t = repo(Task).create()
    t.openEditDialog(this.tools, () => (this.tasks = [t, ...this.tasks]))
  }
  buttons: RowButton<any>[] = [
    {
      visible: () => remult.isAllowed(Roles.dispatcher),
      name: 'העתק רשימה עבור ווטסאפ',
      click: () => {
        let message = 'קריאות פתוחות'
        if (this.region) {
          message += ' מאזור ' + this.region
        }
        if (this.toRegion) {
          message += ' לאזור ' + this.toRegion
        }

        let lines = ''
        let count = 0
        let t = new Date()

        for (const u of this.urgencies) {
          for (const e of u.events) {
            if (this.filter(e) && e.taskStatus == taskStatus.active) {
              lines +=
                '* ' + e.getShortDescription() + '\n' + e.getLink() + '\n\n'
              count++
            }
          }
        }
        message +=
          ` - שעה ${t.getHours()}:${(
            t.getMinutes() / 10
          ).toFixed()}0 (${count} קריאות): \n` + lines
        if (count == 0) this.tools.error('לא נמצאו קריאות ליצוא')
        else copy(message)
      },
    },
  ]

  getStatus(e: Task) {
    if (e.taskStatus != taskStatus.active) return e.taskStatus.caption
    return ''
  }
  isDispatcher() {
    return remult.isAllowed(Roles.dispatcher)
  }
  urgencies: dateEvents[] = []
  regions: { id: string; count: number; caption: string }[] = []
  toRegions: { id: string; count: number; caption: string }[] = []
  types: { id: string; count: number; caption: string }[] = []
  trackBy(i: number, e: { id: any }): any {
    return e.id as any
  }

  @Fields.string({
    caption: 'מאיפה?',
  })
  region: string = ''
  @Fields.string({ caption: 'לאן?' })
  toRegion: string = ''
  @Field(() => Category, { caption: 'קטגוריה' })
  category = AllCategories
  area!: DataAreaSettings

  _tasks!: Task[]

  @Input()
  showingAllTasks = false
  @Input()
  set tasks(val: Task[]) {
    this._tasks = val
    this.refresh()
  }
  showLocation = false
  refresh() {
    this.urgencies = []
    this.tasks.sort((a, b) => compareEventDate(a, b))

    let firstLongLat: string | undefined

    this.regions.splice(0)
    this.toRegions.splice(0)
    this.types.splice(0)
    for (const e of this._tasks) {
      if (!firstLongLat) firstLongLat = getLongLat(e.addressApiResult)
      if (getLongLat(e.addressApiResult) != firstLongLat)
        this.showLocation = true
      let d = this.urgencies.find((d) => d.sort == e.urgency.id)
      // if (1 == 1) {
      //   if (this.urgencies.length == 0)
      //     this.urgencies.push((d = { urgency: '', events: [] }))
      //   d = this.urgencies[0]
      // }
      if (!d)
        this.urgencies.push(
          (d = {
            urgency: 'דחיפות ' + e.urgency.caption,
            events: [],
            sort: e.urgency.id,
          })
        )
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
      let toRegion = this.toRegions.find(
        (c) => c.id == getRegion(e.toAddressApiResult)
      )
      if (!toRegion) {
        this.toRegions.push({
          id: getRegion(e.toAddressApiResult),
          count: 1,
          caption: '',
        })
      } else toRegion.count++

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
    this.toRegions.sort((b, a) => a.count - b.count)
    this.toRegions.forEach((c) => (c.caption = c.id + ' - ' + c.count))
    this.toRegions.splice(0, 0, {
      id: '',
      count: this._tasks.length,
      caption: 'כל הארץ' + ' - ' + this._tasks.length,
    })

    this.types.sort((b, a) => a.count - b.count)
    this.types.forEach((c) => (c.caption = c.caption + ' - ' + c.count))

    this.types.splice(0, 0, AllCategories)

    this.urgencies = this.urgencies.filter((d) => d.events.length > 0)
    this.urgencies.sort((a, b) => b.sort - a.sort)
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
            field: this.$.toRegion,
            valueList: this.toRegions,
            visible: () => this.toRegions.length > 2,
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
      (this.toRegion == '' ||
        getRegion(e.toAddressApiResult) == this.toRegion) &&
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
    return e.displayDate()
  }

  clickButton(b: RowButton<Task>, e: Task) {
    b.click!(e)
  }

  edit(e: Task) {
    e.openEditDialog(this.tools, () => this.refresh())
  }
  isFull(e: Task) {
    return e.taskStatus !== taskStatus.active
  }

  distance(e: Task) {
    if (!this.volunteerLocation) return undefined
    return (
      ', ' +
      GetDistanceBetween(
        this.volunteerLocation,
        getLocation(e.addressApiResult)
      ).toFixed(1) +
      ' ' +
      'ק"מ ממיקום נוכחי'
    )
  }
  volunteerLocation?: Location
  async sortByDistance() {
    try {
      if (!this.volunteerLocation)
        this.volunteerLocation = await getCurrentLocation()
      else this.volunteerLocation = undefined
      this.sortEvents()
    } catch (err: any) {
      openDialog(LocationErrorComponent, (x) => (x.args = { err }))
    }
  }
  isRegisteredToEvent(task: Task) {
    return task.driverId === remult.user?.id
  }
  eventCity(e: Task) {
    return getCity(e.addressApiResult, e.address)
  }
  eventToCity(e: Task) {
    return getCity(e.toAddressApiResult, e.toAddress)
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
      this.urgencies.forEach((d) =>
        d.events.sort((a, b) => compareEventDate(a, b))
      )
    else
      this.urgencies.forEach((d) =>
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
  let startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  function fixDate(d: Date) {
    if (d.valueOf() < startOfDay.valueOf()) {
      d = new Date(d)
      d.setFullYear(d.getFullYear() + 1)
    }
    return d.valueOf()
  }
  let r = fixDate(a.eventDate) - fixDate(b.eventDate)

  if (r != 0) return r
  return b.createdAt.valueOf() - a.createdAt.valueOf()
}

interface dateEvents {
  urgency: string
  sort: number
  events: Task[]
}
