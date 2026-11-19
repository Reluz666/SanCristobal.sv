<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\User;
use App\Services\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Spatie\Activitylog\Actions\LogActivityAction;
use Spatie\Activitylog\Contracts\Activity as ActivityContract;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            TenantContext::class,
            static fn (): TenantContext => new TenantContext,
        );
    }

    public function boot(): void
    {
        Model::shouldBeStrict();
        DB::prohibitDestructiveCommands($this->app->isProduction());

        $this->configurePasswordRules();
        $this->configureRateLimiters();
        $this->configureAuditMetadata();
    }

    private function configurePasswordRules(): void
    {
        Password::defaults(function (): Password {
            $rule = Password::min(12)
                ->letters()
                ->mixedCase()
                ->numbers()
                ->symbols();

            return $this->app->isProduction()
                ? $rule->uncompromised()
                : $rule;
        });
    }

    private function configureRateLimiters(): void
    {
        RateLimiter::for('login', static function (Request $request): Limit {
            $email = Str::lower(Str::squish((string) $request->input('email')));

            return Limit::perMinute(5)->by($email.'|'.$request->ip());
        });

        RateLimiter::for('api', static function (Request $request): Limit {
            $identifier = $request->user()?->getAuthIdentifier() ?? $request->ip();

            return Limit::perMinute(120)->by((string) $identifier);
        });

        RateLimiter::for('sensitive', static function (Request $request): Limit {
            $identifier = $request->user()?->getAuthIdentifier() ?? $request->ip();

            return Limit::perMinute(30)->by((string) $identifier);
        });
    }

    private function configureAuditMetadata(): void
    {
        LogActivityAction::clearBeforeLoggingCallbacks();

        LogActivityAction::beforeLogging(static function (ActivityContract $activity): void {
            if (! $activity instanceof Model) {
                return;
            }

            $tenantId = app(TenantContext::class)->companyId();

            if ($tenantId === null && Auth::hasUser()) {
                $user = Auth::user();

                if ($user instanceof User && $user->getAttribute('company_id') !== null) {
                    $tenantId = (int) $user->getAttribute('company_id');
                }
            }

            if ($tenantId !== null && $activity->getAttribute('company_id') === null) {
                $activity->setAttribute('company_id', $tenantId);
            }

            if (! app()->bound('request')) {
                return;
            }

            $request = request();

            if ($activity->getAttribute('ip_address') === null) {
                $activity->setAttribute('ip_address', (string) $request->ip());
            }

            if ($activity->getAttribute('user_agent') === null) {
                $activity->setAttribute('user_agent', (string) $request->userAgent());
            }

            $traceId = $request->attributes->get('trace_id');

            if ($activity->getAttribute('trace_id') === null && is_string($traceId) && $traceId !== '') {
                $activity->setAttribute('trace_id', $traceId);
            }
        });

        if ($this->app->isProduction()) {
            Log::shareContext([
                'environment' => $this->app->environment(),
            ]);
        }
    }
}
