import { Component, OnInit } from '@angular/core'
//import { addresses } from '../../../tmp/addresses'

@Component({
  selector: 'app-noam-test',
  templateUrl: './noam-test.component.html',
  styleUrls: ['./noam-test.component.scss'],
})
export class NoamTestComponent implements OnInit {
  constructor() {}
  addresses: any[] = []
  ngOnInit(): void {}
}
