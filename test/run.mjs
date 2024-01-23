/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import * as fs from "node:fs"; // {{{1
import { generate_keypair, } from '../dak/util/public/lib/util.mjs'
import pkg from '@stellar/stellar-sdk';
const { Keypair, Horizon, } = pkg;

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
    let pair = sdk.Keypair.random()
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

function log () { // {{{1
  console.log(...arguments, '<br/>')
}

export { runTest, } // {{{1

/* With thanks to: {{{1
 * - https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
 * - https://developers.stellar.org/docs/tutorials/create-account
 *
 * * */
