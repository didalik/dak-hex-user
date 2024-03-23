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

function pocIssuerEffects (poc, effect, resolve) { // {{{1
  let { s, e, c, d } = this
  poc.issuerEffectsCount = poc.issuerEffectsCount ? ++poc.issuerEffectsCount : 1
  /*
  for (let tag of ['Ann', 'Bob', 'Cyn']) {
    poc[tag].onIssuerEffect(effect, resolve)
  }
  */
  //console.dir({ issuerEffectsCount: poc.issuerEffectsCount, e }, { depth: null })
  poc.issuerEffectsCount == 1 && setTimeout(
    a => poc.started || resolve(a), 6000, { poc, timeout: '6s' }
  )
}

async function pocSetup () { // {{{1
  let { s, e, c, d } = this, txId = null
  let poc = { // {{{2
    Ann: {}, Bob: {}, Cyn: {},
    cleanup: async _ => {
      e.log('poc.cleanup closing', s.length, 'streams...')
      for (let stream of s) {
        stream.close()
        e.log('poc.cleanup closed stream', stream.tag)
      }
    },
    run: async _ => {
      //console.dir({ poc }, { depth: null })
      let demo = new Promise((resolve, reject) => {
        s.push({ tag: "issuer's effects",
          close: e.server.effects().forAccount(d.issuer.id).//cursor('now').
                   stream({
            onerror:   e => reject(e),
            onmessage: e => pocIssuerEffects.call(this, poc, e, resolve)
          })
        })
      })
      /*
      for (let act of [pocAnn, pocBob, pocCyn]) {
        act.call(env)
      }
      */
      await demo.then(r => console.dir(r, { depth: null })).
        catch(e => console.error(
          '*** ERROR ***', e.response.data.extras.result_codes
      ))
      return poc;
    },
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
  }

  /*/ Have Ann and Cyn buy HEXA 1200 {{{2
  let trades = [], traded = (tag, e) => {
    console.dir({ tag, e }, { depth: null })
    poc[tag].traded = true
  }
  for (let tag of ['Ann', 'Bob', 'Cyn']) {
    let accountId = poc[tag].account.id
    let trade = new Promise((resolve, reject) => {
      streams.push(
      { tag: tag + "'s effects",
        close: server.effects().forAccount(accountId).stream({
          onerror:   e => reject(e),
          onmessage: e => poc[tag].onEffect ? poc[tag].onEffect(e)
          : e.type == 'trade' && traded(tag, e)
        })
      })
      let env = { env: [
        Networks.TESTNET, server, log, 
        Keypair.fromSecret(poc[tag].keys[0]), poc[tag].account
      ] }
      makeBuyOffer.call(
        env,
        opt.HEXA, opt.XLM, '1200', 0.9
      ).then(r => setTimeout(_ => makeBuyOffer.call(
        env,
        opt.HEXA, opt.XLM, tag == 'Bob' ? '0' : '1200', 1, r[1]
      ).then(r => resolve(r)), 1000 * (1 + Math.random())))
    })
    trades.push(trade)
  }
  await Promise.all(trades).then(tIds => log('- setupPoC tradeIds', tIds)).
    catch(e => console.error(
      '*** ERROR ***', e.response.data.extras.result_codes
    )); // }}}2
*/
  return poc;
}

export { // {{{1
  pocAgentSellHEXA, pocSetup,
}
