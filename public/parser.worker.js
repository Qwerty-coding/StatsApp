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
    for (const [key, pattern] of Object.entries(patterns)) {
      scores[key] = this.lines.slice(0, 20).filter(line => pattern.regex.test(line)).length;
    }

    const detected = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
    const matchCount = scores[detected];
    const confidence = (matchCount / Math.min(20, this.lines.length)) * 100;

    this.detectedFormat = { key: detected, parser: patterns[detected].parser, confidence };
    return this.detectedFormat;
  }

  parse() {
    try {
      const format = this.detectFormat();
      if (format.confidence < 50) this.errors.push(`Low confidence format (${format.confidence}%).`);
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
    
    // Regex handles M/D/YY or M/D/YYYY and the special invisible space before AM/PM
    const timestampRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})[\s\u202F]*([aApP][mM])\s+-\s+(.+?):\s+(.*)/;
    const systemMessageRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})[\s\u202F]*([aApP][mM])\s+-\s+(.+?)$/;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      
      const match = line.match(timestampRegex);
      if (match) {
        if (currentMessage) messages.push(currentMessage);
        const [, month, day, yearShort, hour, min, ampm, sender, text] = match;
        const year = this.expandYearShort(parseInt(yearShort));
        
        currentMessage = {
          timestamp: this.parseTimestampIOS12h(month, day, year.toString(), hour, min, '00', ampm.toUpperCase()),
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
        const [, month, day, yearShort, hour, min, ampm, content] = sysMatch;
        const year = this.expandYearShort(parseInt(yearShort));
        
        currentMessage = {
          timestamp: this.parseTimestampIOS12h(month, day, year.toString(), hour, min, '00', ampm.toUpperCase()),
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
    const userStats = {};
    const hourlyStats = Array(24).fill(0);
    const dayStats = Array(7).fill(0);
    let firstTimestamp = Infinity;
    let lastTimestamp = -Infinity;

    for (const msg of messages) {
      if (msg.isSystem) continue;
      if (!userStats[msg.sender]) {
        userStats[msg.sender] = { messageCount: 0, firstSeen: msg.timestamp, lastSeen: msg.timestamp };
      }
      userStats[msg.sender].messageCount += 1;
      userStats[msg.sender].lastSeen = Math.max(userStats[msg.sender].lastSeen, msg.timestamp);

      const date = new Date(msg.timestamp);
      hourlyStats[date.getHours()] += 1;
      dayStats[date.getDay()] += 1;
      firstTimestamp = Math.min(firstTimestamp, msg.timestamp);
      lastTimestamp = Math.max(lastTimestamp, msg.timestamp);
    }

    const sortedUsers = Object.entries(userStats).map(([sender, stats]) => ({ sender, ...stats })).sort((a, b) => b.messageCount - a.messageCount);
    const totalMessages = messages.filter(m => !m.isSystem).length;
    const totalUsers = sortedUsers.length;
    const avgPerUser = totalUsers > 0 ? (totalMessages / totalUsers).toFixed(1) : 0;
    const daysActive = (lastTimestamp - firstTimestamp) / (1000 * 60 * 60 * 24);
    const busiestHour = hourlyStats.indexOf(Math.max(...hourlyStats));
    const busiestDay = dayStats.indexOf(Math.max(...dayStats));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return {
      totalMessages,
      totalUsers,
      avgPerUser,
      daysActive: daysActive.toFixed(1),
      busiestHour: `${busiestHour}:00`,
      busiestDay: dayNames[busiestDay],
      firstMessage: new Date(firstTimestamp).toLocaleDateString(),
      lastMessage: new Date(lastTimestamp).toLocaleDateString(),
      userStats: sortedUsers,
      hourlyStats,
      dayStats,
    };
  }
}

self.onmessage = function (e) {
  const parser = new WhatsAppParser(e.data);
  const result = parser.parse();
  self.postMessage({
    success: result.success,
    format: result.format,
    stats: result.stats,
    messages: result.messages,
    warnings: result.warnings
  });
};