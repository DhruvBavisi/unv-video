import codenamesWords from './words.js';

export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateCodenamesBoard(startingTeam) {
  const shuffledWords = shuffle(codenamesWords);
  const selectedWords = shuffledWords.slice(0, 25);
  
  const categories = [];
  
  const numRed = startingTeam === 'red' ? 9 : 8;
  const numBlue = startingTeam === 'blue' ? 9 : 8;
  const numAssassin = 1;
  const numNeutral = 7;
  
  for (let i = 0; i < numRed; i++) categories.push('red');
  for (let i = 0; i < numBlue; i++) categories.push('blue');
  for (let i = 0; i < numAssassin; i++) categories.push('assassin');
  for (let i = 0; i < numNeutral; i++) categories.push('neutral');
  
  const shuffledCategories = shuffle(categories);
  
  const board = selectedWords.map((word, index) => ({
    id: index.toString(),
    word: word,
    category: shuffledCategories[index],
    revealed: false
  }));
  
  return board;
}
