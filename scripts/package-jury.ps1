<#
  package-jury.ps1
  Packages audit and test artifacts into a zip suitable for sharing with a jury.
#>

param(
  [string]$out = "artifacts\triviando-security-demo.zip"
)

$root = (Get-Location).Path
if (-Not (Test-Path "$root\audit")) {
  Write-Error "audit folder not found at $root\audit"
  exit 1
}

if (-Not (Test-Path "$root\artifacts")) {
  New-Item -ItemType Directory -Path "$root\artifacts" | Out-Null
}

$items = @(
  "$root\audit\security-audit.json",
  "$root\audit\security-audit.md",
  "$root\audit\security-audit.html",
  "$root\audit\test-security-output.txt",
  "$root\audit\audit-run-output.txt",
  "$root\audit\JURY_README.md"
)

$existing = $items | Where-Object { Test-Path $_ }
if ($existing.Count -eq 0) {
  Write-Error "No artifacts found to package. Ensure the audit was run and tests executed."
  exit 1
}

if (Test-Path $out) { Remove-Item $out -Force }

Compress-Archive -Path $existing -DestinationPath $out -Force

Write-Output "Packaged artifacts to: $out"
Write-Output "Contents:"
Get-ChildItem -Path $out | ForEach-Object { Write-Output " - $($_.FullName)" }
