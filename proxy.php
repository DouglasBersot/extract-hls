<?php
// proxy.php
if (!isset($_GET['url'])) {
    header("HTTP/1.1 400 Bad Request");
    echo "URL não informada";
    exit;
}

$url = $_GET['url'];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

// Envia headers importantes para evitar bloqueios
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept: */*',
    'Referer: https://c1z39.com/',
]);

$content = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($httpCode !== 200 || !$content) {
    header("HTTP/1.1 $httpCode");
    echo "Erro ao acessar conteúdo.";
    exit;
}

header("Content-Type: $contentType");
header("Access-Control-Allow-Origin: *");
echo $content;
