#requires -Version 5.1
<#
.SYNOPSIS
    Устанавливает Mean Translator из последнего GitHub Release.

.DESCRIPTION
    Скачивает установщик последнего релиза, проверяет SHA-256 по данным GitHub
    и запускает тихую установку. По умолчанию ставится в профиль пользователя,
    поэтому права администратора не требуются.

.EXAMPLE
    irm https://raw.githubusercontent.com/nrasix/mean/master/install.ps1 | iex

.EXAMPLE
    .\install.ps1 -Version v1.0.0

.NOTES
    Скрипт не требует API-токена. Публичный GitHub API имеет лимит запросов,
    поэтому при массовой установке лучше скачать установщик напрямую со страницы Releases.
#>
[CmdletBinding()]
param(
    [string]$Repo = "nrasix/mean",
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

$apiUrl = if ($Version -eq "latest") {
    "https://api.github.com/repos/$Repo/releases/latest"
} else {
    $tag = if ($Version.StartsWith("v")) { $Version } else { "v$Version" }
    "https://api.github.com/repos/$Repo/releases/tags/$tag"
}

Write-Step "Получаю информацию о релизе ($Version)"

try {
    $release = Invoke-RestMethod -Uri $apiUrl -Headers @{
        "User-Agent" = "mean-translator-installer"
        "Accept"     = "application/vnd.github+json"
    }
} catch {
    throw "Не удалось получить релиз из $apiUrl. Проверьте интернет и имя репозитория. $($_.Exception.Message)"
}

$asset = $release.assets |
    Where-Object { $_.name -match "setup\.exe$" } |
    Select-Object -First 1

if (-not $asset) {
    throw "В релизе $($release.tag_name) не найден установщик *-setup.exe."
}

$installerPath = Join-Path $env:TEMP $asset.name

Write-Step "Скачиваю $($asset.name) ($([math]::Round($asset.size / 1MB, 2)) МБ)"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installerPath -UseBasicParsing

if ($asset.digest -and $asset.digest -match "^sha256:(?<hash>[0-9a-fA-F]{64})$") {
    Write-Step "Проверяю SHA-256"
    $expected = $Matches["hash"].ToUpperInvariant()
    $actual = (Get-FileHash -Path $installerPath -Algorithm SHA256).Hash.ToUpperInvariant()

    if ($actual -ne $expected) {
        Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue
        throw "SHA-256 не совпадает. Ожидалось $expected, получено $actual. Установка отменена."
    }
} else {
    Write-Warning "GitHub не вернул digest для файла — пропускаю проверку SHA-256."
}

Write-Step "Устанавливаю Mean Translator"

$process = Start-Process -FilePath $installerPath -ArgumentList "/S" -PassThru -Wait

if ($process.ExitCode -ne 0) {
    throw "Установщик завершился с кодом $($process.ExitCode)."
}

Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Готово. Mean Translator установлен." -ForegroundColor Green
Write-Host "Запустите приложение из меню «Пуск» или нажмите Shift+Alt+T."
