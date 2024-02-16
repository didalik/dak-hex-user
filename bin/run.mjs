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
import { pGET, pGET_parms, } from '../dak/util/public/lib/util.mjs'

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

const execute = { // {{{1
  issuer: async _ => {
    let issuer = JSON.parse(fs.readFileSync('issuer.json').toString())
    console.log('- issuer', issuer, 'merging to creator...')
    const server = new Horizon.Server(
      issuer.public ? "https://horizon.stellar.org" 
      : "https://horizon-testnet.stellar.org"
    )
    let [C_SK, C_PK] = loadKeys(issuer.creator_keys)
    let [I_SK, I_PK] = loadKeys(issuer.keys)
    let txId = await mergeAccount(
      await server.loadAccount(I_PK), C_PK,
      issuer.public ? Networks.PUBLIC : Networks.TESTNET, server,
      Keypair.fromSecret(I_SK)
    )
    console.log('- txId', txId)
  },
  run: async (script, ...args) => await execute[script](...args),
}

async function createAccount ( // {{{1
  creator, destination, startingBalance, s, opts, ...keypairs
) {
  //console.log('<pre> - createAccount', destination)
  try {
    let tx = new TransactionBuilder(creator, { fee: BASE_FEE }).
      addOperation(Operation.createAccount({ destination, startingBalance })).
      addOperation(Operation.setOptions(opts)).
      setNetworkPassphrase(Networks.TESTNET).
      setTimeout(30).build();

    tx.sign(...keypairs)
    tx =  await s.submitTransaction(tx).
      catch(e => console.error(' - ERROR', e, '</pre>'));
    //console.log(' - tx.id', tx?.id, '</pre>')
    return tx?.id;
  } catch(e) {
    console.error(' - *** ERROR ***', e)
  }
}

async function fundAgent( // {{{1
  issuer, issuerKeypair, destination, amount, s, ...assets
) {
  //console.log('<pre> - fundAgent', destination)
  let tx = new TransactionBuilder(issuer, // increasing the issuer's
    {                                     //  sequence number
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
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
  tx =  await s.submitTransaction(tx).
    catch(e => console.error(' - *** ERROR ***', e));
  //console.log(' - tx.id', tx?.id, '</pre>')
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
          console.log('- HUH? url', url)
      }
    } catch (e) {
      //console.error(e, line)
    }
  }
}

async function genesis (kp, creator, server, log) { // {{{1

  // Add ClawableHexa and HEXA assets Issuer {{{2
  let HEX_Issuer_SK, HEX_Issuer_PK, txId
  if (fs.existsSync('build/testnet/HEX_Issuer.keys')) {
    let [SK, PK] = loadKeys('build/testnet', 'HEX_Issuer')
    HEX_Issuer_SK = SK; HEX_Issuer_PK = PK
  } else {
    log('- starting genesis...')
    let [SK, PK] = storeKeys('build/testnet', 'HEX_Issuer')
    HEX_Issuer_SK = SK; HEX_Issuer_PK = PK
    txId = await createAccount(creator, HEX_Issuer_PK, '9', server,
      {
        setFlags: AuthClawbackEnabledFlag | AuthRevocableFlag,
        source: HEX_Issuer_PK,
      },
      kp, Keypair.fromSecret(HEX_Issuer_SK)
    )
    txId || process.exit(2)
  }
  if (fs.existsSync('build/testnet/HEX_Agent.keys')) {
    return [server, log];
  }

  const ClawableHexa = new Asset('ClawableHexa', HEX_Issuer_PK)
  const HEXA = new Asset('HEXA', HEX_Issuer_PK)

  // Add HEX Agent {{{2
  let [HEX_Agent_SK, HEX_Agent_PK] = storeKeys('build/testnet', 'HEX_Agent')
  txId = await createAccount(creator, HEX_Agent_PK, '9', server, {}, kp)
  txId || process.exit(2)

  // Have HEX Agent trust ClawableHexa and HEXA assets {{{2
  let agent = await server.loadAccount(HEX_Agent_PK)
  log('- loaded agent', agent?.id)
  await trustAssets(
    agent, Keypair.fromSecret(HEX_Agent_SK), '10000', server, ClawableHexa, HEXA
  )

  // Fund Agent with ClawableHexa and HEXA assets, update Agent's HEXA trustline {{{2
  let issuer = await server.loadAccount(HEX_Issuer_PK)
  log('- loaded issuer', issuer?.id)
  await fundAgent(
    issuer, Keypair.fromSecret(HEX_Issuer_SK), HEX_Agent_PK, '10000', server, ClawableHexa, HEXA
  ) // }}}2
  log('- genesis complete.')
  return [server, log];
}

function loadKeys (dirname, basename = null) { // {{{1
  let SK_PK = fs.readFileSync(
    basename ? `${dirname}/${basename}.keys` : dirname
  )
  return SK_PK.toString().split(' ');
}

async function loadNewCreator (log) { // {{{1
  let HEX_CREATOR_SK, HEX_CREATOR_PK
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
    } catch (e) {
      console.error("ERROR!", e);
    }
  }
  const server = new Horizon.Server("https://horizon-testnet.stellar.org")
  let creator = await server.loadAccount(HEX_CREATOR_PK)
  log('- loaded creator', creator?.id)
  return [Keypair.fromSecret(HEX_CREATOR_SK), creator, server, log];
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
      catch(e => console.error(' - ERROR', e));
    return tx?.id;
  } catch(e) {
    console.error(' - *** ERROR ***', e)
  }
}

async function setupProdFix (exe, server, log) { // {{{1
  switch (exe) {
    case 'issuer': {
      let HEX_I2D_SK, HEX_I2D_PK, txId
      if (!fs.existsSync('build/testnet/HEX_Issuer_todelete.keys')) {
        log('- completing setup...')
        let [SK, PK] = storeKeys('build/testnet', 'HEX_Issuer_todelete')
        let [C_SK, C_PK] = loadKeys('build', 'testnet')
        let creator = await server.loadAccount(C_PK)
        let txId = await createAccount(
          creator, PK, '9', server, {}, Keypair.fromSecret(C_SK)
        )
        log('- HEX_Issuer_todelete txId', txId)
      }
      break
    }
    default:
      throw new Error('- invalid', exe)
  }
  let [SK, PK] = loadKeys('build/testnet', 'HEX_Issuer_todelete')
  let issuer = { 
    creator_keys: `${process.env.PWD}/build/testnet.keys`, 
    keys: `${process.env.PWD}/build/testnet/HEX_Issuer_todelete.keys` 
  }
  fs.writeFileSync('prod/fix/issuer.json', JSON.stringify(issuer))
  log('- setup complete; issuer', issuer)
}

function storeKeys (dirname, basename) { // {{{1
  fs.mkdirSync(dirname, { recursive: true, })
  let pair = Keypair.random()
  let SK_PK = pair.secret() + ' ' + pair.publicKey()
  fs.writeFileSync(`${dirname}/${basename}.keys`, SK_PK)
  return SK_PK.split(' ')
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
  recipient, recipientKeypair, limit, s, ...assets
) {
  let codes = []; assets.forEach(a => codes.push(a.code))
  //console.log('<pre> - trustAssets', ...codes)
  let tx = new TransactionBuilder(recipient, // increasing the recipient's
    {                                        //  sequence number
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    }
  ).addOperation(Operation.changeTrust({ asset: assets[0], limit })).
    addOperation(Operation.changeTrust({ asset: assets[1], limit })).
    setTimeout(30).build()

  tx.sign(recipientKeypair)
  tx =  await s.submitTransaction(tx).
    catch(e => console.error(' - *** ERROR ***', e));
  //console.log(' - tx.id', tx?.id, '</pre>')
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
        let baseline = await genesis(...await loadNewCreator(console.log))
        await setupProdFix(process.argv[3], ...baseline)
        break
      }
      default: // {{{3
        throw new Error(`- invalid ${process.argv[3]}`); // }}}3
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
    await execute[process.argv[2]](process.argv[3], ...process.argv);
  // }}}2
}

/* With thanks to: {{{1
 * - https://jonlinnell.co.uk/articles/node-stdin
 *
 * * */
