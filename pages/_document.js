import { Head, Html, Main, NextScript } from 'next/document';

// Fonts live here rather than in _app so they are requested once for the whole
// site instead of per page. Syne carries the display voice, Outfit the UI, and
// DM Mono every piece of passport data — team codes, field labels, scores.
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Outfit:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
