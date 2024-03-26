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

function getClaimableBalanceId (result_xdr, index = 0) { // {{{1
  let txResult = xdr.TransactionResult.fromXDR(result_xdr, "base64");
  let results = txResult.result().results();
  let operationResult = results[index].value().createClaimableBalanceResult();
  let balanceId = operationResult.balanceId().toXDR("hex");
  return balanceId;
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
  let tx = new TransactionBuilder(maker, // increasing the maker's
    {                                    //  sequence number
      fee: BASE_FEE,
      memo: Memo.text(`Request ${validity}`),
      networkPassphrase: e.nw,
    }
  )
  let amount = parseHEXA(description)
  tx = tx.addOperation(Operation.createClaimableBalance({ claimants,
    asset: d.HEXA,
    amount//: parseHEXA(description),
  }))
  for (let opData of chunkDescToOps(description)) {
    tx = tx.addOperation(opData)
  }
  tx = tx.setTimeout(30).build()

  tx.sign(kp)
  e.server.submitTransaction(tx).then(txR => e.log({
    request: description,
    balanceId: getClaimableBalanceId(txR.result_xdr),
    txId: txR.id,
  })).catch(e => {
    console.error('*** ERROR ***', e.response?.data.extras.result_codes)
    throw e;
  })
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

export { // {{{1
  makeRequest,
}
