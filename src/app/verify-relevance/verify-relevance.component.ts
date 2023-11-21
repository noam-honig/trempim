import { Component, OnInit } from '@angular/core'
import { BusyService } from '../common-ui-elements'
import { UIToolsService } from '../common/UIToolsService'
import { tripsGrid } from '../events/tripsGrid'
import { UpdatesService } from '../updates/updates.component'
import { taskStatus } from '../events/taskStatus'
import { getSite } from '../users/sites'

@Component({
  selector: 'app-verify-relevance',
  templateUrl: './verify-relevance.component.html',
  styleUrls: ['./verify-relevance.component.scss'],
})
export class VerifyRelevanceComponent implements OnInit {
  constructor(
    private updates: UpdatesService,
    private ui: UIToolsService,
    private busy: BusyService
  ) {}

  ngOnInit(): void {}
  tripGrid = tripsGrid({
    ui: this.ui,
    busy: this.busy,
    where: {
      taskStatus: taskStatus.relevanceCheck,
      $and: [getSite().tasksFilter()],
    },

    orderBy: {
      statusChangeDate: 'desc',
    },
  })
}
