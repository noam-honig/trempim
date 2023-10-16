import { Component, OnInit } from '@angular/core'

@Component({
  selector: 'app-location-error',
  templateUrl: './location-error.component.html',
  styleUrls: ['./location-error.component.scss'],
})
export class LocationErrorComponent implements OnInit {
  constructor() {}
  args!: { err: string }
  ngOnInit(): void {}
}
