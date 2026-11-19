<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\CashRegisterController;
use App\Http\Controllers\Api\V1\CompanySettingsController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InventorySummaryController;
use App\Http\Controllers\Api\V1\KardexController;
use App\Http\Controllers\Api\V1\PosCatalogController;
use App\Http\Controllers\Api\V1\SaleController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', HealthController::class)
        ->middleware('throttle:api')
        ->name('api.v1.health');

    Route::prefix('auth')->name('api.v1.auth.')->group(function (): void {
        Route::post('/login', [AuthController::class, 'login'])
            ->middleware('throttle:login')
            ->name('login');

        Route::middleware(['auth:sanctum', 'tenant', 'throttle:api'])->group(function (): void {
            Route::get('/me', [AuthController::class, 'me'])->name('me');
            Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
        });
    });

    Route::middleware(['auth:sanctum', 'tenant', 'throttle:api'])->group(function (): void {
        Route::get('/dashboard/summary', DashboardController::class)->name('api.v1.dashboard.summary');
        Route::put('/company/settings', CompanySettingsController::class)->name('api.v1.company.settings.update');

        Route::prefix('pos')->name('api.v1.pos.')->group(function (): void {
            Route::get('/products', [PosCatalogController::class, 'products'])->name('products.index');
            Route::get('/warehouses', [PosCatalogController::class, 'warehouses'])->name('warehouses.index');

            Route::get('/customers', [PosCatalogController::class, 'customers'])->name('customers.index');
            Route::get('/customers/lookup', [PosCatalogController::class, 'lookup'])->name('customers.lookup');
            Route::post('/customers', [PosCatalogController::class, 'store'])->name('customers.store');

            Route::get('/cash-registers', [CashRegisterController::class, 'registers'])->name('cash-registers.index');
            Route::get('/cash-sessions/current', [CashRegisterController::class, 'current'])->name('cash-sessions.current');
            Route::post('/cash-sessions/open', [CashRegisterController::class, 'open'])->name('cash-sessions.open');
            Route::post('/cash-sessions/{session}/close', [CashRegisterController::class, 'close'])->name('cash-sessions.close');

            Route::get('/sales', [SaleController::class, 'index'])->name('sales.index');
            Route::post('/sales', [SaleController::class, 'store'])->name('sales.store');
            Route::get('/sales/{sale}/ticket', [SaleController::class, 'ticket'])->name('sales.ticket');
            Route::get('/sales/{sale}', [SaleController::class, 'show'])->name('sales.show');
            Route::post('/sales/{sale}/void', [SaleController::class, 'void'])->name('sales.void');
        });

        Route::prefix('inventory')->name('api.v1.inventory.')->group(function (): void {
            Route::get('/summary', InventorySummaryController::class)->name('summary');
            Route::get('/kardex', [KardexController::class, 'index'])->name('kardex.index');
            Route::get('/warehouses', [KardexController::class, 'warehouses'])->name('warehouses.index');
        });
    });
});
