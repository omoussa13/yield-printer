// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/utils/math/SafeMath.sol';
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FlashLoanReceiverBase} from './flashloan/base/FlashLoanReceiverBase.sol';
import {CERC20} from './dependencies/compound/CERC20.sol';
import {Comptroller} from './dependencies/compound/Comptroller.sol';

contract YieldPrinter is FlashLoanReceiverBase, Ownable {
    using SafeMath for uint256;

    Comptroller public immutable COMPTROLLER;

    // Deposit/Withdraw values
    bytes32 DEPOSIT = keccak256("DEPOSIT");
    bytes32 WITHDRAW = keccak256("WITHDRAW");

    modifier onlyPool() {
        require(
            msg.sender == address(LENDING_POOL),
            "FlashLoan: could be called by lending pool only"
        );
        _;
    }

    constructor(address lpAddressesProvider, address comptroller) FlashLoanReceiverBase(lpAddressesProvider) {
        COMPTROLLER = Comptroller(comptroller);
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    )
        external
        onlyPool
        override
        returns (bool)
    {

        //
        // This contract now has the funds requested.
        // Your logic goes here.
        //
        (address cErc20Contract, uint256 totalAmount, bytes32 operation) = abi.decode(params, (address, uint256, bytes32));

        if(operation == DEPOSIT) {
            CERC20 cToken = CERC20(cErc20Contract);

            // approve underlying asset to be able to be transfered by the cToken contract
            IERC20(assets[0]).approve(cErc20Contract, totalAmount);

            // Mint cTokens
            cToken.mint(totalAmount);

            // Enter the market for the supplied asset to use it as collateral
            address[] memory cTokens = new address[](1);
            cTokens[0] = cErc20Contract;
            COMPTROLLER.enterMarkets(cTokens);

            // Borrow token
            uint256 borrowAmount = amounts[0].add(premiums[0]);
            cToken.borrow(borrowAmount);
        }

        if(operation == WITHDRAW) {
        }
        
        // At the end of your logic above, this contract owes
        // the flashloaned amounts + premiums.
        // Therefore ensure your contract has enough to repay
        // these amounts.
        
        // Approve the LendingPool contract allowance to *pull* the owed amount
        for (uint i = 0; i < assets.length; i++) {
            uint amountOwing = amounts[i].add(premiums[i]);
            IERC20(assets[i]).approve(address(LENDING_POOL), amountOwing);
        }
        
        return true;
    }

    function takeLoan(address asset, uint256 amount, bytes memory params) public {
        address receiverAddress = address(this);
        // 0 = no debt, 1 = stable, 2 = variable
        uint256 noDebt = 0;
        uint16 referralCode = 0;
        address onBehalfOf = address(this);

        address[] memory assets = new address[](1);
        assets[0] = address(asset);

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint256[] memory modes = new uint256[](1);
        modes[0] = noDebt;

        LENDING_POOL.flashLoan(
            receiverAddress,
            assets,
            amounts,
            modes,
            onBehalfOf,
            params,
            referralCode
        );
    }

    function depositToComp(address token, address cToken, uint256 amount) external onlyOwner {
        // Total deposit: 40% amount, 60% flash loan
        uint256 totalAmount = (amount.mul(5)).div(2);

        // loan is 70% of total deposit
        uint256 flashLoanAmount = totalAmount.sub(amount);
        bytes memory data = abi.encode(cToken, totalAmount, DEPOSIT);

        // take loan
        takeLoan(token, flashLoanAmount, data);
    }

    function withdrawFromComp(address token, address cToken, uint256 amount) external onlyOwner {

    }

    function withdrawToken(address _tokenAddress) external onlyOwner {
        uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));
        require(IERC20(_tokenAddress).transfer(owner(), balance), "Failed to withdraw token");
    }

    function withdrawAllEth() external onlyOwner {
        uint amount = address(this).balance;

        (bool success, ) = owner().call{value: amount}("");
        require(success, "Failed to send Ether");
    }
}
