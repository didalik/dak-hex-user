# Stellar Help Exchange (HEX) codebase

Presently, the name of this project is misleading: at its inception, it was clear that, as opposed to HEX User, the HEX Agent stuff will not be public. So I made this project public, assuming that its Agent counterpart will be private. Later on, it became clear that:
- a HEX Agent needs not a *project*, but rather a *local Linux account* to keep its secrets private;
- the HEX codebase, used by all HEX actors (User, Agent, Issuer), MUST be made public;
- the actors need some introduction/description.

So today, Feb 8 2024, I am adding this **README.md** file - introducing the HEX actors to the public. Am also considering renaming this project to **dak-hex-codebase** - but this can wait...

## Stellar HEX Actors and Assets

There are tree types of HEX actors - Issuer, Agent, and User. The Issuer issues two types of HEX Assets - HEXA and ClawableHexa, funds Agents with those assets, and revokes the assets from Users when needed. An Agent establishes trustlines with the Issuer for both assets, then exchanges assets with Users. Users make/take HEX offers/requests.

## Stellar HEX in QA and PROD

In QA on **Stellar test network**, the *testnet creator* creates one Issuer and one Agent. All their Stellar keypairs are being kept together under the ==build== directory:

```
build/
├── svc.keys
├── testnet
│   ├── HEX_Agent.keys
│   └── HEX_Issuer.keys
└── testnet.keys
```

In PROD on **Stellar public network**, two separate Linux accounts - *hexo* and *hexa* - are required. For *hexo*, the ==build== directory is:

```
build/
├── svc.keys
├── public
│   └── HEX_Issuer.keys
└── public.keys
```

For *hexa*, the ==build== directory is:

```
build/
├── svc.keys
└── public
    └── HEX_Agent.keys
```

