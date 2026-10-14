param([ValidateSet('dev','production')][string]$Mode='dev')
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
$nodePath=if($nodeCommand){$nodeCommand.Source}else{'C:\Users\pc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}
if(!(Test-Path -LiteralPath $nodePath)){throw '需要安装 Node.js 22.13 或更高版本'}
if($Mode -eq 'production'){
  if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist/index.html'))){throw '请先构建项目'}
  & $nodePath (Join-Path $PSScriptRoot 'server/index.mjs')
}else{
  $vitePath=Join-Path $PSScriptRoot 'node_modules/vite/bin/vite.js'
  if(!(Test-Path -LiteralPath $vitePath)){throw '请先安装项目依赖'}
  & $nodePath $vitePath --host 127.0.0.1 --port 5174 --strictPort
}
