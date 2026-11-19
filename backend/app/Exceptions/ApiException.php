<?php

declare(strict_types=1);

namespace App\Exceptions;

use Exception;
use Throwable;

/**
 * Excepción de dominio con status HTTP y errores estructurados. El render
 * global la transforma al contrato estandar sin exponer detalles internos.
 */
class ApiException extends Exception
{
    /**
     * @param  array<string, mixed>|null  $errors
     */
    public function __construct(
        private readonly int $statusCode,
        private readonly string $errorCode,
        string $message,
        private readonly ?array $errors = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    /**
     * @param  array<string, mixed>|null  $errors
     */
    public static function make(
        int $statusCode,
        string $errorCode,
        string $message,
        ?array $errors = null,
    ): self {
        return new self($statusCode, $errorCode, $message, $errors);
    }

    public static function notFound(string $message = 'El recurso solicitado no existe.'): self
    {
        return new self(404, 'not_found', $message);
    }

    public static function forbidden(string $message = 'No tiene permisos para realizar esta acción.'): self
    {
        return new self(403, 'forbidden', $message);
    }

    public static function conflict(string $message = 'La operación entra en conflicto con el estado actual.'): self
    {
        return new self(409, 'conflict', $message);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function errors(): ?array
    {
        return $this->errors;
    }
}
