import { Component, OnInit } from '@angular/core'
import { advertizeForDrivers, getSite } from '../users/sites'

@Component({
  selector: 'app-more-orgs',
  templateUrl: './more-orgs.component.html',
  styleUrls: ['./more-orgs.component.scss'],
})
export class MoreOrgsComponent implements OnInit {
  constructor() {}

  orgs = advertizeForDrivers.filter((x) => x !== getSite())

  ngOnInit(): void {}
}
