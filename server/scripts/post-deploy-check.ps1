param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,
  [string]$Origin = "https://conscious-network.org",
  [string]$ProbeMessage = "Post-deploy smoke test",
  [string]$DiagnosticsKey = "",
  [switch]$RequireSharedStore,
  [switch]$SkipAuthFlow
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

if (-not $SkipAuthFlow) {
  $nonce = [Guid]::NewGuid().ToString("N").Substring(0, 12)
  $passwordNonce = [Guid]::NewGuid().ToString("N").Substring(0, 16)
  $flowEmail = "smoke.$nonce@example.com"
  $flowPassword = "Aa1!$passwordNonce"
  $flowName = "Smoke User $nonce"
  $flowCreateBody = (@{
      email = $flowEmail
      name = $flowName
      password = $flowPassword
    } | ConvertTo-Json -Compress)

  $flowCreate = Invoke-HttpJson -Method "POST" -Url "$trimmedBackend/api/user/create" -Headers $userHeaders -Body $flowCreateBody
  if ($flowCreate.StatusCode -ne 200) {
    throw "Auth flow create failed. Expected 200, got $($flowCreate.StatusCode): $($flowCreate.Body)"
  }

  $flowCreateJson = $null
  try {
    $flowCreateJson = $flowCreate.Body | ConvertFrom-Json
  } catch {
    throw "Auth flow create response is not JSON: $($flowCreate.Body)"
  }

  if (-not $flowCreateJson.success -or -not $flowCreateJson.persistenceVerified -or -not $flowCreateJson.token -or -not $flowCreateJson.user) {
    throw "Auth flow create response missing required fields: $($flowCreate.Body)"
  }

  $flowToken = [string]$flowCreateJson.token
  $flowCurrentHeaders = @{
    Origin = $Origin
    Authorization = "Bearer $flowToken"
  }

  $flowCurrent = Invoke-HttpJson -Method "GET" -Url "$trimmedBackend/api/user/current" -Headers $flowCurrentHeaders
  if ($flowCurrent.StatusCode -ne 200) {
    throw "Auth flow current-user check failed after create. Expected 200, got $($flowCurrent.StatusCode): $($flowCurrent.Body)"
  }

  $flowCurrentJson = $null
  try {
    $flowCurrentJson = $flowCurrent.Body | ConvertFrom-Json
  } catch {
    throw "Auth flow current-user response is not JSON: $($flowCurrent.Body)"
  }

  if (-not $flowCurrentJson.success -or -not $flowCurrentJson.user -or [string]$flowCurrentJson.user.email -ne $flowEmail) {
    throw "Auth flow current-user payload mismatch after create: $($flowCurrent.Body)"
  }

  $flowLogout = Invoke-HttpJson -Method "POST" -Url "$trimmedBackend/api/user/logout" -Headers $flowCurrentHeaders
  if ($flowLogout.StatusCode -ne 200) {
    throw "Auth flow logout failed. Expected 200, got $($flowLogout.StatusCode): $($flowLogout.Body)"
  }

  $flowLogoutJson = $null
  try {
    $flowLogoutJson = $flowLogout.Body | ConvertFrom-Json
  } catch {
    throw "Auth flow logout response is not JSON: $($flowLogout.Body)"
  }

  if (-not $flowLogoutJson.success) {
    throw "Auth flow logout payload missing success=true: $($flowLogout.Body)"
  }

  $flowCurrentAfterLogout = Invoke-HttpJson -Method "GET" -Url "$trimmedBackend/api/user/current" -Headers $flowCurrentHeaders
  if ($flowCurrentAfterLogout.StatusCode -ne 401) {
    throw "Auth flow expected /api/user/current to return 401 after logout, got $($flowCurrentAfterLogout.StatusCode): $($flowCurrentAfterLogout.Body)"
  }

  $flowSignInBody = (@{
      email = $flowEmail
      password = $flowPassword
    } | ConvertTo-Json -Compress)
  $flowSignIn = Invoke-HttpJson -Method "POST" -Url "$trimmedBackend/api/user/signin" -Headers $userHeaders -Body $flowSignInBody
  if ($flowSignIn.StatusCode -ne 200) {
    throw "Auth flow sign-in failed after logout. Expected 200, got $($flowSignIn.StatusCode): $($flowSignIn.Body)"
  }

  $flowSignInJson = $null
  try {
    $flowSignInJson = $flowSignIn.Body | ConvertFrom-Json
  } catch {
    throw "Auth flow sign-in response is not JSON: $($flowSignIn.Body)"
  }

  if (-not $flowSignInJson.success -or -not $flowSignInJson.token -or -not $flowSignInJson.user) {
    throw "Auth flow sign-in payload missing required fields: $($flowSignIn.Body)"
  }
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
if (-not $SkipAuthFlow) {
  Write-Host "Auth flow: create -> current -> logout -> login passed"
}
if ($RequireSharedStore) {
  Write-Host "Store diagnostics: shared DB-backed persistence confirmed"
}
