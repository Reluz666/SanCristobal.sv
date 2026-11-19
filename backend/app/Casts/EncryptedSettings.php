<?php

declare(strict_types=1);

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

/**
 * Cifra de forma selectiva las claves sensibles almacenadas en el JSONB de
 * companies.settings. Las claves no sensibles (branding, zona horaria, etc.)
 * permanecen consultables en texto plano.
 *
 * @implements CastsAttributes<array<string, mixed>, array<string, mixed>>
 */
final class EncryptedSettings implements CastsAttributes
{
    private const SENSITIVE_KEYS = [
        'sol_user',
        'sol_password',
        'client_id',
        'client_secret',
        'certificate_password',
        'private_key',
        'pfx',
        'pfx_base64',
        'pem',
        'api_token',
        'webhook_secret',
        'access_token',
        'refresh_token',
    ];

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            $settings = $value;
        } elseif (is_string($value)) {
            $decoded = json_decode($value, true);

            if (! is_array($decoded)) {
                Log::error('El JSON de configuración de empresa es inválido.', [
                    'company_uuid' => $attributes['uuid'] ?? null,
                ]);

                return [];
            }

            $settings = $decoded;
        } else {
            return [];
        }

        return $this->transformRecursive($settings, decrypt: true);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        if (! is_array($value)) {
            throw new InvalidArgumentException('La configuración de la empresa debe ser un arreglo.');
        }

        $settings = $this->transformRecursive($value, decrypt: false);

        return (string) json_encode(
            $settings,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function transformRecursive(array $data, bool $decrypt): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $result[$key] = $this->transformRecursive($value, $decrypt);

                continue;
            }

            if (! is_string($key) || ! $this->isSensitive($key) || ! is_string($value) || $value === '') {
                $result[$key] = $value;

                continue;
            }

            if ($decrypt) {
                try {
                    $result[$key] = Crypt::decryptString($value);
                } catch (Throwable) {
                    // Se conserva el valor cifrado para no perder el secreto
                    // cuando rota APP_KEY. Un administrador debe reingresarlo.
                    Log::warning('No se pudo descifrar una clave sensible de la empresa.', [
                        'setting_key' => $key,
                    ]);

                    $result[$key] = $value;
                }

                continue;
            }

            $result[$key] = Crypt::encryptString($value);
        }

        return $result;
    }

    private function isSensitive(string $key): bool
    {
        $normalized = Str::lower($key);

        return in_array($normalized, self::SENSITIVE_KEYS, true)
            || Str::endsWith($normalized, ['_password', '_secret', '_token', '_private_key']);
    }
}
