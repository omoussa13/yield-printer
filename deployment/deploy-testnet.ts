import { KOVAN_AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, KOVAN_ADDRESS_COMPTROLLER } from '../utils/addresses'
import { deployContractWithProxy } from './deployment-script'

const main = async () => {
  const constructorArgs = [KOVAN_AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, KOVAN_ADDRESS_COMPTROLLER]
  
  await deployContractWithProxy('YieldPrinterV1', constructorArgs)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })