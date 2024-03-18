/* Copyright (c) 2023-present, Дід Alik and the Kids {{{1
 *
 * This script is licensed under the Apache License, Version 2.0, found in the
 * LICENSE file in the root directory of this source tree.
 * * */

class Account { // {{{1
  opts ( // {{{2
    memo,
    fee = this.sdk.BASE_FEE,
    networkPassphrase = this.sdk.Networks[this.network.name],
    timebounds = { 
      minTime: now(-10000),
      maxTime: now(+180000) // 3min TTL for a transaction
    },
    withMuxing = null
  )
  {
    return { fee, networkPassphrase, timebounds, memo, withMuxing };
  }

  tX (memo = null) { // {{{2
    if (!this.transaction) {
      delete this.xdr
      this.transaction = new this.sdk.TransactionBuilder(
        this.loaded, this.opts(memo)
      )
    }
    return this.transaction;
  }

  constructor (opts = null) { // {{{2
    this.network = window.StellarNetwork
    this.sdk = window.StellarSdk
    this.server = window.StellarHorizonServer ?? new this.sdk.Server(this.network.url)
    if (!window.StellarHorizonServer) {
      window.StellarHorizonServer = this.server // always a singleton
    }
    Object.assign(this, opts)
  }

  begin (sponsoredId) { // {{{2
    this.tX().addOperation(
      this.sdk.Operation.beginSponsoringFutureReserves({ sponsoredId })
    )
    return this;
  }

  cb (ccb, memo = null, data = []) { // create/claim Claimable Balance, manageData {{{2
    this.tX(memo).addOperation(ccb)
    for (let d of data) {
      this.tX().addOperation(d)
    }
    return this;
  }

  clawback (opts, memo = null) { // {{{2
    this.tX(memo).addOperation(this.sdk.Operation.clawback(opts))
    return this;
  }

  create (destination, startingBalance) { // {{{2
    this.tX().addOperation(this.sdk.Operation.createAccount({
      destination, startingBalance
    }))
    return this;
  }

  end (source) { // {{{2
    this.tX().addOperation(
      this.sdk.Operation.endSponsoringFutureReserves({ source })
    )
    return this;
  }

  fill () { // {{{2
    return this.server.loadAccount(this.keypair.publicKey()).
      then(loaded => {
        this.loaded = loaded
        return this;
      }).catch(console.error);
  }

  fromXDR (xdr) { // {{{2
    return this.sdk.TransactionBuilder.fromXDR(
      xdr, this.sdk.Networks[this.network.name]
    );
  }

  async load () { // {{{2
    this.loaded = await this.server.loadAccount(this.keypair.publicKey())
    //.catch(e => { throw e; }) // TODO something more meaningful

    return this;
  }

  manageBuyOffer (opts) { // {{{2
    this.tX().addOperation(this.sdk.Operation.manageBuyOffer(
      opts
    ))
    return this;
  }

  manageOffer (opts) { // {{{2
    return opts.amount ? this.manageSellOffer(opts) : this.manageBuyOffer(opts);
  }

  manageSellOffer (opts) { // {{{2
    this.tX().addOperation(this.sdk.Operation.manageSellOffer(
      opts
    ))
    return this;
  }

  merge (to) { // {{{2
    this.tX().addOperation(this.sdk.Operation.accountMerge({
      source: this.keypair.publicKey(), destination: to
    }))
    return this;
  }

  pay ( // {{{2
    asset,
    amount, 
    source = null,
    destination = this.network.hex.agent
  ) { 
    this.tX().addOperation(
      source ? this.sdk.Operation.payment({ destination, asset, amount, source })
      : this.sdk.Operation.payment({ destination, asset, amount })
    )
    return this;
  }

  put (k, v = null, source = null) { // manageData {{{2
    if (v === undefined) {
      return this;
    }
    this.tX().addOperation(this.sdk.Operation.manageData(
      source ? { name: k, value: v, source } 
      : { name: k, value: v }
    ))
    return this;
  }

  setOpts (opts) { // {{{2
    this.tX().addOperation(this.sdk.Operation.setOptions(opts))
    return this;
  }

  sign (wallet = null) { // {{{2
    return wallet ? wallet.signTransaction(
      this.toXDR(),
      {
        network: this.network.name,
        accountToSign: this.loaded.id,
      }
    ) : null; // FIXME
  }

  submit (opts = null) { // TODO complete {{{2
    let t = this.transaction // undefined OK
    delete this.transaction
    t = opts?.xdr ? this.fromXDR(opts.xdr) : t.build()
    if (opts?.keypairs) {
      t.sign(...opts.keypairs)
    } else {
      this.keypair?.canSign() && t.sign(this.keypair)
    }
    return this.server.submitTransaction(t)
    .catch(e => {
      console.error(t)
      console.error(
        e.response.data.extras ? e.response.data.extras.result_codes
        : e.response.data,
      )
    });
  }

  toXDR (keypairs = null) { // {{{2
    let t = this.transaction
    delete this.transaction
    if (keypairs === null) {
      return t.build().toXDR();
    }
    t = t.build()
    if (keypairs == undefined) {
      t.sign(this.keypair)
    } else {
      t.sign(...keypairs)
    }
    return t.toXDR();
  }

  trust (asset, limit = null, source = null) { // {{{2
    let opts = Object.assign(
      { asset }, limit ? { limit } : null, source ? { source } : null
    )
    this.tX().addOperation(this.sdk.Operation.changeTrust(opts))
    return this;
  }

  trusts (hex) { // {{{2
    let balances = this.loaded.balances
    return balances.length > 2 &&
      balances.find(
        b => b.asset_type == 'credit_alphanum12' &&
        b.asset_code == 'ClawableHexa' && b.is_clawback_enabled &&
        b.asset_issuer == hex.issuerClawableHexa
      ) &&
      balances.find(
        b => b.asset_type == 'credit_alphanum4' &&
        b.asset_code == 'HEXA' && b.asset_issuer == hex.issuerHEXA
      );
  }

  // }}}2
}

function now (deltaMs) { // {{{1
  return BigInt.asUintN(
    64, 
    Math.round((new Date(Date.now() - Date.now()%1000 + deltaMs))/1000).toString()
  );
}

export { // {{{1
  Account, 
}
