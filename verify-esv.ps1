# PowerShell script to verify ESV and print full api.bible response

# Replace with your actual api.bible API key or leave to prompt
$apiKey = "f44e5b2eed5f1d2ef29f4f6443b7bed2"

# Check if API key is set
if (-not $apiKey -or $apiKey -eq "YOUR_API_KEY_HERE") {
    $apiKey = Read-Host "Please enter your api.bible API key"
    if (-not $apiKey) {
        Write-Error "No API key provided. Exiting."
        exit 1
    }
}

# Correct api.bible endpoint
$url = "https://api.scripture.api.bible/v1/bibles"

# Headers with API key
$headers = @{
    "api-key" = $apiKey
}

# Set a timeout (15 seconds)
$timeoutSeconds = 15

Write-Host "Attempting to connect to $url..." -ForegroundColor Cyan

try {
    # Use WebRequest for timeout control
    $request = [System.Net.HttpWebRequest]::Create($url)
    $request.Method = "GET"
    $request.Headers.Add("api-key", $apiKey)
    $request.Timeout = $timeoutSeconds * 1000  # Convert to milliseconds

    Write-Host "Sending request..." -ForegroundColor Cyan
    $response = $request.GetResponse()

    # Read the response
    $stream = $response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $jsonResponse = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    $response.Close()

    Write-Host "Response received. Full JSON output:" -ForegroundColor Green
    Write-Host $jsonResponse -ForegroundColor Yellow

    # Parse JSON for analysis
    $data = $jsonResponse | ConvertFrom-Json

    # Filter for ESV
    $esvBible = $data.data | Where-Object { $_.abbreviation -eq "ESV" -or $_.name -like "*English Standard Version*" }

    if ($esvBible) {
        Write-Host "ESV Bible found on api.bible!" -ForegroundColor Green
        Write-Host "Bible Key (ID): $($esvBible.id)"
        Write-Host "Name: $($esvBible.name)"
        Write-Host "Description: $($esvBible.description)"
        Write-Host "Language: $($esvBible.language.name)"
    }
    else {
        Write-Warning "ESV Bible not found in the response. Your API key may not have access."
        Write-Host "Available Bibles count: $($data.data.Count)"
        Write-Host "Listing available Bible abbreviations and names:" -ForegroundColor Cyan
        $data.data | ForEach-Object {
            Write-Host "ID: $($_.id), Abbreviation: $($_.abbreviation), Name: $($_.name)"
        }
    }
}
catch {
    Write-Error "Request failed: $($_.Exception.Message)"
    if ($_.Exception.InnerException) {
        Write-Host "Inner Exception: $($_.Exception.InnerException.Message)" -ForegroundColor Red
    }
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error Response: $errorBody" -ForegroundColor Red
    }
    Write-Host "Check your API key, network, or try again later."
}