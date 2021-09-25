import type {
  DIDResolutionResult,
  DIDResolutionOptions,
  DIDDocument,
  ParsedDID,
  Resolver,
  ResolverRegistry,
  VerificationMethod,
} from 'did-resolver'
import type { CeramicApi } from '@ceramicnetwork/common'
import { Caip10Link } from '@ceramicnetwork/stream-caip10-link'
import { ChainId, AccountId } from 'caip'
import { DIDDocumentMetadata } from 'did-resolver'
import { blockAtTime, getSafeOwners, isWithinLastBlock } from './subgraph-utils'
import merge from 'merge-options'

const DID_LD_JSON = 'application/did+ld+json'
const DID_JSON = 'application/did+json'

export function didToCaip(id: string): AccountId {
  const caip = id
    .replace(/^did:safe:/, '')
    .replace(/\?.+$/, '')
    .replace(/_/g, '/')

  return new AccountId(caip)
}

/**
 * Gets the owners of the safe from Gnosis Safe
 * @param accountId safe address
 */
async function accountIdToAccount(
  accountId: AccountId,
  timestamp: number | undefined,
  chains: Record<string, ChainConfig | undefined>
): Promise<AccountId[]> {
  const accountChainId = accountId.chainId.toString()
  let gnosisSafeSubgraphUrl = undefined
  let chain = undefined

  if (chains && chains[accountChainId]) {
    chain = chains[accountChainId]
    gnosisSafeSubgraphUrl = chains[accountChainId].gnosisSafe
  } else {
    throw new Error(`No chain configuration for ${accountChainId}`)
  }

  // we want to query what block is at the timestamp IFF it is an (older) existing timestamp
  let queryBlock = 0
  if (timestamp && !isWithinLastBlock(timestamp, chain.skew)) {
    queryBlock = await blockAtTime(timestamp, chain.blocks)
  }

  let owners: string[]

  if (accountId.chainId.namespace === 'eip155') {
    owners = await getSafeOwners(accountId.address, queryBlock, gnosisSafeSubgraphUrl)
  } else {
    throw new Error(
      `Only eip155 namespace is currently supported. Given: ${accountId.chainId.namespace}`
    )
  }

  return owners.slice().map(
    (owner) =>
      new AccountId({
        chainId: accountId.chainId,
        address: owner,
      })
  )
}

/**
 * Creates CAIP-10 links for each account to be used as controllers.
 * Since there may be many owners for a given Safe,
 * there can be many controllers of that DID document.
 */
async function accountsToDids(
  accounts: AccountId[],
  ceramic: CeramicApi
): Promise<string[] | undefined> {
  const controllers: string[] = []

  const links = await Promise.all(
    accounts.map((accountId: AccountId) => Caip10Link.fromAccount(ceramic, accountId))
  )

  for (const link of links) {
    if (link?.did) controllers.push(link.did)
  }

  return controllers.length > 0 ? controllers : undefined
}

function wrapDocument(did: string, accounts: AccountId[], controllers?: string[]): DIDDocument {
  // Each of the owning accounts is a verification method (at the point in time)
  const verificationMethods = accounts.slice().map<VerificationMethod>((account) => {
    return {
      id: `${did}#${account.address.slice(2, 14)}`,
      type: 'BlockchainVerificationMethod2021',
      controller: did,
      blockchainAccountId: account.toString(),
    }
  })

  const doc: DIDDocument = {
    id: did,
    verificationMethod: [...verificationMethods],
  }

  // Controllers should only be an array when there're more than one
  if (controllers) doc.controller = controllers.length === 1 ? controllers[0] : controllers

  return doc
}

/**
 * Gets the unix timestamp from the `versionTime` parameter.
 * @param query
 */
function getVersionTime(query = ''): number {
  const versionTime = query.split('&').find((e) => e.includes('versionTime'))
  if (versionTime) {
    return Math.floor(new Date(versionTime.split('=')[1]).getTime() / 1000)
  }
  return 0 // 0 is falsey
}

function validateResolverConfig(config: Partial<SafeResolverConfig>) {
  if (!config) {
    throw new Error(`Missing safe-did-resolver config`)
  }
  if (!config.ceramic) {
    throw new Error('Missing ceramic client in safe-did-resolver config')
  }
  const chains = config.chains
  if (!chains) {
    throw new Error('Missing chain parameters in safe-did-resolver config')
  }
  try {
    Object.entries(config.chains).forEach(([chainId, chainConfig]) => {
      ChainId.parse(chainId)
      new URL(chainConfig.blocks)
      new URL(chainConfig.gnosisSafe)
    })
  } catch (e) {
    throw new Error(`Invalid config for safe-did-resolver: ${e.message}`)
  }
}

export type ChainConfig = {
  blocks: string
  skew: number
  gnosisSafe: string
}

/**
 * When passing in a custom subgraph url, it must conform to the same standards as
 * represented by the included Gnosis Safe subgraphs
 * Example:
 * ```
 * const customConfig = {
 *  ceramic: ceramicClient,
 *  chains: {
 *     // Ethereum Mainnet
 *     'eip155:1': {
 *       blocks: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
 *       skew: 15000,
 *       gnosisSafe: 'https://api.thegraph.com/subgraphs/name/gjeanmart/gnosis-safe-mainnet',
 *     },
 *  }
 * }
 * ```
 */
export type SafeResolverConfig = {
  ceramic: CeramicApi
  chains: Record<string, ChainConfig>
}

async function resolve(
  did: string,
  methodId: string,
  timestamp: number,
  config: SafeResolverConfig
): Promise<DIDResolutionResult> {
  const accountId = didToCaip(methodId.toLowerCase())

  const owningAccounts = await accountIdToAccount(accountId, timestamp, config.chains)
  const controllers = await accountsToDids(owningAccounts, config.ceramic)
  const metadata: DIDDocumentMetadata = {}

  // TODO create (if it stays in the spec)

  return {
    didResolutionMetadata: { contentType: DID_JSON },
    didDocument: wrapDocument(did, owningAccounts, controllers),
    didDocumentMetadata: metadata,
  }
}

/**
 * Convert AccountId to did:safe URL
 * @param accountId - Safe Account
 */
export function caipToDid(accountId: AccountId, timestamp?: number): string {
  const query = timestamp
    ? `?versionTime=${new Date(timestamp * 1000).toISOString().split('.')[0] + 'Z'}`
    : ''

  const id = accountId.toString().replace(/\//g, '_')
  return `did:safe:${id}${query}`
}

function withDefaultConfig(config: Partial<SafeResolverConfig>): SafeResolverConfig {
  const defaults = {
    chains: {
      // Ethereum Mainnet
      'eip155:1': {
        blocks: 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks',
        skew: 15000,
        gnosisSafe: 'https://api.thegraph.com/subgraphs/name/gjeanmart/gnosis-safe-mainnet',
      },
      // Ethereum Ropsten
      'eip155:3': {
        blocks: 'https://api.thegraph.com/subgraphs/name/yyong1010/ethereumblocks',
        skew: 15000,
        gnosisSafe: 'https://api.thegraph.com/subgraphs/name/gjeanmart/gnosis-safe-ropsten',
      },
      // Ethereum Rinkeby
      'eip155:4': {
        blocks: 'https://api.thegraph.com/subgraphs/name/billjhlee/rinkeby-blocks',
        skew: 15000,
        gnosisSafe: 'https://api.thegraph.com/subgraphs/name/radicle-dev/gnosis-safe-rinkeby',
      },
    },
  }
  return merge.bind({ ignoreUndefined: true })(defaults, config)
}

/**
 * Params for `createSafeDidUrl` function.
 */
export type SafeDidUrlParams = {
  /**
   * CAIP-10 Chain ID. For example: `eip155:1`
   */
  chainId: string
  /**
   * Safe contract address
   */
  address: string
  /**
   * Unix timestamp for `versionTime` DID URL query param. Helps to find Gnosis Safe owners at particular point in time.
   */
  timestamp?: number
}

/**
 * Convert Safe account id to Safe DID URL
 */
export function createSafeDidUrl(params: SafeDidUrlParams): string {
  if (params.chainId.substr(0, params.chainId.indexOf(':')) !== 'eip155') {
    throw new Error(`Only eip155 are supported`)
  }
  return caipToDid(
    new AccountId({
      chainId: params.chainId,
      address: params.address,
    }),
    params.timestamp
  )
}

export default {
  getResolver: (
    config: Partial<SafeResolverConfig> & Required<{ ceramic: CeramicApi }>
  ): ResolverRegistry => {
    config = withDefaultConfig(config)
    validateResolverConfig(config)
    return {
      safe: async (
        did: string,
        parsed: ParsedDID,
        resolver: Resolver,
        options: DIDResolutionOptions
      ): Promise<DIDResolutionResult> => {
        const contentType = options.accept || DID_JSON
        try {
          const timestamp = getVersionTime(parsed.query)
          const didResult = await resolve(did, parsed.id, timestamp, config as SafeResolverConfig)

          if (contentType === DID_LD_JSON) {
            didResult.didDocument['@context'] = 'https://w3id.org/did/v1'
            didResult.didResolutionMetadata.contentType = DID_LD_JSON
          } else if (contentType !== DID_JSON) {
            didResult.didDocument = null
            didResult.didDocumentMetadata = {}
            delete didResult.didResolutionMetadata.contentType
            didResult.didResolutionMetadata.error = 'representationNotSupported'
          }
          return didResult
        } catch (e) {
          return {
            didResolutionMetadata: {
              error: 'invalidDid',
              message: e.toString(),
            },
            didDocument: null,
            didDocumentMetadata: {},
          }
        }
      },
    }
  },
}
