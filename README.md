# Gnosis Safe DID Resolver

> Safe is a DID method that uses the Ceramic network to resolve DID documents for Gnosis Safe
> See [CIP-101](https://github.com/ceramicnetwork/CIP/blob/main/CIPs/CIP-101/CIP-101.md)

## Getting started

This implementation is still a prototype. Contributions are welcome!

### Installation

```bash
$ npm install safe-did-resolver
```

### Usage

```typescript
import SafeResolver from 'safe-did-resolver'
import { Resolver } from 'did-resolver'
import Ceramic from '@ceramicnetwork/http-client'

const ceramic = new Ceramic() // connects to localhost:7007 by default

// Create a EthAdapter (can use Ethers or Web3)
// See Gnosis Safe safe-core-sdk for details (https://github.com/gnosis/safe-core-sdk/tree/main/packages/safe-core-sdk#1-set-up-the-sdk-using-ethers-or-web3)
// Below example uses Ethers
const web3Provider = window.ethereum
const provider = new ethers.providers.Web3Provider(web3Provider)
const owner1 = provider.getSigner(0)
const ethAdapter = new EthersAdapter({
  ethers,
  signer: owner1,
})

const config = {
  ceramic,
  ethAdapter,
}

// getResolver will return an object with a key/value pair of { 'safe': resolver }
// where resolver is a function used by the generic did resolver.
const safeResolver = SafeResolver.getResolver(config)
const didResolver = Resolver(safeResolver)

const safeResult = await didSafeResolver.resolve(
  'did:safe:eip155:4:0x2Cb8c8dd6Cefb413884612DC16d187aBDcB64A52'
)
console.log(safeResult)
```

The resolver supports the following networks by default:

- Ethereum mainnet (`eip155:1`),
- Ethereum Rinkeby (`eip155:4`),

## Testing

```bash
$ npm test
```

## DID Specs

The token DIDs are prefixed with `did:safe:`, followed by method specific identifier, which is simply
a [CAIP-10 Account ID](https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-10.md).

DID: `did:safe:{chainId}:{safeAddress}`

CAIP-10: `{chainId}:{safeAddress}`

### Conversions

**DID->CAIP**

```typescript
const caip = did.substr(8).replace(/_/g, '/')
```

**CAIP->DID**

```typescript
const did = `did:safe:${caip.replace(/\//g, '_')
```

There are helpers that help you with the conversion:

```typescript
import { caipToDid, didToCaip, createSafeDidUrl } from 'safe-did-resolver'
import { AccountId } from 'caip'

// CAIP -> DID URL
const didUrl = createSafeDidUrl({
  chainId: 'eip155:1',
  address: '0x1234567891234567891234567891234596351156',
})
// If you use `caip` library in your app, consider using sister `caipToDid` function to
// convert `AccountId` to Safe DID URL.

// DID URL -> CAIP
const accountId = didToCaip(didUrl) // eip155:1/erc721:0x1234567891234567891234567891234596351156/1
```

## ToDos

- [ ] Support for historical owners retrieval
      ~~- [ ] Support for recursive Safe owners lookup~~

## License

Apache-2.0 OR MIT
