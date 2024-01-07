/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

const sleep = ms => new Promise(r => setTimeout(r, ms)) // {{{1
const htmlHead = title => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${title}</title>
  </head>
  <body>
    <samp><p>- starting the test on ${Date()}...<br/>
`
const htmlTail = _ => `
- stopping the test on ${Date()}...<br/>
</p></samp></body></html>
`
const runTest = { // {{{1
  test1: async url => {
    console.log(htmlHead('TEST 1'))
    log('- handle_request url', url)
    await sleep(1000)
    log('- handle_request woke up!')
    await sleep(1000)
    log('- HA!', 'HA!', 'HA!')
    console.log(htmlTail())
    process.exit(0)
  }
}

function log () { // {{{1
  console.log(...arguments, '<br/>')
}

export { runTest, } // {{{1

/* With thanks to: {{{1
 * - https://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
 *
 * * */
