<?php

declare(strict_types=1);

namespace App\Exceptions;

/**
 * Incumplimiento de una regla de negocio detectable en tiempo de ejecucion.
 *
 * Se distingue de ValidationException (errores de formato del FormRequest)
 * para que el contrato JSON conserve el mensaje funcional exacto que la
 * interfaz debe mostrar al cajero.
 */
final class BusinessRuleException extends ApiException
{
    /**
     * @param  array<string, array<int, string>|string>  $messages
     */
    public static function fromMessages(array $messages): self
    {
        $errors = [];
        $first = 'La operación no cumple las reglas de negocio.';

        foreach ($messages as $field => $values) {
            $list = array_values(array_map(
                static fn (mixed $message): string => (string) $message,
                (array) $values,
            ));

            if ($list !== []) {
                $first = $list[0];
            }

            $errors[] = [
                'field' => (string) $field,
                'messages' => $list,
            ];
        }

        return new self(422, 'business_rule', $first, $errors);
    }
}
