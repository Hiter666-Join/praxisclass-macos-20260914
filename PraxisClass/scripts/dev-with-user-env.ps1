param([ValidateRange(1, 65535)][int]$Port = 3000)

$ErrorActionPreference = 'Stop'

# Windows applications opened before a User variable was set keep an older
# environment. Load only the connection variables needed by this server.
$taskConnectionVariables = @(
    'DIFY_BASE_URL', 'DIFY_DATASET_ID', 'DIFY_DATASET_API_KEY', 'DIFY_API_KEY',
    'KIMI_API_KEY', 'KIMI_BASE_URL', 'KIMI_MODELS',
    'IMAGE_QWEN_IMAGE_API_KEY', 'IMAGE_QWEN_IMAGE_BASE_URL', 'IMAGE_QWEN_IMAGE_MODELS',
    'TTS_QWEN_API_KEY', 'TTS_QWEN_BASE_URL', 'TTS_QWEN_MODELS',
    'ASR_QWEN_API_KEY', 'ASR_QWEN_BASE_URL', 'ASR_QWEN_MODELS'
)
foreach ($taskEnvName in $taskConnectionVariables) {
    if (-not [Environment]::GetEnvironmentVariable($taskEnvName, 'Process')) {
        $taskEnvValue = [Environment]::GetEnvironmentVariable($taskEnvName, 'User')
        if ($taskEnvValue) {
            [Environment]::SetEnvironmentVariable($taskEnvName, $taskEnvValue, 'Process')
        }
    }
}

# Reuse the user's authorized Qwen credential for media capabilities only.
# Explicit capability credentials win; do not persist or print the shared key.
$taskQwenMediaKey = [Environment]::GetEnvironmentVariable('QWEN_API_KEY', 'Process')
if (-not $taskQwenMediaKey) {
    $taskQwenMediaKey = [Environment]::GetEnvironmentVariable('QWEN_API_KEY', 'User')
}
if ($taskQwenMediaKey) {
    foreach ($taskEnvName in @('IMAGE_QWEN_IMAGE_API_KEY', 'TTS_QWEN_API_KEY', 'ASR_QWEN_API_KEY')) {
        if (-not [Environment]::GetEnvironmentVariable($taskEnvName, 'Process')) {
            [Environment]::SetEnvironmentVariable($taskEnvName, $taskQwenMediaKey, 'Process')
        }
    }
}
$taskQwenMediaKey = $null

Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    # Run the installed framework directly; startup must not trigger dependency installation.
    & node (Join-Path (Get-Location) 'node_modules/next/dist/bin/next') dev -p $Port
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
