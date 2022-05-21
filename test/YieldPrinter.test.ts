import { expect } from "chai"
import { ethers, network } from "hardhat"
import { BigNumberish, Contract, Signer } from 'ethers'
import * as fs from 'fs'
import { 
  AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, 
  ADDRESS_COMPTROLLER, 
  ADDRESS_LENDING_POOL, 
  ADDRESS_UNISWAP_ROUTER_V3, 
  ADDRESS_WETH, 
  ADDRESS_DAI, 
  ADDRESS_COMPOUND_DAI
} from "../utils/addresses";

describe("YieldPrinter", function () {
  let owner: Signer
  let user: Signer
  let yieldPrinter: Contract
  let assetSwapper: Contract

  beforeEach(async () => {
    const [_owner] = await ethers.getSigners()
    owner = _owner
    const accountToImpersonate = "0xcA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa"

    // deploy AssetSwapper
    const AssetSwapper = await ethers.getContractFactory("AssetSwapper")
    assetSwapper = await AssetSwapper.deploy(ADDRESS_UNISWAP_ROUTER_V3)
    await assetSwapper.deployed()

    // deploy YieldPrinter
    const YieldPrinter = await ethers.getContractFactory("YieldPrinter")
    yieldPrinter = await YieldPrinter.deploy(AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, ADDRESS_COMPTROLLER)
    yieldPrinter.deployed()

    // impersonate an account to be used for testing
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [accountToImpersonate],
    })

    user = await ethers.getSigner(accountToImpersonate)
  })

  describe("Deployment", () => {
    it("Should successfully deploy contract", async () => {
      expect(await yieldPrinter.owner()).to.equal(await owner.getAddress())
      expect(String(await yieldPrinter.LENDING_POOL()).toLowerCase()).to.equal(ADDRESS_LENDING_POOL.toLowerCase())
      expect(String(await yieldPrinter.COMPTROLLER()).toLowerCase()).to.equal(ADDRESS_COMPTROLLER.toLowerCase())
    })
  })

  describe("Deposit", () => {
    describe("Deposit to COMPOUND", () => {
      it("Should successfully leverage supply token to compound", async () => {
        await prepareSomeToken(user, assetSwapper, yieldPrinter)

        await yieldPrinter.depositToComp(ADDRESS_DAI, ADDRESS_COMPOUND_DAI, ethers.utils.parseEther('10000'))

        const dai = getContract(ADDRESS_DAI, 'contracts/abi/ERC20.json')
      })
    })
  })
})

const prepareSomeToken = async (user: Signer, assetSwapper: Contract, yieldPrinter: Contract) => {
  const weth = getContract(ADDRESS_WETH, 'contracts/abi/WrappedEther.json')

  // First deposit some ETH to get WETH
  await weth.connect(user).deposit({ value: ethers.utils.parseEther("11") })

  // approve assetSwapper to spend WETH
  await weth.connect(user).approve(assetSwapper.address, ethers.utils.parseEther("11"))

  // get some DAI
  await assetSwapper.connect(user).swapExactOutput(
    ADDRESS_WETH,
    ethers.utils.parseEther("11"),
    ADDRESS_DAI,
    ethers.utils.parseUnits("10000"))
  
  const dai = getContract(ADDRESS_DAI, 'contracts/abi/ERC20.json')

  expect(await dai.connect(user).balanceOf(await user.getAddress()))
        .to.equal(ethers.utils.parseEther("10000"))

  // transfer some DAI to contract
  await dai.connect(user).transfer(yieldPrinter.address, ethers.utils.parseUnits("10000"))

  expect(await dai.connect(user).balanceOf(yieldPrinter.address))
        .to.equal(ethers.utils.parseEther("10000"))
}

const getContract = (address: string, abiLocation: string): Contract => {
  const abi = JSON.parse(fs.readFileSync(abiLocation).toString())
  return new ethers.Contract(address, abi)
}
