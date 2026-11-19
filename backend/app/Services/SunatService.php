<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\DocumentType;
use App\Enums\SunatStatus;
use App\Models\Company;
use App\Models\Customer;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Support\AmountInWords;
use App\Support\Money;
use DateTimeInterface;
use DOMDocument;
use DOMXPath;
use Greenter\Model\Client\Client;
use Greenter\Model\Company\Address;
use Greenter\Model\Company\Company as GreenterCompany;
use Greenter\Model\Response\BillResult;
use Greenter\Model\Sale\FormaPagos\FormaPagoContado;
use Greenter\Model\Sale\Invoice;
use Greenter\Model\Sale\Legend;
use Greenter\Model\Sale\SaleDetail;
use Greenter\See;
use Greenter\Ws\Services\SunatEndpoints;
use Greenter\XMLSecLibs\XMLSecurityDSig;
use Greenter\XMLSecLibs\XMLSecurityKey;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;
use ZipArchive;

/**
 * Emision electronica UBL 2.1 con Greenter.
 *
 * El XML siempre se genera y se firma con SHA-256. El envio a SUNAT se
 * controla con SUNAT_MODE:
 * - simulate: no sale a la red; produce un CDR de demostracion.
 * - auto: intenta SUNAT y cae a simulacion solo si falla la conexion.
 * - live: exige respuesta real de SUNAT.
 *
 * Ningun secreto SOL ni el certificado se registra en logs o respuestas.
 */
final class SunatService
{
    private const TIMEOUT_SECONDS = 8;

    public function processSale(Sale $sale): Sale
    {
        if ($sale->document_type === DocumentType::InternalSaleNote) {
            $sale->forceFill([
                'sunat_status' => SunatStatus::Internal,
                'sunat_description' => 'Nota de venta interna: no requiere envio a SUNAT.',
            ])->save();

            return $sale->refresh();
        }

        if (in_array($sale->sunat_status, [SunatStatus::Accepted, SunatStatus::Observed], true)) {
            return $sale;
        }

        $company = Company::query()->whereKey($sale->getAttribute('company_id'))->first();

        if (! $company instanceof Company) {
            return $this->markPending($sale, 'No se encontró la empresa emisora.');
        }

        $sale->loadMissing(['items.product', 'customer', 'payments', 'warehouse']);

        if (! $sale->customer instanceof Customer) {
            return $this->markPending($sale, 'El comprobante no tiene cliente asociado.');
        }

        $mode = $this->mode();

        try {
            $invoice = $this->buildInvoice($sale, $company);
            $see = $this->makeSee($company);
            $xml = $see->getXmlSigned($invoice);

            if (! is_string($xml) || $xml === '') {
                return $this->markPending($sale, 'Greenter no generó el XML firmado.');
            }

            $hash = $this->extractDigest($xml);
            $paths = $this->storeXml($sale, $company, $xml);

            if ($mode === 'simulate') {
                return $this->applyResult(
                    sale: $sale,
                    status: SunatStatus::Accepted,
                    code: '0',
                    description: 'El comprobante ha sido aceptado en modo simulación local.',
                    hash: $hash,
                    xmlPath: $paths['xml'],
                    cdrPath: $this->storeSimulatedCdr($sale, $company, $hash),
                    response: ['mode' => 'simulate', 'simulated' => true],
                );
            }

            try {
                $result = $see->send($invoice);
            } catch (Throwable $exception) {
                if ($mode === 'auto') {
                    Log::warning('SUNAT no disponible; se aplica simulacion local controlada.', [
                        'sale_uuid' => $sale->uuid,
                        'exception' => $exception::class,
                    ]);

                    return $this->applyResult(
                        sale: $sale,
                        status: SunatStatus::Accepted,
                        code: '0',
                        description: 'Aceptado en simulación local: SUNAT no estuvo disponible.',
                        hash: $hash,
                        xmlPath: $paths['xml'],
                        cdrPath: $this->storeSimulatedCdr($sale, $company, $hash),
                        response: ['mode' => 'auto', 'simulated' => true],
                    );
                }

                return $this->markPending($sale, 'No se pudo conectar con SUNAT: '.$exception->getMessage(), $hash, $paths['xml']);
            }

            if (! $result instanceof BillResult) {
                return $this->markPending($sale, 'SUNAT no devolvió una respuesta válida.', $hash, $paths['xml']);
            }

            if ($result->isSuccess() !== true) {
                $error = $result->getError();

                return $this->applyResult(
                    sale: $sale,
                    status: SunatStatus::Rejected,
                    code: mb_substr((string) ($error?->getCode() ?? 'ERROR'), 0, 10),
                    description: mb_substr((string) ($error?->getMessage() ?? 'Rechazado por SUNAT.'), 0, 500),
                    hash: $hash,
                    xmlPath: $paths['xml'],
                    cdrPath: null,
                    response: ['mode' => 'live', 'simulated' => false],
                );
            }

            $cdr = $result->getCdrResponse();
            $code = (string) ($cdr?->getCode() ?? '0');
            $notes = $cdr?->getNotes() ?? [];
            $observed = $notes !== [] || (is_numeric($code) && (int) $code >= 4000);
            $cdrPath = $this->storeCdr($sale, $company, $result->getCdrZip());

            return $this->applyResult(
                sale: $sale,
                status: $observed ? SunatStatus::Observed : SunatStatus::Accepted,
                code: mb_substr($code, 0, 10),
                description: mb_substr((string) ($cdr?->getDescription() ?? 'Aceptado por SUNAT.'), 0, 500),
                hash: $hash,
                xmlPath: $paths['xml'],
                cdrPath: $cdrPath,
                response: [
                    'mode' => 'live',
                    'simulated' => false,
                    'notes' => array_values($notes),
                ],
            );
        } catch (Throwable $exception) {
            Log::error('Error al generar el comprobante electronico.', [
                'sale_uuid' => $sale->uuid,
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return $this->markPending($sale, 'No se pudo generar el comprobante: '.$exception->getMessage());
        }
    }

    public function mode(): string
    {
        $mode = (string) config('sunat.mode', 'simulate');

        return in_array($mode, ['simulate', 'auto', 'live'], true) ? $mode : 'simulate';
    }

    private function buildInvoice(Sale $sale, Company $company): Invoice
    {
        $invoice = (new Invoice)
            ->setUblVersion('2.1')
            ->setTipoOperacion('0101')
            ->setTipoDoc($sale->document_type->value)
            ->setSerie($sale->series)
            ->setCorrelativo(str_pad((string) $sale->correlative, 8, '0', STR_PAD_LEFT))
            ->setFechaEmision($sale->issue_date)
            ->setTipoMoneda($sale->currency)
            ->setCompany($this->greenterCompany($company))
            ->setClient($this->greenterClient($sale->customer))
            ->setFormaPago(new FormaPagoContado)
            ->setMtoOperGravadas((float) $sale->total_taxed)
            ->setMtoOperExoneradas((float) $sale->total_exonerated)
            ->setMtoOperInafectas((float) $sale->total_unaffected)
            ->setMtoIGV((float) $sale->total_igv)
            ->setTotalImpuestos((float) $sale->total_igv)
            ->setValorVenta((float) Money::add(
                Money::add((string) $sale->total_taxed, (string) $sale->total_exonerated, 2),
                (string) $sale->total_unaffected,
                2,
            ))
            ->setSubTotal((float) $sale->total_amount)
            ->setMtoImpVenta((float) $sale->total_amount)
            ->setDetails($this->details($sale))
            ->setLegends([
                (new Legend)
                    ->setCode('1000')
                    ->setValue(AmountInWords::currency((string) $sale->total_amount, $sale->currency)),
            ]);

        return $invoice;
    }

    /**
     * @return list<SaleDetail>
     */
    private function details(Sale $sale): array
    {
        $details = [];

        foreach ($sale->items as $item) {
            $details[] = $this->detail($item);
        }

        return $details;
    }

    private function detail(SaleItem $item): SaleDetail
    {
        $taxed = $item->tax_affectation_type->isTaxed();
        $unitValue = Money::div((string) $item->subtotal, (string) $item->quantity, 10);

        return (new SaleDetail)
            ->setUnidad($item->unit_code)
            ->setCantidad((float) $item->quantity)
            ->setDescripcion($item->description)
            ->setCodProducto((string) ($item->product?->sku ?? 'SIN-CODIGO'))
            ->setMtoValorUnitario((float) $unitValue)
            ->setMtoPrecioUnitario((float) $item->unit_price)
            ->setMtoValorVenta((float) $item->subtotal)
            ->setMtoBaseIgv($taxed ? (float) $item->subtotal : 0.0)
            ->setPorcentajeIgv($taxed ? 18.0 : 0.0)
            ->setIgv($taxed ? (float) $item->total_igv : 0.0)
            ->setTipAfeIgv($item->tax_affectation_type->value)
            ->setTotalImpuestos((float) $item->total_igv);
    }

    private function greenterCompany(Company $company): GreenterCompany
    {
        $settings = $company->settings;
        $sunat = is_array($settings['sunat'] ?? null) ? $settings['sunat'] : [];
        $ubigeo = $company->ubigeo ?? (string) ($sunat['ubigeo'] ?? '150101');

        $address = (new Address)
            ->setUbigueo($ubigeo)
            ->setDepartamento((string) ($sunat['departamento'] ?? 'LIMA'))
            ->setProvincia((string) ($sunat['provincia'] ?? 'LIMA'))
            ->setDistrito((string) ($sunat['distrito'] ?? 'LIMA'))
            ->setDireccion((string) ($company->address ?? '-'));

        return (new GreenterCompany)
            ->setRuc($company->ruc)
            ->setRazonSocial($company->legal_name)
            ->setNombreComercial($company->trade_name)
            ->setAddress($address)
            ->setEmail($company->email)
            ->setTelephone($company->phone);
    }

    private function greenterClient(Customer $customer): Client
    {
        $client = (new Client)
            ->setTipoDoc($customer->identity_document_type->value)
            ->setNumDoc($customer->document_number)
            ->setRznSocial($customer->legal_name)
            ->setEmail($customer->email)
            ->setTelephone($customer->phone);

        if ($customer->address !== null || $customer->ubigeo !== null) {
            $client->setAddress(
                (new Address)
                    ->setUbigueo($customer->ubigeo ?? '150101')
                    ->setDireccion($customer->address ?? '-'),
            );
        }

        return $client;
    }

    private function makeSee(Company $company): See
    {
        $settings = $company->settings;
        $sunat = is_array($settings['sunat'] ?? null) ? $settings['sunat'] : [];

        $see = new See;
        $see->setCertificate($this->certificatePem($sunat));
        $see->setClaveSOL(
            (string) ($sunat['sol_ruc'] ?? config('sunat.sol_ruc')),
            (string) ($sunat['sol_user'] ?? config('sunat.sol_user')),
            (string) ($sunat['sol_password'] ?? config('sunat.sol_password')),
        );
        $see->setService(
            (string) ($sunat['environment'] ?? config('sunat.environment')) === 'production'
                ? SunatEndpoints::FE_PRODUCCION
                : SunatEndpoints::FE_BETA,
        );

        $signer = $see->getFactory()->getSigner();

        if ($signer !== null) {
            $signer->setSignatureAlgorithm(XMLSecurityKey::RSA_SHA256);
            $signer->setDigestAlgorithm(XMLSecurityDSig::SHA256);
        }

        return $see;
    }

    /**
     * @param  array<string, mixed>  $sunat
     */
    private function certificatePem(array $sunat): string
    {
        $configured = (string) ($sunat['certificate_path'] ?? config('sunat.certificate_path'));
        $candidates = [];

        if ($configured !== '') {
            $candidates[] = str_starts_with($configured, DIRECTORY_SEPARATOR)
                ? $configured
                : storage_path('app/'.$configured);
            $candidates[] = storage_path('app/private/'.$configured);
        }

        $candidates[] = storage_path('app/sunat/demo-cert.pem');

        foreach ($candidates as $path) {
            if (is_file($path)) {
                $pem = file_get_contents($path);

                if (is_string($pem) && str_contains($pem, 'BEGIN')) {
                    return $pem;
                }
            }
        }

        throw new RuntimeException('No se encontró el certificado digital configurado.');
    }

    private function extractDigest(string $xml): ?string
    {
        $document = new DOMDocument;
        $document->loadXML($xml);

        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('ds', 'http://www.w3.org/2000/09/xmldsig#');

        $nodes = $xpath->query('//ds:DigestValue');
        $node = $nodes === false ? null : $nodes->item(0);
        $value = $node?->nodeValue;

        return is_string($value) && $value !== '' ? $value : null;
    }

    /**
     * @return array{xml: string}
     */
    private function storeXml(Sale $sale, Company $company, string $xml): array
    {
        $path = $this->basePath($sale, $company).'.xml';
        Storage::disk('local')->put($path, $xml);

        return ['xml' => $path];
    }

    private function storeCdr(Sale $sale, Company $company, ?string $cdrZip): ?string
    {
        if (! is_string($cdrZip) || $cdrZip === '') {
            return null;
        }

        $path = $this->basePath($sale, $company).'.zip';
        Storage::disk('local')->put($path, $cdrZip);

        return $path;
    }

    private function storeSimulatedCdr(Sale $sale, Company $company, ?string $hash): string
    {
        $name = 'R-'.basename($this->basePath($sale, $company)).'.xml';
        $cdrXml = sprintf(
            '<?xml version="1.0" encoding="utf-8"?>'
            .'<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2">'
            .'<ID>%s</ID><ResponseCode>0</ResponseCode><Description>El comprobante ha sido aceptado</Description>'
            .'<Note>modo simulacion local</Note><DigestValue>%s</DigestValue></ApplicationResponse>',
            htmlspecialchars($sale->number(), ENT_XML1),
            htmlspecialchars((string) $hash, ENT_XML1),
        );

        $temporary = tempnam(sys_get_temp_dir(), 'cdr_');

        if ($temporary === false) {
            throw new RuntimeException('No se pudo crear el CDR temporal.');
        }

        $zip = new ZipArchive;
        $opened = $zip->open($temporary, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        if ($opened !== true) {
            @unlink($temporary);

            throw new RuntimeException('No se pudo comprimir el CDR.');
        }

        $zip->addFromString($name, $cdrXml);
        $zip->close();

        $content = file_get_contents($temporary);
        @unlink($temporary);

        if (! is_string($content)) {
            throw new RuntimeException('No se pudo leer el CDR generado.');
        }

        $path = $this->basePath($sale, $company).'.zip';
        Storage::disk('local')->put($path, $content);

        return $path;
    }

    private function basePath(Sale $sale, Company $company): string
    {
        $date = $sale->issue_date;
        $year = $date instanceof DateTimeInterface ? $date->format('Y') : now()->format('Y');
        $month = $date instanceof DateTimeInterface ? $date->format('m') : now()->format('m');

        return sprintf(
            'sunat/%s/%s/%s/%s-%s-%s-%08d',
            $company->uuid,
            $year,
            $month,
            $company->ruc,
            $sale->document_type->value,
            $sale->series,
            $sale->correlative,
        );
    }

    /**
     * @param  array<string, mixed>  $response
     */
    private function applyResult(
        Sale $sale,
        SunatStatus $status,
        string $code,
        string $description,
        ?string $hash,
        string $xmlPath,
        ?string $cdrPath,
        array $response,
    ): Sale {
        $sale->forceFill([
            'sunat_status' => $status,
            'sunat_hash' => $hash,
            'sunat_code' => $code,
            'sunat_description' => $description,
            'sunat_xml_path' => $xmlPath,
            'sunat_cdr_path' => $cdrPath,
            'sunat_response' => [
                ...$response,
                'code' => $code,
                'description' => $description,
                'processed_at' => now()->toIso8601String(),
            ],
        ])->save();

        return $sale->refresh();
    }

    private function markPending(Sale $sale, string $reason, ?string $hash = null, ?string $xmlPath = null): Sale
    {
        $sale->forceFill([
            'sunat_status' => SunatStatus::Pending,
            'sunat_hash' => $hash ?? $sale->sunat_hash,
            'sunat_code' => null,
            'sunat_description' => mb_substr($reason, 0, 500),
            'sunat_xml_path' => $xmlPath ?? $sale->sunat_xml_path,
        ])->save();

        return $sale->refresh();
    }
}
