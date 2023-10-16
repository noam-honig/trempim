import fs from 'fs'
import { GeocodeResult } from '../app/common/address-input/google-api-helpers'
export async function analyzeAddresses() {
  const cacheObject = JSON.parse(fs.readFileSync('./tmp/cache.json').toString())
  const addresses: {
    address: string
    api: GeocodeResult
  }[] = []
  for (const key in cacheObject) {
    if (Object.prototype.hasOwnProperty.call(cacheObject, key)) {
      const element: GeocodeResult = cacheObject[key]
      addresses.push({ address: key, api: element })
    }
  }
  fs.writeFileSync('./tmp/addresses.json', JSON.stringify(addresses))
}
