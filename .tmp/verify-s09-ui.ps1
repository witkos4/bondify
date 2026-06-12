$ErrorActionPreference = "Stop"

function Get-BaseUrl {
  $logPath = "D:\REPOS\bondify\.s09-dev.out.log"
  if (Test-Path -LiteralPath $logPath) {
    $match = Select-String -Path $logPath -Pattern "http://localhost:(\d+)/" | Select-Object -Last 1
    if ($match) {
      return $match.Matches[0].Groups[0].Value.TrimEnd("/")
    }
  }

  return "http://localhost:4324"
}

function Escape-SqlLiteral([string] $value) {
  return $value.Replace("'", "''")
}

function Invoke-PsqlScalar([string] $sql) {
  $raw = & docker exec -i supabase_db_bondify psql -U postgres -d postgres -t -A -c $sql
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed for SQL: $sql"
  }

  $lines = @()
  foreach ($line in $raw) {
    $trimmed = $line.ToString().Trim()
    if ($trimmed -ne "") {
      $lines += $trimmed
    }
  }

  if ($lines.Count -eq 0) {
    return ""
  }

  if ($lines[-1] -match "^(INSERT|UPDATE|DELETE)\s+\d+\s+\d+$") {
    return $lines[0]
  }

  return $lines[-1]
}

function Invoke-FormPost([string] $uri, $session, [hashtable] $body) {
  return Invoke-WebRequest `
    -Uri $uri `
    -Method Post `
    -WebSession $session `
    -Body $body `
    -Headers @{
      Origin = $baseUrl
      Referer = "$baseUrl/"
    } `
    -MaximumRedirection 5
}

function Invoke-PageGet([string] $uri, $session) {
  return Invoke-WebRequest `
    -Uri $uri `
    -Method Get `
    -WebSession $session `
    -Headers @{
      Referer = "$baseUrl/"
    } `
    -MaximumRedirection 5
}

function Get-LatestRoundId([string] $teamId, [string] $gameSlug) {
  return Invoke-PsqlScalar @"
select rounds.id
from public.game_rounds as rounds
join public.game_templates as templates
  on templates.id = rounds.game_template_id
where rounds.team_id = '$teamId'
  and templates.slug = '$gameSlug'
order by rounds.created_at desc
limit 1;
"@
}

function Start-StructuredRound([string] $teamId, [string] $gameSlug, $sessionA, $sessionB, [string] $labelA, [string] $labelB) {
  Invoke-FormPost "$baseUrl/api/games/start" $sessionA @{
    teamId = $teamId
    gameSlug = $gameSlug
  } | Out-Null

  $roundId = Get-LatestRoundId $teamId $gameSlug
  if (-not $roundId) {
    throw "Could not locate newly started round."
  }

  Invoke-FormPost "$baseUrl/api/games/two-truths-entry" $sessionA @{
    teamId = $teamId
    gameSlug = $gameSlug
    roundId = $roundId
    statementOne = "$labelA truth one"
    statementTwo = "$labelA truth two"
    statementThree = "$labelA lie"
    lieStatementIndex = "3"
  } | Out-Null

  Invoke-FormPost "$baseUrl/api/games/two-truths-entry" $sessionB @{
    teamId = $teamId
    gameSlug = $gameSlug
    roundId = $roundId
    statementOne = "$labelB truth one"
    statementTwo = "$labelB lie"
    statementThree = "$labelB truth two"
    lieStatementIndex = "2"
  } | Out-Null

  Invoke-FormPost "$baseUrl/api/games/two-truths-close-collection" $sessionA @{
    teamId = $teamId
    gameSlug = $gameSlug
    roundId = $roundId
  } | Out-Null

  $entryIdA = Invoke-PsqlScalar "select id from public.two_truths_entries where game_round_id = '$roundId' and author_profile_id = '$profileIdA';"
  $entryIdB = Invoke-PsqlScalar "select id from public.two_truths_entries where game_round_id = '$roundId' and author_profile_id = '$profileIdB';"

  return [pscustomobject]@{
    RoundId = $roundId
    EntryIdA = $entryIdA
    EntryIdB = $entryIdB
  }
}

$baseUrl = Get-BaseUrl
$password = "BondifyS09!456"
$suffix = [guid]::NewGuid().ToString("N").Substring(0, 8)
$emailA = "s09fulla-$suffix@example.com"
$emailB = "s09fullb-$suffix@example.com"
$teamName = "S09 Full Verify $suffix"
$gameSlug = "two-truths-and-a-lie"

$sessionA = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$sessionB = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Invoke-FormPost "$baseUrl/api/auth/signup" $sessionA @{ email = $emailA; password = $password } | Out-Null
Invoke-FormPost "$baseUrl/api/auth/signup" $sessionB @{ email = $emailB; password = $password } | Out-Null
Invoke-FormPost "$baseUrl/api/auth/signin" $sessionA @{ email = $emailA; password = $password } | Out-Null
Invoke-FormPost "$baseUrl/api/auth/signin" $sessionB @{ email = $emailB; password = $password } | Out-Null

for ($attempt = 0; $attempt -lt 10; $attempt++) {
  $profileIdA = Invoke-PsqlScalar "select id from public.profiles where normalized_email = '$(Escape-SqlLiteral $emailA)' limit 1;"
  $profileIdB = Invoke-PsqlScalar "select id from public.profiles where normalized_email = '$(Escape-SqlLiteral $emailB)' limit 1;"
  if ($profileIdA -and $profileIdB) {
    break
  }

  Start-Sleep -Seconds 1
}

if (-not $profileIdA -or -not $profileIdB) {
  throw "Could not find verification profiles in local database."
}

$teamId = Invoke-PsqlScalar @"
insert into public.teams (id, name, created_by)
values (gen_random_uuid(), '$(Escape-SqlLiteral $teamName)', '$profileIdA')
returning id;
"@

Invoke-PsqlScalar @"
insert into public.team_memberships (team_id, profile_id)
values
  ('$teamId', '$profileIdA'),
  ('$teamId', '$profileIdB');
select 'ok';
"@ | Out-Null

$dashboardPage = Invoke-PageGet "$baseUrl/dashboard?team=$teamId" $sessionA
$oldTemplateHidden = $dashboardPage.Content -notlike "*Two Truths and a Wish*"
$newTemplateVisible = $dashboardPage.Content -like "*Two Truths and a Lie*"

$autoRound = Start-StructuredRound $teamId $gameSlug $sessionA $sessionB "Auto A" "Auto B"
$collectingPage = Invoke-PageGet "$baseUrl/teams/$teamId/games/$gameSlug" $sessionA

$votePageBeforeReveal = Invoke-PageGet "$baseUrl/teams/$teamId/games/$gameSlug" $sessionA
$voteUiVisible = $votePageBeforeReveal.Content -like "*Guess this set*"
$authorVisibleDuringVoting = $votePageBeforeReveal.Content -like "*$emailB*"
$guessOutcomeHiddenDuringVoting =
  $votePageBeforeReveal.Content -notlike "*Correct guess*" -and
  $votePageBeforeReveal.Content -notlike "*Author fooled them*"

Invoke-FormPost "$baseUrl/api/games/two-truths-vote" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $autoRound.RoundId
  targetEntryId = $autoRound.EntryIdB
  guessedLieIndex = "2"
} | Out-Null

$autoRevealResponse = Invoke-FormPost "$baseUrl/api/games/two-truths-vote" $sessionB @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $autoRound.RoundId
  targetEntryId = $autoRound.EntryIdA
  guessedLieIndex = "3"
}

$autoRoundPhase = Invoke-PsqlScalar "select phase from public.two_truths_rounds where game_round_id = '$($autoRound.RoundId)';"
$autoRevealPage = Invoke-PageGet "$baseUrl/teams/$teamId/games/$gameSlug" $sessionA
$autoRevealVisible = $autoRevealPage.Content -like "*Round scoring*" -and $autoRevealPage.Content -like "*This was the lie*"
$autoRevealGuessVisible = $autoRevealPage.Content -like "*Correct guess*"
$autoRevealWaitingGone = $autoRevealPage.Content -notlike "*Guess this set*"
$autoRevealFlashVisible = $autoRevealResponse.Content -like "*The round is now revealed.*"

$manualRound = Start-StructuredRound $teamId $gameSlug $sessionA $sessionB "Manual A" "Manual B"

Invoke-FormPost "$baseUrl/api/games/two-truths-vote" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $manualRound.RoundId
  targetEntryId = $manualRound.EntryIdB
  guessedLieIndex = "2"
} | Out-Null

$manualCloseResponse = Invoke-FormPost "$baseUrl/api/games/two-truths-close-voting" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $manualRound.RoundId
}

$manualRoundPhase = Invoke-PsqlScalar "select phase from public.two_truths_rounds where game_round_id = '$($manualRound.RoundId)';"
$manualGuessCount = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_guesses where game_round_id = '$($manualRound.RoundId)';")
$manualRevealPage = Invoke-PageGet "$baseUrl/teams/$teamId/games/$gameSlug" $sessionA
$manualCloseVisible = $manualCloseResponse.Content -like "*Voting is closed. Reveal is ready.*"
$manualRevealShowsPartial = $manualRevealPage.Content -like "*No teammate guesses were recorded for this set before reveal.*"

$historyPage = Invoke-PageGet "$baseUrl/teams/$teamId/history" $sessionA
$historySummaryVisible =
  $historyPage.Content -like "*Manual A truth one*" -and
  $historyPage.Content -like "*Lie*" -and
  $historyPage.Content -like "*Two Truths and a Lie*"

[pscustomobject]@{
  baseUrl = $baseUrl
  oldTemplateHidden = $oldTemplateHidden
  newTemplateVisible = $newTemplateVisible
  collectingShowsLockedSet = $collectingPage.Content -like "*Your locked set*"
  voteUiVisible = $voteUiVisible
  authorVisibleDuringVoting = $authorVisibleDuringVoting
  guessOutcomeHiddenDuringVoting = $guessOutcomeHiddenDuringVoting
  autoRoundPhase = $autoRoundPhase
  autoRevealVisible = $autoRevealVisible
  autoRevealGuessVisible = $autoRevealGuessVisible
  autoRevealWaitingGone = $autoRevealWaitingGone
  autoRevealFlashVisible = $autoRevealFlashVisible
  manualRoundPhase = $manualRoundPhase
  manualGuessCount = $manualGuessCount
  manualCloseVisible = $manualCloseVisible
  manualRevealShowsPartial = $manualRevealShowsPartial
  historySummaryVisible = $historySummaryVisible
} | Format-List *
