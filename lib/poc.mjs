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
import { 
  createAccount, loadKeys, makeBuyOffer, makeSellOffer, memo2str,
  storeKeys, trustAssets, updateTrustline,
} from './sdk.mjs'
import {
  deal, description, makeOffer, makeRequest,
  parseHEXA, reclaim, takeOffer, takeRequest,
} from './api.mjs'

function boughtAlready (poc, tag) { // {{{1
  let { s, e, c, d } = this
  let bought = poc[tag].account.balances.find(
    b => b.asset_code == 'HEXA' && +b.balance > 0
  )
  return !!bought;
}

function buyingHEXA (poc, tag, buyHEXA, demo) { // {{{1
  let { s, e, c, d } = this
  let kp = Keypair.fromSecret(poc[tag].keys[0]), account = poc[tag].account
  e.log(tag, 'buyingHEXA', buyHEXA)
  makeBuyOffer.call(this,
    kp, account, d.HEXA, d.XLM, buyHEXA, 0.9
  ).then(r => setTimeout(_ => makeBuyOffer.call(this,
    kp, account, d.HEXA, d.XLM, buyHEXA, 1, r[1]
  ).then(r => demo.call(this, poc)), 1000 * (1 + Math.random())))
}

function buyAnn (poc, resolve, reject) { // {{{1
  let { s, e, c, d } = this
  poc.Ann.resolve = resolve
  poc.Ann.reject = reject
  if (boughtAlready.call(this, poc, 'Ann')) {
    return demoAnn.call(this, poc);
  }
  buyingHEXA.call(this, poc, 'Ann', '1200', demoAnn)
}

function buyBob (poc, resolve, reject) { // {{{1
  let { s, e, c, d } = this
  poc.Bob.resolve = resolve
  poc.Bob.reject = reject
  buyingHEXA.call(this, poc, 'Bob', '10', demoBob)
}

function buyCyn (poc, resolve, reject) { // {{{1
  let { s, e, c, d } = this
  poc.Cyn.resolve = resolve
  poc.Cyn.reject = reject
  if (boughtAlready.call(this, poc, 'Cyn')) {
    return demoCyn.call(this, poc);
  }
  buyingHEXA.call(this, poc, 'Cyn', '1200', demoCyn)
}

function demoAnn (poc) { // {{{1
  let { s, e, c, d } = this
  makeRequest.call(this,
    poc.Ann.account, Keypair.fromSecret(poc.Ann.keys[0]),
    'Fresh red snapper for 4 persons GGS. HEXA 1000', '28800'
  ).then(r => e.log('demoAnn makeRequest', r.request, 
    poc.Ann.balanceId = r.balanceId, r.txId
  ))
  setTimeout(poc.Ann.resolve, 31000, { tag: 'Ann', timeout: '31s' })
}

function demoBob (poc, resolve, reject, tag, r) { // {{{1
  let { s, e, c, d } = this
  makeOffer.call(this,
    poc.Bob.account, Keypair.fromSecret(poc.Bob.keys[0]),
    'Freshly caught red snapper 4lb. HEXA 800', '100000'
  ).then(r => e.log('demoBob makeOffer', r.offer, 
    poc.Bob.balanceId = r.balanceId, r.txId
  ))
  setTimeout(poc.Bob.resolve, 32000, { tag: 'Bob', timeout: '32s' })
}

function demoCyn (poc) { // {{{1
  let { s, e, c, d } = this
  setTimeout(poc.Cyn.resolve, 31000, { tag: 'Cyn', timeout: '31s' })
}

function onEffectAnn (poc, effect) { // {{{1
  let { s, e, c, d } = this
  let op
  if (effect.type == 'claimable_balance_claimant_created') { // take?
    effect.operation().then(o => (op = o).transaction()).
      then(t => {
        let memo = memo2str(t)
        if (memo.startsWith('Request')) { // no, it's a make
          return;
        }                                 // take:
        //e.log('onEffectAnn', op, memo, effect)
        deal.call(this,
          poc.Ann.account, Keypair.fromSecret(poc.Ann.keys[0]), // maker, kp
          memo, // makeTxId
          op.source_account, // takerPK
          //effect.amount, // amount
          effect.balance_id // balanceId
          //tx // takeTx
        )
      }).catch(e => { throw e; })
  }
}

function onEffectBob (poc, effect) { // {{{1
  let { s, e, c, d } = this
  let tx
  if (effect.type == 'claimable_balance_claimant_created') { // take?
    effect.operation().then(op => op.transaction()).
      then(t => (tx = t).operations()).then(ops => {
        let memo = memo2str(tx)
        if (memo.startsWith('Offer')) {
          return;
        }
        e.log('onEffectBob', ops.records[0].source_account, effect.amount, memo)
      }).catch(e => { throw e; })
  }
}

function onEffectCyn (poc, effect) { // {{{1
  let { s, e, c, d } = this
  //e.log('onEffectCyn', effect)
}

function onIssuerEffectAnn (poc, effect) { // {{{1
  let { s, e, c, d } = this
}

function onIssuerEffectBob (poc, effect) { // {{{1
  let { s, e, c, d } = this
}

async function onIssuerEffectCyn (poc, effect) { // {{{1
  let { s, e, c, d } = this
  let tx, add = r => {
    poc.Cyn.balanceIds.push(r.balanceId)
    return r;
  }
  if (effect.type == 'claimable_balance_claimant_created') { // make
    await effect.operation().then(op => op.transaction()).
      then(t => (tx = t).operations()).then(ops => {
        // Take it!
        //                                    p a y
        //                                   /
        //                                  / Offer
        //                                 /
        //                             take
        //                                 \
        //                                  \ Request
        //                                   \
        //                                    d e l i v e r
        if (tx.memo.startsWith('Offer')) {
          poc.Cyn.takes.push([takeOffer, poc.Cyn.account, 
            Keypair.fromSecret(poc.Cyn.keys[0]), ops.records[0].source_account, 
            tx.id, parseHEXA(description(ops)), '12000'
          ])
        } else {
          poc.Cyn.takes.push([takeRequest, poc.Cyn.account, 
            Keypair.fromSecret(poc.Cyn.keys[0]), ops.records[0].source_account, 
            tx.id, '12000'
          ])
        }
      }).catch(e => { throw e; })
  }
  if (poc.Cyn.takes.length == 2) {
    for (let take of poc.Cyn.takes) {
      let f = take.shift()
      await f.call(this, ...take).then(r => e.log('onIssuerEffectCyn take', add(r)))
    }
  }
}

function onIssuerEffectIssuer (poc, effect) { // {{{1
  let { s, e, c, d } = this
  if (effect.type == 'claimable_balance_claimant_created') {
    e.log('onIssuerEffectIssuer effect', effect)
  }
}

async function pocAgentSellHEXA () { // {{{1
  let { s, e, c, d } = this
  d.XLM = new Asset('XLM', null)
  /*let close = server.orderbook(opt.HEXA, opt.XLM).cursor('now').stream({
    onerror:   e => console.error(e),
    onmessage: b => {
      //let ob = new Orderbook(b)
      //log(ob.line())
      console.dir(b, { depth: null })
    }
  })
  streams.push({ close, tag: 'orderbook' })
  */
  if (d.agent.balances.find(
    b => b.asset_type == 'native' && +b.buying_liabilities > 0
  )) {
    return;
  }
  let ids = await makeSellOffer.call(this,
    Keypair.fromSecret(d.keysAgent[0]), d.agent, d.HEXA, d.XLM, d.limit, 1
  )
  e.log('pocAgentSellHEXA is selling HEXA', d.limit, ...ids)
}

function pocIssuerEffects (poc, effect) { // {{{1
  let { s, e, c, d } = this
  onIssuerEffectIssuer.call(this, poc, effect)
  for (let tag of ['Ann', 'Bob', 'Cyn']) {
    poc[tag].onIssuerEffect.call(this, poc, effect)
  }
}

async function pocSetup () { // {{{1
  let { s, e, c, d } = this, txId = null
  let poc = { // {{{2
    Ann: { act: buyAnn, onEffect: onEffectAnn, onIssuerEffect: onIssuerEffectAnn, },
    Bob: { act: buyBob, onEffect: onEffectBob, onIssuerEffect: onIssuerEffectBob, },
    Cyn: { act: buyCyn,
      balanceIds: [],
      onEffect: onEffectCyn, onIssuerEffect: onIssuerEffectCyn, takes: [],
    },
    cleanup: async _ => { // {{{3
      reclaim.call(this,
        poc.Ann.account, Keypair.fromSecret(poc.Ann.keys[0]), poc.Ann.balanceId
      )
      reclaim.call(this,
        poc.Bob.account, Keypair.fromSecret(poc.Bob.keys[0]), poc.Bob.balanceId
      )
      for (let balanceId of poc.Cyn.balanceIds) {
        await reclaim.call(this, 
          poc.Cyn.account, Keypair.fromSecret(poc.Cyn.keys[0]), balanceId
        )
      }
      e.log('poc.cleanup closing', s.length, 'streams...')
      for (let stream of s) {
        stream.close()
        e.log('poc.cleanup closed stream', stream.tag)
      }
    },
    run: async _ => { // {{{3
      s.push({ tag: "issuer's effects",
        close: e.server.effects().forAccount(d.issuer.id).//cursor('now').
                   stream({
          onerror:   e => { throw e; },
          onmessage: e => pocIssuerEffects.call(this, poc, e)
        })
      })
      for (let tag of ['Ann', 'Bob', 'Cyn']) {
        s.push({ tag: tag + "'s effects",
          close: e.server.effects().forAccount(poc[tag].account.id).cursor('now').
                     stream({
            onerror:   e => { throw e; },
            onmessage: e => poc[tag].onEffect.call(this, poc, e)
          })
        })
      }
      let demo = new Promise((resolve, reject) => {
        let acts = []
        for (let act of [buyAnn, buyBob, buyCyn]) {
          acts.push(
            new Promise((resolve, reject) => act.call(this, poc, resolve, reject))
          )
        }
        Promise.all(acts).then(results => resolve(results))
      })
      await demo.then(r => e.log('poc.run.demo done', r)).
        catch(e => {
          console.error('*** ERROR ***', e.response?.data.extras.result_codes)
          throw e;
        })
      return poc;
    }, // }}}3
  }

  // Create and load Stellar accounts for Ann, Bob, and Cyn: {{{2
  // - fund each account with XLM 2000;
  // - have each account trust ClawableHexa and HEXA;
  // - update each account's HEXA trustline.
  for (let tag of ['Ann', 'Bob', 'Cyn']) {
    if (fs.existsSync(`build/testnet/${tag}.keys`)) {
      poc[tag].keys = loadKeys('build/testnet', tag)
    } else {
      poc[tag].keys = storeKeys('build/testnet', tag)
      txId = await createAccount.call(this,
        poc[tag].keys[1], '2000', {}, d.kp
      )
      e.log('pocSetup created', tag, 'txId', txId)
    }
    poc[tag].account = await e.server.loadAccount(poc[tag].keys[1])
    e.log('pocSetup loaded', tag, poc[tag].account?.id)
    if (txId) { // trust assets, update trustline
      txId = await trustAssets.call(this,
        poc[tag].account, Keypair.fromSecret(poc[tag].keys[0]), d.limit, 
        d.ClawableHexa, d.HEXA
      )
      e.log(tag, 'trusts ClawableHexa, HEXA: limit', d.limit, 'txId', txId)
      txId = await updateTrustline.call(this,
        d.issuer, Keypair.fromSecret(d.keysIssuer[0]), poc[tag].keys[1], d.HEXA
      )
      e.log(tag, ': HEXA trustline updated, txId', txId)
    }
  } // }}}2
  return poc;
}

export { // {{{1
  pocAgentSellHEXA, pocSetup,
}
