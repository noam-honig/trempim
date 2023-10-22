import { FieldRef } from 'remult'
import { GeocodeResult, Location } from './address-input/google-api-helpers'
import {
  DataAreaFieldsSetting,
  GridSettings,
  RowButton,
} from '../common-ui-elements/interfaces'
import type { User } from '../users/user'

export interface UITools {
  yesNoQuestion: (question: string) => Promise<boolean>
  info: (info: string) => void
  error: (err: any) => void
  gridDialog(args: GridDialogArgs): Promise<void>
  areaDialog(args: AreaDialogArgs): Promise<void>
  showUserInfo(args: {
    userId?: string
    user?: User
    title: string
  }): Promise<void>
  selectValuesDialog<
    T extends {
      caption?: string
    }
  >(args: {
    values: T[]
    onSelect: (selected: T) => void
    title?: string
  }): Promise<void>
  selectUser(args: {
    onSelect: (selected: User) => void
    onCancel?: () => void
  }): Promise<void>
}

export interface customInputOptions<entityType> {
  inputAddress(
    onSelect?: (result: InputAddressResult, entityInstance: entityType) => void
  ): void
  textarea(): void
  image(): void
}

declare module 'remult' {
  // Adding options to the remult's Field Options interface
  export interface FieldOptions<entityType, valueType> {
    clickWithUI?: (
      ui: UITools,
      entity: entityType,
      fieldRef: FieldRef<valueType>
    ) => void
    customInput?: (inputOptions: customInputOptions<entityType>) => void
  }
}

export interface InputAddressResult {
  addressByGoogle: string
  location: Location
  autoCompleteResult: GeocodeResult
}

export interface GridDialogArgs {
  title: string
  settings: GridSettings<any>
  ok?: () => void
  cancel?: () => void
  validate?: () => Promise<void>
  buttons?: button[]
}
export interface button {
  text: string
  click: (close: () => void) => void
  visible?: () => boolean
}
export interface AreaDialogArgs {
  title?: string
  helpText?: string
  fields: DataAreaFieldsSetting<any>[]
  ok: () => void
  cancel?: () => void
  validate?: () => Promise<void>
  buttons?: button[]
}
