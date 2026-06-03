class WhatsAppParser {
  constructor(fileContent) {
    this.lines = fileContent.replace(/\r\n/g, "\n").split('\n');
    this.detectedFormat = null;
    this.errors = [];
  }

  detectFormat() {
    const patterns = {
      ios_12h_slash: { regex: /^\[\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+(AM|PM)\]/, parser: this.parseIOS12hSlash.bind(this) },
      android_24h_dot: { regex: /^\d{1,2}\.\d{1,2}\.\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+-\s+/, parser: this.parseAndroid24hDot.bind(this) },
      android_24h_slash: { regex: /^\d{1,2}\/\d{1,2}\/\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+-\s+/, parser: this.parseAndroid24hSlash.bind(this) },
      india_ddmmyy_short: { regex: /^\d{1,2}\/\d{1,2}\/\d{2},\s+\d{1,2}:\d{2}\s+-\s+/, parser: this.parseIndiaShortDate.bind(this) },
      android_12h_short: { regex: /^\d{1,2}\/\d{1,2}\/\d{2,4},\s+\d{1,2}:\d{2}[\s\u202F]*[aApP][mM]\s+-\s+/, parser: this.parseAndroid12hShort.bind(this) },
      india_ddmmmyy: { regex: /^\d{1,2}\/\w{3}\/\d{2},\s+\d{1,2}:\d{2}\s+-\s+/, parser: this.parseIndiaMonthAbbrev.bind(this) },
    };

    const scores = {};
    const sampleLines = this.lines.slice(0, 50);
    
    for (const [key, pattern] of Object.entries(patterns)) {
      scores[key] = sampleLines.filter(line => pattern.regex.test(line)).length;
    }

    const detected = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
    const matchCount = scores[detected];
    const confidence = (matchCount / Math.min(50, this.lines.length)) * 100;

    this.detectedFormat = { key: detected, parser: patterns[detected].parser, confidence };
    return this.detectedFormat;
  }

  parse() {
    try {
      const format = this.detectFormat();
      if (format.confidence < 25) this.errors.push(`Low confidence format (${format.confidence}%).`);
      
      const messages = format.parser();
      const stats = this.aggregateStats(messages);
      
      return { success: this.errors.length === 0, messages, stats, format: format.key, warnings: this.errors };
    } catch (error) {
      return { success: false, messages: [], stats: null, format: null, warnings: [error.message] };
    }
  }

  parseIOS12hSlash() {
    const messages = [];
    let currentMessage = null;
    const timestampRegex = /^\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\]\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^\[(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\]\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, month, day, year, hour, min, sec, ampm, sender, text] = match;
        currentMessage = {
          timestamp: this.parseTimestampIOS12h(month, day, year, hour, min, sec, ampm),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes('<Media omitted>'),
          isSystem: false
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, month, day, year, hour, min, sec, ampm, content] = sysMatch;
        currentMessage = {
          timestamp: this.parseTimestampIOS12h(month, day, year, hour, min, sec, ampm),
          sender: '[System]',
          text: content.trim(),
          isMedia: false,
          isSystem: true
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += '\n' + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseAndroid24hDot() {
    const messages = [];
    let currentMessage = null;
    const timestampRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\.(\d{1,2})\.(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, sender, text] = match;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes('<Media omitted>'),
          isSystem: false
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, content] = sysMatch;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: '[System]',
          text: content.trim(),
          isMedia: false,
          isSystem: true
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += '\n' + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseAndroid12hShort() {
    const messages = [];
    let currentMessage = null;
    
    const prefixRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})[\s\u202F]*([aApP][mM])\s+-\s+(.*)/;
    
    const systemKeywords = [
      "created group", "added you", "added", "removed", "left", 
      "changed group description", "changed the subject", "changed this group's icon",
      "Messages and calls are end-to-end encrypted", "changed their phone number", "joined using this group's invite link"
    ];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (!line.trim()) continue;

      const match = line.match(prefixRegex);

      if (match) {
        if (currentMessage) messages.push(currentMessage);

        const [, month, day, yearShort, hour, min, ampm, restOfLine] = match;
        const year = this.expandYearShort(parseInt(yearShort));
        const timestamp = this.parseTimestampIOS12h(month, day, year.toString(), hour, min, '00', ampm.toUpperCase());

        const colonIndex = restOfLine.indexOf(": ");
        let isSystem = true;
        let sender = "[System]";
        let text = restOfLine;

        if (colonIndex !== -1) {
          const tentativeSender = restOfLine.substring(0, colonIndex);
          const matchesSystemAction = systemKeywords.some(keyword => tentativeSender.includes(keyword));
          
          if (!matchesSystemAction) {
            isSystem = false;
            sender = tentativeSender.trim();
            text = restOfLine.substring(colonIndex + 2).trim();
          }
        }

        if (isSystem) {
          isSystem = systemKeywords.some(keyword => restOfLine.includes(keyword)) || colonIndex === -1;
        }

        currentMessage = {
          timestamp,
          sender,
          text,
          isMedia: text.includes('<Media omitted>'),
          isSystem
        };
      } else {
        if (currentMessage) currentMessage.text += '\n' + line;
      }
    }
    
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseAndroid24hSlash() {
    const messages = [];
    let currentMessage = null;
    const timestampRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s+(\d{1,2}):(\d{2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, sender, text] = match;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes('<Media omitted>'),
          isSystem: false
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, year, hour, min, sec, content] = sysMatch;
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year, hour, min, sec),
          sender: '[System]',
          text: content.trim(),
          isMedia: false,
          isSystem: true
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += '\n' + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseIndiaShortDate() {
    const messages = [];
    let currentMessage = null;
    const timestampRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, yearShort, hour, min, sender, text] = match;
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, '00'),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes('<Media omitted>'),
          isSystem: false
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, month, yearShort, hour, min, content] = sysMatch;
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, '00'),
          sender: '[System]',
          text: content.trim(),
          isMedia: false,
          isSystem: true
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += '\n' + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseIndiaMonthAbbrev() {
    const messages = [];
    let currentMessage = null;
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const timestampRegex = /^(\d{1,2})\/(\w{3})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\/(\w{3})\/(\d{2}),\s+(\d{1,2}):(\d{2})\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, monthStr, yearShort, hour, min, sender, text] = match;
        const month = months[monthStr.toLowerCase()] || '01';
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, '00'),
          sender: sender.trim(),
          text: text.trim(),
          isMedia: text.includes('<Media omitted>'),
          isSystem: false
        };
        continue;
      }
      const sysMatch = line.match(systemMessageRegex);
      if (sysMatch) {
        if (currentMessage) messages.push(currentMessage);
        const [, day, monthStr, yearShort, hour, min, content] = sysMatch;
        const month = months[monthStr.toLowerCase()] || '01';
        const year = this.expandYearShort(parseInt(yearShort));
        currentMessage = {
          timestamp: this.parseTimestamp24h(day, month, year.toString(), hour, min, '00'),
          sender: '[System]',
          text: content.trim(),
          isMedia: false,
          isSystem: true
        };
        continue;
      }
      if (currentMessage && line.trim()) currentMessage.text += '\n' + line;
    }
    if (currentMessage) messages.push(currentMessage);
    return messages;
  }

  parseTimestampIOS12h(month, day, year, hour, min, sec, ampm) {
    let hour24 = parseInt(hour);
    if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
    else if (ampm === 'AM' && hour24 === 12) hour24 = 0;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(min), parseInt(sec)).getTime();
  }

  parseTimestamp24h(day, month, year, hour, min, sec) {
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(min), parseInt(sec)).getTime();
  }

  expandYearShort(year) {
    return year > 50 ? 1900 + year : 2000 + year;
  }

  aggregateStats(messages) {
    if (!messages || messages.length === 0) return {};

    const userCounts = {};
    const dayCounts = {};
    const dateCounts = {};
    const hourlyStats = Array(24).fill(0);
    let validMessages = [];

    for (const msg of messages) {
      if (msg.isSystem) continue;

      validMessages.push(msg);

      const sender = msg.sender;
      userCounts[sender] = (userCounts[sender] || 0) + 1;

      const date = new Date(msg.timestamp);
      if (!isNaN(date.getTime())) {
        const day = date.toLocaleDateString("en-US", { weekday: "long" });
        const hour = date.getHours();
        
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        dayCounts[day] = (dayCounts[day] || 0) + 1;
        dateCounts[dateKey] = (dateCounts[dateKey] || 0) + 1;
        hourlyStats[hour]++;
      }
    }

    if (validMessages.length === 0) return {};

    validMessages.sort((a, b) => a.timestamp - b.timestamp);

    let maxGapMs = 0;
    let totalGapMs = 0;
    let gapCount = 0;

    for (let i = 1; i < validMessages.length; i++) {
      const gap = validMessages[i].timestamp - validMessages[i - 1].timestamp;
      if (gap > maxGapMs) maxGapMs = gap;
      totalGapMs += gap;
      gapCount++;
    }

    const formatDuration = (ms) => {
      const hours = ms / (1000 * 60 * 60);
      if (hours > 24) {
        return `${Math.round(hours / 24)} Days`;
      }
      return hours < 1 ? `${Math.round(hours * 60)} Mins` : `${hours.toFixed(1)} Hours`;
    };

    const longestSilence = maxGapMs > 0 ? formatDuration(maxGapMs) : "—";
    const avgResponseTime = gapCount > 0 ? formatDuration(totalGapMs / gapCount) : "—";

    let busiestDay = "";
    let maxDayCount = 0;
    for (const [day, count] of Object.entries(dayCounts)) {
      if (count > maxDayCount) {
        maxDayCount = count;
        busiestDay = day;
      }
    }
    
    let busiestDate = "";
    let busiestDateCount = 0;
    for (const [dateKey, count] of Object.entries(dateCounts)) {
      if (count > busiestDateCount) {
        busiestDateCount = count;
        busiestDate = dateKey;
      }
    }

    let busiestHour = 0;
    let maxHourCount = 0;
    for (let i = 0; i < 24; i++) {
      if (hourlyStats[i] > maxHourCount) {
        maxHourCount = hourlyStats[i];
        busiestHour = i;
      }
    }

    const userStats = Object.entries(userCounts)
      .map(([sender, count]) => ({ sender, messageCount: count }))
      .sort((a, b) => b.messageCount - a.messageCount);

    const totalMessages = validMessages.length;
    const totalUsers = userStats.length;

    return {
      totalMessages,
      totalUsers,
      avgPerUser: totalUsers > 0 ? totalMessages / totalUsers : 0,
      firstMessage: validMessages[0].timestamp,
      lastMessage: validMessages[validMessages.length - 1].timestamp,
      busiestDay,
      busiestHour,
      busiestDate,
      busiestDateCount,
      hourlyStats,
      userStats,
      longestSilence,
      avgResponseTime
    };
  }
}

function extractTelegramText(textField) {
  if (typeof textField === 'string') {
    return textField;
  }
  if (Array.isArray(textField)) {
    return textField
      .map(segment => {
        if (typeof segment === 'string') return segment;
        if (segment && typeof segment === 'object' && typeof segment.text === 'string') return segment.text;
        return '';
      })
      .join('');
  }
  return '';
}

function parseTelegram(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid Telegram JSON: ' + e.message);
  }

  const rawMessages = data.messages;
  if (!Array.isArray(rawMessages)) {
    throw new Error('Telegram JSON does not contain a "messages" array.');
  }

  const messages = [];

  for (const msg of rawMessages) {
    if (msg.type !== 'message') continue;

    const plainText = extractTelegramText(msg.text);
    if (!plainText || !plainText.trim()) continue;

    const sender = (msg.from || '[Unknown]').trim();
    const timestamp = msg.date ? new Date(msg.date).getTime() : Date.now();

    messages.push({
      timestamp,
      sender,
      text: plainText.trim(),
      isMedia: false,
      isSystem: false
    });
  }

  return messages;
}

self.onmessage = function (e) {
  const { text, fileType } = e.data;

  try {
    let messages;
    let format;

    if (fileType === 'telegram') {
      messages = parseTelegram(text);
      format = 'telegram_json';
    } else {
      const parser = new WhatsAppParser(text);
      const result = parser.parse();

      self.postMessage({
        success: result.success,
        format: result.format,
        stats: result.stats,
        messages: result.messages,
        warnings: result.warnings
      });
      return;
    }

    const parser = new WhatsAppParser('');
    const stats = parser.aggregateStats(messages);

    self.postMessage({
      success: true,
      format,
      stats,
      messages,
      warnings: []
    });
  } catch (error) {
    self.postMessage({
      success: false,
      format: null,
      stats: null,
      messages: [],
      warnings: [error.message]
    });
  }
};