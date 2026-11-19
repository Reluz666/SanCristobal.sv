<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DocumentType;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentSeries extends Model
{
    use BelongsToCompany;
    use HasUuid;

    protected $table = 'document_series';

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'document_type',
        'series',
        'current_correlative',
        'is_active',
    ];

    protected $hidden = [
        'id',
        'company_id',
        'warehouse_id',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'document_type' => DocumentType::class,
            'current_correlative' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }
}
