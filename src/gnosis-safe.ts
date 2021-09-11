import Safe, { EthersAdapter } from '@gnosis.pm/safe-core-sdk'
import { ethers } from 'ethers'

const web3Provider = (window as any).ethereum
const provider = new ethers.providers.Web3Provider(web3Provider)
const owner1 = provider.getSigner(0)
const ethAdapterOwner1 = new EthersAdapter({
  ethers,
  signer: owner1,
})

export async function getSafeOwners(safeAddress: string): Promise<string[]> {
  const safeSdk = await Safe.create({
    ethAdapter: ethAdapterOwner1,
    safeAddress,
  })

  const owners = await safeSdk.getOwners()
  // TODO check owners if it is another safe, then do recursive getOwners()
  return owners
}
