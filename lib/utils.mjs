/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

const CFW_URL_DEV = 'https://he-agent.didalik.workers.dev' // {{{1

class Semaphore { // {{{1
  // Source: {{{2
  // https://github.com/jsoendermann/semaphore-async-await

  #permits // {{{2
  #promiseResolverQueue

  constructor (permits) { // {{{2
    this.#permits = permits
    this.#promiseResolverQueue = []
  }

  acquire () { // {{{2
    return this.wait();
  }

  /** drainPermits {{{2
   * Acquires all permits that are currently available and returns the number 
   * of acquired permits.
   * @returns  Number of acquired permits.
   */
  drainPermits () {
    if (this.#permits > 0) {
      const permitCount = this.#permits;
      this.#permits = 0;
      return permitCount;
    }

    return 0;
  }

  /** async execute {{{2
   * Schedules func to be called once a permit becomes available.
   * Returns a promise that resolves to the return value of func.
   * @param func  The function to be executed.
   * @return  A promise that gets resolved with the return value of the function.
   */
  async execute (func) {

    //console.log(this.#promiseResolverQueue.length, this.#permits, func)

    await this.wait();
    try {
      return await func();
    } catch(e) {
      console.error(e)
      alert(e)
    } finally {

      //console.log(this.#promiseResolverQueue.length, this.#permits, 'DONE', func)

      this.signal();
    }
  }

  getPermits () { // {{{2
    return this.#permits;
  }

  /** release {{{2
   * Alias for this.signal.
   */
  release () {
    this.signal();
    return true;
  }

  /** signal {{{2
   * Increases the number of permits by one. If there are other functions waiting, 
   * one of them will continue to execute in a future iteration of the event loop.
   */
  signal () {
    this.#permits += 1;

    if (this.#permits > 1 && this.#promiseResolverQueue.length > 0) {
      throw new Error(
        'Semaphore.permits should never be > 0 when there is someone waiting.'
      );
    } else if (this.#permits === 1 && this.#promiseResolverQueue.length > 0) {
      // If there is someone else waiting, immediately consume the permit that was 
      // released at the beginning of this function and let the waiting function 
      // resume.
      this.#permits -= 1;

      const nextResolver = this.#promiseResolverQueue.shift();
      if (nextResolver) {
        nextResolver(true);
      }
    }
  }

  /** tryAcquire {{{2
   * Synchronous function that tries to acquire a permit and returns 
   * true if successful, false otherwise.
   * @returns  Whether a permit could be acquired.
   */
  tryAcquire () {
    if (this.#permits > 0) {
      this.#permits -= 1;
      return true;
    }

    return false;
  }

  wait () { // {{{2
    if (this.#permits > 0) {
      this.#permits -= 1;
      return Promise.resolve(true);
    }

    // If there is no permit available, we return a promise that resolves 
    // once the semaphore gets signaled enough times that permits is equal to one.
    return new Promise(resolver => this.#promiseResolverQueue.push(resolver));
  }

  /** async waitFor {{{2
   * Same as this.wait except the promise returned gets resolved with false if no
   * permit becomes available in time.
   * @param milliseconds  The time spent waiting before the wait is aborted. 
   * This is a lower bound, you shouldn't rely on it being precise.
   * @returns  A promise that gets resolved to true when execution is allowed to 
   * proceed or false if the time given elapses before a permit becomes available.
   */
  async waitFor (milliseconds) {
    if (this.#permits > 0) {
      this.#permits -= 1;
      return Promise.resolve(true);
    }

    // We save the resolver function in the current scope so that we can 
    // resolve the promise to false if the time expires. TODO use reject instead?
    let resolver
    const promise = new Promise(r => { resolver = r })

    // The saved resolver gets added to our list of promise resolvers so that it gets
    // a chance to be resolved as a result of a call to signal().
    this.#promiseResolverQueue.push(resolver);

    setTimeout(() => {
      // We have to remove the promise resolver from our list. Resolving it twice 
      // would not be an issue but signal() always takes the next resolver from the
      // queue and resolves it which would swallow a permit if we didn't remove it.
      const index = this.#promiseResolverQueue.indexOf(resolver);
      if (index !== -1) {
        this.#promiseResolverQueue.splice(index, 1);
      } else {
        // This shouldn't happen, not much we can do at this point
        throw new Error(
          `Semaphore.waitFor couldn't find its promise resolver in the queue`
        );
      }

      // Resolve to false because the wait was unsuccessful.
      resolver(false);
    }, milliseconds);

    return promise;
  }

  // }}}2
}

function b64_to_utf8( str ) { // {{{1
  return decodeURIComponent(escape(atob( str )));
}

function delay (ms, result = 'OK') { // {{{1
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(result), ms)
  });
}

async function doGET ( // {{{1
  path = '', 
  secret = null, 
  log = false, 
  parms = '', 
  site = CFW_URL_DEV
) {
  let keypair = secret ? window.StellarSdk.Keypair.fromSecret(secret)
  : window.StellarSdk.Keypair.random()
  let data = keypair.publicKey()
  let signature = keypair.sign(data)
  signature = signature.toString('base64')
  let parmsTail = `sk=ASK_&network=${window.StellarNetwork.id}&${data}=${signature}`
  parms = parms.length == 0 ? `?${parmsTail}` : parms + `&${parmsTail}`
  log && console.log('doGET parms', parms)

  let result = await fetch(`${site}${path}${parms}`, { method: 'GET', })
    .then(async response => {
      if (response.ok) {
        return await response.text();
      }
      console.error(data, parms)
      throw new Error(response.status)
    })
    .catch(e => { throw e; })

  return result;
}

function getClaimableBalanceId (result_xdr, index = 0) { // {{{1
  let txResult = window.StellarSdk.xdr.TransactionResult.fromXDR(result_xdr, "base64");
  let results = txResult.result().results();
  let operationResult = results[index].value().createClaimableBalanceResult();
  let balanceId = operationResult.balanceId().toXDR("hex");
  //console.log('getClaimableBalanceId balanceId', balanceId)
  return balanceId;
}

function pGET ( // {{{1
  path = '', 
  parms = '', 
  secret = null,
  noget = false,
  site = CFW_URL_DEV
) {
  let keypair = secret ? window.StellarSdk.Keypair.fromSecret(secret)
  : window.StellarSdk.Keypair.random()
  let data = keypair.publicKey()
  let signature = keypair.sign(data)
  signature = encodeURIComponent(signature.toString('base64'))
  let parmsTail = `sk=ASK_&network=${window.StellarNetwork.id}&${data}=${signature}`
  parms = parms.length == 0 ? `?${parmsTail}` : parms + `&${parmsTail}`

  if (noget) {
    return `${site}${path}${parms}`;
  }
  return fetch(`${site}${path}${parms}`, { method: 'GET', })
    .then(async response => {
      if (response.ok) {
        return response.text();
      }
      let text
      try {
        text = await response.text()
      } catch(e) {
        console.error(e)
        throw new Error(response.status)
      }
      console.error('-', response.status, text)
    });
}

function retrieveItem (itemName) { // {{{1
  if (!storageAvailable('localStorage')) {
    throw 'localStorage NOT available'
  }
  let item = localStorage.getItem(itemName)
  return item ? JSON.parse(b64_to_utf8(item))[itemName] : undefined;
}

function serviceRequest (servicePath, servicePK, serviceConsumerSK, rtURL) { // {{{1
  let url = pGET(
    `/request-service/${servicePK}/${servicePath}`, 
    `?REQUEST_TARGET_URL=${encodeURIComponent(rtURL)}`, 
    serviceConsumerSK, true
  )
  window.open(url, '_blank')
}

function storageAvailable(type) { // {{{1
    var storage;
    try {
        storage = window[type];
        var x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === 'QuotaExceededError' ||
            // Firefox
            e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
            // acknowledge QuotaExceededError only if there's something already stored
            (storage && storage.length !== 0);
    }
}

function storeItem (itemName, item) { // {{{1
  if (!storageAvailable('localStorage')) {
    throw 'localStorage NOT available'
  }
  let itemWrap = {}
  itemWrap[itemName] = item
  localStorage.setItem(itemName, utf8_to_b64(JSON.stringify(itemWrap)))
}

let timestamps = {} // function timestamp (label = 'default') {{{1
function timestamp (label = 'default') {
  let q = Date.now()
  let p = timestamps[label] ?? 0
  timestamps[label] = q
  return q - p;
}

function txRef (t) { // {{{1
  return new window.StellarSdk.Memo(t.memo_type, // must be 'hash'
    Buffer.from(t.memo, 'base64')
  ).value.toString('hex');
}

function utf8_to_b64( str ) { // {{{1
  return btoa(unescape(encodeURIComponent( str )));
}

export { // {{{1
  CFW_URL_DEV, Semaphore, b64_to_utf8, delay, doGET, getClaimableBalanceId,
  pGET, retrieveItem, serviceRequest, storeItem, timestamp, txRef, utf8_to_b64,
}
