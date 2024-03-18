#!/usr/bin/env node

/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import crypto from 'node:crypto' // {{{1
import * as fs from "node:fs"
import readline from "node:readline";
import fetch from 'node-fetch'
import { Asset, AuthClawbackEnabledFlag, AuthRevocableFlag,
  BASE_FEE, Keypair, Horizon, Networks, Operation, TransactionBuilder, 
} from '@stellar/stellar-sdk'
import { runTest, } from '../test/run.mjs'
import { pGET, pGET_parms, timestamp, } from '../dak/util/public/lib/util.mjs'
import { Orderbook, offerCreated, offerDeleted, } from '../lib/hex.mjs'

global.fetch = fetch // {{{1
global.window = {
  CFW_URL_DEV: 'http://127.0.0.1:8787', // used in dak/util/public/lib/util.mjs
  crypto, // now window.crypto.subtle can be used in both browser and node
  isNode: true,
}
/*
function sign(...keypairs) {
  keypairs.forEach(kp => console.log(kp))
}

function create(a, b, c, ...keypairs) {
  sign(...keypairs)
}

create(1,2,3,4,5,6)
console.log('XA')
*/

const _htmlHead = (title, intro) => // {{{1
`
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${title}</title>
  </head>
  <script>
    let scroll = _ => window.scrollTo(0,document.body.scrollHeight)
    let id = setInterval(scroll, 100)
    window.onload = _ => {
      scroll()
      clearInterval(id)
    }
  </script>
  <body>
    <samp>${intro}</samp>
    <pre>
`

const _htmlTail = _ => `
</pre></body></html>
`

const _sleep = ms => new Promise(r => setTimeout(r, ms)) // {{{1

const _ts = (...a) => { // {{{1
  let tv = timestamp()
  let prefix = tv > 1674128077678 ? '-' : `+ ${tv} ms:`
  console.log(prefix, ...a)
}

const execute = { // {{{1
  fund_agent: async log => { // {{{2
    let config = configValidate(fs.readFileSync('fund_agent.json').toString(), log)
    const server = new Horizon.Server(
      config.public ? "https://horizon.stellar.org" 
      : "https://horizon-testnet.stellar.org"
    )
    let [HEX_Issuer_SK, HEX_Issuer_PK] = loadKeys(config.keys)
    let [HEX_Agent_SK, HEX_Agent_PK] = loadKeys(config.agent_keys)
    const ClawableHexa = new Asset('ClawableHexa', HEX_Issuer_PK)
    const HEXA = new Asset('HEXA', HEX_Issuer_PK)

    // Have HEX Agent trust ClawableHexa and HEXA assets
    let agent = await server.loadAccount(HEX_Agent_PK), limit = config.limit
    log('- loaded agent', agent?.id)
    let txId = await trustAssets(
      agent, Keypair.fromSecret(HEX_Agent_SK), limit, 
      config.public ? Networks.PUBLIC : Networks.TESTNET, server, ClawableHexa, HEXA
    )
    log('- agent trusts: ClawableHexa, HEXA; limit', limit, 'txId', txId)

    // Fund Agent with ClawableHexa and HEXA assets, update Agent's HEXA trustline
    let i2use = await server.loadAccount(HEX_Issuer_PK)
    log('- loaded issuer', i2use?.id)
    txId = await fundAgent(i2use, Keypair.fromSecret(HEX_Issuer_SK), HEX_Agent_PK,
      limit, config.public ? Networks.PUBLIC : Networks.TESTNET, 
      server, ClawableHexa, HEXA
    )
    log('- agent funded: ClawableHexa, HEXA; amount', limit, 'txId', txId)
  },

  issuer: async log => { // {{{2
    let config = configValidate(fs.readFileSync('issuer.json').toString(), log)
    const server = new Horizon.Server(
      config.public ? "https://horizon.stellar.org" 
      : "https://horizon-testnet.stellar.org"
    )
    let [C_SK, C_PK] = loadKeys(config.creator_keys)
    let [I_SK, I_PK] = loadKeys(config.todelete_keys)
    let i2d = await server.loadAccount(I_PK)
    log('- issuer', config, i2d.id, ': merging to creator...')
    let txId = await mergeAccount(i2d, C_PK,
      config.public ? Networks.PUBLIC : Networks.TESTNET, server,
      Keypair.fromSecret(I_SK)
    )
    log('- issuer merged to', C_PK, ': txId', txId)

    let [HEX_Issuer_SK, HEX_Issuer_PK] = loadKeys(config.keys)
    let [HEX_Agent_SK, HEX_Agent_PK] = loadKeys(config.agent_keys)
    const ClawableHexa = new Asset('ClawableHexa', HEX_Issuer_PK)
    const HEXA = new Asset('HEXA', HEX_Issuer_PK)

    // Have HEX Agent trust ClawableHexa and HEXA assets
    let agent = await server.loadAccount(HEX_Agent_PK), limit = config.limit
    log('- loaded agent', agent?.id)
    txId = await trustAssets(
      agent, Keypair.fromSecret(HEX_Agent_SK), limit, 
      config.public ? Networks.PUBLIC : Networks.TESTNET, server, ClawableHexa, HEXA
    )
    log('- agent trusts: ClawableHexa, HEXA; limit', limit, 'txId', txId)

    // Fund Agent with ClawableHexa and HEXA assets, update Agent's HEXA trustline
    let i2use = await server.loadAccount(HEX_Issuer_PK)
    log('- loaded issuer', i2use?.id)
    txId = await fundAgent(i2use, Keypair.fromSecret(HEX_Issuer_SK), HEX_Agent_PK,
      limit, config.public ? Networks.PUBLIC : Networks.TESTNET, 
      server, ClawableHexa, HEXA
    )
    log('- agent funded: ClawableHexa, HEXA; amount', limit, 'txId', txId)
  },

  poc: async (log, ...args) => { // {{{2
    log(_htmlHead('Stellar HEX PoC', `<h3>The PoC demo started on ${Date()}</h3>`))
    let baseline = await setup(...await loadCreator(log))
    baseline.push('10000', [], {}) //limit, streams, opt
    log('- agent funded ClawableHexa, HEXA', ...await pocFundAgent(...baseline))
    log('- agent is selling HEXA', ...await pocAgentSellHEXA(...baseline))
    await setupPoC(...baseline).
      then(poc => poc.run()).then(ns => ns.cleanup()).
      catch(e => { throw e; })
  },

  run: async (script, ...args) => await execute[script](console.log, ...args), // {{{2

  //run: async (script, ...args) => await execute[script](_ts, ...args), // {{{2

  setup_it: async _ => { // {{{2
    const rl = readline.createInterface({
      input: process.stdin,
    })
    for await (const line of rl) {
      let jsoa
      try {
        jsoa = JSON.parse(line)
        let url = jsoa.request.url
        switch (true) {
          case /\/dynamic\/test/.test(url):
          case /\/qa\/phase/.test(url):
            await runTest[url.split('/')[2]](url)
          default:
            console.log(_htmlHead('TESTS', 
              `<h3>Integration tests started on ${Date()}</h3>`
            ))
            console.log('- HUH? url', url)
            process.exit(0)
        }
      } catch (e) {
        console.error(e, line)
      }
    }
  },

  setup_ut: async (...args) => { // {{{2
    const rl = readline.createInterface({
      input: process.stdin,
    })
    for await (const line of rl) {
      let jsoa
      try {
        jsoa = JSON.parse(line)
        let url = jsoa.request.url
        switch (true) {
          case /\/dynamic\/test/.test(url):
          case /\/qa\/phase/.test(url):
            await runTest[url.split('/')[2]](url)
          default:
            console.log(_htmlHead('DEV TEST', 
              `<h3>DEV test started on ${Date()}</h3>`
            ))
            //console.log('- HUH? url', url)
            console.log('- setup_ut args', args)

            process.exit(0)
        }
      } catch (e) {
        console.error(e, line)
      }
    }
  },

  // }}}2
}

const htmlHead = // {{{1
  title => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${title}</title>
  </head>
  <body>
    <pre>
`
const htmlTail = _ => `
</pre></body></html>
`

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function createAccount ( // {{{1
  creator, destination, startingBalance, s, opts, ...keypairs
) {
  try {
    let tx = new TransactionBuilder(creator, { fee: BASE_FEE }).
      addOperation(Operation.createAccount({ destination, startingBalance })).
      addOperation(Operation.setOptions(opts)).
      setNetworkPassphrase(Networks.TESTNET).
      setTimeout(30).build();

    tx.sign(...keypairs)
    tx =  await s.submitTransaction(tx).catch(e => {
      console.error(' - *** ERROR ***', e.response.data); throw Error()
      // TODO retry on 'tx_too_late'
    })
    return tx?.id;
  } catch(e) {
    console.error(' - *** ERROR ***', e); throw Error()
  }
}

async function fundAgent( // {{{1
  issuer, issuerKeypair, destination, amount, nw, s, ...assets
) {
  let tx = new TransactionBuilder(issuer, // increasing the issuer's
    {                                     //  sequence number
      fee: BASE_FEE,
      networkPassphrase: nw,
    }
  ).addOperation(Operation.payment({ asset: assets[0], destination, amount })).
    addOperation(Operation.payment({ asset: assets[1], destination, amount })).
    addOperation(Operation.setTrustLineFlags({ 
      asset: assets[1],
      trustor: destination,
      flags: {
        clawbackEnabled: false
      },
    })).
    setTimeout(30).build()

  tx.sign(issuerKeypair)
  tx =  await s.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  return tx?.id;
}

async function handle_request() { // {{{1
  const rl = readline.createInterface({
    input: process.stdin,
  })
  for await (const line of rl) {
    let jsoa
    try {
      jsoa = JSON.parse(line)
      let url = jsoa.request.url
      switch (true) {
        case /\/dynamic\/test/.test(url):
        case /\/qa\/phase/.test(url):
          await runTest[url.split('/')[2]](url)
        default:
          console.log(htmlHead('INVALID'))
          console.log('- HUH? url', url)
          console.log(htmlTail())
          await sleep(500) // for visual effect only
          process.exit(0)
      }
    } catch (e) {
      //console.error(e, line)
    }
  }
}

function configValidate (s, log) { // {{{1
  let config = JSON.parse(s)
  config.public = s.indexOf('/public/') > -1
  return config;
}

async function loadCreator (log, server = null, doLoad = false) { // {{{1
  server ??= new Horizon.Server("https://horizon-testnet.stellar.org")
  let HEX_CREATOR_SK, HEX_CREATOR_PK, creator = null
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
      log('- the HEX_CREATOR account created: txId', responseJSON.id)
      doLoad = true
    } catch (e) {
      console.error("ERROR!", e);
    }
  }
  if (doLoad) {
    creator = await server.loadAccount(HEX_CREATOR_PK)
    log('- loaded creator', creator?.id)
  }
  return [Keypair.fromSecret(HEX_CREATOR_SK), creator, server, log];
}

function loadKeys (dirname, basename = null) { // {{{1
  let SK_PK = fs.readFileSync(
    basename ? `${dirname}/${basename}.keys` : dirname
  )
  let pair = SK_PK.toString().split(' ')
  return [pair[0].trim(), pair[1].trim()];
}

async function makeBuyOffer( // {{{1
  buying, selling, buyAmount, price, offerId = 0
) {
  let [nw, server, log, kp, account] = this.env
  log('- makeBuyOffer', account.id, 'buying', buying.code,
    'selling', selling.code, 'buyAmount', buyAmount, 'price', price,
    'offerId', offerId
  )
  let tx = new TransactionBuilder(account, // increasing account's
    {                                      //  sequence number
      fee: BASE_FEE, networkPassphrase: nw,
    }
  ).addOperation(Operation.manageBuyOffer({
    selling, buying, buyAmount, price, offerId
  })).setTimeout(30).build()

  tx.sign(kp)
  tx =  await server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  let made = buyAmount == '0' || +offerId > 0 ? offerDeleted(tx.result_xdr)
  : offerCreated(tx.result_xdr)
  log('- makeBuyOffer', account.id, tx.id, made.offer.id)
  return Promise.resolve([tx.id, made.offer.id]);
}

async function makeSellOffer( // {{{1
  selling, buying, amount, price, offerId = 0
) {
  let [nw, server, log, kp, account] = this.env
  let tx = new TransactionBuilder(account, // increasing account's
    {                                      //  sequence number
      fee: BASE_FEE, networkPassphrase: nw,
    }
  ).addOperation(Operation.manageSellOffer({
    selling, buying, amount, price, offerId
  })).setTimeout(30).build()

  tx.sign(kp)
  tx =  await server.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  let made = offerCreated(tx.result_xdr, 'manageSellOfferResult')
  return Promise.resolve([tx.id, made.offer.id]);
}

async function mergeAccount ( // {{{1
  source, destination, networkPassphrase, server, ...keypairs
) {
  try {
    let tx = new TransactionBuilder(source, { fee: BASE_FEE }).
      addOperation(Operation.accountMerge({ destination })).
      setNetworkPassphrase(networkPassphrase).
      setTimeout(30).build();

    tx.sign(...keypairs)
    tx =  await server.submitTransaction(tx).
      catch(e => console.error(' - ERROR', e.response.data));
    return tx?.id;
  } catch(e) {
    console.error(' - *** ERROR ***', e)
  }
}

async function pocAgentSellHEXA ( // {{{1
  server, log, HEX_Issuer_SK, HEX_Issuer_PK, HEX_Agent_SK, HEX_Agent_PK,
  limit, streams, opt
) {
  opt.XLM = new Asset('XLM', null)
  let close = server.orderbook(opt.HEXA, opt.XLM).stream({
    onerror:   e => console.error(e),
    onmessage: b => {
      let ob = new Orderbook(b)
      //log(ob.line())
      console.dir(b, { depth: null })
    }
  })
  streams.push({ close, tag: 'orderbook' })

  if (opt.agent.balances.find(
    b => b.asset_type == 'native' && +b.buying_liabilities > 0
  )) {
    return [limit, null];
  }
  return [limit, ...await makeSellOffer.call(
    {
      env: [
        Networks.TESTNET, server, log, Keypair.fromSecret(HEX_Agent_SK), opt.agent
      ]
    }, 
    opt.HEXA, opt.XLM, limit, 1
  )];
}

async function pocFundAgent ( // {{{1
  server, log, HEX_Issuer_SK, HEX_Issuer_PK, HEX_Agent_SK, HEX_Agent_PK, 
  limit, streams, opt
) {
  const ClawableHexa = new Asset('ClawableHexa', HEX_Issuer_PK)
  opt.ClawableHexa = ClawableHexa
  const HEXA = new Asset('HEXA', HEX_Issuer_PK)
  opt.HEXA = HEXA

  // Have HEX Agent trust ClawableHexa and HEXA assets
  let agent = await server.loadAccount(HEX_Agent_PK)
  opt.agent = agent
  log('- loaded agent', agent?.id)
  if (agent.balances.length == 3) {
    return [limit, 'txId', null];
  }
  let txId = await trustAssets( agent, Keypair.fromSecret(HEX_Agent_SK), limit, 
    Networks.TESTNET, server, ClawableHexa, HEXA
  )
  log('- agent trusts: ClawableHexa, HEXA; limit', limit, 'txId', txId)

  // Fund Agent with ClawableHexa and HEXA assets, update Agent's HEXA trustline
  let i2use = await server.loadAccount(HEX_Issuer_PK)
  log('- loaded issuer', i2use?.id)
  return [limit, 'txId', await fundAgent(i2use, Keypair.fromSecret(HEX_Issuer_SK),
    HEX_Agent_PK, limit, Networks.TESTNET, server, ClawableHexa, HEXA
  )];
}

async function setup (kp, creator, server, log) { // {{{1

  // Add ClawableHexa and HEXA assets Issuer {{{2
  let HEX_Issuer_SK, HEX_Issuer_PK, txId
  if (fs.existsSync('build/testnet/HEX_Issuer.keys')) {
    let [SK, PK] = loadKeys('build/testnet', 'HEX_Issuer')
    HEX_Issuer_SK = SK; HEX_Issuer_PK = PK
  } else {
    log('- starting setup...')
    let [SK, PK] = storeKeys('build/testnet', 'HEX_Issuer')
    HEX_Issuer_SK = SK; HEX_Issuer_PK = PK
    txId = await createAccount(creator, HEX_Issuer_PK, '9', server,
      {
        homeDomain: 'hex.didalik.workers.dev',
        setFlags: AuthClawbackEnabledFlag | AuthRevocableFlag,
        source: HEX_Issuer_PK,
      },
      kp, Keypair.fromSecret(HEX_Issuer_SK)
    )
    log('- setup created HEX_Issuer', HEX_Issuer_PK, ': txId', txId)
  }

  // Add HEX Agent {{{2
  if (fs.existsSync('build/testnet/HEX_Agent.keys')) {
    let [HEX_Agent_SK, HEX_Agent_PK] = loadKeys('build/testnet', 'HEX_Agent')
    return [server, log, HEX_Issuer_SK, HEX_Issuer_PK, HEX_Agent_SK, HEX_Agent_PK];
  }
  let [HEX_Agent_SK, HEX_Agent_PK] = storeKeys('build/testnet', 'HEX_Agent')
  txId = await createAccount(creator, HEX_Agent_PK, '9', server, {}, kp)
  log('- setup created HEX_Agent', HEX_Agent_PK, ': txId', txId)

  // }}}2
  log('- setup complete.')
  return [server, log, HEX_Issuer_SK, HEX_Issuer_PK, HEX_Agent_SK, HEX_Agent_PK];
}

async function setupPoC ( // {{{1
  server, log, HEX_Issuer_SK, HEX_Issuer_PK, HEX_Agent_SK, HEX_Agent_PK,
  limit, streams, opt
) {
  let poc = { // {{{2
    Ann: {}, Bob: {}, Cyn: {},
    cleanup: async _ => {
      log('- poc.cleanup closing', streams.length, 'streams...')
      for (let stream of streams) {
        stream.close()
        log('- poc.cleanup closed stream', stream.tag)
      }
    },
    run: async _ => {
      return poc;
    },
  }

  // Create and load Stellar accounts for Ann, Bob, and Cyn: {{{2
  // - fund each account with XLM 2000;
  // - have each account trust ClawableHexa and HEXA;
  // - update each account's HEXA trustline.
  let [kp, creator, s2, l2] = await loadCreator(log, server, true), txId
  for (let tag of ['Ann', 'Bob', 'Cyn']) {
    if (fs.existsSync(`build/testnet/${tag}.keys`)) {
      poc[tag].keys = loadKeys('build/testnet', tag)
    } else {
      poc[tag].keys = storeKeys('build/testnet', tag)
      txId = await createAccount(
        creator, poc[tag].keys[1], '2000', server, {}, kp
      )
      log('- setupPoC created', tag, poc[tag].keys[1], 'txId', txId)
    }
    poc[tag].account = await server.loadAccount(poc[tag].keys[1])
    log('- setupPoC loaded', tag, poc[tag].account?.id)
    if (txId) { // trust assets, update trustline
      txId = await trustAssets(
        poc[tag].account, Keypair.fromSecret(poc[tag].keys[0]), limit, 
        Networks.TESTNET, server, opt.ClawableHexa, opt.HEXA
      )
      log('-', tag, 'trusts: ClawableHexa, HEXA; limit', limit, 'txId', txId)
      let i2use = await server.loadAccount(HEX_Issuer_PK)
      txId = await updateTrustline(
        i2use, Keypair.fromSecret(HEX_Issuer_SK), poc[tag].keys[1],
        Networks.TESTNET, server, opt.HEXA
      )
      log('-', tag, ': HEXA trustline updated', 'txId', txId)
    }
  }

  // Have Ann and Cyn buy HEXA 1200 {{{2
  let trades = []
  for (let tag of ['Ann', 'Bob', 'Cyn']) {
    let accountId = poc[tag].account.id
    let trade = new Promise((resolve, reject) => {
      streams.push({ tag: tag + "'s offers",
        close: server.offers().forAccount(accountId).stream({
          onerror:   e => reject(e),
          onmessage: o => console.dir(o, { depth: null })
        })
      }, { tag: tag + "'s trades",
        close: server.effects().forAccount(accountId).stream({
          onerror:   e => reject(e),
          onmessage: e => e.type == 'trade' && console.dir(e, { depth: null })
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

  return poc;
}

async function setupProdFix (exe, server, log) { // {{{1
  let config = { 
    agent_keys: `${process.env.PWD}/build/testnet/HEX_Agent.keys`,
    creator_keys: `${process.env.PWD}/build/testnet.keys`, 
    keys: `${process.env.PWD}/build/testnet/HEX_Issuer.keys`,
    limit: '100000',
  }
  switch (exe) {
    case 'issuer': {
      let HEX_I2D_SK, HEX_I2D_PK, txId
      if (!fs.existsSync('build/testnet/HEX_Issuer_todelete.keys')) {
        let [SK, PK] = storeKeys('build/testnet', 'HEX_Issuer_todelete')
        let [C_SK, C_PK] = loadKeys('build', 'testnet')
        let creator = await server.loadAccount(C_PK)
        let txId = await createAccount(
          creator, PK, '9', server, {}, Keypair.fromSecret(C_SK)
        )
        log('- HEX_Issuer_todelete', PK, ': txId', txId)
      }
      config.todelete_keys = `${process.env.PWD}/build/testnet/HEX_Issuer_todelete.keys` 
      break
    }
    case 'fund_agent':
      break
    default:
      throw new Error(`- invalid ${exe}`)
  }
  fs.writeFileSync(`prod/fix/${exe}.json`, JSON.stringify(config))
  log('- setup config', config, 'written to', `${process.env.PWD}/prod/fix/${exe}.json`)
}

function storeKeys (dirname, basename) { // {{{1
  fs.mkdirSync(dirname, { recursive: true, })
  let pair = Keypair.random()
  let SK_PK = pair.secret() + ' ' + pair.publicKey()
  fs.writeFileSync(`${dirname}/${basename}.keys`, SK_PK)
  let p = SK_PK.toString().split(' ')
  return [p[0].trim(), p[1].trim()];
}

async function svc(remoteStr, svcRequestPath, nogetStr = 'get') { // {{{1
  let [parms, data2sign, role] = await svc_parms.call( // {{{3
    this, remoteStr, svcRequestPath
  )
  let [privateKey, publicKey, host, noget] = 
    await pGET_parms.call(window.crypto.subtle, remoteStr, nogetStr, role)
  let text = await pGET.call(window.crypto.subtle,
    '/svc/' + svcRequestPath, parms,
    { data2sign, privateKey, publicKey }, host, noget
  )
  if (typeof text == 'number' && +text == 400) { // user FOUND
    console.log('- PHASE COMPLETE')
    process.exit(1)
  }
  try { // {{{3
    console.dir(JSON.parse(text), { depth: null });
    console.log('- PHASE COMPLETE')
    return 'OK';
  } catch(e) {
    console.error(e)
    return text;
  } // }}}3
}

async function svc_parms (remoteStr, path, e = process.env) { // {{{1
  let result = '', i = 0, data2sign = Date.now()

  switch (path) {
    case 'newuser': { // {{{2
      e.role = 'SIGNER'
      let key = ['USER_PK', 'SVC_PK', 'actorPK']
      for (let p of [e.USER_PK, e.SVC_PK, e.SIGNER_PK]) {
        result += `${key[i++]}=${encodeURIComponent(p)}&`
      }
      break
    } // }}}2
  }
  return [
    '?' + result.slice(0, result.length - 1), // trimming trailing '&'
    data2sign,
    e.role ?? 'OWNER'
  ];
}

async function trustAssets( // {{{1
  recipient, recipientKeypair, limit, nw, s, ...assets
) {
  let tx = new TransactionBuilder(recipient, // increasing the recipient's
    {                                        //  sequence number
      fee: BASE_FEE,
      networkPassphrase: nw,
    }
  ).addOperation(Operation.changeTrust({ asset: assets[0], limit })).
    addOperation(Operation.changeTrust({ asset: assets[1], limit })).
    setTimeout(30).build()

  tx.sign(recipientKeypair)
  tx =  await s.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  return tx?.id;
}

async function updateTrustline( // {{{1
  issuer, issuerKeypair, trustor, nw, s, asset
) {
  let tx = new TransactionBuilder(issuer, // increasing the issuer's
    {                                     //  sequence number
      fee: BASE_FEE,
      networkPassphrase: nw,
    }
  ).addOperation(Operation.setTrustLineFlags({ asset, trustor,
      flags: {
        clawbackEnabled: false
      },
    })).
    setTimeout(30).build()

  tx.sign(issuerKeypair)
  tx =  await s.submitTransaction(tx).catch(e => console.error(
    '*** ERROR ***', e.response.data.extras.result_codes
  ))
  return tx?.id;
}

switch (process.argv[2]) { // {{{1
  case 'end_phase1': { // {{{2
    await runTest.end_phase1(process.env.HEX_CREATOR_PK)
    break
  }
  case 'handle_request': { // {{{2
    await handle_request()
    break
  }
  case 'setup': { // {{{2
    //console.log('- setup process.argv', process.argv, 'process.env', process.env)
    switch (process.argv[4]) {
      case 'prod/fix': { // {{{3
        let baseline = await setup(...await loadCreator(console.log))
        await setupProdFix(process.argv[3], ...baseline)
        break
      }
      default: // {{{3
        throw new Error(`invalid dir '${process.argv[4]}'`); // }}}3
    }
    break
  }
  case 'svc': { // {{{2
    let remote = process.argv[3]
    let svcRequestPath = process.argv[4]
    await svc(remote, svcRequestPath)
    break
  }
  default: // {{{2
    await execute[process.argv[2]](process.argv[3], ...process.argv)
  // }}}2
}

/* With thanks to: {{{1
 * - https://jonlinnell.co.uk/articles/node-stdin
 *
 * * */
