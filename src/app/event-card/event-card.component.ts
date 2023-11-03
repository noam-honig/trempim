import { Component, Input, OnInit } from '@angular/core'
import { Field, Fields, getFields, remult, repo } from 'remult'
import { EventInfoComponent } from '../event-info/event-info.component'
import { DataAreaSettings, RowButton } from '../common-ui-elements/interfaces'
import { BusyService, openDialog } from '../common-ui-elements'

import { UIToolsService } from '../common/UIToolsService'
import { Task, eventDisplayDate } from '../events/tasks'

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
  getDistrict,
  GeocodeResult,
} from '../common/address-input/google-api-helpers'
import { LocationErrorComponent } from '../location-error/location-error.component'
import copy from 'copy-to-clipboard'
import { displayTime } from '../events/date-utils'
import { DialogConfig } from '../common-ui-elements/src/angular/DialogConfig'

@DialogConfig({ maxWidth: '95vw' })
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
      this.refreshFilters(false)
    },
    taskSaved: () => this.refreshFilters(false),
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

        if (this.category) {
          message += ` (${this.category})`
        }

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
  regions: AreaFilterInfo[] = []
  toRegions: AreaFilterInfo[] = []
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
  @Fields.string({ caption: 'קטגוריה' })
  category = ''
  area!: DataAreaSettings

  _tasks!: Task[]

  @Input()
  showingAllTasks = false
  @Input()
  fromMap = false
  @Input()
  set tasks(val: Task[]) {
    this._tasks = val
    this.refreshFilters(false)
  }

  showMap = false // document.location.host.includes('localhost')
  toggleShowMap(val: boolean) {
    this.showMap = val
    this.tools.report(
      val ? 'הצג מפה' : 'הצג רשימה',
      this.showingAllTasks ? 'חיפוש נסיעה' : 'נסיעות שלי'
    )
  }
  showLocation = false
  filteredTasks: Task[] = []

  closeDialog?: VoidFunction
  isDialog() {
    return this.closeDialog !== undefined
  }

  isDev() {
    return false
    return document.location.host.includes('localhost')
  }
  title = ''
  refreshFilters(report: boolean) {
    if (report)
      this.tools.report(
        'סינון',
        JSON.stringify({
          region: this.region,
          toRegion: this.toRegion,
          category: this.category,
        })
      )

    this.filteredTasks = this.tasks.filter((x) => this.filter(x))
    this.urgencies = []
    this.tasks.sort((a, b) => compareEventDate(a, b))

    let firstLongLat: string | undefined

    this.regions.splice(0)
    this.toRegions.splice(0)
    this.types.splice(0)
    let regionStats = 0,
      toRegionStats = 0
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

      if (!this.isDev() || d.events.length < 20) d.events.push(e)
      let fromRegionName = getRegion(e.addressApiResult)
      let fromDistrictName = ' - ' + getDistrict(e.addressApiResult)
      const toRegionName = getRegion(e.toAddressApiResult)
      const toDistrictName = ' - ' + getDistrict(e.toAddressApiResult)
      //if (['5589', '5557', '5568'].includes(e.externalId)) debugger
      const addToRegionFilter = (
        regionKey: 'region' | 'toRegion',
        regions: AreaFilterInfo[]
      ) => {
        if (this.filter(e, { [regionKey]: fromRegionName })) {
          let region = this.addRegion(regions, fromRegionName)
          if (this.filter(e, { [regionKey]: fromDistrictName }))
            this.addDistrictToRegion(region, fromDistrictName)
          if (
            fromRegionName == toRegionName &&
            fromDistrictName != toDistrictName
          )
            if (this.filter(e, { [regionKey]: toDistrictName }))
              this.addDistrictToRegion(region, toDistrictName)
        }
        if (fromRegionName != toRegionName) {
          if (this.filter(e, { [regionKey]: toRegionName })) {
            let region = this.addRegion(regions, toRegionName)
            if (this.filter(e, { [regionKey]: toDistrictName }))
              this.addDistrictToRegion(region, toDistrictName)
          }
        }
      }

      //if (this.region) debugger
      if (this.filter(e, { region: '' })) {
        regionStats++
        addToRegionFilter('region', this.regions)
      }
      if (this.filter(e, { toRegion: '' })) {
        toRegionStats++
        addToRegionFilter('toRegion', this.toRegions)
      }

      if (this.filter(e, { category: '' })) {
        let type = this.types.find((c) => c.id == e.category)
        if (!type) {
          this.types.push({
            id: e.category,
            count: 1,
            caption: e.category || '',
          })
        } else type.count++
      }
    }

    const sortRegion = (regions: AreaFilterInfo[], selectedRegion: string) => {
      regions.forEach((r) => r.districts!.sort((a, b) => b.count - a.count))
      regions.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
      let x = regions.reduce(
        (result, region) => [
          ...result,
          region,
          ...(region.districts!.length > 1 ||
          selectedRegion == region.districts![0].id
            ? region.districts!
            : []),
        ],
        [] as AreaFilterInfo[]
      )
      regions.splice(0)
      regions.push(...x)
      regions.forEach((c) => (c.caption = c.id + ' - ' + c.count))
      return regions
    }
    sortRegion(this.regions, this.region)
    this.regions.splice(0, 0, {
      id: '',
      count: regionStats,
      caption: 'כל הארץ' + ' - ' + regionStats,
    })
    sortRegion(this.toRegions, this.toRegion)

    this.toRegions.splice(0, 0, {
      id: '',
      count: toRegionStats,
      caption: 'כל הארץ' + ' - ' + toRegionStats,
    })

    this.types.forEach((c) => (c.caption = c.caption + ' - ' + c.count))

    this.types.splice(0, 0, {
      id: '',
      count: this._tasks.length,
      caption: 'הכל ' + ' - ' + this.types.reduce((a, b) => a + b.count, 0),
    })

    this.urgencies = this.urgencies.filter((d) => d.events.length > 0)
    this.urgencies.sort((a, b) => b.sort - a.sort)
    this.sortEvents()
    this.area = new DataAreaSettings({
      fields: () => [
        [
          {
            field: this.$.region,
            valueList: this.regions,
            cssClass: 'region-combo',
            visible: () => this.regions.length > 2,
            valueChange: () => this.refreshFilters(true),
          },
          {
            field: this.$.toRegion,
            valueList: this.toRegions,
            cssClass: 'region-combo',
            visible: () => this.toRegions.length > 2,
            valueChange: () => this.refreshFilters(true),
          },
          {
            field: this.$.category,
            valueList: this.types,
            visible: () => this.types.length > 2,
            valueChange: () => this.refreshFilters(true),
          },
        ],
      ],
    })
  }

  private addDistrictToRegion(
    region: AreaFilterInfo,
    districtNameWithPrefix: string
  ) {
    let district = region.districts!.find((c) => c.id == districtNameWithPrefix)
    if (!district) {
      region.districts!.push({
        id: districtNameWithPrefix,
        count: 1,
        caption: '',
      })
    } else district.count++
  }

  private addRegion(regions: AreaFilterInfo[], regionName: string) {
    let region = regions.find((c) => c.id == regionName)
    if (!region) {
      regions.push(
        (region = {
          id: regionName,
          count: 1,
          caption: '',
          districts: [],
        })
      )
    } else region.count++
    return region
  }
  onTheWayBack(e: Task) {
    let fromRegionName = getRegion(e.addressApiResult)
    let fromDistrictName = ' - ' + getDistrict(e.addressApiResult)
    const toRegionName = getRegion(e.toAddressApiResult)
    const toDistrictName = ' - ' + getDistrict(e.toAddressApiResult)
    if (
      this.region &&
      this.region != fromRegionName &&
      this.region != fromDistrictName
    )
      return true
    if (
      this.toRegion &&
      this.toRegion != toRegionName &&
      this.toRegion != toDistrictName
    )
      return true
    return false
  }
  filter(
    e: Task,
    overrideSearch?: { region?: string; toRegion?: string; category?: string }
  ) {
    const search: Required<typeof overrideSearch> = {
      region: this.region,
      toRegion: this.toRegion,
      category: this.category,
      ...overrideSearch,
    }

    function filterRegion(region: string, address: GeocodeResult | null) {
      if (region == '') return true
      if (region.startsWith(' - ')) {
        return getDistrict(address) == region.substring(3)
      }
      return getRegion(address) == region
    }

    return (
      ((filterRegion(search.region, e.addressApiResult) &&
        filterRegion(search.toRegion, e.toAddressApiResult)) ||
        (filterRegion(search.region, e.toAddressApiResult) &&
          filterRegion(search.toRegion, e.addressApiResult))) &&
      (search.category == '' || e.category == search.category)
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

  ngOnInit(): void {
    if (this.isDialog() || this.fromMap) this.showMap = false
  }
  async suggestRides(e: Task) {
    if (this.region && this.toRegion) return false
    let from = getDistrict(e.addressApiResult)
    let fromFilter = from != getRegion(e.addressApiResult) ? ' - ' + from : from
    let to = getDistrict(e.toAddressApiResult)
    let toFilter = to != getRegion(e.toAddressApiResult) ? ' - ' + to : to
    const count = this.filteredTasks.filter(
      (t) =>
        this.filter(t, { region: fromFilter, toRegion: toFilter }) &&
        t.taskStatus === taskStatus.active
    ).length
    if (count) {
      let message = `ישנן עוד  ${count} נסיעות בין ${from} ל${to}  - האם להציג אותן?`
      if (count == 1)
        message = `ישנה עוד נסיעה אחת בין ${from} ל${to} - האם להציג אותה?`
      if (await this.tools.yesNoQuestion(message)) {
        this.region = fromFilter
        this.toRegion = toFilter
        this.refreshFilters(true)
        return true
      }
    }
    return false
  }
  eventDetails(e: Task) {
    openDialog(EventInfoComponent, (x) => {
      x.e = e
      x.refresh = () => this.refreshFilters(false)
      x.context = this.fromMap
        ? 'מהמפה'
        : this.showingAllTasks
        ? 'מחיפוש נסיעה'
        : 'נסיעות שלי'
      x.args = {
        closeScreenAfterAdd: async () => {
          return this.suggestRides(e)
        },
      }
    })
  }
  displayDate(e: Task) {
    return e.displayDate()
  }

  clickButton(b: RowButton<Task>, e: Task) {
    b.click!(e)
  }

  edit(e: Task) {
    e.openEditDialog(this.tools, () => this.refreshFilters(false))
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
      if (this.volunteerLocation) {
        this.tools.report(
          'מיון לפי מיקום',
          this.volunteerLocation.lng + ',' + this.volunteerLocation.lat
        )
      }
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
export interface AreaFilterInfo {
  id: string
  count: number
  caption: string
  districts?: AreaFilterInfo[]
}
