<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Enums\IdentityDocumentType;

final readonly class CustomerDataDTO
{
    public function __construct(
        public IdentityDocumentType $identityDocumentType,
        public string $documentNumber,
        public string $legalName,
        public ?string $address = null,
        public ?string $ubigeo = null,
        public ?string $email = null,
        public ?string $phone = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            identityDocumentType: IdentityDocumentType::from((string) $data['identity_document_type']),
            documentNumber: trim((string) $data['document_number']),
            legalName: trim((string) $data['legal_name']),
            address: self::nullableString($data['address'] ?? null),
            ubigeo: self::nullableString($data['ubigeo'] ?? null),
            email: self::nullableString($data['email'] ?? null),
            phone: self::nullableString($data['phone'] ?? null),
        );
    }

    private static function nullableString(mixed $value): ?string
    {
        $string = trim((string) ($value ?? ''));

        return $string === '' ? null : $string;
    }
}
