/**
 * @jest-environment ceramic
 */

import SafeResolver, { caipToDid, createSafeDidUrl, didToCaip, SafeResolverConfig } from '../index'
import { ResolverRegistry } from 'did-resolver'
import { AccountId } from 'caip'

describe('Gnosis Safe DID Resolver', () => {
  let config: SafeResolverConfig
  let safeResolver: ResolverRegistry

  beforeAll(async () => {
    config = {
      ceramic: (global as any).ceramic,
    }

    safeResolver = SafeResolver.getResolver(config)
  })

  it('getResolver works correctly', () => {
    expect(Object.keys(safeResolver)).toEqual(['safe'])
  })

  describe('caipToDid', () => {
    const int = 'eip155:1:0x1234567891234567891234567891234596351156'

    test('converts caip AccountId to did-safe URL', () => {
      const didUrl = caipToDid(new AccountId(AccountId.parse(int)))
      expect(didUrl).toEqual('did:safe:eip155:1:0x1234567891234567891234567891234596351156')
    })
  })

  describe('createSafeDidUrl', () => {
    const params = {
      chainId: 'eip155:1',
      address: '0x1234567891234567891234567891234596351156',
    }

    test('converts params to did-safe URL', () => {
      const url = createSafeDidUrl(params)
      expect(url).toEqual('did:safe:eip155:1:0x1234567891234567891234567891234596351156')
    })
  })

  describe('didToCaip', () => {
    const int = 'eip155:1:0x1234567891234567891234567891234596351156'
    const url = 'did:safe:' + int

    test('convert did:safe id to caip Account Id', () => {
      const fromInt = didToCaip(url)
      console.log('fromInt: ', fromInt)
      expect(fromInt).toEqual(new AccountId(AccountId.parse(int)))
    })
  })
})
