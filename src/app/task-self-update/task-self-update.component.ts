import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { remult, repo } from 'remult'
import { Task } from '../events/tasks'

@Component({
  selector: 'app-task-self-update',
  templateUrl: './task-self-update.component.html',
  styleUrls: ['./task-self-update.component.scss'],
})
export class TaskSelfUpdateComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  status = 0
  result = ''
  tripId = ''
  r?: Task
  ngOnInit(): void {
    this.route.paramMap.subscribe(async (param) => {
      this.tripId = param.get('id')!

      this.r = repo(Task).fromJson(
        await Task.getTaskSelfUpdateInfo(this.tripId)
      )
    })
  }
  async updateRelevance() {
    this.result = await Task.SelfUpdateStatus(this.tripId, this.status)
  }
}
