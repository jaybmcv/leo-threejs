# Runs Leo live (server/leo-live.mjs, the walk page's multiplayer server) on THIS PC, the one that already hosts
# Voyager's Reach, and puts it on the internet at https://leo-live.marscatsvoyage.com through Reach's existing
# Cloudflare tunnel (mcv-voyagers-reach). Reach is not touched: its route stays as it is, and so does its server.
#
# Before running it, on this PC:
#   - Reach's permanent link is set up (the cloudflared service runs, and ~/.cloudflared/cert.pem exists from
#     `cloudflared tunnel login`; see voyagers-reach docs/sharing.md)
#   - a checkout of leo-threejs on main, with `npm ci` done in it; run this from that checkout:
#       powershell -ExecutionPolicy Bypass -File scripts\setup-live-host.ps1
#
# What it does (running it again is safe):
#   1. registers the scheduled task LeoLive: node server/leo-live.mjs in this checkout, at logon and every minute
#      after (a start while it runs is ignored, so a crash is back within a minute), in a console with no window;
#      its output goes to leo-live.log beside the checkout
#   2. adds leo-live.marscatsvoyage.com -> http://127.0.0.1:8090 to the tunnel's routes, keeping every route already
#      there (Reach's)
#   3. points DNS for leo-live.marscatsvoyage.com at the tunnel (that one name only)
#   4. checks https://leo-live.marscatsvoyage.com/health
#
# To update the server: git pull and npm ci here, then  Stop-ScheduledTask LeoLive; Start-ScheduledTask LeoLive
# NOTE: Reach's scripts\setup-permanent-link.ps1 sets the tunnel's routes to Reach's alone. If it is ever run again,
# run this again afterwards to put Leo live's route back.
param(
  [string]$Tunnel = "mcv-voyagers-reach",
  [string]$Hostname = "leo-live.marscatsvoyage.com",
  [int]$Port = 8090
)
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$node = (Get-Command node).Source
if (-not (Test-Path (Join-Path $repo "server\leo-live.mjs"))) { throw "$repo has no server\leo-live.mjs: check out main there first" }
if (-not (Test-Path (Join-Path $repo "node_modules\ws"))) { throw "$repo has no node_modules: run npm ci there first" }
$cfgDir = Join-Path $env:USERPROFILE ".cloudflared"
$certPath = Join-Path $cfgDir "cert.pem"
if (-not (Test-Path $certPath)) { throw "Not logged in to Cloudflare on this PC. Run: cloudflared tunnel login (pick marscatsvoyage.com), then run this again." }

# ---- 1. the server, as a scheduled task -------------------------------------------------------------------------
$log = Join-Path (Split-Path $repo -Parent) "leo-live.log"
Stop-ScheduledTask -TaskName "LeoLive" -ErrorAction SilentlyContinue
foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'server[\\/]leo-live\.mjs' })) {
  Stop-Process -Id $p.ProcessId -Force
  Write-Output "stopped the Leo live server that was running (pid $($p.ProcessId))"
}
$run = "--headless cmd.exe /d /c `"`"$node`" server\leo-live.mjs >> `"$log`" 2>&1`""
$action = New-ScheduledTaskAction -Execute (Join-Path $env:WINDIR "System32\conhost.exe") -Argument $run -WorkingDirectory $repo
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$everyMinute = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "LeoLive" -Action $action -Trigger @($atLogon, $everyMinute) -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName "LeoLive"
$up = $false
for ($i = 0; $i -lt 20 -and -not $up; $i++) {
  Start-Sleep 1
  try { $up = (Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2).ok } catch {}
}
if (-not $up) { throw "Leo live did not answer on http://127.0.0.1:$Port/health; see $log" }
Write-Output "task LeoLive: Leo live is up on :$Port (log: $log)"

# ---- 2. the tunnel's routes: Reach's kept, Leo live's added ------------------------------------------------------
$list = cloudflared tunnel list --output json | ConvertFrom-Json
$t = $list | Where-Object { $_.name -eq $Tunnel }
if (-not $t) { throw "Tunnel '$Tunnel' not found in this account. Refusing to create one; set up Reach's link first." }
$pem = Get-Content $certPath -Raw
$m = [regex]::Match($pem, "-----BEGIN ARGO TUNNEL TOKEN-----\s*([\s\S]*?)\s*-----END ARGO TUNNEL TOKEN-----")
if (-not $m.Success) { throw "cert.pem has no ARGO TUNNEL TOKEN block" }
$oc = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($m.Groups[1].Value -replace "\s", ""))) | ConvertFrom-Json
$api = "https://api.cloudflare.com/client/v4/accounts/$($oc.accountID)/cfd_tunnel/$($t.id)/configurations"
$hdr = @{ Authorization = "Bearer $($oc.apiToken)"; "Content-Type" = "application/json" }
$config = (Invoke-RestMethod -Uri $api -Headers $hdr -Method Get).result.config
if (-not $config -or -not $config.ingress) { throw "The tunnel has no routes yet: set up Reach's permanent link first (voyagers-reach scripts\setup-permanent-link.ps1)." }
Write-Output "current routes: $($config.ingress | ConvertTo-Json -Compress -Depth 10)"
$origin = "http://127.0.0.1:$Port"
$named = @($config.ingress | Where-Object { $_.hostname -and $_.hostname -ne $Hostname })
$catchAll = @($config.ingress | Where-Object { -not $_.hostname }) | Select-Object -First 1
if (-not $catchAll) { $catchAll = [pscustomobject]@{ service = "http_status:404" } }
$mine = @($config.ingress | Where-Object { $_.hostname -eq $Hostname })
if ($mine.Count -eq 1 -and $mine[0].service -eq $origin) {
  Write-Output "route already there: $Hostname -> $origin"
} else {
  $config.ingress = @($named) + @([pscustomobject]@{ hostname = $Hostname; service = $origin }) + @($catchAll)
  $body = @{ config = $config } | ConvertTo-Json -Depth 10
  $r = Invoke-RestMethod -Uri $api -Headers $hdr -Method Put -Body $body
  if (-not $r.success) { throw "setting the routes failed: $($r.errors | ConvertTo-Json -Compress)" }
  Write-Output "routes now: $($r.result.config.ingress | ConvertTo-Json -Compress -Depth 10)"
}

# ---- 3. DNS for the one name ------------------------------------------------------------------------------------
$dns = cloudflared tunnel route dns $Tunnel $Hostname 2>&1 | Out-String
Write-Output $dns.Trim()

# ---- 4. from outside ----------------------------------------------------------------------------------------------
$ok = $false
$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline -and -not $ok) {
  try { $ok = (Invoke-RestMethod -Uri "https://$Hostname/health" -TimeoutSec 10).ok } catch { Start-Sleep 5 }
}
if (-not $ok) { throw "https://$Hostname/health did not answer yet. DNS can take a few minutes; run this again, or check 'cloudflared tunnel info $Tunnel'." }
Write-Output ""
Write-Output "OK: https://$Hostname/health answers. The walk page joins at wss://$Hostname/live."
