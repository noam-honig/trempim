import { MatDialogConfig } from '@angular/material/dialog'

export function DialogConfig(config: MatDialogConfig) {
  return function (target: any) {
    target[dialogConfigMember] = config
    return target
  }
}

const dialogConfigMember = Symbol('dialogConfigMember')
