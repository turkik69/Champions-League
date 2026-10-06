from pathlib import Path

p = Path('cloudflare-worker-v2.js')
s = p.read_text()

old_boot = '        if (event.at <= now) boot[gulfEventKey(group,event.type)] = { done:true, bootstrapped:true, eventAt:event.at, at:now };'
new_boot = '''        if (event.at <= now) {
          const isFinalOpen = event.type === "open" && group.matches.some(m => m.stage === "final");
          const lockAt = new Date(group.ko).getTime() - (schedule.predictionLockMinutesBeforeKickoff || 30) * 60_000;
          if (!(isFinalOpen && now < lockAt)) {
            boot[gulfEventKey(group,event.type)] = { done:true, bootstrapped:true, eventAt:event.at, at:now };
          }
        }'''
if old_boot not in s and 'const isFinalOpen = event.type === "open" && group.matches.some(m => m.stage === "final");' not in s:
    raise SystemExit('bootstrap pattern not found')
if old_boot in s:
    s = s.replace(old_boot, new_boot, 1)

old_done = '''      if (state[key]?.done) continue;
      if (event.at<=now) due.push({group,event,key});'''
new_done = '''      if (state[key]?.done) {
        const isFinalOpen = event.type === "open" && group.matches.some(m => m.stage === "final");
        const lockAt = new Date(group.ko).getTime() - (schedule.predictionLockMinutesBeforeKickoff || 30) * 60_000;
        const recoverSkippedFinalOpen = isFinalOpen && now < lockAt && !state[key]?.sentAt && (state[key]?.skippedLate || state[key]?.bootstrapped);
        if (!recoverSkippedFinalOpen) continue;
      }
      if (event.at<=now) due.push({group,event,key});'''
if old_done not in s and 'const recoverSkippedFinalOpen =' not in s:
    raise SystemExit('done-state pattern not found')
if old_done in s:
    s = s.replace(old_done, new_done, 1)

old_late = '''  const maxLateMs=item.event.type==="open"?2*60*60_000:45*60_000;
  if (now-item.event.at>maxLateMs) {'''
new_late = '''  const isFinalOpen = item.event.type === "open" && item.group.matches.some(m => m.stage === "final");
  const finalLockAt = new Date(item.group.ko).getTime() - (schedule.predictionLockMinutesBeforeKickoff || 30) * 60_000;
  const finalOpenStillValid = isFinalOpen && now < finalLockAt;
  const maxLateMs=item.event.type==="open"?2*60*60_000:45*60_000;
  if (!finalOpenStillValid && now-item.event.at>maxLateMs) {'''
if old_late not in s and 'const finalOpenStillValid =' not in s:
    raise SystemExit('late-window pattern not found')
if old_late in s:
    s = s.replace(old_late, new_late, 1)

for old in [
    'service: "UCL + Gulf Cup Push Notifications v19"',
    'service: "UCL + Gulf Cup Push Notifications v19.1"'
]:
    s = s.replace(old, 'service: "UCL + Gulf Cup Push Notifications v20"')

p.write_text(s)
