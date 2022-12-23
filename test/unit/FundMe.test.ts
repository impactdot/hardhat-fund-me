import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { FundMe, MockV3Aggregator } from "../../typechain-types";
import { assert, expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { equal } from "assert";
import { developmentChains } from "../../helper-hardhat-config";

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", async function () {
          let fundMe: FundMe;
          let mockV3Aggregator: MockV3Aggregator;
          let deployer: SignerWithAddress;
          let accounts: SignerWithAddress[];
          this.beforeEach(async function () {
              // deploy our fundme contract using hardhat-deploy
              accounts = await ethers.getSigners();
              deployer = accounts[0];
              await deployments.fixture(["all"]);
              fundMe = await ethers.getContract("FundMe", deployer);
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              );
          });
          describe("constructor", async function () {
              it("sets the aggregator addresses correctly", async () => {
                  const response = await fundMe.getPriceFeed();
                  assert.equal(response, mockV3Aggregator.address);
              });
          });
          describe("fund", async function () {
              it("fails if you don't send enough eth", async () => {
                  await expect(fundMe.fund()).to.be.reverted;
              });
              it("updates the amount funded", async () => {
                  await fundMe.fund({ value: ethers.utils.parseEther("1") });
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer.address
                  );
                  assert.equal(
                      response.toString(),
                      ethers.utils.parseEther("1").toString()
                  );
              });
              it("checks whether the funder was added to funders array", async () => {
                  await fundMe.fund({ value: ethers.utils.parseEther("1") });
                  const response = await fundMe.getFunder(0);
                  assert.equal(response.toString(), deployer.address);
              });
          });
          describe("withdraw", async function () {
              this.beforeEach(async function () {
                  await fundMe.fund({ value: ethers.utils.parseEther("1") });
              });
              it("gives a single funder all their ETH back", async () => {
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);
                  const transactionResponse = await fundMe.withdraw();
                  const transactionReceipt = await transactionResponse.wait();
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);

                  // Assert
                  assert.equal(endingFundMeBalance.toString(), "0");
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  );
              });
              it("gives multiple funders ether back", async () => {
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);
                  await fundMe
                      .connect(accounts[1])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[2])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[3])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[4])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[5])
                      .fund({ value: ethers.utils.parseEther("1") });
                  const transactionResponse = await fundMe.withdraw();
                  const transactionReceipt = await transactionResponse.wait();
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);
                  assert.equal(endingFundMeBalance.toString(), "0");
                  await expect(fundMe.getFunder(0)).to.be.reverted;
                  for (let i = 1; i < 6; i++) {
                      assert.equal(
                          await (
                              await fundMe.getAddressToAmountFunded(
                                  accounts[i].address
                              )
                          ).toString(),
                          "0"
                      );
                  }
              });
              it("only allows owner to withdraw", async () => {
                  const attacker = accounts[1];
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  );
                  await expect(attackerConnectedContract.withdraw()).to.be
                      .reverted;
              });
              it("cheaper withdraw", async () => {
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);
                  await fundMe
                      .connect(accounts[1])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[2])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[3])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[4])
                      .fund({ value: ethers.utils.parseEther("1") });
                  await fundMe
                      .connect(accounts[5])
                      .fund({ value: ethers.utils.parseEther("1") });
                  const transactionResponse = await fundMe.cheaperWithdraw();
                  const transactionReceipt = await transactionResponse.wait();
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);
                  assert.equal(endingFundMeBalance.toString(), "0");
                  await expect(fundMe.getFunder(0)).to.be.reverted;
                  for (let i = 1; i < 6; i++) {
                      assert.equal(
                          await (
                              await fundMe.getAddressToAmountFunded(
                                  accounts[i].address
                              )
                          ).toString(),
                          "0"
                      );
                  }
              });
              it("gives a single funder all their ETH back cheaper", async () => {
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address);
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);
                  const transactionResponse = await fundMe.cheaperWithdraw();
                  const transactionReceipt = await transactionResponse.wait();
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  );
                  const endingDeployerBalance =
                      await fundMe.provider.getBalance(deployer.address);

                  // Assert
                  assert.equal(endingFundMeBalance.toString(), "0");
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerBalance.add(gasCost).toString()
                  );
              });
          });
      });
