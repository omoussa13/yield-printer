import { expect } from "chai"
import { ethers, network, upgrades } from "hardhat"
import { Contract, Signer } from 'ethers'
import * as fs from 'fs'
import * as dotenv from 'dotenv'

import { 
  AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, 
  ADDRESS_COMPTROLLER, 
  ADDRESS_LENDING_POOL, 
  ADDRESS_UNISWAP_ROUTER_V3, 
  ADDRESS_WETH, 
  ADDRESS_DAI, 
  ADDRESS_COMPOUND_DAI
} from "../utils/addresses";

dotenv.config()

describe("YieldPrinterV1", function () {
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
    const constructorArgs: Array<any> = [AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, ADDRESS_COMPTROLLER]
    const YieldPrinter = await ethers.getContractFactory("YieldPrinterV1")
    yieldPrinter = await upgrades.deployProxy(YieldPrinter, constructorArgs)
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
      expect(String(await yieldPrinter.getLendingPool()).toLowerCase()).to.equal(ADDRESS_LENDING_POOL.toLowerCase())
      expect(String(await yieldPrinter.getComptroller()).toLowerCase()).to.equal(ADDRESS_COMPTROLLER.toLowerCase())
    })
  })

  
  describe("Deposit", () => {
    describe("Deposit to COMPOUND", () => {
      it("Should successfully leverage supply token to compound", async () => {
        await prepareSomeToken(user, assetSwapper, yieldPrinter)

        // initialiaze some variables
        const AMOUNT_TO_BORROW = '10000'
        const cDai = getContract(ADDRESS_COMPOUND_DAI, 'contracts/abi/cDai.json')
        const comptroller = getContract(ADDRESS_COMPTROLLER, 'contracts/abi/Comptroller.json')
        const exchangeRateStored = await cDai.connect(user).exchangeRateStored()

        let cTokenBalance = await cDai.connect(user).balanceOf(yieldPrinter.address)
        let borrowBalance = await cDai.connect(user).borrowBalanceStored(yieldPrinter.address)

        expect(cTokenBalance).to.equal(0)
        expect(borrowBalance).to.equal(0)

        // deposit into COMPOUND
        await yieldPrinter.connect(owner).depositToComp(ADDRESS_DAI, ADDRESS_COMPOUND_DAI, ethers.utils.parseEther(AMOUNT_TO_BORROW))

        // perform some checks
        cTokenBalance = await cDai.connect(user).balanceOf(yieldPrinter.address)
        borrowBalance = await cDai.connect(user).borrowBalanceStored(yieldPrinter.address)
        expect(cTokenBalance).to.gt(0)
        expect(borrowBalance).to.gt(1.5 * Number(AMOUNT_TO_BORROW)) // because of leverage, we use 1.5X + fees
        
        const underlyingBalance = ethers.utils.formatUnits(cTokenBalance.mul(exchangeRateStored), 36)
        expect(Number(underlyingBalance)).to.gt(2 * Number(AMOUNT_TO_BORROW))

        const {
          0: error,
          1: liquidity,
          2: shortfall
        } = await comptroller.connect(user).getAccountLiquidity(yieldPrinter.address)

        expect(error).to.equal(0)
        expect(liquidity).to.gt(0)
        expect(shortfall).to.equal(0)
      })

      // TODO: This test might be obsolete in the future, when other accounts are allowed to use the app
      it("Only the owner is allowed to deposit to compound", async () => {
        await expect(yieldPrinter.connect(user).depositToComp(ADDRESS_DAI, ADDRESS_COMPOUND_DAI, ethers.utils.parseEther('10000')))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it("Can't call 'executeOperation' flash loan function directly", async () => {
        const initiator = '0xcA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa'
        await expect(yieldPrinter.executeOperation(['0xcA8Fa8f0b631EcdB18Cda619C4Fc9d197c8aFfCa'], ["1"], ["0"], initiator, [0]))
          .to.be.revertedWith('FlashLoan: could be called by lending pool only')
      })
    })
  })

  describe("Withdraw", () => {
    describe("Repay debt", () => {
      it("Should successfully repay borrowed token to compound", async () => {
        await prepareSomeToken(user, assetSwapper, yieldPrinter)

        // initialiaze some variables
        const AMOUNT_TO_BORROW = '10000'
        const cDai = getContract(ADDRESS_COMPOUND_DAI, 'contracts/abi/cDai.json')
        const dai = getContract(ADDRESS_DAI, 'contracts/abi/cDai.json')
        let daiBalance = await dai.connect(user).balanceOf(yieldPrinter.address)
        expect(daiBalance).to.gt(0)

        // deposit and leverage borrow
        await yieldPrinter.connect(owner).depositToComp(ADDRESS_DAI, ADDRESS_COMPOUND_DAI, ethers.utils.parseEther(AMOUNT_TO_BORROW))

        let cTokenBalance = await cDai.connect(user).balanceOf(yieldPrinter.address)
        let borrowBalance = await cDai.connect(user).borrowBalanceStored(yieldPrinter.address)
        daiBalance = await dai.connect(user).balanceOf(yieldPrinter.address)

        expect(cTokenBalance).to.gt(0)
        expect(borrowBalance).to.gt(1.5 * Number(AMOUNT_TO_BORROW)) // because of leverage, we use 1.5X + fees
        expect(daiBalance).to.equal(0)
        
        // repay borrow and redeem deposited asset
        await yieldPrinter.connect(owner).withdrawFromComp(ADDRESS_DAI, ADDRESS_COMPOUND_DAI)

        cTokenBalance = await cDai.connect(user).balanceOf(yieldPrinter.address)
        borrowBalance = await cDai.connect(user).borrowBalanceStored(yieldPrinter.address)
        expect(cTokenBalance).to.equal(0)
        expect(borrowBalance).to.equal(0)

        daiBalance = await dai.connect(user).balanceOf(yieldPrinter.address)
        expect(daiBalance).to.gt(0)
      })

      // TODO: This test might be obsolete in the future, when other accounts are allowed to use the app
      it("Only the owner is allowed to repay debt and withdraw from compound", async () => {
        await expect(yieldPrinter.connect(user).withdrawFromComp(ADDRESS_DAI, ADDRESS_COMPOUND_DAI))
          .to.be.revertedWith('Ownable: caller is not the owner')
      })
    })

    describe("Withdraw tokens", () => {
      it("Should successfully withdraw any token from contract", async () => {
        // send 10_000 DAI to contract
        await prepareSomeToken(user, assetSwapper, yieldPrinter)

        const dai = getContract(ADDRESS_DAI, 'contracts/abi/cDai.json')
        let daiBalance = await dai.connect(user).balanceOf(yieldPrinter.address)
        expect(daiBalance).to.equal(ethers.utils.parseUnits('10000'))
      })

      it("Should successfully withdraw any remaining ETH from contract", async () => {
        let ethBalance = await ethers.provider.getBalance(yieldPrinter.address)
        expect(ethBalance).to.equal(0)
        // send 1 ETH to contract
        await sendSomeEth(user, yieldPrinter.address, '1')

        ethBalance = await ethers.provider.getBalance(yieldPrinter.address)
        expect(ethBalance).to.equal(ethers.utils.parseEther('1'))

        await yieldPrinter.connect(owner).withdrawAllEth()

        ethBalance = await ethers.provider.getBalance(yieldPrinter.address)
        expect(ethBalance).to.equal(0)
      })

      it("Only the owner is allowed to withdraw ETH", async () => {
        await expect(yieldPrinter.connect(user).withdrawAllEth())
          .to.be.revertedWith('Ownable: caller is not the owner')
      })

      it("Only the owner is allowed to withdraw any token from the contract", async () => {
        await expect(yieldPrinter.connect(user).withdrawToken(ADDRESS_DAI))
          .to.be.revertedWith('Ownable: caller is not the owner')
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

const sendSomeEth = async (sender: Signer, receiver: string, amount: string) => {
  return sender.sendTransaction({
    to: receiver,
    value: ethers.utils.parseEther(amount)
  })
}

const getContract = (address: string, abiLocation: string): Contract => {
  const abi = JSON.parse(fs.readFileSync(abiLocation).toString())
  return new ethers.Contract(address, abi)
}
