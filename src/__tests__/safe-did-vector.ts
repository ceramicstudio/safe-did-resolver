import type { DIDResolutionResult, VerificationMethod } from 'did-resolver'

export class SafeDidVector {
  safeDid: string
  safeOwners: string[] | undefined
  verificationMethods: VerificationMethod[] | undefined
  versionId: string | undefined
  versionTime: string | undefined
  caip10Controller: string | undefined
  errorMessage: string | undefined

  constructor(vectorBuilder: SafeDidVectorBuilder) {
    this.safeDid = vectorBuilder.safeDid
    this.safeOwners = vectorBuilder.safeOwners
    this.verificationMethods = vectorBuilder.verificationMethods
    this.versionId = vectorBuilder.versionId
    this.versionTime = vectorBuilder.versionTime
    this.caip10Controller = vectorBuilder.caip10Controller
    this.errorMessage = vectorBuilder.errorMessage
  }

  getDidWithVersionId(): string {
    return this.safeDid.concat(`?versionId=${this.versionId}`)
  }

  getDidWithVersionTime(): string {
    return this.safeDid.concat(`?versionTime=${this.versionTime}`)
  }

  getResult(): DIDResolutionResult {
    if (this.errorMessage) {
      return {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'invalidDid',
          message: this.errorMessage,
        },
      }
    }

    const resolutionResult = {
      didDocument: {
        id: this.safeDid,
      },
      didDocumentMetadata: {},
      didResolutionMetadata: { contentType: 'application/did+json' },
    } as DIDResolutionResult

    if (this.verificationMethods)
      resolutionResult.didDocument.verificationMethod = [...this.verificationMethods]
    if (this.caip10Controller) resolutionResult.didDocument.controller = this.caip10Controller
    return resolutionResult
  }
}

export class SafeDidVectorBuilder {
  public readonly caip2ChainId: string

  public safeDid = '' // falsey, will throw if not made or provided
  public safeContract: string | undefined
  public safeOwners: string[] | undefined

  public verificationMethods: VerificationMethod[] | undefined
  public versionId: string | undefined
  public versionTime: string | undefined
  public caip10Controller: string | undefined

  public errorMessage: string | undefined

  constructor(caip2ChainId: string) {
    this.caip2ChainId = caip2ChainId
  }

  setSafeContract(safeContract: string): SafeDidVectorBuilder {
    this.safeContract = safeContract
    return this
  }

  setSafeOwners(safeOwners: string[]): SafeDidVectorBuilder {
    this.safeOwners = safeOwners
    return this
  }

  setSafeDid(safeDid: string): SafeDidVectorBuilder {
    this.safeDid = safeDid
    return this
  }

  setVerificationMethods(methods: VerificationMethod[]): SafeDidVectorBuilder {
    this.verificationMethods = methods
    return this
  }

  setCaip10Controller(caip10Controller: string): SafeDidVectorBuilder {
    this.caip10Controller = caip10Controller
    return this
  }

  setErrorMessage(errorMessage: string): SafeDidVectorBuilder {
    this.errorMessage = errorMessage
    return this
  }

  setVersionId(versionId: string): SafeDidVectorBuilder {
    this.versionId = versionId
    return this
  }

  // Should be ISOString
  setVersionTime(versionTime: string): SafeDidVectorBuilder {
    this.versionTime = versionTime
    return this
  }

  build(): SafeDidVector {
    if (!this.safeDid) this.safeDid = this.makeDid()

    if (!this.errorMessage && !this.verificationMethods)
      this.verificationMethods = this.makeVerificationMethods()

    return new SafeDidVector(this)
  }

  private makeDid(): string {
    if (!this.safeContract) {
      throw new Error('Must provide contract address and DID.')
    }
    return `did:safe:${this.caip2ChainId}:${this.safeContract}`
  }

  private makeVerificationMethods(): VerificationMethod[] {
    if (!this.safeOwners) {
      throw new Error('Must provide SafeOwners')
    } else if (!this.safeDid) {
      throw new Error('Must provide Safe DID or args')
    }

    return this.safeOwners.slice().map((owner) => {
      return {
        id: `${this.safeDid}#${owner.slice(2, 14)}`,
        type: 'BlockchainVerificationMethod2021',
        controller: this.safeDid,
        blockchainAccountId: `${this.caip2ChainId}:${owner}`,
      } as VerificationMethod
    })
  }
}
