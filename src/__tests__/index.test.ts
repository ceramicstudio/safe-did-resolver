/**
 * @jest-environment ceramic
 */

import SafeResolver, { caipToDid, createSafeDidUrl, didToCaip, SafeResolverConfig } from '../index'
import { ResolverRegistry } from 'did-resolver'
import { AccountId } from 'caip'
import { ethers } from 'ethers'
import { EthersAdapter } from '@gnosis.pm/safe-core-sdk'
import ganache from 'ganache-core'

const GANACHE_CONF = {
  seed: '0xd30553e27ba2954e3736dae1342f5495798d4f54012787172048582566938f6f',
}

describe('Gnosis Safe DID Resolver', () => {
  let config: SafeResolverConfig
  let safeResolver: ResolverRegistry

  beforeAll(async () => {
    const ethRpcProvider = new ethers.providers.Web3Provider(ganache.provider(GANACHE_CONF))
    const owner1 = ethRpcProvider.getSigner(0)
    const ethAdapter = new EthersAdapter({
      ethers,
      signer: owner1,
    })

    config = {
      ceramic: (global as any).ceramic,
      ethAdapter: ethAdapter,
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
      expect(fromInt).toEqual(new AccountId(AccountId.parse(int)))
    })
  })
})
