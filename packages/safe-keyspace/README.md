# Safe x KeySpace

PoC integrating [KeySpace](https://docs.key.space/) to Safe SmartAccount to provide a shared state to manage keys handled by [MKSR (Minimum KeyStore Rollup)](https://hackmd.io/@mdehoog/mksr).

`SafeKeySpaceModule` Safe module provide the methods
- `registerKeystore` to link a Safe to a KeySpace key 
- `executeTransaction` to execute a transaction on behalf of the Safe recovering the signature and checking the signer is included in KeySpace rollup (from provided proofs)

## Getting started

```shell
$ make install
$ make config
$ make compile
$ make test
$ make clean
```

You also need to run [keyspace-recovery-service](https://github.com/base-org/keyspace-recovery-service) locally

```shell
$ git clone git@github.com:base-org/keyspace-recovery-service.git
$ cd keyspace-recovery-service

# Download circuits
$ curl https://purple-quiet-sheep-63.mypinata.cloud/ipfs/QmSpJsRbMZdKYjMG25pPa16e4pdLnQbGGtZGTRBmYZDuW7 --output circuits.zip
$ mkdir ./compiled \
$ unzip circuits.zip -d ./compiled
$ rm -f circuits.zip

# Run the service
$ go run ./cmd/keyspace-recovery-service
INFO [06-26|11:37:01.727] Starting keyspace-recovery-service       version=v0.0.1
INFO [06-26|11:37:01.727] Using local storage                      path=/Users/gregjeanmart/workspace/sandbox/keyspace-recovery-service/compiled
INFO [06-26|11:37:01.727] Starting HTTP server                     address=:8555
```

## Commands

### Define some variables

```shell
$ NETWORK=localhost ## networks supported: localhost, sepolia, base_sepolia
$ PK=<PK> ## the private key of the signer
$ ROOT=18771300679865010293167752034693535567812946484477666775367256618114830841022 ## root hash of the keystore when using MockedKeystore on localhost (-> https://sepolia.etherscan.io/address/0x45b924ee3ee404e4a9e2a3afd0ad357eff79fc49#readContract#F10)

```

### Deploy singletons (deterministic address)

```shell
$ npx hardhat deploy_singletons \
    --network $NETWORK \
    --root $ROOT

========================== SINGLETONS ===========================
safeProxyFactory address: 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
safeMastercopy address: 0x41675C099F32341bf84BFc5382aF534df5C7461a
safeMultiSend address: 0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526
safeMultiSendCallOnly address: 0x9641d764fc13c8B624c04430C7356C1C7C8102e2
safeFallbackHandler address: 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99
safeSignMessageLib address: 0xd53cd0aB83D845Ac265BE939c57F53AD838012c9
safeCreateCall address: 0x9b35Af71d77eaf8d7e40252370304687390A1A52
safeSimulateTxAccessor address: 0x3d4BA2E0884aa488718476ca2FB8Efc291A46199
safeKeySpaceModule address: 0x41fbC184BF40abefB5Ab7490BbBE85F11Cd0Ca74
safeKeySpaceModuleSetup address: 0xCcEa561FC47dE3aDBf7FD0D10C965e057D8AF087
SafeDisableExecTransactionGuard address: 0xC8B6581bcf4090E6315D325c09CDE1F6E9C1570D
Keystore address: 0xe0Eb338bfA6A115D268F3c994AbeB099435F434b
StateVerifier address: 0x1094f9Ba8bE1FD730b1089607390f224De58987B
============================================================
```

### Define some more variables

Based on the output above

```shell
$ SAFE_FACTORY=0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67
$ SAFE_MASTERCOPY=0x41675C099F32341bf84BFc5382aF534df5C7461a
$ SAFE_MULTISEND=0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526
$ SAFE_KEYSPACE_MODULE=0x41fbC184BF40abefB5Ab7490BbBE85F11Cd0Ca74
$ SAFE_KEYSPACE_MODULE_SETUP=0xCcEa561FC47dE3aDBf7FD0D10C965e057D8AF087
$ KEYSTORE=0xe0Eb338bfA6A115D268F3c994AbeB099435F434b
$ SAFE_SALT=0x0000000000000000000000000000000000000000000000000000000000000a1a
```

### (optional) Verify the contract on Etherscan

```shell
$ npx hardhat verify \
    --network $NETWORK \
    $SAFE_KEYSPACE_MODULE
```

### Deploy a Safe

```shell
$ npx hardhat deploy_safe \
    --network $NETWORK \
    --factory $SAFE_FACTORY \
    --mastercopy $SAFE_MASTERCOPY \
    --multisend $SAFE_MULTISEND \
    --keystoremodule $SAFE_KEYSPACE_MODULE \
    --keystoremodulesetup $SAFE_KEYSPACE_MODULE_SETUP \
    --ownerpk $PK \
    --salt $SAFE_SALT

========================== SAFE ===========================
=== Network: localhost
=== Safe Address: 0x97538517C34bBF1671b1045328D14b0b52B6d7B2
=== Safe Version: 1.4.1
=== Safe Owners: 0xd06D5F0D454edc27CDBc992588a230BDF8832DdA
=== Safe Threshold: 1
=== Safe Nonce: 2
=== Safe Modules: 0xf6e483345a43e8Da49368B8a672538BE494C1512
=== KeySpace Key: 0x1a9d61d523e3ebcf1ea4553bc1d81c239fb2579d35900a23de4ef928020cf617
=== KeySpace Key nonce: 0
=== Keystore root 18922104752410089181190121137101702179191413010695720107096429999419838202820
=== Safe Balance: 0 ETH
============================================================

$ SAFE=0xFfc4De3439ba88EFADa3436EE551e42180Ce2c77
```

### Fund your Safe

```shell
$ npx hardhat sent_eth \
    --network $NETWORK \
    --to $SAFE \
    --amount 0.1
```

### Get your Safe details

```shell
$ npx hardhat get_safe \
    --network $NETWORK \
    --safe $SAFE

========================== SAFE ===========================
=== Network: localhost
=== Safe Address: 0x97538517C34bBF1671b1045328D14b0b52B6d7B2
=== Safe Version: 1.4.1
=== Safe Owners: 0xd06D5F0D454edc27CDBc992588a230BDF8832DdA
=== Safe Threshold: 1
=== Safe Nonce: 2
=== Safe Modules: 0xf6e483345a43e8Da49368B8a672538BE494C1512
=== KeySpace Key: 0x1a9d61d523e3ebcf1ea4553bc1d81c239fb2579d35900a23de4ef928020cf617
=== KeySpace Key nonce: 0
=== Keystore root 18922104752410089181190121137101702179191413010695720107096429999419838202820
=== Safe Balance: 0 ETH
============================================================
```

### Execute a transaction via Safe Keystore Module

```shell
$ npx hardhat exec_safe_keystore_tx \
    --network $NETWORK \
    --safe $SAFE \
    --keystoremodule $SAFE_KEYSPACE_MODULE \
    --to 0xd06D5F0D454edc27CDBc992588a230BDF8832DdA \
    --value 0.01 \
    --ownerpk $PK 
```

### Change the owner on the Keystore

```shell
NEW_PK=<NEW PK>

$ npx hardhat change_keystore_owner \
    --network $NETWORK \
    --safe $SAFE \
    --keystoremodule $SAFE_KEYSPACE_MODULE \
    --currentownerpk $PK \
    --newownerpk $NEW_PK
```

wait for propagation
- on `sepolia` https://sepolia.etherscan.io/address/0x45b924Ee3EE404E4a9E2a3AFD0AD357eFf79fC49#readContract#F10
- on `base sepolia` https://sepolia.basescan.org/address/0x610A7e97C6D2F1E09e6390F013BFCc39B8EE49e2#readContract#F2
- on `op sepolia` https://sepolia.basescan.org/address/0x610A7e97C6D2F1E09e6390F013BFCc39B8EE49e2#readContract#F2


### (optional) Update the Keystore root (only on localhost via MockedKeystore)

```shell
$ ROOT=<new root>
$ npx hardhat set_keystore_root \
    --network $NETWORK \
    --keystore $KEYSTORE \
    --root $ROOT

========================== KEYSTORE ===========================
Keystore address: 0xe0Eb338bfA6A115D268F3c994AbeB099435F434b
Keystore root (previous): 21864354985230454401640232628438063805322667270383812685966576080427769315720
Keystore root (new): 18922104752410089181190121137101702179191413010695720107096429999419838202820
============================================================
```

### Execute a transaction via Safe Keystore Module with the new signer

```shell
$ npx hardhat exec_safe_keystore_tx \
    --network $NETWORK \
    --safe $SAFE \
    --keystoremodule $SAFE_KEYSPACE_MODULE \
    --to 0xd06D5F0D454edc27CDBc992588a230BDF8832DdA \
    --value 0.01 \
    --ownerpk $NEW_PK 
```

## Frontend

```
cd frontend
yarn install
yarn dev
open http://localhost:3000
```


## TODO list
- [ ] ERC-712 support
- [ ] ERC-4337 support
