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
  createAccount, loadKeys, makeBuyOffer, makeSellOffer,
  storeKeys, trustAssets, updateTrustline,
} from './sdk.mjs'

function boughtAlready (poc, tag, buyHEXA, demo) { // {{{1
  let { s, e, c, d } = this
  let bought = poc[tag].account.balances.find(
    b => b.asset_code == 'HEXA' && +b.balance > 0
  )
  !!bought && demo({ balance: bought.balance })
  return !!bought;
}

function buyingHEXA (poc, tag, buyHEXA, demo) { // {{{1
  let { s, e, c, d } = this
  let kp = Keypair.fromSecret(poc[tag].keys[0]), account = poc[tag].account
  e.log(tag, 'buyingHEXA', buyHEXA)
  makeBuyOffer.call(this,
    kp, account, d.HEXA, d.XLM, buyHEXA, 0.9
  ).then(r => setTimeout(_ => makeBuyOffer.call(this,
    kp, account, d.HEXA, d.XLM, tag == 'Bob' ? '0' : buyHEXA, 1, r[1]
  ).then(r => demo(r)), 1000 * (1 + Math.random())))
}

function buyAnn (poc, resolve, reject) { // {{{1
  let { s, e, c, d } = this
  let buyHEXA = '1200', tag = 'Ann'
  let demo = r => demoAnn.call(this, poc, resolve, reject, tag, r)
  boughtAlready.call(this, poc, tag, buyHEXA, demo) ||
    buyingHEXA.call(this, poc, tag, buyHEXA, demo)
}

function buyBob (poc, resolve, reject) { // {{{1
  let { s, e, c, d } = this
  let buyHEXA = '1200', tag = 'Bob'
  let demo = r => demoAnn.call(this, poc, resolve, reject, tag, r)
  buyingHEXA.call(this, poc, tag, buyHEXA, demo)
}

function buyCyn (poc, resolve, reject) { // {{{1
  let { s, e, c, d } = this
  let buyHEXA = '1200', tag = 'Cyn'
  let demo = r => demoAnn.call(this, poc, resolve, reject, tag, r)
  boughtAlready.call(this, poc, tag, buyHEXA, demo) ||
    buyingHEXA.call(this, poc, tag, buyHEXA, demo)
}

function demoAnn (poc, resolve, reject, tag, r) { // {{{1
  let { s, e, c, d } = this
  console.dir({ tag, r }, { depth: null })

  resolve({ tag })
}

function demoBob (poc, resolve, reject, tag, r) { // {{{1
  let { s, e, c, d } = this
  console.dir({ tag, r }, { depth: null })

  resolve({ tag })
}

function demoCyn (poc, resolve, reject, tag, r) { // {{{1
  let { s, e, c, d } = this
  console.dir({ tag, r }, { depth: null })

  resolve({ tag })
}

function onEffectAnn (poc, effect) { // {{{1
  let { s, e, c, d } = this
}

function onEffectBob (poc, effect) { // {{{1
  let { s, e, c, d } = this
}

function onEffectCyn (poc, effect) { // {{{1
  let { s, e, c, d } = this
}

function onIssuerEffectAnn (poc, effect) { // {{{1
  let { s, e, c, d } = this
}

function onIssuerEffectBob (poc, effect) { // {{{1
  let { s, e, c, d } = this
}

function onIssuerEffectCyn (poc, effect) { // {{{1
  let { s, e, c, d } = this
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
  for (let tag of ['Ann', 'Bob', 'Cyn']) {
    poc[tag].onIssuerEffect.call(this, poc, effect)
  }
}

async function pocSetup () { // {{{1
  let { s, e, c, d } = this, txId = null
  let poc = { // {{{2
    Ann: { act: buyAnn, onEffect: onEffectAnn, onIssuerEffect: onIssuerEffectAnn, },
    Bob: { act: buyBob, onEffect: onEffectBob, onIssuerEffect: onIssuerEffectBob, },
    Cyn: { act: buyCyn, onEffect: onEffectCyn, onIssuerEffect: onIssuerEffectCyn, },
    cleanup: async _ => { // {{{3
      e.log('poc.cleanup closing', s.length, 'streams...')
      for (let stream of s) {
        stream.close()
        e.log('poc.cleanup closed stream', stream.tag)
      }
    },
    run: async _ => { // {{{3
      let demo = new Promise((resolve, reject) => {
        s.push({ tag: "issuer's effects",
          close: e.server.effects().forAccount(d.issuer.id).cursor('now').stream({
            onerror:   e => reject(e),
            onmessage: e => pocIssuerEffects.call(this, poc, e)
          })
        })
        for (let tag of ['Ann', 'Bob', 'Cyn']) {
          s.push({ tag: tag + "'s effects",
            close: e.server.effects().forAccount(poc[tag].account.id).stream({
              onerror:   e => reject(e),
              onmessage: e => poc[tag].onEffect.call(this, poc, e)
            })
          })
        }
        let acts = []
        for (let act of [buyAnn, buyBob, buyCyn]) {
          acts.push(
            new Promise((resolve, reject) => act.call(this, poc, resolve, reject))
          )
        }
        Promise.all(acts).then(results => resolve(results))
      })
      await demo.then(r => console.dir(r, { depth: null })).
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
