"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
exports.getSafeOwners = exports.createSafeDidUrl = exports.caipToDid = exports.didToCaip = void 0;
var stream_caip10_link_1 = require("@ceramicnetwork/stream-caip10-link");
var caip_1 = require("caip");
var safe_core_sdk_1 = require("@gnosis.pm/safe-core-sdk");
var ethers_1 = require("ethers");
var DID_LD_JSON = 'application/did+ld+json';
var DID_JSON = 'application/did+json';
function didToCaip(id) {
    var caip = id
        .replace(/^did:safe:/, '')
        .replace(/\?.+$/, '')
        .replace(/_/g, '/');
    return new caip_1.AccountId(caip);
}
exports.didToCaip = didToCaip;
/**
 * Gets the owners of the safe from Gnosis Safe
 * @param accountId safe address
 */
function accountIdToAccount(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var owners;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(accountId.chainId.namespace === 'eip155')) return [3 /*break*/, 2];
                    return [4 /*yield*/, getSafeOwners(accountId.address)];
                case 1:
                    owners = _a.sent();
                    return [3 /*break*/, 3];
                case 2: throw new Error("Only eip155 namespace is currently supported. Given: " + accountId.chainId.namespace);
                case 3: return [2 /*return*/, owners.slice().map(function (owner) {
                        return new caip_1.AccountId({
                            chainId: accountId.chainId,
                            address: owner
                        });
                    })];
            }
        });
    });
}
/**
 * Creates CAIP-10 links for each account to be used as controllers.
 * Since there may be many owners for a given Safe,
 * there can be many controllers of that DID document.
 */
function accountsToDids(accounts, ceramic) {
    return __awaiter(this, void 0, void 0, function () {
        var controllers, links, _i, links_1, link;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    controllers = [];
                    return [4 /*yield*/, Promise.all(accounts.map(function (accountId) { return stream_caip10_link_1.Caip10Link.fromAccount(ceramic, accountId); }))];
                case 1:
                    links = _a.sent();
                    for (_i = 0, links_1 = links; _i < links_1.length; _i++) {
                        link = links_1[_i];
                        if (link === null || link === void 0 ? void 0 : link.did)
                            controllers.push(link.did);
                    }
                    return [2 /*return*/, controllers.length > 0 ? controllers : undefined];
            }
        });
    });
}
function wrapDocument(did, accounts, controllers) {
    // Each of the owning accounts is a verification method (at the point in time)
    var verificationMethods = accounts.slice().map(function (account) {
        return {
            id: did + "#" + account.address.slice(2, 14),
            type: 'BlockchainVerificationMethod2021',
            controller: did,
            blockchainAccountId: account.toString()
        };
    });
    var doc = {
        id: did,
        verificationMethod: __spreadArray([], verificationMethods, true)
    };
    // Controllers should only be an array when there're more than one
    if (controllers)
        doc.controller = controllers.length === 1 ? controllers[0] : controllers;
    return doc;
}
function validateResolverConfig(config) {
    if (!config) {
        throw new Error("Missing safe-did-resolver config");
    }
    if (!config.ceramic) {
        throw new Error('Missing ceramic client in safe-did-resolver config');
    }
}
function resolve(did, methodId, config) {
    return __awaiter(this, void 0, void 0, function () {
        var accountId, owningAccounts, controllers, metadata;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    accountId = didToCaip(methodId);
                    return [4 /*yield*/, accountIdToAccount(accountId)];
                case 1:
                    owningAccounts = _a.sent();
                    return [4 /*yield*/, accountsToDids(owningAccounts, config.ceramic)];
                case 2:
                    controllers = _a.sent();
                    metadata = {};
                    // TODO create (if it stays in the spec)
                    return [2 /*return*/, {
                            didResolutionMetadata: { contentType: DID_JSON },
                            didDocument: wrapDocument(did, owningAccounts, controllers),
                            didDocumentMetadata: metadata
                        }];
            }
        });
    });
}
/**
 * Convert AccountId to did:safe URL
 * @param accountId - Safe Account
 */
function caipToDid(accountId) {
    var id = accountId.toString().replace(/\//g, '_');
    return "did:safe:" + id;
}
exports.caipToDid = caipToDid;
/**
 * Convert Safe account id to Safe DID URL
 */
function createSafeDidUrl(params) {
    if (params.chainId.substr(0, params.chainId.indexOf(':')) !== 'eip155') {
        throw new Error("Only eip155 are supported");
    }
    return caipToDid(new caip_1.AccountId({
        chainId: params.chainId,
        address: params.address
    }));
}
exports.createSafeDidUrl = createSafeDidUrl;
/**
 * Create a safe instance from the safe address
 * @param safeAddress - address from an existing Gnosis Safe
 */
function getSafe(safeAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var web3Provider, provider, owner1, ethAdapterOwner, safe;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    web3Provider = window.ethereum;
                    provider = new ethers_1.ethers.providers.Web3Provider(web3Provider);
                    owner1 = provider.getSigner(0);
                    ethAdapterOwner = new safe_core_sdk_1.EthersAdapter({
                        ethers: ethers_1.ethers,
                        signer: owner1
                    });
                    return [4 /*yield*/, safe_core_sdk_1["default"].create({
                            ethAdapter: ethAdapterOwner,
                            safeAddress: safeAddress
                        })];
                case 1:
                    safe = _a.sent();
                    return [2 /*return*/, safe];
            }
        });
    });
}
/**
 * Get the owners of a Gnosis Safe
 * @param safeAddress - address from an existing Gnosis Safe
 * @param safe - a Safe instance
 */
function getSafeOwners(safeAddress, safe) {
    return __awaiter(this, void 0, void 0, function () {
        var owners;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!safe) return [3 /*break*/, 2];
                    return [4 /*yield*/, getSafe(safeAddress)];
                case 1:
                    safe = _a.sent();
                    _a.label = 2;
                case 2: return [4 /*yield*/, safe.getOwners()
                    // TODO check each owners if it is another safe, then do recursive getOwners()
                ];
                case 3:
                    owners = _a.sent();
                    // TODO check each owners if it is another safe, then do recursive getOwners()
                    return [2 /*return*/, owners];
            }
        });
    });
}
exports.getSafeOwners = getSafeOwners;
exports["default"] = {
    getResolver: function (config) {
        validateResolverConfig(config);
        return {
            safe: function (did, parsed, resolver, options) { return __awaiter(void 0, void 0, void 0, function () {
                var contentType, didResult, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            contentType = options.accept || DID_JSON;
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, resolve(did, parsed.id, config)];
                        case 2:
                            didResult = _a.sent();
                            if (contentType === DID_LD_JSON) {
                                didResult.didDocument['@context'] = 'https://w3id.org/did/v1';
                                didResult.didResolutionMetadata.contentType = DID_LD_JSON;
                            }
                            else if (contentType !== DID_JSON) {
                                didResult.didDocument = null;
                                didResult.didDocumentMetadata = {};
                                delete didResult.didResolutionMetadata.contentType;
                                didResult.didResolutionMetadata.error = 'representationNotSupported';
                            }
                            return [2 /*return*/, didResult];
                        case 3:
                            e_1 = _a.sent();
                            return [2 /*return*/, {
                                    didResolutionMetadata: {
                                        error: 'invalidDid',
                                        message: e_1.toString()
                                    },
                                    didDocument: null,
                                    didDocumentMetadata: {}
                                }];
                        case 4: return [2 /*return*/];
                    }
                });
            }); }
        };
    }
};
