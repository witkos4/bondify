$ErrorActionPreference = "Stop"

function Get-BaseUrl {
  $logPath = "D:\REPOS\bondify\.s09-dev.out.log"
  if (Test-Path -LiteralPath $logPath) {
    $match = Select-String -Path $logPath -Pattern "http://localhost:(\d+)/" | Select-Object -Last 1
    if ($match) {
      return $match.Matches[0].Groups[0].Value.TrimEnd("/")
    }
  }

  return "http://localhost:4323"
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

function Get-KnownMessage([string] $content) {
  $messages = @(
    "Your guess is saved.",
    "You cannot guess on your own submitted set.",
    "You have already guessed on this teammate's set.",
    "That teammate entry could not be found.",
    "This round is not in the voting phase.",
    "We couldn't save your guess right now."
  )

  foreach ($message in $messages) {
    if ($content -like "*$message*") {
      return $message
    }
  }

  return ""
}

$baseUrl = Get-BaseUrl
$password = "BondifyS09!123"
$suffix = [guid]::NewGuid().ToString("N").Substring(0, 8)
$emailA = "s09a-$suffix@example.com"
$emailB = "s09b-$suffix@example.com"
$teamName = "S09 Verify $suffix"
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

Invoke-FormPost "$baseUrl/api/games/start" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
} | Out-Null

$roundId = Invoke-PsqlScalar @"
select rounds.id
from public.game_rounds as rounds
join public.game_templates as templates
  on templates.id = rounds.game_template_id
where rounds.team_id = '$teamId'
  and templates.slug = '$gameSlug'
order by rounds.created_at desc
limit 1;
"@

if (-not $roundId) {
  throw "Could not locate structured round for verification."
}

$phaseAfterStart = Invoke-PsqlScalar "select phase from public.two_truths_rounds where game_round_id = '$roundId';"

Invoke-FormPost "$baseUrl/api/games/two-truths-entry" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
  statementOne = "A invalid statement one"
  statementTwo = "A invalid statement two"
  statementThree = "A invalid statement three"
  lieStatementIndex = "9"
} | Out-Null

$entryCountAfterInvalid = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_entries where game_round_id = '$roundId';")

Invoke-FormPost "$baseUrl/api/games/two-truths-entry" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
  statementOne = "A true statement"
  statementTwo = "A second true statement"
  statementThree = "A lie statement"
  lieStatementIndex = "3"
} | Out-Null

$entryCountAfterFirstValid = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_entries where game_round_id = '$roundId';")

Invoke-FormPost "$baseUrl/api/games/two-truths-entry" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
  statementOne = "A duplicate statement one"
  statementTwo = "A duplicate statement two"
  statementThree = "A duplicate statement three"
  lieStatementIndex = "2"
} | Out-Null

$entryCountAfterDuplicate = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_entries where game_round_id = '$roundId';")

Invoke-FormPost "$baseUrl/api/games/two-truths-entry" $sessionB @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
  statementOne = "B true statement"
  statementTwo = "B lie statement"
  statementThree = "B second true statement"
  lieStatementIndex = "2"
} | Out-Null

$entryCountAfterSecondParticipant = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_entries where game_round_id = '$roundId';")

Invoke-FormPost "$baseUrl/api/games/two-truths-close-collection" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
} | Out-Null

$phaseAfterClose = Invoke-PsqlScalar "select phase from public.two_truths_rounds where game_round_id = '$roundId';"

$entryIdA = Invoke-PsqlScalar "select id from public.two_truths_entries where game_round_id = '$roundId' and author_profile_id = '$profileIdA';"
$entryIdB = Invoke-PsqlScalar "select id from public.two_truths_entries where game_round_id = '$roundId' and author_profile_id = '$profileIdB';"

$selfGuessResponse = Invoke-FormPost "$baseUrl/api/games/two-truths-vote" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
  targetEntryId = $entryIdA
  guessedLieIndex = "1"
}

$guessCountAfterSelfGuess = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_guesses where game_round_id = '$roundId';")

$firstVoteResponse = Invoke-FormPost "$baseUrl/api/games/two-truths-vote" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
  targetEntryId = $entryIdB
  guessedLieIndex = "2"
}

$guessCountAfterFirstVote = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_guesses where game_round_id = '$roundId';")

$duplicateVoteResponse = Invoke-FormPost "$baseUrl/api/games/two-truths-vote" $sessionA @{
  teamId = $teamId
  gameSlug = $gameSlug
  roundId = $roundId
  targetEntryId = $entryIdB
  guessedLieIndex = "1"
}

$guessCountAfterDuplicateVote = [int](Invoke-PsqlScalar "select count(*) from public.two_truths_guesses where game_round_id = '$roundId';")

[pscustomobject]@{
  baseUrl = $baseUrl
  phaseAfterStart = $phaseAfterStart
  invalidLieIndexRejected = ($entryCountAfterInvalid -eq 0)
  firstValidEntryPersisted = ($entryCountAfterFirstValid -eq 1)
  duplicateEntryRejected = ($entryCountAfterDuplicate -eq 1)
  secondParticipantEntryPersisted = ($entryCountAfterSecondParticipant -eq 2)
  phaseAfterClose = $phaseAfterClose
  selfGuessRejected = ($guessCountAfterSelfGuess -eq 0)
  selfGuessMessage = Get-KnownMessage $selfGuessResponse.Content
  entryIdA = $entryIdA
  entryIdB = $entryIdB
  guessCountAfterFirstVote = $guessCountAfterFirstVote
  firstVoteMessage = Get-KnownMessage $firstVoteResponse.Content
  firstVotePersisted = ($guessCountAfterFirstVote -eq 1)
  duplicateGuessRejected = ($guessCountAfterDuplicateVote -eq 1)
  duplicateVoteMessage = Get-KnownMessage $duplicateVoteResponse.Content
} | Format-List *
