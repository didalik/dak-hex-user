/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import { // {{{1
  Asset, AuthClawbackEnabledFlag, AuthRevocableFlag,
  BASE_FEE, Keypair, Claimant, Horizon, Memo, Networks, Operation,
  TransactionBuilder, xdr, 
} from '@stellar/stellar-sdk'
import {
  clawbackOffer, clawbackRequest,
  makeClaimableBalance, takeClaimableBalance,
} from './sdk.mjs'

const HEX_FEE = '0.0000100' // {{{1

function chunkDescToOps (description, source = null) { // {{{1
  if (description.length < 1 || description.length > 2000) {
    throw `- chunkDescToOps: description.length is ${description.length}`
  }

  // Chunk description Operations into ops array
  let i = 0
  let ops = []
  while (description.length > 64) {
    let chunk = description.slice(0, 64)
    description = description.slice(64)
    if (source) {
      ops.push(
        Operation.manageData({ name: `data${i}`, value: chunk, source }),
        Operation.manageData({ name: `data${i}`, value: null, source })
      )
    } else {
      ops.push(
        Operation.manageData({ name: `data${i}`, value: chunk, }),
        Operation.manageData({ name: `data${i}`, value: null, })
      )
    }
    i++
  }
  if (description.length > 0) {
    if (source) {
      ops.push(
        Operation.manageData({ name: `data${i}`, value: description, source }),
        Operation.manageData({ name: `data${i}`, value: null, source })
      )
    } else {
      ops.push(
        Operation.manageData({ name: `data${i}`, value: description, }),
        Operation.manageData({ name: `data${i}`, value: null, })
      )
    }
  }

  return ops;
}

function dealOffer ( // {{{1
  maker, kp, balanceId, makeTxId, amount, takeBalanceId, signDeal
) {
  let { s, e, c, d } = this
  let memo = Memo.hash(makeTxId)
  let tx = new TransactionBuilder(maker, // increasing the maker's
    {                                    //  sequence number
      fee: BASE_FEE, memo, networkPassphrase: e.nw,
    }
  )
  let ops = [
    Operation.beginSponsoringFutureReserves({ sponsoredId: d.keysIssuer[1] }),
    Operation.claimClaimableBalance({ 
      balanceId: takeBalanceId, source: d.keysIssuer[1]
    }),
    Operation.claimClaimableBalance({ balanceId, source: d.keysIssuer[1] }),
    Operation.payment({ amount, asset: d.ClawableHexa,
      destination: maker.id, source: d.keysIssuer[1]
    }),
    Operation.endSponsoringFutureReserves({ source: d.keysIssuer[1] }),
  ]
  for (let op of ops) {
    tx = tx.addOperation(op)
  }
  tx = tx.setTimeout(30).build()
  tx.sign(kp)
  return signDeal.call(this, tx.toXDR(), 'dealOffer').then(txXdr => {
    let tx = TransactionBuilder.fromXDR(txXdr, e.nw)
    return e.server.submitTransaction(tx).then(txR => ({
      done: 'dealOffer',
      txId: txR.id,
    })).catch(e => {
      console.error('*** ERROR ***', e.response?.data.extras.result_codes)
      throw e;
    });
  }).catch(e => { throw e; })
}

function dealRequest ( // {{{1
  maker, kp, amount, balanceId, makeTxId, takerPK, takeBalanceId, signDeal
) {
  let { s, e, c, d } = this
  let memo = Memo.hash(makeTxId)
  let tx = new TransactionBuilder(maker, // increasing the maker's
    {                                    //  sequence number
      fee: BASE_FEE, memo, networkPassphrase: e.nw,
    }
  )
  let ops = [
    Operation.claimClaimableBalance({ balanceId: takeBalanceId }),
    Operation.beginSponsoringFutureReserves({ sponsoredId: d.keysIssuer[1] }),
    Operation.claimClaimableBalance({ balanceId, source: d.keysIssuer[1] }),
    Operation.payment({ amount, asset: d.ClawableHexa,
      destination: takerPK, source: d.keysIssuer[1]
    }),
    Operation.endSponsoringFutureReserves({ source: d.keysIssuer[1] }),
  ]
  for (let op of ops) {
    tx = tx.addOperation(op)
  }
  tx = tx.setTimeout(30).build()
  tx.sign(kp)
  return signDeal.call(this, tx.toXDR(), 'dealRequest').then(txXdr => {
    let tx = TransactionBuilder.fromXDR(txXdr, e.nw)
    return e.server.submitTransaction(tx).then(txR => ({
      done: 'dealRequest',
      txId: txR.id,
    })).catch(e => {
      console.error('*** ERROR ***', e.response?.data.extras.result_codes)
      throw e;
    });
  }).catch(e => { throw e; })
}

function description (operations) { // {{{1
  let result = ''
  for (let o of operations.records) {
    if (o.type == 'manage_data' && o.value.length > 0) {
      result += Buffer.from(o.value, 'base64').toString()
    } 
  }
  return result;
}

/** function dog2hexa (bigInt) // {{{1
 * Drops Of Gratitude (DOGs) are internal representation of HEXAs. 
 * 1 HEXA is 10000000 DOGs. 1 DOG is 0.0000001 HEXA.
 * A HEXA is a String, a DOG is a BigInt.
 */
function dog2hexa (bigInt) {
  const truncated  = bigInt / 10000000n
  const fractional = bigInt % 10000000n
  let zeroes
  switch (fractional.toString().length) {
    case 1:
      zeroes = '000000'
      break
    case 2:
      zeroes = '00000'
      break
    case 3:
      zeroes = '0000'
      break
    case 4:
      zeroes = '000'
      break
    case 5:
      zeroes = '00'
      break
    case 6:
      zeroes = '0'
      break
    case 7:
      zeroes = ''
  }
  return truncated.toString() + '.' + zeroes + fractional.toString();
}

/** function hexa2dog (str) // {{{1
 * Drops Of Gratitude (DOGs) are internal representation of HEXAs. 
 * 1 HEXA is 10000000 DOGs. 
 * A HEXA is a String, a DOG is a BigInt.
 */
function hexa2dog (str) {
  let dotIndex = str.indexOf('.')
  if (dotIndex < 0) {
    return BigInt(str) * 10000000n;
  }
  let truncated = dotIndex == 0 ? '0' : str.slice(0, dotIndex)
  let fractional = dotIndex == 0 ? '0000000' : str.slice(dotIndex + 1)
  while (fractional.length < 7) {
    fractional += '0'
  }
  return BigInt(truncated) * 10000000n + BigInt(fractional);
}

function makeOffer (maker, kp, description, validity = '0') { // seconds {{{1
  let { s, e, c, d } = this
  let claimants = [ 
    new Claimant(d.issuer.id,
      validity == '0' ? Claimant.predicateUnconditional()
      : Claimant.predicateBeforeRelativeTime(validity)
    ),  
    new Claimant(maker.id, // maker can reclaim anytime
      Claimant.predicateUnconditional()
    )   
  ]
  let amount = HEX_FEE
  return makeClaimableBalance.call(this, claimants, maker, kp, amount,
    chunkDescToOps(description), Memo.text(`Offer ${validity}`)
  ).then(r => { r.offer = description; return r; });
}

function makeRequest (maker, kp, description, validity = '0') { // seconds {{{1
  let { s, e, c, d } = this
  let claimants = [ 
    new Claimant(d.issuer.id,
      validity == '0' ? Claimant.predicateUnconditional()
      : Claimant.predicateBeforeRelativeTime(validity)
    ),  
    new Claimant(maker.id, // maker can reclaim anytime
      Claimant.predicateUnconditional()
    )   
  ]
  let amount = dog2hexa(hexa2dog(parseHEXA(description)) + hexa2dog(HEX_FEE))
  return makeClaimableBalance.call(this, claimants, maker, kp, amount,
    chunkDescToOps(description), Memo.text(`Request ${validity}`)
  ).then(r => { r.request = description; r.amount = amount; return r; });
}

function parseHEXA (desc) { // {{{1
  let index = desc ? desc.indexOf('HEXA ') : -1
  if (index < 0) {
    return null;
  }
  let words = desc.slice(index).split(' ')
  return words[1].endsWith('.') || words[1].endsWith(',') ?
    words[1].slice(0, words[1].length - 1)
  : words[1];
}

function reclaim (creator, kp, balanceId) { // {{{1
  let { s, e, c, d } = this
  return takeClaimableBalance.call(this, creator, kp, balanceId).then(r => e.log(
    'reclaim', r
  ));
}

function repayOffer (taker, kp, amount, from, signDeal) { // {{{1
  let { s, e, c, d } = this

  // ClawableHexa amount + HEX_FEE from maker, HEXA amount + HEX_FEE to taker
  c.HEX_FEE = HEX_FEE
  c.dog2hexa = dog2hexa
  c.hexa2dog = hexa2dog
  return clawbackOffer.call(this,
    taker, kp, amount, from, signDeal
  ).then(r => Object.assign({}, r, { done: 'repayOffer' })).
    catch(err => { throw err; });
}

function repayRequest (maker, kp, amount, from, signDeal) { // {{{1
  let { s, e, c, d } = this

  // ClawableHexa amount + HEX_FEE from taker, HEXA amount to maker
  c.HEX_FEE = HEX_FEE
  c.dog2hexa = dog2hexa
  c.hexa2dog = hexa2dog
  return clawbackRequest.call(this,
    maker, kp, amount, from, signDeal
  ).then(r => Object.assign({}, r, { done: 'repayRequest' })).
    catch(err => { throw err; });
}

function takeOffer (taker, kp, makeTxId, amount, validity = '0') { // {{{1
  let { s, e, c, d } = this
  let claimants = [ 
    new Claimant(d.issuer.id,
      validity == '0' ? Claimant.predicateUnconditional()
      : Claimant.predicateBeforeRelativeTime(validity)
    ),  
    new Claimant(taker.id, // taker can reclaim anytime
      Claimant.predicateUnconditional()
    )   
  ]
  amount = dog2hexa(hexa2dog(amount) + hexa2dog(HEX_FEE))
  return makeClaimableBalance.call(this, claimants, taker, kp, amount,
    [], Memo.hash(makeTxId)
  );
}

function takeRequest (taker, kp, makerPK, makeTxId, validity = '0') { // {{{1
  let { s, e, c, d } = this
  let claimants = [ 
    new Claimant(makerPK,
      validity == '0' ? Claimant.predicateUnconditional()
      : Claimant.predicateBeforeRelativeTime(validity)
    ),  
    new Claimant(taker.id, // taker can reclaim anytime
      Claimant.predicateUnconditional()
    )   
  ]
  let amount = HEX_FEE
  return makeClaimableBalance.call(this, claimants, taker, kp, amount,
    [], Memo.hash(makeTxId)
  );
}

export { // {{{1
  HEX_FEE, dealOffer, dealRequest, description, dog2hexa, hexa2dog,
  makeOffer, makeRequest, parseHEXA, reclaim, repayOffer, repayRequest,
  takeOffer, takeRequest,
}
