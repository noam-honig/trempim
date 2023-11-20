import { Component, OnInit } from '@angular/core'
import { OverviewController, TopDriver } from './overview.controller'
import {
  ApexAxisChartSeries,
  ApexTitleSubtitle,
  ApexDataLabels,
  ApexFill,
  ApexMarkers,
  ApexYAxis,
  ApexXAxis,
  ApexTooltip,
  ApexStroke,
} from 'ng-apexcharts'
import { Fields, ValueConverters, getFields, remult } from 'remult'
import { Roles } from '../users/roles'
import { DataAreaSettings } from '../common-ui-elements/interfaces'

let today = new Date()

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss'],
})
export class OverviewComponent implements OnInit {
  topDrivers: TopDriver[] = []

  periodOptions: dateRange[] = [
    {
      caption: 'היום',

      from: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
    },
    {
      caption: 'אתמול',

      from: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 1
      ),
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    },
    {
      caption: 'השבוע',

      from: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - today.getDay()
      ),
      to: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - today.getDay() + 7
      ),
    },
    {
      caption: 'השבוע שעבר',

      from: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - today.getDay() - 7
      ),
      to: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - today.getDay()
      ),
    },
    {
      caption: 'החודש',

      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 1),
    },
    {
      caption: 'חודש שעבר',

      from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      to: new Date(today.getFullYear(), today.getMonth(), 1),
    },
    {
      caption: 'השנה',

      from: new Date(today.getFullYear(), 0, 1),
      to: new Date(today.getFullYear() + 1, 0, 1),
    },
    {
      caption: 'שנה שעברה',

      from: new Date(today.getFullYear() - 1, 0, 1),
      to: new Date(today.getFullYear(), 0, 1),
    },
    {
      caption: 'אי פעם',
      from: new Date(2017, 0, 1),
      to: new Date(today.getFullYear() + 1, 0, 1),
    },
  ]

  @Fields.string({ caption: 'תקופה' })
  period = 'השבוע'
  area!: DataAreaSettings
  @Fields.boolean({ caption: 'מדד' })
  showKm = false

  get $() {
    return getFields(this)
  }

  ngOnInit(): void {
    this.area = new DataAreaSettings({
      fields: () => [
        [
          {
            field: this.$.period,
            valueList: this.periodOptions.map((x) => x.caption),
            valueChange: () => this.refreshTopDrivers(),
          },
          {
            field: this.$.showKm,
            caption: 'לפי ק"מ',
            valueChange: () => this.refreshTopDrivers(),
          },
        ],
      ],
    })
    this.refreshTopDrivers()
    OverviewController.getOverview().then((data) => {
      let orgs = new Map<string, Map<string, dataPoint>>()

      function add(name: string, date: string, args: dataPoint) {
        let org = orgs.get(name)
        if (!org) {
          orgs.set(name, (org = new Map()))
        }
        let item = org.get(date)
        if (!item) {
          org.set(date, args)
        } else {
          item.drivers += args.drivers
          item.rides += args.rides
        }
      }

      for (const item of data) {
        if (remult.isAllowed(Roles.superAdmin))
          add('סה"כ', item.date, {
            rides: +item.rides,
            drivers: +item.drivers,
          })
        add(item.org, item.date, {
          rides: +item.rides,
          drivers: +item.drivers,
        })
      }
      for (const org of orgs) {
        this.stats.push({
          name: org[0],
          total: [...org[1]].reduce((t, x) => t + x[1].rides, 0),
          //@ts-ignore
          chart: {
            chart: {
              id: org[0],
              group: 'social',
              type: 'line',
              height: 160,
            },
            title: { text: org[0] },
            colors: ['#00E396', '#008FFB'],
            yaxis: {
              tickAmount: 2,
              labels: {
                minWidth: 40,
              },
            },
            series: [
              {
                name: 'נסיעות',
                data: [...org[1]].map((item) => ({
                  y: item[1].rides,
                  x: new Date(item[0]).valueOf(),
                })),
              },
              {
                name: 'נהגים',
                data: [...org[1]].map((item) => ({
                  y: item[1].drivers,
                  x: new Date(item[0]).valueOf(),
                })),
              },
            ],
          },
        })
      }
      this.stats.sort((a, b) => b.total - a.total)
    })
  }

  async refreshTopDrivers() {
    var x = this.periodOptions.find((x) => x.caption == this.period)!
    this.topDrivers = await OverviewController.topDrivers(
      ValueConverters.DateOnly.toJson!(x.from),
      ValueConverters.DateOnly.toJson!(x.to),
      false
    )
  }

  stats: {
    name: string
    chart: ChartOptions
    total: number
  }[] = []

  //@ts-ignore
  public commonOptions: ChartOptions = {
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'straight',
    },
    toolbar: {
      tools: {
        selection: false,
      },
    },
    markers: {
      size: 6,
      hover: {
        size: 10,
      },
    },
    tooltip: {
      followCursor: false,
      theme: 'dark',
      x: {
        show: false,
      },
      marker: {
        show: false,
      },
      y: {
        title: {
          formatter: function (series) {
            return series + ': '
          },
        },
      },
    },
    grid: {
      clipMarkers: false,
    },
    xaxis: {
      type: 'datetime',
    },
  }

  constructor() {}
}

export type ChartOptions = {
  series: ApexAxisChartSeries
  chart: any //ApexChart;
  dataLabels: ApexDataLabels
  markers: ApexMarkers
  title: ApexTitleSubtitle
  fill: ApexFill
  yaxis: ApexYAxis
  xaxis: ApexXAxis
  tooltip: ApexTooltip
  stroke: ApexStroke
  grid: any //ApexGrid;
  colors: any
  toolbar: any
}
type dataPoint = { rides: number; drivers: number }
export interface dateRange {
  caption: string
  from: Date
  to: Date
}
