export async function gql(variables: any, s: string, authorization?: string) {
  const fetch = await import('node-fetch')
  if (!authorization) authorization = process.env['MONDAY_API_TOKEN']!
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
    console.error(
      'monday error response',
      variables,
      JSON.stringify(data, undefined, 2)
    )
    throw data || result.statusText
  }
  return data.data
}

export interface MondayItem {
  id: string
  name: string
  column_values: {
    id: string
    title: string
    value: string
  }[]
  subitems: any[]
}

export async function update(
  board: number,
  id: number,
  column_id: string,
  value: any
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
}
     `
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
