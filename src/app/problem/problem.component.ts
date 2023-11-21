import { Component, OnInit } from '@angular/core'
import { tripsGrid } from '../events/tripsGrid'
import { taskStatus } from '../events/taskStatus'
import { BusyService } from '../common-ui-elements'
import { UIToolsService } from '../common/UIToolsService'
import { getSite } from '../users/sites'

@Component({
  selector: 'app-problem',
  templateUrl: './problem.component.html',
  styleUrls: ['./problem.component.scss'],
})
export class ProblemComponent implements OnInit {
  constructor(private ui: UIToolsService, private busy: BusyService) {}

  ngOnInit(): void {}
  tripGrid = tripsGrid({
    ui: this.ui,
    busy: this.busy,
    where: {
      taskStatus: taskStatus.otherProblem,
      $and: [getSite().tasksFilter()],
    },

    orderBy: {
      statusChangeDate: 'desc',
    },
  })
}
