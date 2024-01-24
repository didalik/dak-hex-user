/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import * as fs from "node:fs"; // {{{1
import { generate_keypair, } from '../dak/util/public/lib/util.mjs'
import { AuthClawbackEnabledFlag, AuthRevocableFlag,
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
    const server = new Horizon.Server("https://horizon-testnet.stellar.org")
    let creator = await server.loadAccount(HEX_CREATOR_PK)
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
  console.log('<pre> - createAccount', destination, '</pre>')
  const tx = new TransactionBuilder(creator, { fee: BASE_FEE }).
    addOperation(Operation.createAccount({ destination, startingBalance })).
    addOperation(Operation.setOptions(opts)).
    setNetworkPassphrase(Networks.TESTNET).
    setTimeout(30).build();

  tx.sign(...keypairs)
  return await s.submitTransaction(tx);
}

async function genesis (kp, creator, server) { // {{{1
  // Add ClawableHexa Issuer {{{2
  let [ClawableHexa_Issuer_SK, ClawableHexa_Issuer_PK] = storeKeys('../build/testnet', 'ClawableHexa_Issuer'), tx
  tx = await createAccount(creator, ClawableHexa_Issuer_PK, '9', server,
    {
      setFlags: AuthClawbackEnabledFlag | AuthRevocableFlag,
      source: ClawableHexa_Issuer_PK,
    },
    kp, keypair(ClawableHexa_Issuer_SK)
  )
  console.log('<pre> - tx.id', tx.id, '</pre>')

// Add HEXA Issuer {{{2
  let [HEXA_Issuer_SK, HEXA_Issuer_PK] = storeKeys('../build/testnet', 'HEXA_Issuer')
  tx = await createAccount(creator, HEXA_Issuer_PK, '9', server, {}, kp)
  console.log('<pre> - tx.id', tx.id, '</pre>')

// Add HEX Agent {{{2
  let [HEX_Agent_SK, HEX_Agent_PK] = storeKeys('../build/testnet', 'HEX_Agent')
  tx - await createAccount(creator, HEX_Agent_PK, '9', server, {}, kp)
  console.log('<pre> - tx.id', tx.id, '</pre>')

// Have Agent trust ClawableHexa and HEXA assets
// Fund Agent with ClawableHexa and HEXA assets 
  // }}}2
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

export { runTest, } // {{{1

/* With thanks to: {{{1
 * - https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
 * - https://developers.stellar.org/docs/tutorials/create-account
 *
 * * */
