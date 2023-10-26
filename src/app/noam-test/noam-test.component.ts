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
  Location,
  getAddress,
  getLocation,
} from '../common/address-input/google-api-helpers'
import { taskStatus } from '../events/taskStatus'
import { EventCardComponent } from '../event-card/event-card.component'
import { EventInfoComponent } from '../event-info/event-info.component'
//import { addresses } from '../../../tmp/addresses'

const lineSymbol = {
  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
}
@Component({
  selector: 'app-noam-test',
  templateUrl: './noam-test.component.html',
  styleUrls: ['./noam-test.component.scss'],
})
export class NoamTestComponent implements OnInit {
  loadedPotentialFamilies: string[] = []

  _tasks: Task[] = []
  @Input()
  set tasks(value: Task[]) {
    this._tasks = value
    this.clear()
    this.loadIt()
  }
  @Output() tasksClicked = new EventEmitter<string[]>()

  lines: google.maps.Polyline[] = []
  clearLines() {
    this.lines.forEach((x) => x.setMap(null))
    this.lines = []
  }
  userClickedOnFamilyOnMap: (familyId: string[]) => void = () => {}
  setFamilyOnMap(
    familyId: string,
    startLocation: Location,
    endLocation: Location
  ) {
    const createMarker = (position: Location, icon: string) => {
      let marker = new google.maps.Marker({
        map: this.map,
        position,
        icon,
      })

      google.maps.event.addListener(marker, 'click', async () => {
        // this.disableMapBoundsRefresh++
        let taskIds: string[] = []

        this.dict.forEach((m, id) => {
          if (m.start.getMap() != null) {
            let start = m.start.getPosition()!
            let end = m.end.getPosition()!
            let p3 = marker.getPosition()!

            if (
              (end.lng() == p3.lng() && end.lat() == p3.lat()) ||
              (start.lng() == p3.lng() && start.lat() == p3.lat())
            ) {
              taskIds.push(id!)
            }
          }
        })
        if (taskIds.length > 0) {
          this.tasksClicked.next(taskIds)
          let tasks = this._tasks.filter((t) => taskIds.includes(t.id))
          this.adjustBounds(tasks)
          this.clearLines()
          for (const t of tasks) {
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
                // strokeColor: 'gray',
                // strokeWeight: 2,
                map: this.map,
              })
            )
          }
          if (tasks.length > 1) {
            openDialog(EventCardComponent, (x) => {
              let f = this._tasks.find((x) => x.id == familyId)!

              x.tasks = tasks
              x.title = position === startLocation ? f.address : f.toAddress
            })
          } else if (tasks.length == 1) {
            openDialog(EventInfoComponent, (x) => (x.e = tasks[0]))
          }
        }

        setTimeout(() => {
          //  this.disableMapBoundsRefresh--
        }, 10000)
      })
      return marker
    }

    let info = this.dict.get(familyId)
    if (info && info.start.getMap() == null) info = undefined
    if (!info) {
      let start = createMarker(
        startLocation,
        'https://maps.google.com/mapfiles/ms/micons/yellow-dot.png'
      )
      let end = createMarker(
        endLocation,
        'https://maps.google.com/mapfiles/ms/micons/red-dot.png'
      )
      this.dict.set(familyId, { start, end })
    }
    return info
  }
  dict = new Map<
    string,
    { start: google.maps.Marker; end: google.maps.Marker }
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
      const start = getLocation(t.addressApiResult!),
        end = getLocation(t.toAddressApiResult!)
      this.setFamilyOnMap(t.id, start, end)
    }
    this.adjustBounds(this._tasks)
  }
  adjustBounds(tasks: Task[]) {
    this.bounds = new google.maps.LatLngBounds()
    for (const t of tasks) {
      const start = getLocation(t.addressApiResult!),
        end = getLocation(t.toAddressApiResult!)
      this.setFamilyOnMap(t.id, start, end)
      if (this.israel.contains(start)) this.bounds.extend(start)
      if (this.israel.contains(end)) this.bounds.extend(end)
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
      m.start.setMap(null)
      m.end.setMap(null)
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
      }
      this.map = new google.maps.Map(this.gmapElement.nativeElement, mapProp)
      this.mapInit = true
    }
  }
}
