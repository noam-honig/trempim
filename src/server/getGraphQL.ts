import { api } from './api'

export async function gql(variables: any, s: string, authorization?: string) {
  const fetch = await import('node-fetch')
  if (!authorization) authorization = process.env['MONDAY_API_TOKEN']!
  while (true) {
    const result = await fetch.default('https://api.monday.com/v2', {
      body: JSON.stringify({
        query: s,
        variables: variables,
      }),
      method: 'POST',
      headers: {
        authorization,
        'API-Version': '2023-10',
        'content-type': 'application/json',
      },
    })

    let data: any
    try {
      data = await result.json()
    } catch (err) {}
    if (!result.ok || data.errors || data.error_code) {
      const regex = /reset in (\d+) seconds/
      const seconds = data.error_message.match(regex)?.[1]
      if (seconds) {
        console.log('monday error, waiting', seconds, 'seconds')
        await new Promise((res) => setTimeout(res, +seconds * 1000))
        continue
      }
      console.error(
        'monday error response',
        variables,
        JSON.stringify(data, undefined, 2)
      )
      throw data || result.statusText
    }
    return data.data
  }
}

export interface MondayItem {
  id: string
  name: string
  column_values: {
    id: string
    title: string
    value: string
    text: string
  }[]
  subitems: any[]
}

export async function update(
  board: number,
  id: number,
  column_id: string,
  value: any,
  apiKey?: string
) {
  const values = { id: +id, value: JSON.stringify(value), board, column_id }
  try {
    const result = await gql(
      values,
      `#graphql
  mutation ($id: ID!,$value:JSON!,$board:ID!,$column_id:String!) {
change_column_value(
 item_id:$id
 column_id:$column_id,
 board_id:$board,
 value:$value
) {
 id
name,
column_values(ids:[$column_id]){
  id
  text
  value
}
}
complexity{
    after
  query
    reset_in_x_seconds
  }
}
     `,
      apiKey
    )
    if (true) {
      var z = undefined
      if (result?.change_column_value) {
        z = { ...result.change_column_value }
        delete z.column_values
      }
      console.log({
        values,
        result: z,
        column_values: result?.change_column_value?.column_values,
        comp: result?.complexity,
      })
      return result?.change_column_value
    }
  } catch (err: any) {
    console.error({
      error: values,
      err,
    })
    return {
      error: err.message,
    }
  }
}

export function get(
  item: MondayItem,
  mondayColumn: string,
  useVal?: boolean
): any {
  for (const c of item.column_values) {
    if (c.id == mondayColumn) {
      let val = c.text
      if (useVal) val = JSON.parse(c.value)

      if (val) return val
    }
  }
  return ''
}

export interface MondayAddress {
  lat: string
  lng: string
  city: City
  street: Street
  address: string
  country: Country
  placeId: string
  changed_at: string
  streetNumber: StreetNumber
}

export interface City {
  long_name: string
  short_name: string
}

export interface Street {
  long_name: string
  short_name: string
}

export interface Country {
  long_name: string
  short_name: string
}

export interface StreetNumber {
  long_name: string
  short_name: string
}

export interface MondayEvent {
  event: Event
}

export interface Event {
  app: string
  type: string
  triggerTime: string
  subscriptionId: number
  userId: number
  originalTriggerUuid: any
  boardId: number
  groupId: string
  pulseId: number
  pulseName: string
  columnId: string
  columnType: string
  columnTitle: string
  value: Value
  previousValue: Value
  changedAt: number
  isTopGroup: boolean
  triggerUuid: string
}

export interface Value {
  label: Label
  post_id: any
}

export interface Label {
  index: number
  text: string
  style: Style
  is_done: boolean
}

export interface Style {
  color: string
  border: string
  var_name: string
}

export async function getMondayItem(
  board: number,
  id: number,
  apiKey: string | undefined
) {
  const monday = await gql(
    {
      board: board,
      item: id,
    },
    `#graphql
        query ($board: ID!, $item: ID!) {
          boards(ids: [$board]) {
            id
            name
            board_folder_id
            board_kind
            items_page(query_params: {ids: [$item]}) {
              items {
                id
                name
                column_values {
                  id
                  text
                  value
                }
              }
            }
          }
        }`,
    apiKey
  )
  const mondayItem = monday.boards[0].items_page.items[0] as MondayItem
  return mondayItem
}

const columnQuery = `#graphql
# API Reference: https://developer.monday.com/api-reference/docs
query {

# complexity{
#     after
#   query
#     reset_in_x_seconds
#   }
  
  boards(ids: [1322810347]) {
    name,
    columns{
      id
      title
      type
      settings_str
    }
    # items_page{
    #   items{
    #     id
    #     name
    #     column_values{
    #       id
    #       text
    #       value
    #     }
    #   }
    # }
    # Read more about Board type: https://developer.monday.com/api-reference/docs/boards
  }
  
}`
