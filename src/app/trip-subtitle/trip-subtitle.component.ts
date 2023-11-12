import { Component, Input, OnInit } from '@angular/core'
import { Task } from '../events/tasks'
import {
  GetDistanceBetween,
  getCity,
  getLocation,
} from '../common/address-input/google-api-helpers'
import { taskStatus } from '../events/taskStatus'

@Component({
  selector: 'app-trip-subtitle',
  templateUrl: './trip-subtitle.component.html',
  styleUrls: ['./trip-subtitle.component.scss'],
})
export class TripSubtitleComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
  @Input() onTheWayBack = false
  @Input() distance?: string
  @Input() e!: Task

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
  eventCity(e: Task) {
    return getCity(e.addressApiResult, e.address)
  }
  eventToCity(e: Task) {
    return getCity(e.toAddressApiResult, e.toAddress)
  }
  isFull(e: Task) {
    return e.taskStatus !== taskStatus.active
  }
}
