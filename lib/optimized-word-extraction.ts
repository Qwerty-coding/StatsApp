export const englishStopWords = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "might", "more", "most", "must", "my", "myself", "no", "nor", "not", "of", "off", "on",
  "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
  "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
  "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
  "why", "with", "would", "you", "your", "yours", "yourself", "yourselves", "message", "edited",
  "omitted", "deleted", "image", "audio", "video", "media"
]);

export const hinglishStopWords = new Set([
  "yaar", "bhai", "bro", "dost", "buddy", "haan", "naa", "na", "arre", "oye", "oi",
  "kya", "kaun", "kab", "kahan", "kaise", "kitna", "kitni", "konsa", "konsi", "kyun",
  "par", "toh", "bas", "hi", "re", "le", "de", "lo", "ho", "karo", "karte", "karenge", 
  "karle", "karlena", "karde", "kar", "karti", "karega", "tha", "the", "hai", "hain", 
  "hoga", "honge", "hogi", "raha", "rahi", "rahe", "raho", "bol", "bolo", "bola", 
  "bolte", "bolenge", "sun", "suno", "suna", "sunenge", "dekh", "dekho", "dekha", 
  "diya", "diye", "denge", "aao", "aaye", "aata", "aate", "aayenge", "gaya", "gaye", 
  "jayenge", "mein", "main", "tum", "tu", "vo", "voh", "wo", "woh", "ye", "yeh", 
  "mujhe", "mujhko", "tujhe", "use", "uske", "uska", "inhe", "inka", "unhe", "unka",
  "mera", "tera", "iska", "hamara", "tumhara", "ek", "do", "teen", "char", "paach",
  "aaj", "kal", "subah", "shaam", "raat", "din", "waqt", "time", "hehe", "haha", 
  "lol", "lmao", "rofl", "xd", "ok", "okay", "yeah", "yup", "nope", "yess", "bhi"
]);

export const commonIndianNames = new Set([
  // Cleaned list of actual common names, not dictionary words
  "aditya", "vikash", "arjun", "rohan", "rahul", "nikhil", "ankur", "ajay", "ashish",
  "bhavesh", "chirag", "deepak", "dhruv", "gaurav", "harish", "harshit", "ishaan", 
  "jatin", "karan", "kartik", "kunal", "manoj", "manish", "naveen", "nitin", "omkar", 
  "pankaj", "pranav", "prateek", "raj", "rajesh", "rakesh", "ramesh", "ranveer", "ravi", 
  "rishi", "rohit", "sachin", "sahil", "sameer", "sandeep", "sanjay", "saurabh",
  "priya", "pooja", "anjali", "anjana", "ananya", "amrita", "amita", "amina", "aisha", 
  "alisha", "sharma", "singh", "kumar", "patel", "gupta", "verma", "mishra", "rao", 
  "reddy", "khan", "malik", "shah", "desai", "iyer", "nair", "menon", "das", "sen", "roy"
]);

export function extractAndFilterWords(messages: any[], config: any = {}) {
  const {
    minFrequency = 3,
    minUniqueUsers = 2,
    minLength = 3,
    maxLength = 50,
    includeNumbers = false,
    excludeNames = true,
    customStopWords = new Set(),
  } = config;

  const allStopWords = new Set([
    ...englishStopWords,
    ...hinglishStopWords,
    ...customStopWords,
  ]);

  if (excludeNames) {
    commonIndianNames.forEach(word => allStopWords.add(word));
  }

  const wordFrequency = new Map();
  const wordUsers = new Map();

  for (const msg of messages) {
    if (msg.isSystem || !msg.text) continue;

    const words = msg.text.split(/[\s\n\t(),;:"'!?.—–\-<>\[\]{}*]+/).filter((w: string) => w.length > 0);
    const uniqueWords = new Set<string>();

    for (let rawWord of words) {
      const word = rawWord.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      
      if (!word) continue;
      uniqueWords.add(word);
    }

    for (const word of uniqueWords) {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
      if (!wordUsers.has(word)) wordUsers.set(word, new Set());
      wordUsers.get(word).add(msg.sender);
    }
  }

  const finalWords = new Map();
  for (const [word, freq] of wordFrequency) {
    if (allStopWords.has(word)) continue;
    if (freq < minFrequency) continue;
    if ((wordUsers.get(word)?.size || 0) < minUniqueUsers) continue;
    if (word.length < minLength || word.length > maxLength) continue;
    if (!includeNumbers && /^\d+$/.test(word)) continue;
    if (/(.)\1{4,}/.test(word)) continue; // Spam repeating letters
    if (!/[a-z0-9]+/i.test(word)) continue; // Special chars only
    if (/^(http|www|\.com|\.org)/.test(word)) continue; // Links

    finalWords.set(word, freq);
  }

  const sorted = Array.from(finalWords.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word, freq]) => ({ word, frequency: freq }));

  return { words: sorted };
}