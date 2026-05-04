param(
    [ValidateSet("janitor", "builder", "goals")]
    [string]$Mode = "janitor",

    [string]$Prompt = "",
    [int]$Cycles = 1,
    [int]$Improvements = 1,
    [int]$Review = 1,
    [int]$Slices = 0,
    [string]$MetaPlan = "",
    [string]$GoalPlan = "",
    [int]$MaxGoals = 0,
    [string[]]$LinkedRepo = @(),

    [ValidateSet("workspace-write", "danger-full-access")]
    [string]$Sandbox = "workspace-write",

    [string]$CodexWorkspace = $env:CODEX_WORKSPACE,
    [double]$StageIdleTimeoutSeconds = 900
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail($Message, $Code = 1) {
    Write-Host $Message -ForegroundColor Red
    exit $Code
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Fail "git is required before running slop-janitor."
}

$janitor = Get-Command slop-janitor -ErrorAction SilentlyContinue
if (-not $janitor) {
    Fail "slop-janitor is not on PATH. Install the CLI first; see docs\SLOP_JANITOR_ADMIN_WORKFLOW.md."
}

$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
    Fail "cargo is not on PATH. slop-janitor launches Codex through the open-source Rust workspace."
}

if ([string]::IsNullOrWhiteSpace($CodexWorkspace)) {
    Fail "CODEX_WORKSPACE is not set. Point it at the open-source Codex codex-rs workspace."
}

if (-not (Test-Path -LiteralPath $CodexWorkspace -PathType Container)) {
    Fail "CODEX_WORKSPACE does not exist: $CodexWorkspace"
}

$statusOutput = & git -C $repoRoot status --short -uall 2>&1
if ($LASTEXITCODE -ne 0) {
    Fail "Unable to inspect git status:`n$statusOutput"
}

if ($statusOutput) {
    Write-Host "Refusing to run slop-janitor because Luke has pre-existing worktree changes." -ForegroundColor Yellow
    Write-Host ""
    $statusOutput | ForEach-Object { Write-Host $_ }
    Write-Host ""
    Write-Host "Commit, stash, or intentionally clear these changes before starting an automated run."
    exit 2
}

$argsList = @()

if ($Mode -eq "goals") {
    $argsList += @("goals", "run")
    if (-not [string]::IsNullOrWhiteSpace($GoalPlan)) {
        $argsList += $GoalPlan
    }
    $argsList += @(
        "--codex-workspace", $CodexWorkspace,
        "--sandbox", $Sandbox,
        "--stage-idle-timeout-seconds", "$StageIdleTimeoutSeconds"
    )
    if ($MaxGoals -gt 0) {
        $argsList += @("--max-goals", "$MaxGoals")
    }
} else {
    $argsList += $Mode
    $argsList += @(
        "--codex-workspace", $CodexWorkspace,
        "--sandbox", $Sandbox,
        "--improvements", "$Improvements",
        "--review", "$Review",
        "--stage-idle-timeout-seconds", "$StageIdleTimeoutSeconds"
    )

    if (-not [string]::IsNullOrWhiteSpace($Prompt)) {
        $argsList += @("--prompt", $Prompt)
    }

    if ($Mode -eq "janitor") {
        $argsList += @("--cycles", "$Cycles")
    }

    if ($Mode -eq "builder") {
        if (-not [string]::IsNullOrWhiteSpace($MetaPlan)) {
            $argsList += @("--meta-plan", $MetaPlan)
        } elseif ($Slices -gt 0) {
            $argsList += @("--slices", "$Slices")
        } else {
            Fail "builder mode requires either -Slices or -MetaPlan."
        }
    }
}

foreach ($repo in $LinkedRepo) {
    if (-not [string]::IsNullOrWhiteSpace($repo)) {
        $argsList += @("--linked-repo", $repo)
    }
}

Write-Host "Running from $repoRoot"
Write-Host "slop-janitor $($argsList -join ' ')"
Push-Location $repoRoot
try {
    & slop-janitor @argsList
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
