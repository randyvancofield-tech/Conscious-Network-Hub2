param(
  [string]$ProjectId = "gen-lang-client-0656716269",
  [string]$Region = "us-central1",
  [string]$Service = "conscious-network-backend",
  [string]$AllowedOrigins = "https://conscious-network.org,http://localhost:5173",
  [string]$FrontendBaseUrl = "https://conscious-network.org",
  [string]$OpenAIApiKey = "",
  [string]$AuthTokenSecret = "",
  [string]$DatabaseUrl = "",
  [string]$SensitiveDataKey = "",
  [string]$UploadObjectKeySecret = "",
  [string]$UploadLegacyObjectKeySecret = "",
  [string]$PublicBaseUrl = "",
  [string]$ServerAllowedHosts = "",
  [string]$TrustProxy = "1",
  [string]$VertexAiModel = "gemini-2.0-flash-001",
  [string]$AdminDiagnosticsKey = "",
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

function Get-ValueFromLocalEnv {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $envLocalPath = Join-Path $PSScriptRoot "..\\.env.local"
  if (-not (Test-Path $envLocalPath)) {
    return ""
  }

  $line = Get-Content $envLocalPath | Where-Object { $_ -match "^\s*$Name=" } | Select-Object -First 1
  if (-not $line) {
    return ""
  }

  return ($line -replace "^\s*$Name=", "").Trim()
}

if (-not $OpenAIApiKey) {
  $OpenAIApiKey = $env:OPENAI_API_KEY
}

if (-not $OpenAIApiKey) {
  $OpenAIApiKey = Get-ValueFromLocalEnv -Name "OPENAI_API_KEY"
}

if (-not $AuthTokenSecret) {
  $AuthTokenSecret = $env:AUTH_TOKEN_SECRET
}

if (-not $AuthTokenSecret) {
  $AuthTokenSecret = Get-ValueFromLocalEnv -Name "AUTH_TOKEN_SECRET"
}

if (-not $AuthTokenSecret) {
  throw "AUTH_TOKEN_SECRET is required. Set -AuthTokenSecret, AUTH_TOKEN_SECRET env var, or server/.env.local."
}

if (-not $DatabaseUrl) {
  $DatabaseUrl = $env:DATABASE_URL
}

if (-not $DatabaseUrl) {
  $DatabaseUrl = Get-ValueFromLocalEnv -Name "DATABASE_URL"
}

if (-not $DatabaseUrl) {
  throw "DATABASE_URL is required. Set -DatabaseUrl, DATABASE_URL env var, or server/.env.local."
}

if (-not $SensitiveDataKey) {
  $SensitiveDataKey = $env:SENSITIVE_DATA_KEY
}

if (-not $SensitiveDataKey) {
  $SensitiveDataKey = Get-ValueFromLocalEnv -Name "SENSITIVE_DATA_KEY"
}

if (-not $SensitiveDataKey) {
  throw "SENSITIVE_DATA_KEY is required for production/shared_db sensitive field protection. Set -SensitiveDataKey, SENSITIVE_DATA_KEY env var, or server/.env.local."
}

if (-not $UploadObjectKeySecret) {
  $UploadObjectKeySecret = $env:UPLOAD_OBJECT_KEY_SECRET
}

if (-not $UploadObjectKeySecret) {
  $UploadObjectKeySecret = Get-ValueFromLocalEnv -Name "UPLOAD_OBJECT_KEY_SECRET"
}

if (-not $UploadObjectKeySecret) {
  throw "UPLOAD_OBJECT_KEY_SECRET is required for production/shared_db upload object keys. Set -UploadObjectKeySecret, UPLOAD_OBJECT_KEY_SECRET env var, or server/.env.local."
}

if (-not $UploadLegacyObjectKeySecret) {
  $UploadLegacyObjectKeySecret = $env:UPLOAD_LEGACY_OBJECT_KEY_SECRET
}

if (-not $UploadLegacyObjectKeySecret) {
  $UploadLegacyObjectKeySecret = Get-ValueFromLocalEnv -Name "UPLOAD_LEGACY_OBJECT_KEY_SECRET"
}

if (-not $AdminDiagnosticsKey) {
  $AdminDiagnosticsKey = $env:ADMIN_DIAGNOSTICS_KEY
}

if (-not $AdminDiagnosticsKey) {
  $AdminDiagnosticsKey = Get-ValueFromLocalEnv -Name "ADMIN_DIAGNOSTICS_KEY"
}

if (-not $FrontendBaseUrl) {
  $FrontendBaseUrl = Get-ValueFromLocalEnv -Name "FRONTEND_BASE_URL"
}

if (-not $FrontendBaseUrl) {
  throw "FRONTEND_BASE_URL is required for email links and Stripe redirects. Set -FrontendBaseUrl, FRONTEND_BASE_URL env var, or server/.env.local."
}

if (-not $PublicBaseUrl) {
  $PublicBaseUrl = $env:PUBLIC_BASE_URL
}

if (-not $PublicBaseUrl) {
  $PublicBaseUrl = Get-ValueFromLocalEnv -Name "PUBLIC_BASE_URL"
}

if (-not $PublicBaseUrl) {
  $PublicBaseUrl = $FrontendBaseUrl
}

if (-not $ServerAllowedHosts) {
  $ServerAllowedHosts = $env:SERVER_ALLOWED_HOSTS
}

if (-not $ServerAllowedHosts) {
  $ServerAllowedHosts = Get-ValueFromLocalEnv -Name "SERVER_ALLOWED_HOSTS"
}

if (-not $TrustProxy) {
  $TrustProxy = $env:TRUST_PROXY
}

if (-not $TrustProxy) {
  $TrustProxy = Get-ValueFromLocalEnv -Name "TRUST_PROXY"
}

if (-not $TrustProxy) {
  throw "TRUST_PROXY is required for production proxy handling. Set -TrustProxy, TRUST_PROXY env var, or server/.env.local."
}

if ($DatabaseUrl -match "^\s*file:") {
  throw "DATABASE_URL points to a local file. Cloud Run requires a shared Postgres URL (postgresql://...) for durable auth/profile persistence."
}

if ($DatabaseUrl -notmatch "^\s*postgres(ql)?://") {
  throw "DATABASE_URL must be a Postgres connection string for Cloud Run (postgresql://... or postgres://...)."
}

if (-not $OpenAIApiKey) {
  Write-Warning "OPENAI_API_KEY not provided. Auth/profile routes will work, but /api/ai routes will return 503 until the key is configured."
}

Write-Host "Deploying $Service from source..."
gcloud run deploy $Service `
  --source . `
  --region $Region `
  --project $ProjectId `
  --allow-unauthenticated | Out-Host

Write-Host "Updating env vars without overwriting unrelated settings..."
$envUpdates = @(
  "CORS_ORIGINS=$AllowedOrigins",
  "AUTH_TOKEN_SECRET=$AuthTokenSecret",
  "DATABASE_URL=$DatabaseUrl",
  "SENSITIVE_DATA_KEY=$SensitiveDataKey",
  "UPLOAD_OBJECT_KEY_SECRET=$UploadObjectKeySecret",
  "GOOGLE_CLOUD_PROJECT=$ProjectId",
  "GOOGLE_CLOUD_REGION=$Region",
  "VERTEX_AI_MODEL=$VertexAiModel",
  "FRONTEND_BASE_URL=$FrontendBaseUrl",
  "PUBLIC_BASE_URL=$PublicBaseUrl",
  "TRUST_PROXY=$TrustProxy",
  "AUTH_PERSISTENCE_BACKEND=shared_db",
  "DATABASE_PROVIDER=postgresql"
)
if ($ServerAllowedHosts) {
  $envUpdates += "SERVER_ALLOWED_HOSTS=$ServerAllowedHosts"
}
if ($UploadLegacyObjectKeySecret) {
  $envUpdates += "UPLOAD_LEGACY_OBJECT_KEY_SECRET=$UploadLegacyObjectKeySecret"
}
if ($OpenAIApiKey) {
  $envUpdates += "OPENAI_API_KEY=$OpenAIApiKey"
}
if ($AdminDiagnosticsKey) {
  $envUpdates += "ADMIN_DIAGNOSTICS_KEY=$AdminDiagnosticsKey"
}

# Pick a delimiter that does not occur in any value (for URLs/secrets containing @, =, etc.).
$delimiters = @('|', '^', '~', '#', ';')
$updateBlob = $envUpdates -join ''
$envDelimiter = $delimiters | Where-Object { $updateBlob -notlike "*$_*" } | Select-Object -First 1
if (-not $envDelimiter) {
  throw "Unable to select a safe delimiter for --update-env-vars payload."
}
$envArg = "^$envDelimiter^" + ($envUpdates -join $envDelimiter)

gcloud run services update $Service `
  --region $Region `
  --project $ProjectId `
  --update-env-vars $envArg `
  --remove-env-vars "/conscious_network?host" | Out-Host

Write-Host "Routing 100% traffic to latest revision..."
gcloud run services update-traffic $Service `
  --region $Region `
  --project $ProjectId `
  --to-latest | Out-Host

$serviceJson = gcloud run services describe $Service --region $Region --project $ProjectId --format json | ConvertFrom-Json
$latest = $serviceJson.status.latestReadyRevisionName
$rawUrls = $serviceJson.metadata.annotations."run.googleapis.com/urls"
$parsedUrls = @()
if ($rawUrls -is [string]) {
  try {
    $parsed = $rawUrls | ConvertFrom-Json
    $parsedUrls = @($parsed)
  } catch {
    $parsedUrls = @($rawUrls)
  }
} elseif ($null -ne $rawUrls) {
  $parsedUrls = @($rawUrls)
}
$url = $parsedUrls | Select-Object -First 1

Write-Host "Latest revision: $latest"
Write-Host "Service URL: $url"

if (-not $SkipChecks) {
  Write-Host "Running post-deploy checks..."
  $checkArgs = @{
    BackendUrl = $url
    Origin = "https://conscious-network.org"
  }
  if ($AdminDiagnosticsKey) {
    $checkArgs["DiagnosticsKey"] = $AdminDiagnosticsKey
    $checkArgs["RequireSharedStore"] = $true
  }
  & (Join-Path $PSScriptRoot "post-deploy-check.ps1") @checkArgs
}
