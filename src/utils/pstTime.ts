export function getPSTDate(): Date {
  // Convert current time to America/Los_Angeles timezone
  const now = new Date();
  const pstString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  return new Date(pstString);
}

export function formatPSTTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' PST';
}

export function formatPSTDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function getTimeUntil4PMPST(): {
  hours: number;
  minutes: number;
  seconds: number;
  isPast4PMToday: boolean;
  targetPSTString: string;
} {
  const pstNow = getPSTDate();
  
  // Set target for today at 4:00:00 PM PST
  const targetPST = new Date(pstNow);
  targetPST.setHours(16, 0, 0, 0);

  let isPast4PMToday = false;
  let diffMs = targetPST.getTime() - pstNow.getTime();

  if (diffMs < 0) {
    isPast4PMToday = true;
    // Target is tomorrow at 4:00 PM PST
    targetPST.setDate(targetPST.getDate() + 1);
    diffMs = targetPST.getTime() - pstNow.getTime();
  }

  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    isPast4PMToday,
    targetPSTString: targetPST.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) + ' PST'
  };
}
