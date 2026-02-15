param(
  [string]$ProjectId = "gen-lang-client-0656716269",
  [string]$Region = "us-central1",
  [string]$Service = "conscious-network-backend",
  [string]$AllowedOrigins = "https://conscious-network.org,http://localhost:5173",
  [string]$OpenAIApiKey = "",
  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

function Get-ApiKeyFromLocalEnv {
  $envLocalPath = Join-Path $PSScriptRoot "..\\.env.local"
  if (-not (Test-Path $envLocalPath)) {
    return ""
  }

  $line = Get-Content $envLocalPath | Where-Object { $_ -match "^\s*OPENAI_API_KEY=" } | Select-Object -First 1
  if (-not $line) {
    return ""
  }

  return ($line -replace "^\s*OPENAI_API_KEY=", "").Trim()
}

if (-not $OpenAIApiKey) {
  $OpenAIApiKey = $env:OPENAI_API_KEY
}

if (-not $OpenAIApiKey) {
  $OpenAIApiKey = Get-ApiKeyFromLocalEnv
}

if (-not $OpenAIApiKey) {
  throw "OPENAI_API_KEY is required. Set -OpenAIApiKey, OPENAI_API_KEY env var, or server/.env.local."
}

Write-Host "Deploying $Service from source..."
gcloud run deploy $Service `
  --source . `
  --region $Region `
  --project $ProjectId `
  --allow-unauthenticated | Out-Host

Write-Host "Updating env vars without overwriting unrelated settings..."
$envArg = "^@^CORS_ORIGINS=$AllowedOrigins@OPENAI_API_KEY=$OpenAIApiKey"
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
