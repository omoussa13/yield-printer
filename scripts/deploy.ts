import { ethers } from 'hardhat'
import { AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, ADDRESS_COMPTROLLER } from '../utils/addresses'

async function main() {
  
  const YieldPrinter = await ethers.getContractFactory("YieldPrinter")
  const yieldPrinter = await YieldPrinter.deploy(AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, ADDRESS_COMPTROLLER)
  await yieldPrinter.deployed()

  const network = await ethers.provider.getNetwork()

  console.log("YieldPrinter deployed at: %s on network %s", yieldPrinter.address, network.name)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })