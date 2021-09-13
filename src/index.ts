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
import { AccountId } from 'caip'
import { DIDDocumentMetadata } from 'did-resolver'
import Safe, { EthAdapter } from '@gnosis.pm/safe-core-sdk'

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
  ethAdapter: EthAdapter
): Promise<AccountId[]> {
  let owners: string[]

  if (accountId.chainId.namespace === 'eip155') {
    owners = await getSafeOwners(accountId.address, ethAdapter)
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

function validateResolverConfig(config: Partial<SafeResolverConfig>) {
  if (!config) {
    throw new Error(`Missing safe-did-resolver config`)
  }
  if (!config.ceramic) {
    throw new Error('Missing ceramic client in safe-did-resolver config')
  }
  if (!config.ethAdapter) {
    throw new Error('Missing ethAdapter in safe-did-resolver config')
  }
}

export type ChainConfig = {
  blocks: string
  skew: number
  assets: Record<string, string>
}

export type SafeResolverConfig = {
  ceramic: CeramicApi
  ethAdapter: EthAdapter
}

async function resolve(
  did: string,
  methodId: string,
  config: SafeResolverConfig
): Promise<DIDResolutionResult> {
  const accountId = didToCaip(methodId)

  const owningAccounts = await accountIdToAccount(accountId, config.ethAdapter)
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
export function caipToDid(accountId: AccountId): string {
  const id = accountId.toString().replace(/\//g, '_')
  return `did:safe:${id}`
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
    })
  )
}

/**
 * Get the owners of a Gnosis Safe
 * @param safeAddress - address from an existing Gnosis Safe
 * @param ethAdapter - instance of EthAdapter for Gnosis Safe creation
 */
export async function getSafeOwners(
  safeAddress: string,
  ethAdapter: EthAdapter
): Promise<string[]> {
  const safe = await Safe.create({
    ethAdapter,
    safeAddress,
  })

  return await safe.getOwners()
}

export default {
  getResolver: (
    config: Partial<SafeResolverConfig> & Required<{ ceramic: CeramicApi; ethAdapter: EthAdapter }>
  ): ResolverRegistry => {
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
          const didResult = await resolve(did, parsed.id, config as SafeResolverConfig)

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
