import fetch from 'cross-fetch'
import { jsonToGraphQLQuery } from 'json-to-graphql-query'

export const fetchQueryData = async (queryUrl: string, query: unknown): Promise<any> => {
  const fetchOpts = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: jsonToGraphQLQuery({ query }) }),
  }

  const resp = await fetch(queryUrl, fetchOpts)

  if (resp.ok) {
    const { data, error } = await resp.json()
    if (error) throw new Error(error.message)
    return data
  } else {
    throw new Error('Received an invalid response from TheGraph API')
  }
}

type BlockQueryResponse = {
  blocks: {
    number: string
  }[]
}

/**
 * Queries TheGraph to find the latest block at the given time.
 * @param timestamp
 * @param blockQueryUrl - subgraph url for blocks
 * @returns {string} latest block num at timestamp
 */
export const blockAtTime = async (timestamp: number, blockQueryUrl: string): Promise<number> => {
  const query = {
    blocks: {
      __args: {
        first: 1,
        orderBy: 'timestamp',
        orderDirection: 'desc',
        where: {
          // we ask for lte because it is the last known block at the given time
          timestamp_lte: timestamp,
        },
      },
      number: true,
    },
  }

  const queryData = (await fetchQueryData(blockQueryUrl, query)) as BlockQueryResponse

  if (!queryData?.blocks) {
    throw new Error('Missing data from subgraph query')
  } else if (queryData.blocks.length === 0) {
    throw new Error(`No blocks exist before timestamp: ${timestamp}`)
  }

  return parseInt(queryData.blocks[0].number)
}
/**
 * Eth blocks are typically 13 seconds. We use this check so we don't have to
 * make an unneccessary call to the blocks subgraph if the did was just created.
 */
export const isWithinLastBlock = (timestamp: number, skew: number): boolean => {
  return Date.now() - timestamp <= skew
}

type GnosisSafeDataResponse = {
  wallet: {
    owners: Array<string>
  }
}

/**
 * Get the owners of a Gnosis Safe
 * @param safeAddress - address from an existing Gnosis Safe
 */
export async function getSafeOwners(safeAddress: string, queryUrl: string): Promise<string[]> {
  const query = {
    wallet: {
      __args: {
        id: safeAddress,
        // block: blockNum ? { number: blockNum } : null,
      },
      owners: {
        id: true,
      },
    },
  }

  const queryData = (await fetchQueryData(queryUrl, query)) as GnosisSafeDataResponse

  if (!queryData?.wallet) {
    throw new Error('Missing data from subgraph query')
  } else if (queryData.wallet.owners.length === 0) {
    throw new Error(`No owner found for Gnosis Safe Address: ${safeAddress}`)
  }

  return queryData.wallet.owners
}
