import { Component, Input, OnInit } from '@angular/core'
import { Field, FieldRef, Fields, getFields, remult, repo } from 'remult'
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
import { getSite } from '../users/sites'
import { YedidimBranchListComponent } from '../yedidim-branch-list/yedidim-branch-list.component'
import { matchesCurrentUserId } from '../users/user'

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
  addDriverTask() {
    const t = repo(Task).create({isDrive: true})
    t.openEditDialog(this.tools, async () => {
      this.tasks = [t, ...this.tasks]
      if (await this.tools.yesNoQuestion('האם להעתיק הודעה לפרסום בווטסאפ?')) {
        t.copyWhatsappMessage(this.tools)
      }
    }, true)
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
        let tasks: Task[] = []

        for (const u of this.urgencies) {
          for (const e of u.events) {
            if (this.filter(e) && e.taskStatus == taskStatus.active) {
              lines +=
                '* ' + e.getShortDescription() + '\n' + e.getLink() + '\n\n'
              count++
              tasks.push(e)
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
    {
      visible: () => remult.isAllowed(Roles.dispatcher),
      name: 'הודעות לפי אזורים',
      click: () => {
        openDialog(
          YedidimBranchListComponent,
          (x) =>
            (x.args = {
              tasks: this._tasks.filter((x) => this.filter(x)),
              category: this.category,
            })
        )
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
  dates: { id: number; count: number; caption: string }[] = []
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
  @Fields.integer({ caption: 'מתי' })
  filterDate = 0
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
  async toggleShowMap(val: boolean) {
    this.showMap = val
    this.tools.report(
      val ? 'הצג מפה' : 'הצג רשימה',
      this.showingAllTasks ? 'חיפוש נסיעה' : 'נסיעות שלי'
    )
    if (!this.startLocation) {
      try {
        this.startLocation = await getCurrentLocation()
      } catch {}
    }
  }

  tasksForMap: Task[] = []

  closeDialog?: VoidFunction
  isDialog() {
    return this.closeDialog !== undefined
  }

  isDev() {
    return document.location.host.includes('localhost')
  }
  title = ''
  refreshTasksForMap() {
    this.tasksForMap = this.tasks.filter((x) => this.filter(x))
    if (this.volunteerLocation) {
      this.tasksForMap.sort(
        (a, b) => this.distanceToTask(a) - this.distanceToTask(b)
      )
      this.tasksForMap = this.tasksForMap.filter(
        (x, i) => i < 10 || this.distanceToTask(x) < 25
      )
    }
  }
  testIt() {
    if (!this.isDev()) return
    //  this.showMap = true
    this.startLocation = { lat: 32.794044, lng: 34.989571 }
    this.endLocation = { lat: 31.252973, lng: 34.791462 }
    let distance = GetDistanceBetween(this.startLocation, this.endLocation)
    this.tasksForMap = [...this.tasks.filter((x) => this.filter(x))]
    for (const task of this.tasksForMap) {
      const a = this.startLocation,
        b = this.endLocation,
        ta = getLocation(task.addressApiResult),
        tb = getLocation(task.toAddressApiResult)
      let d = 999999
      for (const route of [
        GetDistanceBetween(a, ta) +
          GetDistanceBetween(ta, tb) +
          GetDistanceBetween(tb, b),
        GetDistanceBetween(a, ta) +
          GetDistanceBetween(ta, b) +
          GetDistanceBetween(b, tb),
        GetDistanceBetween(ta, a) +
          GetDistanceBetween(a, tb) +
          GetDistanceBetween(tb, b),
        GetDistanceBetween(ta, a) +
          GetDistanceBetween(a, b) +
          GetDistanceBetween(b, tb),
      ]) {
        if (route < d) d = route
      }
      // task._delme = d / distance
      // task._delme2 = d - distance
    }

    // this.tasksForMap.sort((a, b) => a._delme - b._delme)
    this.tasksForMap = this.tasksForMap.filter((a, i) => i <= 10)
  }
  refreshFilters(report: boolean) {
    if (report)
      this.tools.report(
        'סינון',
        JSON.stringify({
          region: this.region,
          toRegion: this.toRegion,
          category: this.category,
          date: this.filterDate
            ? Math.round((this.filterDate - new Date().valueOf()) / 86400000)
            : undefined,
        })
      )
    this.refreshTasksForMap()
    this.testIt()
    this.urgencies.forEach((u) => u.events.splice(0))
    this.tasks.sort((a, b) => this.compareEventDate(a, b))

    let firstLongLat: string | undefined

    this.regions.splice(0)
    this.toRegions.splice(0)
    this.types.splice(0)
    this.dates.splice(0)
    let regionStats = 0,
      toRegionStats = 0

    const addRegion = (
      regions: AreaFilterInfo[],
      regionName: string,
      geo: GeocodeResult | null
    ) => {
      let region = regions.find((c) => c.id == regionName)
      if (!region) {
        regions.push(
          (region = {
            id: regionName,
            count: 1,
            caption: '',
            districts: [],
            location: getLocation(geo),
            distance: 0,
          })
        )
      } else region.count++
      return region
    }
    const addDistrictToRegion = (
      region: AreaFilterInfo,
      districtNameWithPrefix: string,
      geo: GeocodeResult | null
    ) => {
      let district = region.districts!.find(
        (c) => c.id == districtNameWithPrefix
      )
      if (!district) {
        region.districts!.push({
          id: districtNameWithPrefix,
          count: 1,
          caption: '',
          location: getLocation(geo),
          distance: 0,
        })
      } else district.count++
    }
    for (const e of this._tasks) {
      if (!firstLongLat) firstLongLat = getLongLat(e.addressApiResult)

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
        if (e.addressApiResult?.results?.length)
          if (this.filter(e, { [regionKey]: fromRegionName })) {
            let region = addRegion(regions, fromRegionName, e.addressApiResult)
            if (this.filter(e, { [regionKey]: fromDistrictName }))
              addDistrictToRegion(region, fromDistrictName, e.addressApiResult)
            if (
              fromRegionName == toRegionName &&
              fromDistrictName != toDistrictName
            )
              if (this.filter(e, { [regionKey]: toDistrictName }))
                addDistrictToRegion(
                  region,
                  toDistrictName,
                  e.toAddressApiResult
                )
          }
        if (fromRegionName != toRegionName) {
          if (this.filter(e, { [regionKey]: toRegionName })) {
            let region = addRegion(regions, toRegionName, e.toAddressApiResult)
            if (this.filter(e, { [regionKey]: toDistrictName }))
              addDistrictToRegion(region, toDistrictName, e.toAddressApiResult)
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
      if (this.filter(e, { date: 0 })) {
        let d = this.dates.find((c) => c.id == e.eventDate.valueOf())
        if (!d) {
          this.dates.push({
            id: e.eventDate.valueOf(),
            count: 1,
            caption: eventDisplayDate(e),
          })
        } else d.count++
      }
    }

    const finishList = (regions: AreaFilterInfo[], stats: number) => {
      regions.splice(
        0,
        0,
        {
          id: '',
          count: stats,
          distance: 0,
          location: this.volunteerLocation?.location!,
          caption: 'כל הארץ' + ' - ' + stats,
        },
        {
          id: '!',
          count: 0,
          caption: 'קרוב אלי',
          distance: 0,
          location: undefined!,
        },
        {
          id: '!!',
          count: 0,
          caption: 'קרוב לכתובת',
          distance: 0,
          location: undefined!,
        }
      )
    }
    finishList(this.regions, regionStats)
    finishList(this.toRegions, toRegionStats)

    this.types.forEach((c) => (c.caption = c.caption + ' - ' + c.count))

    this.types.splice(0, 0, {
      id: '',
      count: this._tasks.length,
      caption: 'הכל ' + ' - ' + this.types.reduce((a, b) => a + b.count, 0),
    })
    this.dates.sort((a, b) => a.id - b.id)
    this.dates.forEach((c) => (c.caption = c.caption + ' - ' + c.count))

    this.dates.splice(0, 0, {
      id: 0,
      count: this._tasks.length,
      caption: 'כל יום ' + ' - ' + this.dates.reduce((a, b) => a + b.count, 0),
    })

    this.urgencies = this.urgencies.filter((d) => d.events.length > 0)
    this.urgencies.sort((a, b) => b.sort - a.sort)
    this.sortEvents()
    this.sortRegions()
  }
  sortRegions() {
    const sortRegion = (regions: AreaFilterInfo[], selectedRegion: string) => {
      if (this.volunteerLocation) {
        regions.forEach((c) => {
          c.distance = GetDistanceBetween(
            this.volunteerLocation?.location!,
            c.location
          )
          c.districts?.forEach(
            (c) =>
              (c.distance = GetDistanceBetween(
                this.volunteerLocation?.location!,
                c.location
              ))
          )
        })
      }

      let entireCountry = regions.splice(0, 3)
      let regionsForSort = regions.filter((r) => r.districts !== undefined)

      regionsForSort.forEach((r) =>
        r.districts!.sort(
          (a, b) => a.distance - b.distance || b.count - a.count
        )
      )
      regionsForSort.sort(
        (a, b) =>
          a.districts![0].distance - b.districts![0].distance ||
          b.count - a.count ||
          a.id.localeCompare(b.id)
      )
      regionsForSort = regionsForSort.reduce(
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
      regions.push(...entireCountry)
      regions.push(...regionsForSort)
      regions
        .filter((x) => !x.id.startsWith('!'))
        .forEach((c) => (c.caption = (c.id || 'כל הארץ') + ' - ' + c.count))
      return regions
    }
    sortRegion(this.regions, this.region)
    sortRegion(this.toRegions, this.toRegion)
    this.area = new DataAreaSettings({
      fields: () => [
        [
          {
            field: this.$.region,
            valueList: this.regions,
            valueListItemCss: (v) =>
              !v.id.startsWith(' - ') ? 'region-option' : '',

            visible: () => this.regions.length > 2,
            valueChange: async () => {
              await this.regionFilterChanged(
                this.$.region,
                (t) => t.addressApiResult,
                (l) => (this.startLocation = l)
              )
            },
          },
          {
            field: this.$.toRegion,
            valueList: this.toRegions,
            valueListItemCss: (v) =>
              !v.id.startsWith(' - ') ? 'region-option' : '',
            visible: () => this.toRegions.length > 2,
            valueChange: () =>
              this.regionFilterChanged(
                this.$.toRegion,
                (t) => t.toAddressApiResult,
                (l) => (this.endLocation = l)
              ),
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

  private async regionFilterChanged(
    region: FieldRef<any, string>,
    relevantAddress: (t: Task) => GeocodeResult | null,
    setLocation: (l: Location) => void
  ) {
    const setRegionBasedOnLocation = (location: Location) => {
      setLocation(location)
      let tasks = this.tasks.filter((x) =>
        this.filter(x, { [region.metadata.key]: '' })
      )
      tasks.sort(
        (a, b) =>
          GetDistanceBetween(getLocation(relevantAddress(a)), location) -
          GetDistanceBetween(getLocation(relevantAddress(b)), location)
      )
      region.value = ' - ' + getDistrict(relevantAddress(tasks[0]))
    }
    if (region.value == '!') {
      try {
        const location = await getCurrentLocation()
        setRegionBasedOnLocation(location)
      } catch (err: any) {
        openDialog(LocationErrorComponent, (x) => (x.args = { err }))
        region.value = ''
      }
    } else if (region.value == '!!') {
      await this.selectAddress({
        ok: async (address) => {
          setRegionBasedOnLocation(address.results[0].geometry.location!)
        },
        cancel: () => {
          region.value = ''
          this.refreshFilters(true)
        },
      })
    }
    this.refreshFilters(true)
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
    overrideSearch?: {
      region?: string
      toRegion?: string
      category?: string
      date?: number
    }
  ) {
    const search: Required<typeof overrideSearch> = {
      region: this.region,
      toRegion: this.toRegion,
      category: this.category,
      date: this.filterDate,
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
        (this.region &&
          this.toRegion &&
          filterRegion(search.region, e.toAddressApiResult) &&
          filterRegion(search.toRegion, e.addressApiResult))) &&
      (search.category == '' || e.category == search.category) &&
      (search.date == 0 || search.date == e.eventDate.valueOf())
    )
  }
  hasEvents(d: dateEvents) {
    return !!d.events.find((x) => this.filter(x))
  }
  get tasks() {
    return this._tasks
  }
  get $() {
    return getFields<EventCardComponent>(this, remult)
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
    const count = this.tasks.filter(
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
    if (!remult.authenticated()) return // TODO this is probably not the best check. Rather, a sort of isGuest? where?

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
      this.distanceToTask(e).toFixed(1) +
      ' ' +
      'ק"מ ' +
      (this.volunteerLocation?.toAddress ? 'מהיעד' : 'ממיקום')
    )
  }
  distanceToTask(e: Task) {
    if (this.volunteerLocation)
      return GetDistanceBetween(
        this.volunteerLocation?.location,
        getLocation(
          e.addressApiResult?.results?.length &&
            !this.volunteerLocation.toAddress
            ? e.addressApiResult
            : e.toAddressApiResult
        )
      )
    return 0
  }
  selectAddress({
    caption,
    ok,
    cancel,
  }: {
    caption?: string
    ok: (address: GeocodeResult) => Promise<void>
    cancel: VoidFunction
  }) {
    const t = repo(Task).create()
    return this.tools.areaDialog({
      fields: [{ field: t.$.address, caption }],
      title: 'בחר כתובת',
      validate: async () => {
        if (!t.addressApiResult?.results?.[0]) throw 'לא נמצאה כתובת'
      },
      ok: () => ok(t.addressApiResult!),
      cancel,
    })
  }

  showSortOptions = false
  sortOptions = [
    {
      caption: 'תאריך',
      selected: () => {
        this.volunteerLocation = undefined
        this.sortEvents()
        this.refreshTasksForMap()
      },
    },
    {
      caption: 'קרוב אלי',
      selected: async () => {
        try {
          this.volunteerLocation = { location: await getCurrentLocation() }
          if (this.volunteerLocation) {
            this.startLocation = this.volunteerLocation.location
            this.tools.report(
              'מיון לפי מיקום',
              this.volunteerLocation.location.lng +
                ',' +
                this.volunteerLocation.location.lat
            )
          }
          this.sortEvents()
          this.refreshTasksForMap()
          this.sortRegions()
        } catch (err: any) {
          openDialog(LocationErrorComponent, (x) => (x.args = { err }))
          this.currentSort = this.sortOptions[0]
        }
      },
    },
    {
      caption: 'קרוב לכתובת',
      selected: async () => {
        this.selectAddress({
          ok: async (address) => {
            this.sortOptions.push({
              caption: 'מרחק מ' + address.results[0].formatted_address,
              selected: () => {
                this.volunteerLocation = {
                  location: address?.results[0].geometry.location!,
                }
                this.startLocation = this.volunteerLocation.location
                this.sortEvents()
                this.refreshTasksForMap()
                this.sortRegions()
                this.tools.report(
                  'מיון לפי מרחק מכתובת',
                  JSON.stringify({
                    apiResult: address,
                  })
                )
              },
            })
            this.currentSort = this.sortOptions[this.sortOptions.length - 1]
            this.currentSort.selected()
          },
          cancel: () => {
            this.currentSort = this.sortOptions[0]
            this.currentSort.selected()
          },
        })
      },
    },
    {
      caption: 'קרוב לכתובת יעד',
      selected: async () => {
        this.selectAddress({
          caption: 'כתובת יעד',
          ok: async (address) => {
            this.sortOptions.push({
              caption: 'מרחק יעד מ' + address.results[0].formatted_address,
              selected: () => {
                this.volunteerLocation = {
                  location: address?.results[0].geometry.location!,
                  toAddress: true,
                }
                this.endLocation = this.volunteerLocation.location
                this.sortEvents()
                this.refreshTasksForMap()
                this.sortRegions()
                this.tools.report(
                  'מיון לפי מרחק יעד מכתובת',
                  JSON.stringify({
                    apiResult: address,
                  })
                )
              },
            })
            this.currentSort = this.sortOptions[this.sortOptions.length - 1]
            this.currentSort.selected()
          },
          cancel: () => {
            this.currentSort = this.sortOptions[0]
            this.currentSort.selected()
          },
        })
      },
    },
  ]

  currentSort = this.sortOptions[0]
  startLocation?: Location
  endLocation?: Location
  volunteerLocation?: { location: Location; toAddress?: boolean }
  async sortByDistance() {
    this.showSortOptions = true
    this.currentSort = this.sortOptions[1]
    this.currentSort.selected()
  }
  isRegisteredToEvent(task: Task) {
    return matchesCurrentUserId(task.driverId, task.org)
  }

  compareEventDate(a: Task, b: Task) {
    let startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    function fixDate(d: Date) {
      if (d.valueOf() < startOfDay.valueOf() && getSite().sortTasksAscending) {
        d = new Date(d)
        d.setFullYear(d.getFullYear() + 1)
      }
      return d.valueOf()
    }
    return (
      (this.onTheWayBack(a) ? 1 : 0) - (this.onTheWayBack(b) ? 1 : 0) ||
      (fixDate(a.eventDate) - fixDate(b.eventDate) ||
        a.startTime.localeCompare(b.startTime) ||
        a.createdAt.valueOf() - b.createdAt.valueOf()) *
        (getSite().sortTasksAscending ? 1 : -1)
    )
  }
  sortEvents() {
    if (!this.volunteerLocation) {
      this.urgencies.forEach((d) =>
        d.events.sort((a, b) => this.compareEventDate(a, b))
      )
    } else
      this.urgencies.forEach((d) =>
        d.events.sort((a, b) => this.distanceToTask(a) - this.distanceToTask(b))
      )
  }
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
  distance: number
  location: Location
  districts?: AreaFilterInfo[]
}
