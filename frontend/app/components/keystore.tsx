import { useContext, useState } from "react"
import InputText, { InputField } from "./form/input_text"
import { AddressLike, JsonRpcSigner, ZeroAddress, ethers, formatEther, isAddress } from "ethers"
import { formatAddr, makeSafeDescription, useEthersSigner } from "../utils/utils"
import Button from "./form/button"
import { SafeInfo } from "../utils/interfaces"
import Safe, { ContractNetworksConfig, EthersAdapter } from "@safe-global/protocol-kit"
import { MetaTransactionData } from "@safe-global/safe-core-sdk-types"
import SafeABI from "../utils/abi/safe.abi.json"
import SafeKeystoreModuleABI from "../utils/abi/safekeystoremodule.abi.json"
import config from "../utils/config"
import SafeCoreProvider from "../utils/safe_core_provider"
import { FaSync } from "react-icons/fa";
import Alert, { AlertConf, AlertType } from "./alert"

const SAFE_ADDR_FIELD_INIT = { value: "", message: "", hasError: false, disabled: false }
const KEYSTORE_FIELD_INIT = { value: "", message: "", hasError: false, disabled: true }

const makeContractNetworks = (chainId: number): ContractNetworksConfig => {
    const singletons = chainId == config.l2.chain_id ? config.l2.singletons : config.l1.singletons
    return {
        [chainId]: {
            safeSingletonAddress: singletons.safe_singleton_address,
            safeProxyFactoryAddress: singletons.safe_proxyFactory_address,
            multiSendAddress: singletons.multi_send_address,
            multiSendCallOnlyAddress: singletons.multi_send_call_only_address,
            fallbackHandlerAddress: singletons.fallback_handler_address,
            signMessageLibAddress: singletons.sign_nessage_lib_address,
            createCallAddress: singletons.create_call_address,
            simulateTxAccessorAddress: singletons.simulate_tx_accessor_address,
        }
    }
}

const fetchSafeInfo = async (
    {
        adapter,
        safeAddress,
        onSuccess,
        onError
    }: {
        adapter: EthersAdapter,
        safeAddress: AddressLike,
        onSuccess: (safe: SafeInfo) => Promise<void>,
        onError: (error: any) => Promise<void>
    }): Promise<void> => {
    try {
        const chainId = await adapter.getChainId()
        const safe: Safe = await Safe.create({
            ethAdapter: adapter,
            safeAddress: safeAddress.toString(),
            contractNetworks: makeContractNetworks(Number(chainId))
        })
        const [owners, threshold, balance, modules, guard] = await Promise.all([
            safe.getOwners(),
            safe.getThreshold(),
            safe.getBalance(),
            safe.getModules(),
            safe.getGuard()
        ])
        const safeInfo = {
            address: safeAddress,
            owners,
            threshold,
            balance: balance.toString(),
            modules,
            guard
        }
        onSuccess(safeInfo)
    } catch (error: any) {
        console.log(error)
        onError(error.message)
    }
}

const linkKeystore = async (
    {
        signer,
        safe,
        keystoreAddress,
        onSuccess,
        onError
    }: {
        signer?: JsonRpcSigner,
        safe: SafeInfo,
        keystoreAddress: AddressLike,
        onSuccess: (result: any) => Promise<void>,
        onError: (error: any) => Promise<void>
    }): Promise<void> => {
    try {
        const safeAddress = safe.address.toString()

        if (!signer) {
            throw new Error('You need to connect your Signer wallet');
        }
        if (!safe.owners.includes(signer.address)) {
            throw new Error(`Invalid Signer wallet ${formatAddr(signer.address)}`);
        }

        const safeContract = new ethers.Contract(safeAddress, SafeABI, signer);
        const enableModuleTx = await safeContract.enableModule.populateTransaction(config.l2.singletons.safe_keystore_module)
        const safeKeystoreModuleContract = new ethers.Contract(config.l2.singletons.safe_keystore_module, SafeKeystoreModuleABI, signer);
        const registerKeystoreTx = await safeKeystoreModuleContract.registerKeystore.populateTransaction(keystoreAddress)

        const transactions: MetaTransactionData[] = [
            {
                to: safeAddress,
                data: enableModuleTx.data,
                value: "0"
            },
            {
                to: config.l2.singletons.safe_keystore_module,
                data: registerKeystoreTx.data,
                value: "0",
            }
        ]
        const signerAdapter = new EthersAdapter({
            ethers,
            signerOrProvider: signer
        })

        const network = await signer.provider.getNetwork()
        const safeSDK = await Safe.create({
            ethAdapter: signerAdapter,
            safeAddress,
            contractNetworks: makeContractNetworks(Number(network.chainId))
        })
        const safeTransaction = await safeSDK.createTransaction({
            transactions,
        })
        const tx = await safeSDK.executeTransaction(safeTransaction)

        onSuccess({ hash: tx.hash })
    } catch (error: any) {
        console.log(error)
        onError(error.message)
    }
}

const load = async (
    {
        l1Adapter,
        l2Adapter,
        safeAddress,
        setSafe,
        setKeystore,
        setSafeAddrField,
        setKeystoreField,
        setAlert
    }: {
        l1Adapter: EthersAdapter,
        l2Adapter: EthersAdapter,
        safeAddress: string
        setSafe: (safe?: SafeInfo) => void,
        setKeystore: (safe?: SafeInfo) => void,
        setSafeAddrField: (inputField: InputField) => void,
        setKeystoreField: (inputField: InputField) => void,
        setAlert: (conf?: AlertConf) => void
    }
) => {
    setSafeAddrField({ value: safeAddress, hasError: false, message: "Loading..." })
    setKeystoreField(KEYSTORE_FIELD_INIT)
    setAlert(undefined)
    await fetchSafeInfo({
        adapter: l2Adapter,
        safeAddress,
        onSuccess: async (safe) => {
            console.log(`---> safe=${JSON.stringify(safe)}`)
            setSafe(safe)
            setSafeAddrField({ value: safeAddress, hasError: false, message: makeSafeDescription(safe) })

            const safeKeystoreModuleContract = new ethers.Contract(config.l2.singletons.safe_keystore_module, SafeKeystoreModuleABI, l2Adapter.getProvider());
            const keystoreAddr = await safeKeystoreModuleContract.keystores(safe.address)
            // No keystore attached
            if (!safe.modules.includes(config.l2.singletons.safe_keystore_module) || keystoreAddr === ZeroAddress) {
                setKeystoreField({ value: "", hasError: true, message: "No keystore linked", disabled: false })
                setKeystore(undefined)

            } else {
                // Keystore registered
                setKeystoreField({ value: keystoreAddr, hasError: false, disabled: true, message: "Loading..." })

                await fetchSafeInfo({
                    adapter: l1Adapter,
                    safeAddress: keystoreAddr,
                    onSuccess: async (keystore) => {
                        console.log(`---> keystore=${JSON.stringify(keystore)}`)
                        setKeystoreField({ value: keystoreAddr, hasError: false, disabled: true, message: makeSafeDescription(keystore) })
                        setKeystore(keystore)
                    },
                    onError: async (error) => {
                        setKeystoreField({ value: keystoreAddr, hasError: true, disabled: true, message: error })
                        setKeystore(undefined)
                    }
                })
            }
        },
        onError: async (error) => {
            setSafeAddrField({ value: safeAddress, hasError: true, message: error })
            setKeystoreField(KEYSTORE_FIELD_INIT)
            setSafe(undefined)
        }
    })
}

function Keystore(
    {
        safe,
        keystore,
        setSafe,
        setKeystore
    }: {
        safe?: SafeInfo,
        keystore?: SafeInfo,
        setSafe: (safe?: SafeInfo) => void,
        setKeystore: (keystore?: SafeInfo) => void,
    }) {
    const l1Adapter = useContext(SafeCoreProvider.context)?.l1Adapter
    const l2Adapter = useContext(SafeCoreProvider.context)?.l2Adapter
    const signer = useEthersSigner()

    const [safeAddrField, setSafeAddrField] = useState<InputField>(SAFE_ADDR_FIELD_INIT)
    const [keystoreField, setKeystoreField] = useState<InputField>(KEYSTORE_FIELD_INIT)
    const [alert, setAlert] = useState<AlertConf>()

    return <main className="flex flex-col items-center justify-between pt-8">
        <form className="bg-white shadow-md rounded w-[600px] px-6 pt-6">
            {/** MAIN SAFE SECTION */}
            <div className="flex flex-wrap">
                <div className="flex flex-row space-x-2 fleblock uppercase tracking-wide text-gray-700 text-s font-bold mb-2">
                    <span>Keystore Setup</span>
                    <FaSync
                        className="mt-1 cursor-pointer"
                        onClick={() => {
                            load({
                                l1Adapter,
                                l2Adapter,
                                safeAddress: safeAddrField.value,
                                setSafe,
                                setKeystore,
                                setSafeAddrField,
                                setKeystoreField,
                                setAlert
                            })
                        }} />
                </div>
                <div className="w-full md:w-3/4 md:mb-0">
                    <InputText
                        label="Your Safe (L2)"
                        placeholder="0x..."
                        field={safeAddrField}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const address = e.currentTarget.value
                            if (address == "") {
                                setSafeAddrField(SAFE_ADDR_FIELD_INIT)
                                setKeystoreField(KEYSTORE_FIELD_INIT)
                                setSafe(undefined)
                                return;
                            }

                            if (!isAddress(address)) {
                                setSafeAddrField({ value: address, hasError: true, message: "Invalid Address" })
                                setKeystoreField(KEYSTORE_FIELD_INIT)
                                setSafe(undefined)
                                return;
                            }

                            // Valid address
                            load({
                                l1Adapter,
                                l2Adapter,
                                safeAddress: address,
                                setSafe,
                                setKeystore,
                                setSafeAddrField,
                                setKeystoreField,
                                setAlert
                            })
                        }} />
                </div>
                <div className="w-full md:w-1/4 px-3">
                    <InputText
                        field={{ value: `${safe ? formatEther(safe.balance) : 0} ETH`, disabled: true }}
                    />
                </div>
            </div>
            {/* KEYSTORE SECTION */}
            {safe &&
                <div className="flex flex-wrap">
                    <div className="w-full md:w-3/4 md:mb-0">
                        <InputText
                            label="Keystore (L1)"
                            field={keystoreField}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const address = e.currentTarget.value
                                if (address == "") {
                                    setKeystoreField({ ...keystoreField, value: "", hasError: true, message: "No keystore linked" })
                                    return;
                                }
                                if (!isAddress(address)) {
                                    setKeystoreField({ ...keystoreField, value: address, hasError: true, message: "Invalid Address" })
                                    return;
                                }

                                setKeystoreField({ ...keystoreField, value: address, hasError: false, message: "Loading..." })
                                fetchSafeInfo({
                                    adapter: l1Adapter,
                                    safeAddress: address,
                                    onSuccess: async (safe) => {
                                        console.log(`---> keystore=${JSON.stringify(safe)}`)
                                        setKeystore(safe)
                                        setKeystoreField({ value: address, hasError: false, message: makeSafeDescription(safe) })
                                    },
                                    onError: async (error) => {
                                        setKeystoreField({ value: address, hasError: true, message: error })
                                        setKeystore(undefined)
                                    }
                                })
                            }} />
                    </div>
                    <div className="w-full md:w-1/4 px-3">
                        <Button
                            text="Link Keystore"
                            disabled={
                                safeAddrField.hasError
                                || keystoreField.hasError
                                || keystore == null
                                || (safe ? safe.modules.length > 0 : true)
                            }
                            onClick={() => {
                                if (!safe || !keystore) {
                                    return;
                                }

                                setAlert(undefined)

                                linkKeystore({
                                    signer,
                                    safe,
                                    keystoreAddress: keystore.address,
                                    onSuccess: async (result) => {
                                        console.log("linkKeystore:success")
                                        console.log(result)
                                        setAlert({
                                            children: <div>
                                                <div>{`Succesfully relayed transaction`}</div>
                                                <div>Hash: <code>{result.hash}</code></div>
                                            </div>,
                                            type: AlertType.Success
                                        })
                                    },
                                    onError: async (error) => {
                                        console.error("linkKeystore::error")
                                        console.error(error)
                                        setAlert({
                                            children: <span>{error}</span>,
                                            type: AlertType.Error
                                        })
                                    }
                                })
                            }}
                        />
                    </div>
                </div>}
            {alert &&
                <Alert
                    conf={alert}
                    onClose={() => setAlert(undefined)}
                />
            }


        </form>
    </main >
}

export default Keystore