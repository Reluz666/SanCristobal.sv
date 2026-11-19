<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Sale;
use Illuminate\Pagination\LengthAwarePaginator;

final class SaleQueryService
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $perPage = max(1, min(100, (int) ($filters['per_page'] ?? 20)));
        $search = str_replace(['%', '_'], '', trim((string) ($filters['search'] ?? '')));

        return Sale::query()
            ->with(['customer', 'user', 'warehouse'])
            ->when(
                isset($filters['date_from']) && $filters['date_from'] !== null,
                static fn ($query) => $query->whereDate('issue_date', '>=', $filters['date_from']),
            )
            ->when(
                isset($filters['date_to']) && $filters['date_to'] !== null,
                static fn ($query) => $query->whereDate('issue_date', '<=', $filters['date_to']),
            )
            ->when(
                isset($filters['series']) && $filters['series'] !== null,
                static fn ($query) => $query->where('series', $filters['series']),
            )
            ->when(
                isset($filters['document_type']) && $filters['document_type'] !== null,
                static fn ($query) => $query->where('document_type', $filters['document_type']),
            )
            ->when(
                isset($filters['sunat_status']) && $filters['sunat_status'] !== null,
                static fn ($query) => $query->where('sunat_status', $filters['sunat_status']),
            )
            ->when($search !== '', static function ($query) use ($search): void {
                $term = '%'.$search.'%';

                $query->where(static function ($nested) use ($term, $search): void {
                    $nested->where('series', 'like', $term)
                        ->orWhereRaw('CAST(correlative AS TEXT) LIKE ?', ['%'.$search.'%'])
                        ->orWhereHas('customer', static function ($customer) use ($term): void {
                            $customer->where('document_number', 'like', $term)
                                ->orWhere('legal_name', 'like', $term);
                        });
                });
            })
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->paginate($perPage);
    }
}
