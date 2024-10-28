import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core'
import { BusyService, openDialog } from '../common-ui-elements'
import { UIToolsService } from '../common/UIToolsService'
import { repo } from 'remult'
import { Task } from '../events/tasks'
import {
  EMPTY_LOCATION,
  Location,
  getAddress,
  getCity,
  getLocation,
} from '../common/address-input/google-api-helpers'
import { taskStatus } from '../events/taskStatus'
import { EventCardComponent } from '../event-card/event-card.component'
import { EventInfoComponent } from '../event-info/event-info.component'
//import { addresses } from '../../../tmp/addresses'

const lineSymbol = {
  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
}
function pin(start: boolean, selected?: boolean) {
  //https://kml4earth.appspot.com/icons.html
  if (!start) return '/assets/finish.png'
  return `https://maps.google.com/mapfiles/ms/micons/${
    start ? 'yellow' : 'red'
  }${selected ? '-dot' : ''}.png`
}
@Component({
  selector: 'app-noam-test',
  templateUrl: './noam-test.component.html',
  styleUrls: ['./noam-test.component.scss'],
})
export class NoamTestComponent implements OnInit {
  loadedPotentialFamilies: string[] = []

  _tasks: Task[] = []
  @Input() singleTrip = false
  @Input()
  set tasks(value: Task[]) {
    this._tasks = value
    this.clear()
    this.loadIt()
  }
  start?: google.maps.Marker
  end?: google.maps.Marker
  @Input()
  set startLocation(x: Location | undefined | null) {
    if (x) {
      if (!this.start)
        this.start = new google.maps.Marker({
          icon: 'http://maps.google.com/mapfiles/kml/paddle/go-lv.png',
          map: this.map,
        })
      this.start.setPosition(x)
    } else this.start?.setMap(null)
  }

  @Input()
  set endLocation(x: Location | undefined | null) {
    if (x) {
      if (!this.end)
        this.end = new google.maps.Marker({
          icon: 'http://maps.google.com/mapfiles/kml/paddle/grn-square-lv.png',
          map: this.map,
        })
      this.end.setPosition(x)
    } else this.end?.setMap(null)
  }

  @Output() tasksClicked = new EventEmitter<string[]>()

  lines: google.maps.Polyline[] = []
  selectedTasks?: Task[]
  clearLines() {
    this.lines.forEach((x) => x.setMap(null))
    for (const task of this.selectedTasks || []) {
      let item = this.dict.get(task.id)
      if (item) {
        item.start?.setIcon(pin(true))
        item.end?.setIcon(pin(false))
      }
    }
    this.selectedTasks = undefined
    this.lines = []
  }
  userClickedOnFamilyOnMap: (familyId: string[]) => void = () => {}
  setFamilyOnMap(task: Task) {
    const createMarker = (position: Location, icon: string) => {
      if (!position || position === EMPTY_LOCATION) return
      let marker = new google.maps.Marker({
        map: this.map,
        position,
        icon,
      })
      if (!this.singleTrip)
        google.maps.event.addListener(marker, 'click', async () => {
          // this.disableMapBoundsRefresh++
          let taskIds: string[] = []

          this.dict.forEach((m, id) => {
            if (m.start?.getMap() != null || m.end?.getMap() != null) {
              let start = m.start?.getPosition()
              let end = m.end?.getPosition()
              let p3 = marker?.getPosition()

              if (
                (end?.lng() == p3?.lng() && end?.lat() == p3?.lat()) ||
                (start?.lng() == p3?.lng() && start?.lat() == p3?.lat())
              ) {
                taskIds.push(id!)
                m.start?.setIcon(pin(true, true))
                m.end?.setIcon(pin(false, true))
              }
            }
          })
          if (taskIds.length > 0) {
            this.tasksClicked.next(taskIds)
            let tasks = this._tasks.filter((t) => taskIds.includes(t.id))
            this.adjustBounds(tasks)
            this.clearLines()
            for (const t of tasks) {
              if (
                t.toAddressApiResult?.results?.length &&
                t.addressApiResult?.results?.length
              )
                this.lines.push(
                  new google.maps.Polyline({
                    path: [
                      getLocation(t.addressApiResult),
                      getLocation(t.toAddressApiResult),
                    ],
                    icons: [
                      {
                        icon: lineSymbol,
                        offset: '100%',
                      },
                    ],
                    // strokeColor: t.isDrive ? 'yellow' : 'gray',
                    // strokeWeight: 2,
                    map: this.map,
                  })
                )
            }
            this.selectedTasks = tasks
          }

          setTimeout(() => {
            //  this.disableMapBoundsRefresh--
          }, 10000)
        })
      return marker
    }

    let info = this.dict.get(task.id)
    if (info && info.start?.getMap() == null && info.end?.getMap() == null)
      info = undefined
    if (!info) {
      let start = createMarker(getLocation(task.addressApiResult), pin(true))
      let end = createMarker(getLocation(task.toAddressApiResult), pin(false))

      let line =
        start && end && this._tasks?.length <= 10
          ? new google.maps.Polyline({
              path: [start?.getPosition()!, end?.getPosition()!],
              icons: [
                {
                  icon: lineSymbol,
                  offset: '100%',
                },
              ],
              strokeColor: task.isDrive ? 'yellow' : 'gray',
              strokeWeight: 2,
              map: this.map,
            })
          : undefined
      this.dict.set(task.id, { start, end, line })
    }
    return info
  }
  dict = new Map<
    string,
    {
      start?: google.maps.Marker
      end?: google.maps.Marker
      line?: google.maps.Polyline
    }
  >()
  disableMapBoundsRefresh = 0
  constructor(
    private busy: BusyService,

    private dialog: UIToolsService
  ) {
    this.mediaMatcher.addListener((mql) => {
      if (mql.matches) {
        let x = this.gmapElement.nativeElement.offsetWidth
        // console.log(this.map.getBounds(), this.bounds, x, this.gmapElement.nativeElement.offsetWidth);
        this.fitBounds()
      }
    })
  }
  ngOnDestroy(): void {
    this.clear()
  }
  private mediaMatcher: MediaQueryList = matchMedia('print')
  async ngOnInit() {
    this.initMap()
    this.loadIt()
  }
  israel = new google.maps.LatLngBounds(
    { lng: 34.2654333839, lat: 29.5013261988 },
    { lng: 35.8363969256, lat: 33.2774264593 }
  )
  async loadIt() {
    this.bounds = new google.maps.LatLngBounds()
    for (const t of this._tasks) {
      this.setFamilyOnMap(t)
    }
    this.adjustBounds(this._tasks)
  }
  adjustBounds(tasks: Task[]) {
    this.bounds = new google.maps.LatLngBounds()
    const extend = (m?: google.maps.Marker) => {
      if (m) this.bounds.extend(m.getPosition()!)
    }
    for (const t of tasks) {
      this.setFamilyOnMap(t)
      const p = this.dict.get(t.id)
      extend(p?.start)
      extend(p?.end)
    }
    this.fitBounds()
  }

  stam = ''
  center!: google.maps.LatLng

  fitBounds() {
    if (this.disableMapBoundsRefresh) return
    if (!this.map) return
    let x = JSON.stringify(this.bounds.toJSON())
    if (x == this.lastBounds) return
    this.lastBounds = x

    setTimeout(() => {
      if (this.map && this.bounds.isEmpty()) {
        this.map.setCenter(this.center)
      } else {
        this.map.fitBounds(this.bounds)
      }
      if (this.map.getZoom() > 17) this.map.setZoom(17)
    }, 100)
  }
  clear() {
    this.clearLines()
    this.dict.forEach((m) => {
      m.start?.setMap(null)
      m.end?.setMap(null)
      m.line?.setMap(null)
    })
    this.dict.clear()
  }

  mapInit = false
  markers: google.maps.Marker[] = []
  hasFamilies = false
  bounds: google.maps.LatLngBounds = new google.maps.LatLngBounds()
  lastBounds!: string

  helperMarkers: google.maps.Marker[] = []

  @ViewChild('gmap', { static: true }) gmapElement: any
  map!: google.maps.Map

  private initMap() {
    if (!this.mapInit) {
      if (!this.center) {
        this.center = new google.maps.LatLng(32.087265, 34.797266)
      }
      var mapProp: google.maps.MapOptions = {
        center: this.center,
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: true,
        fullscreenControl: true,
      }
      this.map = new google.maps.Map(this.gmapElement.nativeElement, mapProp)
      this.start?.setMap(this.map)
      this.end?.setMap(this.map)
      this.mapInit = true
    }
  }
}
