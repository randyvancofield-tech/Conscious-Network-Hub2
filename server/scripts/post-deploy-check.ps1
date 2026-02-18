param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,
  [string]$Origin = "https://conscious-network.org",
  [string]$ProbeMessage = "Post-deploy smoke test",
  [string]$DiagnosticsKey = "",
  [switch]$RequireSharedStore
)

$ErrorActionPreference = "Stop"

$trimmedBackend = $BackendUrl.TrimEnd("/")

function Invoke-HttpJson {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    [string]$Body = ""
  )

  try {
    if ($Body) {
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -Body $Body -TimeoutSec 60
    } else {
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -TimeoutSec 60
    }

    [pscustomobject]@{
      StatusCode = [int]$resp.StatusCode
      Headers = $resp.Headers
      Body = $resp.Content
    }
  } catch {
    $httpResp = $_.Exception.Response
    if (-not $httpResp) {
      throw
    }

    $content = ""
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      $content = [string]$_.ErrorDetails.Message
    }

    if (-not $content) {
      $reader = New-Object System.IO.StreamReader($httpResp.GetResponseStream())
      $content = $reader.ReadToEnd()
    }

    [pscustomobject]@{
      StatusCode = [int]$httpResp.StatusCode
      Headers = $httpResp.Headers
      Body = $content
    }
  }
}

$healthHeaders = @{ Origin = $Origin }
$health = Invoke-HttpJson -Method "GET" -Url "$trimmedBackend/health" -Headers $healthHeaders

if ($health.StatusCode -ne 200) {
  throw "Health check failed with status $($health.StatusCode): $($health.Body)"
}

if ($health.Headers["access-control-allow-origin"] -ne $Origin) {
  throw "Health CORS header mismatch. Expected '$Origin', got '$($health.Headers["access-control-allow-origin"])'"
}

$chatHeaders = @{
  Origin = $Origin
  "Content-Type" = "application/json"
}
$chatBody = "{""message"":""$ProbeMessage""}"
$chat = Invoke-HttpJson -Method "POST" -Url "$trimmedBackend/api/ai/chat" -Headers $chatHeaders -Body $chatBody

if ($chat.StatusCode -ne 401) {
  throw "AI chat auth check failed. Expected 401 for unauthenticated request, got $($chat.StatusCode): $($chat.Body)"
}

$chatJson = $null
try {
  $chatJson = $chat.Body | ConvertFrom-Json
} catch {
  throw "AI chat response is not JSON: $($chat.Body)"
}

if (-not $chatJson.error) {
  throw "AI chat auth response missing expected error field: $($chat.Body)"
}

$tiers = Invoke-HttpJson -Method "GET" -Url "$trimmedBackend/api/membership/tiers" -Headers $healthHeaders
if ($tiers.StatusCode -ne 200) {
  throw "Membership tiers check failed with status $($tiers.StatusCode): $($tiers.Body)"
}

$userHeaders = @{
  Origin = $Origin
  "Content-Type" = "application/json"
}

$create = Invoke-HttpJson -Method "POST" -Url "$trimmedBackend/api/user/create" -Headers $userHeaders -Body "{}"
if ($create.StatusCode -ne 400) {
  throw "User create validation check failed. Expected 400 for empty payload, got $($create.StatusCode): $($create.Body)"
}

$createJson = $null
try {
  $createJson = $create.Body | ConvertFrom-Json
} catch {
  throw "User create validation response is not JSON: $($create.Body)"
}

if (-not $createJson.error) {
  throw "User create validation response missing expected error field: $($create.Body)"
}

$signin = Invoke-HttpJson -Method "POST" -Url "$trimmedBackend/api/user/signin" -Headers $userHeaders -Body "{}"
if ($signin.StatusCode -ne 400) {
  throw "User sign-in validation check failed. Expected 400 for empty payload, got $($signin.StatusCode): $($signin.Body)"
}

$signinJson = $null
try {
  $signinJson = $signin.Body | ConvertFrom-Json
} catch {
  throw "User sign-in validation response is not JSON: $($signin.Body)"
}

if (-not $signinJson.error) {
  throw "User sign-in validation response missing expected error field: $($signin.Body)"
}

if ($RequireSharedStore) {
  if (-not $DiagnosticsKey) {
    throw "RequireSharedStore was set but DiagnosticsKey was not provided."
  }

  $diagHeaders = @{
    Origin = $Origin
    "x-admin-diagnostics-key" = $DiagnosticsKey
  }

  $diag = Invoke-HttpJson -Method "GET" -Url "$trimmedBackend/api/user/create/diagnostics" -Headers $diagHeaders
  if ($diag.StatusCode -ne 200) {
    throw "Store diagnostics check failed with status $($diag.StatusCode): $($diag.Body)"
  }

  $diagJson = $null
  try {
    $diagJson = $diag.Body | ConvertFrom-Json
  } catch {
    throw "Store diagnostics response is not JSON: $($diag.Body)"
  }

  if (-not $diagJson.success -or -not $diagJson.diagnostics) {
    throw "Store diagnostics payload missing expected fields: $($diag.Body)"
  }

  $storePath = [string]$diagJson.diagnostics.files.primary.path
  if ($storePath -ne "shared-db://primary") {
    throw "Store diagnostics expected shared DB primary path, got '$storePath'"
  }

  $activeSource = [string]$diagJson.diagnostics.activeStore.source
  if ($activeSource -ne "primary") {
    throw "Store diagnostics expected active source 'primary', got '$activeSource'"
  }
}

Write-Host "Checks passed."
Write-Host "Health: 200 with CORS allow-origin $Origin"
Write-Host "AI Chat: 401 when unauthenticated (auth enforcement confirmed)"
Write-Host "Membership tiers: 200 (public endpoint confirmed)"
Write-Host "User create: 400 for empty payload (validation confirmed)"
Write-Host "User signin: 400 for empty payload (validation confirmed)"
if ($RequireSharedStore) {
  Write-Host "Store diagnostics: shared DB-backed persistence confirmed"
}
