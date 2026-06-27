const https = require('https');
https.get('https://www.clubawale.com/post/comment-jouer-le-songo', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const text = data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                     .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s+/g, ' ');
    const start = text.indexOf('La mécanique du jeu');
    const end = text.indexOf('Fin de la partie');
    console.log(text.substring(start, end + 500));
  });
});
