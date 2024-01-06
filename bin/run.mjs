#!/usr/bin/env node

/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import crypto from 'node:crypto' // {{{1
//import * as path from "node:path";
import readline from "node:readline";
import fetch from 'node-fetch'
import { Run, } from '../lib/run.mjs'

global.fetch = fetch // {{{1
global.window = {
  CFW_URL_DEV: 'http://127.0.0.1:8787', // used in dak/util/public/lib/util.mjs
  crypto, // now window.crypto can be used in both browser and node
  isNode: true,
}
async function handle_request() { // {{{1
  const rl = readline.createInterface({
    input: process.stdin,
  })
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  for await (const line of rl) {
    let jsoa
    try {
      jsoa = JSON.parse(line)
      log('- handle_request jsoa', jsoa)
      await sleep(2000)
      log('- handle_request woke up!')
      await sleep(3000)
      log('- HA!', 'HA!', 'HA!')
    } catch (e) {
      //console.error(e, line)
    }
  }
}

function log () { // {{{1
  console.log(...arguments, '<br/>')
}

switch (process.argv[2]) { // {{{1
  case 'handle_request': { // {{{2
    await handle_request()
    break
  }
  default: // {{{2
    throw new Error(`- invalid ${process.argv[2]}`);

  // }}}2
}

/* With thanks to: {{{1
 * - https://jonlinnell.co.uk/articles/node-stdin
 * - https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
 *
 * * */
