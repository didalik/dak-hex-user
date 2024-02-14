/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import * as fs from "node:fs"; // {{{1
import { generate_keypair, } from '../dak/util/public/lib/util.mjs'
import { Asset, AuthClawbackEnabledFlag, AuthRevocableFlag,
  BASE_FEE, Keypair, Horizon, Networks, Operation, TransactionBuilder, 
} from '@stellar/stellar-sdk'

const sleep = ms => new Promise(r => setTimeout(r, ms)) // {{{1
const htmlHead = title => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${title}</title>
  </head>
  <body>
    <samp><p>- starting ${title} on ${Date()}...<br/>
`
const htmlTail = _ => `
- stopping the test on ${Date()}...<br/>
</p></samp></body></html>
`
const runTest = { // {{{1
  end_phase1: async pk => { // {{{2
    const server = new Horizon.Server("https://horizon-testnet.stellar.org")
    let creator = await server.loadAccount(pk) // Horizon.AccountResponse
    log(creator)
    console.log('- PHASE COMPLETE')
    process.exit(2)
  },
  phase0: async url => { // {{{2
    console.log(htmlHead('QA phase 0'))
    fs.existsSync('../build') || fs.mkdirSync('../build')
    if (!fs.existsSync('../build/svc.keys')) {
      let SK_PK = await generate_keypair.call(window.crypto.subtle)
      fs.writeFileSync('../build/svc.keys', SK_PK)
      log('- svc keys written to ../build/svc.keys on REMOTE_HOST')
    }
    process.exit(0)
  },

  phase1: async url => { // {{{2
    console.log(htmlHead('QA phase 1'))
    if (fs.existsSync('../build/testnet.keys')) {
      process.exit(1)
    }
    let pair = Keypair.random()
    log('- phase1 started', pair.secret(), pair.publicKey())
    try {
      const response = await fetch(
        `https://friendbot.stellar.org?addr=${encodeURIComponent(
          pair.publicKey(),
        )}`,
      );
      const responseJSON = await response.json();
      log('<pre> - the HEX_CREATOR account created: txId', responseJSON.id, '</pre>')
      //log('<scrit>window.scrollTo(0, document.body.scrollHeight)</script>')
    } catch (e) {
      console.error("ERROR!", e);
    }
    let SK_PK = pair.secret() + ' ' + pair.publicKey()
    fs.writeFileSync('../build/testnet.keys', SK_PK)
    process.exit(1)
  },

  phase2: async url => { // {{{2
    console.log(htmlHead('QA phase 2'))
    let SK_PK = fs.readFileSync('../build/testnet.keys').toString()
    let [HEX_CREATOR_SK, HEX_CREATOR_PK] = SK_PK.split(' ')
    log('- HEX_CREATOR_PK', HEX_CREATOR_PK)
    const server = new Horizon.Server("https://horizon-testnet.stellar.org")
    let creator = await server.loadAccount(HEX_CREATOR_PK)
    log('- loaded creator', creator?.id)
    await genesis(keypair(HEX_CREATOR_SK), creator, server)
    process.exit(2)
  },

  test1: async url => { // {{{2
    console.log(htmlHead('TEST 1'))
    log('- handle_request url', url)
    await sleep(1000)
    log('- handle_request woke up!')
    await sleep(1000)
    log('- HA!', 'HA!', 'HA!')
    console.log(htmlTail())
    process.exit(127)
  } // }}}2
}

async function createAccount ( // {{{1
  creator, destination, startingBalance, s, opts, ...keypairs
) {
  console.log('<pre> - createAccount', destination)
  try {
    let tx = new TransactionBuilder(creator, { fee: BASE_FEE }).
      addOperation(Operation.createAccount({ destination, startingBalance })).
      addOperation(Operation.setOptions(opts)).
      setNetworkPassphrase(Networks.TESTNET).
      setTimeout(30).build();

    tx.sign(...keypairs)
    tx =  await s.submitTransaction(tx).
      catch(e => console.error(' - ERROR', e, '</pre>'));
    console.log(' - tx.id', tx?.id, '</pre>')
    return tx?.id;
  } catch(e) {
    console.error(' - *** ERROR ***', e)
  }
}

async function fundAgent( // {{{1
  issuer, issuerKeypair, destination, amount, s, ...assets
) {
  console.log('<pre> - fundAgent', destination)
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
    catch(e => console.error(' - ERROR', e, '</pre>'));
  console.log(' - tx.id', tx?.id, '</pre>')
}

async function genesis (kp, creator, server) { // {{{1
  log('- starting genesis...')

  // Add ClawableHexa and HEXA assets Issuer {{{2
  let [HEX_Issuer_SK, HEX_Issuer_PK] = storeKeys('../build/testnet', 'HEX_Issuer')
  let txId = await createAccount(creator, HEX_Issuer_PK, '9', server,
    {
      setFlags: AuthClawbackEnabledFlag | AuthRevocableFlag,
      source: HEX_Issuer_PK,
    },
    kp, keypair(HEX_Issuer_SK)
  )
  txId || process.exit(2)

  const ClawableHexa = new Asset('ClawableHexa', HEX_Issuer_PK)
  const HEXA = new Asset('HEXA', HEX_Issuer_PK)

  // Add HEX Agent {{{2
  let [HEX_Agent_SK, HEX_Agent_PK] = storeKeys('../build/testnet', 'HEX_Agent')
  txId = await createAccount(creator, HEX_Agent_PK, '9', server, {}, kp)
  txId || process.exit(2)

  // Have HEX Agent trust ClawableHexa and HEXA assets {{{2
  let agent = await server.loadAccount(HEX_Agent_PK)
  log('&nbsp;- loaded agent', agent?.id)
  await trustAssets(
    agent, keypair(HEX_Agent_SK), '10000', server, ClawableHexa, HEXA
  )

  // Fund Agent with ClawableHexa and HEXA assets, update Agent's HEXA trustline {{{2
  let issuer = await server.loadAccount(HEX_Issuer_PK)
  log('&nbsp;- loaded issuer', issuer?.id)
  await fundAgent(
    issuer, keypair(HEX_Issuer_SK), HEX_Agent_PK, '10000', server, ClawableHexa, HEXA
  ) // }}}2
  log('- genesis complete.')
}

function keypair (sk) { // {{{1
  return Keypair.fromSecret(sk);
}

function log () { // {{{1
  console.log(...arguments, '<br/>')
}

function storeKeys(dirname, basename) { // {{{1
  fs.mkdirSync(dirname, { recursive: true, })
  let pair = Keypair.random()
  let SK_PK = pair.secret() + ' ' + pair.publicKey()
  fs.writeFileSync(`${dirname}/${basename}.keys`, SK_PK)
  return SK_PK.split(' ')
}

async function trustAssets( // {{{1
  recipient, recipientKeypair, limit, s, ...assets
) {
  let codes = []; assets.forEach(a => codes.push(a.code))
  console.log('<pre> - trustAssets', ...codes)
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
    catch(e => console.error(' - ERROR', e, '</pre>'));
  console.log(' - tx.id', tx?.id, '</pre>')
}

export { runTest, } // {{{1

/* With thanks to: {{{1
 * - https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
 * - https://developers.stellar.org/docs/tutorials/create-account
 *
 * * */
