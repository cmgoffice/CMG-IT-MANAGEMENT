param(
  [string]$SourceDirectory = 'Z:\Workshop Data\05.IT\0.ISO\License',
  [string]$OutputDirectory = 'D:\jutirat\CMG-IT-MANAGEMENT\public\license-data'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-CellText {
  param(
    $Worksheet,
    [int]$Row,
    [int]$Column
  )

  $text = [string]$Worksheet.Cells.Item($Row, $Column).Text
  return ($text -replace '\r|\n', ' ').Trim()
}

function Get-MeaningfulColumns {
  param(
    $Worksheet,
    [int]$RowCount,
    [int]$ColumnCount
  )

  $columns = New-Object System.Collections.Generic.List[int]
  for ($column = 1; $column -le $ColumnCount; $column++) {
    $hasValue = $false
    for ($row = 1; $row -le [Math]::Min($RowCount, 15); $row++) {
      if ((Get-CellText -Worksheet $Worksheet -Row $row -Column $column) -ne '') {
        $hasValue = $true
        break
      }
    }

    if ($hasValue) {
      $columns.Add($column)
    }
  }

  return $columns
}

function Get-HeaderRowIndex {
  param(
    $Worksheet,
    [int]$RowCount,
    [System.Collections.Generic.List[int]]$MeaningfulColumns
  )

  $scanLimit = [Math]::Min(15, $RowCount)
  for ($row = 1; $row -le $scanLimit; $row++) {
    foreach ($column in $MeaningfulColumns) {
      if ((Get-CellText -Worksheet $Worksheet -Row $row -Column $column) -eq 'ลำดับ') {
        return $row
      }
    }
  }

  $bestRow = 1
  $bestCount = -1
  for ($row = 1; $row -le $scanLimit; $row++) {
    $count = 0
    foreach ($column in $MeaningfulColumns) {
      if ((Get-CellText -Worksheet $Worksheet -Row $row -Column $column) -ne '') {
        $count++
      }
    }

    if ($count -gt $bestCount) {
      $bestCount = $count
      $bestRow = $row
    }
  }

  return $bestRow
}

function Get-HeaderLabel {
  param(
    $Worksheet,
    [int]$HeaderRow,
    [int]$Column,
    [int]$FallbackIndex
  )

  $headerText = Get-CellText -Worksheet $Worksheet -Row $HeaderRow -Column $Column
  if ($headerText -ne '') {
    return $headerText
  }

  for ($row = ($HeaderRow - 1); $row -ge 1; $row--) {
    $candidate = Get-CellText -Worksheet $Worksheet -Row $row -Column $Column
    if ($candidate -ne '') {
      return $candidate
    }
  }

  return "Column $FallbackIndex"
}

function Is-SensitiveHeader {
  param(
    [string]$Header,
    [string]$WorksheetName = ''
  )

  $value = $Header.Trim().ToLower()
  if ($value -eq '') { return $false }

  if ($WorksheetName -eq 'AutoCAD Revit LT Suite (2)' -and $value -match 'subscription id|contract') {
    return $false
  }

  return $value -match 'serial|authorization|support number|license-key|admin share user|เมล|e-mail|email|subscription id|contract'
}

function Mask-SensitiveValue {
  param([string]$Value)

  if ($Value -match '^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$') {
    return ('*' * ([Math]::Max(0, $Value.Length - 4))) + $Value.Substring($Value.Length - 4)
  }

  if ($Value -match '^[A-Z]{2,}-\d{5,}$') {
    return $Value.Substring(0, [Math]::Min(4, $Value.Length)) + '***'
  }

  if ($Value -match '^[^@\s]+@[^@\s]+\.[^@\s]+$') {
    $parts = $Value.Split('@', 2)
    $local = $parts[0]
    $domain = $parts[1]
    $visible = if ($local.Length -ge 2) { $local.Substring(0, 2) } else { $local.Substring(0, 1) }
    return $visible + '***@' + $domain
  }

  return $Value
}

function Mask-ValueByHeader {
  param(
    [string]$WorksheetName,
    [string]$Header,
    [string]$Value
  )

  $normalizedHeader = $Header.Trim().ToLower()
  if ($Value -eq '') {
    return $Value
  }

  if ($WorksheetName -eq 'AutoCAD Revit LT Suite (2)') {
    return $Value
  }

  if ($normalizedHeader -match 'contract|subscription id') {
    if ($Value.Length -le 4) {
      return ('*' * $Value.Length)
    }
    return ('*' * ($Value.Length - 4)) + $Value.Substring($Value.Length - 4)
  }

  if ($normalizedHeader -match '^tel\.?$|phone') {
    $digits = ($Value -replace '\D', '')
    if ($digits.Length -ge 4) {
      return $Value.Substring(0, [Math]::Min(4, $Value.Length)) + '***' + $Value.Substring([Math]::Max(0, $Value.Length - 4))
    }
  }

  return (Mask-SensitiveValue -Value $Value)
}

function Convert-WorksheetToData {
  param(
    $Worksheet,
    [int]$HeaderRowOverride = 0
  )

  $usedRange = $Worksheet.UsedRange
  $rowCount = [int]$usedRange.Rows.Count
  $columnCount = [int]$usedRange.Columns.Count
  $meaningfulColumns = Get-MeaningfulColumns -Worksheet $Worksheet -RowCount $rowCount -ColumnCount $columnCount
  $headerRow = if ($HeaderRowOverride -gt 0) {
    $HeaderRowOverride
  } else {
    Get-HeaderRowIndex -Worksheet $Worksheet -RowCount $rowCount -MeaningfulColumns $meaningfulColumns
  }

  $prefaceRows = New-Object System.Collections.Generic.List[object]
  for ($row = 1; $row -lt $headerRow; $row++) {
    $values = New-Object System.Collections.Generic.List[string]
    foreach ($column in $meaningfulColumns) {
      $values.Add((Get-CellText -Worksheet $Worksheet -Row $row -Column $column))
    }

    $nonEmpty = @($values | Where-Object { $_ -ne '' })
    if ($nonEmpty.Count -gt 0) {
      $prefaceRows.Add(@($values))
    }
  }

  $selectedColumns = New-Object System.Collections.Generic.List[object]
  $headers = New-Object System.Collections.Generic.List[string]
  if ($Worksheet.Name -eq 'AutoCAD Revit LT Suite (2)') {
    foreach ($column in 1..13) {
      $headerText = Get-HeaderLabel -Worksheet $Worksheet -HeaderRow $headerRow -Column $column -FallbackIndex $column
      $selectedColumns.Add([PSCustomObject]@{
        Column = $column
        Header = $headerText
      })
      $headers.Add($headerText)
    }
  }

  if ($selectedColumns.Count -eq 0) {
    $headerIndex = 1
    foreach ($column in $meaningfulColumns) {
      $headerText = Get-HeaderLabel -Worksheet $Worksheet -HeaderRow $headerRow -Column $column -FallbackIndex $headerIndex

      if (-not (Is-SensitiveHeader -Header $headerText -WorksheetName $Worksheet.Name)) {
        $selectedColumns.Add([PSCustomObject]@{
          Column = $column
          Header = $headerText
        })
        $headers.Add($headerText)
      }

      $headerIndex++
    }
  }

  $rows = New-Object System.Collections.Generic.List[object]
  for ($row = ($headerRow + 1); $row -le $rowCount; $row++) {
    $values = New-Object System.Collections.Generic.List[string]
    foreach ($columnConfig in $selectedColumns) {
      $rawValue = Get-CellText -Worksheet $Worksheet -Row $row -Column $columnConfig.Column
      $values.Add((Mask-ValueByHeader -WorksheetName $Worksheet.Name -Header $columnConfig.Header -Value $rawValue))
    }

    $nonEmpty = @($values | Where-Object { $_ -ne '' })
    if ($nonEmpty.Count -eq 0) {
      continue
    }

    $rows.Add([PSCustomObject]@{
      values = @($values)
    })
  }

  return [PSCustomObject]@{
    name = $Worksheet.Name
    headerRow = $headerRow
    prefaceRows = $prefaceRows.ToArray()
    headers = $headers.ToArray()
    rows = $rows.ToArray()
  }
}

function Export-WorkbookToJson {
  param(
    [string]$WorkbookPath,
    [string]$OutputPath
  )

  $excel = New-Object -ComObject Excel.Application
  $workbook = $null
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  try {
    $workbook = $excel.Workbooks.Open($WorkbookPath)
    $workbookFileName = [System.IO.Path]::GetFileName($WorkbookPath)
    $sheets = foreach ($worksheet in $workbook.Worksheets) {
      $headerRowOverride = 0
      if ($workbookFileName -like '*Office 365*' -and $worksheet.Name -eq 'Office365') {
        $headerRowOverride = 3
      } elseif ($workbookFileName -like 'License Software iso*' -and $worksheet.Name -eq 'License') {
        $headerRowOverride = 2
      }

      Convert-WorksheetToData -Worksheet $worksheet -HeaderRowOverride $headerRowOverride
    }

    $payload = [PSCustomObject]@{
      sourceFileName = [System.IO.Path]::GetFileName($WorkbookPath)
      sourceLastWriteTime = (Get-Item $WorkbookPath).LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')
      syncedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
      sheets = @($sheets)
    }

    $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  }
  finally {
    if ($null -ne $workbook) {
      $workbook.Close($false)
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) | Out-Null
    }

    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}

function Resolve-WorkbookPath {
  param(
    [string]$DirectoryPath,
    [string]$Pattern
  )

  $file = Get-ChildItem -LiteralPath $DirectoryPath -File | Where-Object { $_.Name -like $Pattern } | Select-Object -First 1
  if ($null -eq $file) {
    throw "Workbook matching pattern '$Pattern' was not found in '$DirectoryPath'."
  }

  return $file.FullName
}

$licenseWorkbookPath = Resolve-WorkbookPath -DirectoryPath $SourceDirectory -Pattern 'License Software iso*.xlsx'
$officeWorkbookPath = Resolve-WorkbookPath -DirectoryPath $SourceDirectory -Pattern '*Office 365*CMG*.xlsx'

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
Export-WorkbookToJson -WorkbookPath $licenseWorkbookPath -OutputPath (Join-Path $OutputDirectory 'license-software-iso.json')
Export-WorkbookToJson -WorkbookPath $officeWorkbookPath -OutputPath (Join-Path $OutputDirectory 'office365-cmg.json')
