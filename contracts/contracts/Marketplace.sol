// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Simple peer-to-peer escrow for the e-commerce DApp. The product
/// catalog, price, and stock live off-chain in Postgres; this contract only
/// ever sees an order id, the two parties, and an escrowed amount.
contract Marketplace is ReentrancyGuard {
    enum OrderStatus {
        None,
        Escrowed,
        Delivered,
        Refunded
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        OrderStatus status;
        uint64 createdAt;
    }

    mapping(uint256 => Order) public orders;

    event OrderCreated(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event DeliveryConfirmed(uint256 indexed orderId, address indexed buyer, address indexed seller, uint256 amount);
    event OrderCancelled(uint256 indexed orderId, address indexed initiator, uint256 amount);

    error OrderAlreadyExists(uint256 orderId);
    error OrderNotEscrowed(uint256 orderId);
    error IncorrectPaymentAmount(uint256 expected, uint256 received);
    error NotBuyer(uint256 orderId);
    error NotBuyerOrSeller(uint256 orderId);
    error InvalidSeller();
    error TransferFailed();

    /// @notice Buyer escrows funds for an order. `orderId` is the Postgres
    /// Order.id, passed through directly so both systems share one id space.
    function purchase(uint256 orderId, address seller, uint256 expectedAmount) external payable {
        if (orders[orderId].status != OrderStatus.None) revert OrderAlreadyExists(orderId);
        if (seller == address(0)) revert InvalidSeller();
        if (msg.value != expectedAmount) revert IncorrectPaymentAmount(expectedAmount, msg.value);

        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            status: OrderStatus.Escrowed,
            createdAt: uint64(block.timestamp)
        });

        emit OrderCreated(orderId, msg.sender, seller, msg.value);
    }

    /// @notice Buyer confirms delivery, releasing escrowed funds to the seller.
    function confirmDelivery(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Escrowed) revert OrderNotEscrowed(orderId);
        if (msg.sender != order.buyer) revert NotBuyer(orderId);

        order.status = OrderStatus.Delivered;
        uint256 amount = order.amount;

        (bool success, ) = payable(order.seller).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit DeliveryConfirmed(orderId, order.buyer, order.seller, amount);
    }

    /// @notice Buyer or seller can cancel while funds are still escrowed,
    /// refunding the buyer. No dispute window in this simplified demo flow.
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        if (order.status != OrderStatus.Escrowed) revert OrderNotEscrowed(orderId);
        if (msg.sender != order.buyer && msg.sender != order.seller) revert NotBuyerOrSeller(orderId);

        order.status = OrderStatus.Refunded;
        uint256 amount = order.amount;

        (bool success, ) = payable(order.buyer).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit OrderCancelled(orderId, msg.sender, amount);
    }
}
