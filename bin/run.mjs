#!/usr/bin/env node

/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import crypto from 'node:crypto' // {{{1
import readline from "node:readline";
import fetch from 'node-fetch'
import { runTest, } from '../test/run.mjs'
import { pGET, pGET_parms, } from '../dak/util/public/lib/util.mjs'

global.fetch = fetch // {{{1
global.window = {
  CFW_URL_DEV: 'http://127.0.0.1:8787', // used in dak/util/public/lib/util.mjs
  crypto, // now window.crypto.subtle can be used in both browser and node
  isNode: true,
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
    }
  }
  return [
    '?' + result.slice(0, result.length - 1), // trimming trailing '&'
    data2sign,
    e.role ?? 'OWNER'
  ];
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
  case 'svc': { // {{{2
    let remote = process.argv[3]
    let svcRequestPath = process.argv[4]
    await svc(remote, svcRequestPath)
    break
  }
  default: // {{{2
    throw new Error(`- invalid ${process.argv[2]}`);
  // }}}2
}

/* With thanks to: {{{1
 * - https://jonlinnell.co.uk/articles/node-stdin
 *
 * * */
