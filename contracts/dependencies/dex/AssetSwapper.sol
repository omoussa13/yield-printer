// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';
import './TransferHelper.sol';

contract AssetSwapper {
    ISwapRouter public immutable swapRouter;

    uint24 public constant poolFee = 3000;

    constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;
    }

    function swapExactInput(
        address _tokenIn, 
        uint256 _amountIn, 
        address _tokenOut, 
        uint256 _amountOutMinimum
    ) external returns (uint256 amountOut) {
        TransferHelper.safeTransferFrom(_tokenIn, msg.sender, address(this), _amountIn);

        TransferHelper.safeApprove(_tokenIn, address(swapRouter), _amountIn);

        ISwapRouter.ExactInputSingleParams memory params =
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountIn: _amountIn,
                amountOutMinimum: _amountOutMinimum,
                sqrtPriceLimitX96: 0
            });

        amountOut = swapRouter.exactInputSingle(params);
    }

    function swapExactOutput(
        address _tokenIn,
        uint256 _amountInMaximum,
        address _tokenOut,
        uint256 _amountOut
    ) external returns (uint256 amountIn) {
        TransferHelper.safeTransferFrom(_tokenIn, msg.sender, address(this), _amountInMaximum);

        TransferHelper.safeApprove(_tokenIn, address(swapRouter), _amountInMaximum);

        ISwapRouter.ExactOutputSingleParams memory params =
            ISwapRouter.ExactOutputSingleParams({
                tokenIn: _tokenIn,
                tokenOut: _tokenOut,
                fee: poolFee,
                recipient: msg.sender,
                deadline: block.timestamp,
                amountOut: _amountOut,
                amountInMaximum: _amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
        amountIn = swapRouter.exactOutputSingle(params);

        if (amountIn < _amountInMaximum) {
            TransferHelper.safeApprove(_tokenIn, address(swapRouter), 0);
            TransferHelper.safeTransfer(_tokenIn, msg.sender, _amountInMaximum - amountIn);
        }
    }
}