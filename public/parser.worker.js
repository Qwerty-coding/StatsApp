// public/parser.worker.js
self.onmessage = function (e) {
  const lines = e.data.replace(/\r\n/g, "\n").split("\n");
  const messages = [];
  let current = null;

  // M/D/YY or M/D/YYYY, H:MM AM/PM - Sender: Message
  const MSG_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?\s?[AaPp][Mm])\s-\s([^:]+):\s?([\s\S]*)$/;
  // System line: same date prefix but no "Sender:" colon pattern
  const SYS_RE = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(\d{1,2}:\d{2}(?::\d{2})?\s?[AaPp][Mm])\s-\s(?![^:]+:\s)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    const m = trimmed.match(MSG_RE);
    if (m) {
      if (current) messages.push(current);
      current = {
        timestamp: `${m[1]} ${m[2]}`,
        sender: m[3].trim(),
        // Strip "<This message was edited>" trailer
        message: m[4].replace(/<This message was edited>$/,"").trim()
      };
      continue;
    }

    if (SYS_RE.test(trimmed)) {
      if (current) messages.push(current);
      current = null;
      continue;
    }

    // Continuation of multi-line message
    if (current) {
      current.message += "\n" + line;
    }
  }

  if (current) messages.push(current);

  self.postMessage({ success: true, count: messages.length, messages });
};