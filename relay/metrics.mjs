import { randomUUID } from 'node:crypto';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const defaults = { minutesPerCompletedTask: 30, leaderboardEnabled: false, displayName: '' };

export function createMetrics(db, now) {
  // Event timestamps survive cancellation, callback retries, and later status reads.
  if (!db.prepare('PRAGMA table_info(tasks)').all().some(c => c.name === 'shipped_at')) {
    db.exec(`BEGIN IMMEDIATE;
      ALTER TABLE tasks ADD COLUMN shipped_at INTEGER;
      ALTER TABLE tasks ADD COLUMN completed_at INTEGER;
      UPDATE tasks SET shipped_at=created_at WHERE status NOT IN ('draft','cancelled');
      UPDATE tasks SET completed_at=updated_at WHERE status='completed';
      COMMIT;`);
  }
  db.exec(`CREATE TABLE IF NOT EXISTS dashboard_preferences (
    owner TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    public_id TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '',
    leaderboard_enabled INTEGER NOT NULL DEFAULT 0,
    minutes_per_task INTEGER NOT NULL DEFAULT 30);
    CREATE INDEX IF NOT EXISTS shipped_by_owner ON tasks(owner,shipped_at);
    CREATE INDEX IF NOT EXISTS completed_by_owner ON tasks(owner,completed_at);
    PRAGMA user_version=4;`);

  const preferences = owner => {
    const row = db.prepare('SELECT * FROM dashboard_preferences WHERE owner=?').get(owner);
    return row ? {minutesPerCompletedTask:row.minutes_per_task, leaderboardEnabled:!!row.leaderboard_enabled, displayName:row.display_name} : {...defaults};
  };
  const total = (owner, since) => {
    const counts = db.prepare(`SELECT
      COUNT(CASE WHEN shipped_at>=? THEN 1 END) AS promptsShipped,
      COUNT(CASE WHEN completed_at>=? THEN 1 END) AS tasksCompleted
      FROM tasks WHERE owner=?`).get(since,since,owner);
    return {...counts, estimatedMinutesSaved:counts.tasksCompleted*preferences(owner).minutesPerCompletedTask};
  };
  const dashboard = owner => ({
    allTime:total(owner,0), last7Days:total(owner,now()-WEEK),
    preferences:preferences(owner), asOf:now(), estimateMethod:'completed_tasks_times_personal_baseline'
  });
  const update = (owner, input) => {
    const current=preferences(owner);
    const minutes=input.minutesPerCompletedTask ?? current.minutesPerCompletedTask;
    const enabled=input.leaderboardEnabled ?? current.leaderboardEnabled;
    const name=typeof input.displayName==='string' ? input.displayName.trim() : current.displayName;
    const invalid = message => {throw Object.assign(new Error(message),{status:400});};
    if(!Number.isInteger(minutes)||minutes<0||minutes>480)invalid('Choose an estimate from 0 to 480 minutes per completed task.');
    if(typeof enabled!=='boolean')invalid('Choose whether to join the leaderboard.');
    if(name.length>24 || (name && !/^[\p{L}\p{N} _.-]+$/u.test(name)))invalid('Use up to 24 letters, numbers, spaces, dots, dashes or underscores for your display name.');
    if(enabled && name.length<2)invalid('Choose a public display name before joining.');
    db.prepare(`INSERT INTO dashboard_preferences(owner,public_id,display_name,leaderboard_enabled,minutes_per_task)
      VALUES (?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET display_name=excluded.display_name,
      leaderboard_enabled=excluded.leaderboard_enabled,minutes_per_task=excluded.minutes_per_task`)
      .run(owner,randomUUID(),name,Number(enabled),minutes);
    return dashboard(owner);
  };
  const leaderboard = owner => {
    // Only opted-in aliases and aggregate counts leave the account boundary.
    // Estimated hours are private and never determine rank.
    const rows=db.prepare(`WITH counts AS (
      SELECT p.owner,p.public_id AS id,p.display_name AS displayName,
        COUNT(CASE WHEN t.shipped_at>=? THEN 1 END) AS promptsShipped,
        COUNT(CASE WHEN t.completed_at>=? THEN 1 END) AS tasksCompleted
      FROM dashboard_preferences p LEFT JOIN tasks t ON t.owner=p.owner
      WHERE p.leaderboard_enabled=1 GROUP BY p.owner
    ), ranked AS (
      SELECT *,RANK() OVER (ORDER BY promptsShipped DESC) AS rank FROM counts WHERE promptsShipped>0
    ) SELECT * FROM ranked ORDER BY rank,displayName,id`).all(now()-WEEK,now()-WEEK);
    const publicRow=row=>({id:row.id,displayName:row.displayName,promptsShipped:row.promptsShipped,tasksCompleted:row.tasksCompleted,rank:row.rank,isYou:row.owner===owner});
    const mine=rows.find(row=>row.owner===owner);
    return {entries:rows.slice(0,20).map(publicRow),yourEntry:mine?publicRow(mine):null,participantCount:rows.length,windowStartedAt:now()-WEEK,asOf:now()};
  };
  return {dashboard,update,leaderboard};
}
