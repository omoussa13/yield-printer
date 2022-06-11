import { AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, ADDRESS_COMPTROLLER } from '../utils/addresses'
import { deployContractWithProxy } from './deployment-script'

const main = async () => {
  const constructorArgs = [AAVE_LENDING_POOL_ADDRESSESS_PROVIDER, ADDRESS_COMPTROLLER]
  
  await deployContractWithProxy('YieldPrinterV1', constructorArgs)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })