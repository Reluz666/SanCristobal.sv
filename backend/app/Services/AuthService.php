<?php

declare(strict_types=1);

namespace App\Services;

use App\DTOs\LoginData;
use App\Exceptions\ApiException;
use App\Http\Resources\AuthUserResource;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

final class AuthService
{
    public function __construct(
        private readonly TenantContext $tenantContext,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function login(LoginData $data): array
    {
        $user = $this->findUserByEmail($data->email);

        if (! $user instanceof User || ! Hash::check($data->password, (string) $user->password)) {
            $this->logFailedAttempt($data->email, $user, 'invalid_credentials');

            throw ApiException::make(
                statusCode: 401,
                errorCode: 'invalid_credentials',
                message: 'El correo o la contraseña no son correctos.',
            );
        }

        $company = $user->company()->first();

        if (! $user->isActive()) {
            $this->logFailedAttempt($data->email, $user, 'inactive_user');

            throw ApiException::make(403, 'inactive_user', 'La cuenta de usuario se encuentra inactiva.');
        }

        if (! $company instanceof Company || ! $company->isActive()) {
            $this->logFailedAttempt($data->email, $user, 'inactive_company');

            throw ApiException::make(403, 'inactive_company', 'La empresa asociada no se encuentra activa.');
        }

        $this->activateTenant($user, $company);

        $expiresAt = now()->addMinutes($this->tokenTtlMinutes());
        $token = $user->createToken(
            name: 'auth:'.$company->ruc,
            abilities: ['*'],
            expiresAt: $expiresAt,
        );

        $user->forceFill(['last_login_at' => now()])->save();

        activity('auth')
            ->causedBy($user)
            ->performedOn($user)
            ->withProperties([
                'event' => 'login.success',
                'email' => $user->email,
                'company_uuid' => $company->uuid,
                'token_name' => $token->accessToken->name,
            ])
            ->log('Inicio de sesión exitoso');

        return $this->sessionPayload(
            user: $user,
            company: $company,
            token: $token->plainTextToken,
            expiresAt: $expiresAt,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function me(User $user, Request $request): array
    {
        $company = $user->company()->first();

        if (! $company instanceof Company || ! $company->isActive()) {
            throw ApiException::make(403, 'inactive_company', 'La empresa asociada no se encuentra activa.');
        }

        $this->activateTenant($user, $company);

        $currentToken = $user->currentAccessToken();
        $expiresAt = $currentToken instanceof PersonalAccessToken
            ? $currentToken->expires_at
            : null;

        return $this->sessionPayload(
            user: $user,
            company: $company,
            token: $request->bearerToken(),
            expiresAt: $expiresAt,
        );
    }

    public function logout(User $user, ?Request $request = null): void
    {
        $company = $user->company()->first();

        if ($company instanceof Company) {
            $this->activateTenant($user, $company);
        }

        activity('auth')
            ->causedBy($user)
            ->performedOn($user)
            ->withProperties([
                'event' => 'logout',
                'email' => $user->email,
                'company_uuid' => $company?->uuid,
            ])
            ->log('Cierre de sesión');

        $token = $request?->user()?->currentAccessToken() ?? $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionPayload(
        User $user,
        Company $company,
        ?string $token,
        mixed $expiresAt,
    ): array {
        $user->unsetRelation('roles')->unsetRelation('permissions');

        $roles = $user->getRoleNames()->values()->all();
        $permissions = $user->getAllPermissions()
            ->pluck('name')
            ->unique()
            ->values()
            ->all();

        return [
            'token' => $token,
            'token_type' => 'Bearer',
            'expires_at' => $expiresAt instanceof \DateTimeInterface
                ? $expiresAt->format(DATE_ATOM)
                : null,
            'user' => (new AuthUserResource($user))->resolve(),
            'roles' => $roles,
            'permissions' => $permissions,
            'company' => (new CompanyResource($company))->resolve(),
        ];
    }

    private function findUserByEmail(string $email): ?User
    {
        return User::query()
            ->withoutGlobalScope('company')
            ->with('company')
            ->where('email', Str::lower($email))
            ->orderByDesc('is_active')
            ->first();
    }

    private function activateTenant(User $user, Company $company): void
    {
        $this->tenantContext->set($company);

        setPermissionsTeamId($company->getKey());

        $user->unsetRelation('roles')->unsetRelation('permissions');
    }

    private function logFailedAttempt(string $email, ?User $user, string $reason): void
    {
        activity('auth')
            ->withProperties([
                'event' => 'login.failed',
                'email' => $email,
                'reason' => $reason,
                'user_uuid' => $user?->uuid,
                'company_uuid' => $user?->company?->uuid,
            ])
            ->log('Intento de inicio de sesión fallido');
    }

    private function tokenTtlMinutes(): int
    {
        $configured = (int) config('sanctum.expiration', 720);

        return $configured > 0 ? $configured : 720;
    }
}
