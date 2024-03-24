/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import { timestamp, } from '../dak/util/public/lib/util.mjs' // {{{1
import * as fs from "node:fs"
import fetch from 'node-fetch'
import { 
  Asset, AuthClawbackEnabledFlag, AuthRevocableFlag,
  BASE_FEE, Keypair, Claimant, Horizon, Memo, Networks, Operation,
  TransactionBuilder, xdr, 
} from '@stellar/stellar-sdk'

async function addHEX_CREATOR (log, server = null, doLoad = false) { // {{{1
  server ??= new Horizon.Server("https://horizon-testnet.stellar.org")
  let HEX_CREATOR_SK, HEX_CREATOR_PK, account = null
  if (fs.existsSync('build/testnet.keys')) {
    let [SK, PK] = loadKeys('build', 'testnet')
    HEX_CREATOR_SK = SK; HEX_CREATOR_PK = PK
  } else {
    fs.mkdirSync('build/testnet', { recursive: true })
    let [SK, PK] = storeKeys('build', 'testnet')
    HEX_CREATOR_SK = SK; HEX_CREATOR_PK = PK
    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(HEX_CREATOR_PK)}`
      );
      const responseJSON = await response.json();
      log('the HEX_CREATOR account created txId', responseJSON.id)
      doLoad = true
    } catch (e) {
      console.error("ERROR!", e);
    }
  }
  if (doLoad) {
    account = await server.loadAccount(HEX_CREATOR_PK)
    log('loaded HEX_CREATOR', account?.id)
  }
  return {
    s: [],
    e: { log, nw: Networks.TESTNET, server },
    c: { account, },
    d: {
      keys: [HEX_CREATOR_SK, HEX_CREATOR_PK],
      kp: Keypair.fromSecret(HEX_CREATOR_SK),
      // ClawableHexa, HEXA, agent, keysAgent, keysIssuer, issuer, limit, XLM,
    }
  };
}

async function addHEX_Agent (limit) { // {{{1
  let { s, e, c, d } = this
  let HEX_Agent_SK, HEX_Agent_PK, txId = null
  if (fs.existsSync('build/testnet/HEX_Agent.keys')) {
    let [SK, PK] = loadKeys('build/testnet', 'HEX_Agent')
    HEX_Agent_SK = SK; HEX_Agent_PK = PK
  } else {
    e.log('addHEX_Agent...')
    let [SK, PK] = storeKeys('build/testnet', 'HEX_Agent')
    HEX_Agent_SK = SK; HEX_Agent_PK = PK
    txId = await createAccount.call(this, HEX_Agent_PK, '9', {}, d.kp)
    e.log('addHEX_Agent', HEX_Agent_PK, 'txId', txId)
  }
  let [HEX_Issuer_SK, HEX_Issuer_PK] = loadKeys('build/testnet', 'HEX_Issuer')
  const ClawableHexa = new Asset('ClawableHexa', HEX_Issuer_PK)
  const HEXA = new Asset('HEXA', HEX_Issuer_PK)
  let agent = await e.server.loadAccount(HEX_Agent_PK)
  e.log('addHEX_Agent loaded agent', agent.id)
  let issuer = await e.server.loadAccount(HEX_Issuer_PK)
  e.log('addHEX_Agent loaded issuer', issuer.id)
  let keysAgent = [HEX_Agent_SK, HEX_Agent_PK]
  let keysIssuer = [HEX_Issuer_SK, HEX_Issuer_PK]
  Object.assign(d, 
    { ClawableHexa, HEXA, agent, keysAgent, keysIssuer, issuer, limit }
  )
  if (agent.balances.length == 2) {
    return;
  }

  // Have HEX Agent trust HEXA - up to limit
  txId = await trustAssets.call(this, 
    agent, Keypair.fromSecret(HEX_Agent_SK), limit, HEXA
  )
  e.log('addHEX_Agent agent trusts HEXA limit', limit, 'txId', txId)

  // Fund Agent with HEXA, update Agent's HEXA trustline
  await fundAgent.call(this,
    issuer, Keypair.fromSecret(HEX_Issuer_SK), HEX_Agent_PK, limit, HEXA
  )
}

async function addHEX_Issuer (homeDomain) { // {{{1
  let { s, e, c, d } = this
  let HEX_Issuer_SK, HEX_Issuer_PK, txId = null
  if (fs.existsSync('build/testnet/HEX_Issuer.keys')) {
    let [SK, PK] = loadKeys('build/testnet', 'HEX_Issuer')
    HEX_Issuer_SK = SK; HEX_Issuer_PK = PK
  } else {
    e.log('addHEX_Issuer...')
    let [SK, PK] = storeKeys('build/testnet', 'HEX_Issuer')
    HEX_Issuer_SK = SK; HEX_Issuer_PK = PK
    txId = await createAccount.call(this, HEX_Issuer_PK, '9',
      {
        homeDomain,
        setFlags: AuthClawbackEnabledFlag | AuthRevocableFlag,
        source: HEX_Issuer_PK,
      },
      d.kp, Keypair.fromSecret(HEX_Issuer_SK)
    )
    e.log('addHEX_Issuer', HEX_Issuer_PK, 'txId', txId)
  }
}

async function createAccount ( // {{{1
  destination, startingBalance, opts, ...keypairs
) {
  let { s, e, c, d } = this
  c.account ??= addHEX_CREATOR(e.log, e.server, true).c.account
  let tx = new TransactionBuilder(c.account, { fee: BASE_FEE }).
    addOperation(Operation.createAccount({ destination, startingBalance })).
    addOperation(Operation.setOptions(opts)).
    setNetworkPassphrase(e.nw).
    setTimeout(30).build();
  tx.sign(...keypairs)
  tx =  await e.server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  return tx.id;
}

async function fundAgent( // {{{1
  issuer, issuerKeypair, destination, amount, asset
) {
  let { s, e, c, d } = this
  let tx = new TransactionBuilder(issuer, // increasing the issuer's
    {                                     //  sequence number
      fee: BASE_FEE,
      networkPassphrase: e.nw,
    }
  ).addOperation(Operation.payment({ asset, destination, amount })).
    addOperation(Operation.setTrustLineFlags({ 
      asset,
      trustor: destination,
      flags: {
        clawbackEnabled: false
      },
    })).
    setTimeout(30).build()

  tx.sign(issuerKeypair)
  tx =  await e.server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  return tx?.id;
}

function loadKeys (dirname, basename = null) { // {{{1
  let SK_PK = fs.readFileSync(
    basename ? `${dirname}/${basename}.keys` : dirname
  )
  let pair = SK_PK.toString().split(' ')
  return [pair[0].trim(), pair[1].trim()];
}

async function makeBuyOffer( // {{{1
  kp, account, buying, selling, buyAmount, price, offerId = 0
) {
  let { s, e, c, d } = this
  e.log('makeBuyOffer', account.id, 'buying', buying.code,
    'selling', selling.code, 'buyAmount', buyAmount, 'price', price,
    'offerId', offerId
  )
  let tx = new TransactionBuilder(account, // increasing account's
    {                                      //  sequence number
      fee: BASE_FEE, networkPassphrase: e.nw,
    }
  ).addOperation(Operation.manageBuyOffer({
    selling, buying, buyAmount, price, offerId
  })).setTimeout(30).build()

  tx.sign(kp)
  tx =  await e.server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  let made = buyAmount == '0' || +offerId > 0 ? offerDeleted(tx.result_xdr)
  : offerMade(tx.result_xdr)
  e.log('makeBuyOffer', account.id, tx.id, made.offer.id)
  return Promise.resolve([tx.id, made.offer.id]);
}

async function makeSellOffer( // {{{1
  kp, account, selling, buying, amount, price, offerId = 0
) {
  let { s, e, c, d } = this
  let tx = new TransactionBuilder(account, // increasing account's
    {                                      //  sequence number
      fee: BASE_FEE, networkPassphrase: e.nw,
    }
  ).addOperation(Operation.manageSellOffer({
    selling, buying, amount, price, offerId
  })).setTimeout(30).build()

  tx.sign(kp)
  tx =  await e.server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  let made = offerMade(tx.result_xdr, 'manageSellOfferResult')
  return Promise.resolve([tx.id, made.offer.id]);
}

function offerDeleted (result_xdr, kind = 'manageBuyOfferResult') { // {{{1
  let result = 
    xdr.TransactionResult.fromXDR(result_xdr, "base64").result().results()

  let index = result.length == 3 ? 1
  : result.length == 1 ? 0
  : undefined
  result = result[index] // 0:begin, 1:manage...Offer, 2:end
    .value()[kind]().value()
  let offersClaimed = result._attributes.offersClaimed

  result = { offer: { id: null }, offersClaimedLength: offersClaimed.length, }
  //console.dir(result, { depth: null })
  return result;
}

function offerMade (result_xdr, kind = 'manageBuyOfferResult') { // {{{1
  let result = 
    xdr.TransactionResult.fromXDR(result_xdr, "base64").result().results()

  let index = result.length == 3 ? 1
  : result.length == 1 ? 0
  : undefined
  result = result[index] // 0:begin, 1:manage...Offer, 2:end
    .value()[kind]().value()
  let offersClaimed = result._attributes.offersClaimed
  let offer = result.offer().value()
  let id = offer.offerId().low
  let price_r = offer.price()._attributes

  result = { offer: { id, price_r, }, offersClaimedLength: offersClaimed.length, }
  //console.dir(result, { depth: null })
  return result;
}

function storeKeys (dirname, basename) { // {{{1
  fs.mkdirSync(dirname, { recursive: true, })
  let pair = Keypair.random()
  let SK_PK = pair.secret() + ' ' + pair.publicKey()
  fs.writeFileSync(`${dirname}/${basename}.keys`, SK_PK)
  let p = SK_PK.toString().split(' ')
  return [p[0].trim(), p[1].trim()];
}

async function trustAssets( // {{{1
  recipient, recipientKeypair, limit, ...assets
) {
  let { s, e, c, d } = this
  let tx = new TransactionBuilder(recipient, // increasing the recipient's
    {                                        //  sequence number
      fee: BASE_FEE,
      networkPassphrase: e.nw,
    }
  )
  for (let asset of assets) {
    tx = tx.addOperation(Operation.changeTrust({ asset, limit }))
  }
  tx = tx.setTimeout(30).build()

  tx.sign(recipientKeypair)
  tx =  await e.server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  return tx.id;
}

async function updateTrustline( // {{{1
  issuer, issuerKeypair, trustor, asset
) {
  let { s, e, c, d } = this
  let tx = new TransactionBuilder(issuer, // increasing the issuer's
    {                                     //  sequence number
      fee: BASE_FEE,
      networkPassphrase: e.nw,
    }
  ).addOperation(Operation.setTrustLineFlags({ asset, trustor,
      flags: {
        clawbackEnabled: false
      },
    })).
    setTimeout(30).build()

  tx.sign(issuerKeypair)
  tx =  await e.server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  return tx.id;
}

export { // {{{1
  addHEX_CREATOR, addHEX_Agent, addHEX_Issuer, 
  createAccount, loadKeys, makeBuyOffer, makeSellOffer,
  storeKeys, trustAssets, updateTrustline,
}
