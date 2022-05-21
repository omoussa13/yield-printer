// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {IFlashLoanReceiver} from "../interfaces/IFlashLoanReceiver.sol";
import {ILendingPool} from "../../dependencies/aave/ILendingPool.sol";
import {ILendingPoolAddressesProvider} from "../../dependencies/aave/ILendingPoolAddressesProvider.sol";

abstract contract FlashLoanReceiverBase is IFlashLoanReceiver {

    ILendingPool public immutable LENDING_POOL;

    constructor(address lendingPoolAddressesProvider) {
        ILendingPoolAddressesProvider addressesProvider = ILendingPoolAddressesProvider(lendingPoolAddressesProvider);
        LENDING_POOL = ILendingPool(addressesProvider.getLendingPool());
    }
}
