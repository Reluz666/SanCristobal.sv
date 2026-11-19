<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DocumentType;
use App\Enums\SunatStatus;
use App\Traits\AuditableModel;
use App\Traits\BelongsToCompany;
use App\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sale extends Model
{
    use AuditableModel;
    use BelongsToCompany;
    use HasUuid;

    protected $fillable = [
        'company_id',
        'warehouse_id',
        'cash_register_session_id',
        'customer_id',
        'user_id',
        'document_type',
        'series',
        'correlative',
        'issue_date',
        'currency',
        'exchange_rate',
        'total_taxed',
        'total_exonerated',
        'total_unaffected',
        'total_igv',
        'total_discount',
        'total_amount',
        'sunat_status',
        'sunat_hash',
        'sunat_xml_path',
        'sunat_cdr_path',
        'sunat_code',
        'sunat_description',
        'sunat_response',
    ];

    protected $hidden = [
        'id',
        'company_id',
        'warehouse_id',
        'cash_register_session_id',
        'customer_id',
        'user_id',
        'sunat_xml_path',
        'sunat_cdr_path',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'document_type' => DocumentType::class,
            'sunat_status' => SunatStatus::class,
            'correlative' => 'integer',
            'issue_date' => 'datetime',
            'exchange_rate' => 'decimal:4',
            'total_taxed' => 'decimal:2',
            'total_exonerated' => 'decimal:2',
            'total_unaffected' => 'decimal:2',
            'total_igv' => 'decimal:2',
            'total_discount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'sunat_response' => 'array',
        ];
    }

    public function number(): string
    {
        return sprintf('%s-%08d', $this->series, $this->correlative);
    }

    /**
     * @return BelongsTo<Warehouse, $this>
     */
    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<CashRegisterSession, $this>
     */
    public function cashRegisterSession(): BelongsTo
    {
        return $this->belongsTo(CashRegisterSession::class);
    }

    /**
     * @return HasMany<SaleItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(SaleItem::class);
    }

    /**
     * @return HasMany<SalePayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(SalePayment::class);
    }
}
