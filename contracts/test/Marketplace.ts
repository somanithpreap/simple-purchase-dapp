import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Marketplace", function () {
  async function deployAndSigners() {
    const marketplace = await ethers.deployContract("Marketplace");
    const [, buyer, seller, other] = await ethers.getSigners();
    return { marketplace, buyer, seller, other };
  }

  const orderId = 1n;
  const price = ethers.parseEther("1");

  describe("purchase", function () {
    it("escrows funds and emits OrderCreated", async function () {
      const { marketplace, buyer, seller } = await deployAndSigners();

      await expect(
        marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price }),
      )
        .to.emit(marketplace, "OrderCreated")
        .withArgs(orderId, buyer.address, seller.address, price);

      expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(price);

      const order = await marketplace.orders(orderId);
      expect(order.buyer).to.equal(buyer.address);
      expect(order.seller).to.equal(seller.address);
      expect(order.amount).to.equal(price);
      expect(order.status).to.equal(1n); // Escrowed
    });

    it("rejects mismatched payment amount", async function () {
      const { marketplace, buyer, seller } = await deployAndSigners();

      await expect(
        marketplace.connect(buyer).purchase(orderId, seller.address, price, {
          value: price - 1n,
        }),
      )
        .to.be.revertedWithCustomError(marketplace, "IncorrectPaymentAmount")
        .withArgs(price, price - 1n);
    });

    it("rejects a second purchase on the same orderId", async function () {
      const { marketplace, buyer, seller, other } = await deployAndSigners();

      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });

      await expect(
        marketplace.connect(other).purchase(orderId, seller.address, price, { value: price }),
      ).to.be.revertedWithCustomError(marketplace, "OrderAlreadyExists").withArgs(orderId);
    });

    it("rejects a zero seller address", async function () {
      const { marketplace, buyer } = await deployAndSigners();

      await expect(
        marketplace.connect(buyer).purchase(orderId, ethers.ZeroAddress, price, { value: price }),
      ).to.be.revertedWithCustomError(marketplace, "InvalidSeller");
    });
  });

  describe("confirmDelivery", function () {
    it("releases funds to the seller and emits DeliveryConfirmed", async function () {
      const { marketplace, buyer, seller } = await deployAndSigners();
      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });

      const tx = marketplace.connect(buyer).confirmDelivery(orderId);

      await expect(tx)
        .to.emit(marketplace, "DeliveryConfirmed")
        .withArgs(orderId, buyer.address, seller.address, price);
      await expect(tx).to.changeEtherBalances(ethers, [seller], [price]);

      const order = await marketplace.orders(orderId);
      expect(order.status).to.equal(2n); // Delivered
    });

    it("rejects confirmation from a non-buyer", async function () {
      const { marketplace, buyer, seller, other } = await deployAndSigners();
      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });

      await expect(
        marketplace.connect(other).confirmDelivery(orderId),
      ).to.be.revertedWithCustomError(marketplace, "NotBuyer").withArgs(orderId);
    });

    it("rejects a double confirmation", async function () {
      const { marketplace, buyer, seller } = await deployAndSigners();
      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });
      await marketplace.connect(buyer).confirmDelivery(orderId);

      await expect(
        marketplace.connect(buyer).confirmDelivery(orderId),
      ).to.be.revertedWithCustomError(marketplace, "OrderNotEscrowed").withArgs(orderId);
    });
  });

  describe("cancelOrder", function () {
    it("lets the buyer cancel while escrowed and refunds them", async function () {
      const { marketplace, buyer, seller } = await deployAndSigners();
      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });

      const tx = marketplace.connect(buyer).cancelOrder(orderId);

      await expect(tx)
        .to.emit(marketplace, "OrderCancelled")
        .withArgs(orderId, buyer.address, price);
      await expect(tx).to.changeEtherBalances(ethers, [buyer], [price]);

      const order = await marketplace.orders(orderId);
      expect(order.status).to.equal(3n); // Refunded
    });

    it("lets the seller cancel while escrowed", async function () {
      const { marketplace, buyer, seller } = await deployAndSigners();
      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });

      await marketplace.connect(seller).cancelOrder(orderId);

      const order = await marketplace.orders(orderId);
      expect(order.status).to.equal(3n); // Refunded
    });

    it("rejects cancellation from an unrelated party", async function () {
      const { marketplace, buyer, seller, other } = await deployAndSigners();
      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });

      await expect(
        marketplace.connect(other).cancelOrder(orderId),
      ).to.be.revertedWithCustomError(marketplace, "NotBuyerOrSeller").withArgs(orderId);
    });

    it("rejects cancellation after delivery was already confirmed", async function () {
      const { marketplace, buyer, seller } = await deployAndSigners();
      await marketplace.connect(buyer).purchase(orderId, seller.address, price, { value: price });
      await marketplace.connect(buyer).confirmDelivery(orderId);

      await expect(
        marketplace.connect(buyer).cancelOrder(orderId),
      ).to.be.revertedWithCustomError(marketplace, "OrderNotEscrowed").withArgs(orderId);
    });
  });
});
