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
import { remult } from 'remult'
import { Roles } from '../users/roles'

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss'],
})
export class OverviewComponent implements OnInit {
  topDrivers: TopDriver[] = []
  ngOnInit(): void {
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
    this.topDrivers = await OverviewController.topDrivers(
      '2023-01-01',
      '2024-01-01',
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
