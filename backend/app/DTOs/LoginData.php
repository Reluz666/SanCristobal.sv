<?php

declare(strict_types=1);

namespace App\DTOs;

use App\Http\Requests\Auth\LoginRequest;

/**
 * Credenciales normalizadas para el caso de uso de inicio de sesión.
 */
final readonly class LoginData
{
    public function __construct(
        public string $email,
        public string $password,
    ) {}

    public static function fromRequest(LoginRequest $request): self
    {
        return new self(
            email: (string) $request->validated('email'),
            password: (string) $request->validated('password'),
        );
    }
}
