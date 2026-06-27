const https = require('https');
https.get('https://www.clubawale.com/post/comment-jouer-le-songo', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const text = data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    console.log(text.substring(text.indexOf('La mécanique du jeu'), text.indexOf('Fin de la partie') + 1000));
  });
});
