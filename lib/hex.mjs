/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

import { Account, } from './stellar-account.mjs' // {{{1
import { getClaimableBalanceId, } from './utils.mjs'
import { timestamp, } from '../dak/util/public/lib/util.mjs'
import { xdr, } from '@stellar/stellar-sdk'

class Make { // {{{1
  constructor (opts) { // {{{2
    Object.assign(this, opts)
    this.amount ??= parseHEXA(this.description) // === ClawableHEXA ==

    if (this.validity) { // making, not retrieving a make
      this.fee = Make.fee
      this.data = chunkDescOps(this.description)
    } else {
      this.isOffer = this.memo.startsWith('Offer')
    }
  }

  invalidate () { // {{{2
    console.log('TODO invalidate', this.memo)
  }

  take (opts, streams, onmessage) { // {{{2
    if (opts.description) {
      opts.data = chunkDescOps(opts.description)
    }
    let amount = this.isOffer ? Make.fee 
      : dog2hexa(hexa2dog(this.amount) + hexa2dog(Make.fee))
    let takerPK = opts.taker.keypair.publicKey(), taker
    let claimants = [ // createClaimableBalance {{{3
      new window.StellarSdk.Claimant(
        this.makerPK,
        !opts.validity || opts.validity == '0' ? // seconds
          window.StellarSdk.Claimant.predicateUnconditional()
        : window.StellarSdk.Claimant.predicateBeforeRelativeTime(opts.validity)
      ),
      new window.StellarSdk.Claimant( // taker can reclaim anytime
        opts.taker.keypair.publicKey(),
        window.StellarSdk.Claimant.predicateUnconditional()
      )
    ]
    let ccb = window.StellarSdk.Operation.createClaimableBalance({ claimants,
      asset: window.StellarNetwork.hex.assets[0], amount,
    })

    // Submit the tx {{{3
    return new User(opts.taker).load().then(user => {
      taker = user
      return user.cb(ccb, window.StellarSdk.Memo.hash(this.txId), opts.data).
        submit();
    }).then(txR => {
      streams.find(s => s.pk == taker.loaded.id) || Make.stream(
        streams, takerPK, onmessage, console.error
      )
      return {
        amount,
        balanceId: getClaimableBalanceId(txR.result_xdr),
        txId: txR.id,
      };
    });

    // }}}3
  }
  static fee = '0.0000100' // {{{2

  static stream (streams, pk, onmessage, onerror) { // {{{2
    streams.push({
      close: window.StellarHorizonServer.effects().forAccount(pk).cursor('now').
        stream({ onerror, onmessage, }),
      pk,
    })
  }

  // }}}2
}

class Offer extends Make { // {{{1
  constructor (opts) { // {{{2
    super(opts)
    if (this.validity) {
      this.memo = window.StellarSdk.Memo.text(`Offer ${this.validity}`)
    }
  }


  // }}}2
}

function OfferResults (tx) { // {{{1
  this.offerResults = tx.offerResults
  return this;
}

class Orderbook { // {{{1
  constructor (data) { // {{{2
    this.ts = timestamp('Orderbook')
    if (Orderbook.same(data)) { // heartbeat
      this.last = Orderbook.last
      return;
    }
    Object.assign(this, data) // {{{3
/*
    this.mp = [] // the midprice array {{{3
    let depth = Math.max(this.asks.length, this.bids.length)
    for (let i = 0; i < depth; i++) {
      let ai = +(this.asks[i]?.price ?? 0), bi = +(this.bids[i]?.price ?? 0)
      let midprice  = (ai + bi) / 2
      this.mp.push(midprice)
    }
*/
    this.p = Orderbook.last // maintain the time series depth {{{3
    Orderbook.last = this
    let q = this
    for (let i = 0; i < Orderbook.depth; i++) {
      if (!q.p) {
        return;
      }
      q = q.p
    }
    q.p = null // }}}3
  }

  line () { // {{{2
    //console.dir(this, { depth: null })

    let r = '', asks = this.asks ?? this.last.asks, bids = this.bids ?? this.last.bids
    for (let e of bids) {
      r = ' ' + (+(hexaValue(e.amount / e.price))) + '@' + (+e.price) + r
    }
    r += ' : '
    for (let e of asks) {
      r += (+e.amount) + '@' + (+e.price) + ' '
    }
    return r;
  }

  size () { // {{{2
    let asks = this.asks ?? this.last.asks, bids = this.bids ?? this.last.bids
    return bids.length + asks.length;
  }

  static depth = 3 // depth in time {{{2

  static diff (q) { // {{{2
    const adiff = (q, p) => { // amount difference for same prices
      return q.amount - p.amount;
      //return q;
    }
    const peq = (a, b) => a.price_r.n == b.price_r.n && a.price_r.d == b.price_r.d
    const notIn = (a1, a2) => a1.filter(e1 => !a2.find(e2 => peq(e1, e2)))
    const updBy = (p, q) => p.filter(ep => q.find(eq => peq(ep, eq)))
      .map(fp => adiff(q.find(eq => peq(fp, eq)), fp))
    const aru = (p, q) => {
      p = p ?? []
      //console.log(p, q)

      let [added, removed, updated] = [notIn(q, p), notIn(p, q), updBy(p, q)]
      //console.log(added, removed, updated)

      return { added, removed, updated };
    }
    let p = Orderbook.last
    let [bids, asks] = [aru(p?.bids, q.bids), aru(p?.asks, q.asks)]
    return { asks, bids };
  }

  static last = null // {{{2
  
  static lastdiff = null // {{{2

  static line (b) { // {{{2
    let r = ''
    for (let e of b.bids) {
      r = ' ' + (+(hexaValue(e.amount / e.price))) + '@' + (+e.price) + r
    }
    r += ' : '
    for (let e of b.asks) {
      r += (+e.amount) + '@' + (+e.price) + ' '
    }
    return r;
  }

  static same (data) { // {{{2
    Orderbook.lastdiff = Orderbook.diff(data)
    let ld = Orderbook.lastdiff
    const updated = a => {
      for (let e of a) {
        if (+e.amount != 0) {
          return true;
        }
      }
      return false;
    }
    if (
      !Orderbook.last ||
      ld.asks.added.length || ld.asks.removed.length || updated(ld.asks.updated) ||
      ld.bids.added.length || ld.bids.removed.length || updated(ld.bids.updated)
    ) {
      return false;
    }
    return true;
  }

  // }}}2
}

class Request extends Make { // {{{1
  constructor (opts) { // {{{2
    super(opts)
    if (this.validity) {
      this.memo = window.StellarSdk.Memo.text(`Request ${this.validity}`)
    }
  }

  take (opts, streams, onmessage) { // {{{2
    opts.amount = '0'
    return super.take(opts, streams, onmessage);
  }

  // }}}2
}

class User extends Account { // Stellar HEX User {{{1
  constructor (opts) { // {{{2
    super(opts)
  }

  add () { // trust and fund HEX assets, set user props {{{2
    let hex = this.network.hex
    hexAssets(hex)

    let amountH = this.startingBalanceH; delete this.startingBalanceH
    let amountCH = this.startingBalanceCH; delete this.startingBalanceCH
    return this.trust(hex.assets[0]).trust(hex.assets[1])
    .begin(hex.agent)
    .pay(hex.assets[0], amountCH, hex.agent, this.keypair.publicKey())
    .pay(hex.assets[1], amountH, hex.agent, this.keypair.publicKey())
    .end(hex.agent)
    .setProps();
  }

  convertClawableHexaToHEXA (opts) { // opts: amount, memo | grantTxId {{{2
    opts.memo ??= window.StellarSdk.Memo.hash(opts.grantTxId)
    let claimants = [
      new window.StellarSdk.Claimant(
        window.StellarNetwork.hex.agent,
        !opts.validity || opts.validity == '0' ? // seconds
          window.StellarSdk.Claimant.predicateUnconditional()
        : window.StellarSdk.Claimant.predicateBeforeRelativeTime(opts.validity)
      ),
      new window.StellarSdk.Claimant(
        this.loaded.id,
        window.StellarSdk.Claimant.predicateUnconditional()
      )
    ]
    let ccb = window.StellarSdk.Operation.createClaimableBalance({ claimants,
      asset: window.StellarNetwork.hex.assets[0], 
      amount: opts.amount,
    })
    delete this.transaction
    return this.cb(ccb, opts.memo).submit().then(txR => {
      return {
        balanceId: getClaimableBalanceId(txR.result_xdr),
        pk: this.loaded.id,
        txId: txR.id,
      }
    });
  }

  grant (take, make) { // {{{2
    let ccb = window.StellarSdk.Operation.claimClaimableBalance({
      balanceId: take.balanceId,
    })
    let amount = make.memo.value.toString().startsWith('Offer') ? Make.fee
    : take.description ? amount2pay(parseHEXA(take.description))
    : amount2pay(make.amount)
    return this.cb(ccb, window.StellarSdk.Memo.hash(take.txId)).pay(this.network.hex.assets[0], amount, null, take.takerPK).submit().then(txR => {
      return {
        amount,
        takeTxId: take.txId,
        txId: txR.id,
      };
    });
  }

  make (or) { // Offer or Request {{{2
    or.makerPK = this.loaded.id
    let claimants = [
      new window.StellarSdk.Claimant(
        window.StellarNetwork.hex.agent,
        !or.validity || or.validity == '0' ? // seconds
          window.StellarSdk.Claimant.predicateUnconditional()
        : window.StellarSdk.Claimant.predicateBeforeRelativeTime(or.validity)
      ),
      new window.StellarSdk.Claimant( // maker can reclaim anytime
        this.loaded.id,
        window.StellarSdk.Claimant.predicateUnconditional()
      )
    ]
    let ccb = window.StellarSdk.Operation.createClaimableBalance({ claimants,
      asset: window.StellarNetwork.hex.assets[1], 
      amount: Make.fee,
    })
    delete this.transaction
    return this.cb(ccb, or.memo, or.data).submit().then(txR => {
      or.txId = txR.id
      return { // TODO return only balance Id - breaks PoC, Day1
        balanceId: getClaimableBalanceId(txR.result_xdr),
        txId: txR.id,
      };
    });
  }

  remove (mergeTo) { // {{{2
    let hex = window.StellarNetwork.hex
    let amountH = this.loaded.balances.filter(b =>
      b.asset_code == 'HEXA' && b.asset_issuer == hex.issuerHEXA
    )[0].balance
    let amountCH = this.loaded.balances.filter(b =>
      b.asset_code == 'ClawableHexa' && b.asset_issuer == hex.issuerClawableHexa
    )[0].balance

    return this.pay(hex.assets[0], amountCH).trust(hex.assets[0], '0').
      pay(hex.assets[1], amountH).trust(hex.assets[1], '0').
      merge(mergeTo);
  }

  repay (txId) { // {{{2
    let claimants = [
      new window.StellarSdk.Claimant(
        window.StellarNetwork.hex.issuerClawableHexa,
        window.StellarSdk.Claimant.predicateUnconditional()
      ),
      new window.StellarSdk.Claimant(
        this.loaded.id,
        window.StellarSdk.Claimant.predicateUnconditional()
      )
    ]
    let ccb = window.StellarSdk.Operation.createClaimableBalance({ claimants,
      asset: window.StellarNetwork.hex.assets[1], 
      amount: Make.fee,
    })
    delete this.transaction
    return this.cb(ccb, window.StellarSdk.Memo.hash(txId)).submit().then(txR => ({
      balanceId: getClaimableBalanceId(txR.result_xdr),
      txId: txR.id,
    }));
  }

  setProps (props = this) { // {{{2
    for (let k of Object.getOwnPropertyNames(props)) {
      if (typeof props[k] != 'string') {
        continue;
      }
      this.put(k, props[k]).put(k)
    }
    return this;
  }

  take (or, opts) { // {{{2
    if (opts.description) {
      opts.data = chunkDescOps(opts.description)
    }
    let amount = or.isOffer ? dog2hexa(hexa2dog(or.amount) + hexa2dog(Make.fee))
    : Make.fee
    let claimants = [
      new window.StellarSdk.Claimant(
        or.makerPK,
        !opts.validity || opts.validity == '0' ? // seconds
          window.StellarSdk.Claimant.predicateUnconditional()
        : window.StellarSdk.Claimant.predicateBeforeRelativeTime(opts.validity)
      ),
      new window.StellarSdk.Claimant( // taker can reclaim anytime
        this.loaded.id,
        window.StellarSdk.Claimant.predicateUnconditional()
      )
    ]
    let ccb = window.StellarSdk.Operation.createClaimableBalance({ claimants,
      asset: window.StellarNetwork.hex.assets[0], amount,
    })
    return this.cb(ccb, window.StellarSdk.Memo.hash(or.txId), opts.data).
      submit().then(txR => {
        let take = {
          amount, 
          description: opts.description,
          or,
          takerPK: this.loaded.id, txId: txR.id,
        }
        return {
          balanceId: getClaimableBalanceId(txR.result_xdr),
          take,
        };
      });
  }

  static getProps (pk) { // {{{2
    window.StellarHorizonServer.effects().forAccount(pk).order('desc').call().
      then(r => console.log('getProps', r))
  }

  // }}}2
}

function amount2pay (amount) { // {{{1
  return dog2hexa(hexa2dog(amount) + hexa2dog(Make.fee));
}

function chunkDescOps (description, source = null) { // {{{1
  // Check description.length
  if (description.length < 1 || description.length > 2000) {
    throw `- chunkDescOps: description.length is ${description.length}`
  }

  // Chunk description Operations into ops array
  let i = 0
  let ops = []
  while (description.length > 64) {
    let chunk = description.slice(0, 64)
    description = description.slice(64)
    if (source) {
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: chunk, source }))
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: null, source }))
    } else {
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: chunk, }))
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: null, }))
    }
    i++
  }
  if (description.length > 0) {
    if (source) {
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: description, source }))
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: null, source }))
    } else {
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: description, }))
      ops.push(window.StellarSdk.Operation.manageData({ name: `data${i}`, value: null, }))
    }
  }

  return ops;
}

function description (operations) { // {{{1
  let result = ''
  for (let o of operations.records) {
    if (o.type == 'manage_data' && o.value.length > 0) {
      result += Buffer.from(o.value, 'base64').toString()
    }
  }
  return result;
}

/** function dog2hexa (bigInt) // {{{1
 * Drops Of Gratitude (DOGs) are internal representation of HEXAs. 
 * 1 HEXA is 10000000 DOGs. 1 DOG is 0.0000001 HEXA.
 * A HEXA is a String, a DOG is a BigInt.
 */
function dog2hexa (bigInt) {
  const truncated  = bigInt / 10000000n
  const fractional = bigInt % 10000000n
  let zeroes
  switch (fractional.toString().length) {
    case 1:
      zeroes = '000000'
      break
    case 2:
      zeroes = '00000'
      break
    case 3:
      zeroes = '0000'
      break
    case 4:
      zeroes = '000'
      break
    case 5:
      zeroes = '00'
      break
    case 6:
      zeroes = '0'
      break
    case 7:
      zeroes = ''
  }
  return truncated.toString() + '.' + zeroes + fractional.toString();
}

function hexAssets (hex) { // {{{1
  hex.assets = [
    new window.StellarSdk.Asset('ClawableHexa', hex.issuerClawableHexa),
    new window.StellarSdk.Asset('HEXA', hex.issuerHEXA),
  ];
}

const hexStartingBalance = '1000000000' // {{{1

function hexaValue (d) { // {{{1
  d *= 10000000
  d = Math.round(d)
  return dog2hexa(BigInt(d));
}

/** function hexa2dog (str) // {{{1
 * Drops Of Gratitude (DOGs) are internal representation of HEXAs. 
 * 1 HEXA is 10000000 DOGs. 
 * A HEXA is a String, a DOG is a BigInt.
 */
function hexa2dog (str) {
  let dotIndex = str.indexOf('.')
  if (dotIndex < 0) {
    return BigInt(str) * 10000000n;
  }
  let truncated = dotIndex == 0 ? '0' : str.slice(0, dotIndex)
  let fractional = dotIndex == 0 ? '0000000' : str.slice(dotIndex + 1)
  while (fractional.length < 7) {
    fractional += '0'
  }
  return BigInt(truncated) * 10000000n + BigInt(fractional);
}

function offerCreated (result_xdr, kind = 'manageBuyOfferResult') { // {{{1
  let result = 
    xdr.TransactionResult.fromXDR(result_xdr, "base64").result().results()

  let index = result.length == 3 ? 1
  : result.length == 1 ? 0
  : undefined
  result = result[index] // 0:begin, 1:manage...Offer, 2:end
    .value()[kind]().value()
  let offersClaimed = result._attributes.offersClaimed
  let offer = result.offer().value()
  let id = offer.offerId().low
  let price_r = offer.price()._attributes

  result = { offer: { id, price_r, }, offersClaimedLength: offersClaimed.length, }
  console.dir(result, { depth: null })
  return result;
}

function offerDeleted (result_xdr, kind = 'manageBuyOfferResult') { // {{{1
  let result = 
    xdr.TransactionResult.fromXDR(result_xdr, "base64").result().results()

  let index = result.length == 3 ? 1
  : result.length == 1 ? 0
  : undefined
  result = result[index] // 0:begin, 1:manage...Offer, 2:end
    .value()[kind]().value()
  let offersClaimed = result._attributes.offersClaimed

  result = { offer: { id: null }, offersClaimedLength: offersClaimed.length, }
  console.dir(result, { depth: null })
  return result;
}

function parseHEXA (desc) { // {{{1
  let index = desc ? desc.indexOf('HEXA ') : -1
  if (index < 0) {
    return null;
  }
  let words = desc.slice(index).split(' ')
  return words[1].endsWith('.') || words[1].endsWith(',') ? 
    words[1].slice(0, words[1].length - 1) 
  : words[1];
}

export { // {{{1
  Make, Offer, OfferResults, Orderbook, Request, User,
  description, dog2hexa, hexAssets, hexStartingBalance, hexaValue, hexa2dog, 
  offerCreated, offerDeleted, parseHEXA,
}
