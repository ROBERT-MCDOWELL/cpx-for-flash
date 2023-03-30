<?php
header("Cross-Origin-Opener-Policy: same-origin");
header("Cross-Origin-Embedder-Policy: require-corp");
header("cross-origin-resource-policy: cross-origin");


?>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>CheerpX - Flash Demo</title>
    <script src="pp.js" crossorigin></script>
    <script>
      window.onload = (event) => {
        ppInit();
      };
    </script>
  </head>

  <body>
    <embed src="/creator1_b02.swf" width="600" height="600" crossorigin />
  </body>
</html>