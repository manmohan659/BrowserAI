// Some of this code is from https://github.com/hexgrad/kokoro/
import { phonemize as espeakng } from "phonemizer";

  /**
   * Helper function to split a string on a regex, but keep the delimiters.
   * This is required, because the JavaScript `.split()` method does not keep the delimiters,
   * and wrapping in a capturing group causes issues with existing capturing groups (due to nesting).
   * @param {string} text The text to split.
   * @param {RegExp} regex The regex to split on.
   * @returns {{match: boolean; text: string}[]} The split string.
   */
  function split(text: string, regex: RegExp) {
    const result = [];
    let prev = 0;
    for (const match of text.matchAll(regex)) {
      const fullMatch = match[0];
      if (prev < match.index) {
        result.push({ match: false, text: text.slice(prev, match.index) });
      }
      if (fullMatch.length > 0) {
        result.push({ match: true, text: fullMatch });
      }
      prev = match.index + fullMatch.length;
    }
    if (prev < text.length) {
      result.push({ match: false, text: text.slice(prev) });
    }
    return result;
  }

  /**
   * Helper function to split numbers into phonetic equivalents
   * @param {string} match The matched number
   * @returns {string} The phonetic equivalent
   */
  function split_num(match: string) {
    if (match.includes(".")) {
      return match;
    } else if (match.includes(":")) {
      let [h, m] = match.split(":").map(Number);
      if (m === 0) {
        return `${h} o'clock`;
      } else if (m < 10) {
        return `${h} oh ${m}`;
      }
      return `${h} ${m}`;
    }
    let year = parseInt(match.slice(0, 4), 10);
    if (year < 1100 || year % 1000 < 10) {
      return match;
    }
    let left = match.slice(0, 2);
    let right = parseInt(match.slice(2, 4), 10);
    let suffix = match.endsWith("s") ? "s" : "";
    if (year % 1000 >= 100 && year % 1000 <= 999) {
      if (right === 0) {
        return `${left} hundred${suffix}`;
      } else if (right < 10) {
        return `${left} oh ${right}${suffix}`;
      }
    }
    return `${left} ${right}${suffix}`;
  }

  /**
   * Helper function to format monetary values
   * @param {string} match The matched currency
   * @returns {string} The formatted currency
   */
  function flip_money(match: string) {
    const bill = match[0] === "$" ? "dollar" : "pound";
    if (isNaN(Number(match.slice(1)))) {
      return `${match.slice(1)} ${bill}s`;
    } else if (!match.includes(".")) {
      let suffix = match.slice(1) === "1" ? "" : "s";
      return `${match.slice(1)} ${bill}${suffix}`;
    }
    const [b, c] = match.slice(1).split(".");
    const d = parseInt(c.padEnd(2, "0"), 10);
    let coins = match[0] === "$" ? (d === 1 ? "cent" : "cents") : d === 1 ? "penny" : "pence";
    return `${b} ${bill}${b === "1" ? "" : "s"} and ${d} ${coins}`;
  }

  /**
   * Helper function to process decimal numbers
   * @param {string} match The matched number
   * @returns {string} The formatted number
   */
  function point_num(match: string) {
    let [a, b] = match.split(".");
    return `${a} point ${b.split("").join(" ")}`;
  }

  /**
   * Normalize text for phonemization
   * @param {string} text The text to normalize
   * @returns {string} The normalized text
   */
  function normalize_text(text: string) {
    return (
      text
        // 1. Handle quotes and brackets
        .replace(/[‘’]/g, "'")
        .replace(/«/g, "“")
        .replace(/»/g, "”")
        .replace(/[“”]/g, '"')
        .replace(/\(/g, "«")
        .replace(/\)/g, "»")

        // 2. Replace uncommon punctuation marks
        .replace(/、/g, ", ")
        .replace(/。/g, ". ")
        .replace(/！/g, "! ")
        .replace(/，/g, ", ")
        .replace(/：/g, ": ")
        .replace(/；/g, "; ")
        .replace(/？/g, "? ")

        // 3. Whitespace normalization
        .replace(/[^\S \n]/g, " ")
        .replace(/  +/, " ")
        .replace(/(?<=\n) +(?=\n)/g, "")

        // 4. Abbreviations
        .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
        .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
        .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
        .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
        .replace(/\betc\.(?! [A-Z])/gi, "etc")

        // 5. Normalize casual words
        .replace(/\b(y)eah?\b/gi, "$1e'a")

        // 5. Handle numbers and currencies
        .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, split_num)
        .replace(/(?<=\d),(?=\d)/g, "")
        .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, flip_money)
        .replace(/\d*\.\d+/g, point_num)
        .replace(/(?<=\d)-(?=\d)/g, " to ")
        .replace(/(?<=\d)S/g, " S")

        // 6. Handle possessives
        .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
        .replace(/(?<=X')S\b/g, "s")

        // 7. Handle hyphenated words/letters
        .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-"))
        .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")

        // 8. Strip leading and trailing whitespace
        .trim()
    );
  }

  /**
   * Escapes regular expression special characters from a string by replacing them with their escaped counterparts.
   *
   * @param {string} string The string to escape.
   * @returns {string} The escaped string.
   */
  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
  }

  const PUNCTUATION = ';:,.!?¡¿—…"«»“”(){}[]';
  const PUNCTUATION_PATTERN = new RegExp(`(\\s*[${escapeRegExp(PUNCTUATION)}]+\\s*)+`, "g");

  const HINDI_PHONEME_MAP: { [key: string]: string } = {
    // Vowels - Updated to be more accurate and broadly understood
    'अ': 'a',      // a
    'आ': 'aː',     // Long 'a'
    'इ': 'e',      // Lax 'i'
    'ई': 'eː',     // Long 'i'
    'उ': 'ʊ',      // Lax 'u'
    'ऊ': 'uː',     // Long 'u'
    'ऋ': 'ri',    // 'ri' sound (often pronounced like this) -  Could also be ɾɪ
    'ए': 'eː',     // Long 'e'
    'ऐ': 'ɛ',      // Diphthong/Monophthong 'ai' - More accurately [ɛ] or [æ] in many dialects
    'ओ': 'oː',     // Long 'o'
    'औ': 'ɔ',      // Diphthong/Monophthong 'au' - More accurately [ɔ] or [ɒ] in many dialects
    'ऍ': 'æ',      // Open 'e' sound (like in 'cat') - Borrowed sound
    'ऑ': 'ɒ',      // Open 'o' sound (like in 'caught') - Borrowed sound

    // Consonants - Updated for broader IPA understanding (using alveolar series where applicable)
    'क': 'k',      // Voiceless velar stop
    'ख': 'kʰ',     // Aspirated voiceless velar stop
    'ग': 'g',      // Voiced velar stop
    'घ': 'gʰ',     // Aspirated voiced velar stop
    'ङ': 'ŋ',      // Velar nasal
    'च': 'tʃ',     // Voiceless postalveolar affricate
    'छ': 'tʃʰ',    // Aspirated voiceless postalveolar affricate
    'ज': 'dʒ',     // Voiced postalveolar affricate
    'झ': 'dʒʰ',    // Aspirated voiced postalveolar affricate
    'ञ': 'ɲ',      // Palatal nasal
    'ट': 'ʈ',      // Voiceless retroflex stop
    'ठ': 'ʈʰ',     // Aspirated voiceless retroflex stop
    'ड': 'ɖ',      // Voiced retroflex stop
    'ढ': 'ɖʰ',     // Aspirated voiced retroflex stop
    'ण': 'ɳ',      // Retroflex nasal
    'त': 't',      // Voiceless alveolar stop (Technically dental [t̪])
    'थ': 'tʰ',     // Aspirated voiceless alveolar stop (Technically dental [t̪ʰ])
    'द': 'd',      // Voiced alveolar stop (Technically dental [d̪])
    'ध': 'dʰ',     // Aspirated voiced alveolar stop (Technically dental [d̪ʰ])
    'न': 'n',      // Alveolar nasal (Technically dental [n̪])
    'प': 'p',      // Voiceless bilabial stop
    'फ': 'pʰ',     // Aspirated voiceless bilabial stop
    'ब': 'b',      // Voiced bilabial stop
    'भ': 'bʰ',     // Aspirated voiced bilabial stop
    'म': 'm',      // Bilabial nasal
    'य': 'j',      // Palatal approximant
    'र': 'r',      // Alveolar trill or flap
    'ल': 'l',      // Alveolar lateral approximant
    'व': 'w',      // Bilabial approximant (More common pronunciation, technically could be labiodental [ʋ])
    'श': 'ʃ',      // Postalveolar voiceless fricative (Often used, but 'ष' is retroflex [ʂ])
    'ष': 'ʂ',      // Retroflex voiceless fricative (More accurate for 'ष')
    'स': 's',      // Alveolar voiceless fricative (Technically dental [s̪])
    'ह': 'h',      // Voiceless glottal fricative (Simpler and common, could be breathy voiced [ɦ])

    // Matras (Vowel Marks) - Updated to match vowel changes
    'ा': 'aː',     // aa matra
    'ि': 'ɪ',      // i matra
    'ी': 'iː',     // ee matra
    'ु': 'ʊ',      // u matra
    'ू': 'uː',     // oo matra
    'ृ': 'ri',    // ri matra - Could also be ɾɪ
    'े': 'eː',     // e matra
    'ै': 'ɛ',      // ai matra
    'ो': 'oː',     // o matra
    'ौ': 'ɔ',      // au matra
    'ं': 'n',      // Anusvara - Simplified to 'n' for general nasal consonant (See notes below)
    'ः': 'h',      // Visarga
    '्': '',       // Halant/Virama - Removes inherent vowel

    // Nukta variations - Generally correct
    'क़': 'q',      // Uvular stop
    'ख़': 'x',      // Voiceless velar fricative
    'ग़': 'ɣ',      // Voiced velar fricative
    'ज़': 'z',      // Voiced alveolar fricative
    'ड़': 'ɽ',      // Retroflex flap
    'ढ़': 'ɽʰ',     // Aspirated retroflex flap
    'फ़': 'f',      // Labiodental fricative
  };

  // Add function to detect script
  // function isDevanagari(text: string): boolean {
  //   return /[\u0900-\u097F]/.test(text);
  // }

  // Add Spanish phoneme detection
  // function isSpanish(text: string): boolean {
  //   return /[áéíóúñ¿¡]|ll|ñ/i.test(text);
  // }

  // Add Spanish phoneme mappings
  const SPANISH_PHONEME_MAP: { [key: string]: string } = {
    // Vowels
    'a': 'a',
    'á': 'ˈa',
    'e': 'e',
    'é': 'ˈe',
    'i': 'i',
    'í': 'ˈi',
    'o': 'o',
    'ó': 'ˈo',
    'u': 'u',
    'ú': 'ˈu',
    'ü': 'u',

    // Consonants
    'b': 'b',
    'v': 'β',
    'c': 'k',
    'ch': 'tʃ',
    'd': 'ð',
    'f': 'f',
    'g': 'ɡ',
    'h': '',  // silent in Spanish
    'j': 'x',
    'k': 'k',
    'l': 'l',
    'll': 'j',
    'm': 'm',
    'n': 'n',
    'ñ': 'ɲ',
    'p': 'p',
    'q': 'k',
    'r': 'ɾ',
    'rr': 'r',
    's': 's',
    't': 't',
    'w': 'w',
    'x': 'ks',
    'y': 'ʝ',
    'z': 'θ'  // for European Spanish
  };

  function isHinglish(text: string): boolean {
    // Force treat as Hinglish if selectedVoice starts with h (Hindi voice)
    if (text.startsWith('hf_') || text.startsWith('hm_')) {
      return true;
    }
    
    // Common Hinglish words and patterns - expanded for better detection
    const hinglishPatterns = [
      // Common pronouns and demonstratives
      /\b(aap|tum|hum|main|mein|ham|yeh|woh|kya|kaun|kaise|kyun|kab|kahan|yahan|wahan|mujhe|tumhe|humko|unko|apna|tumhara|hamara)\b/i,
      
      // Common verb forms and auxiliaries
      /\b(hai|hain|ho|hoga|tha|thi|thin|raha|rahe|rahi|rahin|sakta|sakti|sakte|chahiye|paega|paoge|paayi)\b/i,
      
      // Common postpositions
      /\b(ka|ke|ki|ko|se|par|mein|pe|tak|bina|saath|liye|waaste)\b/i,
      
      // Common adjectives and adverbs
      /\b(accha|theek|bahut|bohot|thoda|zyada|kam|jyada|saara|poora|adhik|kafi|itna|utna|aisa|waisa|kaisa)\b/i,
      
      // Forms of करना (to do) and other common verbs
      /\b(karo|karta|karti|karte|kia|kiya|kiye|karna|kar|karenge|karega|karegi)\b/i,
      /\b(bolo|bolta|bolti|bolte|bola|boli|bole|bolna|bol)\b/i,
      /\b(jao|jata|jati|jate|gaya|gayi|gaye|jana|ja)\b/i,
      /\b(aata|aati|aate|aaya|aayi|aaye|aana|aa)\b/i,
      /\b(khao|khata|khati|khate|khaya|khayi|khaye|khana|kha)\b/i,
      /\b(suno|sunta|sunti|sunte|suna|suni|sune|sunna|sun)\b/i,
      /\b(dekho|dekhta|dekhti|dekhte|dekha|dekhi|dekhe|dekhna|dekh)\b/i,
      /\b(samjho|samajhta|samajhti|samajhte|samjha|samjhi|samjhe|samajhna|samajh)\b/i,
      
      // Greetings and common phrases
      /\b(namaste|namaskar|dhanyavad|shukriya|kripya|swagat|alvida)\b/i
    ];
    
    // Check for patterns that are strong indicators of Hinglish
    for (const pattern of hinglishPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    // Look for common Hindi word endings
    const hindiEndingPattern = /\b\w+(iye|ogi|ega|enge|engi|ogi|oga|egi|enga|engi|unga|ungi)\b/i;
    if (hindiEndingPattern.test(text)) {
      return true;
    }
    
    // Check for sentences that are likely to be Hinglish
    // Common Hindi sentence structures
    const commonSentences = [
      /aap k(ya|i|e) (kar|ho|hai)/i,
      /kya (ho raha|chal raha|hua)/i,
      /\b(theek|accha) hai\b/i,
      /kaise ho/i,
      /\b(namaste|namaskar)\b/i,
      /\bmera naam\b/i,
      /\btumhara kya\b/i,
      /\bkahan (se|jaa)/i,
      /\bmain (chahta|chahti)\b/i,
      /\b(aaj|kal) (ki|ka|ke)\b/i
    ];
    
    for (const pattern of commonSentences) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    return false;
  }

  const HINGLISH_PHONEME_MAP: { [key: string]: string } = {
    // Vowels
    'a': 'ə',      // Short 'a' (schwa), inherent in Hindi consonants
    'aa': 'aː',    // Long 'a' (आ), as in "naam"
    'i': 'ɪ',      // Short 'i' (इ), as in "kitna"
    'ee': 'iː',    // Long 'i' (ई), as in "Vaishnavi" ending
    'u': 'ʊ',      // Short 'u' (उ), as in "tum"
    'oo': 'uː',    // Long 'u' (ऊ), as in "soona"
    'e': 'eː',     // Long 'e' (ए), as in "ek"
    'ai': 'ɛː',    // 'ai' (ऐ), as in "kaise"
    'o': 'oː',     // Long 'o' (ओ), as in "bolo"
    'au': 'ɔː',    // 'au' (औ), as in "mausam"
  
    // Common consonant patterns
    'kh': 'kʰ',    // Aspirated 'k' (ख), as in "khaana"
    'gh': 'gʰ',    // Aspirated 'g' (घ), as in "ghar"
    'ch': 'tʃ',    // 'ch' (च), as in "chalo"
    'jh': 'dʒʰ',   // Aspirated 'j' (झ), as in "jheel"
    'th': 't̪ʰ',   // Aspirated dental 't' (थ), as in "tha"
    'dh': 'd̪ʰ',   // Aspirated dental 'd' (ध), as in "dhan"
    'ph': 'pʰ',    // Aspirated 'p' (फ), as in "phool"
    'bh': 'bʰ',    // Aspirated 'b' (भ), as in "bhai"
    'sh': 'ʃ',     // 'sh' (श), as in "shaadi"
    'ng': 'ŋ',     // Nasal 'ng' (ङ्ग), as in "rang"
    'tt': 'ʈ',     // Retroflex 't' (ट), as in "theek"
    'dd': 'ɖ',     // Retroflex 'd' (ड), as in "ladka"
    'tth': 'ʈʰ',   // Aspirated retroflex 't' (ठ)
    'ddh': 'ɖʰ',   // Aspirated retroflex 'd' (ढ)
  
    // Special consonants
    'r': 'ɾ',      // Flapped 'r' (र), as in "raasta"
    'n': 'n̪',     // Dental 'n' (न), as in "naam"
    't': 't̪',     // Dental 't' (त), as in "tum"
    'd': 'd̪',     // Dental 'd' (द), as in "dena"
    'k': 'k',      // 'k' (क), as in "kar"
    'g': 'g',      // 'g' (ग), as in "gaya"
    'p': 'p',      // 'p' (प), as in "paani"
    'b': 'b',      // 'b' (ब), as in "bolo"
    'm': 'm',      // 'm' (म), as in "main"
    'y': 'j',      // 'y' (य), as in "yaad"
    'v': 'v',      // 'v' (व), as in "Vaishnavi"
    'w': 'v',      // 'w' mapped to 'v' (व), common in Hinglish
    'l': 'l',      // 'l' (ल), as in "ladka"
    's': 's',      // 's' (स), as in "suno"
    'h': 'h',      // 'h' (ह), as in "hai"
    'z': 'z',      // 'z' (ज़), as in "zindagi"
    'f': 'f',      // 'f' (फ़), as in "fark"
  };


function processHinglishText(text: string): string {
  // Expanded list of common Hinglish words with phonetic mappings
  const commonHinglishWords: { [key: string]: string } = {
    'aap': 'aːp',           // आप (you, formal)
    'tum': 't̪ʊm',         // तुम (you, informal)
    'main': 'mɛ̃',         // मैं (I)
    'mein': 'mẽ',          // में (in)
    'hum': 'hʊm',          // हम (we)
    'bolo': 'boːloː',      // बोलो (speak)
    'suno': 'sʊnoː',       // सुनो (listen)
    'ham': 'həm',          // Alternative spelling for हम
    'kya': 'kjɑː',         // क्या (what)
    'kaun': 'kɔːn',        // कौन (who)
    'kaise': 'kɛːse',      // कैसे (how)
    'kyun': 'kjũː',        // क्यों (why)
    'kab': 'kəb',          // कब (when)
    'kahan': 'kəhãː',      // कहाँ (where)
    'yahan': 'jəhãː',      // यहाँ (here)
    'wahan': 'vəhãː',      // वहाँ (there)
    'hai': 'hɛː',          // है (is)
    'hain': 'hɛ̃ː',        // हैं (are)
    'ho': 'hoː',           // हो (are/be)
    'kar': 'kər',          // कर (do)
    'rahe': 'rəhe',        // रहे (continuous action)
    'raha': 'rəhaː',       // रहा (was, masculine)
    'gaya': 'gəjaː',       // गया (went, masculine)
    'gayi': 'gəjiː',       // गई (went, feminine)
    'accha': 'ətʃʰaː',    // अच्छा (good)
    'theek': 'ʈʰiːk',     // ठीक (fine)
    'bahut': 'bəhʊt̪',    // बहुत (a lot)
    'namaste': 'nəməst̪e', // नमस्ते (hello)
    'namaskar': 'nəməskaːr', // नमस्कार (greetings)
    'dhanyavaad': 'd̪ʰənjəvaːd̪', // धन्यवाद (thank you)
    'ghar': 'gʰər',        // घर (house)
    'ladka': 'ləɖkaː',     // लड़का (boy)
    'kaam': 'kaːm',        // काम (work)
    'nahi': 'nəhiː',       // नहीं (no)
    'tha': 'tʰaː',         // था (was, masculine)
    'thi': 'tʰiː',         // थी (was, feminine)
    'the': 'tʰeː',         // थे (were)
    'jaan': 'dʒaːn',       // जान (life/soul)
    'pyaar': 'pjaːr',      // प्यार (love)
    'dost': 'doːst',       // दोस्त (friend)
    'khana': 'kʰaːnaː',    // खाना (food/to eat)
    'paani': 'paːniː',     // पानी (water)
    'bachcha': 'bətʃʰaː', // बच्चा (child)
    'raasta': 'raːstaː',   // रास्ता (path)
    'sapna': 'səpnaː',     // सपना (dream)
    'dil': 'dɪl',          // दिल (heart)
    'zindagi': 'zɪndəgiː', // ज़िंदगी (life)
    'samajh': 'səmədʒʰ',  // समझ (understanding)
    'baat': 'baːt',        // बात (talk)
    'waqt': 'vəqt',        // वक्त (time)
    'yaad': 'jaːd',        // याद (memory)
    'shaadi': 'ʃaːdiː',    // शादी (marriage)
    'khush': 'kʰʊʃ',      // खुश (happy)
    'milna': 'mɪlnaː',     // मिलना (to meet)
    'dekhna': 'deːkʰnaː', // देखना (to see)
    'sochna': 'soːtʃnaː',  // सोचना (to think)
    'jaanna': 'dʒaːnnaː', // जानना (to know)
    'lena': 'leːnaː',      // लेना (to take)
    'dena': 'deːnaː',      // देना (to give)
    'chalna': 'tʃəlnaː',   // चलना (to walk)
    'aana': 'aːnaː',       // आना (to come)
    'jaana': 'dʒaːnaː',   // जाना (to go)
    'peena': 'piːnaː',     // पीना (to drink)
    'sona': 'soːnaː',      // सोना (to sleep)
    'aaj': 'aːdʒ',         // आज (today)
    'kal': 'kəl',          // कल (yesterday/tomorrow)
    'abhi': 'əbʰiː',       // अभी (now)
    'sab': 'səb',          // सब (all)
    'kuch': 'kʊtʃ',       // कुछ (some)
    'thoda': 'tʰoːdaː',    // थोड़ा (little)
    'zyada': 'zjaːdaː'     // ज़्यादा (more)
  };

  const words = text.toLowerCase().split(/\s+/);
  return words.map(word => {
    if (commonHinglishWords[word]) {
      return commonHinglishWords[word];
    }

    let result = '';
    let i = 0;
    while (i < word.length) {
      // Check two-character patterns first
      if (i < word.length - 1) {
        const twoChars = word.substring(i, i + 2);
        if (HINGLISH_PHONEME_MAP[twoChars]) {
          result += HINGLISH_PHONEME_MAP[twoChars];
          i += 2;
          continue;
        }
      }

      // Handle single characters
      const char = word[i];
      result += HINGLISH_PHONEME_MAP[char] || char;
      i++;
    }

    // Post-process word for Hindi-specific rules
    // Lengthen final 'i' or 'e' to match Hindi pronunciation
    result = result.replace(/ɪ$/g, 'iː').replace(/e$/g, 'eː');
    // Remove schwa before final consonant if unintended
    result = result.replace(/ə([kgtɖd̪pbɾmn̪lsʃʈ])$/g, '$1');
    // Add nasalization for 'n' or 'm' at end if applicable
    result = result.replace(/[nm]$/, '̃');

    return result;
  }).join(' ');
} 

  // Add function to handle Hindi syllable structure
  function processHindiSyllable(text: string): string {
    return text
      // Handle consonant clusters with virama
      .replace(/([क-ह])्([क-ह])/g, (_, c1, c2) => {
        const p1 = HINDI_PHONEME_MAP[c1] || c1;
        const p2 = HINDI_PHONEME_MAP[c2] || c2;
        return p1 + p2;
      })
      // Handle inherent 'a' sound after consonants, but not at word end
      .replace(/([क-ह])(?![ािीुूृेैोौ्ंँः]|$)/g, (_, c) => {
        const phoneme = HINDI_PHONEME_MAP[c] || c;
        return phoneme + 'ə';
      })
      // Handle word-final consonants without schwa
      .replace(/([क-ह])$/g, (_, c) => HINDI_PHONEME_MAP[c] || c)
      // Handle nasalization
      .replace(/([aeiouəɛɔ])ं/g, '$1̃')
      .replace(/([aeiouəɛɔ])ँ/g, '$1̃');
  }

  function addHindiProsody(processed: string): string {
    // Add stress markers to Hindi words (typically on the first syllable)
    processed = processed.replace(/\b([bcdfghjklmnpqrstvwxyzɡɖʈʂʃɳŋɲ][aeiouəɛɔɪʊ])/g, 'ˈ$1');
    
    // Add rhythm patterns based on Hindi syllable structure
    processed = processed
      // Add slight lengthening to stressed vowels
      .replace(/ˈ([^aeiouəɛɔɪʊ]*)([aeiouəɛɔɪʊ])/g, 'ˈ$1$2ˑ')
      
      // Reduce the schwa in unstressed positions
      .replace(/([^ˈ])ə([^ˑ\s])/g, '$1ə̆$2')
      
      // Add proper boundary tones for statements (falling intonation)
      .replace(/([aeiouəɛɔɪʊ][^aeiouəɛɔɪʊ]*)$/g, '$1↘')
      
      // Add natural pauses after conjunctions
      .replace(/\b(ɔr|lekin|kjõki|agər|mɡər|ki)\b/g, '$1↱ ')
      
      // Add rising intonation for questions
      .replace(/([aeiouəɛɔɪʊ][^aeiouəɛɔɪʊ]*)\?/g, '$1↗?');
      
    // Clean up any double stress markers
    processed = processed.replace(/ˈ\s*ˈ/g, 'ˈ');
    
    // Adjust nasalization to be more natural
    processed = processed.replace(/([aeiouəɛɔɪʊ])̃/g, '$1̃ˑ');
    
    // Add proper phrasing based on commas and other punctuation
    processed = processed
      .replace(/,/g, '↱,')
      .replace(/;/g, '↱↱;')
      .replace(/\./g, '↘.');
    
    return processed;
  }
  
  /**
   * @deprecated Use phonemizeStream instead for more efficient streaming processing
   */
  export async function phonemize(text: string, language = "a", norm = true) {
    // Use phonemizeStream internally to ensure consistency
    // This collects all chunks from streaming implementation
    let result = '';
    for await (const chunk of phonemizeStream(text, language, norm)) {
      result += chunk;
    }
    return result.trim();
  }
    // Simple function to split text into processable chunks
  // Simple function to split text into processable chunks (Keep as is)
  function splitIntoChunks(text: string): string[] {
    // Split on sentence boundaries or significant pauses
    // Added comma to split shorter phrases for potentially better streaming flow
    return text
      .split(/(?<=[.!?])\s+|,\s*/) // Split on sentence ends AND commas
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  export async function* phonemizeStream(text: string, language = "a", norm = true): AsyncGenerator<string> {
    // 1. Normalize text (if requested) - Done once for the whole input
    const normalizedText = norm ? normalize_text(text) : text;

    // 2. Determine Target Language - Done once based on input param and full text
    const languageMap: { [key: string]: string } = {
      'a': 'en-us',  // American English
      'b': 'en',     // British English
      'h': 'hindi',  // Hindi
      'e': 'spanish', // Spanish
      'f': 'french', // French
      'z': 'chinese' // Chinese
    };

    let targetLanguage = languageMap[language] || 'en-us'; // Default to en-us

    // Special handling for Hindi - check Devanagari characters in the *entire* text
    const containsDevanagari = /[\u0900-\u097F]/.test(normalizedText);
    if (language === 'h' || containsDevanagari) {
      targetLanguage = 'hindi';
    }

    // Auto-detect Hinglish only if not explicitly Hindi/Devanagari and looks like English
    // Use the original full normalized text for better detection context
    if (targetLanguage !== 'hindi' && (targetLanguage === 'en-us' || targetLanguage === 'en')) {
      if (isHinglish(normalizedText)) { // Check the whole normalized text
        targetLanguage = 'hinglish';
      }
    }
    // Optionally log the determined language for debugging
    // console.log("PhonemizeStream determined language:", targetLanguage);

    // 3. Split into Chunks for Streaming
    const chunks = splitIntoChunks(normalizedText);

    // 4. Process each chunk
    for (const chunk of chunks) {
      // 4a. Split chunk by punctuation to preserve it during phonemization
      const sections = split(chunk, PUNCTUATION_PATTERN);

      // 4b. Convert each section within the chunk to phonemes based on targetLanguage
      const phonemeSections = await Promise.all(
        sections.map(async ({ match, text: sectionText }) => {
          if (match) return sectionText; // Keep punctuation as is

          // --- Apply language-specific processing ---
          switch (targetLanguage) {
            case 'hindi':
               // Check if this specific section contains Devanagari
              if (/[\u0900-\u097F]/.test(sectionText)) {
                // Process Devanagari script
                let devanagariProcessed = Array.from(sectionText)
                  .map(char => HINDI_PHONEME_MAP[char] || char) // Basic char map
                  .join('');
                devanagariProcessed = processHindiSyllable(devanagariProcessed); // Apply syllable rules
                devanagariProcessed = addHindiProsody(devanagariProcessed); // Apply prosody
                return devanagariProcessed;
              } else {
                // Process Hindi written in Latin script (Treat as Hinglish for processing)
                let hinglishProcessed = processHinglishText(sectionText);
                hinglishProcessed = addHindiProsody(hinglishProcessed); // Apply prosody
                return hinglishProcessed;
              }

            case 'hinglish':
              let hinglishProcessed = processHinglishText(sectionText);
              hinglishProcessed = addHindiProsody(hinglishProcessed); // Apply prosody
              return hinglishProcessed;

            case 'spanish':
              let spanishResult = sectionText.toLowerCase();
              spanishResult = spanishResult
                .replace(/ch/g, 'tʃ')
                .replace(/ll/g, 'j')
                .replace(/rr/g, 'r')
                .replace(/c([ie])/g, 's$1'); // Basic rules, adapt as needed

              return Array.from(spanishResult)
                .map(char => SPANISH_PHONEME_MAP[char] || char)
                .join('');

            default: // en-us or en (or any other lang relying on espeakng)
              try {
                // Use espeakng for English and other defaults
                // Map 'en-us' and 'en' explicitly if espeakng needs them
                const espeakLang = (targetLanguage === 'en-us' || targetLanguage === 'en') ? targetLanguage : 'en-us';
                return (await espeakng(sectionText, espeakLang)).join(" ");
              } catch (error) {
                console.error(`Error phonemizing chunk section "${sectionText}" with espeakng:`, error);
                return sectionText; // Fallback to original text section on error
              }
          }
        })
      );

      // 4c. Join the processed sections back together for the chunk
      let processedChunk = phonemeSections.join("");

      // 5. Apply Post-processing Rules (similar to the ones in "Hindi one")
      // Note: Apply these carefully, they might interact differently when applied per chunk
      processedChunk = processedChunk
        // Generic post-processing
        .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ") // Example rule
        .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ") // Example rule
        .replace(/ʲ/g, "j")
        .replace(/r/g, "ɹ") // Common IPA adjustment
        .replace(/x/g, "k") // Common IPA adjustment
        .replace(/ɬ/g, "l") // Common IPA adjustment
        .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ") // Example rule
        .replace(/ z(?=[;:,.!?¡¿—…"«»""(){}[] ]|$)/g, "z"); // Example rule

      // Language-specific post-processing for the chunk
      if (language === "a") { // US English specific
          processedChunk = processedChunk.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
      } else if (targetLanguage === 'hinglish' || targetLanguage === 'hindi') {
          // Hinglish/Hindi specific post-processing
          processedChunk = processedChunk
              // Basic pronunciation fixes (adapt/expand as needed)
              .replace(/kəʊn/g, "kɔːn")
              .replace(/həʊ/g, "hoː")
              // Schwa deletion/handling might be complex per-chunk, test carefully
              // .replace(/([kKgGtTdDpPbB])ə([ɾr])/g, "$1$2")
              // .replace(/([aeiouy])([ɾr])([aeiouy])/g, "$1$2$3")
              // Aspirated spacing might add too many spaces if chunks are small
              // .replace(/([kKgGtTdDpPbB][ɦh])/g, "$1 ")
              // Final vowel lengthening (might be okay per chunk)
              .replace(/([aeiou])([^aeiou\s]+)$/g, "$1ː$2");
      }
      
      // 6. Yield the fully processed chunk
      // Add a space after each chunk for separation, trim later if needed downstream
      yield processedChunk.trim() + " "; 
    }
  }