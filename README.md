# VeriCred

**Blockchain Academic Credential Verification.** A university (the **issuer**)
registers the **SHA-256 hash** of each credential PDF together with a
human-readable **certificate ID**. Anyone can later prove a credential was issued
by that registered issuer and has not been altered since registration.

"Credential" is used as the general term throughout: it covers Bachelor's,
Master's, and PhD degrees, not just diplomas.

The contract is deployed to **Polygon Amoy** (testnet) and the frontend talks to
it directly. The same code also runs against a local Hardhat node for
development.

## Privacy: no personal data on-chain

This is enforced throughout. The contract stores **only**:

| On-chain field   | What it is                                     |
| ---------------- | ---------------------------------------------- |
| `docHash`        | SHA-256 hash of the credential PDF (`bytes32`)  |
| `certificateId`  | Human-readable ID, e.g. `ESU-2026-7QK4ZP`      |
| `issuer`         | Address that registered the credential         |
| `timestamp`      | Block time of registration (`uint256`)         |

**No names, student IDs, emails, degrees, or dates are ever written on-chain.**
All personal metadata lives in the PDF and in the UI only (shown back to the
issuer for the student's records). The document hash reveals nothing about the
document's contents, so privacy is preserved while integrity is still provable.

## How it works (hash-only model)

1. The credential PDF is hashed **off-chain, in the browser** with the Web Crypto
   API (`SHA-256` over the raw bytes) → a `bytes32` fingerprint.
2. The issuer registers that hash plus a certificate ID. The PDF itself is never
   uploaded or stored anywhere on-chain.
3. To verify, anyone re-hashes their copy of the PDF and looks the hash up. A
   match means the file is **byte-for-byte identical** to the registered one.

Gas cost is tiny and constant regardless of file size.

### PDF vs. typed metadata

The uploaded PDF is the **source of truth**. The typed fields in Issue mode
(name, degree, university, etc.) are descriptive metadata that the issuer is
responsible for entering correctly. They are **not** parsed from or cross-checked
against the PDF's contents by design, only the PDF file's hash is bound on-chain.

### What this proves, and what it does not

- ✅ **Integrity.** The file has not been modified by even one byte since
  registration. Any change produces a different hash → not found.
- ✅ **Provenance.** The record was created by a specific issuer address, which
  you can see.
- ❌ **It does NOT verify the issuer's real-world legitimacy.** Trust roots in the
  issuer address: you must already trust that this address belongs to a real,
  accredited institution. This proves a credential is *unaltered and was
  registered by this address*, not that the address is who it claims to be.

## Certificate IDs

Each credential gets a readable, unique ID in the format `PREFIX-YYYY-XXXXXX`
(e.g. `ESU-2026-7QK4ZP`):

- **PREFIX**, derived from the university name (initials of significant words).
- **YYYY**, the graduation year.
- **XXXXXX**, six characters from an unambiguous alphabet (no `0/O/1/I/L`),
  drawn from the browser CSPRNG.

Practical uniqueness comes from the random suffix; **on-chain uniqueness is
enforced by the contract**, which reverts if a certificate ID (or document hash)
is already registered. Issue mode also checks `verifyByHash` *before* sending the
transaction and warns early if the document is already registered.

## QR codes & the two-tier verification model

When a credential is issued, the app generates a **QR code** (via the `qrcode`
library) encoding `<origin>/verify?id=CERTIFICATE_ID`, downloadable as a PNG.
Scanning it opens the verify page and **auto-runs the certificate ID lookup**.

Verification has **two tiers of trust**, framed honestly in the UI:

- **Strong proof (upload the PDF).** Re-hashes the file and calls
  `verifyByHash`. A match means *this exact document* is registered and
  unaltered.
- **Record check (certificate ID or QR).** Calls `verifyById`. This confirms a
  record with that ID exists on-chain and who issued it, but it does **not**
  prove that any particular PDF matches it. The UI says so explicitly and prompts
  the verifier to upload the PDF for full proof.

## The contract

`DiplomaRegistry` (Solidity `^0.8.20`, OpenZeppelin `Ownable`). The Solidity
contract name and function names keep the `Diploma` prefix because they are part
of the deployed ABI; the product and all user-facing copy use "credential".

- `registerDiploma(bytes32 docHash, string certificateId)` (**owner only**).
  Reverts if the `docHash` **or** the `certificateId` is already registered.
  Emits `DiplomaRegistered(docHash, certificateId, issuer, timestamp)`.
- `verifyByHash(bytes32 docHash) view returns (bool exists, string certificateId, address issuer, uint256 timestamp)` (public).
- `verifyById(string certificateId) view returns (bool exists, bytes32 docHash, address issuer, uint256 timestamp)` (public).

The deployer becomes the initial owner / registered issuer.

### Gas fees on Polygon Amoy

Amoy enforces a minimum priority fee (~25 gwei), so the Issue transaction sets
explicit EIP-1559 fees: `maxPriorityFeePerGas = 30 gwei`,
`maxFeePerGas = 50 gwei`. It also estimates gas **without** those fee fields and
passes an explicit `gasLimit` to the send, because Amoy's public RPC runs a
worst-case balance pre-check (`gasLimit × maxFeePerGas`) during `eth_estimateGas`
that otherwise fails with "missing revert data". See "Issue-flow gas fix" below.

## Project layout

```
contracts/DiplomaRegistry.sol   The smart contract (Ownable, hash-only storage)
test/DiplomaRegistry.js          Mocha/chai tests
scripts/deploy.js                Deploy; writes address + ABI into the frontend
frontend/                        Next.js + TypeScript + Tailwind app (Issue / Verify)
```

The frontend reads the network, address, and ABI from
`frontend/src/contract/DiplomaRegistry.json` (currently pointed at the live Amoy
deployment).

## Run the frontend against the live Amoy contract

```shell
cd frontend
npm install   # first time only
npm run dev
```

Open <http://localhost:3000>. Verify mode works with no wallet. To issue, connect
MetaMask on **Polygon Amoy** (Chain ID `80002`) using the **registered issuer
account** (the contract owner), with some test MATIC for gas.

## Local development (Hardhat node)

You can also run everything locally. From the project root, in three terminals:

```shell
# 1. start a local node (prints 20 funded accounts; account #0 is the owner)
npx hardhat node

# 2. deploy and write address + ABI into the frontend config
npx hardhat run scripts/deploy.js --network localhost

# 3. run the frontend
cd frontend && npm run dev
```

Point MetaMask at RPC URL `http://127.0.0.1:8545`, Chain ID `31337`, and import
Hardhat account #0 (its private key is printed by `npx hardhat node`) to act as
the issuer.

> ⚠️ The Hardhat test keys are well-known and public. Never use them on a real
> network.

## Tests

```shell
npx hardhat test
```

Covers registration + event, duplicate-hash revert, duplicate-certificate-ID
revert, `verifyByHash` found / not-found, `verifyById` found / not-found, and
non-owner-cannot-register.

## Issue-flow gas fix

Issuing a credential previously failed on `estimateGas` with "missing revert data
/ CALL_EXCEPTION" before MetaMask even opened. Cause: the EIP-1559 fee overrides
were passed into the contract method call, which forced them into ethers' implicit
`eth_estimateGas`. On Amoy that estimate does a balance pre-check of
`gasLimit × maxFeePerGas` (≈ 0.014 MATIC at 50 gwei) which exceeded the issuer's
balance and the public RPC surfaced it as "missing revert data" (no decodable
revert). The document hash and certificate ID were never corrupted.

Fix: estimate gas **without** the fee fields, then send with the fees **and** an
explicit `gasLimit` so ethers skips the implicit estimate. The 50 gwei ceiling now
only applies to the actual send, which costs base + 30 gwei (≈ 0.0085 MATIC) and
is affordable. Issue mode also pre-checks ownership and duplicate hashes, and all
raw RPC/ethers errors are mapped to clear human-readable messages.
