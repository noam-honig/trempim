import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { remult, repo } from 'remult'
import { Task } from '../events/tasks'

@Component({
  selector: 'app-show-public-event',
  templateUrl: './show-public-event.component.html',
  styleUrls: ['./show-public-event.component.scss'],
})
export class ShowPublicEventComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}
  r?: Task
  ngOnInit(): void {
    this.route.paramMap.subscribe(async (param) => {
      const tripId = param.get('id')!
      if (remult.authenticated()) {
        this.router.navigate(['/t', tripId])
      } else {
        this.r = repo(Task).fromJson(await Task.getPublicTaskInfo(tripId))
      }
    })
  }
}
