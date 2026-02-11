# Verify-Scaffold.ps1
# Scaffold verification tests for 000-repo-init spec.
# Validates correctness properties and unit-level assertions over the generated files.
#
# Exit code 0 = all tests pass, non-zero = at least one failure.

param(
    [string]$RepoRoot = (Resolve-Path "$PSScriptRoot/..").Path
)

$script:failures = @()
$script:passed = 0

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        $script:failures += $Message
        Write-Host "  FAIL: $Message" -ForegroundColor Red
    } else {
        $script:passed++
        Write-Host "  PASS: $Message" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------------
# Property 1: Placeholder stub structure consistency
# Validates: Requirements 6.3
# For every .cs stub in Runtime/ and Editor/, the file must contain exactly
# a namespace declaration and a single empty internal class with a summary
# doc comment.
# ---------------------------------------------------------------------------
function Test-Property1-StubStructure {
    Write-Host "`n=== Property 1: Placeholder stub structure consistency ===" -ForegroundColor Cyan

    $stubFiles = @(
        "Runtime/Core/VirtualNode.cs",
        "Runtime/Components/ComponentRenderer.cs",
        "Runtime/API/DocumentAPI.cs",
        "Runtime/Bridge/PuertsBridge.cs",
        "Editor/WebiumInspector.cs"
    )

    foreach ($rel in $stubFiles) {
        $full = Join-Path $RepoRoot $rel
        Assert-True (Test-Path $full) "$rel exists"

        if (Test-Path $full) {
            $content = Get-Content $full -Raw

            # Must have a namespace declaration
            $hasNamespace = $content -match 'namespace\s+Webium(\.\w+)?\s*\{'
            Assert-True $hasNamespace "$rel contains a namespace declaration"

            # Must have exactly one internal class
            $classMatches = [regex]::Matches($content, '\binternal\s+class\s+\w+\s*\{')
            Assert-True ($classMatches.Count -eq 1) "$rel contains exactly one internal class (found $($classMatches.Count))"

            # Must have the summary doc comment
            $hasDocComment = $content -match '///\s*<summary>'
            Assert-True $hasDocComment "$rel contains a summary doc comment"

            # Must NOT contain any method, field, or property declarations
            $hasMembers = $content -match '\b(public|private|protected|static|void|int|string|bool|float|double)\s+\w+\s*[\(\{=;]'
            Assert-True (-not $hasMembers) "$rel contains no member declarations (pure placeholder)"
        }
    }
}

# ---------------------------------------------------------------------------
# Property 2: Spec directory naming convention
# Validates: Requirements 8.2
# Every segment spec directory under .kiro/specs/ (excluding 000-repo-init)
# must match ^[0-9]{3}-[a-z0-9-]+$
# ---------------------------------------------------------------------------
function Test-Property2-SpecNaming {
    Write-Host "`n=== Property 2: Spec directory naming convention ===" -ForegroundColor Cyan

    $specsDir = Join-Path $RepoRoot ".kiro/specs"
    $dirs = Get-ChildItem -Path $specsDir -Directory | Where-Object { $_.Name -ne "000-repo-init" }

    Assert-True ($dirs.Count -ge 9) "At least 9 segment spec directories exist (found $($dirs.Count))"

    foreach ($d in $dirs) {
        $matches = $d.Name -match '^[0-9]{3}-[a-z0-9-]+$'
        Assert-True $matches "Spec dir '$($d.Name)' matches naming pattern ^[0-9]{3}-[a-z0-9-]+$"
    }
}

# ---------------------------------------------------------------------------
# Property 3: Spec stub completeness
# Validates: Requirements 8.4
# Every segment spec directory (excluding 000-repo-init) must contain a
# requirements.md with a segment scope summary and a VISION.md reference.
# ---------------------------------------------------------------------------
function Test-Property3-SpecCompleteness {
    Write-Host "`n=== Property 3: Spec stub completeness ===" -ForegroundColor Cyan

    $specsDir = Join-Path $RepoRoot ".kiro/specs"
    $dirs = Get-ChildItem -Path $specsDir -Directory | Where-Object { $_.Name -ne "000-repo-init" }

    foreach ($d in $dirs) {
        $reqFile = Join-Path $d.FullName "requirements.md"
        Assert-True (Test-Path $reqFile) "$($d.Name)/requirements.md exists"

        if (Test-Path $reqFile) {
            $content = Get-Content $reqFile -Raw

            # Must contain a scope summary (Introduction section with content)
            $hasIntro = $content -match '##\s+Introduction'
            Assert-True $hasIntro "$($d.Name)/requirements.md has an Introduction section"

            # Must reference VISION.md
            $hasVisionRef = $content -match 'VISION\.md'
            Assert-True $hasVisionRef "$($d.Name)/requirements.md references VISION.md"
        }
    }
}


# ---------------------------------------------------------------------------
# Unit Test: package.json validation
# Validates: Requirements 1.1, 1.2
# ---------------------------------------------------------------------------
function Test-Unit-PackageJson {
    Write-Host "`n=== Unit Test: package.json validation ===" -ForegroundColor Cyan

    $file = Join-Path $RepoRoot "package.json"
    Assert-True (Test-Path $file) "package.json exists"

    if (Test-Path $file) {
        $raw = Get-Content $file -Raw
        try {
            $json = $raw | ConvertFrom-Json
            Assert-True $true "package.json is valid JSON"
            Assert-True ($json.name -eq "com.webium.core") "package name is com.webium.core"
            Assert-True ($json.version -eq "0.1.0") "package version is 0.1.0"
            Assert-True ($json.displayName -eq "Webium") "displayName is Webium"
            Assert-True ($json.unity -eq "2021.3") "unity minimum version is 2021.3"
        } catch {
            Assert-True $false "package.json is valid JSON (parse error: $_)"
        }
    }
}

# ---------------------------------------------------------------------------
# Unit Test: asmdef files validation
# Validates: Requirements 3.1, 3.2, 3.3
# ---------------------------------------------------------------------------
function Test-Unit-AsmdefFiles {
    Write-Host "`n=== Unit Test: asmdef files validation ===" -ForegroundColor Cyan

    # Runtime asmdef
    $rtFile = Join-Path $RepoRoot "Runtime/webium.runtime.asmdef"
    Assert-True (Test-Path $rtFile) "webium.runtime.asmdef exists"
    if (Test-Path $rtFile) {
        try {
            $rt = Get-Content $rtFile -Raw | ConvertFrom-Json
            Assert-True $true "webium.runtime.asmdef is valid JSON"
            Assert-True ($rt.name -eq "webium.runtime") "runtime assembly name is webium.runtime"
        } catch {
            Assert-True $false "webium.runtime.asmdef is valid JSON (parse error: $_)"
        }
    }

    # Editor asmdef
    $edFile = Join-Path $RepoRoot "Editor/webium.editor.asmdef"
    Assert-True (Test-Path $edFile) "webium.editor.asmdef exists"
    if (Test-Path $edFile) {
        try {
            $ed = Get-Content $edFile -Raw | ConvertFrom-Json
            Assert-True $true "webium.editor.asmdef is valid JSON"
            Assert-True ($ed.name -eq "webium.editor") "editor assembly name is webium.editor"
            Assert-True ($ed.references -contains "webium.runtime") "editor references webium.runtime"

            # No circular references: editor references runtime, runtime references nothing
            $rt2 = Get-Content $rtFile -Raw | ConvertFrom-Json
            Assert-True ($rt2.references.Count -eq 0) "runtime has no references (no circular dependency)"
        } catch {
            Assert-True $false "webium.editor.asmdef is valid JSON (parse error: $_)"
        }
    }
}

# ---------------------------------------------------------------------------
# Unit Test: .gitignore coverage
# Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
# ---------------------------------------------------------------------------
function Test-Unit-Gitignore {
    Write-Host "`n=== Unit Test: .gitignore coverage ===" -ForegroundColor Cyan

    $file = Join-Path $RepoRoot ".gitignore"
    Assert-True (Test-Path $file) ".gitignore exists"

    if (Test-Path $file) {
        $content = Get-Content $file -Raw

        # OS files (Req 4.2)
        Assert-True ($content -match '\.DS_Store') ".gitignore excludes .DS_Store"
        Assert-True ($content -match 'Thumbs\.db') ".gitignore excludes Thumbs.db"

        # IDE metadata (Req 4.3)
        Assert-True ($content -match '\.idea/') ".gitignore excludes .idea/"
        Assert-True ($content -match '\.vs/') ".gitignore excludes .vs/"
        Assert-True ($content -match '\*\.csproj') ".gitignore excludes *.csproj"
        Assert-True ($content -match '\*\.sln') ".gitignore excludes *.sln"

        # Unity generated (Req 4.4)
        Assert-True ($content -match '\[Ll\]ibrary/') ".gitignore excludes Library/"
        Assert-True ($content -match '\[Tt\]emp/') ".gitignore excludes Temp/"
        Assert-True ($content -match '\[Ll\]ogs/') ".gitignore excludes Logs/"
        Assert-True ($content -match '\[Oo\]bj/') ".gitignore excludes obj/"

        # Compiled artifacts with Plugins exception (Req 4.5)
        Assert-True ($content -match '\*\.dll') ".gitignore excludes *.dll"
        Assert-True ($content -match '\*\.pdb') ".gitignore excludes *.pdb"
        Assert-True ($content -match '\*\.mdb') ".gitignore excludes *.mdb"
        Assert-True ($content -match '!Plugins/') ".gitignore has Plugins exception for dlls"
    }
}

# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------
Write-Host "Running scaffold verification tests..." -ForegroundColor Yellow
Write-Host "Repo root: $RepoRoot"

Test-Property1-StubStructure
Test-Property2-SpecNaming
Test-Property3-SpecCompleteness
Test-Unit-PackageJson
Test-Unit-AsmdefFiles
Test-Unit-Gitignore

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Yellow
Write-Host "Passed: $($script:passed)" -ForegroundColor Green
if ($script:failures.Count -gt 0) {
    Write-Host "Failed: $($script:failures.Count)" -ForegroundColor Red
    foreach ($f in $script:failures) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    exit 1
} else {
    Write-Host "All tests passed." -ForegroundColor Green
    exit 0
}
