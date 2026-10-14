param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$Tag,
  [Parameter(Mandatory = $true)][string[]]$Kws,
  [int]$Win = 1400
)
$ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
$tmp = Join-Path $env:TEMP "pg_$Tag.html"
curl.exe -s -L --max-time 90 -A $ua -o $tmp $Url
$t = Get-Content -LiteralPath $tmp -Raw
$plain = $t -replace '<script[\s\S]*?</script>', ' ' -replace '<style[\s\S]*?</style>', ' ' -replace '<[^>]+>', ' ' -replace '&nbsp;', ' ' -replace '&amp;', '&' -replace '&#8211;', '-' -replace '&#8217;', "'" -replace '&quot;', '"' -replace '\s+', ' '
Write-Output ("########## {0} | len {1}" -f $Tag, $plain.Length)
foreach ($kw in $Kws) {
  $i = $plain.IndexOf($kw)
  if ($i -ge 0) {
    $s = [Math]::Max(0, $i - 150)
    Write-Output ("=== [{0}] ===" -f $kw)
    Write-Output $plain.Substring($s, [Math]::Min($Win, $plain.Length - $s))
  } else {
    Write-Output ("=== [{0}] NOT FOUND ===" -f $kw)
  }
}
