import { AreaFilterInfo, EventCardComponent } from './event-card.component'
import '../../server/server-session'
import { Task } from '../events/tasks'
import { GeocodeResult } from '../common/address-input/google-api-helpers'

function createGeo(region: string, district: string): GeocodeResult | null {
  return {
    results: [
      {
        geometry: { location: { lat: 0, lng: 0 } },
        address_components: [
          {
            long_name: region,
            short_name: region,
            types: ['administrative_area_level_1'],
          },
        ],
      },
    ],
    status: 'ok',
    district,
  }
}
describe('event-card', () => {
  it('should filter regions correctly', () => {
    const comp = new EventCardComponent({} as any)
    const tasks = [
      ['s', 'n'],
      ['s', 's'],
      ['n', 's'],
      ['n', 'c'],
    ].map(([from, to]) => {
      let t = new Task()
      t.title = from + '-' + to
      t.addressApiResult = createGeo(from, from)
      t.toAddressApiResult = createGeo(to, to)
      return t
    })
    comp.tasks = tasks
    comp.refreshFilters(false)
    expect(toCompare(comp.regions)).toEqual(
      `,4
n,3
s,3
c,1`
    )
    expect(toCompare(comp.toRegions)).toEqual(
      `,4
n,3
s,3
c,1`
    )
    comp.region = 's'
    comp.refreshFilters(false)
    expect(comp.filteredTasks.length).toBe(3)
    expect(
      comp.filteredTasks
        .filter((x) => comp.onTheWayBack(x))
        .map((x) => x.title)
        .join(',')
    ).toEqual('n-s')
    expect(toCompare(comp.regions)).toEqual(
      `,4
n,3
s,3
c,1`
    )
    expect(toCompare(comp.toRegions)).toEqual(
      `,3
n,2
s,1`
    )
    comp.region = ''
    comp.toRegion = 's'
    comp.refreshFilters(false)
    expect(comp.filteredTasks.length).toBe(3)
    expect(
      comp.filteredTasks
        .filter((x) => comp.onTheWayBack(x))
        .map((x) => x.title)
        .join(',')
    ).toEqual('s-n')
    expect(toCompare(comp.toRegions)).toEqual(
      `,4
n,3
s,3
c,1`
    )
    expect(toCompare(comp.regions)).toEqual(
      `,3
n,2
s,1`
    )
    comp.region = 'n'
    comp.refreshFilters(false)
    expect(comp.filteredTasks.length).toBe(2)

    expect(toCompare(comp.regions)).toEqual(
      `,3
n,2
s,1`
    )
    expect(toCompare(comp.toRegions)).toEqual(
      `,3
s,2
c,1`
    )
  })
  it('should filter regions correctly with district', () => {
    const comp = new EventCardComponent({} as any)
    const tasks = [
      ['sa', 'na'],
      ['sa', 'sb'],
      ['sb', 'sb'],
      ['na', 'sb'],
      ['nb', 'cc'],
    ].map(([from, to]) => {
      let t = new Task()
      t.title = from + '-' + to
      t.addressApiResult = createGeo(from[0], from)
      t.toAddressApiResult = createGeo(to[0], to)
      return t
    })
    comp.tasks = tasks
    comp.refreshFilters(false)
    expect(comp.filteredTasks.length).toBe(5)
    expect(toCompare(comp.regions)).toMatch(
      `,5
s,4
 - sb,3
 - sa,2
n,3
 - na,2
 - nb,1
c,1`
    )
    expect(toCompare(comp.toRegions)).toMatch(
      `,5
s,4
 - sb,3
 - sa,2
n,3
 - na,2
 - nb,1
c,1`
    )
  })
})
function toCompare(regions: AreaFilterInfo[]): ArrayLike<string> {
  return regions.map((x) => `${x.id},${x.count}`).join('\n')
}
