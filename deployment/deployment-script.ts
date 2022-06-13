import { Contract } from 'ethers'
import { ethers, upgrades } from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import * as fs from 'fs'

export const deployContract = async (hre: HardhatRuntimeEnvironment, contractName: string, constructorArgs: Array<any>, verify: boolean) => {
  const DeployedContract = await ethers.getContractFactory(contractName)
  const deployedContract = await DeployedContract.deploy(...constructorArgs)
  await deployedContract.deployed()

  const network = await ethers.provider.getNetwork()

  console.log("YieldPrinter deployed at: %s on network %s", deployedContract.address, network.name)

  if (verify) {
    await verifyEtherscanContract(deployedContract, constructorArgs, hre)
  }
}

export const deployContractWithProxy = async (contractName: string, constructorArgs: Array<any>) => {
  const DeployedContract = await ethers.getContractFactory(contractName)
  const instance = await upgrades.deployProxy(DeployedContract, constructorArgs)
  await instance.deployed()

  const network = await ethers.provider.getNetwork()

  console.log("YieldPrinter deployed behind proxy at: %s on network %s", instance.address, network.name)

  const [signer] = await ethers.getSigners()

  const contract = new ethers.Contract(
    instance.address,
    JSON.parse(fs.readFileSync("contracts/abi/TransparentUpgradeableProxy.json").toString()), 
    signer
  )

  let adminChangedFilter = contract.filters.AdminChanged()
  let adminChangedEvents = await contract.queryFilter(adminChangedFilter, -10, "latest")
  const admin = adminChangedEvents[0].args!.newAdmin
  console.log("Proxy Admin: ", admin)

  const adminContract = new ethers.Contract(
    admin,
    JSON.parse(fs.readFileSync("contracts/abi/ProxyAdmin.json").toString()), 
    signer
  )

  const implementation = await adminContract.getProxyImplementation(instance.address)
  console.log("Proxy implementation: ", implementation)

  // verify implementation contract
  const params = {
    address: implementation,
    constructorArguments: [],
  }

  const hre = require("hardhat")
  await runTask('verify:verify', params, hre)
}

const verifyEtherscanContract = async (
  contract: Contract,
  constructorArgs: (string | string[])[],
  hre: HardhatRuntimeEnvironment,
) => {
  const { address } = contract 
  const params = {
    address: address,
    constructorArguments: constructorArgs,
  }
  console.log("Verify contract: Waiting 5 block confirmations...")
  await contract.deployTransaction.wait(5) // wait 5 block confirmations
  await runTask('verify:verify', params, hre)
}

const runTask = async (
  task: string,
  params: any,
  hre: HardhatRuntimeEnvironment
) => {
  try {
    await hre.run(task, params)
  } catch(error) {
    if (error.message.includes("Reason: Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Error while running task", error)
    }
  }
}