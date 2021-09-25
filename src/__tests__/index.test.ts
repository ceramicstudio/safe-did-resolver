/**
 * @jest-environment ceramic
 */

import SafeResolver, { caipToDid, createSafeDidUrl, didToCaip, SafeResolverConfig } from '../index'
import { Resolver, ResolverRegistry } from 'did-resolver'
import { EthereumAuthProvider } from '@ceramicnetwork/blockchain-utils-linking'
import { Caip10Link } from '@ceramicnetwork/stream-caip10-link'
import * as u8a from 'uint8arrays'
import fetchMock from 'jest-fetch-mock'
import { ethers } from 'ethers'
import { SafeDidVectorBuilder, SafeDidVector } from './safe-did-vector'
import ganache from 'ganache-core'
import { AccountId } from 'caip'

const GNOSIS_SAFE_QUERY_MAINNET_URL =
  'https://api.thegraph.com/subgraphs/name/gjeanmart/gnosis-safe-mainnet'
const BLOCK_QUERY_MAINNET_URL =
  'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks'

const ETH_CAIP2_CHAINID = 'eip155:1'

const safeContractMainnet1 = '0x00044c87ddc54536ee05047c6f4f6f831aba988b'
const safeOwnerMainnet1 = ['0x22736fff539a3c50de6a46248d898eea2f1afe8f']
const safeContractMainnet2 = '0x8e4d87ad4dafdac06d86a3ed002f5085dc036e08'
const safeOwnerMainnet2 = [
  '0x0865ab296021946dc8ce735e0d006ab33ba485be',
  '0xf1d1f623648b2f7b0c2b9e7c0fd28bf36fd3b95f',
]
const safeOwnerResponse1 = { data: { wallet: { owners: safeOwnerMainnet1 } } }
const safeOwnerResponse2 = { data: { wallet: { owners: safeOwnerMainnet2 } } }
const safeNoResponse = { data: { wallet: [] } }

const blockQueryNumber = '1234567'
const blockQueryResponse = { data: { blocks: [{ number: blockQueryNumber }] } }

const caipLinkControllerDid = 'did:3:testing'

const GANACHE_CONF = {
  seed: '0xd30553e27ba2954e3736dae1342f5495798d4f54012787172048582566938f6f',
}

describe('Gnosis Safe DID Resolver (TheGraph)', () => {
  let config: SafeResolverConfig
  let safeResolver: ResolverRegistry
  let resolver: Resolver

  let ethAccount: string
  let ethAuthProv: EthereumAuthProvider

  beforeAll(async () => {
    config = {
      ceramic: (global as any).ceramic,
      chains: {
        'eip155:1': {
          blocks: BLOCK_QUERY_MAINNET_URL,
          skew: 15000,
          gnosisSafe: GNOSIS_SAFE_QUERY_MAINNET_URL,
        },
      },
    }

    safeResolver = SafeResolver.getResolver(config)
    resolver = new Resolver(safeResolver)

    // Set up the EthAuthProvider
    const ethRpcProvider = new ethers.providers.Web3Provider(
      ganache.provider(GANACHE_CONF) as unknown as ethers.providers.ExternalProvider
    )
    // const ethRpcProvider = new ethers.providers.JsonRpcProvider('http://localhost:8546')
    const ethSigner = ethRpcProvider.getSigner(1)
    ethAccount = (await ethSigner.getAddress()).toLowerCase()

    ethAuthProv = createEthAuthProvider(ethSigner, ethAccount)
    await createCaip10Link(ethAuthProv)
  })

  it('getResolver works correctly', () => {
    expect(Object.keys(safeResolver)).toEqual(['safe'])
  })

  describe('safe-did-resolver config', () => {
    it('does not throw with valid customSubgraphs', () => {
      const customConfig: SafeResolverConfig = {
        ceramic: (global as any).ceramic,
        chains: {
          'eip155:1': {
            blocks: BLOCK_QUERY_MAINNET_URL,
            skew: 15000,
            gnosisSafe: GNOSIS_SAFE_QUERY_MAINNET_URL,
          },
        },
      }

      expect(() => SafeResolver.getResolver(customConfig)).not.toThrow()
    })

    it('throws when Gnosis Safe Subgraph URL is not a url', () => {
      const badUrl = 'aoeuaoeu'
      const customConfig: SafeResolverConfig = {
        ceramic: (global as any).ceramic,
        chains: {
          'eip155:1': {
            blocks: BLOCK_QUERY_MAINNET_URL,
            skew: 15000,
            gnosisSafe: badUrl,
          },
        },
      }

      expect(() => SafeResolver.getResolver(customConfig)).toThrowError(
        `Invalid config for safe-did-resolver: Invalid URL`
      )
    })

    it('throws when the caip2 chainId is malformed', () => {
      const customConfig: SafeResolverConfig = {
        ceramic: (global as any).ceramic,
        chains: {
          'eip155.1': {
            blocks: BLOCK_QUERY_MAINNET_URL,
            skew: 15000,
            gnosisSafe: GNOSIS_SAFE_QUERY_MAINNET_URL,
          },
        },
      }
      expect(() => SafeResolver.getResolver(customConfig)).toThrowError(
        'Invalid config for safe-did-resolver: Invalid chainId provided: eip155.1'
      )
    })
  })

  describe('Gnosis Safe', () => {
    let safeVectorBuilder: SafeDidVectorBuilder

    beforeEach(() => {
      fetchMock.resetMocks()
      fetchMock.mockIf(GNOSIS_SAFE_QUERY_MAINNET_URL)

      safeVectorBuilder = new SafeDidVectorBuilder(ETH_CAIP2_CHAINID)
    })

    it('resolves an Gnosis Safe document with one owner', async () => {
      fetchMock.once(JSON.stringify(safeOwnerResponse1))

      const safeVector = safeVectorBuilder
        .setSafeContract(safeContractMainnet1)
        .setSafeOwners(safeOwnerMainnet1)
        .build()

      await expectVectorResult(resolver, safeVector)
    })

    it('resolves an Gnosis Safe document with multiple owners', async () => {
      fetchMock.once(JSON.stringify(safeOwnerResponse2))

      const safeVector = safeVectorBuilder
        .setSafeContract(safeContractMainnet2)
        .setSafeOwners(safeOwnerMainnet2)
        .build()

      await expectVectorResult(resolver, safeVector)
    })

    it('resolves an erc721 safe doc with an older timestamp', async () => {
      fetchMock.mockOnceIf(BLOCK_QUERY_MAINNET_URL, JSON.stringify(blockQueryResponse))
      fetchMock.mockOnceIf(GNOSIS_SAFE_QUERY_MAINNET_URL, JSON.stringify(safeOwnerResponse1))

      const versionTime = '2021-03-16T10:05:21.000Z'

      const safeVector = safeVectorBuilder
        .setSafeContract(safeContractMainnet1)
        .setSafeOwners(safeOwnerMainnet1)
        .setVersionTime(versionTime)
        .build()

      // when versionTime is provided, it should ask for the block number at that time,
      // and subsequently get the owner at that time.

      expect(await resolver.resolve(safeVector.getDidWithVersionTime())).toEqual(
        safeVector.getResult()
      )

      expectBlockQueries(versionTime)
    })

    it('throws on invalid Gnosis Safe contract', async () => {
      fetchMock.once(JSON.stringify(safeNoResponse))
      const invalidContract = '0x1234567891234567891234567891234596351156'

      const safeVector = safeVectorBuilder
        .setSafeContract(invalidContract)
        .setErrorMessage(`Error: No owner found for Gnosis Safe address: ${invalidContract}`)
        .build()

      await expectVectorResult(resolver, safeVector)
    })

    it('resolves erc721 dids with a custom subgraph url', async () => {
      const custom721Subgraph = 'https://api.thegraph.com/subgraphs/name/dvorak/aoeu'
      fetchMock.mockIf(custom721Subgraph)
      fetchMock.mockOnceIf(custom721Subgraph, JSON.stringify(safeOwnerResponse1))

      const customConfig: SafeResolverConfig = {
        ceramic: (global as any).ceramic,
        chains: {
          'eip155:1': {
            blocks: BLOCK_QUERY_MAINNET_URL,
            skew: 15000,
            gnosisSafe: custom721Subgraph,
          },
        },
      }

      const customResolver = new Resolver(SafeResolver.getResolver(customConfig))

      const safeVector = safeVectorBuilder
        .setSafeContract(safeContractMainnet1)
        .setSafeOwners(safeOwnerMainnet1)
        .build()

      await expectVectorResult(customResolver, safeVector)
      expect(fetchMock.mock.calls[0][0]).toEqual(custom721Subgraph)
    })
  })
})

const expectVectorResult = async (resolver: Resolver, safeVector: SafeDidVector) => {
  const result = await resolver.resolve(safeVector.safeDid)
  expect(result).toEqual(safeVector.getResult())
}

// a helper to do the same operation as in the resolver
const isoTimeToTimestamp = (versionTime: string) => {
  return Math.floor(new Date(versionTime).getTime() / 1000)
}

function expectBlockQueries(versionTime: string) {
  // Note: For each indexed call, the 0th elem is the url, and the 1st elem is what was sent to fetch
  // the first call will be to query the block at timestamp
  expect(fetchMock.mock.calls[0][0]).toEqual(BLOCK_QUERY_MAINNET_URL)

  // check that the call includes the timestamp
  expect(
    fetchMock.mock.calls[0][1].body
      .toString()
      .includes(`timestamp_lte: ${isoTimeToTimestamp(versionTime)}`)
  ).toBe(true)

  // check that the call to the Gnosis Safe subgraph includes the mocked block number
  expect(fetchMock.mock.calls[1][1].body.toString().includes(`number: ${blockQueryNumber}`)).toBe(
    true
  )
}

async function createCaip10Link(ethAuthProv: EthereumAuthProvider) {
  const accountId = await ethAuthProv.accountId()
  const link = await Caip10Link.fromAccount((global as any).ceramic, accountId, {
    syncTimeoutSeconds: 0,
  })
  await link.setDid(caipLinkControllerDid, ethAuthProv)
}

function createEthAuthProvider(ethSigner: ethers.providers.JsonRpcSigner, ethAccount: string) {
  return new EthereumAuthProvider(
    {
      send: async (data, cb) => {
        if (data.method === 'eth_chainId') {
          cb(null, { result: '0x1' })
        } else if (data.method === 'eth_getCode') {
          cb(null, { result: '0x' })
        } else {
          // it's personal_sign
          const msg = u8a.toString(u8a.fromString(data.params[0].slice(2), 'base16'))
          const sign = await ethSigner.signMessage(msg)
          cb(null, { result: sign })
        }
      },
    },
    ethAccount
  )
}

describe('caipToDid', () => {
  const int = 'eip155:1:0x1234567891234567891234567891234596351156'
  const didUrlExpected = 'did:safe:' + int
  const didUrlExpectedWithTimestamp = didUrlExpected + '?versionTime=2021-08-09T17:21:20Z'

  test('converts caip AccountId to did-safe URL', () => {
    const didUrl = caipToDid(new AccountId(AccountId.parse(int)))
    expect(didUrl).toEqual(didUrlExpected)
  })

  test('with timestamp', () => {
    const timestamp = 1628529680
    const didUrl = caipToDid(new AccountId(AccountId.parse(int)), timestamp)
    expect(didUrl).toEqual(didUrlExpectedWithTimestamp)
  })
})

describe('createSafeDidUrl', () => {
  const params = {
    chainId: 'eip155:1',
    address: '0x1234567891234567891234567891234596351156',
  }
  const int = 'eip155:1:0x1234567891234567891234567891234596351156'
  const didUrlExpected = 'did:safe:' + int
  const didUrlExpectedWithTimestamp = didUrlExpected + '?versionTime=2021-08-09T17:21:20Z'

  test('converts params to did-safe URL', () => {
    const url = createSafeDidUrl(params)
    expect(url).toEqual(didUrlExpected)
  })

  test('with timestamp', () => {
    const url = createSafeDidUrl({ ...params, timestamp: 1628529680 })
    expect(url).toEqual(didUrlExpectedWithTimestamp)
  })
})

describe('didToCaip', () => {
  const int = 'eip155:1:0x1234567891234567891234567891234596351156'
  const url = 'did:safe:' + int
  const withTimestamp = url + '?versionTime=2021-08-09T17:21:20Z'

  test('convert did:safe id to caip Account Id', () => {
    const fromInt = didToCaip(url)
    const fromIntWithTimestamp = didToCaip(withTimestamp)
    expect(fromIntWithTimestamp).toEqual(fromInt)
    expect(fromInt).toEqual(new AccountId(AccountId.parse(int)))
  })
})
