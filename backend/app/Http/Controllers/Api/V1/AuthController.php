<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\DTOs\LoginData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use App\Services\AuthService;
use App\Traits\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AuthController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly AuthService $authService,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        return $this->successResponse(
            data: $this->authService->login(LoginData::fromRequest($request)),
            message: 'Sesión iniciada correctamente.',
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $this->authService->logout($this->authenticatedUser($request), $request);

        return $this->successResponse(message: 'Sesión cerrada correctamente.');
    }

    public function me(Request $request): JsonResponse
    {
        return $this->successResponse(
            data: $this->authService->me($this->authenticatedUser($request), $request),
            message: 'Sesión activa.',
        );
    }

    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException('Se requiere autenticación.');
        }

        return $user;
    }
}
