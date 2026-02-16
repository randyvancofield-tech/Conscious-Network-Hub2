param(
  [string]$ProjectId = "gen-lang-client-0656716269",
  [string]$Region = "us-central1",
  [string]$Service = "conscious-network-backend",
  [string]$AllowedOrigins = "https://conscious-network.org,http://localhost:5173",
  [string]$OpenAIApiKey = "",
  [string]$AuthTokenSecret = "",
  [string]$DatabaseUrl = "",
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

if (-not $OpenAIApiKey) {
  throw "OPENAI_API_KEY is required. Set -OpenAIApiKey, OPENAI_API_KEY env var, or server/.env.local."
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

Write-Host "Deploying $Service from source..."
gcloud run deploy $Service `
  --source . `
  --region $Region `
  --project $ProjectId `
  --allow-unauthenticated | Out-Host

Write-Host "Updating env vars without overwriting unrelated settings..."
$envArg = "^@^CORS_ORIGINS=$AllowedOrigins@OPENAI_API_KEY=$OpenAIApiKey@AUTH_TOKEN_SECRET=$AuthTokenSecret@DATABASE_URL=$DatabaseUrl"
gcloud run services update $Service `
  --region $Region `
  --project $ProjectId `
  --update-env-vars $envArg | Out-Host

Write-Host "Routing 100% traffic to latest revision..."
gcloud run services update-traffic $Service `
  --region $Region `
  --project $ProjectId `
  --to-latest | Out-Host

$serviceJson = gcloud run services describe $Service --region $Region --project $ProjectId --format json | ConvertFrom-Json
$latest = $serviceJson.status.latestReadyRevisionName
$url = $serviceJson.metadata.annotations."run.googleapis.com/urls" | ConvertFrom-Json | Select-Object -First 1

Write-Host "Latest revision: $latest"
Write-Host "Service URL: $url"

if (-not $SkipChecks) {
  Write-Host "Running post-deploy checks..."
  & (Join-Path $PSScriptRoot "post-deploy-check.ps1") `
    -BackendUrl $url `
    -Origin "https://conscious-network.org"
}
