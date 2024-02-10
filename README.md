# Stellar Help Exchange (HEX) codebase

Presently, the name of this project is misleading: at its inception, it was clear that, as opposed to HEX User, the HEX Agent stuff will not be public. So I made this project public, assuming that its Agent counterpart will be private. Later on, it became clear that:
- a HEX Agent needs not a *project*, but rather a *local Linux account* to keep its secrets private;
- the HEX codebase, used by all HEX actors (User, Agent, Issuer), MUST be made public;
- the actors need some introduction/description.

So today, on Feb 8 2024, I am adding this **README.md** file - introducing the HEX actors to the public. Am also considering renaming this project to **dak-hex-codebase** - but this can wait...

## Stellar HEX Actors and Assets

There are tree types of HEX actors - Issuer, Agent, and User. The Issuer issues two types of HEX Assets - HEXA and ClawableHexa, funds Agents with those assets, and revokes the assets from Users when needed. An Agent establishes trustlines with the Issuer for both assets, then exchanges assets with Users. Users establish trustlines with the Issuer for both assets, then exchange XLM for HEXA and make/take HEX offers/requests.

## Stellar HEX in DEV, QA and PROD

In QA on **Stellar test network**, the *testnet creator* creates one Issuer and one Agent. All their Stellar keypairs are being kept together under the **build** directory:

```
build/
├── svc.keys
├── testnet
│   ├── HEX_Agent.keys
│   └── HEX_Issuer.keys
└── testnet.keys
```

In PROD on **Stellar public network**, two separate Linux accounts - *hexo* and *hexa* - are required. This is the **build** directory for *hexo*:

```
build/
├── svc.keys
├── public
│   └── HEX_Issuer.keys
└── public.keys
```

This is the **build** directory for *hexa*:

```
build/
├── svc.keys
└── public
    └── HEX_Agent.keys
```

In DEV and QA, testing is done via a browser, for example:

```
 o  http://m1:8000/dev/prod/fix/issuer  +----+ ssh hexa@u22 ...  +-----+
-+- ----------------------------------->| m1 |------------------>| u22 |
 |                              results |    |           results |     |
/ \ <-----------------------------------|    |<------------------|     |
                                        +----+                   +-----+
```

The tester sends a request to the HTTP server on **m1:8000** to test *prod/fixissuer* in *dev*. This DEV request gets passed via SSH to **hexa@u22**. The stream of results floats back from **hexa@u22** through **m1:8000** to the tester.

If the tester uses browser on m1, she runs `npm run dev --dir=prod/fix --run=issuer` to make this request from her default browser and see the results.
