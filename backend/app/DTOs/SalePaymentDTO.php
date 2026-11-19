<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Enums\PaymentMethod;

final readonly class SalePaymentDTO
{
    public function __construct(
        public PaymentMethod $method,
        public string $amount,
        public ?string $referenceNumber = null,
    ) {}
}
