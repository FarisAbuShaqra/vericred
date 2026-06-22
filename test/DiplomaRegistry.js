const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DiplomaRegistry", function () {
  let registry;
  let owner;
  let other;

  // SHA-256-style hash of an example diploma PDF (any bytes32 works for tests).
  const docHash = ethers.keccak256(ethers.toUtf8Bytes("diploma.pdf"));
  const certId = "UNIV-2026-AB12CD";

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("DiplomaRegistry");
    registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
  });

  it("registers a diploma and emits an event (no PII on-chain)", async function () {
    await expect(registry.registerDiploma(docHash, certId))
      .to.emit(registry, "DiplomaRegistered")
      .withArgs(docHash, certId, owner.address, anyTimestamp());
  });

  it("reverts when registering a duplicate hash", async function () {
    await registry.registerDiploma(docHash, certId);

    await expect(
      registry.registerDiploma(docHash, "UNIV-2026-DIFFERENT")
    ).to.be.revertedWith("DiplomaRegistry: hash already registered");
  });

  it("reverts when registering a duplicate certificate ID", async function () {
    await registry.registerDiploma(docHash, certId);

    const otherHash = ethers.keccak256(ethers.toUtf8Bytes("another.pdf"));
    await expect(
      registry.registerDiploma(otherHash, certId)
    ).to.be.revertedWith("DiplomaRegistry: certificateId already used");
  });

  it("verifyByHash returns the record when found", async function () {
    const tx = await registry.registerDiploma(docHash, certId);
    const block = await ethers.provider.getBlock(tx.blockNumber);

    const [exists, cid, issuer, timestamp] = await registry.verifyByHash(docHash);
    expect(exists).to.equal(true);
    expect(cid).to.equal(certId);
    expect(issuer).to.equal(owner.address);
    expect(timestamp).to.equal(block.timestamp);
  });

  it("verifyByHash returns empty when not found", async function () {
    const unknown = ethers.keccak256(ethers.toUtf8Bytes("not-registered.pdf"));

    const [exists, cid, issuer, timestamp] = await registry.verifyByHash(unknown);
    expect(exists).to.equal(false);
    expect(cid).to.equal("");
    expect(issuer).to.equal(ethers.ZeroAddress);
    expect(timestamp).to.equal(0n);
  });

  it("verifyById returns the record when found", async function () {
    const tx = await registry.registerDiploma(docHash, certId);
    const block = await ethers.provider.getBlock(tx.blockNumber);

    const [exists, hash, issuer, timestamp] = await registry.verifyById(certId);
    expect(exists).to.equal(true);
    expect(hash).to.equal(docHash);
    expect(issuer).to.equal(owner.address);
    expect(timestamp).to.equal(block.timestamp);
  });

  it("verifyById returns empty when not found", async function () {
    const [exists, hash, issuer, timestamp] = await registry.verifyById("UNIV-2026-NOPE99");
    expect(exists).to.equal(false);
    expect(hash).to.equal(ethers.ZeroHash);
    expect(issuer).to.equal(ethers.ZeroAddress);
    expect(timestamp).to.equal(0n);
  });

  it("reverts when a non-owner tries to register", async function () {
    await expect(
      registry.connect(other).registerDiploma(docHash, certId)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
      .withArgs(other.address);
  });
});

// Helper: accept any uint256 timestamp value in the emitted event.
function anyTimestamp() {
  return (value) => typeof value === "bigint" && value > 0n;
}
