// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title DiplomaRegistry
/// @notice Registers diplomas on-chain by the SHA-256 hash of the PDF plus a
///         human-readable certificate ID. This lets anyone later prove a
///         diploma was registered by this issuer and has not been altered.
/// @dev PRIVACY: No personal data is ever stored on-chain. Each record holds
///      only the document hash, a certificate ID, the issuer address, and a
///      timestamp. All personal metadata (name, degree, dates, etc.) lives in
///      the PDF and the UI only — never in contract storage. Only the contract
///      owner (the registered issuer) may register diplomas.
contract DiplomaRegistry is Ownable {
    struct Diploma {
        bool exists;
        bytes32 docHash;
        string certificateId;
        address issuer;
        uint256 timestamp;
    }

    /// @notice Maps the SHA-256 file hash of a diploma PDF to its record.
    mapping(bytes32 => Diploma) private _byHash;

    /// @notice Maps a certificate ID to its record for ID/QR lookups.
    mapping(string => Diploma) private _byId;

    /// @notice Emitted when a new diploma is registered.
    event DiplomaRegistered(
        bytes32 indexed docHash,
        string certificateId,
        address indexed issuer,
        uint256 timestamp
    );

    /// @param initialOwner The issuer address that controls registration.
    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Register a diploma by its PDF hash and a unique certificate ID.
    /// @dev Only callable by the owner. Reverts if the docHash OR the
    ///      certificateId has already been used.
    /// @param docHash SHA-256 hash of the diploma PDF (bytes32).
    /// @param certificateId Unique human-readable ID (e.g. "UNIV-2026-AB12CD").
    function registerDiploma(bytes32 docHash, string calldata certificateId)
        external
        onlyOwner
    {
        require(!_byHash[docHash].exists, "DiplomaRegistry: hash already registered");
        require(!_byId[certificateId].exists, "DiplomaRegistry: certificateId already used");

        Diploma memory record = Diploma({
            exists: true,
            docHash: docHash,
            certificateId: certificateId,
            issuer: msg.sender,
            timestamp: block.timestamp
        });

        _byHash[docHash] = record;
        _byId[certificateId] = record;

        emit DiplomaRegistered(docHash, certificateId, msg.sender, block.timestamp);
    }

    /// @notice Look up a diploma by the SHA-256 hash of its PDF bytes.
    /// @param docHash SHA-256 hash of the diploma PDF (bytes32).
    /// @return exists Whether a record exists for this hash.
    /// @return certificateId The certificate ID associated with the record.
    /// @return issuer Address that registered the diploma.
    /// @return timestamp Block timestamp of registration.
    function verifyByHash(bytes32 docHash)
        external
        view
        returns (
            bool exists,
            string memory certificateId,
            address issuer,
            uint256 timestamp
        )
    {
        Diploma storage d = _byHash[docHash];
        return (d.exists, d.certificateId, d.issuer, d.timestamp);
    }

    /// @notice Look up a diploma by its certificate ID.
    /// @param certificateId The certificate ID to look up.
    /// @return exists Whether a record exists for this ID.
    /// @return docHash The registered PDF hash for the record.
    /// @return issuer Address that registered the diploma.
    /// @return timestamp Block timestamp of registration.
    function verifyById(string calldata certificateId)
        external
        view
        returns (
            bool exists,
            bytes32 docHash,
            address issuer,
            uint256 timestamp
        )
    {
        Diploma storage d = _byId[certificateId];
        return (d.exists, d.docHash, d.issuer, d.timestamp);
    }
}
