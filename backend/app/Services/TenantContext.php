<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Company;

/**
 * Contexto de empresa activo para la petición, job o comando en ejecución.
 * Se registra como singleton y debe establecerse explicitamente fuera del
 * ciclo HTTP autenticado.
 */
final class TenantContext
{
    private ?Company $company = null;

    public function set(Company $company): void
    {
        $this->company = $company;
    }

    public function company(): ?Company
    {
        return $this->company;
    }

    public function companyId(): ?int
    {
        if ($this->company === null) {
            return null;
        }

        return (int) $this->company->getKey();
    }

    public function clear(): void
    {
        $this->company = null;
    }

    public function hasCompany(): bool
    {
        return $this->company !== null;
    }
}
