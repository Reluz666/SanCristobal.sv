<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\IdentityDocumentType;

/**
 * Simulador local de padron RENIEC / SUNAT para el flujo de caja.
 *
 * No reemplaza una consulta real: solo devuelve datos de demostracion
 * marcados con is_demo=true para que la interfaz lo advierta. Cualquier
 * documento fuera del directorio retorna null y obliga a digitarlo a mano.
 */
final class IdentityDirectory
{
    /**
     * @var array<string, array{type: IdentityDocumentType, name: string, address: string|null}>
     */
    private const DIRECTORY = [
        '12345678' => [
            'type' => IdentityDocumentType::Dni,
            'name' => 'JUAN CARLOS PEREZ GARCIA',
            'address' => 'Av. Los Proceres 245, Lima',
        ],
        '87654321' => [
            'type' => IdentityDocumentType::Dni,
            'name' => 'MARIA ELENA QUISPE ROJAS',
            'address' => 'Jr. Amazonas 812, Lima',
        ],
        '45678912' => [
            'type' => IdentityDocumentType::Dni,
            'name' => 'LUIS ALBERTO MENDOZA SOTO',
            'address' => 'Calle Las Begonias 190, San Isidro',
        ],
        '20123456789' => [
            'type' => IdentityDocumentType::Ruc,
            'name' => 'DISTRIBUIDORA LIMA NORTE S.A.C.',
            'address' => 'Av. Alfredo Mendiola 3520, Los Olivos, Lima',
        ],
        '20600000001' => [
            'type' => IdentityDocumentType::Ruc,
            'name' => 'SERVICIOS INTEGRALES DEL SUR E.I.R.L.',
            'address' => 'Av. La Marina 2355, San Miguel, Lima',
        ],
    ];

    /**
     * @return array{identity_document_type: string, document_number: string, legal_name: string, address: string|null, is_demo: true}|null
     */
    public static function lookup(string $documentNumber): ?array
    {
        $normalized = preg_replace('/\D+/', '', $documentNumber) ?? '';

        if ($normalized === '' || ! isset(self::DIRECTORY[$normalized])) {
            return null;
        }

        $record = self::DIRECTORY[$normalized];

        return [
            'identity_document_type' => $record['type']->value,
            'document_number' => $normalized,
            'legal_name' => $record['name'],
            'address' => $record['address'],
            'is_demo' => true,
        ];
    }
}
