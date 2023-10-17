import { Component, Input, OnInit } from '@angular/core'
import { RowButton } from '../common-ui-elements/interfaces'

@Component({
  selector: 'app-dots-menu',
  template: `
    <button mat-icon-button [matMenuTriggerFor]="menu">
      <mat-icon>more_vert</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      <ng-container *ngFor="let b of buttons">
        <button
          mat-menu-item
          *ngIf="b.visible === undefined || b.visible(item)"
          (click)="b.click!(item)"
        >
          <mat-icon *ngIf="!b.icon?.includes('/')">{{ b.icon }}</mat-icon>
          <img
            [src]="b.icon"
            *ngIf="b.icon?.includes('/')"
            style="height: 24px; margin-left: 16px; vertical-align: middle"
          />

          <span>{{ getButtonName(b) }}</span>
        </button>
      </ng-container>
    </mat-menu>
  `,
})
export class DotsMenuComponent implements OnInit {
  constructor() {}
  @Input() buttons!: RowButton<any>[]
  @Input() item: any
  ngOnInit(): void {}
  getButtonName(b: RowButton<any>) {
    if (b.textInMenu) {
      if (typeof b.textInMenu === 'function') return b.textInMenu(this.item)
      return b.textInMenu
    }
    return b.name
  }
}
