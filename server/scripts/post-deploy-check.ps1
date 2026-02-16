param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,
  [string]$Origin = "https://conscious-network.org",
  [string]$ProbeMessage = "Post-deploy smoke test"
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

    $reader = New-Object System.IO.StreamReader($httpResp.GetResponseStream())
    $content = $reader.ReadToEnd()

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

Write-Host "Checks passed."
Write-Host "Health: 200 with CORS allow-origin $Origin"
Write-Host "AI Chat: 401 when unauthenticated (auth enforcement confirmed)"
Write-Host "Membership tiers: 200 (public endpoint confirmed)"
