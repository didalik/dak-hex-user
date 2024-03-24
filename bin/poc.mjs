#!/usr/bin/env node

/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import { // {{{1
  addHEX_CREATOR, addHEX_Agent, addHEX_Issuer, 
} from '../lib/sdk.mjs'
import { pocAgentSellHEXA, pocSetup, } from '../lib/poc.mjs'
import { timestamp, } from '../dak/util/public/lib/util.mjs'

const htmlHead = (title, intro) => // {{{1
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

const ts = (...a) => { // {{{1
  let tv = timestamp()
  let prefix = tv > 1674128077678 ? '- process.argv' : `+ ${tv} ms:`
  console.log(prefix, ...a)
}

const execute =  { // {{{1
  poc: async (log, ...args) => { // {{{2
    log(args)
    let secd = await addHEX_CREATOR(log), amountHEXA = '10000'
    await addHEX_Issuer.call(secd, 'hex.didalik.workers.dev')
    await addHEX_Agent.call(secd, amountHEXA)
    await pocAgentSellHEXA.call(secd)
    await pocSetup.call(secd).
      then(poc => poc.run.call(secd)).then(ns => ns.cleanup.call(secd)).
      catch(e => { throw e; })
    secd.c.account != null && console.dir(secd, { depth: null })
    log('ready')
  },
  run: async (script, ...args) => await execute[script]( // {{{2
    //console.log, ...args
    ts, ...args
  ),

  // }}}2
}

console.log(htmlHead( // {{{1
  'Stellar HEX PoC', `<h3>The PoC demo started on ${Date()}</h3>`
))
try {
  await execute[process.argv[2]](process.argv[3], ...process.argv)
} catch(e) {
  console.log(e)
  console.error(e)
  process.exit(2)
}
