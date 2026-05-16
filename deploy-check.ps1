Write-Host "======================================" -ForegroundColor Cyan
Write-Host " FAROZIK - RUDYO VIDEO STUDIO IA" -ForegroundColor Cyan
Write-Host " Verification production PowerShell" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

function Ok($msg) {
    Write-Host "OK - $msg" -ForegroundColor Green
}

function Warn($msg) {
    Write-Host "ATTENTION - $msg" -ForegroundColor Yellow
}

function Fail($msg) {
    Write-Host "ERREUR - $msg" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Verification Node.js..." -ForegroundColor Blue
try {
    $nodeVersion = node -v
    Ok "Node.js detecte : $nodeVersion"
} catch {
    Fail "Node.js n'est pas installe."
}

Write-Host ""
Write-Host "Verification npm..." -ForegroundColor Blue
try {
    $npmVersion = npm -v
    Ok "npm detecte : $npmVersion"
} catch {
    Fail "npm n'est pas installe."
}

Write-Host ""
Write-Host "Verification Git..." -ForegroundColor Blue
try {
    $gitVersion = git --version
    Ok $gitVersion
} catch {
    Fail "Git n'est pas installe."
}

Write-Host ""
Write-Host "Verification package.json..." -ForegroundColor Blue
if (!(Test-Path "package.json")) {
    Fail "package.json introuvable. Vous n'etes probablement pas dans le dossier du projet."
}
Ok "package.json trouve."

Write-Host ""
Write-Host "Verification .gitignore..." -ForegroundColor Blue

if (!(Test-Path ".gitignore")) {
    New-Item -Path ".gitignore" -ItemType File | Out-Null
    Ok ".gitignore cree."
}

$itemsToIgnore = @(
    "node_modules",
    ".next",
    "out",
    ".vercel",
    ".env",
    ".env.local",
    ".env*.local",
    ".DS_Store",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",
    "pnpm-debug.log*"
)

$gitignoreContent = Get-Content ".gitignore" -Raw -ErrorAction SilentlyContinue

foreach ($item in $itemsToIgnore) {
    if ($gitignoreContent -notmatch [regex]::Escape($item)) {
        Add-Content ".gitignore" $item
        Ok "$item ajoute a .gitignore"
    }
}

Ok ".gitignore verifie."

Write-Host ""
Write-Host "Verification que .env.local n'est pas suivi par Git..." -ForegroundColor Blue

git ls-files --error-unmatch .env.local *> $null

if ($LASTEXITCODE -eq 0) {
    Warn ".env.local est suivi par Git. Suppression du suivi sans supprimer le fichier..."
    git rm --cached .env.local
    Ok ".env.local retire du suivi Git."
} else {
    Ok ".env.local n'est pas suivi par Git."
}

Write-Host ""
Write-Host "Verification .env.local..." -ForegroundColor Blue

if (!(Test-Path ".env.local")) {
    Warn ".env.local introuvable."
} else {
    Ok ".env.local trouve."

    $envLines = Get-Content ".env.local"

    foreach ($line in $envLines) {
        $trimmed = $line.Trim()

        if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed -split "=", 2

        if ($parts.Count -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

Write-Host ""
Write-Host "Verification des variables importantes..." -ForegroundColor Blue

if (!$env:AUTH_COOKIE_SECRET) {
    Warn "AUTH_COOKIE_SECRET manquant."
} elseif ($env:AUTH_COOKIE_SECRET.Length -lt 32) {
    Warn "AUTH_COOKIE_SECRET trop court. Minimum recommande : 32 caracteres."
} elseif ($env:AUTH_COOKIE_SECRET -eq "your_secret_key_minimum_32_characters_long_here") {
    Warn "AUTH_COOKIE_SECRET utilise encore la valeur d'exemple."
} else {
    Ok "AUTH_COOKIE_SECRET present."
}

if (!$env:DATABASE_URL) {
    Warn "DATABASE_URL manquant."
} elseif ($env:DATABASE_URL -eq "postgresql://user:password@localhost:5432/rudyo") {
    Warn "DATABASE_URL utilise encore la valeur d'exemple."
} else {
    Ok "DATABASE_URL present."
}

if (!$env:OPENAI_API_KEY) {
    Warn "OPENAI_API_KEY manquant."
} else {
    Ok "OPENAI_API_KEY present."
}

if (!$env:OPENAI_MODEL) {
    Warn "OPENAI_MODEL manquant. Recommande : gpt-4o-mini"
} else {
    Ok "OPENAI_MODEL = $env:OPENAI_MODEL"
}

if (!$env:USE_MOCK_STORYBOARD) {
    Warn "USE_MOCK_STORYBOARD manquant."
} else {
    Ok "USE_MOCK_STORYBOARD = $env:USE_MOCK_STORYBOARD"
}

if (!$env:INITIAL_CREDITS) {
    Warn "INITIAL_CREDITS manquant. Recommande : 20"
} else {
    Ok "INITIAL_CREDITS = $env:INITIAL_CREDITS"
}

Write-Host ""
Write-Host "Installation / verification des dependances..." -ForegroundColor Blue
npm install

Write-Host ""
Write-Host "Verification Prisma..." -ForegroundColor Blue

if ((Test-Path "prisma") -and (Test-Path "prisma/schema.prisma")) {
    Ok "Prisma detecte."
    npx prisma generate

    if ($env:DATABASE_URL) {
        Warn "Synchronisation Prisma avec la base..."
        npx prisma db push
    } else {
        Warn "DATABASE_URL absent. Prisma db push ignore."
    }
} else {
    Warn "Prisma non detecte. Etape ignoree."
}

Write-Host ""
Write-Host "Build production..." -ForegroundColor Blue
npm run build

if ($LASTEXITCODE -eq 0) {
    Ok "Build reussi."
} else {
    Fail "Build echoue."
}

Write-Host ""
Write-Host "Etat Git :" -ForegroundColor Cyan
git status

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " COMMANDES POUR ENVOYER SUR GITHUB" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Write-Host "git add ."
Write-Host 'git commit -m "Production ready version of Rudyo Video Studio IA"'
Write-Host "git push origin main"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " GENERER UNE CLE AUTH_COOKIE_SECRET" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

Write-Host 'node -e "console.log(require(''crypto'').randomBytes(32).toString(''hex''))"'

Write-Host ""
Write-Host "Variables a mettre dans Vercel :"
Write-Host "USE_LOCAL_SESSION=false"
Write-Host "DATABASE_URL=postgresql://vrai_user:vrai_mot_de_passe@vrai_host:5432/rudyo"
Write-Host "AUTH_COOKIE_SECRET=cle_generee"
Write-Host "INITIAL_CREDITS=20"
Write-Host "OPENAI_API_KEY=sk-votre_nouvelle_cle"
Write-Host "OPENAI_MODEL=gpt-4o-mini"
Write-Host "USE_MOCK_STORYBOARD=false"

Write-Host ""
Write-Host "Verification terminee." -ForegroundColor Green